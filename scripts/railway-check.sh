#!/bin/bash
RAILWAY_TOKEN=$(python3 -c "import json; print(json.load(open('/Users/apple/.railway/config.json'))['user']['token'])")
echo "Token: ${RAILWAY_TOKEN:0:10}..."

curl -sS --max-time 15 -X POST "https://backboard.railway.com/graphql/v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
  -d '{"query":"query { service(id: \"df9fa30f-1b1b-4260-b36d-098b5a1d52a1\") { name source { repo branch } } }"}'
echo ""
