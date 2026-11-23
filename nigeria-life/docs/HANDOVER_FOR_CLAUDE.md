# Handover for Claude Code — return Thu 26 Nov 2026, 18:00 Africa/Lagos

Lead builder until then: Cursor cloud agent. Do **not** merge to `main`, do **not** deploy, do **not** push to `feature/type-any-amount`.

## Finished

### Stage 0 — corrections (`cursor/stage-0-corrections` @ `8609aac`)

Merged into this workstream from tips newer than the brief:

| Branch | Tip used | Notes |
| --- | --- | --- |
| `cursor/solid-world` | `44917da` | Honest solidworld + crowd props |
| `cursor/all-phones` | `115fca8` then **reverted broken 2-skin GLBs** | Meshopt kept; skin merge unsafe |
| `cursor/phone-cards-ride-drop` | `7c9113d` | + HUD row fixes |

**Evidence:** `cursor/evidence-stage-0` @ `f229409` → `evidence/stage-0/REPORT.md` (+ phone-size shots).

**Tests (Chromium / SwiftShader, `GAME_URL=…/NigeriaLife/`):**

- `solidworld` 41/41 (×3)
- `allphones` 43/43 — Very Low Broad Street 136 draws / 77.7k tris

**Decisions**

1. **Vehicle GLBs:** do not request missing `models/vehicles/*.glb`; procedural look unchanged (`DrivableVehicle`).
2. **Character skins:** ship meshopt GLBs with **101 / 95** skins. Collapsing to 2 skins *after* quantize reuses wrong IBMs (deltas up to ~1.65) and explodes meshes. See `tools/characters/merge_shared_skins.mjs`. True 2-skin + meshopt needs a compression path that never partitions skins.
3. **`life.ts`:** all-phones GRAPHICS_NOTES edit already reverted; no remaining diff vs base.
4. **HUD:** quest/place on one row; today + street chat on the next; landscape radar/toasts separated.

**Unverified on device:** any physical phone, Safari, Firefox. Only Chromium + SwiftShader here.

### Stage 1 — integration (in progress)

- Branch `cursor/integration-1` created from `bf55dab`.
- Next: merge keke (`7f36a3d`), seated-car-legs (`3dbe1d8`), stage-0; keep every suite in `tests/e2e/run.mjs`; full regression vs previous integration commit; fix audit false “wrong location” on test teleports; ranked defect list.

## Open bugs / follow-ups

- 2 shared skins + meshopt without IBM corruption.
- Expressway location chrome still says “Third Mainland…” at Dangote z≈3500.
- Map filter pills intentionally scroll off-edge on very narrow phones (`phonefit` scroller pattern).
- `cursor/solid-world` @ `814ef3a` was **not** approved; later commits + stage-0 hardenings supersede it.

## Performance (Very Low, allphones)

- Draws 136 / tris 77,695 / shadows off for session.

## Exact next step

1. Finish Stage 1 merge (keke + legs + stage-0) on `cursor/integration-1`.
2. Full `npm run test:e2e` regression; compare suite-by-suite to baseline tip before this merge.
3. Rerun world audit on the integration build; produce ranked real defects (ignore inflated teleport false positives).
4. Then Stage 2 — Elegushi Beach open place.
EOF