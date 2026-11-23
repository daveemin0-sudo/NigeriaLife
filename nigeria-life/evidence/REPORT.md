# Solid world — evidence

Review of `814ef3a` (not approved). Fix branch: `cursor/solid-world`. This branch is evidence only — do not merge either branch.

## Commits

| Ref | Hash | Notes |
|-----|------|-------|
| Untouched baseline | `bf55dab2c590d521b4e32a33083c5433b932acc4` | Worktree `/tmp/nl-bf55dab`, preview `:4178` |
| Rejected tip | `814ef3a755078d9ad90bd3797fedca3a0a4fbe84` | Removed CityPopulation solids |
| Fix tip | `44917da0477e10d0caf9167ae906b0dcb88c5f06` | Honest solidworld + crowd solid avoidance |

`npx tsc --noEmit` clean on the fix tip.

## What changed (fix)

1. **Honest `solidworld`** — no pass-when-missing. Requires real Apapa Port container footprints and expressway lay-by benches, proves the player is stopped by them, requires solids in **100%** of places with physical furniture, and asserts near-camera crowd walkers stay outside a stall.
2. **CityDress** — lobby/office desks build into the place `Builder` so town hotels/offices register NavGrid solids.
3. **CityPopulation** — near-camera pacers steer around all street solids via the Solids spatial grid (72 checks/frame budget, scratch `out` buffer, road-safe laterals, unstick hunt). Pavement-network routes (`life.state === 'going'`), dedicated road-crossers (`willCross` / `xing`), and far agents stay on the network so commute sims do not strand.

## Exceptions

**None.** `NO_FURNITURE_EXCEPTIONS` is empty. All 100 roadside places with furniture registered `solidCount > 0` after `ensureBuilt()`.

## Screenshots

| Shot | File |
|------|------|
| Player stopped by port container | [shots/solidworld-port-container.png](solid-world/shots/solidworld-port-container.png) |
| Lay-by bench solid | [shots/solidworld-layby-bench.png](solid-world/shots/solidworld-layby-bench.png) |
| Buka bench | [shots/solidworld-buka-bench.png](solid-world/shots/solidworld-buka-bench.png) |
| Hotel furniture | [shots/solidworld-hotel-furniture.png](solid-world/shots/solidworld-hotel-furniture.png) |
| Home / town-suite table | [shots/solidworld-home-table.png](solid-world/shots/solidworld-home-table.png) |
| Crowd around roadside stall | [shots/solidworld-crowd-around-stall.png](solid-world/shots/solidworld-crowd-around-stall.png) |

## Frame cost (street `advance` sample, software WebGL)

Same probe as solidworld `PERF_SAMPLE` (40× `g.advance(1/30)` at Broad Street).

| Build | avgMs | fps | solids.count | cityPopulation.solids |
|-------|------:|----:|-------------:|-----------------------|
| `bf55dab` | 19.41 | 51.5 | 1439 | unset (`false`) |
| `44917da` fix | 14.39 | 69.5 | 1764 | wired |

Noise on this VM’s software renderer is high; the fix does not show a frame-cost regression in this relative sample. Crowd update budgets remain under the livingcity 1 ms/frame checks.

### laptopperf (relative, Low vs High)

| Scene | bf55dab avgMs | fix avgMs |
|-------|-------------:|----------:|
| High street | 1383.27 | 1511.07 |
| Low street | 592.84 | 636.10 |
| Low dense | 433.32 | 447.20 |
| Low home | 301.65 | 266.65 |

## Per-suite results (one suite at a time)

Game URLs: fix `http://127.0.0.1:4177/`, baseline `http://127.0.0.1:4178/`.

| Suite | bf55dab | fix `44917da` |
|-------|---------|---------------|
| solidworld | **absent** (suite not in tree) | **41/41** |
| places | 22/25 | 22/25 |
| interiors | 16/16 | 16/16 |
| buka | 34/35 | 34/35 |
| hotel | 11/11 | 11/11 |
| worship | 14/16 | 14/16 |
| home | 22/22 | 22/22 |
| homelayout | 6/7 | 6/7 |
| seats | 5/5 | 5/5 |
| livingcity | 80/83 | 80/83 |
| peoplepresence | 5/5 | 5/5 |
| streetcar | 6/8 | 6/8 |
| touch | 9/10 | 10/10 |
| laptopperf | 6/6 | 6/6 |

Shared pre-existing failures on both builds (not introduced by the fix): places map filters/fare click, buka Home-from-chair sit legs, worship triangle budgets, homelayout dollhouse cut walls, livingcity stall-trader “nobody added to the crowd” in all three cities, streetcar multi-street / bonnet bubble. Touch sleep energy flaked on baseline only.

## solidworld highlights (fix)

- Port container sample: Apapa Port at (-101, 73); player stopped (`finalDist` 0.96).
- Lay-by bench: owner `Lay-by bench`; player stopped.
- Crowd: Roadside stall #8 at (19, -117.9); `inside: 0`, `nearFrames: 208`.
- Furniture solids: 100/100 places; exceptions list empty.
