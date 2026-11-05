# Game server load test

Measured Thursday 5 November 2026 (Africa/Lagos) against **`server/game-server.ts`**, the real server, with its
SQLite store, accounts, rooms and money checks. An earlier run on 3 November (branch
`cursor/loadtest-join-queue-27e5`) measured a separate stand-in server (`server/index.ts`) built on old `main`, so its
"2,000 players" figure did not apply to this game. That branch should not be merged.

Machine: 2 cores (Intel Xeon @ 2.10 GHz), 7.8 GB. **The bots ran on the same two cores**, decompressing every
message they got, so they took CPU from the server. Figures for a machine the server has to itself will be better.
Run it again there before choosing a limit.

## What runs

`npm run loadtest` (or `npm run loadtest -- 100 300 600` for your own steps) starts one game server on a spare port
with an empty database, signs in one guest per bot, and connects them over WebSocket the way the game does
(`proto=2`). Each bot:

- walks a circle in a neighbourhood of 40 bots (clusters 300 m apart), sending its position 10 times a second with
  a look the size of a real player's
- chats in the city about every 20 seconds
- one in ten works shifts at the Apapa loading bay through the server's real hire, start and finish checks

`LOADTEST_CROWD=1` puts everyone in one square instead (a concert, the worst case). `LOADTEST_HZ`, `LOADTEST_HOLD`
change the send rate and the seconds measured per step. Numbers come from `GET /admin/metrics`.

**Healthy** means: the average tick is under half its 100 ms budget, the p95 tick is under the budget, no position
batch was skipped for a backed-up socket, and the server process used under 70% of one core.

## What the first run found, and what changed

| | Before | After |
| --- | ---: | ---: |
| What each player downloads in a crowd of 40 | **~300 KB/s** (about 1 GB an hour) | **~7 KB/s** (about 25 MB an hour) |
| Server CPU, 100 players | 17% of a core | 20% of a core |

Every tick, the server re-sent every nearby player's whole state, look included, as fresh JSON for each viewer.
Now:

1. **The look goes once.** A game that connects with `proto=2` gets someone's look (`config`) and name when it first
   sees them or when the look changes; otherwise only where they are and what they are doing. Older cached copies of
   the game (no `proto=2`) still get the whole state every time, so nothing breaks for them.
2. **Each state is turned into text once per change**, not once per viewer.
3. **Positions are rounded to the centimetre**, and players more than 40 m away are sent 3 times a second, not 10.
4. **Compression (permessage-deflate) is on.** It cuts the bytes about 10x and costs about twice the CPU.
   `NL_DEFLATE=0` turns it off.
5. **The game sends its position 10 times a second when online** (it was 20; the server only uses 10).

## Results (clusters of 40, compression on)

| Players | Server CPU % of one core | RSS MB | Heap MB | Tick avg ms | Tick p95 ms | Tick max ms | Dropped | Msgs in/s | Msgs out/s | MB out/s before compression | Wire KB/s per player | Chats | Shifts started | Shifts paid | Shift errors | Healthy |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| 100 | 19.8 | 180 | 29 | 2.84 | 4.06 | 6.47 | 0 | 998 | 1482 | 7.48 | 7.0 | 73 | 10 | 10 | 0 | yes |
| 250 | 56.2 | 223 | 20 | 8.83 | 14.78 | 17.72 | 0 | 2491 | 4425 | 20.11 | 7.9 | 169 | 25 | 25 | 0 | yes |
| 400 | 88.8 | 349 | 29 | 17.45 | 26.82 | 31.57 | 0 | 4014 | 8100 | 29.71 | 7.4 | 312 | 40 | 40 | 0 | **no** (CPU) |
| 550 | 100.3 | 779 | 398 | 26.72 | 38.88 | 89.05 | 1877 | 5472 | 10091 | 36.88 | 4.7 | 387 | 55 | 55 | 0 | **no** |

Every shift the bots started was paid by the server's own checks, at every step.

Worst case, everyone in one square (`LOADTEST_CROWD=1`):

| Players | Server CPU % | Tick avg ms | Tick p95 ms | Dropped | Wire KB/s per player | Healthy |
| ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| 100 | 24.1 | 3.76 | 6.55 | 0 | 13.4 | yes |
| 200 (one full instance) | 78.1 | 17.1 | 25.98 | 0 | 35.0 | no (CPU) |

Without compression (`NL_DEFLATE=0`), 600 players in clusters were healthy at 62% CPU, but each player downloaded
about 72 KB/s. That is too much for most players' data plans, so compression stays on.

## The limit

- **`NL_MAX_PLAYERS` defaults to 300** per process: the last step that was healthy, with room to spare, on a core shared
  with the bots.
- **Render Starter** (`render.yaml`) is half a core and 512 MB, so it is set to **120**.
- Past the limit, the next player sees **"Server busy, you are number X in line"**. They are let in automatically
  when someone leaves, and the people behind them move up. Someone already playing who reconnects never waits.
  `GET /health` reports `queued`. The `queue` test suite checks all of this.

To hold more players than one process can: put each city on its own process, then split Lagos by area. Rooms are
already per city (`server/rooms.ts`), but money and accounts are one SQLite file, so this needs Postgres first
(roadmap 1.4).

## Keeping it running

On Render, the platform restarts a crashed server and checks `/health`. On your own machine or a VPS:

```bash
npm run supervise         # pm2, from ecosystem.config.cjs: restarts it if it crashes
npx pm2 logs nigeria-life
```
