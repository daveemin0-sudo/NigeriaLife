# Handover for Claude Code — return Thu 26 Nov 2026, 18:00 Africa/Lagos

Lead builder until then: Cursor cloud agent. Do **not** merge to `main`, do **not** deploy, do **not** push to `feature/type-any-amount`.

## Finished

### Stage 0 — corrections (`cursor/stage-0-corrections` @ `8609aac`)

Evidence: `cursor/evidence-stage-0` @ `f229409`. solidworld 41/41; allphones 43/43. Ship 101/95 meshopt skins (2-skin unsafe).

### Stage 1 — integration (`cursor/integration-1`)

Draft PR [#57](https://github.com/daveemin0-sudo/NigeriaLife/pull/57) / [#56](https://github.com/daveemin0-sudo/NigeriaLife/pull/56) → `feature/type-any-amount`. Audit teleport ≠ wrong location. Baseline compare: no clean pass→fail.

### Stage 2 — open places (`cursor/stage-2-open-places-181d` @ `e72cb16`)

Enterable open-air (no room shell): Elegushi Beach, Freedom Park, Lekki Conservation, Ikeja Golf, Millennium Park, Jabi Lake Park, Pleasure Park.

Evidence: `cursor/evidence-stage-2` @ `ec0ea3e` (desktop Chromium / SwiftShader / `/NigeriaLife/` only — **not** phone hardware).

PR [#58](https://github.com/daveemin0-sudo/NigeriaLife/pull/58). Merged into `cursor/integration-1`.

### Stage 3 — home life (in progress) (`cursor/stage-3-home-life-181d`)

| Area | Done |
| --- | --- |
| Beds | Grand / presidential / foam mattress now expose named `bed duvet` for sleeper cover sync; expensive beds keep tall padded / winged headboards |
| Seats | Dining table sit points moved onto side chairs (`x: 0.74`), not the tabletop |
| Staff | Duty hours (cook 6:30–15, cleaner 8–16, driver 7–21, gateman always); arrive/leave toasts; gateman stands **outside** the entrance; driver by carport |
| Repairs | `HomeRepairs` + Staff phone tab: electrician / AC / plumber / appliance — arrive, work, pay at hand-over, leave |

**Evidence:** `cursor/evidence-stage-3` @ `9c27e0f` → `evidence/stage-3/REPORT.md`.

**Verified in Chromium (desktop):** named bed duvets in residence; dining seat x=0.74; duty on at 12:00 / cook+driver off at 22:00; electrician call arrives.

**Not yet verified:** sleep under duvet on presidential bed (visual); every venue seat; gateman on outdoor Compound.post.

## Open bugs / follow-ups

- Farwalk pace / walkers:0; phone nav below viewport; streetcar first-spot flake (pre-existing).
- 2 shared skins + meshopt IBM.
- 11 map-keke wrong-location places.
- Full e2e re-run needed on clean vite (prior run HMR-contaminated mid Stage 2/3 edits).
- Gateman still in home interior space (street-side of door), not yet the outdoor `Compound.post` mesh — Stage 5 polish if compound plot available.
- Markets/malls remain building shells (audit OPEN_AIR false positives).

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Exact next step

1. Finish Stage 3 browser smoke (beds/seats/staff/repairs); push evidence; merge to `cursor/integration-1`.
2. Clean full e2e + live worldaudit on integration.
3. Stage 4 — real interiors starting with LASUTH.
EOF