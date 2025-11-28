# VAPI Function Calling Implementation Plan

## Goal
Enable VAPI assistants to trigger real-time function calls (tools) during a conversation. Specifically, implement a `checkAppointment` tool that checks for existing appointments based on the customer's phone number.

## User Review Required
> [!IMPORTANT]
> You will need to update your VAPI Assistant configuration to include the new tool definition. This plan provides the JSON configuration but you must apply it via the VAPI Dashboard or API.

## Proposed Changes

### Cloudflare Worker (`workers/index.ts`)
#### [MODIFY] [workers/index.ts](file:///Users/benjiemalinao/Documents/WORKING%20PROTOTYPE/Voice%20AI%20Performance%20&%20Config%20Dashboard/workers/index.ts)
- Add handling for `message.type === 'tool-calls'` in the webhook endpoint.
- Implement `checkAppointment` logic:
    - Extract `phoneNumber` from tool arguments.
    - Query `webhook_calls` table for future appointments for this phone number.
    - Return a JSON response with the result string (e.g., "You have an appointment on [Date] at [Time]").

### Documentation
#### [NEW] [VAPI_FUNCTION_CALLING_GUIDE.md](file:///Users/benjiemalinao/Documents/WORKING%20PROTOTYPE/Voice%20AI%20Performance%20&%20Config%20Dashboard/VAPI_FUNCTION_CALLING_GUIDE.md)
- detailed guide on how to configure the tool in VAPI.
- Example JSON for the tool definition.
- Explanation of the worker logic.

## Verification Plan
### Automated Tests
- None (requires live VAPI call).

### Manual Verification
1.  **Deploy Worker**: Deploy the updated worker.
2.  **Configure VAPI**: Add the `checkAppointment` tool to a test assistant in VAPI, pointing the Server URL to the worker's webhook URL.
3.  **Test Call**: Call the assistant and say "Do I have an appointment?".
4.  **Verify**:
    - Check worker logs for `[Webhook Debug] Message Type: tool-calls`.
    - Hear the assistant respond with the appointment details (or "No appointment found").
