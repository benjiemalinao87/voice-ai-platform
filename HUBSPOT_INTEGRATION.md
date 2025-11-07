# HubSpot Integration Implementation Guide

## Overview

Simple one-way sync integration that pushes call recordings and summaries to HubSpot contacts after call completion. The system searches for contacts by phone number and creates activity/note records.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────┐         ┌──────────────────────┐              │
│  │  Integration.tsx    │         │   Settings UI        │              │
│  │                     │         │                      │              │
│  │  - Connect Button   │────────▶│  - OAuth Popup       │              │
│  │  - Status Display   │         │  - Connection Info   │              │
│  │  - Disconnect       │         │  - Sync Logs         │              │
│  └─────────────────────┘         └──────────────────────┘              │
│           │                                │                             │
│           │                                │                             │
└───────────┼────────────────────────────────┼─────────────────────────────┘
            │                                │
            │ API Calls (d1Client)           │
            ▼                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Cloudflare Workers)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    API Routes (src/index.ts)                     │   │
│  │                                                                  │   │
│  │  GET  /api/hubspot/oauth/initiate  ──▶ Start OAuth Flow        │   │
│  │  GET  /api/hubspot/oauth/callback  ──▶ Handle OAuth Response   │   │
│  │  GET  /api/hubspot/status          ──▶ Check Connection        │   │
│  │  DELETE /api/hubspot/disconnect    ──▶ Remove Tokens           │   │
│  │  GET  /api/hubspot/sync-logs       ──▶ View Sync History       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                │                                         │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │               Cloudflare D1 Database (SQLite)                    │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────┐  ┌──────────────────────────────┐ │   │
│  │  │ hubspot_oauth_tokens    │  │  hubspot_sync_logs           │ │   │
│  │  ├─────────────────────────┤  ├──────────────────────────────┤ │   │
│  │  │ user_id                 │  │  id                          │ │   │
│  │  │ workspace_id            │  │  call_id                     │ │   │
│  │  │ access_token            │  │  contact_id                  │ │   │
│  │  │ refresh_token           │  │  engagement_id               │ │   │
│  │  │ expires_at              │  │  status (success/error)      │ │   │
│  │  │ created_at              │  │  error_message               │ │   │
│  │  │ updated_at              │  │  phone_number                │ │   │
│  │  └─────────────────────────┘  │  created_at                  │ │   │
│  │                                └──────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                                │ HubSpot API Calls
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         HubSpot API (External)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  OAuth 2.0 Authorization    ──▶  Get Access Token                       │
│  Search Contacts by Phone   ──▶  Find Contact ID                        │
│  Create Engagement (Note)   ──▶  Add Call Summary                       │
│  Attach File to Contact     ──▶  Upload Recording                       │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: End-to-End Call Sync

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    CALL COMPLETION TRIGGER FLOW                            │
└───────────────────────────────────────────────────────────────────────────┘

1. Call Ends
   │
   ├─▶ VAPI Webhook Triggered
   │   └─▶ POST /api/webhooks/[webhook-id]
   │
   ▼
2. Webhook Handler Receives Call Data
   │
   ├─▶ Extract: phone_number, call_summary, recording_url
   ├─▶ Store in D1: webhook_calls table
   │
   ▼
3. Check HubSpot Integration Status
   │
   ├─▶ Query: hubspot_oauth_tokens WHERE user_id = ? AND workspace_id = ?
   │
   ├─▶ If NOT CONNECTED ──▶ Skip HubSpot sync
   │
   ├─▶ If CONNECTED ──▶ Continue to Step 4
   │
   ▼
4. Search HubSpot Contact by Phone Number
   │
   ├─▶ API Call: GET https://api.hubapi.com/contacts/v1/search/query
   │   Body: { "query": "+1234567890" }
   │
   ├─▶ Response:
   │   ┌─────────────────────────────────────┐
   │   │ contacts: [                         │
   │   │   {                                 │
   │   │     "vid": 12345,                   │
   │   │     "properties": {                 │
   │   │       "firstname": "John",          │
   │   │       "lastname": "Doe",            │
   │   │       "phone": "+1234567890"        │
   │   │     }                                │
   │   │   }                                 │
   │   │ ]                                   │
   │   └─────────────────────────────────────┘
   │
   ├─▶ If NO CONTACT FOUND ──▶ Log as "skipped" ──▶ END
   │
   ├─▶ If CONTACT FOUND ──▶ Extract contact_id (vid) ──▶ Continue to Step 5
   │
   ▼
5. Create Engagement (Note) with Call Summary
   │
   ├─▶ API Call: POST https://api.hubapi.com/engagements/v1/engagements
   │   Body:
   │   ┌─────────────────────────────────────────────────────────┐
   │   │ {                                                        │
   │   │   "engagement": {                                        │
   │   │     "active": true,                                      │
   │   │     "type": "NOTE",                                      │
   │   │     "timestamp": 1735689600000                           │
   │   │   },                                                     │
   │   │   "associations": {                                      │
   │   │     "contactIds": [12345]                                │
   │   │   },                                                     │
   │   │   "metadata": {                                          │
   │   │     "body": "Call Summary:\n[call_summary]\n\n           │
   │   │              Recording: [recording_url]"                 │
   │   │   }                                                      │
   │   │ }                                                        │
   │   └─────────────────────────────────────────────────────────┘
   │
   ├─▶ Response:
   │   ┌─────────────────────────────────────┐
   │   │ {                                   │
   │   │   "engagement": {                   │
   │   │     "id": 98765,                    │
   │   │     "type": "NOTE"                  │
   │   │   }                                 │
   │   │ }                                   │
   │   └─────────────────────────────────────┘
   │
   ▼
6. (Optional) Upload Recording as File
   │
   ├─▶ API Call: POST https://api.hubapi.com/files/v3/files
   │   Headers: { "Content-Type": "audio/mpeg" }
   │   Body: audio file binary data
   │
   ├─▶ Response: { "id": "file-123" }
   │
   ├─▶ Associate File with Contact:
   │   POST https://api.hubapi.com/files/v3/files/{file-id}/associations
   │   Body: { "objectType": "contact", "objectId": 12345 }
   │
   ▼
7. Log Sync Result in D1
   │
   ├─▶ INSERT INTO hubspot_sync_logs (
   │       call_id,
   │       contact_id,
   │       engagement_id,
   │       status,
   │       error_message,
   │       phone_number,
   │       created_at
   │   ) VALUES (?, ?, ?, ?, ?, ?, ?)
   │
   ├─▶ Status: "success" or "error"
   │
   ▼
8. END

┌───────────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING SCENARIOS                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ❌ Contact Not Found       ──▶ Log as "skipped", continue                │
│  ❌ Token Expired           ──▶ Attempt refresh, retry once               │
│  ❌ API Rate Limit          ──▶ Log as "error", retry with backoff        │
│  ❌ Network Error           ──▶ Log as "error", will retry on next call   │
│  ❌ Invalid Recording URL   ──▶ Skip file upload, log note only           │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Database Setup

#### 1.1 Create Migration File: `migrations/003_hubspot_integration.sql`

```sql
-- HubSpot OAuth tokens table
CREATE TABLE IF NOT EXISTS hubspot_oauth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, workspace_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_hubspot_tokens_user_workspace ON hubspot_oauth_tokens(user_id, workspace_id);
CREATE INDEX idx_hubspot_tokens_expires ON hubspot_oauth_tokens(expires_at);

-- HubSpot sync logs table
CREATE TABLE IF NOT EXISTS hubspot_sync_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    call_id TEXT NOT NULL,
    contact_id TEXT,
    engagement_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('success', 'error', 'skipped')),
    error_message TEXT,
    phone_number TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_hubspot_sync_user_workspace ON hubspot_sync_logs(user_id, workspace_id);
CREATE INDEX idx_hubspot_sync_call ON hubspot_sync_logs(call_id);
CREATE INDEX idx_hubspot_sync_status ON hubspot_sync_logs(status);
CREATE INDEX idx_hubspot_sync_created ON hubspot_sync_logs(created_at DESC);
```

### Phase 2: Backend Implementation

#### 2.1 Environment Variables

Add to `.env` or Cloudflare Workers environment:

```bash
HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URI=https://your-domain.com/api/hubspot/oauth/callback
```

#### 2.2 Backend API Routes (Add to `worker/src/index.ts`)

```typescript
// HubSpot OAuth Routes
app.get('/api/hubspot/oauth/initiate', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const workspaceId = c.get('workspaceId');

  const scopes = [
    'contacts',
    'content',
    'files',
    'timeline'
  ].join(' ');

  const state = `${userId}:${workspaceId}:${Date.now()}`;

  const authUrl = new URL('https://app.hubspot.com/oauth/authorize');
  authUrl.searchParams.set('client_id', c.env.HUBSPOT_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', c.env.HUBSPOT_REDIRECT_URI);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('state', state);

  return c.json({ success: true, authUrl: authUrl.toString() });
});

app.get('/api/hubspot/oauth/callback', async (c) => {
  // OAuth callback handler implementation
  // Exchange code for tokens, store in D1
});

app.get('/api/hubspot/status', authMiddleware, async (c) => {
  // Check connection status
});

app.delete('/api/hubspot/disconnect', authMiddleware, async (c) => {
  // Remove tokens
});

app.get('/api/hubspot/sync-logs', authMiddleware, async (c) => {
  // Return sync logs
});
```

#### 2.3 HubSpot Service Module (`worker/src/services/hubspot.ts`)

```typescript
export class HubSpotService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Search for contact by phone number
   */
  async searchContactByPhone(phoneNumber: string): Promise<{ vid: number } | null> {
    const response = await fetch('https://api.hubapi.com/contacts/v1/search/query', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: phoneNumber })
    });

    const data = await response.json();
    return data.contacts?.[0] || null;
  }

  /**
   * Create engagement (note) with call summary
   */
  async createEngagement(contactId: number, summary: string, recordingUrl: string): Promise<{ id: number }> {
    const body = `Call Summary:\n${summary}\n\nRecording: ${recordingUrl}`;

    const response = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        engagement: {
          active: true,
          type: 'NOTE',
          timestamp: Date.now()
        },
        associations: {
          contactIds: [contactId]
        },
        metadata: {
          body
        }
      })
    });

    const data = await response.json();
    return { id: data.engagement.id };
  }

  /**
   * Sync call to HubSpot (main function)
   */
  async syncCall(phoneNumber: string, summary: string, recordingUrl: string): Promise<{
    success: boolean;
    contactId?: number;
    engagementId?: number;
    error?: string;
  }> {
    try {
      // Step 1: Search for contact
      const contact = await this.searchContactByPhone(phoneNumber);

      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }

      // Step 2: Create engagement
      const engagement = await this.createEngagement(contact.vid, summary, recordingUrl);

      return {
        success: true,
        contactId: contact.vid,
        engagementId: engagement.id
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

#### 2.4 Webhook Handler Integration

Update your existing webhook handler to trigger HubSpot sync:

```typescript
// In your webhook call handler
async function handleWebhookCall(call: WebhookCall, env: Env, userId: string, workspaceId: string) {
  // ... existing webhook processing ...

  // Check if HubSpot is connected
  const hubspotToken = await getHubSpotToken(env.DB, userId, workspaceId);

  if (hubspotToken && call.customer_number && call.summary && call.recording_url) {
    // Trigger HubSpot sync (async, don't block webhook response)
    syncToHubSpot(
      env.DB,
      hubspotToken.access_token,
      userId,
      workspaceId,
      call.id,
      call.customer_number,
      call.summary,
      call.recording_url
    ).catch(console.error);
  }
}

async function syncToHubSpot(
  db: D1Database,
  accessToken: string,
  userId: string,
  workspaceId: string,
  callId: string,
  phoneNumber: string,
  summary: string,
  recordingUrl: string
) {
  const hubspot = new HubSpotService(accessToken);
  const result = await hubspot.syncCall(phoneNumber, summary, recordingUrl);

  // Log the sync result
  await db.prepare(`
    INSERT INTO hubspot_sync_logs (
      id, user_id, workspace_id, call_id, contact_id, engagement_id,
      status, error_message, phone_number, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId(),
    userId,
    workspaceId,
    callId,
    result.contactId || null,
    result.engagementId || null,
    result.success ? 'success' : (result.error === 'Contact not found' ? 'skipped' : 'error'),
    result.error || null,
    phoneNumber,
    Date.now()
  ).run();
}
```

### Phase 3: Frontend Implementation

#### 3.1 Add D1 Client Methods (`src/lib/d1.ts`)

```typescript
// Add to D1Client class

/**
 * Initiate HubSpot OAuth flow
 */
async initiateHubSpotOAuth(): Promise<{ authUrl: string }> {
  const response = await this.request<{ success: boolean; authUrl: string }>(
    '/api/hubspot/oauth/initiate',
    { method: 'GET' }
  );
  return { authUrl: response.authUrl };
}

/**
 * Get HubSpot connection status
 */
async getHubSpotStatus(): Promise<{
  connected: boolean;
  tokenExpiresAt: number | null;
}> {
  const response = await this.request<{
    success: boolean;
    connected: boolean;
    tokenExpiresAt: number | null;
  }>('/api/hubspot/status', { method: 'GET' });

  return {
    connected: response.connected,
    tokenExpiresAt: response.tokenExpiresAt,
  };
}

/**
 * Disconnect HubSpot
 */
async disconnectHubSpot(): Promise<{ success: boolean; message: string }> {
  return this.request<{ success: boolean; message: string }>(
    '/api/hubspot/disconnect',
    { method: 'DELETE' }
  );
}

/**
 * Get HubSpot sync logs
 */
async getHubSpotSyncLogs(params?: {
  limit?: number;
  offset?: number;
  status?: 'success' | 'error' | 'skipped';
}): Promise<{
  logs: Array<{
    id: string;
    call_id: string;
    contact_id: string | null;
    engagement_id: string | null;
    status: 'success' | 'error' | 'skipped';
    error_message: string | null;
    phone_number: string | null;
    created_at: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}> {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.offset) queryParams.set('offset', params.offset.toString());
  if (params?.status) queryParams.set('status', params.status);

  const url = `/api/hubspot/sync-logs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  return this.request<{
    success: boolean;
    logs: Array<any>;
    total: number;
    limit: number;
    offset: number;
  }>(url, { method: 'GET' }).then(response => ({
    logs: response.logs,
    total: response.total,
    limit: response.limit,
    offset: response.offset,
  }));
}
```

#### 3.2 Update Integration Component (`src/components/Integration.tsx`)

Add HubSpot state and handlers similar to Salesforce:

```typescript
// Add state variables
const [hubspotConnected, setHubspotConnected] = useState(false);
const [hubspotNotification, setHubspotNotification] = useState<{
  type: 'success' | 'error';
  message: string;
} | null>(null);

// Load HubSpot status in useEffect
useEffect(() => {
  loadIntegrationStatus();
  checkHubSpotCallback();
}, []);

const checkHubSpotCallback = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const hubspotStatus = urlParams.get('hubspot');

  if (hubspotStatus === 'connected') {
    setHubspotNotification({
      type: 'success',
      message: 'HubSpot connected successfully!'
    });
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => setHubspotNotification(null), 5000);
  } else if (hubspotStatus === 'error') {
    const errorMessage = urlParams.get('message') || 'Failed to connect to HubSpot';
    setHubspotNotification({
      type: 'error',
      message: errorMessage
    });
    window.history.replaceState({}, '', window.location.pathname);
    setTimeout(() => setHubspotNotification(null), 8000);
  }
};

// Update loadIntegrationStatus to include HubSpot
const loadIntegrationStatus = async () => {
  try {
    // ... existing code ...

    // Load HubSpot status
    let hsConnected = false;
    try {
      const hsStatus = await d1Client.getHubSpotStatus();
      hsConnected = hsStatus.connected;
      setHubspotConnected(hsStatus.connected);
    } catch (error) {
      console.error('Error loading HubSpot status:', error);
    }

    // Update integration status
    setIntegrations(prev => prev.map(integration => {
      // ... existing integrations ...

      if (integration.id === 'hubspot') {
        return {
          ...integration,
          status: hsConnected ? 'connected' : 'disconnected',
          lastSync: hsConnected ? 'Active' : undefined
        };
      }
      return integration;
    }));
  } catch (error) {
    console.error('Error loading integration status:', error);
  }
};

// Add HubSpot connect handler
const handleConnect = async (integrationId: string) => {
  // ... existing handlers ...

  if (integrationId === 'hubspot') {
    try {
      setIsConnecting(integrationId);
      const { authUrl } = await d1Client.initiateHubSpotOAuth();

      // Open OAuth in popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'HubSpot OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for popup closure
      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setIsConnecting(null);
          loadIntegrationStatus();
        }
      }, 500);
    } catch (error: any) {
      console.error('Error initiating HubSpot OAuth:', error);
      setHubspotNotification({
        type: 'error',
        message: error.message || 'Failed to initiate HubSpot connection'
      });
      setIsConnecting(null);
      setTimeout(() => setHubspotNotification(null), 8000);
    }
    return;
  }
};

// Add disconnect handler
const handleDisconnectHubSpot = async () => {
  try {
    await d1Client.disconnectHubSpot();
    setHubspotConnected(false);
    setHubspotNotification({
      type: 'success',
      message: 'HubSpot disconnected successfully'
    });
    await loadIntegrationStatus();
    setTimeout(() => setHubspotNotification(null), 5000);
  } catch (error: any) {
    console.error('Error disconnecting HubSpot:', error);
    setHubspotNotification({
      type: 'error',
      message: error.message || 'Failed to disconnect HubSpot'
    });
    setTimeout(() => setHubspotNotification(null), 8000);
  }
};
```

## HubSpot App Configuration

### Required Scopes

In your HubSpot App settings (developer.hubspot.com):

1. **contacts** - Search and read contact data
2. **content** - Create notes/engagements
3. **files** - Upload recording files (optional)
4. **timeline** - Create timeline events

### OAuth Redirect URI

Add to your HubSpot app settings:
```
https://your-domain.com/api/hubspot/oauth/callback
```

## Testing Checklist

- [ ] OAuth flow connects successfully
- [ ] Access token is stored in D1
- [ ] Contact search by phone number works
- [ ] Call summary is posted as note
- [ ] Recording URL is included in note
- [ ] Sync logs are created
- [ ] Error handling for contact not found
- [ ] Token refresh on expiration
- [ ] Disconnect removes tokens
- [ ] Frontend shows connection status

## API References

- **HubSpot OAuth**: https://developers.hubspot.com/docs/api/oauth-quickstart-guide
- **Contact Search**: https://developers.hubspot.com/docs/api/crm/search
- **Engagements API**: https://developers.hubspot.com/docs/api/crm/engagements
- **Files API**: https://developers.hubspot.com/docs/api/files

## Security Considerations

1. **Token Storage**: Access tokens encrypted in D1
2. **Token Refresh**: Automatic refresh before expiration
3. **Scope Limitation**: Only request necessary scopes
4. **HTTPS Only**: All API calls over HTTPS
5. **User Isolation**: Tokens scoped to user + workspace

---

**Last Updated**: 2025-01-07
**Status**: Implementation Ready
