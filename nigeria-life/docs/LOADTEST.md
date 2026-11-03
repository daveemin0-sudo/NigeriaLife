# Game server load test

Recorded Tuesday, 3 November 2026 at 13:21 (Africa/Lagos) on this machine: 4 cores, Intel(R) Xeon(R) Processor, 15.6 GB RAM. The bots and the game server shared that machine. CPU is the game-server process only, as a percentage of one core (so 200% means two cores busy inside that process). Tick time is wall-clock time inside the server tick, so it includes time the process spent waiting on a busy core.

## What ran

`npm run loadtest` starts **one** game-server process and connects fake players over WebSocket. The ramp is 100, 500, 1000, 2000 players. Each step holds for 12 seconds after every bot has been admitted, then reads `/metrics`.

Each bot, five times a second:

- walks a circle inside a neighbourhood of 36 bots, so interest sets stay full
- sends a short chat about every 5 seconds
- starts a Trade Shop Assistant shift and completes it once the server’s 10 second shift clock allows

Server settings for the run: tick 50 ms, world broadcast 5 Hz, interest radius 36, at most 32 neighbours per player. The load-test process raises the cap so the ramp can pass the production safe limit and measure it. Production keeps the cap, and players beyond it wait in the join queue.

A step is healthy when the average tick stays at or under half the tick interval (25 ms), the p95 tick stays at or under the tick interval (50 ms), dropped messages stay under 0.1% of messages received, and the bots actually chatted and started shifts. Dropped messages are inbound frames the server refused (bad payload or a full per-player queue) plus outbound world snapshots skipped because that socket’s send buffer was over 256 KB.

## Results

| Players | CPU % of one core | RSS MB | Heap MB | Tick avg ms | Tick p95 ms | Tick max ms | Dropped | Drop rate | Chats | Shifts started | Shifts done | Messages in | Messages out | Rx / bot |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 2.8 | 104.2 | 13.5 | 0.66 | 2.38 | 10.16 | 0 | 0.000% | 240 | 100 | 11 | 6351 | 6111 | 61.1 |
| 500 | 7.9 | 133.4 | 22.7 | 2.77 | 10.24 | 17.14 | 0 | 0.000% | 1200 | 496 | 131 | 31827 | 31127 | 62.3 |
| 1000 | 13.9 | 139.5 | 32.1 | 5.05 | 19.38 | 25.71 | 0 | 0.000% | 2386 | 986 | 507 | 63897 | 62493 | 62.5 |
| 2000 | 28.4 | 211.0 | 26.5 | 10.21 | 39.85 | 57.25 | 0 | 0.000% | 4858 | 1985 | 1047 | 127796 | 123032 | 61.9 |


## Safe limit

The largest healthy step in this run is **2000** players. `SAFE_PLAYER_LIMIT` defaults to 2000, and the pm2 config uses the same number. At 2,000 players the busiest tick was 57.25 ms, past one 50 ms interval, while the p95 tick was 39.85 ms and nothing was dropped. The cap sits on that edge: the next player waits in line instead of pushing the process over. They see “Server busy, you are number X in line” and are admitted automatically when someone leaves.

## Join queue

When the admitted population is at the safe limit, the next `hello` gets `{ "type": "queued", "position": 1 }` instead of a welcome. The browser shows **Server busy, you are number 1 in line** and updates the number as the line moves. When a player disconnects, the process admits the head of the queue and that player enters without pressing anything. `npm run test:queue` checks the order.

## Process supervisor

[`ecosystem.config.cjs`](../ecosystem.config.cjs) is a pm2 app named `nigeria-life-game-server`. `autorestart` is on, so a crash starts a new process.

```bash
npx pm2 start ecosystem.config.cjs
npx pm2 status
```

## Run it again

```bash
npm run loadtest
```
