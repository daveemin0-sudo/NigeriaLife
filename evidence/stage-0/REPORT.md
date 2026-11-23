# Stage 0 evidence — corrections

**Code branch:** `cursor/stage-0-corrections` @ `8609aac`  
**Base:** `feature/type-any-amount` @ `bf55dab`  
**Tested how:** Chromium (puppeteer-core) + SwiftShader WebGL on this cloud VM.  
**Not tested:** physical Samsung A16, physical iPhone, Safari/WebKit, Firefox (Playwright browsers missing here).

## Suites

| Suite | Result | Notes |
| --- | --- | --- |
| `solidworld` | **41/41** ×3 consecutive | Port containers + lay-by benches exist, register in Solids, stop the player. 100% of furnished places have solids (0 exceptions). Crowd pacers steered around sample stall. |
| `allphones` | **43/43** | `--base=/NigeriaLife/`, no failed model requests. Very Low Broad Street: 136 draw calls, 77,695 tris (budget ≤250 / ≤110k). |

## 0A Solid World

- Removed false-pass patterns were already gone on `cursor/solid-world` @ `44917da`; kept and hardened.
- Crowd: near-camera walkers (including pavement-network `going`) use `propsOnly` solid steps so they slide around stalls/benches/poles without stranding routes on building walls.
- `solidworld` crowd check now asserts against the **sample prop footprint only** (nearby building walls no longer false-fail) and seeds pacers on a collision course.

## 0B All Phones / characters

- Meshopt-compressed GLBs ship and render correctly under `/NigeriaLife/` base.
- **Skin counts:** male **101**, female **95** (joint counts still only 65 and 73).
- Attempting to collapse to exactly 2 skins *after* meshopt/quantize reuses the wrong inverse-bind matrices (per-mesh IBM deltas measured up to ~1.65) and explodes vertices. Documented in `tools/characters/merge_shared_skins.mjs` (refuses to run).
- Base (pre-meshopt) GLBs already have 2 shared skins and look correct but are ~2.5× larger and not meshopt.
- `life.ts` GRAPHICS_NOTES change from all-phones was already reverted on that tip; no diff vs base.
- Character look confirmed in `shots/player-shipped-101.png` (blue / orange pedestrians intact). Spidery limbs appear only with the broken 2-skin merge.

## 0C Cards / rides (phone sizes)

Sizes: 320×568, 360×800, 390×844, 430×932, landscape 844×390. Scenes: street HUD, ride card, driving HUD, inside place, phone, map, Dangote Lekki arrival, Apapa depot.

**HUD fixes applied:** today-chip + street chat moved to their own row under quest/place; landscape radar/toasts separated; map toasts clear of the left transit rail.

**Remaining (narrow / intentional):**
- Map city/filter pills may extend past the right edge (horizontal scroller by design, same as `phonefit`).
- Minimap north glyph can sit 1–2 px past the right edge on the smallest phones.
- Dangote Lekki `streetPosition` is z≈3500; location chrome still labels the corridor “Third Mainland Expressway” until the expressway place card loads. Separate Apapa depot is at z≈58 (Wharf / Victoria Island chrome). See `shots/fix-dangote.png` and `shots/fix-apapa.png`.

**Vehicle GLB network:** 0 requests (Stage 0D).

## 0D Missing vehicle GLBs

`DrivableVehicle` no longer requests `models/vehicles/*.glb` until a file is registered as shipped. Procedural bodies unchanged. Capture reported **0** vehicle GLB requests and **0** failed model requests.

## Performance snapshot (allphones Very Low)

- Draw calls: 136 (≤250)
- Triangles: 77,695 (≤110k)
- Shadows: off for the session

## Open for Stage 1+

- Merge keke / seated-car-legs into `cursor/integration-1` and run full regression vs baseline.
- True 2-skin + meshopt needs a compression path that does **not** partition skins / re-quantize IBMs per mesh.
- Dangote place-name chrome along the Lekki corridor.
- Character portrait close-ups on a real GPU (SwiftShader only here).
