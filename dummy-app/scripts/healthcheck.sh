#!/usr/bin/env bash
set -euo pipefail

URL="http://127.0.0.1:5000"
TRIES=30
SLEEP=1

for i in $(seq 1 "$TRIES"); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || true)

  if [ "$STATUS" = "200" ]; then
    echo "App is healthy (HTTP $STATUS)"
    exit 0
  fi

  echo "Waiting for app... attempt $i/$TRIES (got HTTP ${STATUS:-none})"
  sleep "$SLEEP"
done

echo "App did not become healthy in time"
exit 1
