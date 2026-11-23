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

| Branch | Tip | Role |
| --- | --- | --- |
| `cursor/integration-1` | `de0884f` (pre–world-audit) | Integration line from `bf55dab` |
| `cursor/stage-1-integrate-181d` | `df99fa2` | Stage 1 work: worldaudit + teleport fix |
| PR | [#57](https://github.com/daveemin0-sudo/NigeriaLife/pull/57) → `feature/type-any-amount` (draft; **do not merge to main**) |

**Merged into Stage 1 / integration:**

| Source | Tip | Status |
| --- | --- | --- |
| `cursor/keke-okada-models` | `7f36a3d` | Merged |
| `cursor/seated-car-legs` | `3dbe1d8` | Merged (`ridelegs` suite kept) |
| Stage 0 corrections | `8609aac` | Merged |
| `cursor/world-audit` | `cfa80ff` | Merged; classifier fixed |

**Suites kept in `tests/e2e/run.mjs`:** all prior + `solidworld`, `allphones`, `ridelegs`, `worldaudit` (156 total).

**Audit teleport false positive — fixed**

- Teleport fallbacks are tooling when a map pin is missing.
- They are **not** scored as wrong location (including booked-vs-shown district after teleport).
- Wrong location only on map/door arrivals with `districtMatch === false`.
- Reprocess: `AUDIT_REPROCESS=1 node tests/e2e/worldaudit.mjs`

| Metric | Old (`cfa80ff`) | Reprocessed |
| --- | --- | --- |
| Defect instances | 337 | 190 |
| P0 | 198 | 51 |
| wrong location | 158 | **11** (all `map-keke`) |
| UI overlap | 89 | 89 |
| broken activity | 74 | 74 |
| open place as building | 8 | 8 |

**Ranked real defects (top open-air / Stage 2 targets):** see `docs/audit/WORLD_AUDIT.md`. Highlights:

1. Aso Rock — wrong location + walk-through + broken activity
2. Moscow Underground VIP — UI + walk-through
3. Jibowu / CcHub / PH Refinery — map-keke wrong location
4. **Elegushi Beach** — open place shown as building (room shell) + UI + walk-through
5. Freedom Park, Lekki Conservation, Jabi Lake Mall, Balogun, Mile 1, Wuse Market — open air as building shell

**Regression (Chromium / SwiftShader, `GAME_URL=http://127.0.0.1:5173/NigeriaLife/`):**

- Priority batch running: `ridelegs` **PASS** (taxi + own car, draws ≤120); `solidworld` in progress; then allphones, anyamount, farwalk, ridepickup, streetcar, rides, phonefit, seats.
- Full suite + baseline suite-by-suite compare vs `bf55dab` still pending.
- Live worldaudit re-visit on this build still pending (reprocess used prior visit photos).

## Open bugs / follow-ups

- 2 shared skins + meshopt without IBM corruption.
- Expressway location chrome still says “Third Mainland…” at Dangote z≈3500.
- Map filter pills intentionally scroll off-edge on very narrow phones (`phonefit` scroller pattern).
- `cursor/solid-world` @ `814ef3a` was **not** approved; later commits + stage-0 hardenings supersede it.
- 11 real map-keke wrong-location places (district chrome after ride).
- Open-air places still use `InteriorPrefabs.createRoom` shells — Stage 2.

## Performance (Very Low, allphones)

- Draws 136 / tris 77,695 / shadows off for session (Stage 0).
- ridelegs taxi: 120 draws; own car: 117 draws (under 220).

## Exact next step

1. Finish priority + full e2e on `cursor/stage-1-integrate-181d`; compare failures to `bf55dab` worktree `/tmp/nl-baseline`.
2. Merge Stage 1 into `cursor/integration-1`; update this file with suite results.
3. Optional: live `worldaudit` sample on integration build (`AUDIT_LIMIT`).
4. Stage 2 — Elegushi Beach as true open world (no room shell), then Freedom Park, LCC, Jabi Lake, other OPEN_AIR.
EOF
