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

### Stage 3 — home life (`cursor/stage-3-home-life-181d` @ `2ec8e3d`)

| Area | Done |
| --- | --- |
| Beds | Grand / presidential / foam mattress expose named `bed duvet`; sleeper cover sync |
| Seats | Dining sit on side chairs (`x: 0.74`), not the tabletop |
| Staff | Duty hours; arrive/leave toasts; gateman outside entrance; driver by carport |
| Repairs | `HomeRepairs` + Staff phone tab — pay at hand-over |

Evidence: `cursor/evidence-stage-3` @ `43a21a7`. PR [#59](https://github.com/daveemin0-sudo/NigeriaLife/pull/59). Merged into `cursor/integration-1`. CI green. **Still open:** full venue seat sweep; gateman on outdoor `Compound.post`.

### Stage 4 — real interiors (started) (`cursor/stage-4-real-interiors-181d` @ `63f9a7a`)

**LASUTH first** + shared teaching-hospital floor for National Hospital Abuja and UPTH:

- Waiting benches, triage counter, consult desk with **doctor**, pharmacy (shelf + cross), ward beds with mattress/sheet/pillow/IV/monitor/curtains
- Room 22×20, `ceramic_white` floor on LASUTH
- Station ids/prices unchanged (`clinic` / `pharmacy` / `ward`)
- Nursing shift tasks re-aimed at new bed/chart coords

**Verified:** Chromium enter `interior_place_lasuth`; doctor present; finish ceramic; shiftskill + insides + workplaces **24/24**.  
Evidence: `cursor/evidence-stage-4` @ `68c3801`. Desktop SwiftShader only — **not** phone hardware.

**Banks (this tip):** shared `branchBank()` hall — teller glass, queue rope, ATM bay, manager desk, security gate. Applied to Allen Avenue Eko bank, town banks (Abuja/PH), plus a richer CBN visitors centre. Allen finish `grey_granite`. Stations/prices unchanged.

**Hotels:** shared  on Eko Grand and Transcorp Hilton — reception screens, chandelier, lounge, pool loungers, lift bay, luggage, porters. Station ids/prices unchanged.

**Restaurants:** richer Amala Shitta buka hall + Chop Express kitchen (menu, cooler, fryer, ice cream freezer). Prices/station ids unchanged.

**Not done yet in Stage 4:** markets, homes interiors.

## Open bugs / follow-ups

- Farwalk pace / walkers:0; phone nav below viewport; streetcar first-spot flake (pre-existing).
- 2 shared skins + meshopt IBM.
- 11 map-keke wrong-location places.
- Full 155-suite e2e vs baseline `bf55dab` still needs a clean uninterrupted run on integration tip (prior runs HMR-contaminated or cut short).
- Gateman still not on outdoor `Compound.post` mesh.
- Markets/malls remain building shells (audit OPEN_AIR false positives).

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Exact next step

1. Merge Stage 4 tip into `cursor/integration-1`; restart clean full e2e; log suite-by-suite vs baseline.
2. Continue Stage 4 audit order after hospitals: banks → hotels → restaurants → markets → homes.
3. Then Stage 5 — QA everywhere.
EOF