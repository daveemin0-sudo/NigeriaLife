# Stage 5 evidence — QA (districts + footbridge)

**Code tip:** `cursor/stage-5-qa-everywhere-181d` @ `10d07d9`  
**Integration:** `cursor/integration-1` @ `9356ff9`  
**How tested:** desktop Chromium + SwiftShader, `…/NigeriaLife/`. **Not** phone hardware.

## District labels

| Shot | Result |
| --- | --- |
| `stage-5/jibowu-district.png` | (92.5, −69.6) → **Jibowu** / Ikorodu Road Corridor |
| `stage-5/mama-put-district.png` / `mama-district.png` | (−17, −10) → **Lagos Island** |
| `stage-5/cchub-district.png` | (−12.5, −23.8) → **Yaba** (mainland no longer steals it) |

## Footbridge climb (`streets` 17/17)

| Shot | Result |
| --- | --- |
| `stage-5/footbridge-climbing-390x844.png` | West stairs / deck approach at 390×844 |
| `stage-5/footbridge-deck-390x844.png` | Player on deck (`y ≈ 5.65`, `onBridge`) |

**Fix:** `Player.stayOnTheWay` no longer unsticks out of stair step solids (climb) or wall volumes (exit from inside a building). Pavement-height checks in `streets.mjs` aligned to `sidewalkTop` (0.28) / existing `y < 0.3` foot check.

## Outdoor gateman

| Shot | Result |
| --- | --- |
| `stage-5/gateman-at-post-390x844.png` | Musa Danjuma standing at the Banana Island gatehouse post (hired + on duty, 10:02 AM) |
| `stage-5/gateman-street-390x844.png` | Wider street context from the compound |

## Also in this tip (no new shots yet)

Outdoor gateman on `Compound.post`; Abuja/PH destination↔PlaceSpec alignment; Broad Street walkway clear (`plan` 17/17).
