# Nigeria Life roadmap

The checklist for the "Master Build Prompt" (2026-10-23), measured against the code as it is,
not as described. **Done** means a browser test in `tests/e2e/` drives it in the running game.
**Partial** says what is missing. **Missing** is not there. Detailed status of what exists is in
`STATUS.md`; this file is the plan.

Audited 2026-10-23 at `16933f0` (branch `stabilise-core`).

## Corrections to the brief's audit

- *"Multiplayer is not real; BroadcastChannel only."* Partly out of date. `server/world-server.mjs`
  (no dependencies, HTTP + Server-Sent Events) already joins games on different devices: one
  ownership registry with a lock (plots, buildings, vehicles, homes, businesses, listings, offers),
  and players' movements, chat and private messages passed between games. `NetworkManager` uses it
  when a server is set (`?server=` or Settings) and falls back to `BroadcastChannel` otherwise.
  The `server` suite proves two devices see each other and trade. What is true: it does **not**
  check rules or hold money, has no accounts, sends every packet to everyone, and one process
  holds everything.
- *"Saves are local only; cloud sync is fake."* True. `BackendService` and `CloudSyncService`
  write to `localStorage`.
- *"Economy is client-authoritative."* True: 63 calls outside `BackendService` change money
  in the browser (40 of them in `HUD.ts`), and `NetworkManager.sendTransfer` moves money between
  players peer to peer.
- *"Only health, energy, hunger, streetCred."* Out of date in one way: `fun`, `social`, `hygiene`
  and `bladder` exist and decay (`BackendService.updateVitals`), but nothing reads them: no bar,
  no effect, no way to restore them. Numbers that do nothing.
- *"No real-time clock."* Out of date: real Lagos time (Africa/Lagos zone) is the default clock
  (`SkyEnvironmentManager`, `sky` suite). The weekly cycle on top of it is missing.

## Phase 1: real online foundation

Built 2026-10-23 (`server/`, `src/online/OnlineAccount.ts`). Proved by `online_api` (the
server's rules through its real interface, 18 checks) and `online` (two separate browser
processes on this machine's network address, one a 360 x 740 phone with its processor slowed
four times: accounts, seeing each other, chat, money edited in the browser not surviving, a
port shift paid by the server; 8 checks). Two physical phones have not been tried.

**Playing on a home network now:** `npm run build`, then `npm run server` on the computer, and
open `http://<that computer's address>:8787/` on each phone. Set `NL_ADMIN_KEY` for the admin
page at `/admin`.

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 1.1 | Game server, rooms per city, interest management, 10-20 Hz | **Done** | `server/rooms.ts`: a room per city in instances of 200, only players within 120 m (and in the same building) sent, 10 Hz, unchanged players not resent. One process: several processes behind a balancer is not built. |
| 1.2 | `NetworkManager` over the server, same API, BroadcastChannel fallback | **Done** | WebSocket wire when on a server; the old relay and BroadcastChannel still work without one. |
| 1.3 | Accounts: guest, upgrade, email / phone / Google, rate limits, verified flag | **Partial** | Guest at once, email sign-in link that keeps the guest's progress, verified counted apart, rate limits (`server/accounts.ts`). Email is printed in the server log until a sending service is chosen; phone OTP and Google need outside accounts (decisions below). |
| 1.4 | Database | **Partial** | Node's built-in SQLite behind `server/store.ts`. Postgres and Redis are not set up: one server process does not need Redis; many will. |
| 1.5 | Server-authoritative economy | **Partial** | The server holds every online wallet and an append-only ledger with idempotency keys; nothing goes below zero; a number edited in the browser is gone at the next change or reload. **Checked by the server:** job shifts at the port and the building site (taken on, at the worksite at start and end, timed by the server, paid from its grade record); transfers between players; every sale between players and every rent payment written into the registry (the server takes the money from whoever sends the change and pays whoever is owed, refuses the change if the money is not there, and marks the payout paid). Money moved inside a registry change only reaches the server once the change is kept. **Still done by the game and reported:** every other earning and spending; spending is always accepted, earning up to ₦60,000 in ten minutes, more is held for the admin to release. Energy and the prices of things bought from the game are still the game's word. A local save brings at most ₦2,000,000 onto a new account, once. |
| 1.6 | Chat: city / proximity / DM, filter, report, mute, block, slow mode, moderation | **Done** | On the server (`rooms.ts`, `chatFilter.ts`, `/social/*`, admin mute and ban); Block and Report on another player's card (a report carries what they said). The word list needs native speakers' review before launch. |
| 1.7 | Reliability | **Partial** | `/health`, clean shutdown, the game reconnects by itself. No supervisor to restart it, no queue screen, no status page, no load test with bots. |
| 1.8 | Admin panel | **Done** | `/admin`: online by instance, verified accounts, money held, earnings in the last hour, held money with release / refuse, alerts, reports, any player's ledger, mute, ban, grant. |

Found on the way: the game could not start at all on a phone opening it from a computer on the
home network, because `crypto.randomUUID` only exists on https pages (`src/utils/ids.ts` now
falls back). And chat put the sender's name into the page without escaping it.

## Phase 2: core loops

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 2.1 | Real-time WAT clock, weekly cycle (rent Saturday, weekly loans, wage per shift) | Partial | Clock done (`sky` suite); no weekly cycle. Wages are per piece of work (`jobs/HandWork.ts`). |
| 2.2 | Six needs that matter, fixed in the world, offline decay capped | Partial | Hunger and energy matter (eating, sleeping: `buka`, `home` suites). The other four decay and do nothing. |
| 2.3 | ~16 careers, 5 ranks, skill-tied, shifts at workplaces | Partial | Two real employers on one module (`jobs/Employment.ts`, `jobs/HandWork.ts`: Apapa Port, Eko Plaza site); the phone's other "shifts" are timers. |
| 2.4 | Permanent origins, Lapo weekly loan, ~12 traits | Partial | Origins exist (`originDestiny`: nepo / lapo / tech_bro); no traits; loan repayment not weekly. |
| 2.5 | Housing ladder per city, eviction | Partial | Homes, rent and buying exist (`realestate/`, `housing/`); no ladder by area, no eviction. |
| 2.6 | Land with appreciation, omo-onile levy, disputes, building | Partial | Plots, building, market, letting done (`land` suite); no appreciation, levy or disputes. |
| 2.7 | Side businesses with daily events, staff, stock | Partial | Businesses pay takings; no events, staff or stock. |
| 2.8 | Tax (PAYE) and VAT | Missing | |
| 2.9 | NEPA power: schedules, appliances off, generator / inverter / solar | Partial | `LagosStreetLifeSystem` blackout toggle and an inverter item; appliances do not stop. |
| 2.10 | 25+ venues with hours and activities | Partial | One hours table (`destinations/Hours.ts`) kept by bank, university, supermarket, buka, stadium, club (`hours` suite). |
| 2.11 | Police, jail, bail, record | Missing | Agbero / checkpoint encounters only. |

## Phase 3: beyond Lagos Life

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 3.1 | National trade runs, more cities | Partial | Three cities, flights and coaches (`flights`, `coaches`, `cities` suites); no trade goods. |
| 3.2 | Transport economy (own a danfo, routes, fines, fuel prices) | Partial | Danfo fares from the bus-stop queue (`danfo` suite); vehicle ownership (`vehicles`, `land`); no hired drivers, licences or fuel price. |
| 3.3 | Elections at three levels | Missing | |
| 3.4 | Families, squads, marriage, ajo / esusu | Partial | Relationship tiers (`social` suite); no squads, marriage or savings circles. |
| 3.5 | Owambe and parties with money spraying | Missing | The nightclub exists (`club` suite). |
| 3.6 | Daily hunt, streaks, weekly challenges, seasonal events | Missing | |
| 3.7 | Education, JAMB, NYSC | Partial | University with short courses; no degrees or NYSC. |
| 3.8 | Leaderboards | Missing | Needs the server economy first (1.5). |
| 3.9 | In-game social media and share links | Missing | Photo mode exists. |
| 3.10 | Virtual stock market | Partial | An investment app with stocks (`phone` suite); not linked to players' businesses. |

## Phase 4: performance for Nigerian phones

| # | Item | Status | Where / what is missing |
| --- | --- | --- | --- |
| 4.1 | First frame < 5 s on a budget Android over 3G; < 5 MB first download | Missing (measured) | One 2.3 MB script (minified) plus 0.15 MB CSS; everything built at start. Not yet measured on 3G. |
| 4.2 | Quality tiers, auto-detected, manual override, 30 fps cap | Partial | High / Balanced / Low with one automatic step-down (`graphics/GraphicsQuality.ts`, `graphics` suite); no fps cap, no detection before the first frame. |
| 4.3 | glTF + Draco / Meshopt, KTX2, atlases, lazy interiors, service worker | Missing | Everything is procedural geometry built at start; no service worker. |
| 4.4 | Data saver mode | Missing | |
| 4.5 | Split `HUD.ts` | Missing | 4,155 lines. |
| 4.6 | 2D map-only mode | Partial | The map works without the street for viewing; not a play mode. |

## Phases 5 and 6: money and launch

All **Missing** except: billboards are drawn as scenery (`Roads.ts`, `SignageLibrary.ts`) but
are not inventory. Payments, cosmetics shop, pass, referrals, share cards, analytics, landing page
and incident plan all need the server and accounts of Phase 1 first.

## Decisions that need the owner (do not block local work)

These cost money, need accounts with outside companies, or decide what the game is:

1. **Where the server runs** for real players (a VPS, Render, Fly.io...). Local and LAN work now.
2. **Database host.** Phase 1 uses Node's built-in SQLite (`node:sqlite`, no dependency) behind
   one small storage module, so moving to Postgres (Supabase or Neon) later changes one file.
3. **Sign-in providers.** Guest play and email sign-in links are built; in development the link
   is printed by the server. Real email needs a sending service; phone OTP needs an SMS provider
   (Termii, Twilio); Google sign-in needs an OAuth client made in the owner's Google account.
4. **Payments** (Paystack / Flutterwave): Phase 5.
5. **Colyseus or not.** Phase 1 uses the small `ws` package instead: the game already has its own
   message format and interpolation (`RemotePlayer.ts`), and Colyseus would mean rewriting
   `NetworkManager` into its state-sync model for no gain at this size. Rooms and interest
   management are a few hundred lines on `ws`.

## Order of work

1. Finish Phase 1: a load test with a few hundred bot players to find the first limit of one
   process; a supervisor that restarts the server.
2. Move the next earners onto the server, biggest first (business takings, building income), so
   the ₦60,000 allowance for game-reported money can shrink.
3. Phase 2 starts with its data model for review: the six needs, traits, the weekly cycle
   (rent, loans, tax) as server tables and `SAVE_SCHEMA_VERSION` changes, before any feature.
