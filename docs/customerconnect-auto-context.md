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

The backend returns formatted context:

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

## Troubleshooting

### Tool Not Being Called

1. Verify tool is added to VAPI assistant
2. Check system prompt includes instruction to call tool
3. Verify webhook URL is correct

### Customer Not Found

1. Check phone number format (digits only)
2. Verify customer exists in CustomerConnect
3. Check workspace ID matches

### API Errors

1. Verify CustomerConnect credentials in Settings
2. Check API key is valid
3. Review server logs for specific errors

### No Context Injected

1. Check webhook is receiving tool-calls
2. Verify tool name is exactly `lookup_customer`
3. Review server response format

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

