#!/bin/bash
# Test HubSpot Contact Search with different phone formats
# Usage: ./test-hubspot-search.sh YOUR_ACCESS_TOKEN

if [ -z "$1" ]; then
  echo "Usage: ./test-hubspot-search.sh YOUR_ACCESS_TOKEN"
  exit 1
fi

ACCESS_TOKEN="$1"

echo "=== Test 1: Search with digits only (6263133690) ==="
curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
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
      }
    ],
    "properties": ["phone", "firstname", "lastname", "email"],
    "limit": 10
  }'

echo -e "\n\n=== Test 2: Search with partial number (626313) ==="
curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [
      {
        "filters": [
          {
            "propertyName": "phone",
            "operator": "CONTAINS_TOKEN",
            "value": "626313"
          }
        ]
      }
    ],
    "properties": ["phone", "firstname", "lastname", "email"],
    "limit": 10
  }'

echo -e "\n\n=== Test 3: Search with EQ operator and formatted number ==="
curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [
      {
        "filters": [
          {
            "propertyName": "phone",
            "operator": "EQ",
            "value": "+1 (626) 313-3690"
          }
        ]
      }
    ],
    "properties": ["phone", "firstname", "lastname", "email"],
    "limit": 10
  }'

echo -e "\n\n=== Test 4: Search both phone and mobilephone ==="
curl -X POST https://api.hubapi.com/crm/v3/objects/contacts/search \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
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

echo -e "\n\nDone!"
