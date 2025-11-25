# Warm Transfer Flow - VAPI + Twilio Integration

## Current Flow (Working)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WARM TRANSFER FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

TIMELINE ──────────────────────────────────────────────────────────────────────────►

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CUSTOMER   │     │   VAPI AI    │     │   TWILIO     │     │    AGENT     │
│   (Caller)   │     │  Assistant   │     │   (Bridge)   │     │   (Human)    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  1. Talking to AI  │                    │                    │
       │◄──────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │   2. Dashboard:    │                    │
       │                    │   "Warm Transfer"  │                    │
       │                    │   clicked          │                    │
       │                    │                    │                    │
       │                    │                    │  3. Dial Agent     │
       │                    │                    │───────────────────►│
       │                    │                    │                    │
       │                    │                    │  4. Agent Answers  │
       │  Still talking     │                    │◄───────────────────│
       │◄──────────────────►│                    │                    │
       │                    │                    │  5. Play TwiML:    │
       │                    │                    │  "You have an      │
       │                    │                    │   incoming call"   │
       │                    │                    │──────────────────►│
       │                    │                    │                    │ (Agent hears
       │                    │                    │                    │  announcement)
       │                    │                    │  6. TwiML ends     │
       │                    │                    │  (call completes)  │
       │                    │                    │                    │
       │                    │                    │  7. Webhook:       │
       │                    │                    │  "completed"       │
       │                    │                    │◄───────────────────│
       │                    │                    │                    │
       │                    │  8. Transfer cmd   │                    │
       │  AI STOPS ─────────│◄───────────────────│                    │
       │                    │                    │                    │
       │  9. Customer transferred to Agent phone │                    │
       │─────────────────────────────────────────────────────────────►│
       │                    │                    │                    │
       │  10. Agent answers again, now connected │                    │
       │◄────────────────────────────────────────────────────────────►│
       │                                                              │
       │                    CUSTOMER ◄──► AGENT                       │
       │                    (Direct Connection)                       │
       │                                                              │
```

## Enhanced Flow (With AI Announcement)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ENHANCED WARM TRANSFER FLOW                                   │
│                    (AI announces before transfer)                                │
└─────────────────────────────────────────────────────────────────────────────────┘

TIMELINE ──────────────────────────────────────────────────────────────────────────►

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CUSTOMER   │     │   VAPI AI    │     │   OUR WORKER │     │    AGENT     │
│   (Caller)   │     │  Assistant   │     │   (Backend)  │     │   (Human)    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │                    │
       │  1. Talking to AI  │                    │                    │
       │◄──────────────────►│                    │                    │
       │                    │                    │                    │
       │                    │   2. Dashboard:    │                    │
       │                    │   "Warm Transfer"  │                    │
       │                    │                    │                    │
       │                    │                    │  3. Dial Agent     │
       │                    │                    │  via Twilio API    │
       │                    │                    │───────────────────►│
       │                    │                    │                    │
       │  Still talking     │                    │  4. Agent Answers  │
       │◄──────────────────►│                    │◄───────────────────│
       │                    │                    │                    │
       │                    │                    │  5. Play TwiML     │
       │                    │                    │  announcement      │
       │                    │                    │──────────────────►│
       │                    │                    │                    │
       │                    │                    │  6. TwiML ends     │
       │                    │                    │  Webhook received  │
       │                    │                    │◄───────────────────│
       │                    │                    │                    │
       │                    │ ┌────────────────┐ │                    │
       │                    │ │ 7. VAPI SAY    │ │                    │
       │◄───────────────────│◄┤ COMMAND:       │◄│                    │
       │                    │ │ "I have agent  │ │                    │
       │ (Customer hears:   │ │ on the line.   │ │                    │
       │  "I have an agent  │ │ Transferring   │ │                    │
       │   on the line...")│ │ in seconds..." │ │                    │
       │                    │ └────────────────┘ │                    │
       │                    │                    │                    │
       │                    │  8. Wait 3 sec     │                    │
       │                    │  (AI finishes)     │                    │
       │                    │                    │                    │
       │                    │  9. Transfer cmd   │                    │
       │  AI STOPS ─────────│◄───────────────────│                    │
       │                    │                    │                    │
       │  10. Customer transferred to Agent phone│                    │
       │────────────────────────────────────────────────────────────►│
       │                                                              │
       │  11. Agent answers, now connected                            │
       │◄────────────────────────────────────────────────────────────►│
       │                                                              │
```

## VAPI Control URL Commands

VAPI provides a `controlUrl` for each active call. We can send commands to control the AI:

```
┌─────────────────────────────────────────────────────────────────┐
│                    VAPI CONTROL URL                              │
│           POST https://api.vapi.ai/call/{callId}/control        │
└─────────────────────────────────────────────────────────────────┘

Available Commands:
┌─────────────┬────────────────────────────────────────────────────┐
│   Command   │                    Description                      │
├─────────────┼────────────────────────────────────────────────────┤
│   "say"     │  Make AI speak a specific message                  │
│             │  { "type": "say", "message": "Hello!" }            │
├─────────────┼────────────────────────────────────────────────────┤
│  "transfer" │  Transfer call to phone number                     │
│             │  { "type": "transfer",                             │
│             │    "destination": { "type": "number",              │
│             │                     "number": "+1234567890" }}     │
├─────────────┼────────────────────────────────────────────────────┤
│   "end"     │  End the call                                      │
│             │  { "type": "end" }                                 │
└─────────────┴────────────────────────────────────────────────────┘
```

## Sequence of API Calls (Enhanced Flow)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         API CALL SEQUENCE                                       │
└────────────────────────────────────────────────────────────────────────────────┘

Step 7-9 in detail:

    OUR WORKER                           VAPI API
        │                                   │
        │  POST /call/{id}/control          │
        │  { "type": "say",                 │
        │    "message": "I have an agent    │
        │    on the line. This call will    │
        │    be transferred in a few        │
        │    seconds." }                    │
        │──────────────────────────────────►│
        │                                   │
        │              200 OK               │
        │◄──────────────────────────────────│
        │                                   │
        │                                   │  AI speaks to customer
        │                                   │  (takes ~3-4 seconds)
        │                                   │
        │      [WAIT 3 SECONDS]             │
        │                                   │
        │  POST /call/{id}/control          │
        │  { "type": "transfer",            │
        │    "destination": {               │
        │      "type": "number",            │
        │      "number": "+16128085567"     │
        │    }                              │
        │  }                                │
        │──────────────────────────────────►│
        │                                   │
        │              200 OK               │
        │◄──────────────────────────────────│
        │                                   │
        │                                   │  VAPI transfers customer
        │                                   │  to agent's phone
        │                                   │
```

## Code Change Summary

Only one file needs to be modified:

**`workers/index.ts`** - In the webhook handler for `agent-call-status`:

```
CURRENT CODE (Step 7-9):
─────────────────────────
1. Receive "completed" webhook from Twilio
2. Send transfer command to VAPI
3. Done

NEW CODE (Step 7-9):
─────────────────────────
1. Receive "completed" webhook from Twilio
2. Send "say" command to VAPI ◄── NEW
3. Wait 3 seconds              ◄── NEW  
4. Send transfer command to VAPI
5. Done
```

