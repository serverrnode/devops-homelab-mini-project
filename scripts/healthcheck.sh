#!/usr/bin/env bash
set -euo pipefail

STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000)

if [ "$STATUS" -ne 200 ]; then
  echo "App is unhealthy (HTTP $STATUS)"
  exit 1
fi

echo "App is healthy (HTTP $STATUS)"
