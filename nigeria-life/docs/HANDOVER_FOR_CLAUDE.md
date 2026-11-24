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

### Stage 5 — QA everywhere (started) (`cursor/stage-5-qa-everywhere-181d` @ `8eb3e26`)

PR [#61](https://github.com/daveemin0-sudo/NigeriaLife/pull/61). Merged into `cursor/integration-1` @ `fe4c671`.

| Fix | Detail |
| --- | --- |
| Jibowu P0 wrong location | Mainland bounds cover motor park (~92.5, −70) → **Mainland Central** (verified) |
| Mama Put P0 wrong location | Yaba maxZ −16 so Broad Street south stays **Lagos Island** (verified) |
| District fallback | Nearest-centre only within 80 m |
| Outdoor gateman | `HomeStaff.syncStreetGateman` on `Compound.post` for plotted homes |

Evidence: `cursor/evidence-stage-5` @ `4fa49dc` (desktop SwiftShader only).

## Open bugs / follow-ups

- Farwalk pace / walkers:0; phone nav below viewport; streetcar first-spot flake (pre-existing on `bf55dab`).
- Input suite flake: phone wheel-scroll (`open:true, under:false`) under SwiftShader — do **not** weaken.
- 2 shared skins + meshopt IBM.
- Remaining map-keke wrong-location pins (Abuja / Port Harcourt from WORLD_AUDIT).
- Full 155-suite e2e vs baseline still needs a clean uninterrupted compare.
- Outdoor gateman visual smoke still pending (code wired; no photo yet).
- Markets/malls still building shells (audit OPEN_AIR false positives).
- Full venue seat sweep still open.

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Exact next step

1. Smoke outdoor gateman + district labels at Jibowu / Mama Put; push `cursor/evidence-stage-5`.
2. Fix remaining P0 wrong-location pins (Abuja/PH); continue seat/activity/arrival QA.
3. Finish clean full 155-suite e2e vs `bf55dab`; report every check that passed before and fails now.
4. Merge Stage 5 into `cursor/integration-1` when the first QA batch is verified.
