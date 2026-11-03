# Nigeria Life — Master Build Prompt

> Paste everything below into Claude Code (or your coding agent) with the `NigeriaLife` repo open. Work through it phase by phase; don't start a phase until the previous one runs end to end.

---

## Context

You are working on **Nigeria Life** (`nigeria-life/`), a browser-based 3D life simulator of Nigeria built with **TypeScript + Vite + Three.js**. It already has: three cities (Lagos, Abuja, Port Harcourt), interstate road trips and flights, drivable vehicles, building interiors (bank, hospital, police, UNILAG, restaurant, airport, residential), a phone system, quests per city, a character creator, businesses, properties, jobs, loans, an ATM, weather, day/night, photo mode, and Nepo/Lapo/Tech-bro origins.

The goal is to become the **best Nigerian life sim on the market** — beating *Lagos Life*, the browser game that passed 1M players in ~3 days in October 2026. Study what made it win, match every core loop, then go beyond it with what we uniquely have (multiple cities, 3D world, driving, interstate travel).

**Rules:**
- Do not copy Lagos Life's code, art, text, or branding. Use original names, original UI, original writing. We take inspiration from *mechanics*, not assets.
- Keep `npx tsc --noEmit` clean after every change. Add/extend tests in `tests/e2e/` for every new system.
- Keep the existing art direction in `docs/ART-BIBLE.md`.
- Commit after each completed sub-task with a clear message.

---

## What Lagos Life does (the bar to clear)

1. **Real shared world.** Everyone is in one live Lagos: see other players on the map, real-time chat, ~100k+ concurrent at peak.
2. **Zero friction.** Opens instantly in any phone browser, no download, quick sign-up.
3. **Real-time clock.** The in-game day follows the real day (Nigeria time).
4. **Six needs** decaying in real time: Hunger, Energy, Fun, Social, Hygiene, Bladder. Fun punishes pure grinding.
5. **Careers:** ~14 careers, each with 5 promotion levels tied to one skill; promotion roughly doubles shift pay; some careers are night shifts.
6. **Origins + traits:** random, permanent Nepo vs LAPO start (LAPO starts with a microfinance loan repaid weekly), plus one of ~10 traits that speed a skill, change a need's decay, or boost activities.
7. **Housing ladder:** five tiers from a face-me-I-face-you room in Mushin (cheap weekly rent) up to Ikoyi / Banana Island (one-time purchase). Rent is due every Saturday.
8. **Income streams:** job shifts, side businesses (passive, but with random "bad day" losses), and land (appreciates; carries an omo-onile levy that varies by area).
9. **Tax** on gross pay. Vehicles reduce travel cost.
10. **NEPA power cuts** that switch off appliances; cope with generator, inverter or solar.
11. **~21 venues** with opening hours (clubs at night, hospital/police/radio 24/7). Nigerian music in clubs.
12. **Live events:** a governor election where players run for office and the winner sets city-wide policies (transport subsidy, minimum wage, food subsidy, steadier power); a daily location-clue hunt.
13. **Families / squads.**
14. **Monetisation from day one via in-world ads:** roadside billboards and lagoon plots rented weekly to real businesses, self-serve (upload logo, pay, goes live, tap opens their link).
15. **Weaknesses we must avoid:** a server outage on day 2, and an exploit that let players mint huge amounts of money (forced a reset). Player counts were questioned because sign-up had no verification.

---

## Where Nigeria Life stands today (audit)

**Strengths over Lagos Life:** 3 cities + interstate travel and flights, full 3D with driving, interiors, story quests, phone UI, photo mode, art bible, save-schema versioning, e2e tests, clean TypeScript build.

**Critical gaps:**
- **Multiplayer is not real.** `src/multiplayer/NetworkManager.ts` uses `BroadcastChannel`, which only talks between tabs in the *same browser*. Two people on different phones never see each other.
- **Saves are local only.** `BackendService` and `CloudSyncService` both write to `localStorage`; "cloud sync" is a fake code stored on the same device. Clearing the browser deletes the player.
- **Economy is client-authoritative.** Any player can edit money in devtools — exactly the exploit that hurt Lagos Life.
- **Needs:** only health, energy, hunger, streetCred. Missing fun, social, hygiene, bladder.
- **No real-time clock**, no weekly rent cycle, no tax, no traits, no career ladders with skills, no land/levy, no venue hours, no power-cut system (NEPA exists only as a minigame), no elections, no daily hunt, no squads, no leaderboards, no ad inventory.
- **Weight:** 3D Three.js is heavy for low-end Android phones on mobile data — the majority of Nigerian players. `HUD.ts` is 3,600+ lines and needs splitting.

---

## Phase 1 — Real online foundation (highest priority, do first)

1. **Game server.** Add `server/` with Node + TypeScript using **Colyseus** (or `ws` with a room model). One room per city, sharded into instances of ~200 players with interest management (only send nearby players). Client sends inputs/intents at 10–20 Hz; server broadcasts compact snapshots; client interpolates (reuse `RemotePlayer.ts`).
2. **Replace `BroadcastChannel`** in `NetworkManager` with the server connection, keeping the same public API so the rest of the game doesn't change. Keep BroadcastChannel as an offline/dev fallback.
3. **Accounts.** Phone-number OTP or email magic link + Google sign-in, plus a "play as guest" path that can be upgraded later without losing progress. Rate-limit sign-ups; mark verified vs unverified accounts so player counts are honest.
4. **Database.** Postgres (Supabase or Neon) for accounts, wallets, properties, businesses, careers, inventory, ledger. Redis for presence, chat fan-out and leaderboards.
5. **Server-authoritative economy.** Move every money change in `BackendService` / `TransactionService` to server endpoints. The client *requests* (“complete shift”, “buy property”); the server validates timing, energy, location, price and writes an append-only ledger row. Add idempotency keys, per-action cooldowns, and anomaly alerts (e.g. wallet grows > X in Y minutes). Keep `SaveSchema` migrations for importing existing local saves once.
6. **Chat:** city chat, proximity chat, DMs, profanity filter (English + Pidgin + Yoruba/Igbo/Hausa slurs list), report/mute/block, slow-mode, admin moderation tools.
7. **Reliability:** health checks, auto-restart, horizontal room scaling, graceful "server busy — join queue" screen, status page. Plan for 100k concurrent from day one; load-test with bots before launch.
8. **Admin panel** (`admin/`): live player count, economy totals, ban/mute, grant compensation, edit prices, run events.

## Phase 2 — Match every core loop

1. **Real-time clock (WAT).** Game hour = real Africa/Lagos hour. Weekly cycle with rent due Saturday, loan repayments weekly, wages paid per shift.
2. **Six needs** (`PlayerStats`): add fun, social, hygiene, bladder alongside hunger and energy; health becomes a derived/consequence stat. Each decays in real time (slowly while offline, capped so nobody returns to a dead character). Tie fixes to the world: eat (Mama Put, bukka, suya, QuickChop delivery), sleep at home, shower/toilet (home, public toilet, hotel), fun (club, cinema, beach, owambe, football viewing centre), social (talk/emote with players, events). Low needs reduce job performance.
3. **Careers.** Build ~16 careers with 5 ranks each, each tied to a skill that levels through practice and courses: banking, tech, medicine, law, teaching, police, music, DJ, content creator, fashion design, okada/keke/danfo transport, trading at Balogun/Alaba, oil & gas (PH), civil service (Abuja), real estate agent, chef. Night shifts for music/DJ/security. Promotion ~doubles pay. Shifts happen at the actual workplace building with a short skill-based minigame (reuse existing minigame patterns).
4. **Origins + traits.** Keep Nepo / Lapo / Tech-bro, make origin permanent; Lapo starts with a microfinance loan with weekly repayments and late fees. Add ~12 original traits (e.g. "Sharp Mouth" faster negotiating, "Early Bird" bonus on morning shifts, "Owambe Spirit" fun decays slower at parties, "Agbero Connect" cheaper transport, "Bookworm" faster skill gains, "Iron Belle" hunger decays slower).
5. **Housing ladder per city.** Lagos: face-me-I-face-you (Mushin/Ajegunle) → self-con (Yaba/Surulere) → flat (Gbagada/Ikeja) → Lekki apartment → Ikoyi/Banana Island purchase. Abuja: Nyanya/Kubwa → Wuse → Maitama/Asokoro. PH: Diobu/Rumuokoro → GRA → Old GRA. Tier affects need decay, safety, guests, storage, and social status shown on profile. Eviction flow with grace period if rent is missed. Extend `HouseDecorationSystem` so homes are visitable by friends.
6. **Land.** Buy plots that appreciate over time with an area-specific omo-onile levy and random disputes (pay settlement or go to court). Let players build on land (shop, house, filling station) later.
7. **Side businesses** with daily random events (bad day, police harassment, NEPA, good day), staff to hire, stock to buy. Feed the existing `BusinessEnterprise` model.
8. **Tax** panel on payslips (PAYE brackets, simplified), with VAT on purchases.
9. **NEPA power system.** Each district has a power schedule with random cuts; appliances (fridge, AC, TV, PS5) stop working without power; generator (needs fuel, noise annoys neighbours), inverter, solar as upgrades. Businesses lose revenue in outages.
10. **Venues with opening hours.** At least 25 across the three cities, each with an activity: clubs (night), shrine-style live music venue, amala spot, beach, cinema, church/mosque, gym, market, hospital/police/radio 24/7. In-club music from licensed or royalty-free Nigerian tracks (partner with indie artists — also an ad product).
11. **Police, jail and bail.** Crime and traffic offences (running checkpoints, no papers, reckless driving) lead to arrest, cell time measured in real minutes, bail payable by self or a friend, record that affects certain careers. Bribery choices with risk.

## Phase 3 — Go beyond Lagos Life (our edge)

1. **National map, not one city.** Make interstate travel a core loop: cheaper goods in one city, sell in another (Aba → Lagos trade runs, Kano grains, PH seafood). Add cities over time: Ibadan, Kano, Enugu, Benin, Calabar (Carnival event), Kaduna, Owerri.
2. **Driving & transport economy.** Own a danfo, keke or okada and drive routes picking up NPC/real passengers; hire drivers; license and LASTMA-style fines; fuel prices that change weekly. Car ownership shows on profile; cars park in front of your house.
3. **Governance at three levels.** Ward councillor → state governor (per city) → national president (season-long event). Campaigns, posters on in-world billboards, debates in a town hall venue, voting with verified accounts only, winners pick from a policy menu with real in-game effects for a term, plus approval ratings and impeachment.
4. **Families, squads and relationships.** Friends list, squads with a shared treasury and HQ, marriage with traditional + white wedding events (aso-ebi colours chosen by the couple), children who grow and inherit, contributions/ajo/esusu savings circles between players.
5. **Owambe and social events.** Players can host parties at their house or a rented hall, invite friends, spray money on dancers (money actually moves), hire a DJ player. Birthdays, naming ceremonies, burials.
6. **Daily, weekly and seasonal content.** Daily hunt (clue → location), daily login streak, weekly challenges per career, seasonal events (Detty December, Eid, Christmas, Independence Day 1 Oct, Calabar Carnival, Eyo festival, Durbar), Harmattan season visuals.
7. **Education.** UNILAG/ABU/UNIPORT enrolment: attend classes at real hours, exams, degree unlocks higher career ranks; JAMB minigame; NYSC posting to another city.
8. **Leaderboards and status.** Richest, highest career rank, most-followed creator, top squad, best house — per city and national, with weekly resets for some boards so new players can win.
9. **In-game social media.** A phone app feed (posts, likes, follows) where content creators earn from engagement; screenshots from photo mode post directly; one-tap share to X/WhatsApp/TikTok with a deep link that drops friends next to you (viral loop).
10. **Stock market + crypto (virtual).** A fictional exchange where businesses players own can IPO; prices react to player activity and events. Clearly virtual, no real-money conversion.

## Phase 4 — Performance for Nigerian phones

1. **Target:** first playable frame in < 5 s on a ₦80k Android over 3G; initial download < 5 MB, the rest streamed per city/district.
2. **Quality tiers** auto-detected (low / medium / high): low drops post-processing, shadows, reduces draw distance, uses baked lighting, instanced meshes, lower-poly NPCs, 30 fps cap. Manual override in settings.
3. **Asset pipeline:** glTF + Draco/Meshopt, KTX2 textures, texture atlases, lazy-load interiors, cache with a service worker (PWA install, offline main menu).
4. **Data saver mode:** lower network tick, no voice, compressed snapshots.
5. **Refactor `HUD.ts`** (3,600+ lines) into per-feature UI modules with a shared component layer; keep every existing interaction working.
6. **2D fallback / map mode** for very weak devices: play the economy, chat and jobs from a top-down map without rendering the 3D world.

## Phase 5 — Monetisation (ethical, ad-first like Lagos Life, then more)

1. **In-world ad inventory:** billboards on major roads in every city, danfo/BRT body wraps, stadium boards, lagoon/beach plots, radio-station ad reads in cars, club sponsor screens. Self-serve booking page: upload logo/creative, pick slots and weeks, pay via Paystack/Flutterwave, admin approval queue, goes live, tap opens advertiser link, advertiser gets an impressions/taps dashboard.
2. **Cosmetics only** for real money: outfits (ankara, agbada, aso-oke, gele, streetwear collabs), car paint, house décor, emotes, name colours. **No buying in-game cash** — keep the economy fair.
3. **Battle-pass style "Hustle Pass"** per season with free and paid tracks (cosmetics only).
4. **Brand partnerships:** real Nigerian brands as in-world shops (clearly marked sponsored), music label drops in clubs.
5. Verify every payment server-side via webhook; never trust client.

## Phase 6 — Launch & growth

1. Landing page with live player count (verified accounts only), trailer GIFs, "play now" with no install.
2. Referral codes that give both players a cosmetic and a small starter bonus.
3. Shareable cards: "I just bought a Lekki duplex in Nigeria Life" auto-generated image with link.
4. Creator programme: early access + custom outfits for Nigerian X/TikTok creators.
5. Incident plan: if the server goes down, auto-compensate every active player in virtual cash and post a status update within 15 minutes.
6. Analytics: retention D1/D7/D30, session length, where players quit, economy inflation dashboard.

---

## How to work

- Start by reading the codebase and writing `docs/ROADMAP.md` with a checklist of every item above, marked done / partial / missing, with file paths.
- Then do **Phase 1** fully. Show me the server running locally with two browsers on different devices seeing each other and a server-validated job shift paying money.
- For each later phase, propose the data model changes (`src/backend/types.ts` + DB schema + `SAVE_SCHEMA_VERSION` bump) before writing features.
- After each phase: run `npx tsc --noEmit`, run e2e tests, test on a low-end mobile viewport (360×740, 4× CPU throttle), and summarise what changed and what's next.
