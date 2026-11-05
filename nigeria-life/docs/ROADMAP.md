# Nigeria Life roadmap

The checklist for `MASTER-PLAN.md`, measured against the code as it is, not as that brief describes it.
**Done** means a browser or server test in `tests/e2e/` drives it. **Partial** says what is still missing.
**Missing** is not there. Day-to-day status of what exists is in `STATUS.md`.

Audited 3 November 2026 (Africa/Lagos) on `cursor/quiet-arrival-6e3b`, from the tree at `e02c108`.
The previous audit in this file was 23 October 2026 at `16933f0`. A lot of Phase 2 and Phase 3 has landed since then.
`online_api` was run again on this audit, on its own server and an empty database: 32 checks, all passed, including a shift at the loading bay paid ₦6,000 by the server and two connections seeing each other only while they are near. The two-browser `online` suite (two Chrome profiles, one at phone size) was not re-run today.

## Corrections to the brief's audit

The "Where Nigeria Life stands today" section in `MASTER-PLAN.md` is the October brief. These lines in it are no longer true:

- *"Multiplayer is not real; BroadcastChannel only."* `server/game-server.ts` (Node, `ws`, no Colyseus) joins games on different devices. `server/rooms.ts` keeps one room per city, instances of 200, and sends only players within 120 m in the same building, at 10 Hz. `NetworkManager` uses the server when one is set and falls back to `BroadcastChannel`.
- *"Saves are local only; cloud sync is fake."* Still true for a player who never signs in. `BackendService` and `CloudSyncService` write `localStorage`. An account on the server keeps the wallet, look is a separate path, and a guest can upgrade. Clearing the browser still deletes a local-only player.
- *"Economy is client-authoritative."* Partly fixed online. The server holds the wallet and an append-only ledger. A number edited in the browser does not survive the next server change. Plot takings, the generator, the three big minigames and the phone gigs are priced by the server. What is still reported is accepted up to ₦48,000 in ten minutes; more is held for an admin. Energy and shop prices are still the game's word.
- *"Only health, energy, hunger, streetCred."* Out of date. Fun, social, hygiene and bladder exist, show in the menu, decay, and are restored by toilets, meals, the gym, the pool, the salon and the club (`needs` suite). Health is still its own stat, not only a consequence. Low needs do not yet cut shift pay.
- *"No real-time clock, no weekly rent, no careers, no elections, no ads."* The clock defaults to Africa/Lagos (`SkyEnvironmentManager`, `sky` suite). Saturday rent is charged in `BackendService.processDailyRentTick`. There are 36 employers with 5 grades each (`src/jobs/employers.ts`). Weekly elections for governor, senator and president are in `src/politics/Politics.ts`. Players rent expressway billboards in `server/ads.ts`.

## Phase 1: real online foundation

Do not rebuild this on Colyseus. Rooms and interest management are already on `ws`, and `RemotePlayer.ts` already interpolates. Replacing that would rewrite `NetworkManager` for no gain.

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 1.1 | Game server, rooms per city, interest management, 10-20 Hz | **Done** | `server/game-server.ts`, `server/rooms.ts`. One process. Several processes behind a balancer are not built. |
| 1.2 | `NetworkManager` over the server, same API, BroadcastChannel fallback | **Done** | `src/multiplayer/NetworkManager.ts`. |
| 1.3 | Accounts: guest, upgrade, email / phone / Google, rate limits, verified flag | **Partial** | Guest, email link that keeps the guest, verified counted apart, rate limits (`server/accounts.ts`). The link is printed in the server log until a mailer is chosen. Phone OTP and Google need outside accounts. |
| 1.4 | Database | **Partial** | Node's built-in SQLite in `server/store.ts`. Postgres and Redis are not set up. One process does not need Redis. |
| 1.5 | Server-authoritative economy | **Partial** | `server/economy.ts`: ledger, idempotency, nothing below zero, held windfalls, local import capped. Server-checked: worksite shifts (including CcHUB, the refinery and LASTMA), gigs (the generator, phone and life work, career shifts), plot takings, quest, album and case payouts, and the NaijaBet draw. Also player transfers, registry sales and rent, staff, owambe, marriage, motors, chieftaincy, film and the bookmaker. What the game still reports is capped at ₦48,000 in ten minutes. |
| 1.6 | Chat: city / proximity / DM, filter, report, mute, block, slow mode, moderation | **Done** | `server/rooms.ts`, `server/chatFilter.ts`, admin mute and ban. The word list still needs native-speaker review. |
| 1.7 | Reliability | **Partial** | `/health` (now with `queued`), clean shutdown, the game reconnects. Load test of the real server (`npm run loadtest`, `docs/LOADTEST.md`): about 300 players per core, 120 on Render Starter. Join queue past `NL_MAX_PLAYERS` (`server/rooms.ts`, `src/ui/ServerQueueScreen.ts`, `queue` suite). pm2 config for a VPS (`ecosystem.config.cjs`). Positions sent once per look change and compressed: ~7 KB/s per player in a crowd, down from ~300. Still missing: a public status page, and more than one process (needs Postgres). |
| 1.8 | Admin panel | **Done** | `/admin` on the game server when `NL_ADMIN_KEY` is set: counts, held money, ledger, mute, ban, grant. There is no separate `admin/` app. |

Playing on a home network: `npm run build`, then `npm run server`, then open `http://<that computer>:8787/` on each phone.

## Phase 2: core loops

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 2.1 | Real-time WAT clock, Saturday rent, weekly loans, wage per shift | **Partial** | Clock done (`sky`). Saturday rent debits in `BackendService.processDailyRentTick`. A missed week toasts "avoid eviction" and does not remove the home. The Lapo slip says ₦7,500 a week; `repayLoan` pays the whole balance at once, with no late fee. Wages are per piece of work (`jobs/Employment.ts`), not a clocked shift. |
| 2.2 | Six needs that matter, fixed in the world, offline decay capped, low needs hurt work | **Partial** | Bars, decay, toilet, meals, gym, pool, salon (`needs`, `buka`, `home`, `eating`). Offline decay cap and a pay cut for low needs are not there. Health is not derived from the other six. |
| 2.3 | ~16 careers, 5 ranks, one skill each, shifts at the workplace | **Partial** | 36 employers, every one with 5 grades and a skill (`src/jobs/employers.ts`, `workplaces`, `shiftskill`, `jobs`). That covers port, site, tech, bank, shrine, market, hospital, salon, buka, club, gym, TV, UNILAG, events, football, mall, airlines, refinery, haulage, lab, LASTMA, danfo, nursing, mechanic, phones, radio, hotel, delivery, interiors. Law and a named civil-service desk in Abuja are not in that table. Night-only shifts are not a separate rule. |
| 2.4 | Permanent origins, Lapo weekly loan, ~12 traits | **Partial** | Nepo / Lapo / Tech-bro in `CharacterCreator.ts` and `BackendService`. **Traits done (5 Nov):** 12 in `src/life/Traits.ts`, each changing need drain, skill growth or food / fare prices, most with a small cost. Picked once in the Character Studio (tap, then confirm), kept for good, stored on the server per account (`POST /me/trait`, refused if different), save version 3 with a migration (`traits` suite). Still open: the Lapo loan is not charged weekly. |
| 2.5 | Housing ladder per city, eviction, friends can visit | **Partial** | Properties and rent (`realestate/`, `housing/`, `home` suite). `src/life/Ladder.ts` is a status ladder (Mushin up to Banana Island) measured from what you own, not five rent tiers per city. No Abuja or Port Harcourt ladder. No eviction. Home staff exist (`staff` suite); friend visits are not a flow. |
| 2.6 | Land that appreciates, omo-onile levy, disputes, then build | **Partial** | Buy, build, let (`land` suite, `src/realestate/Land.ts`). No appreciation, area levy, or court dispute. |
| 2.7 | Side businesses: bad days, staff, stock | **Partial** | Takings exist. Home staff are hired and paid daily on the server. No stock, and no random bad day / police / NEPA event on a business. |
| 2.8 | PAYE on payslips and VAT on purchases | **Missing** | A senator policy called "business tax cut" adds 10% to business takings. That is not a tax. |
| 2.9 | NEPA: district schedules, appliances off, generator / inverter / solar | **Partial** | A street generator you fuel, and blackout talk in `LagosStreetLifeSystem`. Appliances do not stop. No district schedule, inverter-as-power, or solar. |
| 2.10 | 25+ venues with hours and an activity | **Partial** | Many places you can enter (`places`, `hours`, `worship`, `hotel`, `club`). The hours table is six rows in `src/destinations/Hours.ts` (bank, university, supermarket, buka, stadium, club, plus the building site). A place not in that table never shuts. |
| 2.11 | Arrest, real-time cell, bail by a friend, a record that blocks careers | **Partial** | Checkpoint and bail dialogue, including Kazeem's cell (`PoliceInterior.ts`). The player is not jailed for minutes, a friend cannot pay their bail online, and no record blocks a career. |

## Phase 3: beyond Lagos Life

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 3.1 | Trade between cities, then more cities | **Partial** | Lagos, Abuja, Port Harcourt, flights and coaches (`flights`, `coaches`, `cities`). No goods to buy cheap and sell dear. No Ibadan, Kano, Enugu, Benin, Calabar, Kaduna, Owerri. |
| 3.2 | Own a danfo / keke / okada, passengers, hire drivers, licences, weekly fuel | **Partial** | Danfo queue fares (`danfo`), ride-hail (`ridehail`), fuel (`fuel`), vehicle ownership (`vehicles`, `motors`). Home staff include a personal driver, not a route driver. No licence, and fuel does not change by the week. Cars do not park in front of the player's house as a rule. |
| 3.3 | Ward, governor per city, president for a season; debates, impeachment, verified votes only | **Partial** | One weekly election for Lagos governor, Lagos Central senator, and president (`src/politics/Politics.ts`, `politics` suite). Policies change pay, fares, hawker prices, tolls and petrol. NPC candidates always stand. No ward, no per-city governor, no debate venue, no approval or impeachment, and a guest can vote. |
| 3.4 | Friends, squads, marriage, children, ajo / esusu | **Partial** | Relationship tiers (`social`). Marriage, rings, traditional wedding (`src/social/Marriage.ts`, `server/marriage.ts`, `marriage` suite). No squad treasury, no children, no ajo. |
| 3.5 | Host an owambe, spray money that moves, hire a DJ | **Partial** | Aso-ebi, hall booking, spray scored on the server (`server/owambe.ts`, `owambe` suite). Not "invite these friends to my parlour" and not a player hired as DJ. |
| 3.6 | Daily location hunt, login streak, weekly career challenges, seasonal festivals | **Partial** | Three real-day hustles, a streak, a Sunday chest, a 40-tier season (`src/life/Hustles.ts`, `today`). Detective cases are clue chains (`cases`), not a daily map hunt. Harmattan haze is drawn (`WeatherSystem.ts`). No Detty December, Eid, Christmas, Independence, Eyo or Durbar calendar. |
| 3.7 | University hours, exams, a degree that unlocks ranks, JAMB, NYSC | **Partial** | UNILAG as an employer and short classes (`Classes.ts`, `jobs`). No degree gate, no JAMB, no NYSC posting. |
| 3.8 | Richest, career, creator, squad, house; some boards reset weekly | **Partial** | Naija Rich List against made-up tycoons, and online player worth (`src/life/RichList.ts`, `rich`). No career, creator, squad or house board, and no weekly reset. |
| 3.9 | Phone feed, photo posts, a link that drops a friend next to you | **Partial** | Yarn: posts, likes, one-tap share of a bet, a billboard or your rich-list place (`src/phone/apps/yarn.ts`, `server/feed.ts`, `yarn`). No photo-mode post, no X/WhatsApp/TikTok deep link. |
| 3.10 | A fictional exchange where player businesses can list | **Partial** | An investment app with stocks (`phone`). Prices are not the players' own companies. |

## Phase 4: performance for Nigerian phones

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 4.1 | First frame under 5 s on a cheap Android over 3G; under 5 MB first download | **Missing** (not measured) | Not timed on 3G in this audit. The world is built at start. |
| 4.2 | Low / medium / high, auto, manual, 30 fps cap, baked light on low | **Partial** | High / Balanced / Low, saved choice, step-down after a slow stretch (`src/graphics/GraphicsQuality.ts`, `graphics`). Desktop still starts on High. No hard 30 fps cap and no baked lighting. |
| 4.3 | glTF, Draco, KTX2, atlases, lazy interiors, service worker | **Partial** | `src/app/Updates.ts` registers `sw.js`. Geometry is still procedural and built up front. No Draco or KTX2. |
| 4.4 | Data saver: slower ticks, no voice, smaller snapshots | **Missing** | |
| 4.5 | Split `HUD.ts` | **Missing** | 4,296 lines in `src/ui/HUD.ts`. |
| 4.6 | Play economy, chat and jobs from the map with no 3D | **Partial** | The map opens for viewing (`WorldMap.ts`). It is not a play mode. |

## Phase 5: money from the outside

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 5.1 | Self-serve ads: logo, weeks, Paystack, approval, tap-through, a dashboard | **Partial** | Players rent a billboard with a headline and a colour; the server takes the rent; the face is painted in the world; a board that names your business lifts its takings (`server/ads.ts`, `ads` suite). No logo upload, no Paystack, no approval queue, no tap-out to an advertiser, no impressions dashboard. Danfo wraps, stadium boards, lagoon plots, radio reads and club screens are not inventory. |
| 5.2 | Real-money cosmetics only, never cash | **Missing** | Wardrobe and car paint are in-game. No real-money shop. |
| 5.3 | Hustle Pass, free and paid, cosmetics only | **Partial** | The season track pays in-game money, card packs and titles (`Hustles.ts`). There is no paid track. |
| 5.4 | Sponsored shops and label drops, marked as sponsored | **Missing** | |
| 5.5 | Payments checked by webhook | **Missing** | |

## Phase 6: launch

All **Missing**: landing page with a verified-only count, referral cosmetics, generated share cards, a creator programme, an outage compensation plan, and D1/D7/D30 analytics. Yarn can already share a line about a billboard or a rich-list place. That is not a share card.

## Decisions that need the owner

These cost money or need an account with another company. They do not block the next game work.

1. **Where the server runs** for real players. Render already has a service for this repo. Local and LAN work now.
2. **Database host.** SQLite is behind `server/store.ts`. Moving to Postgres later should be that file, not a rewrite of the rooms.
3. **Sign-in.** Guest and email links are built. Real email needs a sender. Phone OTP needs an SMS provider. Google needs an OAuth client in the owner's account.
4. **Payments** (Paystack or Flutterwave) are Phase 5. Do not take real money until the webhook exists.
5. **Colyseus.** Stay on `ws`.

## Order of work

Phase 1 runs. The next work is the holes in it, then the Phase 2 rows that are still missing, each with a `SAVE_SCHEMA_VERSION` bump and a migration before the feature.

1. ~~A bot load test of one process, then a supervisor and a "server busy" queue.~~ Done 5 November: see `docs/LOADTEST.md`. Open from that work: in the two-browser `online` suite, the lorry loaded at the port is not paid in the game (the server suite pays it), and `/ads` answers 401 before sign-in. Both fail the same way without these changes.
2. Move the next client-reported earners onto the server (fares, Eko Rides, the ladder), so the ₦48,000 allowance can shrink again.
3. Phase 2, in this order: ~~traits~~ (done 5 November), weekly Lapo instalments and a real eviction, PAYE and VAT, NEPA that actually switches appliances off, hours on the venues that never shut, then a player arrest with a record.
4. Do not rebuild multiplayer, the clock, the six need bars, the employer table, elections, marriage, owambe, Yarn, or the billboard rental. Extend those.
