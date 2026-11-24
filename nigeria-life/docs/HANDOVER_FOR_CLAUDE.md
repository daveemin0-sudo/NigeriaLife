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

### Stage 4 — real interiors (`cursor/stage-4-real-interiors-181d`)

Audit order done for **hospitals → banks → hotels → restaurants → markets → homes** (place shells). Station ids and prices unchanged throughout.

| Slice | What shipped |
| --- | --- |
| Hospitals | Shared `teachingHospital()` — LASUTH, National Hospital Abuja, UPTH. Ward beds, doctor, pharmacy, `ceramic_white` on LASUTH |
| Banks | Shared `branchBank()` — Allen Avenue, town banks, richer CBN visitors centre; Allen `grey_granite` |
| Hotels | Grand lobby polish on Eko Grand + Transcorp; town **guest suites** now have a Builder bed/desk/wardrobe shell (Hotel FineFurniture may still layer) |
| Restaurants | Amala Shitta buka hall + Chop Express kitchen props |
| Markets | Balogun aisle atmosphere; Wuse + Mile 1 canopy stalls |
| Homes | Ikeja GRA estate office: waiting chairs, brochure rack, water cooler, second sales agent, property wall; player residence still Stage 3 beds/staff |

**Verified (desktop Chromium / SwiftShader / `--base=/NigeriaLife/` only — not phone hardware):** enter `interior_place_lasuth`, `interior_place_ikeja-gra`, `interior_residence`, `interior_place_abuja-town-suite`. Evidence: `cursor/evidence-stage-4` @ `d214afb`. PR [#60](https://github.com/daveemin0-sudo/NigeriaLife/pull/60). Merged into `cursor/integration-1` @ `850f588`.

**Stage 4 complete for PlaceSpec interiors in audit order.** Remaining polish is Stage 5 QA + outdoor gateman / open-air market shells.

## Open bugs / follow-ups

- Farwalk pace / walkers:0; phone nav below viewport; streetcar first-spot flake (pre-existing on `bf55dab`).
- Input suite flake: `the phone opens and its screen scrolls with the wheel` (`open:true, under:false, from:0,to:0`) — seen under SwiftShader; do **not** weaken; re-check on clean serve.
- 2 shared skins + meshopt IBM.
- 11 map-keke wrong-location places.
- Full 155-suite e2e vs baseline `bf55dab` still running / needs clean uninterrupted compare on integration tip.
- Gateman still not on outdoor `Compound.post` mesh.
- Markets/malls remain building shells (audit OPEN_AIR false positives).

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Exact next step

1. Finish clean full 155-suite e2e vs baseline on `cursor/integration-1` @ `850f588`; report every check that passed before and fails now.
2. Start **Stage 5 — QA everywhere** (arrival, collisions, cards, seats, beds, activities, exits, rides, saves across Lagos / Abuja / PH).
EOF