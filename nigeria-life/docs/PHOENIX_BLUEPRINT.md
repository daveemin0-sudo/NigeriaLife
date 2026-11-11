# Project Phoenix: competitor intelligence, audit and release blueprint

Date: 11 November 2026. Baseline audited: `8690f5b` (live on `stabilise-core`, equal to `claude/next-steps`).
The older baselines named in the brief (`1a1847d`, `cursor/quiet-arrival-6e3b`) are superseded: `1a1847d` is the
2 November build and the Cursor branch no longer exists. Everything below was checked against `8690f5b`.

Every statement carries one of these labels:
- **tested**: run in the game by a browser test in `tests/e2e/` (the suite is named) or by hand in this audit.
- **in code**: read in the source, not run.
- **observed by owner**: seen in the owner's Lagos Life screenshots and descriptions (9 Oct to 10 Nov 2026).
- **documented**: on an official Lagos Life page. None in this report: see 1.1.
- **unverified**: claimed somewhere, checked nowhere.

## 1. The competitor

### 1.1 What could and could not be researched

- `lagoslife.app` and every `/wiki/...` page now return a permanent redirect to `vatarverse.com`, which redirects
  to `lagoslife.app/api/auth/handoff` (a sign-in step). Three separate fetches of the home page, the wiki index,
  how-to, your-character, needs, jobs and social all ended there. **The handbook is behind a login.**
- This session has no browser tool, so no playing as a player, no screenshots, no account use.
- **So:** every Lagos Life fact here is **observed by owner** (their screenshots and words, recorded in the
  memory notes since 9 October) or **unverified**. Nothing is **documented** or **tested** by me.
- **To unblock:** either paste the wiki pages (text or screenshots) into chat; or give the next session a browser
  with the owner signed in (Claude in Chrome, or the built-in browser), which uses the owner's own session without
  any password passing through chat; or note the current wiki URL if it moved.
- The "158 places" and "33 careers" figures in the brief are **unverified**: I could not see the lists.

### 1.2 Lagos Life as observed (owner's screenshots, 9 Oct to 6 Nov 2026)

**Frame.** Phone-first, light theme, slim white pills. Top: date and time, mood, players online, sound, money with a
+ button. Bottom nav: Home, Buy, Map, Phone. Six need bars by the avatar. Title screen with Continue and New life.

**Map.** Isometric painted city, every place a round icon pin, Names toggle, city tabs (Lagos, Port Harcourt,
Abuja), filter chips. Tapping a place opens a bottom sheet: activities at that place, "player shops here",
transport tiles (Trek free, Keke ₦100, Danfo ₦100, Okada ₦200, Cab ₦350, Driver) and one Go button.

**Interiors.** Cutaway dioramas from above a corner, full of other players with @names; Above, Inside and Eyes
camera views; a card with the place name, a flavour line, a chat box for people there, and chips per area.
Furniture opens a sheet of timed actions (bed: sleep 36 s, nap 15 s), a "tap to cancel" chip, Wake up.

**Home.** Catalogue with Downstairs/Upstairs, New, Storage, Design, price filter, search; beds, chairs, fans,
clocks, TVs, washing machines, consoles, AC, generator; paint walls and floors; build walls to split rooms.
Home HUD: quests 0/3, battle pass with tiers and a countdown, streak, "daily gem hunt", right column (stairs,
clean, plant, light, Radio, Go outside). Furniture looks real: wooden headboards, draped duvets, padded sofas,
cabinets with handles, porcelain bath.

**Jobs.** Shifts of an hour or more, the player held at the workplace (owner's words). Some jobs ask for a CV
and certificates. Pay at real Nigerian levels (owner's complaint that ours was ₦10–20k).

**Economy.** Register a business: pick the area (fees by area, ₦6M Ikorodu/Ajah/Wuse up to ₦30M Victoria
Island/Ikoyi/Banana Island), type (food spot, salon, provisions, fashion, pharmacy, events, dispatch, tech),
name, logo, then grow it. Buy businesses. Investments app. Profile card with Hustle rating, Credibility, level,
streak, View CV, Hire for a job (decorator, cook, DJ, driver, bodyguard, photographer, tutor; ₦1,000–₦10M).

**Travel.** Departures sheet: Air (Port Harcourt from ₦271k, Abuja from ₦302k; four cabin classes; surge;
insurance), My jet (about ₦5M fuel a trip), Chopper. Boarding view with Outside, Cabin and My seat cameras.
Driving: the car cannot leave its carriageway; big digital speed with the area name; round minimap; HORN, Get
out, BRAKE (hold to reverse) and GAS pedals; steering pad; Radio; bonnet view; "Bring someone along". Racing app:
Third Mainland Bridge, Ikorodu Road circuit, Ikeja to the airport; time trial or host a race; stakes; join by code.

**Social and events.** Relationship request at 40 closeness, Add as family, hustle jobs for other players with
ratings, CV with work, education and criminal record. Clubs with money spraying and hype-man banners, bottles
popped at the table (balling about ₦200M a night). Lagos State House with governor, senator and president tabs,
policies, cabinet, weekly elections. Venues with live events (TechThisWeek stage, Eko Hotels pool, buffet, spa).
Stadium events with ticket tiers. University short courses and paid matriculation. Courses app: 15 trades, levels
0 to 5, certificates. Apps the owner listed: contacts, bus company (fleet, routes, crew, books), police, court,
insurance, inDrive, staff, news, boutique, gadgets, family, invite, help and guide.

**Scale.** The owner saw "~70.2M views" and "164k active today" on its HUD (unverified figures).

**Not observed at all (unverified, do not assume absent or present):** character creation steps, birth lottery,
dreams, traits list, needs numbers, weddings in detail, children, voice notes, stickers, crews, courts, EFCC,
insurance mechanics, pets, gardens, seasonal events, monetization.

## 2. NigeriaLife as it is (baseline `8690f5b`)

Numbers from the code: 133k lines of TypeScript in `src/`; 108 browser test suites; 30 phone apps; 52 hand-built
place interiors in `PlaceSpecs.ts` plus the Lagos landmark interiors (`src/interiors/places/*`), the generic town
rooms for Abuja and Port Harcourt, hotels and homes; 116 named destinations across the three cities
(`src/destinations/data`); 36 employers with 5 grades each; a Node server with SQLite on Render.

| Area | Status | What exists, and how it is known |
| --- | --- | --- |
| World: Lagos | **tested** | Broad Street, Marina, Martins St, Odunlami, the expressway to Ikeja, Third Mainland Bridge, Lekki, Banana Island, Makoko, the lagoon with boats, side streets, footbridges, the Red Line. City plan validator (`plan`, `streets`, `sidestreets`, `expressway`, `lagoon`, `redline`). |
| World: Abuja, Port Harcourt | **tested** | Grid cities with districts, landmarks, traffic, people, every shop/office/hotel/bank/market with a door and a real room (`bigcities`, `citylife`, `towns`, `crosscity`). Weaker than Lagos: fewer hand-built places, generic rooms shared per kind. |
| Living streets | **tested** | Traffic in lanes with lights, parked cars in lay-bys, pedestrians, hawkers with voices, conductors, convoys, solid people/cars/poles, horn scatters (`roadcraft`, `bodies`, `convoys`, `danfo`). No NPC daily routines: people walk routes, they do not have homes, jobs or schedules. |
| Driving | **tested on PC, unverified on a phone** | Bicycle-model steering, grip, kerb barrier above 11 km/h, checked half-metre steps so cars never enter buildings, chase and bonnet cameras, racing (`steering`, `roadcraft`, `racing`). The owner still reports jerkiness on their Samsung A16: not reproduced on this laptop. |
| Vehicles owned | **tested** | Buy, park per city, fuel, service, own driver, jet and yacht, buses (`fleet`, `fuel`, `motors`, `rides`). |
| Interiors: Lagos | **tested** | Each place its own room with staff, stations, acted-out actions (eat, drink, haircut that changes the look, pray, sit in the crowd, hotel key and room, lift, church and mosque alive) (`interiors`, `places`, `buka`, `eating`, `worship`, `hotel`, `insideview`, `liveevents`). |
| Homes | **tested** | Rent, buy, build on land, plans per type up to 5-bed duplexes with an upstairs, catalogue of real-looking furniture, paint, partition walls, storage, generator and power cuts, cook/cleaner/driver, fridge, duvet, pets, garden (`home`, `homeplans`, `homedetail`, `furnish`, `duplex`, `ownhomes`, `nepa`, `staff`, `gardenpets`). Guests cannot visit a home yet: **missing**. |
| Character | **partial** | Creator with origin (Nepo/Lapo/Tech-bro), traits, wardrobe, barber cuts, realistic body builder (`traits`, `profiles`). No face/hair editor beyond cuts; no personality effects beyond traits; the look editor from the Lovable studio is **not ported**. |
| Needs, moods, skills | **tested** | Hunger, energy, hygiene, social, fun, bladder; decay while away; low needs dock pay; a skill per career with ranks (`needs`, `shiftskill`, `away`). |
| Jobs | **tested** | 36 employers, interactive shifts at the workplace in uniform, hour-long career shifts paid a day of a real salary by the server, shifts covered while away, certificates gate some jobs (`jobs`, `workplaces`, `companies`, `shiftskill`, server check). Open question: what the player does during the hour (the rounds are still short pieces). |
| Economy | **tested** | Server ledger with idempotency, bank, transfers, loans, rent, tax, dues, investments, businesses bought and registered by area, takings, land register, omo-onile, trade between cities (`money`, `server`, `dues`, `tax`, `land`, `omoonile`, `trade`, `bizdays`). |
| Phone | **tested** | 30 apps including Jobs, Bank, Shopping, Property, Land, Business, Invest, Health, Ride, Hustle, Odds, Ads, Rich List, Yarn, Gist, Games, Events, Cases, Garage, Motors, Racing, Staff, Studio, Titles, Trade, Marriage, Owambe, Nollywood, Spark, Ideas, Police, Learn (courses), Gadgets, Buses, Contacts, Settings with a how-to-play guide (`phone`, `phonelife`, `phonefit`). |
| Social | **partial** | Relationship tiers, messages, contacts, dating (Spark), marriage with rings and a traditional wedding, owambe with hall booking and sprayed money scored on the server, street chat, other players drawn with @names (`social`, `marriage`, `owambe`, `online`). **Missing:** friends list, house visits, children/family, crews, voice notes, stickers, shared homes. |
| Weddings and events | **partial** | A ceremony and an owambe exist. They are **not** the owner's "walk into a hall and be amazed": the hall is modest, guests are few, no stage lighting, photography or decoration choices. |
| Law and government | **tested** | Police with arrests, cells, bail, fines; cases app; EFCC office; a weekly election with a State House (`police`, `cases`, `politics`). Courts and insurance **missing**. |
| Multiplayer | **tested** | Accounts (guest, email, password), rooms, chat with a filter, remote players, vehicle sync, races checked by the server, the whole life saved to the account (`online`, `online_api`, `races_api`, `accountsave`). No load test above the `loadtest` script's small numbers: **unverified at scale**. |
| Weather, time | **tested** | WAT clock, day and night sky, rain and storms, lightning, fog (`sky`, `driving_weather`, `hours`, `today`). |
| Audio | **in code** | Voices for hawkers and conductors, horns, ambience, own songs in the car and club. No licensed music. |
| Graphics | **tested** | Three quality levels with auto step-down, shader warm-up at start, tiled culling in the big cities (`graphics`). First-load size is a 3.8 MB main chunk: **over the 5 s on 3G target, unmeasured on a real phone**. |
| Phone layout | **tested** | One sheet loaded last, 316 px fit, Hide button, folded cards, slim toasts (`phonefit`, `touch`). The owner still finds overlapping cards on screens the check does not open (rides in motion, the map place card): Cursor's `8690f5b` addressed room cards; the rest is **unverified**. |
| Saving | **tested** | Everything to the server account, guest upgrade, daily copy (`accountsave`, `saves`). Where the daily copy goes is **unverified**. |
| Security | **partial** | Money, land, shifts and races are server-decided; the client cannot grant itself money. Not done: rate limits on every route, an audit of what else the client is trusted on (needs, skills, inventory items), an abuse report flow. |
| Monetization | **missing** | Billboard rental by players exists; no real-money cosmetics, no payment webhook. |
| Performance | **unverified** | 34–41 fps on this Intel HD 620 laptop in Abuja. No measurement on a cheap Android phone. |

### 2.1 What is broken or weak today (from the owner's playtests, 7 to 10 Nov, and the code)

1. Cards still overlap on some phone screens (rides in motion, the map place card, others not yet found).
2. Driving feels jerky on a real Android phone (not reproduced on PC).
3. Abuja and Port Harcourt share one generic room per kind for the ordinary shops and offices; the named landmarks are their own rooms.
4. No NPC routines, no friends list, no house visits, no children, no courts, no insurance.
5. Weddings are thin.
6. First-load size and cheap-phone frame rate unmeasured.
7. `HUD.ts` (4,348 lines) and `Game.ts` (4,031 lines) carry too much: every change risks a regression.
8. The test run takes over an hour on the dev laptop; flaky under load.

## 3. Gap matrix

Statuses: 1 complete and tested · 2 partial · 3 documented but not tested · 4 missing · 5 broken · 6 needs an external dependency.
LL = Lagos Life as observed by the owner; NL = NigeriaLife at `8690f5b`.

| Feature | LL (observed) | NL | NL status | Gap and opportunity | Effort |
| --- | --- | --- | --- | --- | --- |
| First-time flow: title, account, character, starter home, tutorial | Title with Continue/New life; starter room modest | Creator, origin, starter room; how-to in Settings; no guided first hour | 2 | A guided first hour to the first ₦ earned, with the game's own voice | M |
| Character look | Face, hair, clothing, accessories | Wardrobe, barber cuts, body builder; no face/hair editor | 2 | Port the look editor; faces and hair players can own | L |
| Needs and moods | Six bars, moods | Six needs, mood, decay, effects on pay | 1 | Equal | — |
| Skills and courses | Courses 0–5, certificates | Learn app, 15 trades, certificates gate jobs | 1 (new, lightly tested) | Attend class in the world, exams in a hall | M |
| Jobs | Hour shifts, CV, promotions | 36 employers, hour shifts, grades, covered while away | 2 | What the player does during the hour: full shifts of real work, not short rounds | L |
| Home catalogue | Rich catalogue, paint, walls, storage | Same, plus power, staff, pets, garden, duvets | 1 | Ahead on homes; behind on guests | — |
| Home guests and parties | Visit friends' homes, parties | Missing | 4 | House visits and a party at home | M |
| Map | Painted isometric, pins, sheets, transport tiles | The real city from above, pins, search, filters, sheets, transport, city tabs | 1 | Equal or ahead; polish the sheet's size on phones | S |
| Interiors | Dioramas, three views, players inside | Same three views; Lagos rooms rich; Abuja/PH generic rooms | 2 | Make every Abuja/PH ordinary place its own room; more people inside | L |
| Living streets | Traffic, people | Traffic rules, hawkers with voices, convoys, solid bodies | 1 | Ahead; add NPC routines so the same people are seen daily | M |
| Driving | Kerb-bound, speedo, minimap, pedals, bonnet view, racing | Same set | 1 on PC, 5 on a phone per owner | Measure and fix touch driving on a real phone | M |
| Flights | Departures sheet, classes, cameras | Gate, taxi, take-off, cabin, landing; coaches; own jet from any city | 1 | Ahead (owner's words) | — |
| Public transport | Keke, danfo, okada, cab | Same, plus the Red Line and intercity coaches | 1 | Add the Blue Line and BRT | M |
| Economy and business | Register by area, grow, buy | Same, plus land, trade, loans, tax, dues | 1 | A business the player runs inside (serve customers, stock) | L |
| Social | Chat, bae, family, hire players | Chat, Spark, marriage, contacts, hire NPC staff | 2 | Friends list, hire other players, crews | M |
| Weddings and owambe | Not observed in detail | Ceremony and owambe exist, modest | 2 | The showcase: a hall that amazes (see 4) | L |
| Clubs and nightlife | Spraying, bottles, balling | Club with DJ, spray scored by the server, bottles | 1 | Equal | — |
| Government | State House, elections, policies | Weekly election, State House | 2 | Policies that change prices, a cabinet | M |
| Police and law | Police app | Police per city, cells, bail, cases app, police app, EFCC | 1 | Courts | M |
| Insurance | App observed | Missing | 4 | Car, home and flight insurance | S |
| Events and stadium | Ticket tiers, live venues | Stadium with tickets and matches, live venues, Nollywood, Studio | 1 | Equal | — |
| Pets and gardens | Observed in the catalogue | Both exist | 1 | — | — |
| Daily rewards | Quests 0/3, battle pass, streak, gem hunt | Hustles, streak, season track, quests | 1 | A daily hunt in the world | S |
| Multiplayer at scale | 164k a day (unverified) | Rooms, chat, remote players; untested above a handful | 3 | Load test to 500 concurrent before launch | M |
| Accounts and saving | — | Account saves everything | 1 | Backup off-site, data download, delete | S |
| Monetization | Unknown | Billboards only | 4 | Cosmetics and a pass, after launch | M |
| Performance on cheap phones | Smooth (owner) | Unmeasured | 3 | Measure on a real Android, cut the first load | M |
| Phone layout | Slim, consistent | Mostly fits; some screens still overlap | 2/5 | Finish the phone check on every screen | S |

## 4. How NigeriaLife surpasses it: physical immersion

The owner's standard is the player living in the world rather than choosing from menus. NigeriaLife already acts
out eating, haircuts, prayer, work in uniform, hotel keys and lifts; the opportunity is to make that true
everywhere and to make a few moments spectacular. In order of value:

1. **Weddings that amaze.** A hall with a lit stage, high table, aso-ebi guests at round tables, MC, DJ, the couple's dance, spraying, photographs, a cake; booking with decoration choices; invitations to other players; the result kept in the album. The owner named this first.
2. **Full shifts of real work.** A shift is an hour of things to do at the workplace: serve customers, stock shelves, examine patients, write code at a desk with a mini-game, drive the danfo route, with pay tied to how it went.
3. **Businesses run from inside.** Walk into your own shop; customers come; stock, staff, a till; the sign with your name outside.
4. **People with lives.** Named NPCs with homes, jobs and routines, seen at the same places daily; they remember the player.
5. **Friends in your home.** Visit, host, eat together, a party with music.
6. **Every Abuja and Port Harcourt place its own room**, as Lagos.
7. **Driving that feels right on a phone**, proven on a real device.
8. **Original touches no competitor has:** the power cut and generator life, omo-onile and land disputes, the lagoon and Makoko, trains, convoys, the three cities with real travel between them. Keep building on these.

## 5. The release plan

Target: public launch in December 2026. Launch Lagos complete; Abuja and Port Harcourt playable but marked as new.

### A. Mandatory before launch
| Item | Done when | Effort |
| --- | --- | --- |
| Phone layout on every screen | `phonefit` opens every screen (rides, flights, map card, dialogues, every app) at 316 and 390 px, upright and sideways, with no overlap and every button tappable; the owner confirms on the A16 | 3 days |
| Driving on a real phone | Measured frame-by-frame on an Android; the owner says it is smooth | 3 days |
| First-time player | New account to first ₦ earned in under 10 minutes with no dead ends, as a test and by hand | 3 days |
| Performance floor | 30 fps on a 2022 mid-range Android in Lagos; first load under 5 s on 4G; measured and recorded | 4 days |
| Full test run green | All 108 suites pass on a clean run; flaky checks fixed, not loosened | 2 days |
| Accounts | Sign-in on a second device verified by the owner; off-site daily backup verified by restoring one; delete account | 2 days |
| Security pass | Rate limits on every route; list what the client is trusted on; report-a-player | 3 days |
| Cross-city correctness | `crosscity` green; owner's play through Abuja and Port Harcourt without a city leak | done, re-check |
| Launch page and privacy note | Store listing, help page, privacy note, a Report a problem button | 1 day |

### B. High impact, finish before launch if A is done
Weddings that amaze (6 days); full shifts of real work for the 8 commonest jobs (6 days); every Abuja/PH ordinary place its own room (5 days); friends list and house visits (4 days); load test to 500 (2 days).

### C. Later updates
NPC routines; businesses run from inside; courts and insurance; the look editor; Blue Line and BRT; children and family; crews; policies that change prices; a daily hunt; voice notes and stickers.

### D. Too risky or expensive for this deadline
Licensed music; real-money shop and payments (needs legal and a provider); more cities; a native app store build; voice chat.

## 6. Architecture changes recommended
1. Split `HUD.ts` and `Game.ts` by surface (top bar, prompts, cards, modes) and by system (homes, rides, travel, jobs). Mechanical moves, no behaviour change, behind the full test run.
2. One `City` object that owns a city's places, doors, roads, lanes and rooms, so Abuja, Port Harcourt and Lagos are built the same way (Lagos is still the exception).
3. A `Place` record that is the single source for the map pin, the door, the room, the search, the ride target and the sign, so a place can never be on the map without a door or a door without a room.
4. Lazy chunks: load each city, each phone app and each interior on demand to get the first load under 5 s.
5. A `phone` test harness that opens every screen by name, so new screens are covered the day they are added.
6. The server: Postgres when a second process is needed; until then, nightly copies off Render to object storage, verified by a restore.

## 7. First implementations (this session, on `claude/next-steps`, not yet live)

1. **First-time player** (tested: `onboarding`, 9/9 on a 360 px phone with real taps).
   - Found: a brand-new visitor's title showed a made-up life ("Bayo · ₦175,000 · Continue"); Continue left them in the street with no name and nothing to follow.
   - Now: a first visit is welcomed with "Start your life"; one slim line guides them through a name and a look, walking, the phone, the first shift and the first pay; each step is ticked by what was really done; it can be skipped and never returns.
   - The name field is on every tab of the look editor and saves to the account (it only sat on the origin tab and did not change the account's name).
   - Jobs lists the shifts that can be taken now first (the starter shift was 4,000 px down, under 36 employers).
2. **Abuja's police station could not be reached on foot** (tested: `plan`, `cities`, `towns`, `police`, `crosscity`, 116 checks).
   - Found by the baseline run: FCT Police Command stood on Aso Rock's ground past the end of the road, failing the city plan.
   - Now it stands in Garki on Independence Avenue with a pavement at its door; Abuja's plan is clean and its four hotels are still there.
3. **Three checks brought up to date** with features added since they were written: 37 phone apps (was 32), door pins on the city maps, the bank's certificate rule.

## 8. Test baseline of the live build `8690f5b`

The full run of 109 suites takes several hours on the dev laptop (Intel HD 620). At the time of writing 28 suites
had run: 560 checks passed, 23 failed. Of the failures looked at so far:
- 6 were the police station's door (fixed in 7.2).
- 3 were checks out of date with new features (fixed in 7.3).
- `self` (the tap-on-yourself menu on a phone) stops with an error: **not yet looked at**.
- The rest are **not yet looked at**; some will be the load of two runs at once.
The run continues; this section is to be completed with the full list, and each failure either fixed or explained.

### 8a. Result of the investigation (11 Nov 2026)

Live build `8690f5b`, all 109 suites: 1374 of 1408 checks passed, 34 failed. Every failure was traced:

- Game bugs, fixed on the branch: the keke to the Red Line station took ₦500 and no ride began (2 checks); the Abuja police station door could not be reached on foot (6 checks).
- Checks behind the game, corrected after the behaviour was confirmed in play: jobs that need a course certificate (4), toilet doors built on first entry (1), takings halved without light (1), barber and pump cards (2), the family's levy before building (1), three stale counts.
- Faults in the checks themselves: self menu, hidden pieces, a scrolled chip, the supermarket's timed payout, and the online suite serving the old `dist` folder (it must be run with `GAME_STATIC` set to the build under test).
- Machine load: shop, home, social, land, account save and the server restart passed when run alone.

Development branch, all 109 suites in one run: 1445 of 1449; the 4 that failed (server, online, supermarket x2) were traced as above and pass when rerun: server 17/17, online 9/9, supermarket 10/10.

The competitor's handbook is now public and was read in full: see `LAGOS_LIFE_REGISTER.md` and `LAGOS_LIFE_HANDBOOK_FINDINGS.md`.
