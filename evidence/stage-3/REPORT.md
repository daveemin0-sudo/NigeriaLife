# Stage 3 evidence — home life

Branch: `cursor/stage-3-home-life-181d` @ `b2fb0a5`
Tested: Chromium + SwiftShader, `/NigeriaLife/`, desktop only — **not** phone hardware.

## Verified

| Check | Result |
| --- | --- |
| Residence named `bed duvet` meshes | yes |
| Dining `dining_table_6` seat | `{ x: 0.74, z: 0 }` (chair) |
| Staff duty at 12:00 | cook/cleaner/driver/gateman on |
| Staff duty at 22:00 | cook off, driver off, gateman on |
| Hire gateman + call electrician | ok |
| Presidential bed has `bed duvet` | yes |
| Sleep: legs=lie, runtime duvet cover | yes (`bedClothHidden: true`) |

## Shots

- `home-repair.png` — repair visit at home
- `home-night.png` — after 22:00
- `presidential-sleep.png` — sleeper under duvet on presidential bed

## Still open

- Full venue seat sweep (seats e2e covers places)
- Gateman on outdoor `Compound.post` (still street-side of door in home space)
