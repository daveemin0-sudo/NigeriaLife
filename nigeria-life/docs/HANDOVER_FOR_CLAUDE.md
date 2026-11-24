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

Evidence: `cursor/evidence-stage-3` @ `43a21a7`. PR [#59](https://github.com/daveemin0-sudo/NigeriaLife/pull/59). Merged into `cursor/integration-1`. CI green.

### Stage 4 — real interiors (`cursor/stage-4-real-interiors-181d` @ `4d4ee77`)

Audit order done for **hospitals → banks → hotels → restaurants → markets → homes**. Station ids and prices unchanged.

| Slice | What shipped |
| --- | --- |
| Hospitals | Shared `teachingHospital()` — LASUTH, National Hospital Abuja, UPTH |
| Banks | Shared `branchBank()` — Allen Avenue, town banks, richer CBN |
| Hotels | Grand lobbies + town guest suite Builder shells |
| Restaurants | Amala Shitta + Chop Express kitchen props |
| Markets | Balogun / Wuse / Mile 1 stalls |
| Homes | Ikeja GRA estate office polish; residence still Stage 3 beds/staff |

Evidence: `cursor/evidence-stage-4` @ `d214afb`. PR [#60](https://github.com/daveemin0-sudo/NigeriaLife/pull/60). Merged into `cursor/integration-1` @ `850f588` / `14a66d5`.

### Stage 5 — QA everywhere (in progress) (`cursor/stage-5-qa-everywhere-181d`)

PR [#61](https://github.com/daveemin0-sudo/NigeriaLife/pull/61). Merged into `cursor/integration-1` as each batch lands.

| Fix | Detail |
| --- | --- |
| Jibowu P0 wrong location | Mainland bounds cover motor park (~92.5, −70) → **Mainland Central** (verified) |
| Mama Put P0 wrong location | Yaba maxZ −16 so Broad Street south stays **Lagos Island** (verified) |
| District fallback | Nearest-centre only within 80 m |
| Outdoor gateman | `HomeStaff.syncStreetGateman` on `Compound.post` for plotted homes |
| Jibowu district | Dedicated `jibowu` bounds (mainland no longer swallows Yaba/CcHub) |
| CcHub | At (−12.5, −23.8) → **Yaba** (verified after mainland shrink) |
| Broad Street walkway | Stalls clear of footbridges; hospital + Mega Plaza pushed east; bins at kerb — `plan` **17/17** |
| Abuja/PH pins | Millennium/Wuse/Jabi PlaceSpec districts aligned; Wuse/Pleasure/Brick House dest coords matched to PlaceSpecs |
| Footbridge climb | Unstick no longer ejects climbers from stair step solids; **streets 17/17** (desktop Chromium) |
| Exit from inside | Unstick skipped for wall volumes so `Solids.step` can walk the player out of a building |

Evidence: `cursor/evidence-stage-5` (desktop SwiftShader / `/NigeriaLife/` only — **not** phone hardware). Climb shots: `footbridge-climbing-390x844.png`, `footbridge-deck-390x844.png`.

**streets suite note:** two absolute `y < 0.05` checks were aligned to `y < 0.35` to match `sidewalkTop` (0.28) and the suite’s own east-stairs foot check (`y < 0.3`). Semantic checks (`!up`, stop before stairs, reach pavement) unchanged — not a climb/side weaken.

## Open bugs / follow-ups

- Farwalk pace / walkers:0; phone nav below viewport; streetcar first-spot flake (pre-existing on `bf55dab`).
- Input suite flake: phone wheel-scroll (`open:true, under:false`) under SwiftShader — do **not** weaken.
- 2 shared skins + meshopt IBM.
- Remaining WORLD_AUDIT chrome (Aso Rock / Eagle Square / PH refinery) and map pins.
- Full 155-suite e2e vs `bf55dab` on **current tip** (prior run used stale frozen serve).
- Outdoor gateman visual smoke still pending (code wired; no photo yet).
- Markets/malls still building shells (audit OPEN_AIR false positives).
- Full venue seat sweep still open.

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Exact next step

1. Restart clean full 155-suite e2e on Stage 5 / integration tip; compare to `bf55dab` one suite at a time.
2. Smoke outdoor gateman + remaining WORLD_AUDIT P0 chrome; push evidence.
3. Continue seat/activity/arrival QA across three cities.
