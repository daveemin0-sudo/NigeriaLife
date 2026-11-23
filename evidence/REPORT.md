# Keke visual evidence for `7f36a3d`

Code under test: `7f36a3d` on `cursor/keke-okada-models` (PR #46).  
This branch (`cursor/keke-okada-models-evidence`) only adds evidence files. No game code was changed here beyond resetting onto that tip.

## Visual fixes in `7f36a3d`

Only `nigeria-life/src/world/vehicles/KekeOkadaModels.ts` changed. Okada unchanged.

| Issue | Fix |
|---|---|
| Rear centre rod | Bumper bar uses `roll: π/2` so it lies across X (was a vertical centre rod when oriented with yaw) |
| Headlamp buried | Shortened yellow tip; chrome cup + dark bezel + lens proud of the cowl; amber cheek indicators |
| Tail lamps salmon | Deep red `0x6b0f0f` via body vertex colour (no emissive wash on the boot) |
| Rear window flicker | Canvas rear wall with a cut-out only — no overlapping glass pane |
| Egg nose | Narrow extruded cowl (depth 0.36) with cheek blends; mudguard, fork and front wheel clear under the tip |

Constraints kept: size within 2 cm of 1.58×1.87×3.00 m; cameras / seats / grips / `steer` / wheel radii / `lane` / deck lift / inside view / okada unchanged; ≤8k tris; ≤6 shell materials.

## Builds

| Build | Ref | Notes |
|---|---|---|
| Merge | `7f36a3d` + local merge of `origin/cursor/seated-car-legs` (`3dbe1d8`) | Temporary local merge only; not pushed |
| Baseline | untouched `origin/cursor/seated-car-legs` (`3dbe1d8`) | Same e2e harness |

Both built with the **default Vite base** (no `--base`) and served as static sites:

- Merge: `GAME_URL=http://127.0.0.1:5192/`
- Baseline: `GAME_URL=http://127.0.0.1:5193/`

## E2E pass counts (one suite at a time)

| Suite | Merge (`7f36a3d` + seated-car-legs) | Baseline (`seated-car-legs`) |
|---|---|---|
| rides | **18/18** | **18/18** |
| ridepickup | 10/11 | 10/11 |
| ridelegs | **18/18** | **18/18** |
| vehicles | 6/7 | 6/7 |
| getabout | 8/9 | 8/9 |
| seats | 4/5 | 4/5 |

### Checks that pass on baseline and fail on merge

**None.**

The only failing check on either build is `no errors in the page`, which fails on both for the same missing optional `models/vehicles/*.glb` files (`danfo_minibus`, `keke_napep`, `suv_luxury`, `okada_bike`, `sedan_corolla`).

## Measurements (merge build)

### Outside size (no people)

| | X (m) | Y (m) | Z (m) |
|---|---|---|---|
| Target | 1.58 | 1.87 | 3.00 |
| Measured (wheels + steer) | **1.580** | **1.870** | **2.987** |

Within **2 cm** of 1.58 × 1.87 × 3.00 m.

### Triangle / material counts (no people)

| Scope | Triangles | Materials |
|---|---|---|
| Shell only (`addKekeBody`) | **2,822** | **6** |
| Body + wheels + steer | **4,634** | 8 |

Under 8,000 triangles; shell materials at the 6-material cap (body, canvas, interior, metal, glass, lamp).

## Screenshots

| File | View |
|---|---|
| `keke_front.png` | Front |
| `keke_front_three_quarter.png` | Front three-quarter |
| `keke_side.png` / `keke_side_left.png` / `keke_side_right.png` | Both sides |
| `keke_rear.png` | Rear |
| `keke_rear_close.png` | Rear close-up |
| `keke_inside.png` | Inside |
| `keke_chase.png` | Chase |
| `keke_front_wheel_nose.png` | Close-up of front wheel and nose |

## Source commits

- Evidence of: `7f36a3d` — Fix keke nose, headlamp, tails, rear rod and rear window.
- Preceded by: `24ddb86` (StandIns-safe deck lift), `ec93335` (deck lift).
- Seated-car-legs tip used for testing: `3dbe1d8`.
