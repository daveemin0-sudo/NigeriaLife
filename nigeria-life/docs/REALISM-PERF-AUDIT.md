# Realism & low-spec performance audit (Nov 2026)

Honest baseline before the next-generation visual ambition and EliteBook HD 620 work.
**Not** a claim of GTA 6 parity. NigeriaLife keeps stylized realism (see `VISUAL_QUALITY_STANDARDS.md`).

## What already exists (reuse)

| System | Role |
|---|---|
| `GraphicsQuality` | High / Balanced / Low: pixel ratio, shadow map size/interval, crowd draw distance, district cull |
| `SkyEnvironmentManager` | Continuous day→night keyframes, fog, exposure, golden hour |
| `WeatherSystem` | Rain, wet asphalt roughness/metalness, Harmattan, puddles via `AtmosphereManager` |
| `MaterialLibrary` | Procedural PBR asphalt, sidewalks, plaster, roofs, night window emissive |
| `Roads` | Streetlights, pole cables, gutters, lamp ground glow (no per-lamp PointLights) |
| `CityPopulation` / traffic | Distance LOD for pedestrians; traffic spawners per city |
| `PostProcessingManager` | Bloom + Lagos grade (built; **not** hooked into `Game.render` today) |
| Interiors | `ResidentialInterior` + `HouseDecorationSystem` (see interior-quality PR) |

## Biggest visual gaps vs ambition

1. **Street density / weathering** — Broad Street has materials and props, but façades and clutter still read as game kits vs lived Lagos blocks.
2. **Night illumination** — Window/street emissives exist but pools of light are conservative; night can feel under-lit vs reference night cities.
3. **Material response** — Wet asphalt works; many walls/roofs stay flat under sun/rain.
4. **People & vehicles** — Stylized humans/vehicles present; animation/fashion variety and traffic density still short of “alive city.”
5. **Three-city identity** — Lagos kits are densest; Abuja/PH thinner (known from `QUALITY_AUDIT.md`).

## Biggest performance bottlenecks (HD 620 / EliteBook)

Measured levers already in code comments / prior audits:

1. **Pixels** — High uses up to 2× DPR; on 1366×768 this dominates fill-rate on Intel HD 620.
2. **Shadow map** — 1536² every frame at High; Low already throttles redraws (keep shadows on to avoid shader recompile freezes).
3. **Crowd + traffic CPU** — Far agents still cost update work if not culled aggressively enough on Low.
4. **Multi-city memory** — Inactive cities should stay light; verify no full PH/Abuja mesh residency while in Lagos.
5. **Post FX** — Bloom/composer would be expensive if enabled; keep off on Low/Balanced until optional High toggle.

## Vertical-slice plan (this effort)

1. Harden **Low** for laptop: render scale, 720p internal cap, stronger cull distances, GPU auto-detect. ✅ (PR #31)
2. Lagos **Broad Street** presentation: stronger night street pools + window glow (no new PointLights). ✅ (PR #31)
3. Cap wet-road metalness on Low (cheaper specular). ✅ (PR #31)
4. Profile High vs Low at **1280×720** in e2e (`laptopperf`) — software WebGL on CI/cloud is not HD 620; numbers are comparative, not device claims. ✅ (PR #31)

## Next realism layer (lighting + weather immersion)

Incremental follow-on (this branch): sell day↔night↔rain without new PointLights or city rebuilds.

1. Continuous dusk→dawn street lamp + façade window glow from `currentHour` (not just period flips).
2. Stronger golden-hour / deeper night keyframes in `SkyEnvironmentManager`.
3. Rain: darker wet asphalt tint, puddle wetness scaling, slightly denser rain particles.
4. Sidewalk wet registration + `lightingweather` e2e (midday / golden / night / rain screenshots).

## Out of scope for this slice

Full city rebuild, character remeshing, vehicle remasters, enabling bloom on Low, merging unrelated stacks.