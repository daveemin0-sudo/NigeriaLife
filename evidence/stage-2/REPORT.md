# Stage 2 evidence — open places

Branch tip used for shots: `cursor/stage-2-open-places-181d` (this push).
Tested: Chromium + SwiftShader, `GAME_URL=http://127.0.0.1:5173/NigeriaLife/` — **desktop 1280×720 only**. Not tested on phone hardware.

## Places proven open-air

Each entered via `roadside-<key>` after `arriveInCity` when needed. Asserted: `openAir:true`, `isOpenAir():true`, zero `*_wall` meshes, outdoor sky.

| Place | City | Shot | Notes |
| --- | --- | --- | --- |
| Elegushi Beach | Lagos | `lagoon-beach.png` | Horizon sea, foam, cabanas, umbrellas, beach bar |
| Freedom Park | Lagos | `freedom-park.png` | Lawns / stage (prior Stage 2) |
| Lekki Conservation | Lagos | `lekki-conservation.png` | Canopy / boardwalk (prior Stage 2) |
| Ikeja Golf Club | Lagos | `ikeja-golf.png` | Open course + pavilion clubhouse (no room shell) |
| Millennium Park | Abuja | `millennium-park.png` | Fountain, lawns, benches; enterable door |
| Jabi Lake Park | Abuja | `jabi-lake-park.png` | Boardwalk, gym, suya, lake water; **not** the mall |
| Pleasure Park | Port Harcourt | `pleasure-park.png` | Lawns, big wheel, picnic; enterable |

## Wiring

- `room.openAir` + `InteriorPrefabs.createOpenGround`
- Abuja / PH districts `inside:true` for park keys; destination `isEnterable` + `interiorId` for Millennium, Jabi Lake Park, Jabi Lake Mall
- Lake uses `attachOpenAirLake` (freshwater colours); beach keeps `attachOpenAirBeach`

## Not claimed

- Phone / Samsung A16 / iPhone rendering of these parks
- Full worldaudit re-run on this tip (queued with Stage 2 merge)
- Markets / malls / offices still use building shells by design (audit OPEN_AIR heuristic false positives)
- Eagle Square and PH waterfront remain street-ground activities (not enterable shells)
EOF