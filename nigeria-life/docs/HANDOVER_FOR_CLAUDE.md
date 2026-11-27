# Handover for Claude Code — return Thu 26 Nov 2026, 18:00 Africa/Lagos

Lead builder until then: Cursor cloud agent. Do **not** merge to `main`, do **not** deploy, do **not** push to `feature/type-any-amount`.

## Finished

### Late owner-fix merges (this tip)

Merged into `cursor/integration-1` @ `28e15cb` (includes character 2-skins):
- `cursor/stage-0c-hud-181d` @ `482698c` (PR #63)
- `cursor/stage-0d-street-181d` @ `ecaffdb` (PR #64)
- `cursor/stage-3-seat-sit-181d` @ `6441046` (PR #62)

Next: remaining open places (same treatment); interiors redo.

### Open places redo — Elegushi first cut (shipped)

Root cause: open places are **pocket interiors** at `(-3000, …)`. Enter hides the city (`setStreetModeVisibility(false)`), drops a finite `createOpenGround` slab + green `createGroundPlot` disc, and uses high **interior** diorama camera — so they read as platforms in a grey void.

**Preferred approach (first cut, keep pocket):** kill void edge with per-venue horizon skirts; skip/recolour green disc for open-air; lower camera toward street eye; keep stations/ids. **Embed in city** is the larger follow-on (don’t hide street; spawn at door).

**Elegushi first cut** (`lagoon-beach`) @ `27ea4a9`:
- Horizon skirts (sand apron, far sea disc, sky band) past plot rails — no green lawn disc on open-air
- Animated multi-octave sea shader (foam crests, shoreline wash, sky reflection) + wet sand strip + `beach_sand` floor finish
- Swim bobbers in buoy zone; horses with riders along shore; walking vendors; surf + crowd ambience
- Open-air camera: street-height pitch/follow (`OPEN_AIR_PITCH` ~0.48, ~9–14 m leash) instead of room diorama
- Station ids/prices/activities unchanged (`bar`, `lounger`, `horse`, `party`, `suya`, `coconut`, `football`, `swim`)
- Files: `OpenAirBeach.ts`, `PlaceSpecs.ts`, `PlaceInterior.ts`, `InteriorPrefabs.ts`, `InteriorManager.ts`, `Camera.ts`, `Surfaces.ts`

Evidence: `cursor/evidence-elegushi-181d` @ `7197467` (PR #65; first set `39a6c27`, v2 set `2777c6e`) — phone 390×844 + desktop 1280×800 at street-height play camera (`docs/evidence/elegushi-beach/`). Sea-over-sand defect (plane centred `shoreZ - SEA_L*0.38`) **fixed** in this tip: sea/lake near edge flush at shoreline (`shoreZ - SEA_L*0.5`). Evidence v3 on `cursor/evidence-elegushi-181d` (phone+desktop midbeach/waterline/umbrellas) confirms sand is visible again; PR #65.

**Freedom Park first cut** (`freedom-park`) @ `2def2ef` (same open-air pattern as Elegushi; park not sea):
- Already had `openAir: true` (street camera / no green disc); was still a finite lawn slab in grey void — now `OpenAirPark.ts` horizon lawn skirts, sky band, distant city fringe, path apron past rails
- Fringe trees + heritage stone stubs; walkers on paths; crowd murmur + soft highlife bed + leaf rustle
- Stage PA stacks, extra paths/palms/plaque plinths; `park_lawn` floor finish
- Station ids/prices/activities unchanged (`show`, `art`, `food`, `walk`)
- Same kit also wired onto other open lawns: `lekki-conservation`, `ikeja-golf`, `millennium-park`, `pleasure-park` (Jabi keeps `attachOpenAirLake`)
- Files: `OpenAirPark.ts` (new), `PlaceSpecs.ts`, `PlaceInterior.ts`, `Surfaces.ts`, `OpenAirBeach.ts` (sea clip)

Evidence: `cursor/evidence-freedom-park-181d` (phone 390×844 mid-lawn + stage, desktop 1280×800; `docs/evidence/freedom-park/`). Perf (choose): Freedom VL 78/118k, balanced 191/445k; Lekki VL 53/66k; Golf VL 57/64k; Elegushi VL 65/191k (sea grid). Broad Street VL measured 237 draws / **136k tris** (over 110k) — open tip investigation, not place-specific.

### LASUTH interior redo (`cursor/integration-1` @ `fed9a71`)

Root cause: LASUTH used shared sparse `teachingHospital()` on flat `ceramic_white` — read as an empty white box.

**Shipped:** dedicated `lasuthHospitalFloor()` (partitions, windows, ceiling grid/lights, reception/triage, A&E beds, OPD consult, pharmacy shelves, ward bay, waiting gallery). Room **26×22**, terrazzo floor, grey-blue shell walls. **7 staff + 10 visitors/regulars.** National Hospital Abuja / UPTH still on `teachingHospital()`.

Station ids/prices unchanged: `clinic`, `pharmacy`, `ward` (e2e `stations.json` all `ok: true`).

Evidence branch: `cursor/evidence-lasuth-181d` — `docs/evidence/lasuth/` (phone 390×844 waiting + ward corridor; desktop 1280×800 reception + pharmacy; eye camera).

Perf inside LASUTH (2× rAF after `graphics.choose`): **Very Low** 35 draws / 29k tris; **Medium (balanced)** 90 draws / 308k tris (`docs/evidence/lasuth/perf.json`).

**Unverified on return:** manual walk of all partition door gaps vs nav; clinic/pharmacy/ward purchases in live play; whether Medium tris (~308k) needs a LOD pass on ceiling tiles; portraits of new staff NPCs at peak light; jobs hook `lasuth-nursing` shift path through new clutter.

Still unfinished / follow-on: denser crowd meshes; live-hours music; Broad Street VL tris budget; Abuja/UPTH hospital density pass; embed-in-city; Millennium/Pleasure/Jabi evidence shots; yacht club skirts.

Architecture notes from [Map open places architecture](bc-f447f356-91d0-57d2-93d6-1fc2182fe221).



### Broad Street Very Low triangle budget

Measured ~118–136k tris at `graphics.choose('veryLow')` (over ≤110k). Top cost: `facade_detail` window/AC/tank bakes. Fix @ tip: hide `facade_detail` on Very Low only (shells stay); remasured **170 draws / 107k tris**. Calls were already ≤250.

### Fresh full regression (in progress)

### Fresh regression notes (tip vs `bf55dab`)

Edited existing tests (same behaviour, sidewalk height):

| Suite | Old assertion | New assertion | Why same |
| --- | --- | --- | --- |
| `ways` Broad Street walk | `y < 0.05` | `y < 0.35` | Pavement is at `sidewalkTop` (0.28); still requires not on bridge / not inside |
| `streets` under bridge / stair side | `y < 0.05` | `y < 0.35` | Same street-level intent as east-stairs foot check (`y < 0.3`) |
| `expressway` place count | `places.length === 46` | `=== 50` (`32ea226`) | Same: pieces + every roadside card in world; Allen/Awolowo densification added four doors |

Clean tip FAIL / bf55 PASS — fixed and **re-verified** on fresh tip `54a8752` @ `:5203` (`/tmp/nl-e2e-tip-verify`, log `tip-verify-hours-ways-phone.log`):

| Check | bf55 | tip pre-fix | tip verify |
| --- | --- | --- | --- |
| hours stadium shut at 03:00 | PASS | FAIL `stadiumAtThree:true` | **PASS** `false` (`b536460`) |
| ways Gate A / quay brushes | PASS 0/0 | FAIL 1/3 | **PASS** 0/0 (`5430d8c`) |
| phone send over-balance refused | PASS | FAIL empty amount | **PASS** (`c009dd9`) |

Also shipped (shared bf55 FAIL too — still worth fixing): buka instant stand + shop GLB carry arms (`c009dd9`).

Named flakes / shared tip+bf55: phone wheel; invest typedFive; streets dawn walkers; sidewalk `onPavement`; `view` dollhouse all-walls; `places` food filter + unaffordable fare; land/server/accountsave timeouts.

Fresh serves:
- full tip `28e15cb` copy still on `:5201` (pre-fix log)
- verify tip `54a8752` on `:5203`
- baseline `bf55dab` on `:5202`

Full tip+bf55 still running. Next: remaining open places after Elegushi @ `27ea4a9`.

### Character files — 2 shared skins + meshopt (`cursor/character-2skins-181d` @ `e197196`, merged @ `28e15cb`)

Rebuilt from pre-meshopt bases (`c20db99`) with `gltf-transform meshopt --quantization-volume scene`.

| | Male | Female |
| --- | --- | --- |
| Skins | **2** (65, 73 joints) | **2** (65, 73) |
| Meshes / prims / nodes / anims | 102 / 116 / 236 / 19 | same |
| Triangles | 145,963 | 153,633 |
| Seated morph | yes | yes |
| File size | 2.29 MB (was 2.79 MB @ 101 skins) | 2.39 MB (was 2.92 MB @ 95 skins) |

Recipe: `tools/characters/compress_shared_skins.sh`. Do **not** merge skins after meshopt. Evidence: `docs/evidence/character-2skins/`.



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

### Stage 3 follow-up — seat sit (owner iPhone bugs) (`cursor/stage-3-seat-sit-181d`)

Owner: sofa hips sank into cushion; dining sit put body inside the table.

| Fix | Detail |
| --- | --- |
| Sofa / armchair | `pose.height` = cushion top (0.55); procedural drop + skinned root lift so hips sit **on** the pad; sit spots slightly forward (`z: 0.14`) so the back rests on the backrest |
| Dining | Every chair listed (`diningSitLocals`); face **toward table centre**; approach from behind the chair; chairs at `x: ±0.95`; luxury duplex ships `dining_table_10` (**8 chairs**) |
| Venues / hotel | `sitAndDo` / meal `toTable` / hotel armchair pass seat `topAt` into the sit pose |
| Automated check | `tests/e2e/home_seats.mjs` — every sofa + all 8 duplex dining chairs; hips ≥ cushion top; no deep body verts in seat pad or table slab — **7/7** |

Before/after (phone 390×844): `before-sofa-sit.png`, `after-sofa-sit.png`, `after-sofa-sit-side.png`, `before-dining-sit.png`, `after-dining-sit.png`, `after-dining-sit-side.png` under `/opt/cursor/artifacts/seat-evidence/`. Metrics after: sofa hipY≈0.77 on top 0.55 (skinned rootY≈+0.31); dining hipY≈0.72 facing table.

**Merged into `cursor/integration-1`:** seat-sit + Stage 0C HUD + Stage 0D street (see tips below).

### Stage 4 — real interiors (`cursor/stage-4-real-interiors-181d` @ `4d4ee77`)

Audit order done for **hospitals → banks → hotels → restaurants → markets → homes**. Station ids and prices unchanged.

| Slice | What shipped |
| --- | --- |
| Hospitals | LASUTH: `lasuthHospitalFloor()`; Abuja + UPTH still `teachingHospital()` |
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

