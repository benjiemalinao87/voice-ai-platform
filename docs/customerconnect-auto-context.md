# CustomerConnect Auto-Context Injection

**Last Updated:** November 28, 2025  
**Audience:** Developers, System Administrators  
**Feature:** Automatic customer lookup during VAPI calls

---

## Overview

This feature automatically injects customer context into live VAPI calls when the AI collects a phone number. The system fetches customer data from CustomerConnect API and provides it to the AI assistant, enabling personalized conversations.

---

## Architecture

```
[AI asks for phone number]
         |
         v
[Customer says: "626-788-8831"]
         |
         v
[AI calls lookup_customer tool with phone_number parameter]
         |
         v
[VAPI sends tool-calls webhook to our server]
POST /webhook/{webhookId}
Body: {
  "message": {
    "type": "tool-calls",
    "toolCalls": [{
      "id": "call_xxx",
      "function": {
        "name": "lookup_customer",
        "arguments": "{\"phone_number\": \"6267888831\"}"
      }
    }]
  }
}
         |
         v
[Our server calls CustomerConnect API]
GET https://api-customerconnect.app/api/v3/contacts/search
    ?workspace_id={workspace_id}&phone_number={phone}
Headers: X-API-Key: {api_key}
         |
         v
[Server returns formatted result to VAPI]
{
  "results": [{
    "toolCallId": "call_xxx",
    "result": "Customer found: Benjie Malinao. 
               Existing appointment: 12-15-2025 at 3:30PM. 
               Household/Decision maker: Test Household."
  }]
}
         |
         v
[VAPI adds tool result to conversation - AI uses this context]
```

---

## Setup Guide

### Step 1: Configure CustomerConnect Credentials

1. Go to **Settings → API Configuration**
2. Scroll down to **CustomerConnect Integration** section
3. Enter your **CustomerConnect Workspace ID** (e.g., `76692`)
4. Enter your **CustomerConnect API Key**
5. Click **Save Settings**

### Step 2: Add Tool to VAPI Assistant

Add this tool configuration to your VAPI assistant:

```json
{
  "type": "function",
  "function": {
    "name": "lookup_customer",
    "description": "Look up customer information by phone number. Call this after collecting the customer's phone number to get appointment details and household information.",
    "parameters": {
      "type": "object",
      "properties": {
        "phone_number": {
          "type": "string",
          "description": "Customer phone number (digits only, e.g., 6267888831)"
        }
      },
      "required": ["phone_number"]
    }
  },
  "server": {
    "url": "https://your-domain.com/webhook/{YOUR_WEBHOOK_ID}"
  }
}
```

Replace `{YOUR_WEBHOOK_ID}` with your actual webhook ID from **Settings → Webhooks**.

### Step 3: Update System Prompt

Add this instruction to your assistant's system prompt:

```
After collecting the customer's phone number, call the lookup_customer tool to check for existing appointments and customer information. Use this context to provide personalized assistance.
```

---

## How It Works

### Complete Request/Response Flow

Here's the complete flow from start to finish, showing exactly how data moves:

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Customer Provides Phone Number                          │
│                                                                 │
│ AI: "What's your phone number?"                                │
│ Customer: "626-788-8832"                                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: VAPI AI Calls the Tool                                 │
│                                                                 │
│ VAPI AI automatically calls: lookup_customer(phone_number)       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: VAPI Sends Webhook to Our Server                       │
│                                                                 │
│ POST /webhook/{webhook_id}                                      │
│ {                                                               │
│   "message": {                                                  │
│     "type": "tool-calls",                                       │
│     "toolCalls": [{                                             │
│       "id": "call_123",                                         │
│       "function": {                                             │
│         "name": "lookup_customer",                              │
│         "arguments": "{\"phone_number\": \"6267888832\"}"      │
│       }                                                         │
│     }]                                                          │
│   }                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Our Server Calls CustomerConnect API                   │
│                                                                 │
│ GET https://api-customerconnect.app/api/v3/contacts/search   │
│   ?workspace_id=76692&phone_number=6267888832                  │
│ Headers: X-API-Key: {api_key}                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: CustomerConnect Returns Customer Data                  │
│                                                                 │
│ {                                                               │
│   "success": true,                                              │
│   "data": [{                                                    │
│     "name": "worker test worker",                               │
│     "appointment_date_display": "12-15-2025",                  │
│     "appointment_time": "9:00AM",                               │
│     "metadata": {                                               │
│       "custom_fields": {                                        │
│         "household": "Lyndel Macorol"                           │
│       }                                                         │
│     }                                                           │
│   }]                                                            │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Our Server Returns Result to VAPI                      │
│                                                                 │
│ Response to VAPI's POST request:                               │
│ {                                                               │
│   "results": [{                                                 │
│     "toolCallId": "call_123",                                   │
│     "result": "Customer found: worker test worker.              │
│                Existing appointment: 12-15-2025 at 9:00AM.      │
│                Household/Decision maker: Lyndel Macorol.        │
│                Please acknowledge this information naturally."  │
│   }]                                                            │
│ }                                                               │
│                                                                 │
│ ⚠️ IMPORTANT: This is the RESPONSE to VAPI's POST request.     │
│    Same endpoint, same request/response cycle.                │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: VAPI Injects Context into Conversation                 │
│                                                                 │
│ VAPI takes the "result" string and adds it to AI's context     │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: AI Uses Context Naturally                              │
│                                                                 │
│ AI: "I see you have an appointment on December 15th at         │
│      9:00 AM. Is this regarding that appointment?"             │
└─────────────────────────────────────────────────────────────────┘
```

**Key Takeaway:** The webhook endpoint (`/webhook/{webhook_id}`) handles both receiving the tool call AND returning the result. It's a single request/response cycle - VAPI POSTs to us, we process it, and we return the JSON response immediately.

### 1. Phone Number Collection

When the AI asks for a phone number and the customer provides it, the AI will recognize this as the trigger to call the `lookup_customer` tool.

### 2. Tool Call Handling

VAPI sends a webhook request to your server with the tool call:

```json
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [
      {
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "lookup_customer",
          "arguments": "{\"phone_number\": \"6267888831\"}"
        }
      }
    ],
    "call": { ... }
  }
}
```

### 3. CustomerConnect API Request

The backend calls CustomerConnect API:

```
GET https://api-customerconnect.app/api/v3/contacts/search
    ?workspace_id=76692
    &phone_number=6267888831
Headers:
  X-API-Key: {your_api_key}
  Content-Type: application/json
```

### 4. Response Parsing

The API returns customer data:

```json
{
  "success": true,
  "count": 1,
  "data": [{
    "name": "Benjie Malinao",
    "appointment_time": "3:30PM",
    "appointment_date_display": "12-15-2025",
    "metadata": {
      "custom_fields": {
        "household": "Test Household"
      }
    }
  }]
}
```

The backend extracts:
- `appointment_date_display` → "12-15-2025"
- `appointment_time` → "3:30PM"  
- `metadata.custom_fields.household` → "Test Household"

### 5. Context Returned to VAPI

**How We Return Results to VAPI**

This is a critical part that new developers often ask about. Here's exactly how it works:

#### The Endpoint

VAPI calls your webhook endpoint when the AI triggers a tool:
```
POST /webhook/{webhook_id}
```

Example:
```
POST https://api.voice-config.channelautomation.com/webhook/wh_6b43e1cc-4c53-434a-a2fd-f9f0bd80a1c2
```

**Important:** This is the same endpoint that receives the tool call. We don't need a separate endpoint - we respond directly to VAPI's POST request.

#### The Response Format

Our server processes the tool call, calls CustomerConnect API, and then returns the result in this exact format:

```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "Customer found: Benjie Malinao. Existing appointment: 12-15-2025 at 3:30PM. Household/Decision maker: Test Household. Please acknowledge this information naturally in the conversation."
    }
  ]
}
```

**Key Points:**
- `toolCallId` must match the `id` from the tool call VAPI sent us
- `result` is a plain text string that VAPI injects into the conversation context
- The `result` string becomes part of the AI's knowledge for that conversation
- Multiple tool calls can be in the array if VAPI sends multiple tools at once

#### How VAPI Uses Our Response

1. **VAPI receives our JSON response** from the webhook endpoint
2. **VAPI extracts the `result` string** from each tool call result
3. **VAPI injects the result into the conversation context** - it's like adding a note to the AI's memory
4. **The AI can now reference this information** naturally in the conversation

#### Code Location

The response is returned in `workers/index.ts` at line 8159:

```typescript
// Return results to VAPI
return jsonResponse({ results });
```

This happens in the same request/response cycle - VAPI POSTs to us, we process it, and we return the response immediately. No separate API call needed.

### 6. AI Uses Context

The AI now has customer context and can say something like:

> "Thank you, Benjie! I see you already have an appointment scheduled for December 15th at 3:30 PM. Is this regarding that appointment, or is there something else I can help you with today?"

---

## Response Formats

### Customer Found

```
Customer found: {name}. Existing appointment: {date} at {time}. 
Household/Decision maker: {household}. 
Please acknowledge this information naturally in the conversation.
```

### Customer Not Found

```
No existing customer record found for this phone number. 
This appears to be a new customer.
```

### CustomerConnect Not Configured

```
Customer lookup is not configured. Proceeding without customer history.
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `workers/index.ts` | Tool-calls webhook handler, CustomerConnect API integration |
| `workers/migrations/0023_add_customerconnect_settings.sql` | Database schema for credentials |
| `src/components/Settings.tsx` | Settings UI for credentials |
| `src/components/AgentConfig.tsx` | Tool configuration instructions |
| `src/lib/d1.ts` | Settings type definitions |

---

## Frequently Asked Questions

### Q: Do we need a separate endpoint to return results to VAPI?

**A: No!** We return the results directly from the same webhook endpoint that receives the tool call. When VAPI POSTs to `/webhook/{webhook_id}`, we process the request and return the JSON response in the same HTTP response. It's a single request/response cycle.

### Q: How does VAPI know where to send the tool call?

**A: You configure the webhook URL in the tool definition** when setting up your VAPI assistant. The tool's `server.url` field points to your webhook endpoint. VAPI automatically sends tool calls to that URL.

### Q: What happens if the CustomerConnect API is slow?

**A: The webhook request waits for the CustomerConnect API response** before returning to VAPI. This means VAPI will wait (up to its timeout limit) for our response. The response time is logged in the Tool Logs for monitoring.

### Q: Can we handle multiple tool calls at once?

**A: Yes!** VAPI can send multiple tool calls in a single webhook request. Our code loops through all `toolCalls` and returns results for each one in the `results` array.

### Q: What if the phone number format is different (with dashes, parentheses, etc.)?

**A: Our code normalizes the phone number** by removing all non-digit characters before calling CustomerConnect API. So "626-788-8832", "(626) 788-8832", and "6267888832" all work the same.

## Troubleshooting

### Tool Not Being Called

1. Verify tool is added to VAPI assistant
2. Check system prompt includes instruction to call tool
3. Verify webhook URL is correct
4. Check that the tool's `server.url` matches your webhook endpoint

### Customer Not Found

1. Check phone number format (digits only - our code normalizes it)
2. Verify customer exists in CustomerConnect
3. Check workspace ID matches
4. Review Tool Logs to see the exact phone number used

### API Errors

1. Verify CustomerConnect credentials in Settings
2. Check API key is valid
3. Review server logs for specific errors
4. Check Tool Logs tab for error messages

### No Context Injected

1. Check webhook is receiving tool-calls (check Tool Logs)
2. Verify tool name is exactly `lookup_customer`
3. Review server response format matches VAPI's expected format
4. Check that `toolCallId` in response matches the `id` from the tool call

---

## Security Notes

- CustomerConnect credentials are stored server-side only
- Phone numbers are sanitized before API calls
- API keys are never exposed to the frontend
- All requests require authentication

---

## Related Documentation

- [Live Call Listen & Context Flow](./live-call-listen-and-context-flow.md)
- [Warm Transfer Flow](./warm-transfer-flow.md)
- [VAPI Tool Documentation](https://docs.vapi.ai)

---

**Document Version:** 1.0  
**Last Reviewed:** November 28, 2025

