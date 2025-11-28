# Outbound Webhook Payload Format

## Overview
This is the simplified JSON payload that will be sent to your webhook URL when an inbound call event occurs in real-time.

## Event Types
- `call.started` - Triggered when a call is received (ringing/in-progress)
- `call.ended` - Triggered when a call ends with full details

---

## Event: `call.started`

Sent when an inbound call is received (real-time notification).

```json
{
  "event": "call.started",
  "timestamp": "2025-11-05T01:13:36.758Z",
  "call_id": "019a5193-90ae-7fff-b06b-d09a3312294a",
  "customer_phone": "+16263198020",
  "assistant_name": "Alex",
  "status": "ringing"
}
```

---

## Event: `call.ended`

Sent when a call ends with complete details.

```json
{
  "event": "call.ended",
  "timestamp": "2025-11-05T01:15:12.046Z",
  "call_id": "019a5193-90ae-7fff-b06b-d09a3312294a",
  "customer_phone": "+16263198020",
  "assistant_name": "Alex",
  "duration_seconds": 69,
  "ended_reason": "customer-ended-call",
  "summary": "Ian Horowitz, calling from the Los Angeles Sam's Club, was assisting a customer named Jay Sun who is interested in a full bathroom remodel. The call ended abruptly with Ian stating he would call back before further details could be discussed.",
  "structured_data": {
    "employee_name": "Ian Horowitz",
    "customer_name": "Jay Sun",
    "location": "Los Angeles Sam's Club",
    "project_type": "Full bathroom remodel",
    "lead_type": "Event"
  },
  "conversation": [
    {
      "role": "assistant",
      "message": "Thank you for calling Home Project Partner scheduling department. This is Alex. Who do I have the pleasure of speaking with?"
    },
    {
      "role": "user",
      "message": "Yeah. It's the same thing for the other 1. Look. Listen to this. Hello? Can you hear me?"
    },
    {
      "role": "assistant",
      "message": "Hello. I can hear you. Are you calling from a neighborhood Canvas or from an event?"
    },
    {
      "role": "user",
      "message": "Yeah. I'm calling from an event. I'm here with a customer named Jay Sun."
    },
    {
      "role": "assistant",
      "message": "Thank you. And may I ask your name and the market or location you're calling from?"
    },
    {
      "role": "user",
      "message": "Yeah. My name is Ian Horowitz. I'm here at the Los Angeles Sam's Club store."
    },
    {
      "role": "assistant",
      "message": "Thank you, Ian. So you're at the Los Angeles Sam's Club. With Jason. Perfect. Now, what type of bathroom project is JSON considering? Is it a full remodel, tub to shower conversion, or something else?"
    },
    {
      "role": "user",
      "message": "Full bathroom remodel. Full bathroom remodel. Let me call you back."
    }
  ],
  "recording_url": "https://storage.vapi.ai/019a5193-90ae-7fff-b06b-d09a3312294a-1762305288953-4cb60259-d377-40f9-a7dc-4c01d8c0ffaa-mono.wav"
}
```

---

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type: `call.started` or `call.ended` |
| `timestamp` | string | ISO 8601 timestamp when event occurred |
| `call_id` | string | Unique VAPI call identifier |
| `customer_phone` | string | Customer's phone number (E.164 format) |
| `assistant_name` | string | Name of the AI assistant that handled the call |
| `duration_seconds` | number | Call duration in seconds (only in `call.ended`) |
| `ended_reason` | string | Reason call ended (only in `call.ended`) |
| `summary` | string | AI-generated call summary (only in `call.ended`) |
| `structured_data` | object | **Dynamic** - Extracted structured data based on your assistant's schema configuration in VAPI (only in `call.ended`) |
| `conversation` | array | Clean conversation transcript with role and message (only in `call.ended`) |
| `recording_url` | string | URL to call recording audio file (only in `call.ended`) |

---

## Webhook Delivery Details

- **Method**: `POST`
- **Content-Type**: `application/json`
- **Timeout**: 10 seconds
- **Retries**: 3 attempts with exponential backoff
- **Expected Response**: HTTP 200-299 for success

---

## Important Notes

### Dynamic Structured Data
The `structured_data` field is **completely dynamic** and will vary based on your VAPI assistant's configuration. Each assistant can have a different schema for extracting structured data from calls.

**Examples of different schemas:**

Home Project Partner (Bathroom Remodeling):
```json
{
  "employee_name": "Ian Horowitz",
  "customer_name": "Jay Sun",
  "location": "Los Angeles Sam's Club",
  "project_type": "Full bathroom remodel"
}
```

Smart Cremation (Funeral Services):
```json
{
  "First Name": "Vontrin",
  "Last name": null,
  "Email address": null,
  "Membership ID": null,
  "City": null,
  "State": null
}
```

The webhook will pass through whatever structured data your assistant extracts, regardless of the schema.
