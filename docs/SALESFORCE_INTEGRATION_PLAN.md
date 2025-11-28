# Salesforce Integration Implementation Plan (MVP)

## 🎯 Goal
**Simple MVP**: When a call ends, automatically log it in Salesforce by:
1. Searching for existing Lead/Contact by phone number
2. Creating a call log Task on that record
3. **BONUS**: If appointment was scheduled during call, create Event/Appointment
4. **Zero Apex code required** - pure OAuth + REST API

---

## 📋 Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SALESFORCE INTEGRATION MVP                        │
└─────────────────────────────────────────────────────────────────────────┘

   User Setup (One-Time)              Call Processing (Automatic)
   ==================                 ===========================

   ┌──────────────┐                   ┌──────────────────────┐
   │   User       │                   │  Incoming Call Ends  │
   │  Clicks      │                   └──────────┬───────────┘
   │ "Connect     │                              │
   │ Salesforce"  │                              │
   └──────┬───────┘                              │
          │                                      │
          │                                      ▼
          ▼                              ┌──────────────────────┐
   ┌──────────────┐                     │  Webhook Received    │
   │  OAuth       │                     │  with Phone Number   │
   │  Popup       │                     └──────────┬───────────┘
   │  Opens       │                                │
   └──────┬───────┘                                │
          │                                        ▼
          │                          ┌─────────────────────────────┐
          │                          │ 1. Search Salesforce        │
          │                          │    SOSL: FIND {phone} IN    │
          │                          │    PHONE FIELDS RETURNING   │
          │                          │    Lead, Contact            │
          ▼                          └─────────────┬───────────────┘
   ┌──────────────┐                                │
   │  User        │                                │
   │  Approves    │                    ┌───────────▼──────────┐
   │  Access      │                    │ Lead/Contact Found?  │
   └──────┬───────┘                    └───────────┬──────────┘
          │                                        │
          │                              ┌─────────┴─────────┐
          │                              │                   │
          ▼                             YES                 NO
   ┌──────────────┐                     │                   │
   │  Callback    │                     ▼                   ▼
   │  with Auth   │           ┌──────────────────┐  ┌──────────────┐
   │  Code        │           │ Get Salesforce   │  │  Skip        │
   └──────┬───────┘           │ Record ID        │  │  (Log Error) │
          │                   └────────┬─────────┘  └──────────────┘
          │                            │
          ▼                            │
   ┌──────────────┐                   │
   │  Exchange    │                   ▼
   │  Code for    │         ┌─────────────────────────────┐
   │  Access +    │         │ 2. Create Task via REST API │
   │  Refresh     │         │    POST /sobjects/Task      │
   │  Tokens      │         │    {                        │
   └──────┬───────┘         │      WhoId: recordId,       │
          │                 │      Subject: "Call Log",   │
          │                 │      Type: "Call",          │
          ▼                 │      Status: "Completed"    │
   ┌──────────────┐         │    }                        │
   │  Store in    │         └─────────────────────────────┘
   │  Database    │
   │  ✅ Connected│
   └──────────────┘

```

---

## 🔐 Authentication Flow (OAuth 2.0 Web Server Flow)

### Why OAuth 2.0?
- **User-friendly**: User just clicks "Allow" in Salesforce - no manual API key copying
- **Secure**: Tokens stored server-side, auto-refresh capability
- **No Apex Required**: Pure configuration in Salesforce Setup

### Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    OAUTH 2.0 WEB SERVER FLOW                                 │
└────────────────────────────────────────────────────────────────────────────┘

 Dashboard UI              Backend API              Salesforce
 =============             ===========              ==========

      │                        │                         │
      │  1. Click "Connect"    │                         │
      ├───────────────────────►│                         │
      │                        │                         │
      │                        │ 2. Build OAuth URL      │
      │                        │    with client_id       │
      │                        │    and redirect_uri     │
      │    OAuth URL           │                         │
      │◄───────────────────────┤                         │
      │                        │                         │
      │ 3. Open Popup          │                         │
      │    to Salesforce       │                         │
      ├────────────────────────┼────────────────────────►│
      │                        │                         │
      │                        │          4. User Sees   │
      │                        │             "Allow      │
      │                        │              Access?"   │
      │                        │                         │
      │                        │         5. User Clicks  │
      │                        │            "Allow"      │
      │                        │                         │
      │                        │  6. Redirect to         │
      │                        │     callback with       │
      │                        │     auth code           │
      │                        │◄────────────────────────┤
      │                        │                         │
      │                        │ 7. Exchange code for    │
      │                        │    access_token +       │
      │                        │    refresh_token        │
      │                        ├────────────────────────►│
      │                        │                         │
      │                        │  8. Return tokens       │
      │                        │◄────────────────────────┤
      │                        │                         │
      │                        │ 9. Store tokens in DB   │
      │                        │    (workspace_settings) │
      │                        │                         │
      │  10. Success! Close    │                         │
      │      Popup             │                         │
      │◄───────────────────────┤                         │
      │                        │                         │
      │  11. Show "Connected"  │                         │
      │      Status            │                         │
      │                        │                         │

```

### OAuth Endpoints

```
Authorization URL:
  https://login.salesforce.com/services/oauth2/authorize
  ?response_type=code
  &client_id={CLIENT_ID}
  &redirect_uri={CALLBACK_URL}
  &scope=api%20refresh_token

Token Exchange URL:
  POST https://login.salesforce.com/services/oauth2/token
  Content-Type: application/x-www-form-urlencoded

  grant_type=authorization_code
  &code={AUTH_CODE}
  &client_id={CLIENT_ID}
  &client_secret={CLIENT_SECRET}
  &redirect_uri={CALLBACK_URL}

Refresh Token URL:
  POST https://login.salesforce.com/services/oauth2/token
  Content-Type: application/x-www-form-urlencoded

  grant_type=refresh_token
  &refresh_token={REFRESH_TOKEN}
  &client_id={CLIENT_ID}
  &client_secret={CLIENT_SECRET}
```

---

## 🔍 Call Log Creation Flow

### Step-by-Step Process

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    CALL LOG CREATION PROCESS                                 │
└────────────────────────────────────────────────────────────────────────────┘

  Webhook Event                Backend Processing              Salesforce API
  =============                ===================             ==============

      │                               │                              │
      │  Call Ended                   │                              │
      │  { phone: "+1234567890",      │                              │
      │    summary: "...",            │                              │
      │    duration: 120 }            │                              │
      ├──────────────────────────────►│                              │
      │                               │                              │
      │                               │ 1. Get Workspace Settings    │
      │                               │    (Salesforce tokens)       │
      │                               │                              │
      │                               │ 2. Clean Phone Number        │
      │                               │    "+1234567890"             │
      │                               │    → "1234567890"            │
      │                               │                              │
      │                               │ 3. Search via SOSL           │
      │                               │    GET /search/?q=           │
      │                               │    FIND {1234567890}         │
      │                               │    IN PHONE FIELDS           │
      │                               │    RETURNING                 │
      │                               │      Lead(Id, Name, Phone),  │
      │                               │      Contact(Id, Name, Phone)│
      │                               ├─────────────────────────────►│
      │                               │                              │
      │                               │         Search Results       │
      │                               │◄─────────────────────────────┤
      │                               │                              │
      │                               │ 4. Parse Results             │
      │                               │    - Check Leads first       │
      │                               │    - Then Contacts           │
      │                               │    - Get first match ID      │
      │                               │                              │
      │                               │ 5. If Found: Create Task     │
      │                               │    POST /sobjects/Task       │
      │                               │    {                         │
      │                               │      WhoId: "00Q...",       │
      │                               │      Subject: "Call Log",    │
      │                               │      Type: "Call",           │
      │                               │      TaskSubtype: "Call",    │
      │                               │      CallType: "Inbound",    │
      │                               │      Status: "Completed",    │
      │                               │      Description: summary,   │
      │                               │      CallDurationInSeconds:  │
      │                               │        120                   │
      │                               │    }                         │
      │                               ├─────────────────────────────►│
      │                               │                              │
      │                               │      Task Created            │
      │                               │      { id: "00T..." }        │
      │                               │◄─────────────────────────────┤
      │                               │                              │
      │                               │ 6. Log Success               │
      │                               │                              │
      │         200 OK                │                              │
      │◄──────────────────────────────┤                              │
      │                               │                              │

  ERROR HANDLING:
  ───────────────

  ┌─ Access Token Expired?
  │  └─► Refresh token → Retry request
  │
  ┌─ Phone Number Not Found?
  │  └─► Log warning, skip Task creation
  │
  ┌─ Salesforce API Error?
  │  └─► Log error, retry with exponential backoff
  │
  └─ Network Error?
     └─► Queue for retry, alert admin if persistent

```

---

## 🗄️ Database Schema

### New Migration: `workers/migrations/00XX_add_salesforce_integration.sql`

```sql
-- Add Salesforce OAuth credentials to workspace_settings
ALTER TABLE workspace_settings ADD COLUMN salesforce_instance_url TEXT;
ALTER TABLE workspace_settings ADD COLUMN salesforce_access_token TEXT;
ALTER TABLE workspace_settings ADD COLUMN salesforce_refresh_token TEXT;
ALTER TABLE workspace_settings ADD COLUMN salesforce_token_expires_at INTEGER;

-- Optional: Track Salesforce sync activity
CREATE TABLE IF NOT EXISTS salesforce_sync_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  call_id TEXT NOT NULL,
  salesforce_record_id TEXT,
  salesforce_task_id TEXT,
  status TEXT NOT NULL, -- 'success', 'not_found', 'error'
  error_message TEXT,
  phone_number TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sf_sync_logs_workspace
  ON salesforce_sync_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sf_sync_logs_call
  ON salesforce_sync_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_sf_sync_logs_status
  ON salesforce_sync_logs(status);
```

### Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   workspace_settings                          │
├─────────────────────────────────────────────────────────────┤
│ id                             TEXT PRIMARY KEY              │
│ workspace_id                   TEXT UNIQUE                   │
│ ... (existing fields) ...                                    │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │           NEW SALESFORCE FIELDS                          │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ salesforce_instance_url      TEXT                        │ │
│ │   Example: "https://na1.salesforce.com"                 │ │
│ │                                                           │ │
│ │ salesforce_access_token      TEXT                        │ │
│ │   Short-lived (2 hours), used for API calls             │ │
│ │                                                           │ │
│ │ salesforce_refresh_token     TEXT                        │ │
│ │   Long-lived, never expires (unless revoked)            │ │
│ │                                                           │ │
│ │ salesforce_token_expires_at  INTEGER                     │ │
│ │   Unix timestamp, triggers token refresh                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  salesforce_sync_logs                         │
├─────────────────────────────────────────────────────────────┤
│ id                         TEXT PRIMARY KEY                  │
│ workspace_id               TEXT → workspaces.id              │
│ call_id                    TEXT (webhook_calls.id)           │
│ salesforce_record_id       TEXT (Lead/Contact ID)            │
│ salesforce_task_id         TEXT (Task ID created)            │
│ status                     TEXT ('success'|'not_found'|...)  │
│ error_message              TEXT                              │
│ phone_number               TEXT                              │
│ created_at                 INTEGER                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Implementation Architecture

### File Structure

```
workers/
  ├── index.ts                          # Main API routes
  ├── salesforce-service.ts             # NEW: Salesforce integration logic
  └── migrations/
      └── 00XX_add_salesforce.sql       # NEW: Database schema

src/
  ├── lib/
  │   └── d1.ts                         # Add Salesforce API methods
  └── components/
      └── Integration.tsx                # Update Salesforce modal
```

### Component Breakdown

```
┌────────────────────────────────────────────────────────────────┐
│                    COMPONENT ARCHITECTURE                        │
└────────────────────────────────────────────────────────────────┘

  Frontend                      Backend                   External
  ========                      =======                   ========

┌─────────────────┐         ┌────────────────────┐    ┌───────────┐
│ Integration.tsx │         │   workers/index.ts │    │ Salesforce│
│                 │         │                    │    │           │
│ - OAuth Button  │────────►│ - /api/salesforce/ │    │ - OAuth   │
│ - Status Check  │         │   oauth/initiate   │    │ - REST API│
│ - Disconnect    │         │                    │    │           │
└─────────────────┘         │ - /api/salesforce/ │    └─────▲─────┘
                            │   oauth/callback   │          │
┌─────────────────┐         │                    │          │
│   d1.ts Client  │         │ - /api/salesforce/ │          │
│                 │         │   disconnect       │          │
│ - initOAuth()   │         │                    │          │
│ - handleCallback│         │ - /api/salesforce/ │          │
│ - disconnect()  │         │   status           │          │
│ - getStatus()   │         └──────────┬─────────┘          │
└─────────────────┘                    │                    │
                                       │                    │
                            ┌──────────▼────────────┐       │
                            │ salesforce-service.ts │       │
                            │                       │       │
                            │ - exchangeCodeForToken│───────┤
                            │ - refreshAccessToken  │───────┤
                            │ - searchByPhone       │───────┤
                            │ - createCallLogTask   │───────┤
                            │ - disconnect          │───────┤
                            └───────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK PROCESSING                         │
└─────────────────────────────────────────────────────────────┘

  VAPI Webhook          workers/index.ts         salesforce-service
  ============          ================         ==================

      │                       │                          │
      │  POST /webhook/vapi   │                          │
      ├──────────────────────►│                          │
      │                       │                          │
      │                       │ 1. Process webhook       │
      │                       │ 2. Store in DB           │
      │                       │                          │
      │                       │ 3. Check workspace for   │
      │                       │    Salesforce connection │
      │                       │                          │
      │                       │ 4. If connected:         │
      │                       │    searchByPhone()       │
      │                       ├─────────────────────────►│
      │                       │                          │
      │                       │    5. Search Salesforce  │
      │                       │       via SOSL           │
      │                       │                          │
      │                       │    6. Return Lead/Contact│
      │                       │◄─────────────────────────┤
      │                       │                          │
      │                       │ 7. If found:             │
      │                       │    createCallLogTask()   │
      │                       ├─────────────────────────►│
      │                       │                          │
      │                       │    8. POST Task to SF    │
      │                       │                          │
      │                       │    9. Return Task ID     │
      │                       │◄─────────────────────────┤
      │                       │                          │
      │                       │ 10. Log sync result      │
      │                       │                          │
      │     200 OK            │                          │
      │◄──────────────────────┤                          │
      │                       │                          │

```

---

## 📝 API Specifications

### Backend Endpoints

#### 1. Initiate OAuth Flow
```
GET /api/salesforce/oauth/initiate

Response:
{
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?..."
}
```

#### 2. OAuth Callback
```
GET /api/salesforce/oauth/callback?code={CODE}&state={STATE}

Response:
{
  "success": true,
  "instanceUrl": "https://na1.salesforce.com"
}
```

#### 3. Get Connection Status
```
GET /api/salesforce/status

Response:
{
  "connected": true,
  "instanceUrl": "https://na1.salesforce.com",
  "lastSync": 1234567890
}
```

#### 4. Disconnect
```
DELETE /api/salesforce/disconnect

Response:
{
  "success": true,
  "message": "Salesforce disconnected"
}
```

#### 5. Manual Sync Test
```
POST /api/salesforce/test-sync
Body: {
  "callId": "wc_123456",
  "phoneNumber": "+1234567890"
}

Response:
{
  "success": true,
  "salesforceRecordId": "00Q...",
  "salesforceTaskId": "00T...",
  "recordType": "Lead"
}
```

---

## 🔧 Salesforce Configuration

### User Setup Steps (One-Time, ~5 minutes)

```
┌────────────────────────────────────────────────────────────────────────────┐
│           SALESFORCE CONNECTED APP SETUP (ADMIN ONLY)                        │
└────────────────────────────────────────────────────────────────────────────┘

Step 1: Create Connected App
─────────────────────────────
  1. Log in to Salesforce
  2. Go to Setup → Apps → App Manager
  3. Click "New Connected App"

  4. Fill in:
     ┌─────────────────────────────────────────────────────────────┐
     │ Connected App Name: "Voice AI Dashboard"                    │
     │ API Name:           voice_ai_dashboard                      │
     │ Contact Email:      your@email.com                          │
     │                                                              │
     │ ☑ Enable OAuth Settings                                     │
     │                                                              │
     │ Callback URL: https://yourdomain.com/api/salesforce/oauth/  │
     │               callback                                       │
     │                                                              │
     │ Selected OAuth Scopes:                                       │
     │   ► Access and manage your data (api)                       │
     │   ► Perform requests on your behalf at any time             │
     │       (refresh_token, offline_access)                       │
     │                                                              │
     │ Refresh Token Policy:                                        │
     │   ► Refresh token is valid until revoked                    │
     └─────────────────────────────────────────────────────────────┘

  5. Click "Save"
  6. Click "Continue"

Step 2: Get Client Credentials
───────────────────────────────
  7. On the Connected App detail page, click "Manage Consumer Details"
  8. Verify your identity (email code)
  9. Copy these values:

     ┌──────────────────────────────────────────────────────┐
     │ Consumer Key (Client ID):                            │
     │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
     │                                                      │
     │ Consumer Secret (Client Secret):                     │
     │ xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx     │
     └──────────────────────────────────────────────────────┘

Step 3: Configure in Dashboard
───────────────────────────────
  10. Add to wrangler.toml (or Cloudflare secrets):

      [vars]
      SALESFORCE_CLIENT_ID = "your_consumer_key"
      SALESFORCE_CLIENT_SECRET = "your_consumer_secret"
      SALESFORCE_CALLBACK_URL = "https://yourdomain.com/api/salesforce/oauth/callback"

Step 4: User Connection
───────────────────────
  11. Each workspace owner/admin:
      - Opens Dashboard → Integrations
      - Clicks "Connect" on Salesforce card
      - OAuth popup opens
      - Clicks "Allow"
      - Done! ✅

  ⚠️  IMPORTANT: No Apex code, no custom objects, pure OAuth!

```

### Minimal Salesforce Permissions Required

```
┌────────────────────────────────────────────────────────────────┐
│              SALESFORCE USER PERMISSIONS NEEDED                  │
└────────────────────────────────────────────────────────────────┘

For the OAuth user (the account that clicks "Allow"):

Required Object Permissions:
  ✓ Leads       → Read
  ✓ Contacts    → Read
  ✓ Tasks       → Create, Read
  ✓ Events      → Create, Read  (for appointment scheduling)

No Admin Rights Required:
  ✗ System Administrator (not needed)
  ✗ Modify All Data (not needed)
  ✗ Customize Application (not needed)

Typical User Profile:
  → "Standard User" is sufficient
  → OR "Salesforce Platform" license

```

---

## 🚀 Implementation Checklist

### Phase 1: Database & Configuration ✅
- [ ] Create migration file: `workers/migrations/00XX_add_salesforce_integration.sql`
- [ ] Add Salesforce columns to `workspace_settings`
- [ ] Create `salesforce_sync_logs` table
- [ ] Run migration: `wrangler d1 migrations apply DB`
- [ ] Add Salesforce credentials to `wrangler.toml` or Cloudflare secrets

### Phase 2: Backend Service 🔧
- [ ] Create `workers/salesforce-service.ts`
  - [ ] `buildAuthUrl()` - Generate OAuth URL
  - [ ] `exchangeCodeForToken()` - Exchange auth code for tokens
  - [ ] `refreshAccessToken()` - Auto-refresh expired tokens
  - [ ] `searchByPhone()` - SOSL phone search
  - [ ] `createCallLogTask()` - Create Task in Salesforce
  - [ ] `createAppointmentEvent()` - Create Event/Appointment in Salesforce
  - [ ] `parseAppointmentDateTime()` - Parse date/time strings
  - [ ] `revokeSalesforceAccess()` - Disconnect

### Phase 3: Backend API Routes 🛣️
- [ ] Add routes in `workers/index.ts`
  - [ ] `GET /api/salesforce/oauth/initiate`
  - [ ] `GET /api/salesforce/oauth/callback`
  - [ ] `GET /api/salesforce/status`
  - [ ] `DELETE /api/salesforce/disconnect`
  - [ ] `POST /api/salesforce/test-sync` (for testing)
- [ ] Integrate Salesforce sync into webhook handler
- [ ] Add error handling and retry logic

### Phase 4: Frontend API Client 💻
- [ ] Update `src/lib/d1.ts`
  - [ ] `initiateSalesforceOAuth()`
  - [ ] `getSalesforceStatus()`
  - [ ] `disconnectSalesforce()`
  - [ ] `testSalesforceSync()`

### Phase 5: Frontend UI 🎨
- [ ] Update `src/components/Integration.tsx`
  - [ ] Replace generic Salesforce modal with OAuth flow
  - [ ] Add "Connect with Salesforce" button
  - [ ] Add status indicator (connected/disconnected)
  - [ ] Add disconnect button
  - [ ] Add test sync button
  - [ ] Show last sync time
- [ ] Update `loadIntegrationStatus()` to check Salesforce connection

### Phase 6: Testing 🧪
- [ ] Test OAuth flow end-to-end
- [ ] Test phone number search (SOSL)
- [ ] Test Task creation
- [ ] Test Event/Appointment creation
- [ ] Test appointment date/time parsing
- [ ] Test call without appointment data (Task only)
- [ ] Test call with appointment data (Task + Event)
- [ ] Test token refresh logic
- [ ] Test disconnect functionality
- [ ] Test with various phone formats
- [ ] Test error scenarios (not found, API errors)

---

## 📞 Phone Number Handling

### Phone Format Normalization

```typescript
// Multiple formats users might have in Salesforce:
const phoneVariations = [
  "+1 (234) 567-8900",  // International with formatting
  "234-567-8900",       // US format
  "2345678900",         // Raw digits
  "+12345678900",       // E.164 format
  "(234) 567-8900"      // Formatted without country code
];

// SOSL searches ALL these automatically! 🎉
// Just pass the raw digits: FIND {2345678900}
```

### Search Strategy

```
┌────────────────────────────────────────────────────────────────┐
│                   PHONE NUMBER SEARCH LOGIC                      │
└────────────────────────────────────────────────────────────────┘

Input Phone: "+1 (234) 567-8900"

Step 1: Normalize
─────────────────
  Remove: +, (, ), -, spaces
  Result: "12345678900"

Step 2: SOSL Search
───────────────────
  FIND {12345678900} IN PHONE FIELDS
  RETURNING
    Lead(Id, Name, Phone, MobilePhone, Company, Status),
    Contact(Id, Name, Phone, MobilePhone, Email, AccountId)

Step 3: Priority
────────────────
  1. Check Leads first (recent inquiries)
  2. If no Lead, check Contacts
  3. Return first match

Step 4: Create Task
───────────────────
  POST /services/data/v60.0/sobjects/Task
  {
    "WhoId": "{recordId}",  // Lead or Contact ID
    "Subject": "Inbound Call",
    "Type": "Call",
    "TaskSubtype": "Call",
    "CallType": "Inbound",
    "Status": "Completed",
    "Description": "{call summary}",
    "CallDurationInSeconds": {duration},
    "ActivityDate": "{date}"
  }

  ✅ Task appears in Salesforce Activity Timeline!

```

---

## 🔒 Security Considerations

```
┌────────────────────────────────────────────────────────────────┐
│                      SECURITY CHECKLIST                          │
└────────────────────────────────────────────────────────────────┘

✅ OAuth Tokens Stored Server-Side Only
   → Never sent to frontend
   → Stored in D1 database (workspace_settings)

✅ Client Secret in Environment Variables
   → wrangler.toml or Cloudflare Secrets
   → Never committed to git

✅ HTTPS Required for Callback URL
   → Salesforce requires https:// for OAuth

✅ State Parameter for CSRF Protection
   → Generate random state token
   → Verify on callback

✅ Token Expiration Handling
   → Access tokens expire in ~2 hours
   → Auto-refresh using refresh_token
   → Retry failed requests after refresh

✅ Workspace Isolation
   → Each workspace has separate Salesforce connection
   → Tokens tied to workspace_id
   → No cross-workspace access

✅ Minimal Permissions
   → Only request 'api' and 'refresh_token' scopes
   → Read Leads/Contacts, Create Tasks
   → No delete or admin permissions

```

---

## 📊 Success Metrics

```
┌────────────────────────────────────────────────────────────────┐
│                     MVP SUCCESS CRITERIA                         │
└────────────────────────────────────────────────────────────────┘

User Experience:
  ✓ User can connect Salesforce in < 2 minutes
  ✓ No manual API key copying required
  ✓ No Apex development needed
  ✓ Clear "Connected" / "Disconnected" status

Functionality:
  ✓ 100% of calls with matching phone numbers create Tasks
  ✓ Tasks appear in Salesforce within 30 seconds of call end
  ✓ Correct Lead/Contact association
  ✓ Call details (duration, summary) saved in Task

Reliability:
  ✓ Token auto-refresh works without user intervention
  ✓ Graceful handling when phone number not found
  ✓ Retry logic for transient API errors
  ✓ Clear error messages in logs

```

---

## 🐛 Troubleshooting Guide

```
┌────────────────────────────────────────────────────────────────┐
│                   COMMON ISSUES & SOLUTIONS                      │
└────────────────────────────────────────────────────────────────┘

Issue: "OAuth callback fails"
Solution:
  → Verify callback URL matches exactly in Salesforce Connected App
  → Ensure HTTPS (not HTTP)
  → Check SALESFORCE_CLIENT_SECRET is correct

Issue: "Phone number not found"
Solution:
  → Phone numbers must exist in Lead.Phone/MobilePhone or Contact.Phone/MobilePhone
  → Check phone format in Salesforce matches incoming format
  → SOSL handles most formatting, but extreme formats may fail

Issue: "Task not created"
Solution:
  → Check Lead/Contact record ID is valid
  → Verify user has "Create" permission on Tasks
  → Check required fields on Task object (org-specific)

Issue: "Access token expired"
Solution:
  → Auto-refresh should handle this
  → Check refresh_token is stored in DB
  → Verify SALESFORCE_CLIENT_SECRET is correct for refresh

Issue: "User sees 'Approve Uninstalled Connected Apps' error"
Solution:
  → This is a Salesforce 2025 security update
  → Admin must grant "Approve Uninstalled Connected Apps" permission
  → OR install the Connected App org-wide

```

---

---

## 📅 BONUS FEATURE: Appointment Scheduling

### Overview

When your Voice AI detects that a customer has scheduled an appointment during the call, we'll automatically create a Salesforce **Event** (appointment) on the Lead/Contact record.

### Use Case Flow

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    APPOINTMENT SCHEDULING FLOW                               │
└────────────────────────────────────────────────────────────────────────────┘

  Voice AI Call               Backend Processing           Salesforce API
  ==============              ==================           ==============

      │                              │                           │
      │ Customer: "I'd like to       │                           │
      │ schedule an appointment      │                           │
      │ for next Monday at 2pm"      │                           │
      │                              │                           │
      │ AI: "Great! I've booked      │                           │
      │ you for January 15th         │                           │
      │ at 2:00 PM"                  │                           │
      │                              │                           │
      │ [Call Ends]                  │                           │
      ├─────────────────────────────►│                           │
      │                              │                           │
      │ Webhook Payload:             │                           │
      │ {                            │                           │
      │   phone: "+1234567890",      │                           │
      │   summary: "...",            │                           │
      │   structured_data: {         │                           │
      │     appointment_date:        │                           │
      │       "2025-01-15",          │                           │
      │     appointment_time:        │                           │
      │       "2:00 PM",             │                           │
      │     appointment_type:        │                           │
      │       "Consultation"         │                           │
      │   }                          │                           │
      │ }                            │                           │
      │                              │                           │
      │                              │ 1. Search by Phone       │
      │                              │    SOSL: FIND {phone}    │
      │                              ├─────────────────────────►│
      │                              │                          │
      │                              │    Lead ID: 00Q1234...   │
      │                              │◄─────────────────────────┤
      │                              │                          │
      │                              │ 2. Create Task (Call Log)│
      │                              │    POST /sobjects/Task   │
      │                              ├─────────────────────────►│
      │                              │                          │
      │                              │    Task Created ✓        │
      │                              │◄─────────────────────────┤
      │                              │                          │
      │                              │ 3. Check if appointment  │
      │                              │    data exists           │
      │                              │                          │
      │                              │ ✓ YES: appointment_date  │
      │                              │    & appointment_time    │
      │                              │    present               │
      │                              │                          │
      │                              │ 4. Create Event          │
      │                              │    POST /sobjects/Event  │
      │                              │    {                     │
      │                              │      WhoId: "00Q1234..", │
      │                              │      Subject: "...",     │
      │                              │      StartDateTime:      │
      │                              │        "2025-01-15T14:00"│
      │                              │      EndDateTime:        │
      │                              │        "2025-01-15T15:00"│
      │                              │      Description: "..."  │
      │                              │    }                     │
      │                              ├─────────────────────────►│
      │                              │                          │
      │                              │    Event Created ✓       │
      │                              │◄─────────────────────────┤
      │                              │                          │
      │                              │ 5. Log both Task & Event │
      │                              │    to sync logs          │
      │                              │                          │
      │           200 OK             │                          │
      │◄─────────────────────────────┤                          │
      │                              │                          │

  📱 Result in Salesforce:
  ─────────────────────────

  Lead: John Doe (+1234567890)
  └── Activity Timeline
      ├── ✓ Task: "Inbound Call - Scheduled Appointment"
      │   Status: Completed
      │   Date: Today
      │   Description: Call summary...
      │
      └── 📅 Event: "Consultation Appointment"
          Date: January 15, 2025
          Time: 2:00 PM - 3:00 PM
          Type: Appointment
          Status: Scheduled

```

### Event vs Task: Key Differences

```
┌────────────────────────────────────────────────────────────────┐
│                  SALESFORCE TASK VS EVENT                        │
└────────────────────────────────────────────────────────────────┘

Task (Call Log)                    Event (Appointment)
===============                    ===================

Purpose:      Record past activity  Purpose:      Schedule future activity
Status:       Completed             Status:       Scheduled/Confirmed
Time:         Call end time         Time:         Appointment start/end
Shows in:     Activity History      Shows in:     Calendar + Activity
Icon:         ☎️ Phone              Icon:         📅 Calendar
Duration:     CallDurationInSeconds Duration:     StartDateTime → EndDateTime
Type:         "Call"                Type:         "Meeting" or custom

When to Use:  ✓ Call happened       When to Use:  ✓ Future appointment
              ✓ Log interaction                   ✓ Customer scheduled time
              ✓ Record outcome                    ✓ Need calendar reminder

```

### Data Requirements

To create an Event/Appointment, we need from the Voice AI:

```javascript
{
  // Required for Event creation:
  "appointment_date": "2025-01-15",      // ISO date format (YYYY-MM-DD)
  "appointment_time": "2:00 PM",         // 12-hour format

  // Optional but recommended:
  "appointment_type": "Consultation",    // Type of appointment
  "appointment_notes": "Bring ID",       // Special instructions
  "appointment_duration": 60             // Duration in minutes (default: 60)
}
```

### API Request: Create Event

```http
POST https://na1.salesforce.com/services/data/v60.0/sobjects/Event
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "WhoId": "00Q1234567890ABC",           // Lead or Contact ID (from phone search)
  "Subject": "Consultation Appointment",   // From appointment_type or default
  "StartDateTime": "2025-01-15T14:00:00Z", // ISO 8601 format (UTC or local)
  "EndDateTime": "2025-01-15T15:00:00Z",   // StartDateTime + duration
  "Description": "Appointment scheduled during call. Customer requested consultation.\n\nCall Summary: [summary from voice AI]\n\nNotes: Bring ID",
  "IsAllDayEvent": false,                  // Always false for appointments
  "Type": "Meeting",                       // Or custom picklist value
  "ShowAs": "Busy",                        // Calendar visibility
  "ReminderDateTime": "2025-01-15T13:00:00Z", // 1 hour before (optional)
  "IsReminderSet": true                    // Enable reminder (optional)
}
```

### Response Example

```json
{
  "id": "00U1234567890DEF",
  "success": true,
  "errors": []
}
```

### Lead vs Contact: WhoId Field

```
┌────────────────────────────────────────────────────────────────┐
│                     WHOID IDENTIFICATION                         │
└────────────────────────────────────────────────────────────────┘

Salesforce ID Format:
  └── First 3 characters identify object type

  00Q → Lead
    Example: 00Q1234567890ABC
    Use Case: New prospect, not yet converted

  003 → Contact
    Example: 0031234567890XYZ
    Use Case: Converted Lead or existing customer

Both Can Have Events:
  ✓ Events can be created on Leads (WhoId = 00Q...)
  ✓ Events can be created on Contacts (WhoId = 003...)

Priority Logic:
  1. Search SOSL for phone number
  2. Check Leads first (00Q prefix)
  3. If no Lead, check Contacts (003 prefix)
  4. Use first match for WhoId in Event

```

### Implementation Changes

#### 1. Database Schema Update

Add appointment tracking to `salesforce_sync_logs`:

```sql
-- Add to existing migration file
ALTER TABLE salesforce_sync_logs ADD COLUMN salesforce_event_id TEXT;
ALTER TABLE salesforce_sync_logs ADD COLUMN appointment_created BOOLEAN DEFAULT 0;
```

#### 2. Backend Service Method

Add to `workers/salesforce-service.ts`:

```typescript
/**
 * Create Event (Appointment) in Salesforce
 */
async function createAppointmentEvent(
  instanceUrl: string,
  accessToken: string,
  leadOrContactId: string,
  appointmentData: {
    date: string;           // "2025-01-15"
    time: string;           // "2:00 PM"
    type?: string;          // "Consultation"
    notes?: string;         // "Bring ID"
    duration?: number;      // 60 (minutes)
  },
  callSummary: string
): Promise<string | null> {
  try {
    // Parse date and time
    const startDateTime = parseAppointmentDateTime(
      appointmentData.date,
      appointmentData.time
    );

    // Calculate end time (default 1 hour)
    const duration = appointmentData.duration || 60;
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    // Build Event payload
    const eventPayload = {
      WhoId: leadOrContactId,
      Subject: `${appointmentData.type || 'Appointment'} - Scheduled via Voice AI`,
      StartDateTime: startDateTime.toISOString(),
      EndDateTime: endDateTime.toISOString(),
      Description: `Appointment scheduled during call.\n\n${appointmentData.notes ? `Notes: ${appointmentData.notes}\n\n` : ''}Call Summary:\n${callSummary}`,
      IsAllDayEvent: false,
      Type: 'Meeting',
      ShowAs: 'Busy',
      IsReminderSet: true,
      ReminderDateTime: new Date(startDateTime.getTime() - 3600000).toISOString() // 1hr before
    };

    // POST to Salesforce
    const response = await fetch(
      `${instanceUrl}/services/data/v60.0/sobjects/Event`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Salesforce Event creation failed:', error);
      return null;
    }

    const result = await response.json();
    return result.id; // Event ID (00U...)

  } catch (error) {
    console.error('Error creating Salesforce Event:', error);
    return null;
  }
}

/**
 * Parse appointment date and time to ISO DateTime
 */
function parseAppointmentDateTime(date: string, time: string): Date {
  // date: "2025-01-15"
  // time: "2:00 PM" or "14:00"

  // Parse time (handle both 12hr and 24hr formats)
  const timeMatch = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!timeMatch) throw new Error('Invalid time format');

  let hours = parseInt(timeMatch[1]);
  const minutes = parseInt(timeMatch[2]);
  const meridiem = timeMatch[3]?.toUpperCase();

  // Convert to 24-hour format
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  // Combine date and time
  const dateTime = new Date(`${date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);

  return dateTime;
}
```

#### 3. Webhook Processing Logic

Update webhook handler to check for appointment data:

```typescript
// In workers/index.ts webhook handler

// After creating Task...
if (taskId) {
  // Check if appointment data exists
  const appointmentData = callData.structured_data?.appointment_date &&
                         callData.structured_data?.appointment_time;

  let eventId = null;

  if (appointmentData) {
    // Create Event in Salesforce
    eventId = await createAppointmentEvent(
      salesforceSettings.salesforce_instance_url,
      accessToken,
      salesforceRecordId,
      {
        date: callData.structured_data.appointment_date,
        time: callData.structured_data.appointment_time,
        type: callData.structured_data.appointment_type,
        notes: callData.structured_data.appointment_notes,
        duration: callData.structured_data.appointment_duration
      },
      callData.summary
    );
  }

  // Log both Task and Event
  await logSalesforceSync(
    workspaceId,
    callId,
    salesforceRecordId,
    taskId,
    eventId,
    'success'
  );
}
```

### Decision Logic: When to Create Event

```
┌────────────────────────────────────────────────────────────────┐
│              APPOINTMENT EVENT CREATION LOGIC                    │
└────────────────────────────────────────────────────────────────┘

Call Ends → Check structured_data
            │
            ├─ Has appointment_date? ──► NO ──► Create Task only
            │                                    (Call log)
            │
            └─ YES ──► Has appointment_time? ──► NO ──► Create Task only
                       │                                 (Invalid appointment)
                       │
                       └─ YES ──► Parse date/time ──► Valid? ──► NO ──► Log error
                                  │                                      Create Task only
                                  │
                                  └─ YES ──► Create Task (call log)
                                             + Create Event (appointment)
                                             ✅ Both created!

Validation Rules:
─────────────────
✓ appointment_date must be ISO format (YYYY-MM-DD)
✓ appointment_time must be parseable (12hr or 24hr)
✓ Date must be in the future (or today)
✓ Time must be valid (00:00 - 23:59)

Optional Fields:
────────────────
• appointment_type     → Becomes Event.Subject
• appointment_notes    → Added to Event.Description
• appointment_duration → Calculates EndDateTime (default: 60 min)

```

### OpenAI Integration

Your existing OpenAI intent analysis already extracts appointment data! From your current implementation:

```typescript
// In workers/index.ts - analyzeCallWithOpenAI()

// APPOINTMENT FIELDS (ONLY if intent is "Scheduling" and appointment was successfully booked):
// - appointment_date: The appointment date in ISO format (YYYY-MM-DD)
// - appointment_time: The appointment time in 12-hour format (e.g., "2:00 PM")
// - appointment_type: Type of appointment (e.g., "Consultation", "Service Call")
// - appointment_notes: Any special notes about the appointment

// This already returns:
{
  intent: "Scheduling",
  appointment_date: "2025-01-15",
  appointment_time: "2:00 PM",
  appointment_type: "Consultation",
  appointment_notes: "Bring ID"
}

// ✅ Perfect! Just use these fields to create the Event
```

### User Experience

```
┌────────────────────────────────────────────────────────────────┐
│              SALESFORCE USER SEES (AFTER CALL)                   │
└────────────────────────────────────────────────────────────────┘

Lead: Sarah Johnson
Phone: (555) 123-4567

┌─────────────────────────────────────────────────────────────┐
│  Activity Timeline                                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ✅ Today at 10:30 AM                                        │
│  ☎️  Task: Inbound Call - Scheduled Appointment             │
│      Status: Completed                                       │
│      Duration: 3 min 45 sec                                  │
│      Description: Customer called to schedule a              │
│      consultation. Interested in our premium service.        │
│      Appointment created for next week.                      │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  📅 Monday, Jan 15 at 2:00 PM                                │
│  📅  Event: Consultation Appointment - Scheduled via Voice AI│
│      Status: Scheduled                                       │
│      Duration: 1 hour (2:00 PM - 3:00 PM)                    │
│      Description: Appointment scheduled during call.         │
│      Notes: Bring ID                                         │
│                                                               │
│      🔔 Reminder: 1 hour before                              │
│                                                               │
│      [Add to Calendar] [Reschedule] [Cancel]                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘

✨ Benefit: Sales reps see both the call history AND the
   upcoming appointment in one place - no manual data entry!

```

### Testing Checklist

```
┌────────────────────────────────────────────────────────────────┐
│              APPOINTMENT FEATURE TESTING                         │
└────────────────────────────────────────────────────────────────┘

Test Case 1: Valid Appointment Data
────────────────────────────────────
Input:
  appointment_date: "2025-01-20"
  appointment_time: "10:00 AM"
  appointment_type: "Consultation"

Expected:
  ✓ Task created (call log)
  ✓ Event created (appointment)
  ✓ Event shows in Salesforce calendar
  ✓ Both linked to same Lead/Contact

Test Case 2: No Appointment Data
─────────────────────────────────
Input:
  No appointment fields in structured_data

Expected:
  ✓ Task created (call log)
  ✗ No Event created
  ✓ No errors logged

Test Case 3: Invalid Date Format
─────────────────────────────────
Input:
  appointment_date: "01/15/2025" (wrong format)
  appointment_time: "2:00 PM"

Expected:
  ✓ Task created (call log)
  ✗ Event creation fails gracefully
  ✓ Error logged with details

Test Case 4: Multiple Time Formats
───────────────────────────────────
Input Variations:
  • "2:00 PM"    ✓ Should work
  • "14:00"      ✓ Should work
  • "2pm"        ✓ Should work
  • "2:00"       ✓ Should work (assume PM if business hours)

Expected:
  ✓ All formats parsed correctly
  ✓ Events created at correct times

Test Case 5: Past Date
──────────────────────
Input:
  appointment_date: "2020-01-01" (past date)

Expected:
  ✓ Task created
  ⚠️  Event created but flagged as unusual
  OR
  ✗ Event rejected with validation error

```

### Updated Permissions

Add to Salesforce permissions section:

```
Required Object Permissions (UPDATED):
  ✓ Leads       → Read
  ✓ Contacts    → Read
  ✓ Tasks       → Create, Read
  ✓ Events      → Create, Read  ← NEW!

```

---

## 📚 References

- [Salesforce OAuth 2.0 Web Server Flow](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_oauth_and_connected_apps.htm)
- [Salesforce REST API - Search (SOSL)](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_search.htm)
- [Salesforce Task Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_task.htm)
- [Salesforce Event Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_event.htm)
- [EventRelation Object (Multi-Person Events)](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_eventattendee.htm)
- [OAuth 2.0 Refresh Token Flow](https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_refresh_token_flow.htm)

---

## ✅ Next Steps

1. **Review this plan** with the team
2. **Set up Salesforce Connected App** (one-time, 10 minutes)
3. **Start Phase 1**: Database migration
4. **Build incrementally**: Service → API → UI
5. **Test with real Salesforce org**

**Estimated Total Time**: 12-16 hours for full MVP implementation

---

*Last Updated: 2025-01-05*
*Version: 1.0 - MVP Scope*
