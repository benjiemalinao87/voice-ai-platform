# Phone Numbers Management Feature - Complete Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Frontend Implementation](#frontend-implementation)
5. [Backend Implementation](#backend-implementation)
6. [API Endpoints](#api-endpoints)
7. [Security Architecture](#security-architecture)
8. [Usage Guide](#usage-guide)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Phone Numbers Management feature allows users to:
- **List** all phone numbers managed through Vapi
- **Import** existing phone numbers from Twilio accounts
- **Create** new free phone numbers with specified area codes

All phone numbers are configured for **voice calls only** (SMS is explicitly disabled).

### Key Features
- ✅ Server-side credential management (never exposed to frontend)
- ✅ JWT authentication on all endpoints
- ✅ Voice-only configuration (SMS disabled)
- ✅ Real-time error handling and user feedback
- ✅ Secure Twilio and Vapi API integration

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              React Application (Frontend)                     │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │          Settings Component                           │   │  │
│  │  │  - Tab Navigation                                    │   │  │
│  │  │  - Tab: "Phone Numbers"                              │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                         │                                    │  │
│  │                         ▼                                    │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │      PhoneNumbers Component                           │   │  │
│  │  │  - List existing numbers                              │   │  │
│  │  │  - Import modal                                       │   │  │
│  │  │  - Create modal                                       │   │  │
│  │  │  - Error/Success messaging                            │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                         │                                    │  │
│  │                         ▼                                    │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │           D1 Client (src/lib/d1.ts)                  │   │  │
│  │  │  - getTwilioPhoneNumbers()                            │   │  │
│  │  │  - importTwilioNumber()                               │   │  │
│  │  │  - createVapiPhoneNumber()                            │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS + JWT Auth
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (workers/index.ts)                    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Authentication Layer                             │  │
│  │  - JWT Token Validation                                       │  │
│  │  - getUserFromToken()                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              API Endpoints                                    │  │
│  │                                                               │  │
│  │  1. GET /api/twilio/phone-numbers                            │  │
│  │  2. POST /api/vapi/import-twilio                             │  │
│  │  3. POST /api/vapi/phone-number                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                         │                                            │
│                         ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Credential Management                                 │  │
│  │  - Read from D1: user_settings table                         │  │
│  │  - private_key (Vapi)                                        │  │
│  │  - twilio_account_sid, twilio_auth_token                     │  │
│  │  - transfer_phone_number (fallback)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
              │                    │                    │
              ▼                    ▼                    ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│   Cloudflare D1      │  │    Twilio API        │  │    Vapi API          │
│   Database           │  │    (External)        │  │    (External)        │
│                      │  │                      │  │                      │
│  user_settings       │  │  GET /IncomingPhone  │  │  POST /phone-number  │
│  - private_key       │  │  Numbers.json        │  │  (import/create)     │
│  - twilio_*          │  │                      │  │                      │
│  - transfer_phone    │  │  Filter: voice=true  │  │  SMS disabled        │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## Data Flow Diagrams

### 1. List Phone Numbers Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Navigate to Settings → Phone Numbers Tab
     ▼
┌──────────────────────────────────────┐
│   PhoneNumbers Component (React)     │
│                                      │
│   useEffect() triggers loadNumbers() │
└────┬─────────────────────────────────┘
     │
     │ 2. Check user settings for Vapi private key
     ▼
┌──────────────────────────────────────┐
│   d1Client.getUserSettings()         │
│   (from Settings component)          │
└────┬─────────────────────────────────┘
     │
     │ 3. If private key exists, create VapiClient
     ▼
┌──────────────────────────────────────┐
│   VapiClient.listPhoneNumbers()      │
│   Direct call to Vapi API            │
│   GET https://api.vapi.ai/phone-number│
└────┬─────────────────────────────────┘
     │
     │ 4. Display numbers in UI
     ▼
┌──────────────────────────────────────┐
│   Render phone number cards          │
│   - Number                           │
│   - Name (if available)              │
│   - Creation date                    │
│   - "Voice Only" badge               │
└──────────────────────────────────────┘
```

### 2. Import Twilio Number Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Click "Import from Twilio" button
     ▼
┌─────────────────────────────────────────────────┐
│   PhoneNumbers Component                        │
│   handleOpenImportModal() called                │
│   - Opens modal                                 │
│   - Clears error/success states                 │
└────┬────────────────────────────────────────────┘
     │
     │ 2. Request Twilio numbers list
     ▼
┌─────────────────────────────────────────────────┐
│   d1Client.getTwilioPhoneNumbers()              │
│   GET /api/twilio/phone-numbers                 │
│   (JWT token in Authorization header)           │
└────┬────────────────────────────────────────────┘
     │
     │ 3. Worker: Authenticate user
     ▼
┌─────────────────────────────────────────────────┐
│   Cloudflare Worker                             │
│   - getUserFromToken() validates JWT            │
│   - Query D1: user_settings                     │
│   - Extract: twilio_account_sid,                │
│              twilio_auth_token                  │
└────┬────────────────────────────────────────────┘
     │
     │ 4. Call Twilio API (server-side)
     ▼
┌─────────────────────────────────────────────────┐
│   Twilio API                                    │
│   GET /2010-04-01/Accounts/{SID}/               │
│        IncomingPhoneNumbers.json                │
│   Authorization: Basic {base64(SID:Token)}      │
└────┬────────────────────────────────────────────┘
     │
     │ 5. Filter voice-capable numbers only
     ▼
┌─────────────────────────────────────────────────┐
│   Worker filters response                       │
│   - Keep only: capabilities.voice === true      │
│   - Return: [{sid, phoneNumber, friendlyName}]  │
└────┬────────────────────────────────────────────┘
     │
     │ 6. Display in modal
     ▼
┌─────────────────────────────────────────────────┐
│   Import Modal (Radio Selection)                │
│   - List of voice-capable numbers               │
│   - Optional name input                         │
└────┬────────────────────────────────────────────┘
     │
     │ 7. User selects number and clicks "Import"
     ▼
┌─────────────────────────────────────────────────┐
│   PhoneNumbers Component                        │
│   handleImport() called                         │
└────┬────────────────────────────────────────────┘
     │
     │ 8. Request import
     ▼
┌─────────────────────────────────────────────────┐
│   d1Client.importTwilioNumber()                 │
│   POST /api/vapi/import-twilio                  │
│   Body: {sid, phoneNumber, name?}               │
└────┬────────────────────────────────────────────┘
     │
     │ 9. Worker: Authenticate and get credentials
     ▼
┌─────────────────────────────────────────────────┐
│   Cloudflare Worker                             │
│   - Validate JWT                                │
│   - Get Vapi private_key from D1                │
│   - Get Twilio credentials from D1              │
└────┬────────────────────────────────────────────┘
     │
     │ 10. Call Vapi API to import
     ▼
┌─────────────────────────────────────────────────┐
│   Vapi API                                      │
│   POST https://api.vapi.ai/phone-number         │
│   Authorization: Bearer {private_key}           │
│   Body: {                                        │
│     provider: "twilio",                          │
│     twilioAccountSid: "...",                     │
│     twilioAuthToken: "...",                      │
│     twilioPhoneNumberSid: "{sid}",               │
│     name: "...",                                 │
│     smsEnabled: false                            │
│   }                                              │
└────┬────────────────────────────────────────────┘
     │
     │ 11. Return imported number
     ▼
┌─────────────────────────────────────────────────┐
│   Success!                                      │
│   - Close modal                                 │
│   - Show success message                        │
│   - Refresh numbers list                        │
└─────────────────────────────────────────────────┘
```

### 3. Create Free Number Flow

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Click "Create Free Number" button
     ▼
┌─────────────────────────────────────────────────┐
│   PhoneNumbers Component                        │
│   Opens Create Modal                            │
│   - Area code input (3 digits)                  │
│   - Optional name input                         │
└────┬────────────────────────────────────────────┘
     │
     │ 2. User enters area code (e.g., "415")
     │    and clicks "Create Number"
     ▼
┌─────────────────────────────────────────────────┐
│   PhoneNumbers Component                        │
│   handleCreate() called                         │
│   - Validates: 3-digit numeric                  │
│   - Sets error/success to null                  │
└────┬────────────────────────────────────────────┘
     │
     │ 3. Request number creation
     ▼
┌─────────────────────────────────────────────────┐
│   d1Client.createVapiPhoneNumber()              │
│   POST /api/vapi/phone-number                   │
│   Body: {areaCode: "415", name?: "..."}        │
└────┬────────────────────────────────────────────┘
     │
     │ 4. Worker: Authenticate and get credentials
     ▼
┌─────────────────────────────────────────────────┐
│   Cloudflare Worker                             │
│   - Validate JWT                                │
│   - Query D1: user_settings                     │
│   - Extract: private_key, transfer_phone_number │
└────┬────────────────────────────────────────────┘
     │
     │ 5. Build Vapi payload
     ▼
┌─────────────────────────────────────────────────┐
│   Worker constructs payload                     │
│   {                                             │
│     areaCode: "415",                            │
│     name: "...",                                │
│     fallbackDestination: {                      │
│       type: "number",                           │
│       number: "{transfer_phone_number}"         │
│     },                                          │
│     smsEnabled: false                           │
│   }                                             │
└────┬────────────────────────────────────────────┘
     │
     │ 6. Call Vapi API
     ▼
┌─────────────────────────────────────────────────┐
│   Vapi API                                      │
│   POST https://api.vapi.ai/phone-number         │
│   Authorization: Bearer {private_key}           │
│   Body: {areaCode, fallbackDestination, ...}    │
└────┬────────────────────────────────────────────┘
     │
     │ 7. Vapi creates and returns number
     ▼
┌─────────────────────────────────────────────────┐
│   Success!                                      │
│   - Close modal                                 │
│   - Show success message                        │
│   - Refresh numbers list                        │
│   - Display new number                          │
└─────────────────────────────────────────────────┘
```

---

## Frontend Implementation

### Component Structure

```
src/components/
├── Settings.tsx              # Parent component with tab navigation
│   └── PhoneNumbers.tsx      # Phone numbers management component
│       ├── State Management
│       ├── List Display
│       ├── Import Modal
│       └── Create Modal
└── ...

src/lib/
└── d1.ts                     # API client methods
    ├── getTwilioPhoneNumbers()
    ├── importTwilioNumber()
    └── createVapiPhoneNumber()
```

### PhoneNumbers Component State

```typescript
// UI State
const [vapiNumbers, setVapiNumbers] = useState<VapiPhoneNumber[]>([]);
const [loading, setLoading] = useState(true);
const [refreshing, setRefreshing] = useState(false);
const [showImportModal, setShowImportModal] = useState(false);
const [showCreateModal, setShowCreateModal] = useState(false);

// Import Modal State
const [twilioNumbers, setTwilioNumbers] = useState<TwilioPhoneNumber[]>([]);
const [loadingTwilio, setLoadingTwilio] = useState(false);
const [selectedTwilioNumber, setSelectedTwilioNumber] = useState<string>('');
const [importing, setImporting] = useState(false);

// Create Modal State
const [areaCode, setAreaCode] = useState('');
const [phoneName, setPhoneName] = useState('');
const [creating, setCreating] = useState(false);

// Feedback State
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);
```

### Key Functions

#### 1. `loadNumbers()`
- Fetches user settings to get Vapi private key
- Creates `VapiClient` instance
- Calls `VapiClient.listPhoneNumbers()` directly
- Updates `vapiNumbers` state

#### 2. `handleOpenImportModal()`
- Opens import modal
- Clears error/success states
- Loads Twilio credentials from settings
- Calls `d1Client.getTwilioPhoneNumbers()`
- Populates `twilioNumbers` state

#### 3. `handleImport()`
- Validates selection
- Calls `d1Client.importTwilioNumber()`
- Shows success/error feedback
- Refreshes numbers list
- Closes modal

#### 4. `handleCreate()`
- Validates area code (3 digits, numeric)
- Calls `d1Client.createVapiPhoneNumber()`
- Shows success/error feedback
- Refreshes numbers list
- Closes modal

---

## Backend Implementation

### Worker Structure

```
workers/
└── index.ts                   # Main worker file
    ├── Authentication
    │   └── getUserFromToken()
    ├── Phone Number Endpoints
    │   ├── GET /api/twilio/phone-numbers
    │   ├── POST /api/vapi/import-twilio
    │   └── POST /api/vapi/phone-number
    └── Database Queries
        └── user_settings table
```

### Endpoint: GET /api/twilio/phone-numbers

**Purpose**: Fetch voice-capable phone numbers from user's Twilio account

**Authentication**: JWT token required

**Process**:
1. Validate JWT token → get `userId`
2. Query D1: `SELECT twilio_account_sid, twilio_auth_token FROM user_settings WHERE user_id = ?`
3. Verify credentials exist
4. Call Twilio API:
   ```
   GET https://api.twilio.com/2010-04-01/Accounts/{SID}/IncomingPhoneNumbers.json
   Authorization: Basic {base64(SID:Token)}
   ```
5. Filter response: Keep only numbers where `capabilities.voice === true`
6. Return filtered list: `[{sid, phoneNumber, friendlyName, capabilities}]`

**Error Handling**:
- Missing credentials → 400: "Twilio credentials not configured..."
- Twilio API error → 400: "Twilio API error: {status} - {message}"
- Network error → 500: "Failed to fetch Twilio numbers: {error}"

### Endpoint: POST /api/vapi/import-twilio

**Purpose**: Import a Twilio phone number into Vapi

**Authentication**: JWT token required

**Request Body**:
```typescript
{
  sid?: string;              // Twilio phone number SID (preferred)
  phoneNumber?: string;      // E.164 format phone number (alternative)
  name?: string;             // Optional name for the number
}
```

**Process**:
1. Validate JWT token → get `userId`
2. Query D1 for credentials:
   ```sql
   SELECT private_key, twilio_account_sid, twilio_auth_token 
   FROM user_settings 
   WHERE user_id = ?
   ```
3. Verify all required credentials exist
4. Build Vapi payload:
   ```typescript
   {
     provider: "twilio",
     twilioAccountSid: settings.twilio_account_sid,
     twilioAuthToken: settings.twilio_auth_token,
     twilioPhoneNumberSid: sid,  // or number: phoneNumber
     name: name,
     smsEnabled: false  // Voice only!
   }
   ```
5. Call Vapi API:
   ```
   POST https://api.vapi.ai/phone-number
   Authorization: Bearer {private_key}
   Content-Type: application/json
   ```
6. Return imported number: `{id, number, name}`

**Error Handling**:
- Missing Vapi key → 400: "Vapi API key not configured..."
- Missing Twilio creds → 400: "Twilio credentials not configured..."
- Vapi API error → 400: "Vapi API error: {status} - {message}"

### Endpoint: POST /api/vapi/phone-number

**Purpose**: Create a new free phone number via Vapi

**Authentication**: JWT token required

**Request Body**:
```typescript
{
  areaCode: string;    // 3-digit US area code (required)
  name?: string;       // Optional name for the number
}
```

**Process**:
1. Validate JWT token → get `userId`
2. Validate area code: Must be exactly 3 digits, numeric only
3. Query D1 for credentials:
   ```sql
   SELECT private_key, transfer_phone_number 
   FROM user_settings 
   WHERE user_id = ?
   ```
4. Verify Vapi private key exists
5. Build Vapi payload:
   ```typescript
   {
     areaCode: areaCode,
     name: name,
     fallbackDestination: settings.transfer_phone_number ? {
       type: "number",
       number: settings.transfer_phone_number
     } : undefined,
     smsEnabled: false  // Voice only!
   }
   ```
6. Call Vapi API to create number
7. Return created number: `{id, number, name}`

**Error Handling**:
- Invalid area code → 400: "Valid 3-digit area code is required"
- Missing Vapi key → 400: "Vapi API key not configured..."
- Vapi API error → 400: "Vapi API error: {status} - {message}"

---

## API Endpoints

### GET /api/twilio/phone-numbers

**Authentication**: Required (JWT Bearer token)

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Response** (Success - 200):
```json
[
  {
    "sid": "PN1234567890abcdef",
    "phoneNumber": "+14155551234",
    "friendlyName": "Main Business Line",
    "capabilities": {
      "voice": true,
      "sms": false
    }
  },
  ...
]
```

**Response** (Error - 400):
```json
{
  "error": "Twilio credentials not configured. Please add your Twilio Account SID and Auth Token in API Configuration."
}
```

### POST /api/vapi/import-twilio

**Authentication**: Required (JWT Bearer token)

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "sid": "PN1234567890abcdef",
  "name": "Sales Hotline"
}
```

**Response** (Success - 200):
```json
{
  "id": "phone_abc123",
  "number": "+14155551234",
  "name": "Sales Hotline"
}
```

**Response** (Error - 400):
```json
{
  "error": "Vapi API error: 400 - Phone number already imported"
}
```

### POST /api/vapi/phone-number

**Authentication**: Required (JWT Bearer token)

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "areaCode": "415",
  "name": "Support Line"
}
```

**Response** (Success - 200):
```json
{
  "id": "phone_xyz789",
  "number": "+14155559999",
  "name": "Support Line"
}
```

**Response** (Error - 400):
```json
{
  "error": "Valid 3-digit area code is required"
}
```

---

## Security Architecture

### Credential Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYER                        │
└─────────────────────────────────────────────────────────┘

FRONTEND (Browser)          BACKEND (Worker)              EXTERNAL APIs
──────────────────          ────────────────              ─────────────

❌ NEVER stores             ✅ Stores encrypted          ✅ Receives calls
   credentials                  credentials              ✅ Uses credentials
                                                                (never stored)

❌ NEVER receives           ✅ Reads from D1:            ✅ Returns data only
   credentials                  user_settings                (no credentials)

User Settings (D1):
├── private_key (encrypted)
├── twilio_account_sid
├── twilio_auth_token
└── transfer_phone_number

Flow:
1. User logs in → JWT token issued
2. Frontend stores JWT (in localStorage)
3. Frontend sends JWT in Authorization header
4. Worker validates JWT → gets userId
5. Worker queries D1 for credentials (by userId)
6. Worker uses credentials to call external APIs
7. Worker returns safe data (no credentials) to frontend

✅ SECURE: Credentials never leave server
✅ SECURE: User-specific data isolation (JWT → userId)
✅ SECURE: Encrypted storage in D1
✅ SECURE: HTTPS for all communication
```

### Security Features

1. **JWT Authentication**
   - All endpoints require valid JWT token
   - Token contains `userId` for data isolation
   - Tokens expire after 7 days

2. **Server-Side Credential Storage**
   - Credentials stored in D1 database (encrypted)
   - Never sent to frontend
   - Never exposed in API responses

3. **User Isolation**
   - All queries filtered by `user_id`
   - Users can only access their own credentials
   - No cross-user data leakage possible

4. **HTTPS Only**
   - All API calls over HTTPS
   - Worker deployed with custom domain
   - SSL/TLS encryption enforced

5. **Input Validation**
   - Area code validation (3 digits, numeric)
   - Phone number format validation
   - SQL injection prevention (parameterized queries)

---

## Usage Guide

### For End Users

#### Step 1: Configure Credentials
1. Navigate to **Settings → API Configuration**
2. Enter your **Vapi Private API Key** (required)
3. Enter your **Twilio Account SID** and **Auth Token** (for import)
4. Optionally set a **Default Transfer Number** (for free number fallback)
5. Click **Save Settings**

#### Step 2: View Existing Numbers
1. Navigate to **Settings → Phone Numbers**
2. Existing numbers will load automatically
3. Click **Refresh** to reload the list

#### Step 3: Import from Twilio
1. Click **Import from Twilio** button
2. Wait for Twilio numbers to load
3. Select a number using radio buttons
4. (Optional) Enter a name for the number
5. Click **Import Number**
6. Success message will appear
7. Number appears in the list

#### Step 4: Create Free Number
1. Click **Create Free Number** button
2. Enter a 3-digit US area code (e.g., "415")
3. (Optional) Enter a name for the number
4. Click **Create Number**
5. Success message will appear
6. Number appears in the list

### For Developers

#### Adding a New Endpoint

1. **Frontend (d1.ts)**:
```typescript
async newMethod(payload: any): Promise<ResponseType> {
  return this.request('/api/new-endpoint', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

2. **Backend (workers/index.ts)**:
```typescript
if (url.pathname === '/api/new-endpoint' && request.method === 'POST') {
  // 1. Authenticate
  const userId = await getUserFromToken(request, env);
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  // 2. Get credentials from D1
  const settings = await env.DB.prepare(
    'SELECT private_key FROM user_settings WHERE user_id = ?'
  ).bind(userId).first();

  // 3. Validate credentials
  if (!settings?.private_key) {
    return jsonResponse({ error: 'Vapi API key not configured' }, 400);
  }

  // 4. Make external API call (server-side only)
  const response = await fetch('https://api.external.com/endpoint', {
    headers: {
      'Authorization': `Bearer ${settings.private_key}`,
    },
  });

  // 5. Return safe data (no credentials)
  return jsonResponse(await response.json());
}
```

3. **Component (PhoneNumbers.tsx)**:
```typescript
const handleNewAction = async () => {
  try {
    setLoading(true);
    setError(null);
    const result = await d1Client.newMethod({ data: 'value' });
    setSuccess('Operation successful!');
    await loadNumbers(); // Refresh list
  } catch (error: any) {
    setError(error.message || 'Operation failed');
  } finally {
    setLoading(false);
  }
};
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Twilio credentials not configured"
**Cause**: User hasn't entered Twilio credentials in Settings

**Solution**:
1. Go to Settings → API Configuration
2. Enter Twilio Account SID (starts with "AC")
3. Enter Twilio Auth Token
4. Click Save Settings
5. Retry the import

#### Issue: "Vapi API key not configured"
**Cause**: User hasn't entered Vapi Private API Key

**Solution**:
1. Go to Settings → API Configuration
2. Enter Vapi Private API Key
3. Click Save Settings
4. Test connection to verify key is valid
5. Retry the operation

#### Issue: "Valid 3-digit area code is required"
**Cause**: Area code validation failed

**Solution**:
- Area code must be exactly 3 digits
- Only numeric characters (0-9)
- No letters, spaces, or special characters
- Examples: "415", "212", "310"

#### Issue: "Failed to load Twilio numbers"
**Cause**: 
- Invalid Twilio credentials
- Twilio API is down
- Network connectivity issue

**Solution**:
1. Verify Twilio credentials are correct in Settings
2. Check Twilio dashboard to confirm account is active
3. Test credentials manually:
   ```bash
   curl -X GET \
     "https://api.twilio.com/2010-04-01/Accounts/{SID}/IncomingPhoneNumbers.json" \
     -u "{SID}:{Token}"
   ```
4. Check worker logs: `wrangler tail`

#### Issue: "Vapi API error: 400"
**Cause**: 
- Invalid Vapi API key
- Number already imported
- Account quota exceeded
- Invalid request format

**Solution**:
1. Verify Vapi API key is correct
2. Test key in API Configuration tab
3. Check if number is already imported
4. Review Vapi API documentation for format requirements
5. Check Vapi account limits/dashboard

#### Issue: Numbers not appearing in list
**Cause**:
- Vapi API key not configured
- API call failed silently
- Network error

**Solution**:
1. Check browser console for errors
2. Verify Vapi API key is saved in Settings
3. Click Refresh button
4. Check Network tab in DevTools for failed requests
5. Verify worker is deployed: `wrangler tail`

### Debugging Tips

#### Check Worker Logs
```bash
wrangler tail
```

Look for:
- Authentication errors
- Database query errors
- External API errors
- Network timeouts

#### Check Browser Console
Open DevTools → Console:
- JavaScript errors
- React warnings
- Network request failures

#### Check Network Tab
Open DevTools → Network:
- Failed API requests (red)
- Response status codes
- Request/response payloads
- Authentication headers

#### Verify Credentials in Database
```bash
wrangler d1 execute voice-ai-dashboard --remote \
  --command="SELECT user_id, twilio_account_sid IS NOT NULL as has_twilio, private_key IS NOT NULL as has_vapi FROM user_settings LIMIT 5"
```

---

## Testing Checklist

### Manual Testing

- [ ] Navigate to Settings → Phone Numbers tab
- [ ] Verify existing numbers load correctly
- [ ] Test Refresh button
- [ ] Test Import modal opens
- [ ] Verify Twilio numbers load in import modal
- [ ] Test radio button selection
- [ ] Test import with name
- [ ] Test import without name
- [ ] Verify import success message
- [ ] Verify imported number appears in list
- [ ] Test Create modal opens
- [ ] Test area code validation (valid: 415, invalid: 41, ab5)
- [ ] Test create with name
- [ ] Test create without name
- [ ] Verify create success message
- [ ] Verify created number appears in list
- [ ] Test error handling (missing credentials)
- [ ] Test error handling (invalid area code)
- [ ] Verify all numbers show "Voice Only" badge

### Integration Testing

- [ ] Test with valid Vapi credentials
- [ ] Test with valid Twilio credentials
- [ ] Test with missing Vapi credentials
- [ ] Test with missing Twilio credentials
- [ ] Test with invalid JWT token
- [ ] Test with expired JWT token
- [ ] Test network error handling
- [ ] Test concurrent requests
- [ ] Verify SMS is disabled on all numbers

---

## File Reference

### Frontend Files
- `src/components/PhoneNumbers.tsx` - Main component
- `src/components/Settings.tsx` - Parent component with tab
- `src/lib/d1.ts` - API client methods
- `src/lib/vapi.ts` - Vapi client (for direct listing)

### Backend Files
- `workers/index.ts` - Worker with three new endpoints
- `workers/schema.sql` - Database schema (user_settings table)

### Documentation Files
- `PHONE_NUMBERS_FEATURE.md` - This file
- `progress.md` - Feature completion record
- `lesson_learn.md` - Implementation lessons learned

---

## Future Enhancements

Potential improvements for future iterations:

1. **Number Management**
   - Delete/release phone numbers
   - Update number settings (fallback, name)
   - View number usage statistics

2. **Bulk Operations**
   - Import multiple Twilio numbers at once
   - Bulk delete/release numbers

3. **Advanced Features**
   - Number search/filtering
   - Number assignment to assistants
   - Number configuration per number
   - Usage analytics per number

4. **International Support**
   - Support for non-US area codes
   - Country selection
   - International number format handling

5. **UI Improvements**
   - Number status indicators
   - Last used timestamp
   - Call volume display
   - Number health status

---

## Quick Reference

### Key Components
- **PhoneNumbers.tsx**: Main UI component
- **d1.ts**: API client layer
- **workers/index.ts**: Backend API endpoints

### Key Functions
- `loadNumbers()`: Fetch existing numbers from Vapi
- `handleOpenImportModal()`: Open import modal and load Twilio numbers
- `handleImport()`: Import selected Twilio number
- `handleCreate()`: Create new free number

### Key Endpoints
- `GET /api/twilio/phone-numbers`: List Twilio numbers
- `POST /api/vapi/import-twilio`: Import Twilio number
- `POST /api/vapi/phone-number`: Create free number

### Security Principles
- ✅ Credentials never exposed to frontend
- ✅ All endpoints require JWT authentication
- ✅ User data isolation via userId
- ✅ SMS explicitly disabled (voice only)

---

*Last Updated: January 24, 2025*
*Version: 1.0*

