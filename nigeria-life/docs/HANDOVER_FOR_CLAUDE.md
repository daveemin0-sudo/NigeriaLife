# Handover for Claude Code — return Thu 26 Nov 2026, 18:00 Africa/Lagos

Lead builder until then: Cursor cloud agent. Do **not** merge to `main`, do **not** deploy, do **not** push to `feature/type-any-amount`.

## Finished

### Stage 0 — corrections (`cursor/stage-0-corrections` @ `8609aac`)

Evidence: `cursor/evidence-stage-0` @ `f229409`. solidworld 41/41; allphones 43/43. Ship 101/95 meshopt skins (2-skin unsafe).

### Stage 0C — cards & HUD (owner iPhone) (`cursor/stage-0c-hud-181d`)

| Fix | Detail |
| --- | --- |
| Watching card | Two-row layout: icon+title+Stand on row 1; Football / News / Music / Off chips on row 2; short title `Watching · Football`; right inset clears music/camera FABs |
| Dynamic Island | `SafeInsets` floors `--nl-inset-top` at **47px** on narrow touch phones when `env(safe-area)` is 0; phone.css top chrome uses `var(--nl-inset-top)` |
| Location pill | `shortHudPlace()` — drops Gated / N-Bed / (rented); e.g. `Lekki Phase 1 Duplex`; full name in `title` |
| Money ₦0 | Was **display**, not empty wealth: HUD showed `walletCash` only. Now shows **cash+bank** (title splits Cash · Bank). Confirmed: wallet 0 + bank 1.25m → `₦1,250,000` |

Automated: `tests/e2e/hudphone.mjs` **6/6**. Evidence: `/opt/cursor/artifacts/hud-evidence/` (`before-watching-hud.png`, `watching-card.png`, `top-hud.png`).

### Stage 0D / 1 — street clear + night light (owner iPhone) (`cursor/stage-0d-street-181d`)

| Fix | Detail |
| --- | --- |
| Zebra / lanes / doorways | `blocksCrossing()` clears stalls, bins, fabric lamps of Broad zebra (z=10) + Martins (z=-62); Roads stall list drops z=12/−62 → 42/−55; Abuja/PH stall clear of crossing raised to 7 m; keepClear widened |
| Solids | Stall tables remain solid via `obstructionsUnder(roads.group)`; named `roadside-stall-*` |
| Night visibility | Lamp glow opacity 1.0, wider + fill discs, denser lamps (20 m), stronger bulbs; night timeline hemi/exposure bumped — still night, phone-readable |
| Evidence | `docs/evidence/street-night/before|after/` — zebra night/day phone, kerb, pavement player, lamp pools |
| Automated | **streetclear 7/7**; streetenviro still **stalls:13** |

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

### Stage 3 follow-up — seat sit (owner iPhone) (`cursor/stage-3-seat-sit-181d`)

PR [#62](https://github.com/daveemin0-sudo/NigeriaLife/pull/62). Sofa/armchair hips on cushion top (not sunk); dining chairs face table (all homes + duplex 8-chair set); automated body-vertex seat check. Evidence: `docs/evidence/seat-sit/`.

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
| Broad Street stalls | Restored ≥9 umbrella stalls clear of footbridges — **streetenviro 7/7** |
| Abuja nightlife off roads | Clubs on Ademola (z≈332), City Park off Usuma, Mogadishu south of Gana — **plan 17/17** |
| Expressway lay-by cars | Higher park rate + ensureChunks before count — **roadcraft 14/14** |

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
- Owner iPhone list: Stages **3 seat-sit**, **0C HUD**, **0D street** shipped on their branches — merge into `cursor/integration-1` when CI green.

## Performance

- allphones Very Low: 143 draws / 80k tris.
- ridelegs under 220 draws.

## Tip e2e vs baseline (done — stale serve)

`full-tip.log` finished **2026-11-24 ~11:30 Africa/Lagos**: **1712/1836 PASS**, EXIT 0, 155/155 suites.

Serve was **stale** `/tmp/nl-e2e-serve` @ `54a383a` (Stage 4 markets merge) — **not** current `cursor/integration-1` / stage-5 tip. Treat as a lower bound; alone re-runs on stage-5 already green for the Stage 5 fixes below.

Noise among tip FAILs (~29 “ran to completion”): ENOENT screenshot paths (`C:/Users/User/.gemini/...`), ProtocolError timeouts, HMR “Execution context was destroyed”. Do not treat those as product regressions.

### Wins vs `bf55dab` baseline (on this tip log)

| Check | Baseline | Tip (stale) |
| --- | --- | --- |
| Footbridge climb / deck / rails / east stairs | FAIL | **PASS** |
| Unstick / walk out of building | FAIL | **PASS** (climb path) |
| Under-bridge street level | FAIL | **PASS** |
| Lagos plan walkway-blocked (Sabo Textiles etc.) | FAIL | **PASS** (plan suite green on tip) |

### Tip FAILs already fixed on stage-5 (alone)

| Check | Tip (stale) | Stage-5 alone |
| --- | --- | --- |
| phonefit sleep × `#view-fab` @ 320 | FAIL | **7/7** |
| seats millennium fountain onAir | FAIL | **5/5** |
| needs toilet doors / Party Jollof | FAIL | **9/9** |
| streetenviro stalls denser than 7 | FAIL (stalls:6) | **7/7** (stalls:13) |
| plan Abuja landmarks on road | (not this log) | **17/17** |
| roadcraft lay-by parked cars | FAIL (cars:0) | **14/14** (cars:12) |
| streets suite | aborted mid-suite (HMR) | **17/17** |

### Remaining tip FAILs (pre-existing / flake / out of Stage 5 scope)

firstfive chain, livingcity stall-count / fast-clock wrongs, farwalk walkers:0, drivetouch/streetcar flakes, clothing*/perf* timeouts, ENOENT screenshot suites (owambe/spark/staff/…), phonefit nav-btn bottom overflow @ 320 (separate from sleep×fab).

## Exact next step

1. Merge stage-3-seat-sit / stage-0c-hud / stage-0d-street into `cursor/integration-1` after CI.
2. Optionally re-run full 155 on **current** integration tip for a clean FAIL list.
3. Continue WORLD_AUDIT P2 chrome / unvisited town interiors; phonefit nav-btn bottom overflow if time.
4. Do **not** merge to main or deploy.

