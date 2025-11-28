# Live Call Listen & Add Context Feature - Technical Documentation

**Last Updated:** 2025-01-15  
**Audience:** New developers and interns  
**Component:** `src/components/LiveCallFeed.tsx`

---

## Overview

This document explains how the **Listen** functionality works in the Live Call Feed, specifically focusing on the **Add Context** feature that allows supervisors to add context messages to live VAPI AI and customer calls in real-time.

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Step-by-Step Flow](#step-by-step-flow)
4. [Technical Details](#technical-details)
5. [Code References](#code-references)
6. [Common Issues & Solutions](#common-issues--solutions)

---

## Feature Overview

The Live Call Feed allows supervisors to:

1. **Listen** to live calls in real-time via WebSocket audio streaming
2. **Add Context** - Inject system messages into the conversation history
3. **Say Message** - Make the AI speak a message immediately
4. **Monitor** - View audio levels for both AI and customer

This document focuses on the **Add Context** functionality, which adds messages to the conversation history without interrupting the call flow.

### ⚠️ Important: UI-Only Feature

**Add Context is currently ONLY available via the UI interface.** Users must:
1. Manually click the "Listen" button on an active call
2. Select "Add Context" mode from the control buttons
3. Type or speak a message
4. Click the "Send" button

There is **no automated or programmatic way** to add context:
- ❌ No webhooks that automatically add context
- ❌ No scheduled jobs or triggers
- ❌ No external API endpoints for programmatic access
- ❌ No integration with other systems to auto-add context

The backend API endpoint exists but requires:
- User authentication (Bearer token)
- Active listening session (to obtain controlUrl)
- Manual user interaction through the UI

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                │
│                         LiveCallFeed.tsx                                  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. User clicks "Listen" button
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    HTTP GET /api/calls/{callId}/listen                    │
│                    Headers: Authorization: Bearer {token}                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Cloudflare Worker)                        │
│                            workers/index.ts                              │
│                                                                           │
│  1. Authenticate user (getUserFromToken)                                  │
│  2. Get workspace VAPI credentials                                      │
│  3. Fetch call details from VAPI API                                     │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP GET
                              │ https://api.vapi.ai/call/{callId}
                              │ Headers: Authorization: Bearer {private_key}
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          VAPI API (External)                              │
│                                                                           │
│  Returns:                                                                 │
│  {                                                                        │
│    monitor: {                                                             │
│      listenUrl: "wss://...",  ← WebSocket URL for audio                 │
│      controlUrl: "https://..." ← HTTP URL for interventions              │
│    }                                                                      │
│  }                                                                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Response: { listenUrl, controlUrl }
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Cloudflare Worker)                        │
│                    Returns listenUrl and controlUrl                      │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ Response: { listenUrl, controlUrl }
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                │
│                                                                           │
│  • Store controlUrl in state                                             │
│  • Connect WebSocket to listenUrl for audio streaming                    │
│  • Display audio levels and control modes                                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 2. User selects "Add Context" mode
                              │ 3. User types/speaks message
                              │ 4. User clicks "Send"
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              HTTP POST /api/calls/{callId}/control/add-message           │
│                    Headers: Authorization: Bearer {token}                │
│                    Body: { message: { role: 'system', content: '...' } } │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Cloudflare Worker)                        │
│                                                                           │
│  1. Authenticate user                                                    │
│  2. Get workspace VAPI credentials                                       │
│  3. Fetch call details from VAPI API (to get controlUrl)                 │
│  4. Forward add-message command to controlUrl                            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              │ { controlUrl }
                              │ Body: { type: 'add-message', message: {...} }
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          VAPI Control API                                 │
│                                                                           │
│  • Receives add-message command                                          │
│  • Adds message to conversation history                                   │
│  • AI can now use this context in future responses                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### Phase 1: Initializing Listen Connection

```
┌──────────────┐
│   USER       │
└──────┬───────┘
       │
       │ 1. Clicks "Listen" button on active call
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: handleListenToCall(callId)                       │
│  Location: src/components/LiveCallFeed.tsx:371              │
│                                                              │
│  • Sets loading state                                        │
│  • Gets auth token from localStorage                        │
│  • Makes HTTP GET request                                   │
└─────────────────────────────────────────────────────────────┘
       │
       │ HTTP GET /api/calls/{callId}/listen
       │ Headers: { Authorization: Bearer {token} }
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: GET /api/calls/{callId}/listen                     │
│  Location: workers/index.ts:4335                            │
│                                                              │
│  1. Authenticate user (getUserFromToken)                    │
│  2. Get workspace settings (VAPI credentials)               │
│  3. Fetch call details from VAPI API                        │
│     GET https://api.vapi.ai/call/{callId}                   │
│  4. Extract listenUrl and controlUrl from response          │
│  5. Return both URLs to frontend                            │
└─────────────────────────────────────────────────────────────┘
       │
       │ Response: { listenUrl: "wss://...", controlUrl: "https://..." }
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: Receives URLs                                    │
│                                                              │
│  • Stores controlUrl in state (setControlUrl)              │
│  • Creates AudioContext for Web Audio API                   │
│  • Connects WebSocket to listenUrl                          │
│  • Sets up audio stream processing                          │
│  • Updates UI to show "Listening..." state                  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Audio Streaming (WebSocket)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend: WebSocket Connection                              │
│  Location: src/components/LiveCallFeed.tsx:414              │
│                                                              │
│  WebSocket → listenUrl (from VAPI)                          │
│                                                              │
│  • Receives binary audio data (linear16 PCM, 16kHz, stereo) │
│  • Decodes audio chunks                                     │
│  • Mixes stereo channels (AI + Customer) to mono           │
│  • Plays audio via Web Audio API                            │
│  • Calculates audio levels for visualization                │
└─────────────────────────────────────────────────────────────┘
```

### Phase 3: Adding Context

```
┌──────────────┐
│   USER       │
└──────┬───────┘
       │
       │ 1. Selects "Add Context" mode (button click)
       │ 2. Types message OR records voice
       │ 3. Clicks "Send" button
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: handleAddContext()                               │
│  Location: src/components/LiveCallFeed.tsx:588             │
│                                                              │
│  • Validates: textToSend, controlUrl, listeningCallId      │
│  • Sets sendingMessage = true (loading state)              │
│  • Gets auth token from localStorage                        │
│  • Prepares message payload:                               │
│    {                                                         │
│      message: {                                             │
│        role: 'system',                                      │
│        content: textToSend                                 │
│      }                                                      │
│    }                                                        │
│  • Makes HTTP POST request                                 │
└─────────────────────────────────────────────────────────────┘
       │
       │ HTTP POST /api/calls/{callId}/control/add-message
       │ Headers: {
       │   Authorization: Bearer {token},
       │   Content-Type: application/json
       │ }
       │ Body: { message: { role: 'system', content: '...' } }
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: POST /api/calls/{callId}/control/add-message      │
│  Location: workers/index.ts:4467                           │
│                                                              │
│  1. Authenticate user (getUserFromToken)                   │
│  2. Extract callId from URL path                           │
│  3. Parse request body to get message                      │
│  4. Get workspace settings (VAPI credentials)               │
│  5. Fetch call details from VAPI API                        │
│     GET https://api.vapi.ai/call/{callId}                   │
│  6. Extract controlUrl from callDetails.monitor.controlUrl  │
│  7. Forward command to VAPI Control API                     │
│     POST {controlUrl}                                       │
│     Body: {                                                 │
│       type: 'add-message',                                  │
│       message: { role: 'system', content: '...' }          │
│     }                                                       │
│  8. Return success response to frontend                     │
└─────────────────────────────────────────────────────────────┘
       │
       │ HTTP POST
       │ { controlUrl } (from VAPI)
       │ Body: { type: 'add-message', message: {...} }
       ▼
┌─────────────────────────────────────────────────────────────┐
│  VAPI Control API (External Service)                        │
│                                                              │
│  • Receives add-message command                             │
│  • Validates message format                                 │
│  • Adds message to conversation history                      │
│  • AI assistant can now reference this context              │
│  • Returns success response                                 │
└─────────────────────────────────────────────────────────────┘
       │
       │ Response: { success: true }
       ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: Receives Success                                 │
│                                                              │
│  • Logs success message                                     │
│  • Clears message input field                              │
│  • Sets sendingMessage = false                              │
│  • User sees confirmation (no alert, just console log)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Details

### Frontend Components

#### 1. State Management

```typescript
// Key state variables in LiveCallFeed.tsx
const [listeningCallId, setListeningCallId] = useState<string | null>(null);
const [controlUrl, setControlUrl] = useState<string | null>(null);
const [controlMode, setControlMode] = useState<'listen' | 'say' | 'context'>('listen');
const [messageInput, setMessageInput] = useState<string>('');
const [sendingMessage, setSendingMessage] = useState(false);
```

**Purpose:**
- `listeningCallId`: Tracks which call is currently being listened to
- `controlUrl`: Stores the VAPI control URL for interventions
- `controlMode`: Determines what action to take when sending message
- `messageInput`: User's typed message
- `sendingMessage`: Loading state during API call

#### 2. Listen Initialization Flow

**Function:** `handleListenToCall(callId: string)`

**Steps:**
1. Sets loading state (`setListenLoading(callId)`)
2. Fetches listen URL from backend: `GET /api/calls/{callId}/listen`
3. Receives `{ listenUrl, controlUrl }` from backend
4. Stores `controlUrl` in state for later use
5. Creates `AudioContext` for Web Audio API
6. Connects WebSocket to `listenUrl` for audio streaming
7. Sets up audio processing pipeline

#### 3. Add Context Flow

**Function:** `handleAddContext(textOverride?: string)`

**Steps:**
1. Validates required data (text, controlUrl, listeningCallId)
2. Sets loading state (`setSendingMessage(true)`)
3. Prepares message payload:
   ```typescript
   {
     message: {
       role: 'system',
       content: textToSend
     }
   }
   ```
4. Sends POST request: `/api/calls/{callId}/control/add-message`
5. Handles success/error responses
6. Clears input field on success

#### 4. Voice Input (Optional)

Users can also use voice input:

1. Click microphone button → `handleStartRecording()`
2. Browser records audio via `MediaRecorder` API
3. Stop recording → `handleStopRecording()`
4. Audio blob sent to `/api/speech-to-text` (Deepgram)
5. Transcribed text automatically passed to `handleAddContext()`

### Backend Components

#### 1. Listen Endpoint

**Route:** `GET /api/calls/{callId}/listen`  
**Location:** `workers/index.ts:4335`

**Process:**
```typescript
1. Authenticate user (getUserFromToken)
2. Extract callId from URL path
3. Get workspace VAPI credentials (getWorkspaceSettingsForUser)
4. Fetch call details from VAPI API:
   GET https://api.vapi.ai/call/{callId}
   Headers: { Authorization: Bearer {private_key} }
5. Extract listenUrl and controlUrl from response:
   callDetails.monitor.listenUrl
   callDetails.monitor.controlUrl
6. Return both URLs to frontend
```

**Response:**
```json
{
  "success": true,
  "listenUrl": "wss://audio.vapi.ai/...",
  "controlUrl": "https://control.vapi.ai/...",
  "callId": "call_abc123"
}
```

#### 2. Add Message Endpoint

**Route:** `POST /api/calls/{callId}/control/add-message`  
**Location:** `workers/index.ts:4467`

**Process:**
```typescript
1. Authenticate user (getUserFromToken)
2. Extract callId from URL path
3. Parse request body: { message: { role, content } }
4. Get workspace VAPI credentials
5. Fetch call details from VAPI API (to get controlUrl)
6. Extract controlUrl from callDetails.monitor.controlUrl
7. Forward command to VAPI Control API:
   POST {controlUrl}
   Body: {
     type: 'add-message',
     message: { role: 'system', content: '...' }
   }
8. Return success/error response
```

**Request Body:**
```json
{
  "message": {
    "role": "system",
    "content": "The customer is a VIP member with priority support"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

### VAPI API Integration

#### Call Details Endpoint

**VAPI API:** `GET https://api.vapi.ai/call/{callId}`

**Response Structure:**
```json
{
  "id": "call_abc123",
  "status": "in-progress",
  "monitor": {
    "listenUrl": "wss://audio.vapi.ai/stream/...",
    "controlUrl": "https://control.vapi.ai/commands/..."
  },
  "monitorPlan": "premium"
}
```

#### Control API

**VAPI Control API:** `POST {controlUrl}`

**Request:**
```json
{
  "type": "add-message",
  "message": {
    "role": "system",
    "content": "Additional context here"
  }
}
```

**What Happens:**
- VAPI adds the message to the conversation history
- The AI assistant can now reference this context
- The message is treated as a system message (not spoken aloud)
- Future AI responses may incorporate this context

---

## Code References

### Frontend

**Main Component:**
- `src/components/LiveCallFeed.tsx` - Main component file

**Key Functions:**
- `handleListenToCall()` - Lines 371-550
- `handleAddContext()` - Lines 588-623
- `handleSendMessage()` - Lines 553-585 (Say mode)
- `handleStartRecording()` - Lines 626-657
- `handleTranscribeAudio()` - Lines 669-706

**State Variables:**
- Lines 49-64 - All state declarations
- Line 53 - `controlUrl` state
- Line 52 - `controlMode` state

**UI Components:**
- Lines 986-1032 - Control mode selection buttons
- Lines 1035-1089 - Message input and send controls
- Lines 1092-1130 - Audio level visualization

### Backend

**Main File:**
- `workers/index.ts` - Cloudflare Worker main file

**Endpoints:**
- Lines 4335-4407 - `GET /api/calls/{callId}/listen`
- Lines 4467-4521 - `POST /api/calls/{callId}/control/add-message`
- Lines 4524-4580 - `POST /api/speech-to-text` (Deepgram)

**Helper Functions:**
- `getUserFromToken()` - Authentication
- `getWorkspaceSettingsForUser()` - Get VAPI credentials

---

## Common Issues & Solutions

### Issue 1: "Control URL not available"

**Symptoms:**
- Error message when trying to add context
- `controlUrl` is `null` in frontend

**Causes:**
1. VAPI call doesn't have monitoring enabled
2. Call is not in a state that supports control
3. VAPI plan doesn't include control features

**Solutions:**
- Check if call has `monitor.controlUrl` in VAPI response
- Verify VAPI plan includes control features
- Ensure call is in "in-progress" status

### Issue 2: "Failed to add context"

**Symptoms:**
- API call succeeds but context not added
- Error response from VAPI Control API

**Causes:**
1. Invalid message format
2. Control URL expired or invalid
3. VAPI API rate limiting

**Solutions:**
- Verify message format: `{ role: 'system', content: '...' }`
- Check VAPI API response for specific error
- Retry after a short delay if rate limited

### Issue 3: Circular Reference Error

**Symptoms:**
- `TypeError: Converting circular structure to JSON`
- Happens on second context addition

**Root Cause:**
- Event object passed instead of string to handler

**Solution:**
- Always use arrow functions: `onClick={() => handleAddContext()}`
- Never pass function reference directly: `onClick={handleAddContext}` ❌

**Fixed in:** See `lesson_learn.md` for details

### Issue 4: Audio Not Playing

**Symptoms:**
- WebSocket connects but no audio
- Audio levels show 0%

**Causes:**
1. Browser audio context suspended
2. Audio format mismatch
3. WebSocket connection issues

**Solutions:**
- Check browser console for audio context errors
- Verify audio format (linear16 PCM, 16kHz, stereo)
- Check WebSocket connection status
- Ensure browser permissions for audio playback

---

## Testing Checklist

### Manual Testing

- [ ] Click "Listen" button on active call
- [ ] Verify WebSocket connects and audio plays
- [ ] Check audio levels display correctly
- [ ] Select "Add Context" mode
- [ ] Type message and click "Send"
- [ ] Verify success (check console logs)
- [ ] Test voice input (microphone button)
- [ ] Verify transcription works
- [ ] Test multiple context additions
- [ ] Verify context appears in call logs (if available)

### Error Scenarios

- [ ] Test with invalid call ID
- [ ] Test with expired auth token
- [ ] Test with missing VAPI credentials
- [ ] Test with call that has no control URL
- [ ] Test network failure scenarios

---

## Future Improvements

1. **Caching controlUrl**: Currently fetched twice (listen + add-message)
2. **Real-time feedback**: Show when context is successfully added
3. **Context history**: Display previously added contexts
4. **Batch context**: Add multiple contexts at once
5. **Context templates**: Pre-defined context messages

---

## Related Documentation

- [Warm Transfer Flow](./warm-transfer-flow.md)
- [VAPI API Documentation](https://docs.vapi.ai)
- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebSocket API MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

---

## Questions?

If you have questions about this feature, please:
1. Check this document first
2. Review the code references above
3. Check `lesson_learn.md` for known issues
4. Ask the team lead or senior developer

---

**Document Version:** 1.0  
**Last Reviewed:** 2025-01-15  
**Maintained By:** Development Team

