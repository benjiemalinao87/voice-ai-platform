<!-- 96ecfc1e-f51d-4c5e-a5e8-ab7c85b0afc9 76ce4cec-c424-4f51-9b62-e80a73ea4cb7 -->
# Real Outbound Campaign Implementation

## Overview

Extend the existing Leads feature to support actual outbound calling campaigns using VAPI's outbound call API. Users can create campaigns, assign leads, select a Voice Agent, and execute calls immediately or on a schedule.

## Database Schema Changes

New migration: `workers/migrations/0029_create_campaigns_table.sql`

```sql
-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,        -- VAPI assistant to use
  phone_number_id TEXT NOT NULL,     -- VAPI phone number to call from
  status TEXT DEFAULT 'draft',       -- draft, scheduled, running, paused, completed, cancelled
  scheduled_at INTEGER,              -- NULL = immediate, otherwise Unix timestamp
  started_at INTEGER,
  completed_at INTEGER,
  total_leads INTEGER DEFAULT 0,
  calls_completed INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_failed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Campaign Leads junction table (links leads to campaigns)
CREATE TABLE IF NOT EXISTS campaign_leads (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  call_status TEXT DEFAULT 'pending', -- pending, calling, completed, failed, no_answer, voicemail
  vapi_call_id TEXT,
  call_duration INTEGER,
  call_outcome TEXT,
  called_at INTEGER,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);
```

## API Endpoints

| Method | Endpoint | Description |

|--------|----------|-------------|

| GET | `/api/campaigns` | List all campaigns |

| POST | `/api/campaigns` | Create new campaign |

| GET | `/api/campaigns/:id` | Get campaign details with stats |

| PATCH | `/api/campaigns/:id` | Update campaign (name, schedule) |

| DELETE | `/api/campaigns/:id` | Delete campaign |

| POST | `/api/campaigns/:id/start` | Start/resume campaign |

| POST | `/api/campaigns/:id/pause` | Pause running campaign |

| POST | `/api/campaigns/:id/cancel` | Cancel campaign |

| POST | `/api/campaigns/:id/leads` | Add leads to campaign |

| GET | `/api/campaigns/:id/leads` | Get campaign leads with call status |

## VAPI Outbound Call Integration

Use VAPI's existing outbound call API:

```typescript
// Make outbound call via VAPI
POST https://api.vapi.ai/call/phone
{
  "assistantId": "assistant-id",
  "phoneNumberId": "phone-number-id", 
  "customer": {
    "number": "+14151234567",
    "name": "John Doe"
  },
  "assistantOverrides": {
    "variableValues": {
      "customerName": "John",
      "product": "Voice AI Platform"
    }
  }
}
```

## Campaign Execution Logic

1. **Immediate Start**: When campaign starts, begin calling leads sequentially
2. **Scheduled**: Cron job checks for scheduled campaigns and starts them
3. **Concurrency**: Respect VAPI concurrency limits (call one at a time or configurable)
4. **Call Completion**: Webhook receives call results, updates campaign_leads status

## UI Changes to Leads.tsx

Transform into a two-tab interface:

- **Tab 1: Leads** - Current lead management (upload, webhook, list)
- **Tab 2: Campaigns** - Campaign management with:
  - Campaign list with status badges
  - "Create Campaign" modal (name, select assistant, select phone, pick leads, schedule)
  - Campaign detail view with progress and call logs
  - Start/Pause/Cancel controls

## Files to Create/Modify

### New Files

- `workers/migrations/0029_create_campaigns_table.sql`

### Files to Modify  

- `workers/index.ts` - Campaign API endpoints + VAPI outbound call logic
- `src/lib/d1.ts` - Campaign D1 client methods
- `src/components/Leads.tsx` - Add Campaigns tab and campaign management UI

## Key Features

1. **Campaign Creation**: Name, select assistant, select phone number, add leads
2. **Scheduling**: Run immediately or schedule for later
3. **Progress Tracking**: Real-time stats (calls made, answered, failed)
4. **Lead Status**: Track each lead's call outcome
5. **Controls**: Start, pause, resume, cancel campaigns

### To-dos

- [ ] Create database migration for campaigns and campaign_leads tables
- [ ] Add campaign CRUD and control API endpoints to workers/index.ts
- [ ] Implement VAPI outbound call logic with campaign execution
- [ ] Add campaign methods to src/lib/d1.ts
- [ ] Transform Leads.tsx into tabbed interface with Campaigns management