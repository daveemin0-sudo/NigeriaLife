# Elegushi Beach evidence

Tip commit: `27ea4a9` (Elegushi open-air first cut on `cursor/integration-1`).

| File | Size | View |
| --- | --- | --- |
| elegushi-phone-sea.png | 390×844 | Phone portrait, play camera (pitch ≈ 0.48, camY ≈ 5.4) at mid-beach |
| elegushi-phone-shore.png | 390×844 | Phone portrait, along shore / party area |
| elegushi-desktop-sea.png | 1280×800 | Desktop play camera — sand, palms, cabanas, DJ, vendors |

Open-air street-height camera (not overhead dollhouse). Scene includes `open_air_horizon_skirts`, `open_air_sea`, `open_air_foam`, `open_air_wet_sand`. Station cards/ids unchanged.

## v2 set (`v2-*.png`) — play camera, tip `27ea4a9`

Captured through the real client (headless Chrome, SwiftShader, `lagoon-beach` entered via `roadside-lagoon-beach` card → "Go onto the beach"), player moved along the beach, normal interior play camera (pitch 0.28–0.48, eye ≈ 3.2–5.4 m; no aerial/isometric preset). Phone = 390×844, desktop = 1280×800.

| File | What it shows |
| --- | --- |
| `v2-phone-sea-waves.png` / `v2-desktop-sea-waves.png` | Waterline: wet-sand strip, red swim buoys, swimmers, sea band at the horizon, palm, cabana umbrella |
| `v2-phone-sea-horizon.png` / `v2-desktop-sea-horizon.png` | Looking at the sea from mid-beach: horizon, swimmers beyond the buoys — **shows the defect below** |
| `v2-phone-shore-umbrellas.png` / `v2-desktop-shore-umbrellas.png` | Along the shore: umbrellas, palms, horse + rider, white foam flecks |
| `v2-phone-huts-palms.png` / `v2-desktop-huts-palms.png` | Back toward the entrance gate: cabana canopies and clean sand, sky gradient at the horizon (no grey void) |
| `v2-phone-default-play-cam.png` / `v2-desktop-default-play-cam.png` | Default open-air camera (pitch 0.48) at the DJ booth |

### Honest finding (not hidden)
The beach is no longer a platform in a grey void: horizon sky, far sea, buoys, swimmers, horses, palms and huts are visible. **But** from the default/street camera over the mid-beach the dry sand turns into a flat slate-navy slab (see `v2-*-default-play-cam`, `v2-*-sea-horizon`, and the existing `elegushi-phone-shore.png`). Cause (from `OpenAirBeach.ts`): the animated sea plane is 280 long centred at `shoreZ - 106` → it spans local z −270…+10, i.e. ~34 m past the shore line (z −24) onto the sand, and it is drawn after the opaque sand (`transparent`, `depthWrite:false`). Area z > +10 (huts/entrance) renders as clean sand. Fix for the next pass: limit the sea mesh to `z ≤ shoreZ` (shift centre by `SEA_L/2`), and push the wet-sand strip/foam to the actual waterline.

## v3 — after sea shoreline clip (`shoreZ - SEA_L*0.5` on tip `2def2ef`+)

Retaken phone 390×844 + desktop 1280×800 at street-height play camera with the sea plane clipped so it no longer covers dry sand:
- `v3-*-midbeach-sea.png`
- `v3-*-waterline.png`
- `v3-*-umbrellas.png`
