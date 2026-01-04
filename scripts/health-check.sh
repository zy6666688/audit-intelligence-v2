#!/usr/bin/env bash
set -euo pipefail
BASE=http://localhost:8001
curl -fsS "$BASE/" >/dev/null || { echo "root failed"; exit 1; }
TOKEN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/x-www-form-urlencoded' -d "username=admin&password=0000" | jq -r '.access_token')
[ "$TOKEN" != "null" ] || { echo "auth failed"; exit 1; }
curl -fsS -H "Authorization: Bearer $TOKEN" "$BASE/auth/me" >/dev/null || { echo "me failed"; exit 1; }
echo "OK"
