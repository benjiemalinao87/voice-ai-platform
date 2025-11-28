# VAPI Webhook Data Ingestion Feature

**Version:** 1.0.0
**Last Updated:** 2025-01-24
**Status:** Implementation Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Feature Requirements](#feature-requirements)
3. [Architecture](#architecture)
4. [Data Flow Diagram](#data-flow-diagram)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [VAPI Payload Structure](#vapi-payload-structure)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Security Considerations](#security-considerations)
10. [Testing Plan](#testing-plan)
11. [Deployment Instructions](#deployment-instructions)

---

## Overview

### Purpose
Enable real-time call data ingestion from VAPI (Voice AI Platform) into our dashboard by providing webhook endpoints that receive end-of-call events. This allows automatic synchronization of call recordings, transcripts, and analysis data without manual polling.

### Business Value
- **Real-time Analytics**: Instant call data availability for dashboards
- **Automated Workflows**: Trigger actions based on call outcomes
- **Data Completeness**: Capture 100% of calls without API rate limits
- **Cost Efficiency**: Reduce API polling costs
- **Customer Insights**: Immediate access to customer sentiment and intent

### Tech Stack
- **Backend**: Cloudflare Workers (serverless)
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: React + TypeScript
- **Integration**: VAPI Webhook API

---

## Feature Requirements

### Functional Requirements

#### Admin Journey
1. **Login** → User authenticates via existing auth system
2. **Navigate** → Settings → Webhooks tab
3. **Generate** → Click "Generate Webhook" button
4. **Receive** → System creates unique webhook URL: `https://worker.dev/webhook/{id}`
5. **Copy** → One-click copy webhook URL to clipboard
6. **Configure** → Admin pastes webhook URL into VAPI Assistant settings
7. **Monitor** → View incoming webhook calls and logs in real-time

### Data Fields Captured

From VAPI end-of-call payload, we extract:

| Field | Source Path | Type | Description |
|-------|------------|------|-------------|
| Phone Number | `message.phoneNumber.number` | String | Customer's phone number |
| Recording URL | `message.artifact.recordingUrl` | String | Audio recording URL |
| Ended Reason | `message.endedReason` | String | How call ended (hangup, error, etc.) |
| Summary | `message.summary` | String | AI-generated call summary |
| Customer Number | `message.customer.number` | String | Alternative customer number field |
| Structured Data | `message.analysis.structuredData` | JSON | Parsed call analytics |

### Non-Functional Requirements
- **Performance**: Process webhook < 500ms
- **Reliability**: 99.9% webhook delivery success
- **Scalability**: Handle 1000+ webhooks/min
- **Security**: Webhook ID as authentication token
- **Availability**: 99.99% uptime (Cloudflare SLA)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    WEBHOOK SYSTEM ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   React Frontend │  (Dashboard UI)
│   - WebhookConfig│
│   - Settings     │
└────────┬─────────┘
         │
         │ HTTPS
         ↓
┌──────────────────────────┐
│  Cloudflare Worker API   │  (Backend)
│  ┌──────────────────────┐│
│  │ Webhook Management   ││
│  │ - Create webhook     ││
│  │ - List webhooks      ││
│  │ - Delete webhook     ││
│  └──────────────────────┘│
│  ┌──────────────────────┐│
│  │ Webhook Receiver     ││
│  │ - Validate payload   ││
│  │ - Parse VAPI data    ││
│  │ - Store in D1        ││
│  └──────────────────────┘│
└────────┬─────────────────┘
         │
         │ D1 API
         ↓
┌──────────────────────────┐
│  Cloudflare D1 Database  │
│  ┌──────────────────────┐│
│  │ webhooks             ││
│  │ webhook_calls        ││
│  │ webhook_logs         ││
│  └──────────────────────┘│
└──────────────────────────┘
         ↑
         │ HTTP POST
         │
┌──────────────────┐
│  VAPI Platform   │  (External Service)
│  - Makes calls   │
│  - Sends webhooks│
└──────────────────┘
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DETAILED WEBHOOK DATA FLOW                    │
└─────────────────────────────────────────────────────────────────┘

STEP 1: WEBHOOK GENERATION
═══════════════════════════

┌────────────┐
│   Admin    │
└─────┬──────┘
      │ 1. Click "Generate Webhook"
      ↓
┌──────────────────────┐
│  Dashboard Frontend  │
│  (WebhookConfig.tsx) │
└──────┬───────────────┘
      │ 2. POST /api/webhooks
      │    Headers: Authorization: Bearer {jwt}
      │    Body: { name: "My Webhook" }
      ↓
┌──────────────────────────────────────┐
│  Cloudflare Worker                   │
│  ┌────────────────────────────────┐  │
│  │ Endpoint: POST /api/webhooks   │  │
│  │ - Verify JWT token             │  │
│  │ - Extract user_id              │  │
│  │ - Generate webhook_id (UUID)   │  │
│  │ - Create webhook_url           │  │
│  │ - INSERT INTO webhooks table   │  │
│  └────────────────────────────────┘  │
└──────┬───────────────────────────────┘
      │ 3. Returns JSON:
      │    {
      │      "id": "wh_abc123xyz",
      │      "url": "https://worker.dev/webhook/wh_abc123xyz",
      │      "created_at": 1706092800
      │    }
      ↓
┌──────────────────────┐
│  Dashboard Frontend  │
│  - Display webhook   │
│  - Show copy button  │
│  - Instructions      │
└──────────────────────��


STEP 2: VAPI CONFIGURATION
═══════════════════════════

┌────────────┐
│   Admin    │
└─────┬──────┘
      │ 4. Copies webhook URL
      │    "https://worker.dev/webhook/wh_abc123xyz"
      ↓
┌──────────────────────┐
│  VAPI Dashboard      │
│  (dashboard.vapi.ai) │
│  - Navigate to       │
│    Assistant         │
│  - Server URL field  │
│  - Paste webhook URL │
│  - Save              │
└──────────────────────┘


STEP 3: CALL HAPPENS & WEBHOOK DELIVERY
════════════════════════════════════════

┌──────────────────┐
│  Customer        │
│  Makes phone call│
└────────┬─────────┘
         │
         ↓
┌──────────────────┐
│  VAPI Platform   │
│  - Handles call  │
│  - AI responds   │
│  - Call ends     │
└────────┬─────────┘
         │ 5. Triggers webhook
         │    POST https://worker.dev/webhook/wh_abc123xyz
         │    Content-Type: application/json
         │    Body: {
         │      "message": {
         │        "type": "end-of-call-report",
         │        "call": { ... },
         │        "phoneNumber": {
         │          "number": "+1234567890"
         │        },
         │        "customer": {
         │          "number": "+1234567890"
         │        },
         │        "artifact": {
         │          "recordingUrl": "https://..."
         │        },
         │        "endedReason": "hangup",
         │        "summary": "Customer inquired about...",
         │        "analysis": {
         │          "structuredData": { ... }
         │        }
         │      }
         │    }
         ↓
┌────────────────────────────────────────────────┐
│  Cloudflare Worker                             │
│  ┌──────────────────────────────────────────┐  │
│  │ Endpoint: POST /webhook/:webhookId       │  │
│  │                                          │  │
│  │ 6. Process Request:                      │  │
│  │    a) Extract webhookId from URL         │  │
│  │    b) Query webhooks table               │  │
│  │       SELECT * FROM webhooks             │  │
│  │       WHERE id = 'wh_abc123xyz'          │  │
│  │       AND is_active = 1                  │  │
│  │                                          │  │
│  │    c) Validate webhook exists            │  │
│  │       IF NOT FOUND → Return 404          │  │
│  │                                          │  │
│  │    d) Parse JSON payload                 │  │
│  │       const payload = await req.json()   │  │
│  │                                          │  │
│  │    e) Extract fields:                    │  │
│  │       - phoneNumber                      │  │
│  │       - recordingUrl                     │  │
│  │       - endedReason                      │  │
│  │       - summary                          │  │
│  │       - customer.number                  │  │
│  │       - analysis.structuredData          │  │
│  │                                          │  │
│  │    f) INSERT INTO webhook_calls:         │  │
│  │       {                                  │  │
│  │         id: generate_id(),               │  │
│  │         webhook_id: 'wh_abc123xyz',      │  │
│  │         user_id: webhook.user_id,        │  │
│  │         vapi_call_id: payload.call.id,   │  │
│  │         phone_number: extracted,         │  │
│  │         recording_url: extracted,        │  │
│  │         ended_reason: extracted,         │  │
│  │         summary: extracted,              │  │
│  │         structured_data: JSON.stringify, │  │
│  │         raw_payload: JSON.stringify,     │  │
│  │         created_at: now()                │  │
│  │       }                                  │  │
│  │                                          │  │
│  │    g) INSERT INTO webhook_logs:          │  │
│  │       {                                  │  │
│  │         webhook_id: 'wh_abc123xyz',      │  │
│  │         status: 'success',               │  │
│  │         http_status: 200,                │  │
│  │         payload_size: payload.length,    │  │
│  │         created_at: now()                │  │
│  │       }                                  │  │
│  │                                          │  │
│  │    h) Return 200 OK                      │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
         │
         │ 7. Data persisted
         ↓
┌──────────────────────────┐
│  Cloudflare D1 Database  │
│  ┌──────────────────────┐│
│  │ webhook_calls        ││ ← Call data stored
│  │ webhook_logs         ││ ← Delivery logged
│  └──────────────────────┘│
└──────────────────────────┘


STEP 4: VIEW DATA IN DASHBOARD
═══════════════════════════════

┌────────────┐
│   Admin    │
└─────┬──────┘
      │ 8. Navigate to Webhooks tab
      ↓
┌──────────────────────┐
│  Dashboard Frontend  │
└──────┬───────────────┘
      │ 9. GET /api/webhook-calls
      │    Headers: Authorization: Bearer {jwt}
      ↓
┌──────────────────────────────────────┐
│  Cloudflare Worker                   │
│  ┌────────────────────────────────┐  │
│  │ Endpoint: GET /api/webhook-calls│  │
│  │ - Verify JWT                   │  │
│  │ - SELECT * FROM webhook_calls  │  │
│  │   WHERE user_id = ?            │  │
│  │   ORDER BY created_at DESC     │  │
│  │ - Return JSON array            │  │
│  └────────────────────────────────┘  │
└──────┬───────────────────────────────┘
      │ 10. Returns call data
      ↓
┌──────────────────────┐
│  Dashboard Frontend  │
│  - Display calls     │
│  - Show analytics    │
│  - Play recordings   │
│  - View transcripts  │
└──────────────────────┘
```

---

## Database Schema

### Table: `webhooks`
**Purpose**: Stores webhook configurations for each user

```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,                  -- Unique webhook ID (e.g., wh_abc123xyz)
  user_id TEXT NOT NULL,                -- Owner of the webhook
  webhook_url TEXT NOT NULL UNIQUE,     -- Full webhook URL
  name TEXT,                            -- User-friendly name
  is_active INTEGER DEFAULT 1,          -- 1 = active, 0 = disabled
  created_at INTEGER NOT NULL,          -- Unix timestamp
  updated_at INTEGER NOT NULL,          -- Unix timestamp
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);
```

**Example Record**:
```json
{
  "id": "wh_abc123xyz",
  "user_id": "user_123",
  "webhook_url": "https://voice-ai-dashboard.workers.dev/webhook/wh_abc123xyz",
  "name": "Production Assistant Webhook",
  "is_active": 1,
  "created_at": 1706092800,
  "updated_at": 1706092800
}
```

---

### Table: `webhook_calls`
**Purpose**: Stores call data received from VAPI webhooks

```sql
CREATE TABLE IF NOT EXISTS webhook_calls (
  id TEXT PRIMARY KEY,                  -- Unique call record ID
  webhook_id TEXT NOT NULL,             -- Reference to webhook
  user_id TEXT NOT NULL,                -- Owner (for quick filtering)
  vapi_call_id TEXT,                    -- VAPI's internal call ID
  phone_number TEXT,                    -- Customer phone number
  customer_number TEXT,                 -- Alternative customer number
  recording_url TEXT,                   -- Audio recording URL
  ended_reason TEXT,                    -- How call ended
  summary TEXT,                         -- AI call summary
  structured_data TEXT,                 -- JSON analysis data
  raw_payload TEXT,                     -- Complete VAPI payload (for debugging)
  created_at INTEGER NOT NULL,          -- Unix timestamp
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_calls_webhook_id ON webhook_calls(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_user_id ON webhook_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_created_at ON webhook_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_calls_phone_number ON webhook_calls(phone_number);
```

**Example Record**:
```json
{
  "id": "wc_xyz789abc",
  "webhook_id": "wh_abc123xyz",
  "user_id": "user_123",
  "vapi_call_id": "call_vapi_12345",
  "phone_number": "+13162993145",
  "customer_number": "+13162993145",
  "recording_url": "https://storage.vapi.ai/recordings/abc123.wav",
  "ended_reason": "hangup",
  "summary": "Customer inquired about pricing and scheduled demo for next Tuesday",
  "structured_data": "{\"intent\":\"sales\",\"sentiment\":\"positive\",\"lead_score\":85}",
  "raw_payload": "{\"message\":{...}}",
  "created_at": 1706093400
}
```

---

### Table: `webhook_logs`
**Purpose**: Audit trail of all webhook deliveries (success/failure)

```sql
CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,                  -- Unique log ID
  webhook_id TEXT NOT NULL,             -- Reference to webhook
  status TEXT NOT NULL,                 -- 'success' | 'error'
  http_status INTEGER,                  -- HTTP status code returned
  payload_size INTEGER,                 -- Size of payload in bytes
  error_message TEXT,                   -- Error details if failed
  created_at INTEGER NOT NULL,          -- Unix timestamp
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);
```

**Example Record**:
```json
{
  "id": "log_456def",
  "webhook_id": "wh_abc123xyz",
  "status": "success",
  "http_status": 200,
  "payload_size": 2048,
  "error_message": null,
  "created_at": 1706093400
}
```

---

## API Endpoints

### Webhook Management Endpoints (Protected)

#### 1. Create Webhook
**Endpoint**: `POST /api/webhooks`
**Auth**: Required (JWT)
**Purpose**: Generate a new webhook endpoint for the user

**Request**:
```json
{
  "name": "Production Assistant Webhook"
}
```

**Response** (201 Created):
```json
{
  "id": "wh_abc123xyz",
  "url": "https://voice-ai-dashboard.workers.dev/webhook/wh_abc123xyz",
  "name": "Production Assistant Webhook",
  "is_active": true,
  "created_at": 1706092800
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid/missing JWT
- `400 Bad Request` - Missing name
- `500 Internal Server Error` - Database error

---

#### 2. List Webhooks
**Endpoint**: `GET /api/webhooks`
**Auth**: Required (JWT)
**Purpose**: Get all webhooks for authenticated user

**Response** (200 OK):
```json
[
  {
    "id": "wh_abc123xyz",
    "url": "https://voice-ai-dashboard.workers.dev/webhook/wh_abc123xyz",
    "name": "Production Assistant Webhook",
    "is_active": true,
    "created_at": 1706092800,
    "call_count": 247
  }
]
```

---

#### 3. Delete Webhook
**Endpoint**: `DELETE /api/webhooks/:id`
**Auth**: Required (JWT)
**Purpose**: Delete a webhook (also deletes associated calls and logs)

**Response** (200 OK):
```json
{
  "message": "Webhook deleted successfully"
}
```

**Error Responses**:
- `404 Not Found` - Webhook doesn't exist
- `403 Forbidden` - User doesn't own this webhook

---

#### 4. Get Webhook Calls
**Endpoint**: `GET /api/webhook-calls`
**Auth**: Required (JWT)
**Query Parameters**:
- `webhook_id` (optional) - Filter by specific webhook
- `limit` (optional, default: 100) - Number of records
- `offset` (optional, default: 0) - Pagination offset

**Response** (200 OK):
```json
[
  {
    "id": "wc_xyz789abc",
    "webhook_id": "wh_abc123xyz",
    "vapi_call_id": "call_vapi_12345",
    "phone_number": "+13162993145",
    "recording_url": "https://storage.vapi.ai/recordings/abc123.wav",
    "ended_reason": "hangup",
    "summary": "Customer inquired about pricing...",
    "structured_data": {
      "intent": "sales",
      "sentiment": "positive"
    },
    "created_at": 1706093400
  }
]
```

---

### Public Webhook Receiver Endpoint (No Auth)

#### 5. Receive VAPI Webhook
**Endpoint**: `POST /webhook/:webhookId`
**Auth**: None (webhook ID serves as secret)
**Purpose**: Receive and process VAPI end-of-call data

**Request Headers**:
```
Content-Type: application/json
User-Agent: VAPI-Webhook/1.0
```

**Request Body** (VAPI Payload):
```json
{
  "message": {
    "type": "end-of-call-report",
    "call": {
      "id": "call_vapi_12345",
      "assistantId": "asst_abc123",
      "startedAt": "2025-01-24T10:30:00Z",
      "endedAt": "2025-01-24T10:35:00Z"
    },
    "phoneNumber": {
      "number": "+13162993145"
    },
    "customer": {
      "number": "+13162993145",
      "name": "Erin Farley"
    },
    "artifact": {
      "recordingUrl": "https://storage.vapi.ai/recordings/abc123.wav",
      "transcript": "Full conversation transcript..."
    },
    "endedReason": "hangup",
    "summary": "Customer inquired about pricing and scheduled demo for next Tuesday",
    "analysis": {
      "structuredData": {
        "intent": "sales",
        "sentiment": "positive",
        "lead_score": 85,
        "topics": ["pricing", "demo", "scheduling"]
      }
    }
  }
}
```

**Response** (200 OK):
```json
{
  "received": true,
  "call_id": "wc_xyz789abc"
}
```

**Error Responses**:
- `404 Not Found` - Webhook ID doesn't exist or is inactive
- `400 Bad Request` - Invalid JSON payload
- `500 Internal Server Error` - Database error

---

## VAPI Payload Structure

### Expected Fields from VAPI

Based on VAPI's end-of-call webhook format:

```typescript
interface VapiWebhookPayload {
  message: {
    type: 'end-of-call-report';
    call: {
      id: string;
      assistantId: string;
      startedAt: string;
      endedAt: string;
      cost?: number;
      costBreakdown?: object;
    };
    phoneNumber: {
      number: string;
      country?: string;
      carrier?: string;
    };
    customer: {
      number: string;
      name?: string;
      email?: string;
    };
    artifact: {
      recordingUrl: string;
      transcript?: string;
      stereoRecordingUrl?: string;
    };
    endedReason: 'hangup' | 'assistant-error' | 'pipeline-error' | 'assistant-request';
    summary?: string;
    transcript?: string;
    analysis?: {
      structuredData?: Record<string, any>;
      sentiment?: string;
      intent?: string;
      successEvaluation?: boolean;
    };
  };
}
```

### Field Extraction Map

| Our Database Field | VAPI JSON Path | Fallback |
|-------------------|----------------|----------|
| `vapi_call_id` | `message.call.id` | `null` |
| `phone_number` | `message.phoneNumber.number` | `message.customer.number` |
| `customer_number` | `message.customer.number` | `message.phoneNumber.number` |
| `recording_url` | `message.artifact.recordingUrl` | `null` |
| `ended_reason` | `message.endedReason` | `'unknown'` |
| `summary` | `message.summary` | `''` |
| `structured_data` | `message.analysis.structuredData` | `{}` |

---

## Implementation Roadmap

### Phase 1: Database & Backend (2 hours)

#### Task 1.1: Update Database Schema (30 mins)
- [ ] Add `webhooks` table to `workers/schema.sql`
- [ ] Add `webhook_calls` table to `workers/schema.sql`
- [ ] Add `webhook_logs` table to `workers/schema.sql`
- [ ] Run D1 migrations: `wrangler d1 execute DB --file=./workers/schema.sql`

#### Task 1.2: Create Webhook Management API (1 hour)
- [ ] Implement `POST /api/webhooks` endpoint
  - Generate unique webhook ID (crypto.randomUUID)
  - Build webhook URL with worker domain
  - Insert into `webhooks` table
  - Return webhook details
- [ ] Implement `GET /api/webhooks` endpoint
  - Query webhooks for authenticated user
  - Include call count (JOIN with webhook_calls)
  - Return array of webhooks
- [ ] Implement `DELETE /api/webhooks/:id` endpoint
  - Verify ownership
  - Cascade delete calls and logs
  - Return success message

#### Task 1.3: Create Webhook Receiver Endpoint (30 mins)
- [ ] Implement `POST /webhook/:webhookId` endpoint
  - Extract webhook ID from URL
  - Validate webhook exists and is active
  - Parse JSON payload from VAPI
  - Extract required fields with fallbacks
  - Insert into `webhook_calls` table
  - Insert into `webhook_logs` table
  - Return 200 OK

---

### Phase 2: Frontend UI (1.5 hours)

#### Task 2.1: Update Type Definitions (15 mins)
- [ ] Add `VapiWebhookPayload` interface to `src/types/index.ts`
- [ ] Add `Webhook` interface
- [ ] Add `WebhookCall` interface
- [ ] Add `WebhookLog` interface

#### Task 2.2: Create D1 API Client Functions (15 mins)
- [ ] Add `createWebhook()` to `src/lib/d1.ts`
- [ ] Add `getWebhooks()` to `src/lib/d1.ts`
- [ ] Add `deleteWebhook()` to `src/lib/d1.ts`
- [ ] Add `getWebhookCalls()` to `src/lib/d1.ts`

#### Task 2.3: Enhance WebhookConfig Component (1 hour)
- [ ] Add "Generate Webhook" button
- [ ] Implement webhook generation flow
- [ ] Display generated webhook URL
- [ ] Add copy-to-clipboard functionality
- [ ] Show VAPI integration instructions
- [ ] Display list of webhooks with status
- [ ] Show recent webhook calls
- [ ] Add delete webhook functionality

---

### Phase 3: Testing & Documentation (1 hour)

#### Task 3.1: Manual Testing (30 mins)
- [ ] Test webhook generation in UI
- [ ] Copy webhook URL
- [ ] Use curl/Postman to send test payload
- [ ] Verify data stored in D1
- [ ] Check webhook logs
- [ ] Test VAPI integration (if possible)

#### Task 3.2: Update Documentation (30 mins)
- [ ] Update README with webhook feature
- [ ] Add deployment instructions
- [ ] Create VAPI integration guide
- [ ] Document troubleshooting steps

---

### Phase 4: Deployment (30 mins)

#### Task 4.1: Deploy to Cloudflare (15 mins)
- [ ] Run database migrations on production D1
- [ ] Deploy worker: `wrangler deploy`
- [ ] Verify endpoints are accessible
- [ ] Test with production VAPI account

#### Task 4.2: Deploy Frontend (15 mins)
- [ ] Build React app: `npm run build`
- [ ] Deploy to hosting (Cloudflare Pages/Vercel)
- [ ] Update environment variables
- [ ] Test end-to-end flow

---

## Security Considerations

### 1. Webhook ID as Secret
- **Implementation**: Use `crypto.randomUUID()` for webhook IDs
- **Format**: `wh_` + 32-character random string
- **Entropy**: 128-bit randomness (collision-resistant)
- **Rationale**: Webhook ID serves as authentication token

### 2. Rate Limiting
```typescript
// Implement per-IP rate limiting
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);

  if (!limit || now > limit.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + 60000 }); // 1 min window
    return true;
  }

  if (limit.count >= 100) { // Max 100 requests/min
    return false;
  }

  limit.count++;
  return true;
}
```

### 3. Payload Validation
```typescript
function validateVapiPayload(payload: any): boolean {
  // Check required fields
  if (!payload.message) return false;
  if (!payload.message.type) return false;
  if (payload.message.type !== 'end-of-call-report') return false;

  // Validate structure
  if (typeof payload.message.call !== 'object') return false;

  return true;
}
```

### 4. User Isolation
- All queries filter by `user_id`
- Webhooks cannot access other users' data
- DELETE operations verify ownership

### 5. HTTPS Enforcement
- Cloudflare Workers enforce HTTPS by default
- Reject HTTP requests
- Use secure cookies for auth tokens

### 6. Payload Size Limits
```typescript
// Limit payload to 1MB
if (request.headers.get('content-length') > 1048576) {
  return new Response('Payload too large', { status: 413 });
}
```

### 7. Input Sanitization
```typescript
// Sanitize text fields to prevent XSS
function sanitize(text: string): string {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

---

## Testing Plan

### Unit Tests
1. **Webhook ID Generation**
   - Test uniqueness
   - Test format (wh_ prefix)
   - Test length

2. **Payload Parsing**
   - Test valid VAPI payload
   - Test missing fields (fallbacks)
   - Test invalid JSON
   - Test field extraction

3. **Database Operations**
   - Test INSERT webhook
   - Test SELECT webhooks
   - Test DELETE webhook
   - Test INSERT webhook_call

### Integration Tests
1. **End-to-End Webhook Flow**
   - Generate webhook via API
   - Send test VAPI payload
   - Verify data in database
   - Retrieve via GET endpoint

2. **Authentication**
   - Test protected endpoints with valid JWT
   - Test protected endpoints without JWT
   - Test protected endpoints with expired JWT

3. **Error Handling**
   - Test 404 for invalid webhook ID
   - Test 400 for malformed JSON
   - Test 500 for database errors

### Manual Testing Checklist
- [ ] Generate webhook in UI
- [ ] Copy webhook URL
- [ ] Configure in VAPI dashboard
- [ ] Make test call
- [ ] Verify data appears in dashboard
- [ ] Test delete webhook
- [ ] Test webhook logs
- [ ] Test multiple webhooks per user

---

## Deployment Instructions

### Prerequisites
- Cloudflare account
- Wrangler CLI installed
- D1 database created
- GitHub repository access

### Step 1: Update Database Schema
```bash
# Navigate to project directory
cd "Voice AI Performance & Config Dashboard"

# Apply schema migrations
wrangler d1 execute voice-ai-dashboard-db --file=./workers/schema.sql

# Verify tables created
wrangler d1 execute voice-ai-dashboard-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### Step 2: Deploy Cloudflare Worker
```bash
# Deploy worker
wrangler deploy

# Output will show:
# ✨ Deployment complete!
# 🌍 https://voice-ai-dashboard-api.<your-subdomain>.workers.dev
```

### Step 3: Update Frontend Environment Variables
```bash
# Update .env file
echo "VITE_D1_API_URL=https://voice-ai-dashboard-api.<your-subdomain>.workers.dev" > .env
```

### Step 4: Build & Deploy Frontend
```bash
# Build React app
npm run build

# Deploy to Cloudflare Pages (or your hosting provider)
wrangler pages deploy dist --project-name=voice-ai-dashboard
```

### Step 5: Configure VAPI
1. Login to VAPI Dashboard: https://dashboard.vapi.ai
2. Navigate to Assistant → [Your Assistant]
3. Scroll to "Server URL" field
4. Paste webhook URL: `https://voice-ai-dashboard-api.<your-subdomain>.workers.dev/webhook/<your-webhook-id>`
5. Save changes

### Step 6: Test Integration
```bash
# Send test webhook payload
curl -X POST https://voice-ai-dashboard-api.<your-subdomain>.workers.dev/webhook/<your-webhook-id> \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "end-of-call-report",
      "call": { "id": "test_123" },
      "phoneNumber": { "number": "+1234567890" },
      "endedReason": "hangup",
      "summary": "Test call"
    }
  }'

# Expected response:
# {"received":true,"call_id":"wc_..."}
```

---

## Troubleshooting

### Issue: Webhook not receiving data
**Symptoms**: No data appearing in dashboard after call
**Solutions**:
1. Check VAPI Assistant → Server URL is correct
2. Verify webhook is active: `SELECT * FROM webhooks WHERE id = ?`
3. Check webhook logs: `SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT 10`
4. Test webhook manually with curl

### Issue: 404 Not Found on webhook endpoint
**Symptoms**: VAPI returns 404 when sending webhook
**Solutions**:
1. Verify webhook ID exists in database
2. Check `is_active = 1` in webhooks table
3. Ensure worker is deployed: `wrangler tail`

### Issue: Payload fields are null
**Symptoms**: Data stored but fields are empty
**Solutions**:
1. Check VAPI payload structure (may have changed)
2. Verify field extraction paths in code
3. Check `raw_payload` column for actual structure
4. Update extraction logic if needed

---

## Appendix: Example Curl Commands

### Generate Webhook
```bash
curl -X POST https://voice-ai-dashboard-api.workers.dev/api/webhooks \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Webhook"}'
```

### List Webhooks
```bash
curl -X GET https://voice-ai-dashboard-api.workers.dev/api/webhooks \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Delete Webhook
```bash
curl -X DELETE https://voice-ai-dashboard-api.workers.dev/api/webhooks/wh_abc123 \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Send Test VAPI Payload
```bash
curl -X POST https://voice-ai-dashboard-api.workers.dev/webhook/wh_abc123 \
  -H "Content-Type: application/json" \
  -d @vapi-test-payload.json
```

---

## Conclusion

This webhook feature enables seamless real-time data ingestion from VAPI, providing instant access to call recordings, transcripts, and analytics. The implementation leverages Cloudflare's edge infrastructure for low-latency, high-reliability webhook processing.

**Key Benefits**:
- ✅ Real-time call data synchronization
- ✅ Zero API polling overhead
- ✅ Scalable serverless architecture
- ✅ Secure webhook authentication
- ✅ Comprehensive audit logging

**Next Steps**:
1. Complete Phase 1 implementation (database + backend)
2. Build Phase 2 frontend UI
3. Test with VAPI production account
4. Deploy to production
5. Monitor webhook logs for issues

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-24
**Maintained By**: Development Team
