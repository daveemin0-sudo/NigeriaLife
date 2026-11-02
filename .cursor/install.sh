#!/usr/bin/env bash
# Idempotent dependency install for the Nigeria Life multi-repo environment.
# Nigeria Life is this repository. matchmaker is checked out beside it.
set -euo pipefail

NL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Installing Nigeria Life dependencies ($NL_ROOT/nigeria-life)"
npm ci --prefix "$NL_ROOT/nigeria-life"

MM=""
for candidate in "$NL_ROOT/../matchmaker" "$NL_ROOT/../../matchmaker"; do
  if [ -f "$candidate/package-lock.json" ] && [ -f "$candidate/webhook-server/package-lock.json" ]; then
    MM="$(cd "$candidate" && pwd)"
    break
  fi
done

if [ -z "$MM" ]; then
  echo "matchmaker checkout not found beside NigeriaLife; skipping its install."
  exit 0
fi

echo "Installing matchmaker app dependencies ($MM)"
npm ci --prefix "$MM"
echo "Installing hookmebysam webhook dependencies ($MM/webhook-server)"
npm ci --prefix "$MM/webhook-server"
