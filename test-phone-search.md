# Testing HubSpot Phone Search

## What Changed

The phone search now:
1. **Searches both fields**: `phone` AND `mobilephone`
2. **Gets multiple results**: Fetches top 10 matches instead of just 1
3. **Fuzzy matching**: Checks if any contact's phone contains the search digits
4. **Fallback strategy**: If no match, tries last 10 digits (for US numbers)
5. **Better logging**: Console logs show exactly what's being searched

## The Problem

Your contact has phone: `+1 (626) 313-3690`

The old code:
- Searched for: `6263133690` (digits only)
- Used `CONTAINS_TOKEN` operator
- Only returned 1 result
- Didn't check `mobilephone` field separately

## The Solution

New code:
- Searches both `phone` AND `mobilephone` fields (OR logic via filterGroups)
- Gets 10 results and checks each one for digit matches
- Handles country code variations (+1 vs no +1)
- Logs everything for debugging

## How to Test

### Option 1: Through your webhook endpoint

When a call comes in, check the Cloudflare Workers logs to see:
```
[HubSpot] Searching for phone: +1 (626) 313-3690 | Digits: 16263133690
[HubSpot] Found 3 potential matches
[HubSpot] Checking contact: 12345 | Phone: +1 (626) 313-3690 | Mobile:
[HubSpot] Found matching contact: 12345
```

### Option 2: Direct API test with curl

Run the test script:
```bash
./test-hubspot-search.sh YOUR_HUBSPOT_ACCESS_TOKEN
```

Replace `YOUR_HUBSPOT_ACCESS_TOKEN` with your actual HubSpot OAuth access token from the database.

### Option 3: Get access token and test manually

```bash
# 1. Get access token from your database
wrangler d1 execute voice-ai-dashboard --command \
  "SELECT access_token FROM hubspot_oauth_tokens WHERE user_id = 'YOUR_USER_ID' LIMIT 1"

# 2. Test the exact search that will happen
curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [
      {
        "filters": [
          {
            "propertyName": "phone",
            "operator": "CONTAINS_TOKEN",
            "value": "6263133690"
          }
        ]
      },
      {
        "filters": [
          {
            "propertyName": "mobilephone",
            "operator": "CONTAINS_TOKEN",
            "value": "6263133690"
          }
        ]
      }
    ],
    "properties": ["phone", "mobilephone", "firstname", "lastname", "email"],
    "limit": 10
  }'
```

## Debugging

Check Cloudflare Workers logs:
```bash
wrangler tail --format pretty
```

Then trigger a call or webhook and watch the logs for `[HubSpot]` messages.

## Next Steps

1. Deploy is complete ✓
2. Test with a real call
3. Check the logs to confirm it finds the contact
4. If still not working, we can adjust the search strategy further
