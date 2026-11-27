#!/usr/bin/env bash
# Re-compress character GLBs with scene-wide quantization so meshopt keeps
# exactly 2 shared skins (65 + 73 joints). Do NOT merge skins after meshopt.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IN_M="${1:-$ROOT/public/models/characters/human_male.glb}"
IN_F="${2:-$ROOT/public/models/characters/human_female.glb}"
# Prefer pre-meshopt sources if provided as env
SRC_M="${SRC_MALE:-$IN_M}"
SRC_F="${SRC_FEMALE:-$IN_F}"
npx --yes @gltf-transform/cli meshopt "$SRC_M" "$IN_M" --quantization-volume scene --level high
npx --yes @gltf-transform/cli meshopt "$SRC_F" "$IN_F" --quantization-volume scene --level high
echo "Wrote $IN_M and $IN_F"
