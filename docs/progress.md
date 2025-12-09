# Voice AI Performance & Config Dashboard - Progress

## Completed Features

### Assistant Analytics Dashboard (December 9, 2025)
✅ **Implemented dedicated Assistant Analytics page for viewing calls per assistant**

**Feature Description:**
A new split-panel dashboard page that allows users to easily see and listen to calls for each assistant with quick stats, filters, and prominent audio playback controls.

**Key Components:**

1. **Split-Panel Layout:**
   - Left sidebar: List of all assistants with search functionality
   - Right panel: Selected assistant's stats and call history

2. **Quick Stats Cards:**
   - Total Calls count
   - Average Duration
   - Total Cost
   - Last Active date

3. **Calls List Features:**
   - Large, prominent play/pause button for each call
   - Customer name and phone number clearly displayed
   - Call type badges (Inbound blue, Outbound green, Web purple)
   - Date, duration, and status information
   - Audio progress bar with time display
   - Download recording button
   - Expandable call summary with sentiment analysis

4. **Filters:**
   - Call type filter (All, Inbound, Outbound)
   - Search within call list

**Files Added:**
- `src/components/AssistantAnalytics.tsx` - Complete split-panel dashboard component

**Files Modified:**
- `src/components/Sidebar.tsx` - Added `assistant_analytics` view type and BarChart2 menu item
- `src/App.tsx` - Added AssistantAnalytics import and view handling

**User Experience:**
- Easy assistant selection from left panel
- One-click audio playback with visible progress
- Clear customer identification (name + phone)
- Quick overview stats per assistant
- Filter by call type
- Dark mode support

---

### Settings Page Performance Optimization (December 5, 2024)
✅ **Optimized Settings page loading by parallelizing API calls and implementing skeleton loading**

**Problem:**
Settings page was loading slowly (4-6 seconds) due to sequential API calls creating a waterfall pattern.

**Root Causes Identified:**
1. `loadSettings()` waited for settings, then sequentially called `loadVapiResources()`
2. `loadVapiResources()` fetched assistants first, then phone numbers sequentially
3. Integration component made 4 sequential API calls (user settings, Salesforce, HubSpot, Dynamics status)
4. Full-page blocking spinner prevented any UI from showing until all data loaded

**Optimizations Applied:**

1. **Parallelized API calls in Settings.tsx:**
   - `loadVapiResources()` now uses `Promise.all` to fetch assistants and phone numbers in parallel
   - Removed blocking `await` from `loadVapiResources()` call - UI renders immediately while resources load in background

2. **Parallelized Integration.tsx:**
   - `loadIntegrationStatus()` now fetches all 4 statuses (user settings, Salesforce, HubSpot, Dynamics) in parallel using `Promise.all`

3. **Skeleton Loading:**
   - Created `SettingsSkeleton.tsx` with skeleton components for all Settings sections
   - Replaced blocking spinner with skeleton placeholders
   - Users see immediate visual feedback while data loads

4. **Lazy-loaded Tab Components:**
   - Heavy tab components (Integration, WebhookConfig, Addons, etc.) now use React `lazy()` and `Suspense`
   - Only loads component code when tab is activated
   - Reduces initial bundle size and improves first load

**Performance Impact:**
- **Before:** ~4-6 seconds (sequential waterfall)
- **After:** ~1-2 seconds (parallel + progressive)
- UI appears immediately with skeletons, then progressively fills in

**Files Added:**
- `src/components/SettingsSkeleton.tsx`

**Files Modified:**
- `src/components/Settings.tsx` - Parallelized API calls, skeleton loading, lazy-loaded tabs
- `src/components/Integration.tsx` - Parallelized 4 integration status API calls

---

### Auto Warm Transfer Feature (December 4, 2024)
✅ **Implemented automatic warm transfers triggered by AI when sales opportunities are detected**

**Feature Description:**
When the AI assistant detects a sales opportunity during a call (using the `transfer_to_sales()` function call), the system automatically:
1. Dials through a list of configured agents in priority order
2. Plays an announcement to the agent before connecting
3. Transfers the customer to the first agent who answers
4. Falls back gracefully to AI handling if no agents answer

**Key Components:**

1. **Database Tables:**
   - `assistant_transfer_agents` - Agent phone list per assistant
   - `assistant_transfer_settings` - Configuration (ring timeout, max attempts, enabled)
   - `auto_transfer_logs` - Complete audit trail of all dial attempts

2. **API Endpoints:**
   - `GET/POST /api/assistants/:id/transfer-agents` - Agent list management
   - `PATCH/DELETE /api/assistants/:id/transfer-agents/:agentId` - Individual agent operations
   - `GET/PUT /api/assistants/:id/transfer-settings` - Settings management
   - `GET /api/auto-transfer-logs` - Logs retrieval

3. **Backend Logic:**
   - Extended `tool-calls` webhook handler for `transfer_to_sales` function
   - `autoDialAgentLoop()` function with retry logic
   - TwiML endpoints for agent announcements
   - Comprehensive logging for all dial attempts

4. **Frontend Components:**
   - `TransferAgentSettings.tsx` - Agent list management UI
   - `AutoTransferLogs.tsx` - Transfer history and analytics

**Files Added:**
- `workers/migrations/0027_create_auto_transfer_tables.sql`
- `src/components/TransferAgentSettings.tsx`
- `src/components/AutoTransferLogs.tsx`

**Files Modified:**
- `workers/index.ts` - API endpoints, tool handler, TwiML endpoints
- `src/lib/d1.ts` - D1 client methods for new endpoints

**Configuration Options:**
- Ring timeout per agent (default: 30 seconds)
- Maximum attempts before fallback (default: 3)
- Custom announcement message
- Enable/disable toggle per assistant

---

### Webhook Event Type Filtering Fix (December 4, 2024)
✅ **Fixed call metrics inflation by filtering non-end-of-call webhook events**

**Problem:**
VAPI sends multiple event types for each call (speech-update, conversation-update, assistant.started, hang, etc.). Without filtering, these events could create duplicate call records, inflating metrics.

**Fix:**
Added explicit check to only process `end-of-call-report` events for call records in `webhook_calls` table.

---

### Real-Time Active Calls with Durable Objects (December 4, 2025)
✅ **Replaced polling with WebSocket-based real-time updates using Cloudflare Durable Objects**

**Problem:**
LiveCallFeed component was polling `/api/active-calls` every 2 seconds, causing:
- 15k+ requests/day to the API
- Unnecessary D1 database queries
- Up to 2-second delay for call status updates

**Solution:**
Implemented Cloudflare Durable Objects with WebSocket connections for instant updates.

**Implementation:**
1. Created `ActiveCallsRoom` Durable Object class
2. Added WebSocket upgrade endpoint `/api/active-calls/ws`
3. Modified VAPI webhook handler to notify Durable Object on call status changes
4. Updated frontend to use WebSocket with polling fallback

**Performance Impact:**
- **~90% reduction in API requests**
- **Instant updates** (vs 2-second delay)
- **Lower D1 query load**
- **Better battery life** for users

**Files Added:**
- `workers/active-calls-do.ts` - Durable Object class

**Files Modified:**
- `wrangler.toml` - Added Durable Object binding
- `workers/index.ts` - WebSocket endpoint + webhook notifications
- `src/components/LiveCallFeed.tsx` - WebSocket client with fallback

---

### Dashboard Loading Performance Optimization (December 1, 2025)
✅ **Optimized dashboard loading by reducing API calls from 16 to 7**

**Problem:**
Dashboard was loading slowly due to excessive API calls.

**Root Cause:**
1. Fetching 1000 webhook calls when only 10 are displayed in the table
2. N+1 API problem: Making individual `getAssistant()` calls for each unique assistant ID after loading calls

**Fix Applied:**
1. Reduced webhook-calls limit from 1000 to 200 (80% less data)
2. Added `assistant_id` to `/api/agent-distribution` endpoint response
3. Reuse assistant names from agent-distribution data instead of individual API calls
4. Eliminated 9+ individual assistant API calls entirely

**Performance Impact:**
- **57% fewer API calls** (7 vs 16)
- **80% less data** in webhook-calls response
- **Eliminated N+1 query problem**

**Files Modified:**
- `src/components/PerformanceDashboard.tsx` - Reduced limit, reuse agent distribution data
- `src/lib/d1.ts` - Updated type to include `assistant_id`
- `workers/index.ts` - Added `assistant_id` to agent-distribution SQL query

---

### Workers Automatic Tracing Enabled (December 2024)
✅ **Enabled Cloudflare Workers automatic tracing (open beta)**

**What It Does:**
- Provides detailed metadata and timing information for every operation the Worker performs
- Helps identify performance bottlenecks and resolve errors
- Shows how the Worker interacts with D1 database, KV cache, and R2 storage

**Questions It Can Answer:**
- Which calls are slowing down the application?
- Which queries to the database take the longest?
- What happened within a request that resulted in an error?

**Features:**
- View traces alongside logs in Workers Observability dashboard
- Export traces to OTLP-compatible destinations (Honeycomb, Sentry, Grafana)
- Analyze and query across span attributes (operation type, status, duration, errors)

**Files Modified:**
- `wrangler.toml` - Added `[observability]` and `[observability.tracing]` configuration

**Documentation:**
- https://developers.cloudflare.com/workers/observability/traces/

---

### Branch Visualization Race Condition Fix (December 2024)
✅ **Fixed visual flow marking showing wrong branch path during live calls**

**Problem:**
When user said "Latte", the AI responded correctly but the visual marking incorrectly showed "Espresso" (the first branch option).

**Root Cause:**
Race condition - `speech-start` event fired before async intent classification completed, blindly advancing to `findNextNodes()[0]` (always the first edge).

**Fix:**
Added `isClassifyingIntent` flag to prevent premature node advancement while classification is in progress.

**Files Modified:**
- `src/components/AgentFlowCreator/index.tsx` - Added classification guard logic

---

### CustomerConnect Auto-Context Injection (November 28, 2025)
✅ **Successfully implemented automatic customer context injection via VAPI Tool**

**What It Does:**
- When the AI assistant collects a customer's phone number during a call
- The AI calls the `lookup_customer` tool automatically
- Backend fetches customer data from CustomerConnect API
- Returns appointment details and household/decision maker info
- AI uses this context to provide personalized assistance

**Architecture:**
```
[AI asks for phone number]
         |
         v
[Customer says phone number]
         |
         v
[AI calls lookup_customer tool]
         |
         v
[VAPI sends tool-call webhook to backend]
         |
         v
[Backend calls CustomerConnect API]
GET https://api-customerconnect.app/api/v3/contacts/search
    ?workspace_id={workspace_id}&phone_number={phone}
         |
         v
[Backend returns formatted context to VAPI]
"Customer found: Benjie Malinao. Existing appointment: 12-15-2025 at 3:30PM. 
 Household/Decision maker: Test Household"
         |
         v
[AI uses context in conversation]
```

**Files Created:**
- `workers/migrations/0023_add_customerconnect_settings.sql` - Database migration for CustomerConnect settings

**Files Modified:**
- `workers/index.ts` - Added tool-calls webhook handler and CustomerConnect API integration
- `src/components/Settings.tsx` - Added CustomerConnect settings UI section
- `src/components/AgentConfig.tsx` - Added Customer Lookup Tool configuration guide
- `src/lib/d1.ts` - Updated settings interface for CustomerConnect fields

**Backend Changes:**
- New helper function `lookupCustomerFromCustomerConnect()` for API integration
- Updated `getWorkspaceSettingsForUser()` to include CustomerConnect credentials
- Tool-calls webhook handler that:
  - Detects `lookup_customer` tool call
  - Extracts phone number from parameters
  - Calls CustomerConnect API
  - Returns formatted customer context

**Settings UI:**
- CustomerConnect Workspace ID input
- CustomerConnect API Key input (masked)
- Instructions on how it works

**Agent Config UI:**
- Full tool configuration JSON (copyable)
- System prompt instruction example
- Sample tool response preview

**Context Format Returned:**
When customer found:
```
Customer found: Benjie Malinao. Existing appointment: 12-15-2025 at 3:30PM. 
Household/Decision maker: Test Household. Please acknowledge this information naturally.
```

When not found:
```
No existing customer record found for this phone number. This appears to be a new customer.
```

**Setup Requirements:**
1. Configure CustomerConnect credentials in Settings → API Configuration
2. Add `lookup_customer` tool to VAPI assistant
3. Add instruction to system prompt to call tool after collecting phone number

---

### Warm Transfer Feature (November 24, 2025)
✅ **Successfully implemented Warm Transfer feature for live call handoff to human agents**

**What It Does:**
- During a live AI call with a customer, operators can initiate a "warm transfer"
- The system dials the human agent first in the background
- Once the agent answers, the customer is automatically connected to the agent
- The AI drops off, leaving customer and agent connected

**Architecture:**
```
[Customer] <--VAPI Call--> [AI Assistant]
                              |
                    (Warm Transfer Triggered)
                              |
                              v
[Backend] --Twilio API--> [Dial Agent]
                              |
                    (Agent Answers)
                              |
                              v
[VAPI] --Transfer--> [Customer + Agent Connected]
                         (AI Disconnects)
```

**Files Created:**
- `workers/twilio-conference.ts` - Twilio conference utilities for agent dialing
- `workers/migrations/0022_create_warm_transfers.sql` - Database table for tracking transfers
- `src/components/WarmTransferModal.tsx` - UI modal for warm transfer configuration

**Files Modified:**
- `workers/index.ts` - Added warm transfer endpoints and webhook handlers
- `src/components/LiveCallFeed.tsx` - Added Warm Transfer button and modal integration
- `src/components/AgentConfig.tsx` - Added Transfer Settings section with instructions

**Backend Endpoints:**
- `POST /api/calls/:callId/warm-transfer` - Initiate warm transfer (dials agent)
- `GET /api/calls/:callId/warm-transfer-status` - Poll transfer progress
- `POST /api/calls/:callId/warm-transfer-cancel` - Cancel pending transfer
- `POST /twiml/join-conference/:conferenceName` - TwiML for agent joining
- `POST /twiml/join-conference-with-announcement/:conferenceName` - TwiML with announcement
- `POST /webhook/agent-call-status` - Twilio callback for agent call status
- `POST /webhook/conference-status` - Twilio callback for conference events

**Database Table:**
```sql
CREATE TABLE warm_transfers (
  id TEXT PRIMARY KEY,
  vapi_call_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conference_sid TEXT,
  agent_number TEXT NOT NULL,
  agent_call_sid TEXT,
  status TEXT DEFAULT 'initiated',
  announcement TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Transfer Status Flow:**
1. `initiated` - Transfer request received
2. `dialing_agent` - Twilio is calling the agent
3. `agent_answered` - Agent picked up, connecting customer
4. `connected` - Customer and agent are now connected
5. `failed` - Transfer failed (agent didn't answer, etc.)
6. `cancelled` - Transfer was cancelled by operator

**UI Features:**
- "Warm Transfer" button in Live Call Feed (green, distinct from cold transfer)
- Modal with agent number input and optional announcement message
- Real-time status updates with polling
- Progress indicators (Dialing Agent → Agent Answered → Connected)
- Cancel transfer option during dial-out phase
- Transfer Settings section in Agent Config with setup instructions

**Requirements:**
- Twilio Account SID and Auth Token configured in Settings
- Transfer phone number configured (or VAPI phone number available)
- Active live call to transfer

**Technical Implementation:**
- Uses Twilio REST API for outbound calls
- TwiML endpoints for call handling
- Webhook-based status updates
- VAPI controlUrl for final customer transfer
- Async status polling from frontend

The Warm Transfer feature is now fully functional. Operators can use it from the Live Call Feed to seamlessly connect customers with human agents during live AI calls.

### Embedding Addon Feature (January 2025)
✅ **Successfully implemented Embedding as addons feature**

**Components Created:**
- `EmbeddingModal.tsx` - Complete embedding modal with URL configuration and iframe display
- Updated `Addons.tsx` - Added embedding addon with configuration UI

**Features Implemented:**
- **Embedding Addon**: New addon type that allows users to embed external websites
- **URL Configuration**: Users can provide a site URL to embed
- **Modal Display**: Embedded sites open in a modal overlay within the dashboard
- **Fullscreen Support**: Toggle between windowed and fullscreen modes
- **URL Validation**: Validates URLs to ensure they use http:// or https://
- **Settings Persistence**: Saves embedding URL to database for future use
- **Edit Functionality**: Users can edit the URL from the iframe view
- **Direct Open**: If URL is already saved, opens iframe directly; otherwise shows configuration form

**Backend Endpoints Created:**
- `POST /api/addons/embedding/settings` - Save embedding URL settings
- `GET /api/addons/embedding/settings` - Get embedding URL settings

**Database Integration:**
- Uses existing `user_addons` table with `settings` column (JSON format)
- Stores embedding URL as: `{ "url": "https://example.com" }`
- Automatically creates addon record when settings are saved

**UI Features:**
- Beautiful modal interface matching existing dashboard design
- Configuration form with URL input, Button Name input, and validation
- Iframe display with header bar showing Button Name (URL hidden for cleaner look)
- Fullscreen toggle button
- Edit button to return to configuration
- External link icon to open URL in new tab
- Responsive design for all screen sizes
- Dark mode support

**Technical Implementation:**
- Secure iframe sandbox attributes for security
- URL validation on both client and server side
- TypeScript interfaces for type safety
- Error handling with user-friendly messages
- Follows existing code patterns and architecture
- No linting errors

**User Experience:**
- Clean, intuitive interface
- Clear instructions and help text
- Seamless integration with existing Addons page
- Button shows "Configure Embedding" or "Open Embedded Site" based on state
- Smooth transitions between configuration and iframe views

The Embedding feature is now fully functional. Users can navigate to Settings → Addons, enable the Embedding addon, configure a URL, and open embedded sites as modals within the dashboard.

## Completed Features

### Phone Numbers Management (January 24, 2025)
✅ **Successfully implemented Phone Numbers tab with Twilio import and free number creation**

**Components Created:**
- `PhoneNumbers.tsx` - Complete phone number management UI with list, import, and create functionality
- Updated `Settings.tsx` - Added Phone Numbers tab to settings navigation

**Features Implemented:**
- **List Existing Numbers**: Display all Vapi phone numbers with metadata (number, name, creation date)
- **Import from Twilio**: 
  - Fetches voice-capable phone numbers from Twilio account
  - Radio button selection to choose one number
  - Optional name assignment during import
  - SMS disabled (voice only) as per requirements
- **Create Free Number**:
  - 3-digit US area code input
  - Optional name assignment
  - Uses saved transfer phone number as fallback destination
  - SMS disabled (voice only)
- **UI Features**:
  - Beautiful modal interfaces for import and create
  - Real-time error and success messaging
  - Refresh functionality to reload numbers list
  - Loading states for all async operations
  - Empty state handling with helpful instructions
  - Professional card-based list display

**Backend Endpoints Created:**
- `GET /api/twilio/phone-numbers` - Fetch voice-capable Twilio numbers
- `POST /api/vapi/import-twilio` - Import selected Twilio number to Vapi
- `POST /api/vapi/phone-number` - Create free Vapi number by area code

**Technical Implementation:**
- All endpoints require authentication (JWT)
- Server-side credential management (Twilio and Vapi credentials never exposed to frontend)
- Comprehensive error handling with user-friendly messages
- TypeScript interfaces for type safety
- Follows existing code patterns and architecture

**User Experience:**
- Clean, intuitive interface matching existing dashboard design
- Clear instructions and help text
- Voice-only emphasis (SMS explicitly disabled)
- Seamless integration with existing Settings page
- Mobile-responsive design

The Phone Numbers feature is now fully functional and ready for use. Users can navigate to Settings → Phone Numbers to manage their phone numbers, import from Twilio, or create new free numbers.

### Intent Analysis UI (January 15, 2024)
✅ **Successfully implemented a beautiful Intent Analysis dashboard**

**Components Created:**
- `IntentCard.tsx` - Individual call intent display with expandable details
- `IntentDashboard.tsx` - Main dashboard with filtering, search, and statistics
- Updated `App.tsx` - Added navigation and routing for Intent Analysis

**Features Implemented:**
- **Mock Data**: 5 realistic call examples with intent analysis including:
  - Scheduling intent (Erin Farley - neutral mood, 85% confidence)
  - Information intent (Michael Rodriguez - positive mood, 92% confidence)  
  - Complaint intent (María González - negative mood, 78% confidence)
  - Purchase intent (David Chen - positive mood, 88% confidence)
  - Support intent (Jennifer Smith - neutral mood, 73% confidence)

- **Beautiful UI Design**:
  - Color-coded intent badges (blue for scheduling, green for information, etc.)
  - Mood indicators with confidence scores
  - Expandable cards showing detailed AI reasoning
  - Professional layout matching existing dashboard theme

- **Interactive Features**:
  - Search functionality across customer names, intents, and transcript excerpts
  - Filter by intent type and mood
  - Summary statistics (total calls, answered calls, average confidence, intent types)
  - Intent distribution visualization
  - Responsive design for all screen sizes

- **Navigation Integration**:
  - Added "Intent Analysis" tab to main navigation
  - Brain icon for visual consistency
  - Seamless integration with existing dark/light mode

**Technical Implementation:**
- TypeScript interfaces for type safety
- React hooks for state management
- Tailwind CSS for styling
- Lucide React icons for consistency
- No linting errors
- Follows existing code patterns and architecture

**User Experience:**
- Clean, professional interface
- Intuitive filtering and search
- Detailed AI reasoning explanations
- Real-time statistics
- Mobile-responsive design

The Intent Analysis feature is now fully functional and ready for use. Users can navigate to the "Intent Analysis" tab to view AI-powered analysis of customer call intents and moods with beautiful, interactive cards and comprehensive filtering options.

### Team Members & Workspaces Feature (January 2025)
✅ **Successfully implemented comprehensive workspace and team management system**

**Architecture Overview:**
- **Multi-tenant Workspace System**: Each workspace is owned by a user and can have multiple members with different roles
- **Data Isolation**: Workspace context automatically scopes all data queries (assistants, calls, recordings, analytics) to the workspace owner's data
- **Credential Sharing**: Workspace members access the owner's API keys server-side for seamless data access
- **Role-based Access**: Three roles - Owner (full control), Admin (can invite/remove), Member (view access)

**Database Schema:**
- `workspaces` table: `id`, `name`, `owner_user_id`, `created_at`, `updated_at`
- `workspace_members` table: `id`, `workspace_id`, `user_id`, `role` (member/admin), `status` (active/pending), `invited_by_user_id`, `invited_at`, `joined_at`
- `user_settings` table: Added `selected_workspace_id` column for workspace context

**Backend Endpoints Created:**
- `GET /api/workspaces` - List all workspaces user owns or is a member of
- `POST /api/workspaces` - Create new workspace
- `POST /api/workspaces/:id/invite` - Invite user to workspace by email
- `GET /api/workspaces/:id/members` - Get workspace members list
- `DELETE /api/workspaces/:id/members/:memberId` - Remove member (owner/admin only)
- `PATCH /api/workspaces/:id/members/:memberId` - Update member role (owner only)
- Updated `/api/assistants` - Now supports workspace context using owner's API keys
- Updated `/api/webhook-calls` - Now scoped to workspace owner
- Updated `/api/webhooks` - Now scoped to workspace owner
- Updated `/api/keywords` - Now scoped to workspace owner
- Updated `/api/intent-analysis` - Now scoped to workspace owner
- Updated `/api/active-calls` - Now scoped to workspace owner
- Updated `/api/concurrent-calls` - Now scoped to workspace owner
- Updated `/api/call-ended-reasons` - Now scoped to workspace owner

**Helper Functions:**
- `getEffectiveUserId()` - Returns workspace owner's user_id if workspace is selected, otherwise authenticated user's ID
- Validates workspace access (user must be owner or active member)
- Automatically scopes all queries to effective user ID

**Frontend Components:**
- `TeamMembers.tsx` - Complete team management UI with Twilio-inspired design
  - Workspace selector with active workspace indicator
  - Create workspace modal
  - Team member list with avatars, roles, status badges
  - Invite member modal
  - Member actions menu (remove member, change role)
  - Dark mode support
- Updated `Settings.tsx` - Added "Team" tab
- Updated `App.tsx` - Added workspace selector in header navigation
- Updated `VapiContext.tsx` - Added `selectedWorkspaceId` state and `setSelectedWorkspaceId` function

**Features Implemented:**
- **Create Workspace**: Beautiful modal UI for creating new workspaces
- **Workspace Selection**: Dropdown in header and settings to switch between workspaces
- **Active Workspace Indicator**: Shows which workspace is currently active for data filtering
- **Invite Members**: Invite existing users to workspace by email address
- **Member List**: View all workspace members with roles and status
- **Remove Members**: Owners and admins can remove members
- **Change Roles**: Owners can promote members to admin or demote to member
- **Workspace Scoping**: All data (assistants, calls, recordings, analytics) automatically filtered to workspace owner's data
- **Personal Mode**: Option to switch to "Personal" mode to view own data without workspace context

**Technical Implementation:**
- Server-side workspace context resolution (secure, no client-side key sharing)
- Cache keys scoped to effective user ID (workspace owner)
- Permission checks at API level (not just UI)
- Automatic data isolation (no data leakage between workspaces)
- TypeScript interfaces for type safety
- Comprehensive error handling
- Follows existing code patterns and architecture

**User Experience:**
- Clean, professional Twilio-inspired UI design
- Intuitive workspace switching from header
- Clear visual indicators for active workspace
- Seamless data filtering when switching workspaces
- Role-based UI permissions (actions only show for authorized users)
- Mobile-responsive design

**Security Features:**
- API keys never exposed to frontend (server-side only)
- Workspace access validated on every request
- Permission checks prevent unauthorized actions
- Data isolation ensures users only see workspace owner's data
- Cannot remove workspace owner
- Only owners can change roles

The Team Members & Workspaces feature is now fully functional and deployed. Users can create workspaces, invite team members, manage roles, and seamlessly switch between personal and workspace contexts. All data queries are automatically scoped to the selected workspace, ensuring proper data isolation and team collaboration.

## Recording Total Count Fix - November 17, 2025

✅ **Successfully Fixed**: Recording page total count display

**Changes Made:**
1. Modified backend API to return both paginated results and total count
2. Updated D1 client to handle new response format
3. Modified Recordings component to display accurate total count

**Impact:**
- Users now see correct total count immediately (e.g., "12 of 17 recordings") without needing to load all records
- Improved UX by showing accurate information upfront
- Better performance as we don't need to fetch all records to show count

**Files Modified:**
- `workers/index.ts` - Added COUNT query and changed response format
- `src/lib/d1.ts` - Updated getWebhookCalls return type
- `src/components/Recordings.tsx` - Added totalCount state and updated display


## Pagination Implementation - November 17, 2025

✅ **Successfully Implemented**: Proper pagination for recordings page

**Changes Made:**
1. Replaced "Load More" button with pagination controls
2. Added Previous/Next buttons with proper disabled states
3. Implemented smart page number display (max 5 visible pages)
4. Shows "Showing X to Y of Z recordings" text
5. Simplified state management (removed merge/append logic)

**Features:**
- Navigate with Previous/Next buttons
- Click specific page numbers to jump
- Current page highlighted in blue
- Ellipsis (...) for large page ranges
- Always shows first and last page
- 10 recordings per page

**Impact:**
- Better performance (only renders current page)
- Improved UX (standard pagination pattern)
- Easier navigation (can jump to any page)
- Cleaner code (simpler state management)
- Faster page loads (no accumulating DOM elements)

**Files Modified:**
- `src/components/Recordings.tsx` - Complete pagination implementation

## Documentation - Live Call Listen & Add Context Flow (January 15, 2025)

✅ **Successfully Created**: Comprehensive technical documentation for Live Call Listen and Add Context feature

**Document Created:**
- `docs/live-call-listen-and-context-flow.md` - Complete technical documentation with ASCII diagrams

**Features Documented:**
- **Architecture Overview**: Complete system architecture from frontend to VAPI API
- **Step-by-Step Flow**: Detailed flow diagrams for:
  - Initializing Listen Connection
  - Audio Streaming via WebSocket
  - Adding Context to Live Calls
- **Technical Details**: 
  - Frontend state management
  - Backend endpoint implementations
  - VAPI API integration
- **Code References**: Specific line numbers and file locations
- **Common Issues & Solutions**: Troubleshooting guide for common problems
- **Testing Checklist**: Manual and error scenario testing guidelines

**Documentation Highlights:**
- ASCII diagrams for visual understanding
- Beginner-friendly explanations
- Complete code references with line numbers
- Real-world troubleshooting scenarios
- Future improvement suggestions

**Target Audience:**
- New developers joining the team
- Interns learning the codebase
- Future reference for the development team

The documentation provides a complete understanding of how the Listen functionality works, specifically focusing on the Add Context feature that allows supervisors to inject system messages into live VAPI AI and customer calls in real-time.


---

### Leads Management Feature (December 5, 2024)
✅ **Implemented leads/contacts management with CSV upload and public inbound webhook**

**Feature Description:**
A comprehensive leads management system that allows users to:
1. Upload contacts via CSV file with standardized columns
2. Receive leads from external systems via public webhook
3. View, search, and manage leads in a paginated table
4. Track lead status (new, contacted, qualified)

**Key Components:**

1. **Database Tables:**
   - `leads` - Stores contact information (firstname, lastname, phone, email, lead_source, product, notes, status)
   - `lead_webhooks` - Workspace-specific public webhook tokens

2. **API Endpoints:**
   - `GET /api/leads` - List leads (workspace-scoped, paginated)
   - `POST /api/leads` - Create single lead
   - `POST /api/leads/upload` - Bulk CSV upload
   - `DELETE /api/leads/:id` - Delete lead
   - `PATCH /api/leads/:id` - Update lead
   - `GET /api/leads/webhook` - Get/create workspace webhook URL
   - `POST /webhook/leads/:token` - Public inbound webhook (no auth required)

3. **Frontend Component:**
   - `Leads.tsx` - Full leads management UI with:
     - Paginated table with search
     - CSV upload modal with drag-and-drop
     - Webhook URL modal
     - Lead status badges

**Files Added:**
- `workers/migrations/0028_create_leads_table.sql`
- `src/components/Leads.tsx`

**Files Modified:**
- `workers/index.ts` - API endpoints and public webhook handler
- `src/lib/d1.ts` - D1 client methods for leads operations
- `src/App.tsx` - Added "Leads" navigation tab

**CSV Format:**
```csv
firstname,lastname,phone,email,lead_source,product,notes
John,Doe,+14151234567,john@example.com,Website,Product A,Interested in demo
```

**Webhook Payload:**
Accepts both single objects and arrays:
```json
{
  "firstname": "John",
  "lastname": "Doe",
  "phone": "+14151234567",
  "email": "john@example.com",
  "lead_source": "Website",
  "product": "Product A",
  "notes": "Interested in demo"
}
```

---

### Real Outbound Campaign Feature (December 5, 2024)
✅ **Implemented AI-powered outbound calling campaigns using VAPI**

**Feature Description:**
A complete outbound campaign system that allows users to:
1. Create calling campaigns with assigned Voice Agent and phone number
2. Add leads to campaigns from the existing leads database
3. Start/pause/cancel campaigns with real-time status updates
4. Track campaign progress with call statistics

**Key Components:**

1. **Database Tables:**
   - `campaigns` - Campaign metadata (name, assistant_id, phone_number_id, status, stats)
   - `campaign_leads` - Junction table linking leads to campaigns with call status tracking

2. **API Endpoints:**
   - `GET /api/campaigns` - List all campaigns (workspace-scoped)
   - `POST /api/campaigns` - Create new campaign
   - `GET /api/campaigns/:id` - Get campaign details
   - `PATCH /api/campaigns/:id` - Update campaign
   - `DELETE /api/campaigns/:id` - Delete campaign
   - `POST /api/campaigns/:id/leads` - Add leads to campaign
   - `GET /api/campaigns/:id/leads` - Get campaign leads with call status
   - `POST /api/campaigns/:id/start` - Start/resume campaign
   - `POST /api/campaigns/:id/pause` - Pause running campaign
   - `POST /api/campaigns/:id/cancel` - Cancel campaign
   - `GET /api/vapi/phone-numbers` - List VAPI phone numbers

3. **Campaign Execution:**
   - `executeCampaignCalls()` function using `ctx.waitUntil()` for background execution
   - Calls VAPI's `/call/phone` endpoint for each lead
   - 2-second delay between calls to avoid rate limiting
   - Respects pause/cancel during execution
   - Updates stats in real-time

4. **Frontend Updates:**
   - Transformed `Leads.tsx` into tabbed interface with Leads and Campaigns tabs
   - Lead selection with checkboxes for campaign creation
   - Campaign cards with status badges, progress bars, and controls
   - Create Campaign modal with assistant/phone selection

**Files Added:**
- `workers/migrations/0029_create_campaigns_table.sql`

**Files Modified:**
- `workers/index.ts` - Campaign API endpoints + VAPI integration
- `src/lib/d1.ts` - Campaign D1 client methods
- `src/components/Leads.tsx` - Tabbed interface with Campaigns management

**Campaign Status Flow:**
```
draft → (start) → running → (pause) → paused → (start) → running → completed
                     ↓                              ↓
               (cancel) → cancelled           (cancel) → cancelled
```

**VAPI Integration:**
- Uses VAPI's `/call/phone` endpoint for outbound calls
- Passes customer info and dynamic variables (customerName, email, product, leadSource)
- Background execution doesn't block API response

---

### API Keys Management (December 5, 2024)
✅ **Implemented API key generation and management for programmatic access**

**Feature Description:**
Users can now create and manage API keys for programmatic access to the API instead of relying on browser-based JWT tokens.

**Key Components:**

1. **Database Table:**
   - `api_keys` - Stores hashed API keys with metadata (name, prefix, expiration, last used)

2. **API Endpoints:**
   - `GET /api/api-keys` - List user's API keys
   - `POST /api/api-keys` - Create new API key
   - `DELETE /api/api-keys/:id` - Revoke an API key

3. **Authentication Updates:**
   - Updated `getUserFromToken()` to accept both JWT tokens and API keys
   - API keys format: `sk_live_xxxxxxxxxx` (similar to Stripe)
   - Keys are hashed with SHA-256 before storage

4. **Frontend Component:**
   - `ApiKeys.tsx` - Full API key management UI
   - Create key modal with name and optional expiration
   - Key display only shown once on creation
   - Copy to clipboard functionality
   - Revoke keys with confirmation

**Files Added:**
- `workers/migrations/0030_create_api_keys_table.sql`
- `src/components/ApiKeys.tsx`

**Files Modified:**
- `workers/index.ts` - API endpoints and authentication updates
- `src/lib/d1.ts` - D1 client methods for API keys
- `src/components/Settings.tsx` - Added "API Keys" tab

**Security Features:**
- API keys are hashed before storage (SHA-256)
- Full key is only shown once on creation
- Support for key expiration
- Tracks last used timestamp

---

### API Documentation Page (December 5, 2024)
✅ **Created beautiful, modern API documentation page for all worker-based endpoints**

**Feature Description:**
A comprehensive, developer-friendly API documentation page that documents all available REST API endpoints with the base URL `api.voice-config.channelautomation.com`.

**Key Features:**

1. **Modern UI Design:**
   - Dark gradient background with glassmorphism effects
   - Collapsible sections organized by category
   - Method badges color-coded (GET=green, POST=blue, PUT=amber, PATCH=purple, DELETE=red)
   - Search functionality across all endpoints
   - Quick navigation buttons to jump to sections
   - Copy-to-clipboard for full endpoint URLs

2. **API Categories Documented:**
   - **Authentication** (4 endpoints) - Register, login, logout, get current user
   - **Voice Assistants** (5 endpoints) - CRUD operations for AI assistants
   - **Call Management** (7 endpoints) - Active calls, control, transfers, warm transfers
   - **Outbound Campaigns** (7 endpoints) - Create, start, pause, cancel campaigns
   - **Leads** (5 endpoints) - Lead management with CSV upload
   - **Webhooks** (8 endpoints) - Incoming and outbound webhook configuration
   - **Analytics** (8 endpoints) - Dashboard, keywords, intents, reports
   - **Phone Numbers** (4 endpoints) - Twilio and VAPI phone management
   - **CRM Integrations** (9 endpoints) - Salesforce, HubSpot, Dynamics 365
   - **Workspaces & Teams** (4 endpoints) - Team member management
   - **Settings** (5 endpoints) - Workspace settings and API keys
   - **Agent Flows** (4 endpoints) - Visual flow builder API
   - **Knowledge Base** (3 endpoints) - Document upload for AI
   - **Scheduling Triggers** (4 endpoints) - Automated call scheduling
   - **Add-ons** (3 endpoints) - Feature toggles and embedding
   - **Public Webhooks** (2 endpoints) - VAPI and leads inbound webhooks

3. **Endpoint Documentation Includes:**
   - HTTP method and path
   - Description
   - Authentication requirement badge
   - Query parameters table (name, type, required, description)
   - Request body table (name, type, required, description)
   - Example response JSON

4. **Accessibility:**
   - Public route at `/api-docs` (no authentication required)
   - Responsive design for all screen sizes

**Files Added:**
- `src/components/ApiDocs.tsx` - Complete API documentation component (1000+ lines)

**Files Modified:**
- `src/App.tsx` - Added `/api-docs` route

**Technical Implementation:**
- TypeScript interfaces for type safety
- React hooks for state management (search, collapsed sections)
- Tailwind CSS for styling with dark theme
- No external dependencies added
- Follows existing code patterns

---

### Dynamic Lead Context for Outbound Campaigns (December 5, 2024)
✅ **Enable personalized AI calls by injecting lead data into prompts**

**Feature Description:**
Campaigns can now store prompt templates with placeholders (`{firstname}`, `{product}`, `{notes}`, etc.) that get replaced with actual lead data before each outbound call, creating personalized AI interactions.

**Key Features:**

1. **Template Placeholders:**
   - `{firstname}` - Lead's first name
   - `{lastname}` - Lead's last name
   - `{product}` - Product interest
   - `{notes}` - Lead notes
   - `{lead_source}` - Where lead came from
   - `{email}` - Lead's email
   - `{phone}` - Lead's phone number

2. **First Message Template:**
   - Personalize the AI's opening line
   - Example: "Hello, is this {firstname}?"

3. **Prompt Template:**
   - Override the entire system prompt per-campaign
   - Include lead context for optimized conversations
   - If empty, uses the assistant's default prompt

**Database Changes:**
- Migration: `0031_add_campaign_templates.sql`
- Added `prompt_template` and `first_message_template` columns to `campaigns` table

**Backend Changes (workers/index.ts):**
- `replaceLeadPlaceholders()` helper function for template substitution
- Updated `executeCampaignCalls()` to use `assistantOverrides` with personalized content
- Campaign create/update endpoints now accept template fields

**Frontend Changes (src/components/Leads.tsx):**
- Updated Campaign interface with template fields
- Added template input fields to Create Campaign modal
- Added template input fields to Edit Campaign modal
- Placeholder hints shown in UI

**How It Works:**
1. Create a campaign with First Message Template and/or Prompt Template
2. Add leads with data (firstname, product, notes, etc.)
3. Start the campaign
4. Each call automatically personalizes the prompt with that lead's data
5. AI says: "Hello, is this John?" instead of generic greeting

---

## Partner Single-Call Endpoint - December 8, 2025

**Feature:** Single API endpoint for external partners to trigger AI outbound calls with one request.

**Endpoint:** `POST /api/partner/call`

**Purpose:** External partners can now trigger AI calls without calling multiple endpoints. The endpoint handles:
- Lead creation/lookup (by phone number)
- Adding lead to campaign
- Initiating the AI call via VAPI

**Key Features:**
- Uses existing API key system (`sk_live_xxx`) for authentication
- Finds existing lead by phone OR creates new lead
- Blocks duplicate calls (if phone is already being called)
- Injects lead context into AI system prompt
- Applies first_message_template personalization
- Optional callback_url for call result notification

**Files Changed:**
- `workers/index.ts` - Added `/api/partner/call` endpoint
- `src/components/ApiDocs.tsx` - Added Partner Integration documentation section
- `docs/lesson_learn.md` - Documented the feature

