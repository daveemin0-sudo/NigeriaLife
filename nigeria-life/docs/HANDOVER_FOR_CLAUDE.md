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
| Aso Rock / Eagle Square / PH refinery | Dest + district bounds; Asokoro rock pocket before Maitama so boulevard land prices stay prime |
| Venue seat sweep | Regulars off tabletops/backrests (lounge, MMIA, golf, hospitals, Oshodi, NASS, airfield) |
| Town hotel lobby seats | Regulars on sofa occupy tops; furnishLobby registers sit surfaces |
| Wuse nightlife strip expanded | Hustle/Cubana/Play/Trukadero/Emab/City Park solid façades in Wuse (off Garki) |
| Wuse Market stand clear | Stand/dest moved to (−175, 178) off solid gate posts |
| Millennium/Pleasure/Brick House districts | New millennium_park district; d_line west to Pleasure Park; old_gra west so Brick House is Old GRA |
| Aso Rock lookout solid | Platform + granite foot solid at Shehu Shagari north end; dest at (0,−90) |
| Moscow / 345 / Mogadishu solids | Wuse nightlife façades + Asokoro cantonment walls; dests moved off empty Garki/maitama pins |
| Banex Plaza solid | Landmark sheds in Wuse (−190, 200); dest set-down on clear pavement (−190, 220) |
| Outdoor gateman | Musa at Banana Island Compound.post when hired + on duty (photo `gateman-at-post-390x844.png`) |
| Jibowu district | Dedicated `jibowu` bounds (mainland no longer swallows Yaba/CcHub) |
| CcHub | At (−12.5, −23.8) → **Yaba** (verified after mainland shrink) |
| Broad Street walkway | Stalls clear of footbridges; hospital + Mega Plaza pushed east; bins at kerb — `plan` **17/17** |
| Abuja/PH pins | Millennium/Wuse/Jabi PlaceSpec districts aligned; Wuse/Pleasure/Brick House dest coords matched to PlaceSpecs |
| Footbridge climb | Unstick no longer ejects climbers from stair step solids; **streets 17/17** (desktop Chromium) |
| Exit from inside | Unstick skipped for wall volumes so `Solids.step` can walk the player out of a building |
| Phonefit sleep × view-fab | Narrow phones: hide `#view-fab` while `#hud-proximity-prompt` is shown — **phonefit 7/7** at 320 |
| Open-air restroom chrome | Open-air PlaceSpecs mark `restroomAt.clear` (no back wall); The Library shelves leave east bay for toilet door — needs toilet-door check **PASS** |
| Home Party Jollof | Cook from cupboard when fridge empty (Hunger +60) — **needs 9/9** |

Evidence: `cursor/evidence-stage-5` @ `5dc7ce1` (desktop SwiftShader / `/NigeriaLife/` only — **not** phone hardware). Climb shots: `footbridge-climbing-390x844.png`, `footbridge-deck-390x844.png`.

Code tip this batch: `8e2178e`+. Integration: merge after each stage-5 push.

**ways suite note:** Broad Street pavement walk `y < 0.05` → `y < 0.35` (sidewalkTop); onPavement now 0.95 after walkway clear. **streets suite note:** two absolute `y < 0.05` checks were aligned to `y < 0.35` to match `sidewalkTop` (0.28) and the suite’s own east-stairs foot check (`y < 0.3`). Semantic checks (`!up`, stop before stairs, reach pavement) unchanged — not a climb/side weaken.

## Open bugs / follow-ups

- Farwalk pace / walkers:0; phone nav below viewport; streetcar first-spot flake (pre-existing on `bf55dab`).
- Input suite flake: phone wheel-scroll (`open:true, under:false`) under SwiftShader — do **not** weaken.
- 2 shared skins + meshopt IBM.
- Remaining WORLD_AUDIT walk-through / broken-activity chrome; more map pins as found.
- Full 155-suite e2e vs `bf55dab` on **current tip** (prior run used stale frozen serve).
- Outdoor gateman: photo at Banana Island gatehouse (gateman-at-post-390x844.png) — desktop only.
- Markets/malls still building shells (audit OPEN_AIR false positives).
- Venue seat sweep: regulars moved onto chairs/benches (tabletop sits fixed).

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Tip e2e vs baseline (in progress)

`full-tip.log` on **stale** serve `/tmp/nl-e2e-serve` @ `54a383a` (Stage 4 markets — **not** current tip). ~122/155 when last checked; still running. Phonefit sleep×fab FAIL on that log is fixed on stage-5 (`8e2178e`). Many unique FAILs are ENOENT screenshot paths (`C:/Users/User/.gemini/...`) or flaky timeouts — filter those before comparing to `bf55dab`.

| Check | Tip (stale serve) | Alone on stage-5 / notes |
| --- | --- | --- |
| Footbridge climb | **PASS** | Was FAIL before climb fix |
| streets suite | aborted after climb (HMR) | Alone: **17/17** |
| seats fountain onAir | FAIL (stale) | Alone: **5/5** (benches + occupy) |
| phonefit sleep × fab | FAIL (stale) | Alone: **7/7** at 320 |
| needs toilet doors | FAIL (open-air + Library) | Toilet-door check **PASS** after openAir + Library bay |
| ways Broad Street y | fixed earlier | Alone: **ways 20/20** |


## Exact next step

1. Finish stale tip e2e; then FAIL-vs-baseline into this file (strip ENOENT / phonefit noise).
2. Optionally re-run full 155 on **current** integration tip if time remains.
3. Continue WORLD_AUDIT P2 chrome / unvisited town interiors.
4. Do **not** merge to main or deploy.

