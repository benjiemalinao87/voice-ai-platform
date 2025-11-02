# Call Status Categorization

## Database Table: `webhook_calls`

The call status (Answered, Missed, Forwarded) is determined using the following fields from the `webhook_calls` table:

### Key Fields Used:

1. **`ended_reason`** (TEXT)
   - Stores how the call ended (from VAPI webhook)
   - Used to determine Forwarded and Missed calls

2. **`recording_url`** (TEXT)
   - URL of the call recording (if available)
   - Used to determine if a call was Answered
   - If `recording_url` exists → call was answered

3. **`duration_seconds`** (INTEGER)
   - Duration of the call in seconds
   - Used as a fallback to detect missed calls (duration = 0)

### Current `ended_reason` Values in Database:

From remote D1 database query:
- `"customer-ended-call"` → **Answered** (customer hung up after conversation)
- `"assistant-forwarded-call"` → **Forwarded** (call was forwarded)
- `"assistant-ended-call-after-message-spoken"` → **Answered** (AI ended after speaking)
- `"assistant-said-end-call-phrase"` → **Answered** (AI used end call phrase)
- `"silence-timed-out"` → **Missed** (no one answered, silence timeout)

### Categorization Logic:

#### 1. **Forwarded**
- Condition: `ended_reason` contains "forwarded" or "forward"
- Example: `"assistant-forwarded-call"`

#### 2. **Missed**
- Condition: No `recording_url` AND one of:
  - `ended_reason` includes "silence"
  - `ended_reason` includes "timeout"
  - `ended_reason` includes "no-answer"
  - `duration_seconds` = 0
- Example: `"silence-timed-out"` with no recording

#### 3. **Answered** (Default)
- Condition: Has `recording_url` OR call completed normally
- Examples:
  - `"customer-ended-call"` with recording
  - `"assistant-ended-call-after-message-spoken"` with recording
  - Any call with a valid `recording_url`

### Code Location:

- **Backend**: `workers/index.ts` - stores `ended_reason` and `recording_url` from VAPI webhooks
- **Frontend**: `src/components/Recordings.tsx` - `categorizeCall()` function (lines 189-209)

### SQL Query Example:

```sql
SELECT 
  id,
  ended_reason,
  recording_url,
  duration_seconds,
  created_at
FROM webhook_calls
WHERE user_id = ?
ORDER BY created_at DESC;
```

This query provides all the fields needed to categorize calls on the frontend.

