# NigeriaLife quality roadmap (proposed 14 Nov 2026, awaiting approval)

This roadmap is built from `docs/QUALITY_AUDIT.md` (`eea1933`). It is planning only: no code has been changed for it. All work will go on `claude/next-steps`; nothing will be merged, deployed or published without your approval.

**Correction.** I first said the audit had 49 findings. It has **44** IDs:

| Area | IDs |
|---|---|
| Navigation | N1–N8 |
| UI | U1–U7 |
| Accounts | A1–A5 |
| Interiors | I1–I7 |
| Gameplay | G1–G7 |
| Living City | L1–L5 |
| Performance | P1–P5 |

Of these, N7 and N8 are already fixed, and I6 and G6 are areas that were not audited in depth. Every one of the 44 is placed below (see the traceability table at the end).

**Rules carried through every stage:**
- **Nothing is removed or made simpler to make a finding go away.** A place that cannot be entered gets a door and a card now, and a room later; it is not taken off the list.
- **Every stage ends with:**
  - its own new tests
  - the regression set: `livingcity`, `citylife`, `bigcities`, `sidestreets`, `danfo`, `streets`, `touch`, `convoys`, `vehicles`, `bodies`, `cities`, `ways`, `kerbs`, `input`, `phonefit`, `accountsave`, `onboarding`, `firstfive`, plus each stage's named suites
  - a written report of what was measured
  - a stop for your review
- **Laptop results and phone results are always reported separately.** Anything marked **A16** needs you on the Samsung A16, with a build I serve on your Wi-Fi.
- **Complexity:**

  | Size | Work | Sessions |
  |---|---|---|
  | S | under a day | about 1 |
  | M | a few days | 2 to 3 |
  | L | a week | 4 to 6 |
  | XL | more | split into sub-stages |

---

## Order at a glance

**Track A: critical fixes (safety and correctness, first)**

| Stage | What | Size | Needs from you |
|---|---|---|---|
| 0 | A16 baseline: measure before changing anything | S (me) + about 45 min on the phone (you) | The A16, on Wi-Fi |
| 1 | Save history and off-disk backups | M | A storage bucket (see decisions) |
| 2 | Account recovery: email, password reset, second sign-in | M | An email provider and sending address |
| 3 | Broken interactions and Ride accuracy | M | – |
| 4 | Mobile performance and memory | L | A16 sessions |

**Track B: feature development (after Track A, or alongside it where nothing overlaps)**

| Stage | What | Size |
|---|---|---|
| 5 | The work system | L |
| 6 | Interior diversity | XL (6a, 6b, 6c) |
| 7 | People on the street and conversations | L |
| 8 | UI consistency, touch and text, landscape | M |
| 9 | Living City follow-ups | M |
| 10 | Phone-number accounts, and server-trusted progress | M each |

**Dependencies:**

| Stage | Depends on | Why |
|---|---|---|
| 1 | – | It protects everything after it, and can start at once |
| 2 | 1 | Account changes touch the save |
| 3 | – | Independent of 1 and 2; can run while you set up the bucket and mail provider |
| 4 | 0 and 3 | Needs the baseline, and settled screens to judge |
| 5 | 3 | Uses the card and button framework 3 fixes |
| 6 | 3 and 4 | The door and card rules, and the per-room memory and draw-call budget |
| 7 | 6 | Uses the doors, and the crowd's routines from Living City |
| 8 | 5 to 7 | Restyle once, after the features land; Stage 3 fixes only the urgent taps |
| 9 | 6 and 7 | |
| 10a | 2 | The SMS provider decision |
| 10b | 1 and 2 | A save-format change, so last |

---

## Stage 0. A16 baseline (no game changes)

**Why:**
- P1: nothing in the audit was measured on a phone.
- G3: the first five minutes have not been tried on one.
- It gives the numbers every later stage is judged against.

**What changes:**
- A small **performance readout**, only shown when switched on in Settings › Graphics (or `?perf=1`). It shows:
  - frames per second, and the 95th-percentile frame time
  - draw calls and triangles
  - JS heap (Chrome on Android reports it)
  - time to playable
- A "copy report" button, so you can paste the figures to me.
- Nothing else in the game changes.
- Files: a new `src/ui/PerfReadout.ts`, plus a toggle in the Settings section of `src/phone/apps/life.ts`.

**Your session on the A16** (I serve the build on your Wi-Fi; about 45 minutes):
1. Cold load to playable, three times.
2. Lagos: 2 minutes on foot on Broad Street, then 2 minutes driving down to the expressway.
3. Fly to Abuja, then take a coach to Port Harcourt. The same in each, and note whether Chrome reloads the tab (a sign of memory pressure).
4. Go into 5 rooms (Mama Put, the supermarket, an Abuja bank, an Abuja hotel, a PH market). Note any pause on entering.
5. The first five minutes as a new player (G3), from a fresh browser profile.
6. A ride: is the card covered (U1)? The map: tap a pin and check the place card. The bottom bar, Skip ride, and photo mode.
7. Copy the readout report after each part.

**Acceptance:** a table of A16 figures beside the laptop's, per city, written into `docs/QUALITY_ROADMAP.md`.

**Risk:** almost none (an optional overlay). The figures depend on what else is open on the phone, so close other apps first.

**Gate:** Stage 4's targets are set from these numbers.

---

## Stage 1. Save history and off-disk backups (A3)

**Why:** a bad save or a lost disk can wipe players' lives. This is Critical for launch.

**What changes:**

1. **History by time, not by count** (`server/saves.ts`, `server/store.ts`). A save gets thinned versions kept by age:
   - every save for the last 10 minutes
   - then one per 10 minutes for the last 2 hours
   - one per hour for 2 days
   - one per day for 30 days

   The format of what is stored does not change. Old rows are thinned by a background pass, never on the request path.
2. **Restore:**
   - An admin route lists one account's versions with their times and a summary: cash, bank, homes, cars, play time.
   - The admin can put any version back.
   - The admin page (`server/admin.html`) gets a "versions" view.
   - Players do not restore themselves at first (it can be abused); later, maybe.
3. **Backups off the disk** (`server/backup.ts`):
   - A consistent snapshot of the SQLite database (the online backup API), compressed, encrypted with a key kept in Render's secrets, uploaded daily and on demand to an S3-compatible bucket (Cloudflare R2, Backblaze B2 or AWS S3: your choice).
   - Kept: 14 daily and 8 weekly.
   - A checksum is recorded with each.
4. **A restore drill:** a script that downloads the latest backup into a fresh server folder, opens it, and checks the counts (accounts, ledger total, saves) against the live server's `/health`.

**Acceptance (measurable):**
- A new `savehistory` suite:
  - Two hours of simulated once-a-minute saves leave every version the rules promise, and no more.
  - A version from 90 minutes ago can be restored, and the account loads it whole.
  - The thinning pass never deletes the newest save.
- A new `backup` check:
  - A backup is made, uploaded to a local S3 stand-in (MinIO or a file-backed mock), downloaded and decrypted.
  - Its account count, ledger sum and save count equal the source's.
  - A tampered file is refused by its checksum.
- `accountsave` 23/23 still passes, and so does the money suite (`money`).

**Risks:**
- Disk growth (history adds rows): measured, with the thinning keeping it bounded.
- Backup secrets: the key never goes in the repository.
- A restore must never run against the live database by accident: the drill only writes to a new folder.

**Needs from you:** a bucket and an access key (or I write the setup steps for you to follow). Nothing is turned on for the live server without your approval and a deploy you choose.

**Size:** M.

---

## Stage 2. Account recovery and registration (A1, A2, A4)

**Why:** a forgotten password loses everything today (A2, Critical). Email is half-built, and its links never leave the server (A1).

**What changes:**

1. **A real mailer** (`server/accounts.ts` `Mailer`, `server/game-server.ts:64`):
   - A provider adapter (Resend, Brevo, Mailgun or SendGrid: your choice) behind the existing interface.
   - The console mailer is kept for development.
   - Sending is limited per address and per email, as now.
   - Needs a sending domain or address with its DNS records (SPF, DKIM).
2. **Email at sign-up, optional but encouraged** (`src/ui/SignInScreen.ts`):
   - "Add an email to get your account back if you forget your password."
   - It is verified by a link (`/auth/email` and `/auth/finish` already exist).
   - An existing account can add one from the phone's profile.
3. **Password reset:**
   - `/auth/reset` sends a reset link to the account's verified email.
   - `/auth/reset/finish` sets a new password, ends every other session, and logs it.
   - The screen gets "Forgot your password?".
   - An account with no email gets a clear message (ask support); the admin page can set a temporary password after checking the player in another way.
4. **Sign in with email or username** on the same field.
5. **Second sign-in while another browser is connected (A4)** (`src/backend/OnlineAccount.ts` `bindRegistry`, the city socket): on sign-in, close the city connection and open it again as the account.

**Acceptance:**
- An `accountrecovery` suite, run with a test mailer that keeps the messages:
  - sign up with an email; the verify link marks it verified
  - "forgot password" sends one email; its link sets a new password
  - the old password no longer works, and other sessions are ended
  - an expired or used link is refused
  - 6 requests in an hour are refused
- The second-browser sign-in finishes within 5 s, and loads the account's life (the test that showed A4 now passes).
- `accountsave`, `onboarding`, `firstfive` and `online` pass.

**Risks:**
- Deliverability: Nigerian email providers' spam filters. Test with Gmail, Yahoo and an ng-domain address.
- Account takeover through email: links are single-use, expire in 30 minutes, and are bound to the account.
- Changing the sign-in field must not break saved logins.

**Needs from you:** the email provider and sending address.

**Size:** M.

**Phone numbers (A1, second half):** see Stage 10a. SMS one-time codes need a provider (for Nigeria, for example Termii) and per-message cost, so it is separate.

---

## Stage 3. Broken interactions and Ride accuracy (N1–N6, I2, I3, U1, L1, and U2's worst)

**Why:** these are the things a player meets in the first minutes and reads as "broken".

**What changes:**

1. **Every offered place has a door and a card now (N1, N3).**
   - For each of the 61 Abuja, 18 Port Harcourt and 1 Lagos destinations with no door, the city gets a street door object at its building or street spot (`src/cities/CityExtras.ts`; the registry's `streetPosition` and `entrance`).
   - Its card says what the place is, its hours and its district, with the actions it has today: admire, take a photo, the services in its registry entry.
   - Where the registry has an `interiorId` with a room already, the door enters it.
   - Rooms for the rest come in Stage 6.
   - Nothing is removed from the Ride app or the map.
2. **Set down where you can stand (N2)** (`src/game/Game.ts`, `arriveAt` and `doorOf`): the arrival point is moved to the nearest spot the wayfinder says can be stood on, on the door's side, facing the door.
3. **Driving yourself there (N5):** a probe drives to every destination and records where the arrows end. Any that end out of reach of the door are fixed the same way.
4. **Walking beyond Lagos Island (N4):**
   - First, check in play what tap-to-walk does at Balogun Market and the Palms.
   - If it walks into walls, a walking grid is built for the area the player is in (`src/world/plan/Wayfinder.ts`, `Game.waysHere`), not one huge grid.
5. **No button that does nothing (I2):**
   - The salon and Sabo Textiles cards get their real actions (a hairdo or a braid; fabric to buy and have sewn), acted out at the door until Stage 6 gives them rooms.
   - "Enter / Inspect" is only shown where there is a room.
6. **People are people (I3):**
   - The six street people's cards lose the business button.
   - Their real roles are kept and labelled: Tunde's "Talk about investing" opens the wealth sheet that was behind it; Segun's odds tips; Emeka's repairs; Master Tayo's workshop; Sgt. Bello's warden business.
   - Nothing they offered is lost; it is reached by the right name.
7. **The ride card (U1)** (`src/transit/TransitHUD.ts`): the "⌄" menu is hidden during a ride, or the card starts below it. Skip ride and Turn back grow to 44 px.
8. **Map pins (N6)** (`src/ui/WorldMapUI.ts`):
   - Labels kept inside the screen.
   - Labels shown for the pins nearest the middle, or at closer zoom.
   - Overlapping pins nudged apart.
   - The filter row scrolls with a fade at its edge.
9. **Stalls off plot fronts (L1)** (`src/cities/CityLife.ts` `roadsideStalls`): Lagos's 3.6 m plot-front rule, for all plots in Abuja and Port Harcourt.

**Acceptance:**
- A new `reachable` suite, in all three cities:

  | Check | Target |
  |---|---|
  | Destinations offered (Ride and map) with a door in the city | 100% |
  | Arrivals that can be stood on, with the door within 3 m | 100% |
  | Arrivals inside an obstruction | 0 |
  | Door cards whose first action does something (a room, a sheet, a dialogue or an acted action) within 2 s | 100% |
  | "Enter" buttons with no room behind them | 0 |
  | Business buttons on a person | 0 |

- `phonefit` grows to open:
  - the ride in motion
  - the map's place card
  - the map with pins at three zooms
  - a person's card

  It checks no overlap (including the "⌄"), no label past the edge, and taps at least 44 px on these surfaces.
- `livingcity` adds: no stall within 3.6 m of any plot front, in all three cities.
- The regression set passes.
- **A16:** the ride card, the map place card, the person cards and the arrivals checked by hand (15 minutes).

**Risks:**
- New door objects add interactive items. Measure that tap-target lookups stay fast, and that cards do not pile up where places sit close together.
- Moving arrivals must not put the player on the road; the wayfinder's "pavement" is preferred.
- Relabelling cards must keep every existing action reachable (the suite lists every card's actions before and after).

**Size:** M.

---

## Stage 4. Mobile performance and memory (P1–P5, I7)

**Why:** a cheap phone that runs out of memory loses the tab and the player.

**What changes, ordered by risk, smallest first:**
1. **Find the heavy things.** Triangles and draw calls per mesh group in each city (laptop). P3: what makes Port Harcourt's 422,000 triangles (the refinery, the waterfront, the market roofs?).
2. **Distance-based detail.** For the heaviest Port Harcourt and Abuja meshes, a simpler model past 60 to 80 m; Lagos's static street pieces merged by block (P4).
3. **A "low-end phone" graphics tier**, chosen by default when the phone reports little memory or a slow first frame:
   - Shadows are cheaper or off; the audit records them at about 30% of a frame.
   - The draw distance is shorter.
   - Pixel ratio is capped.
   - Nothing about what is in the world changes; only how far and how fine it is drawn.
4. **Leaving a city frees it (P2)** (`src/cities/CityManager.ts`):
   - Its meshes and textures are released.
   - The crowd's and traffic's state, plots and solids caches are rebuilt on return (they are all computed from data).
   - Stage 3c's "resume after a city change" check guards the crowd.
5. **Traffic at levels of detail (P5)**, as the crowd has since Living City stage 1.
6. **Rooms:** the first-entry build is measured on the A16 (I7). If it pauses for more than 300 ms, rooms are built while the door's fade plays, or during idle time beforehand.

**Acceptance:**

| Check | Laptop target | A16 target |
|---|---|---|
| JS heap after visiting all three cities | at most Lagos's figure + 20% | no reload; same rule |
| Port Harcourt triangles on arrival | at most 250,000 | – |
| Lagos draw calls on Broad Street | at most 380 | – |
| Traffic step in Lagos | at most 0.8 ms | – |
| Time to playable | – | at most 15 s (measured about 20 s on 12 Nov) |
| Broad Street on foot | – | at least 30 fps (95th percentile at most 50 ms) |
| Driving | – | at least 25 fps |
| Abuja and Port Harcourt | – | at least 30 fps |
| Room first entry | – | pause at most 300 ms |

The A16 targets are confirmed from Stage 0's baseline.

Plus:
- A new `perfbudget` suite counts the work: draw calls, triangles, heap after the city tour, the crowd and traffic step times. It fails on a 10% rise from the stage's own baseline.
- The regression set passes, including `bigcities`, `cities`, `crosscity`, `vehicles`, `driving` and `drivetouch`.
- **A16:** Stage 0's session repeated, and the figures compared.

**Risks:**
- Freeing a city is the riskiest change in this roadmap. State that is not rebuilt (an open shift, a parked car, a stall's trader) could be lost.
- Mitigation:
  - Only drawn things are freed, never game state.
  - The suites `crosscity`, `bigcities`, `livingcity` (the resume check) and `accountsave` run after every step.
  - A switch can keep a city resident if needed.
- A lower tier must not look broken: screenshots of each city on each tier are reviewed side by side.

**Size:** L.

---

## Stage 5. The work system (G1, G2, G6 in part)

**Why:**
- A shift is 4 quick rounds.
- The server pays some gigs after 4 to 8 seconds.
- Lagos Life keeps a player at work for an hour of play.

**What changes:**
1. **A shift is time at the workplace**, measured in game time and set per job (2 to 4 game hours, about 5 to 10 real minutes on the fast clock).
   - The player is kept there: leaving early ends the shift with part pay.
   - It is a loop of the workplace's own tasks, at least 3 kinds per job type, acted out at their spots in the room (the building site's 6-block course is the model).
   - The tasks for each workplace type are written into one table: the supermarket (shelves, till, cartons), the buka (serve, wash, cook), the office (calls, files, meetings), the bank (counter, vault count), the site (blocks, mixing, carrying), the hospital (rounds, records), the refinery (checks, valves), the garage (tyres, engine).
2. **Pay by time and grade:**
   - The career salaries already set (a day of a 2025-26 salary) are paid per hour worked.
   - The server's minimum time per gig (`server/earn.ts`) is raised to match what the work shows; no gig pays before its shortest real shift.
   - The daily earnings limit stays.
3. **Skill and performance:** the task mini-games (`ShiftSkill`) set a performance mark that moves pay ±20% and counts toward promotion.
4. **Off-shift life goes on:** the phone holds the shift's clock; a shift can't be started in two places.
5. **Not in this stage:** working while offline. It needs a server-side worker clock (fair pay, no exploit); proposed as 5b after this stage is tried.

**Acceptance:**
- A new `workshift` suite:
  - In 5 workplace types, a shift lasts its set time.
  - It has at least 3 task kinds.
  - Leaving early pays the part done.
  - The server refuses pay sent before the minimum.
  - Two shifts at once are refused.
  - Promotion follows the marks.
- `earn` server checks: no gig pays under its minimum; the daily limit holds.
- The suites `bizdays`, `companies`, `actions`, `money` and `firstfive` (the first pay at the site still works) pass.
- **A16:** one shift played through on the phone (feel, taps, length).

**Risks:**
- The economy: longer shifts with more pay change how fast players get rich. Keep the daily limit and compare a week's simulated earnings before and after.
- The first five minutes' first pay must stay quick (the site's short course is kept as the "first day").

**Size:** L.

---

## Stage 6. Interior diversity (I1, I4, I5, I6)

**Why:**
- Abuja and Port Harcourt each have one room per kind behind about 60 to 100 doors.
- Some Broad Street shops and Uniport are menus.

**6a. Rooms built from parts, different per building (I1).** Size L.
- A room is generated from its door's id (the same every visit), for town shops, offices, banks, markets and hotels:
  - floor plan size and shape (3 to 4 plans per kind)
  - counter and fitting placement
  - wall and floor finishes from the city's palette
  - signs with the building's own name
  - staff (names, looks)
  - stock (what the shelves hold)
- Built from shared parts, so draw calls stay within Stage 4's room budget.
- Files: `src/interiors/places/PlaceSpecs.ts` (`townRooms`), a new `src/interiors/places/RoomKit.ts`, `src/cities/CityExtras.ts`.

**6b. Bespoke rooms for the places players seek out (I4, I5, and N1's important places).** Size L.
- Uniport: a campus with a lecture hall and a library, where Courses levels are studied.
- Broad Street: the salon, Victory Phones and the pharmacy.
- In Abuja: the World Trade Centre, the ICC, Transcorp-area lounges, the Dome, Banex Plaza.
- In Port Harcourt: Hotel Presidential, the stadium, SPAR, Genesis Cinema.
- Each has its own actions, acted out (the visible-actions standard).

**6c. A room-by-room review (I6).**
- A contact sheet of screenshots of all 91 rooms and the new ones, reviewed against Lagos Life's.
- Fixed where a room is bare, wrongly scaled, or has a sign inside.

**Acceptance:**
- A `roomvariety` suite:
  - 20 doors of each town kind in each city give at least 3 different plans and distinct signs.
  - No two neighbouring doors share a plan.
  - Every door enters a room with at least 5 things to do.
  - Draw calls stay within the room budget (Stage 4).
- `reachable` (Stage 3) now enters every door.
- The suites `bigcities`, `interiors`, `places`, `shop`, `buka`, `hotel` and `eating` pass.
- **A16:** 10 rooms visited; first-entry pause within Stage 4's limit.

**Risks:**
- Memory: rooms are built on entry and freed on leaving; the budget is checked per room.
- Saved state tied to a room (a hotel stay, a bought item) must still find its room. Ids do not change; only the layout does.

**Size:** XL (6a L, 6b L, 6c M).

---

## Stage 7. People on the street and conversations (G4, G5, G3's open items, L4 in part)

**What changes:**
- **Regulars in Abuja and Port Harcourt:** 6 to 8 named people per city (a suya man, a civil servant, a keke rider, a market woman), each with a role, a place, a memory and a day. They live on the crowd's routines (Living City, the planned stage 5), not standing all day.
- **Conversations that branch:** 3 to 5 exchanges a person, changing with closeness (`Ties`), the hour and what the player has done.
- **Chief Alabi reacts to life events** (G3): a new job, a home, a car.
- Lagos's 23 street people move onto routines too.
- Files: `src/world/NPCs.ts`, `src/world/ChiefAlabi.ts` (its pattern generalised), the crowd's `CityPopulation`, `Routines.ts`.

**Acceptance:**
- A `regulars` suite:
  - Each city has at least 6 regulars.
  - Each is found where their routine says at 4 hours of the day.
  - A conversation changes after closeness rises.
  - A regular remembers the player's name after a reload (the account save).
- `livingcity` passes; the crowd stays under 1 ms in each city (laptop).
- **A16:** a conversation read and answered on the phone, with the keyboard if a name is typed.

**Size:** L.

---

## Stage 8. UI consistency, touch and text, landscape (U2–U7, G7)

**What changes:**
- **One design-token stylesheet loaded last** (colours, radii, spacing, type scale). Every surface uses it; the old overrides are removed one by one (U6).
- **Every tap at least 44 px** (U2). The money "+", the today chip and photo mode first.
- **Text at least 12 px** in play, following the Settings text size (U3).
- **Landscape: your decision.** A real landscape layout, or locked to portrait (U4).
- **The taxi's inside view gets proper arms and hands** (U5).
- **Photo mode's bar** (U7).
- **G7:** cards are shortcuts; the action itself is acted out where it happens (checked surface by surface during 6 and 7, finished here).

**Acceptance:**
- `phonefit` raised to 44 px taps and 12 px text, at 316, 360, 390, 412 and 430 px (and landscape if kept).
- A contact sheet of every surface is reviewed side by side.
- **A16:** a sweep of every surface (30 minutes), with photos of anything wrong.

**Risk:** restyling everything at once breaks layouts. It is done surface group by group, `phonefit` after each.

**Size:** M.

---

## Stage 9. Living City follow-ups (L2–L5)

- **L2: more custom at the stalls from the city's own people.** Breakfast akara for commuters, an evening suya habit for some workers, a market day for elders. No people are added.
- **L3:** crossings follow from Stage 6's places across the avenues; more zebras where the street plan has real crossings.
- **L4:** customers seen inside shops when the street shows them going in (Living City stage 4); horn reactions while crossing.
- **L5:** watched; investigated if it recurs.

**Acceptance:**
- `livingcity` grows: customers counted inside equal those seen going in; a stall gets a customer at least every 3 minutes at lunch (laptop, real clock); safety checks unchanged.

**Size:** M.

---

## Stage 10. Phone-number accounts (10a) and server-trusted progress (10b)

**10a. Phone sign-in by SMS one-time code (A1, second half).** Size M.
- Needs an SMS provider and a budget per message.
- Nigerian numbers are normalised (+234, and the 0 dropped).
- Rate-limited, with codes valid for 5 minutes.
- Linked to an existing account, or used to make one.

**10b. Server-trusted certificates and stock (A5).** Size M.
- Certificate levels and business stock move from the browser's word to the server's ledger, as money already did.
- It needs a save-format migration with a fallback, so it is last, after Stage 1's history and backups protect it.

**Acceptance:** `accountrecovery` and `accountsave` grow; for 10b, an edited browser save cannot raise a certificate or invent stock (server checks).

---

## What needs the real Samsung A16

| Stage | What only the phone can tell | About |
|---|---|---|
| 0 | Every baseline figure; the first five minutes | 45 min |
| 3 | The ride card, the map's place card, person cards, arrivals | 15 min |
| 4 | Frames, memory (does Chrome reload the tab?), load time, room entry pauses, driving smoothness | 45 min |
| 5 | How a shift feels and lasts; taps during tasks | 20 min |
| 6 | Room entry pauses; how the rooms look on the small screen | 20 min |
| 7 | Reading and answering a conversation; the keyboard | 10 min |
| 8 | Every surface; text size with the phone's own large-text setting | 30 min |

Laptop emulation is used for everything else, and always reported as the laptop's.

---

## Decisions I need from you before the stage that needs them

| Before stage | Decision |
|---|---|
| 1 | Where backups go: Cloudflare R2, Backblaze B2 or AWS S3. You create the bucket and key, or I write the steps. |
| 2 | Which email provider, and the sending address or domain. |
| 8 | Landscape: support it, or lock to portrait. |
| 10a | An SMS provider and budget, or postpone phone numbers. |
| Any deploy | Which stages go live, and when. The live site stays at `8690f5b` until you say. |

---

## Traceability: every finding to a stage

| ID | Stage | ID | Stage | ID | Stage | ID | Stage |
|---|---|---|---|---|---|---|---|
| N1 | 3 (door and card), 6b (rooms) | U1 | 3 | A1 | 2, 10a | I1 | 6a |
| N2 | 3 | U2 | 3 (worst), 8 | A2 | 2 | I2 | 3, 6b |
| N3 | 3 | U3 | 8 | A3 | 1 | I3 | 3 |
| N4 | 3 (check, then fix) | U4 | 8 | A4 | 2 | I4 | 6b |
| N5 | 3 | U5 | 8 | A5 | 10b | I5 | 3 (actions), 6b (rooms) |
| N6 | 3 | U6 | 8 | | | I6 | 6c |
| N7 | done (`d59cfe7`) | U7 | 8 | | | I7 | 4 |
| N8 | done (8 Nov) | | | | | | |

| ID | Stage | ID | Stage | ID | Stage |
|---|---|---|---|---|---|
| G1 | 5 | L1 | 3 | P1 | 0, 4 |
| G2 | 5 | L2 | 9 | P2 | 4 |
| G3 | 0 (A16), 7 | L3 | 9 | P3 | 4 |
| G4 | 7 | L4 | 9, 7 | P4 | 4 |
| G5 | 7 | L5 | 9 (watch) | P5 | 4 |
| G6 | 5 (jobs), audit per system in 6 and 7 | | | | |
| G7 | 6, 7, 8 | | | | |

---

**I will not start any stage until you approve.** If you approve, the suggested start is:
- **Stage 0** (I add the readout and serve you the build).
- **Stage 1** (save history and backups) and **Stage 3** (broken interactions and Ride accuracy) side by side. They touch different parts of the code; 3 does not touch the server.
