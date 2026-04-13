#!/bin/bash
RAILWAY_TOKEN=$(python3 -c "import json; print(json.load(open('/Users/apple/.railway/config.json'))['user']['token'])")

# Try to connect service to GitHub repo
curl -sS --max-time 15 -X POST "https://backboard.railway.com/graphql/v2" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${RAILWAY_TOKEN}" \
  -d '{"query":"mutation { serviceConnect(id: \"df9fa30f-1b1b-4260-b36d-098b5a1d52a1\", input: { repo: \"Vithaluntold2/RAICA1\", branch: \"main\" }) { id name } }"}'
echo ""
