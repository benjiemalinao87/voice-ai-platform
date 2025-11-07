#!/bin/bash
# Test HubSpot integration by simulating a VAPI webhook call
# This will trigger the automatic token refresh and search logic

echo "Testing HubSpot integration with phone: +16263133690"
echo "This simulates what happens when VAPI sends a call webhook..."
echo ""

# You'll need to get your actual webhook ID and replace it below
# Run this query to get it:
# wrangler d1 execute voice-ai-dashboard --remote --command "SELECT id, user_id FROM vapi_webhooks LIMIT 1"

WEBHOOK_ID="YOUR_WEBHOOK_ID_HERE"

curl -X POST "https://api.voice-config.channelautomation.com/api/vapi/webhook/${WEBHOOK_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "type": "end-of-call-report",
      "call": {
        "id": "test-call-'$(date +%s)'",
        "customer": {
          "number": "+16263133690"
        },
        "startedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
        "endedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
      },
      "summary": "Test call to verify HubSpot integration and phone number matching",
      "recordingUrl": "https://example.com/test-recording.mp3",
      "transcript": "This is a test call transcript.",
      "messages": [],
      "analysis": {
        "summary": "Test call to verify HubSpot integration and phone number matching",
        "structuredData": {}
      },
      "artifact": {
        "recordingUrl": "https://example.com/test-recording.mp3"
      }
    }
  }'

echo ""
echo ""
echo "Check Cloudflare Workers logs with: wrangler tail --format pretty"
echo "Look for [HubSpot] log entries to see the search results"
