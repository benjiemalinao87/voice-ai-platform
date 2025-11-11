# API Documentation

Voice AI Performance & Configuration Dashboard API Reference

**Base URL:** `https://api.voice-config.channelautomation.com`

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Auth Endpoints

#### `POST /api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

#### `POST /api/auth/login`
Login to existing account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

---

#### `POST /api/auth/logout`
Logout current session (protected).

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

#### `GET /api/auth/me`
Get current user information (protected).

**Response:**
```json
{
  "id": "user-id",
  "email": "user@example.com",
  "name": "John Doe",
  "created_at": 1234567890
}
```

---

## Settings

#### `GET /api/settings`
Get user workspace settings including API keys (protected).

**Response:**
```json
{
  "privateKey": "api-key",
  "publicKey": "public-key",
  "openaiApiKey": "openai-key",
  "selectedAssistantId": "assistant-id",
  "selectedPhoneId": "phone-id",
  "selectedOrgId": "org-id",
  "selectedWorkspaceId": "workspace-id"
}
```

---

#### `PUT /api/settings`
Update user workspace settings (protected).

**Request Body:**
```json
{
  "privateKey": "new-api-key",
  "openaiApiKey": "new-openai-key",
  "selectedAssistantId": "assistant-id"
}
```

**Response:**
```json
{
  "message": "Settings updated successfully"
}
```

---

## Translation

#### `POST /api/translate`
Translate text using OpenAI (protected). Uses OpenAI API key from workspace settings.

**Request Body:**
```json
{
  "text": "Hello, how are you?",
  "targetLanguage": "spanish"
}
```

**Response:**
```json
{
  "success": true,
  "translatedText": "Hola, ¿cómo estás?"
}
```

---

## Salesforce Integration

#### `GET /api/salesforce/oauth/initiate`
Initiate Salesforce OAuth flow (protected).

**Response:**
```json
{
  "authUrl": "https://login.salesforce.com/services/oauth2/authorize?..."
}
```

---

#### `GET /api/salesforce/oauth/callback`
Handle Salesforce OAuth callback (internal use).

---

#### `GET /api/salesforce/status`
Get Salesforce connection status (protected).

**Response:**
```json
{
  "connected": true,
  "email": "user@salesforce.com",
  "instanceUrl": "https://instance.salesforce.com",
  "connectedAt": "2025-01-15T10:30:00Z"
}
```

---

#### `DELETE /api/salesforce/disconnect`
Disconnect Salesforce integration (protected).

**Response:**
```json
{
  "success": true,
  "message": "Salesforce disconnected successfully"
}
```

---

#### `GET /api/salesforce/sync-logs`
Get Salesforce sync history logs (protected).

**Response:**
```json
[
  {
    "id": "log-id",
    "call_id": "call-id",
    "status": "success",
    "phone_number": "+1234567890",
    "lead_id": "salesforce-lead-id",
    "created_at": 1234567890
  }
]
```

---

## HubSpot Integration

#### `GET /api/hubspot/oauth/initiate`
Initiate HubSpot OAuth flow (protected).

**Response:**
```json
{
  "authUrl": "https://app.hubspot.com/oauth/authorize?..."
}
```

---

#### `GET /api/hubspot/oauth/callback`
Handle HubSpot OAuth callback (internal use).

---

#### `GET /api/hubspot/status`
Get HubSpot connection status (protected).

**Response:**
```json
{
  "connected": true,
  "connectedAt": "2025-01-15T10:30:00Z"
}
```

---

#### `DELETE /api/hubspot/disconnect`
Disconnect HubSpot integration (protected).

**Response:**
```json
{
  "success": true,
  "message": "HubSpot disconnected successfully"
}
```

---

#### `GET /api/hubspot/sync-logs`
Get HubSpot sync history logs (protected).

**Response:**
```json
[
  {
    "id": "log-id",
    "call_id": "call-id",
    "status": "success",
    "phone_number": "+1234567890",
    "contact_id": "hubspot-contact-id",
    "engagement_id": "hubspot-engagement-id",
    "created_at": 1234567890
  }
]
```

---

## Microsoft Dynamics 365 Integration

#### `GET /api/dynamics/oauth/initiate`
Initiate Dynamics 365 OAuth flow (protected).

**Query Parameters:**
- `instanceUrl`: Your Dynamics 365 instance URL (e.g., `https://orgname.crm.dynamics.com`)

**Response:**
```json
{
  "authUrl": "https://login.microsoftonline.com/.../oauth2/v2.0/authorize?..."
}
```

---

#### `GET /api/dynamics/oauth/callback`
Handle Dynamics 365 OAuth callback (internal use).

---

#### `GET /api/dynamics/status`
Get Dynamics 365 connection status (protected).

**Response:**
```json
{
  "connected": true,
  "instanceUrl": "https://orgname.crm.dynamics.com",
  "connectedAt": "2025-01-15T10:30:00Z"
}
```

---

#### `DELETE /api/dynamics/disconnect`
Disconnect Dynamics 365 integration (protected).

**Response:**
```json
{
  "success": true,
  "message": "Dynamics 365 disconnected successfully"
}
```

---

#### `GET /api/dynamics/sync-logs`
Get Dynamics 365 sync history logs (protected).

**Response:**
```json
[
  {
    "id": "log-id",
    "call_id": "call-id",
    "status": "success",
    "phone_number": "+1234567890",
    "dynamics_record_id": "lead-or-contact-id",
    "dynamics_activity_id": "phone-call-activity-id",
    "lead_created": false,
    "created_at": 1234567890
  }
]
```

---

## Workspaces

#### `GET /api/workspaces`
Get all workspaces for the current user (protected).

**Response:**
```json
{
  "workspaces": [
    {
      "id": "workspace-id",
      "name": "My Workspace",
      "role": "admin",
      "created_at": 1234567890
    }
  ]
}
```

---

#### `POST /api/workspaces`
Create a new workspace (protected).

**Request Body:**
```json
{
  "name": "New Workspace"
}
```

**Response:**
```json
{
  "workspace": {
    "id": "workspace-id",
    "name": "New Workspace",
    "created_at": 1234567890
  }
}
```

---

## Twilio Integration

#### `GET /api/twilio/phone-numbers`
Get all Twilio phone numbers (protected).

**Response:**
```json
[
  {
    "sid": "phone-sid",
    "phoneNumber": "+1234567890",
    "friendlyName": "My Phone Number",
    "capabilities": {
      "voice": true,
      "sms": true
    }
  }
]
```

---

## AI Assistants

#### `GET /api/assistants`
Get all AI assistants (protected).

**Response:**
```json
{
  "assistants": [
    {
      "id": "assistant-id",
      "name": "Customer Support",
      "model": {
        "provider": "openai",
        "model": "gpt-4"
      },
      "voice": {
        "provider": "11labs",
        "voiceId": "voice-id"
      }
    }
  ],
  "cached": false
}
```

---

#### `POST /api/assistants`
Create a new AI assistant (protected).

**Request Body:**
```json
{
  "name": "New Assistant",
  "model": {
    "provider": "openai",
    "model": "gpt-4"
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "voice-id"
  }
}
```

**Response:**
```json
{
  "assistant": {
    "id": "assistant-id",
    "name": "New Assistant"
  }
}
```

---

## Webhooks

#### `POST /api/webhooks`
Create a new webhook endpoint (protected).

**Request Body:**
```json
{
  "name": "My Webhook"
}
```

**Response:**
```json
{
  "webhook": {
    "id": "webhook-id",
    "url": "https://api.voice-config.channelautomation.com/webhook/wh_...",
    "secret": "webhook-secret"
  }
}
```

---

#### `GET /api/webhooks`
Get all webhooks for the current user (protected).

**Response:**
```json
[
  {
    "id": "webhook-id",
    "name": "My Webhook",
    "url": "https://api.voice-config.channelautomation.com/webhook/wh_...",
    "created_at": 1234567890
  }
]
```

---

## Outbound Webhooks

#### `POST /api/outbound-webhooks`
Create an outbound webhook to send call events to external URLs (protected).

**Request Body:**
```json
{
  "name": "External Webhook",
  "destinationUrl": "https://example.com/webhook",
  "events": "call.ended"
}
```

**Response:**
```json
{
  "webhook": {
    "id": "webhook-id",
    "name": "External Webhook",
    "destination_url": "https://example.com/webhook",
    "events": "call.ended",
    "is_active": true
  }
}
```

---

#### `GET /api/outbound-webhooks`
Get all outbound webhooks (protected).

**Response:**
```json
[
  {
    "id": "webhook-id",
    "name": "External Webhook",
    "destination_url": "https://example.com/webhook",
    "events": "call.ended",
    "is_active": true,
    "created_at": 1234567890
  }
]
```

---

## Call Data

#### `GET /api/webhook-calls`
Get call recordings and transcripts (protected).

**Query Parameters:**
- `limit`: Number of results (default: 1000)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
[
  {
    "id": "call-id",
    "customer_phone": "+1234567890",
    "customer_name": "John Doe",
    "duration": 180,
    "call_summary": "Customer inquired about pricing...",
    "ended_reason": "customer-ended-call",
    "recording_url": "https://...",
    "created_at": 1234567890
  }
]
```

---

#### `GET /api/active-calls`
Get currently active calls (protected).

**Response:**
```json
[
  {
    "id": "call-id",
    "customer_phone": "+1234567890",
    "status": "in-progress",
    "started_at": 1234567890
  }
]
```

---

#### `GET /api/concurrent-calls`
Get concurrent call statistics (protected).

**Response:**
```json
{
  "current": 5,
  "peak": 12
}
```

---

#### `GET /api/concurrent-calls/timeseries`
Get concurrent calls over time (protected).

**Query Parameters:**
- `granularity`: `minute`, `hour`, or `day` (default: `minute`)
- `limit`: Number of data points (default: 1000)

**Response:**
```json
[
  {
    "timestamp": 1234567890,
    "count": 5
  }
]
```

---

## Analytics

#### `GET /api/dashboard-summary`
Get dashboard summary statistics (protected).

**Response:**
```json
{
  "totalCalls": 1234,
  "answeredCalls": 1100,
  "missedCalls": 134,
  "averageDuration": 180,
  "totalDuration": 222000
}
```

---

#### `GET /api/agent-distribution`
Get call distribution across AI assistants (protected).

**Response:**
```json
[
  {
    "agent_name": "Customer Support",
    "call_count": 450,
    "percentage": 36.5
  }
]
```

---

#### `GET /api/call-ended-reasons`
Get statistics on call end reasons (protected).

**Query Parameters:**
- `start_date`: ISO 8601 date string
- `end_date`: ISO 8601 date string

**Response:**
```json
[
  {
    "ended_reason": "customer-ended-call",
    "count": 450,
    "percentage": 45.0
  }
]
```

---

#### `GET /api/keywords`
Get top keywords from call summaries with sentiment (protected).

**Response:**
```json
[
  {
    "keyword": "pricing",
    "count": 120,
    "positive_count": 80,
    "neutral_count": 30,
    "negative_count": 10,
    "avg_sentiment": 0.65,
    "last_detected_at": 1234567890
  }
]
```

---

#### `GET /api/intent-analysis`
Get call intent analysis (protected).

**Response:**
```json
[
  {
    "intent": "inquiry",
    "count": 450,
    "percentage": 45.0
  }
]
```

---

## Appointments

#### `GET /api/appointments`
Get AI-scheduled appointments from calls (protected).

**Response:**
```json
[
  {
    "id": "appointment-id",
    "call_id": "call-id",
    "customer_phone": "+1234567890",
    "appointment_date": "2025-01-20",
    "appointment_time": "2:00 PM",
    "appointment_type": "Consultation",
    "quality_score": 5,
    "created_at": 1234567890
  }
]
```

---

## Add-ons

#### `GET /api/addons`
Get status of all add-on features (protected).

**Response:**
```json
{
  "openai_analysis": true,
  "twilio_enhanced_caller_id": false,
  "appointments_by_ai": true
}
```

---

#### `POST /api/addons/toggle`
Enable or disable an add-on feature (protected).

**Request Body:**
```json
{
  "addonType": "openai_analysis",
  "enabled": true
}
```

**Response:**
```json
{
  "message": "Add-on updated successfully",
  "enabled": true
}
```

---

## Cache

#### `GET /api/cache/stats`
Get cache statistics (protected).

**Response:**
```json
{
  "totalKeys": 150,
  "hitRate": 0.85,
  "missRate": 0.15
}
```

---

## Admin Endpoints

#### `GET /api/admin/dashboard`
Get admin dashboard statistics (admin only).

**Response:**
```json
{
  "totalUsers": 1234,
  "totalCalls": 56789,
  "activeUsers": 890
}
```

---

#### `GET /api/admin/users`
Get all users in the system (admin only).

**Response:**
```json
[
  {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": 1234567890
  }
]
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

API requests are subject to rate limiting. Please implement appropriate retry logic with exponential backoff.

---

## Webhook Events

When you configure outbound webhooks, they receive call events in the following format:

```json
{
  "event": "call.ended",
  "timestamp": "2025-01-15T10:30:00Z",
  "call_id": "call-id",
  "customer_phone": "+1234567890",
  "assistant_name": "Customer Support",
  "duration_seconds": 180,
  "ended_reason": "customer-ended-call",
  "call_summary": "Customer inquired about...",
  "call_details": {},
  "structured_outputs": {},
  "conversation_transcript": [],
  "recording_url": "https://..."
}
```

---

*Last Updated: January 15, 2025*
