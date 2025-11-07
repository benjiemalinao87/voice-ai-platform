#!/bin/bash
# Direct test to see what HubSpot returns for the search

echo "=== Testing with 11 digits (16263133690) ==="
TOKEN="CJW46d2lMxIRQlNQMl8kQEwrAgQACAkWEgcYhLHEcyDn77olKPyInAsyFKntdWJ-ve8qn5nBFNwoz53wWh9pOhlCU1AyXyRATCsCDAAIGQZxTiAQAQEBZAWCQhRHn4NwWMAjJCHvonoHPWcU9ioYo0oDbmEyUgBaAGAAaOfvuiVwAHgA"

curl -s -X POST 'https://api.hubapi.com/crm/v3/objects/contacts/search' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "filterGroups": [
      {
        "filters": [
          {
            "propertyName": "phone",
            "operator": "CONTAINS_TOKEN",
            "value": "16263133690"
          }
        ]
      }
    ],
    "properties": ["phone", "mobilephone", "firstname", "lastname", "email"],
    "limit": 10
  }' | jq '.'

echo -e "\n\n=== Testing with 10 digits (6263133690) ==="
curl -s -X POST 'https://api.hubapi.com/crm/v3/objects/contacts/search' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
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
    "properties": ["phone", "mobilephone", "firstname", "lastname", "email"],
    "limit": 10
  }' | jq '.'

echo -e "\n\n=== Testing with partial (626313) ==="
curl -s -X POST 'https://api.hubapi.com/crm/v3/objects/contacts/search' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
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
    "properties": ["phone", "mobilephone", "firstname", "lastname", "email"],
    "limit": 10
  }' | jq '.'
