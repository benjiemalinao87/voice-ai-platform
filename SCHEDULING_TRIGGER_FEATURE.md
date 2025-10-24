# Scheduling Trigger Feature - Implementation Summary

## Overview
The Scheduling Trigger feature automatically sends appointment data to a destination webhook when a caller successfully books an appointment during a call.

## How It Works

### 1. **Appointment Detection**
When a call comes in through the VAPI webhook:
- OpenAI GPT-4o-mini analyzes the call transcript and summary
- Extracts appointment information if `intent = "Scheduling"` AND an appointment was actually booked
- Stores the following fields in `webhook_calls` table:
  - `customer_name` - Customer's full name
  - `customer_email` - Customer's email (if mentioned)
  - `appointment_date` - ISO format (YYYY-MM-DD)
  - `appointment_time` - 12-hour format (e.g., "2:00 PM")
  - `appointment_datetime` - Unix timestamp for easy querying
  - `appointment_type` - Type of appointment (Consultation, Service Call, etc.)
  - `appointment_notes` - Special instructions

### 2. **Trigger Firing**
After OpenAI analysis completes:
- Checks if `intent === "Scheduling"` AND both `appointment_date` and `appointment_time` have values
- If true, looks up all active scheduling triggers for the user
- Sends POST request to each destination webhook URL with appointment data

### 3. **Webhook Payload Format**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "phone_being_called": "+1987654321",
  "appointment_date": "2025-01-30",
  "appointment_time": "2:00 PM",
  "appointment_type": "Consultation",
  "appointment_notes": "Bring ID, Gate code: 1234",
  "recording": "https://vapi.ai/recordings/...",
  "call_summary": "Customer called to schedule...",
  "call_id": "wc_abc123",
  "intent": "Scheduling",
  "sentiment": "Positive",
  "outcome": "Successful",
  "enhanced_data": {
    // Only included if Enhanced Data addon is enabled and configured
    "name": "John Doe",
    "age": 44,
    "address": "1461 Indian Well Dr, Diamond Bar, CA 91765",
    "phone": "(626) 399-0400",
    "household_income": "$175K to $199K",
    "credit_score": "750 to 799",
    "home_ownership": "Home Owner",
    "property_value": "$1,196,000",
    // ... more enhanced data fields
  }
}
```

### 4. **Headers Sent**
- `Content-Type: application/json`
- `X-Trigger-Type: appointment-scheduled`
- `X-Call-ID: {call_id}`

## Database Tables

### `webhook_calls` (Updated)
New columns added:
```sql
appointment_date TEXT           -- ISO date (YYYY-MM-DD)
appointment_time TEXT           -- 12-hour time (HH:MM AM/PM)
appointment_datetime INTEGER    -- Unix timestamp
appointment_type TEXT           -- Type of appointment
appointment_notes TEXT          -- Special notes
customer_name TEXT              -- Customer's name
customer_email TEXT             -- Customer's email
```

### `scheduling_triggers`
Stores webhook destinations:
```sql
id TEXT PRIMARY KEY
user_id TEXT
name TEXT                       -- User-friendly name
destination_url TEXT            -- Webhook URL to POST to
is_active INTEGER               -- 1 = active, 0 = disabled
send_enhanced_data INTEGER      -- 1 = include enhanced data, 0 = exclude
created_at INTEGER
updated_at INTEGER
```

### `scheduling_trigger_logs`
Audit trail of webhook deliveries:
```sql
id TEXT PRIMARY KEY
trigger_id TEXT
call_id TEXT
status TEXT                     -- 'success' | 'error'
http_status INTEGER             -- HTTP status code
response_body TEXT              -- Response from destination
error_message TEXT              -- Error details if failed
payload_sent TEXT               -- JSON payload sent
created_at INTEGER
```

## API Endpoints

### Scheduling Triggers Management
- `GET /api/scheduling-triggers` - List all triggers for user
- `POST /api/scheduling-triggers` - Create new trigger
  ```json
  {
    "name": "CRM Integration",
    "destination_url": "https://my-crm.com/webhook",
    "send_enhanced_data": true
  }
  ```
- `PUT /api/scheduling-triggers/{id}` - Update trigger
- `DELETE /api/scheduling-triggers/{id}` - Delete trigger

### Logs
- `GET /api/scheduling-trigger-logs?trigger_id={id}` - View webhook delivery logs

## Migrations Required

Run these migrations in order:

1. **0004_add_appointment_fields.sql** - Adds appointment columns to webhook_calls
2. **0005_create_scheduling_triggers.sql** - Creates scheduling_triggers and logs tables

## OpenAI Analysis Updates

The OpenAI analysis prompt now intelligently extracts:
- Customer name and email from conversation
- Appointment date (handles "tomorrow", "next Monday", "January 15th", etc.)
- Appointment time in 12-hour format
- Appointment type and special notes
- **Only sets appointment fields if appointment was ACTUALLY SCHEDULED** (not just inquired)

## Next Steps

1. **Run Migrations** - Apply the two SQL migrations to your D1 database
2. **Deploy Worker** - Deploy the updated Cloudflare Worker
3. **Create UI** - Build the Scheduling Triggers management interface in Settings
4. **Test** - Send a test call with appointment booking to verify trigger fires

## Testing the Feature

### Step 1: Create a Trigger
```bash
curl -X POST https://your-worker.workers.dev/api/scheduling-triggers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Trigger",
    "destination_url": "https://webhook.site/unique-url",
    "send_enhanced_data": true
  }'
```

### Step 2: Send Test Call
Make a VAPI call where the customer books an appointment. The transcript should clearly mention:
- Appointment date
- Appointment time
- Customer's name
- (Optional) Customer's email

### Step 3: Verify Webhook
Check your destination URL (e.g., webhook.site) to see if the payload was received.

### Step 4: Check Logs
```bash
curl https://your-worker.workers.dev/api/scheduling-trigger-logs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Error Handling

- All webhook delivery failures are logged in `scheduling_trigger_logs`
- Non-blocking: If webhook fails, the call data is still saved
- Retries: Currently no automatic retries (can be added if needed)
- Timeout: Default fetch timeout applies

## Security Considerations

- All endpoints require authentication (Bearer token)
- User can only access their own triggers and logs
- Destination URLs are not validated (user responsible for security)
- Consider adding HMAC signatures for webhook verification (future enhancement)

## Performance Notes

- Webhook sending happens in background (`ctx.waitUntil`)
- Does not block the main webhook response
- OpenAI analysis already happens in background
- Trigger fires immediately after OpenAI analysis completes

---

**Status**: Backend implementation complete ✅
**Next**: Build UI for managing scheduling triggers in Settings panel
