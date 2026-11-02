#!/usr/bin/env bash
# Boot the dev servers agents need. Safe to run more than once.
# Nigeria Life's browser tests expect the game on port 5174.
set -euo pipefail

NL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

port_open() {
  bash -c "echo >/dev/tcp/127.0.0.1/$1" >/dev/null 2>&1
}

ensure_session() {
  local name="$1" dir="$2" cmd="$3" port="$4"
  if port_open "$port"; then
    echo "$name already listening on port $port"
    return 0
  fi
  if tmux has-session -t "$name" 2>/dev/null; then
    tmux kill-session -t "$name"
  fi
  tmux new-session -d -s "$name" -c "$dir" "$cmd"
  echo "started tmux session $name"
}

wait_http() {
  local url="$1" name="$2" log="$3"
  local i
  for i in $(seq 1 60); do
    if curl -sf -o /dev/null --max-time 2 "$url"; then
      echo "$name ready at $url"
      return 0
    fi
    sleep 1
  done
  echo "$name did not become ready at $url" >&2
  if [ -f "$log" ]; then
    echo "---- $log ----" >&2
    tail -n 80 "$log" >&2 || true
  fi
  return 1
}

ensure_session \
  nigeria-life \
  "$NL_ROOT/nigeria-life" \
  "npm run dev -- --host 0.0.0.0 --port 5174 --strictPort > /tmp/nigeria-life.log 2>&1" \
  5174

MM=""
for candidate in "$NL_ROOT/../matchmaker" "$NL_ROOT/../../matchmaker"; do
  if [ -f "$candidate/package.json" ] && [ -f "$candidate/webhook-server/index.js" ]; then
    MM="$(cd "$candidate" && pwd)"
    break
  fi
done

if [ -n "$MM" ]; then
  ensure_session \
    matchmaker \
    "$MM" \
    "npx --no-install live-server --port=5500 --host=0.0.0.0 --no-browser --quiet > /tmp/matchmaker.log 2>&1" \
    5500
  ensure_session \
    hookmebysam-api \
    "$MM" \
    "npm run server > /tmp/hookmebysam-api.log 2>&1" \
    3001
fi

wait_http "http://127.0.0.1:5174/" "Nigeria Life" /tmp/nigeria-life.log
if [ -n "$MM" ]; then
  wait_http "http://127.0.0.1:5500/" "matchmaker" /tmp/matchmaker.log
  wait_http "http://127.0.0.1:3001/" "hookmebysam API" /tmp/hookmebysam-api.log
fi
