# NigeriaLife first release: the three-city foundation

*Assessment of 15 Nov 2026, branch `claude/next-steps` at commit `9f92883`. Documentation only.*

## 1. Adopted decisions (standing project rules, 15 Nov 2026)

1. **The first release contains Lagos, Abuja and Port Harcourt.** It is not reduced to one city.
2. **The long-term vision is all 36 Nigerian states.**
3. **Visible product progress.** Every development cycle delivers measurable progress a player can see or do. Critical infrastructure, security, stability and performance work is allowed when it directly supports the product.
4. **The nine requirements in section 4 are the first release's acceptance criteria.**

Also accepted: A16 repair Step 1 and limitations L1 and L2 (commit `9f92883`), as complete on the development branch. That is not a merge or a deployment.

## 2. How each statement here is graded

| Grade | Meaning |
|---|---|
| **Complete** | Works end to end, and an automated test or measurement shows it |
| **Partial** | Works, with gaps a player will hit (named) |
| **Missing** | Not there |
| **Unverified** | Not yet measured or tested; no claim is made either way |

Sources:
- `QUALITY_AUDIT.md` (14 Nov), whose probes walk into rooms as a player would.
- `A16_INVESTIGATION.md`.
- The code.
- The automated test suites.
- The user's two Samsung A16 reports.

Laptop and phone results are kept apart.

## 3. What already works, city by city

### Lagos
- **Getting about:**
  - **Rides:** the Ride app's 61 places. A ride survives a reload or Chrome killing the tab, and the fare is taken once (tests, all cities).
  - **Turn back:** returns you to the pickup.
  - **Map cab.**
  - **Driving:** your own car, and your car with a hired driver.
  - **The Red Line train:** reached by keke when you are far from a station.
  - **Coaches** from Jibowu Motor Park.
  - **Flights** from Murtala Muhammed Airport.
- **Places:**
  - 60 of the 61 places offered have a door.
  - **Walk-in rooms checked by the audit:** Mama Put, Everyday Supermarket, Executive Barbershop, the bank (weekdays).
  - **Card or menu only (no room):** the cash machine, salon, NaijaBet, Sabo Textiles, Victoria Residence, the danfo terminus, pharmacy, Victory Phones, filling station, God's Grace Auto Works, the building site and the police checkpoint.
  - The salon and Sabo Textiles show a dead "Enter / Inspect" button.
- **Work:** 20 employers. Shifts are 4 rounds long.
- **People:** 23 named street people to talk to. Living City routines (morning, work, lunch, evening, night), and stalls that open and close.
- **Owning things:** renting and buying homes, building on land, furnishing, a fridge, cars, jets, registering a business. Money and land are held by the game server.
- **Account:** progress saved to the account and back on any browser.
  - Every journey's start and end are sent at once (L2).
  - A last copy is sent as the page closes.
- **Quests:** 3.

### Abuja
- **Getting there:**
  - coach to Utako Motor Park (₦42,000, affordable for a new player)
  - flight (₦4.2 million)
- **Getting about:**
  - rides to the Ride app's 81 places (tested, including places beyond the old 400 m limit)
  - Turn back and the map cab
  - no train
- **Places:**
  - 20 of 81 places can be entered.
  - **Walk-in rooms:** supermarket, bank, market, hotel, offices, National Assembly, Jabi Lake Mall, National Hospital, FCT Police, the airport.
  - **But:** every supermarket, bank, market and office door in the city opens the *same* room. Apartment blocks, houses, duplexes and bungalows have no door or card.
  - **Card only:** Aso Rock (lookout), the Utako goods shed (trade), Federal Secretariat, Millennium Park.
- **Work:** 1 employer (the town offices).
- **People:** Living City routines and food stalls, but nobody in the street to talk to. Named people exist only inside rooms (nurses, desk sergeants, cashiers).
- **Trade:** buying and selling goods between cities at the Utako goods shed.
- **Quests:** 3.

### Port Harcourt
- **Getting there:** coach to Waterlines Motor Park (₦36,000–38,000) or flight.
- **Getting about:** rides to the Ride app's 33 places, Turn back, map cab; no train.
- **Places:**
  - 15 of 33 places can be entered.
  - **Walk-in rooms:** supermarket, bank, market, hotel, offices (shared, as in Abuja), the mall, Government House, UPTH, the police, the airport.
  - **Card only:** the refinery, Bole King, Uniport, the motor park, Pleasure Park.
- **Work:** 2 employers (the refinery and the town offices).
- **People:** routines and food stalls along Aba Road, but nobody to talk to in the street. Two stalls stand in front of the land plot at 22 Aba Road (a bug).
- **Trade:** at the Waterlines goods shed.
- **Quests:** 3.

## 4. The nine requirements: where each stands

| # | Requirement | Lagos | Abuja | Port Harcourt | Overall |
|---|---|---|---|---|---|
| 1 | Three accessible, functioning cities | **Complete** (reachable; 60 of 61 places have a door) | **Partial** (25% of places open) | **Partial** (45%) | **Partial** |
| 2 | One consistent character and progression system | **Partial** | **Partial** | **Partial** | **Partial**: careers, courses, certificates, CV and quests run the same in all three, but certificates are checked only on the phone (anyone could fake one). Character creation and appearance are **unverified** (not audited). |
| 3 | Working transportation between locations | **Complete** | **Complete** | **Complete** | **Complete on the laptop** (ride, coach and flight tests). On the A16: rides **unverified** (laptop phone emulation passes); driving smoothness **unverified** since the Nov driving fixes. |
| 4 | Meaningful jobs and economic activities | **Partial** (20 employers; short shifts) | **Missing** (1 employer) | **Missing** (2) | **Partial**. Whether a new player can earn and spend sensibly in the first hour is **unverified** (not yet measured in real minutes). |
| 5 | Functional buildings and interiors | **Partial** (several places card-only) | **Partial** (shared rooms; homes have no doors) | **Partial** (shared rooms) | **Partial** |
| 6 | NPCs with everyday routines | **Complete** | **Partial** (routines, no one to talk to) | **Partial** (as Abuja; stall bug) | **Partial** |
| 7 | Property and business ownership | **Complete** | **Partial** (can be owned; no home has a door to go in) | **Partial** | **Partial** |
| 8 | Reliable saving and accounts | **Partial** | **Partial** | **Partial** | **Partial**: progress and journeys are saved to the account (tested). There is no password reset or account recovery; the save history keeps only 5 versions (a few minutes); backups sit on the same server disk. |
| 9 | Performance suitable for the Samsung A16 | **Missing** (8.6 fps on foot; a 10 s freeze on first map open; start-up 16–30 s) | **Missing** (19 fps) | **Missing** (20 fps; heaviest city) | **Missing**. Measured on the A16. Real phone memory (what Android weighs) is **unverified**. |

**In one line:** one requirement is complete (transport), seven are partial, and one is missing (A16 performance). Lagos is furthest along. Abuja and Port Harcourt are reachable and alive, but thin.

## 5. Remaining work to reach the first release

Only what the nine requirements need:

| # | What is left |
|---|---|
| 1 | Every place offered in Abuja (61) and Port Harcourt (18) opens, or clearly says what it is (a landmark, an open space). |
| 2 | Certificates and course levels checked by the server. Character creation reviewed. |
| 3 | Confirmed on the A16 in one short session of normal play (the report records it). |
| 4 | Jobs that fit each city: Abuja's civil service, estates and institutions; Port Harcourt's oil and gas, port and markets. Shifts long enough to matter. A first hour that lets a new player earn and spend. |
| 5 | Each building kind in Abuja and Port Harcourt has its own rooms, not one shared room. Lagos's card-only shops get rooms where a player would expect one. Homes in Abuja and Port Harcourt have doors. |
| 6 | Named people in Abuja's and Port Harcourt's streets. The 22 Aba Road stall bug fixed. |
| 7 | Owned and rented homes enterable in every city. |
| 8 | Password reset and account recovery; a longer save history; backups off the server's disk; fares settled by the server (L4). |
| 9 | Freezes removed (first map, room, ride, flight); the 320 px screen layout fixed; cameras fixed; per-frame waste cut; a city built only when visited; then targets met on the A16. |

**Toward 36 states:** "a city as data", and loading a city when visited, are built as part of milestones 1 and 2 below, not as a separate project.

## 6. Milestones, in order

Each milestone ends with something players notice, and is tested in all three cities. No dates are given. Each is approved separately before it starts.

| Milestone | Player-facing result | Covers requirements | Done when |
|---|---|---|---|
| **M1. It runs on the A16** | No 10 s freeze. Nothing covers your character or buttons. A wider camera view on an upright phone. Smoother walking and driving. | 9 (and 3 on the phone) | No first-time freeze over 1 s (laptop at A16 speed). The 320 px screens pass. One short A16 session meets targets set from the A16 baseline. |
| **M2. Every place opens** | Abuja and Port Harcourt places open into their own rooms, by building kind. Homes have doors. Lagos's shops have rooms. | 1, 5, 7 | 100% of places offered in each city open, or say clearly what they are. No shared room behind different kinds of door. |
| **M3. Work and money in every city** | Real jobs that suit each city. Shifts worth doing. A first hour that makes sense with starting money. | 4, 2 (server-checked certificates) | Each city offers jobs from entry level up. A new player can earn their way to a coach fare. Certificates cannot be faked. |
| **M4. People in every street** | Named people to greet, talk to and do business with in Abuja and Port Harcourt. The Aba Road stall moved. | 6 | Every city has named street people. All Living City tests pass in all three. |
| **M5. Accounts players can trust** | "Forgot password" works. Progress cannot be lost. Fares are settled by the server. | 8 | Recovery by email or recovery codes works. Backups are held off the server. Save history covers days, not minutes. |
| **M6. First-release check** | — | All nine | Every requirement is graded **Complete** in all three cities, with evidence. Anything short goes back to its milestone. |

**Why this order:**
- M1 comes first because the A16 is the target device and slowness hides everything else.
- M2 to M4 make Abuja and Port Harcourt real, in the order a player meets the gaps: closed doors, then nothing to earn, then nobody to talk to.
- M5 is mostly invisible, so it is paired with "Forgot password" and can run alongside M3 or M4 if you choose.
- M6 checks the whole.
