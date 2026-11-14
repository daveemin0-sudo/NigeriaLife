# NigeriaLife quality audit (14 Nov 2026)

This audit is read-only: no game code was changed while making it. It covers `claude/next-steps` at `cbf8739`. The live site is still `8690f5b` (10 Nov). No roadmap is proposed here; one follows once these findings have been read.

## How it was done, and what it cannot show

| Evidence | What it means |
|---|---|
| **Probe** | Measured in the running game, a frozen build served locally, driven headless in Chrome on the laptop at phone sizes (412×915, the A16's width; 360×780; 915×412 landscape). Doors are entered the way a player does: up to the door, its card, its button. |
| **Code** | Read in the source; file and line given. |
| **Suite** | An existing automated test, run for this audit. |
| **Record** | A finding from an earlier play-test or report; it says whether it has been fixed since. |

Limits:
- **No measurement here comes from the Samsung A16 or any phone.** Phone figures are stand-ins: a phone-sized window, and a 4× CPU slowdown that did not apply evenly.
- **The probes ran on a Saturday on the game's clock.** Places with weekday hours (banks, offices) were shut, and this was taken into account.
- **The laptop was heavily loaded** (CPU at about 88%, much of it OneDrive syncing the project folder), so timings are noisy. Counts (draw calls, triangles, people moved) are reliable.

**Severity:**

| Level | Meaning |
|---|---|
| Critical | Loses progress or blocks play |
| High | A player meets it and is let down |
| Medium | Noticeable, has a workaround |
| Low | Polish |

**Classes:** Bug (confirmed), Incomplete (feature), Design (improvement), Perf (risk).

## Summary

| Area | Bugs | Incomplete | Design | Perf | Highest severity |
|---|---|---|---|---|---|
| 1. Navigation and map | 4 | 2 | 1 | 1 | High |
| 2. UI and UX | 2 | 0 | 5 | 0 | Medium |
| 3. Accounts | 1 | 3 | 1 | 0 | Critical |
| 4. Interiors | 3 | 3 | 1 | 0 | High |
| 5. Gameplay and onboarding | 0 | 4 | 3 | 0 | High |
| 6. Living City | 1 | 3 | 1 | 0 | Medium |
| 7. Mobile performance | 0 | 1 | 0 | 4 | High |

The ten that matter most:

1. **A3, A4: progress safety.** No way to recover a forgotten password; backups sit on the same server disk.
2. **N1: arriving at places you cannot enter.** 61 of 81 Abuja places and 18 of 33 Port Harcourt places offered by the Ride app and map search have no door in the city.
3. **P1, P2: never measured on the A16.** The JS heap is 280 to 380 MB, and Port Harcourt draws 422,000 triangles.
4. **I1: Abuja and Port Harcourt rooms are shared.** One supermarket, bank, office, market and hotel room per city, behind every door of that kind.
5. **I2, I3: dead and wrong buttons on Broad Street.** "Enter / Inspect" does nothing on two shops, and opens a business sheet on six people.
6. **A1, A2: accounts are username and password only.** Email links are built but never sent; there is no phone number option.
7. **U1: the ride-in-motion card is still overlapped** by the "⌄" menu button. You reported it on the A16.
8. **G1, G2: work is short and thin.** 4 rounds a shift; the server pays some gigs after 4 to 8 seconds.
9. **L1: a Stage 3d stall blocks a land plot.** Two Port Harcourt stalls stand in front of 22 Aba Road.
10. **G4: Abuja and Port Harcourt have nobody to talk to in the street.**

---

## 1. Navigation and world map

**N1. Places offered that cannot be entered.** Bug, **High**.

Evidence (probe): every destination in each city's list was checked for a door in that city, either carrying its id or matching its name.

| City | Destinations | Enterable | Not enterable |
|---|---|---|---|
| Lagos | 61 | 60 | 1 |
| Abuja | 81 | 20 | **61** |
| Port Harcourt | 33 | 15 | **18** |

- Abuja examples: World Trade Centre, ICC, NNPC Towers, the Supreme Court, Transcorp-area lounges, Dunes Centre, Banex Plaza, Millennium Park (Maitama), Moscow Underground, 345 Nightlife.
- Port Harcourt examples: Onne Sea Port, Hotel Presidential, Liberation Stadium, SPAR, Genesis Cinema, Oil Mill Market.
- The phone's Ride app lists them all (`src/phone/services/RideService.ts:79`, `destinations()` returns every registry place in the city), and so does the map search (`src/ui/WorldMapUI.ts:349`, `findPlaces`). The player is driven there, set down at a street spot (`src/game/Game.ts:1503`, `arriveAt`), and there is nothing to go into.

Files: `src/destinations/DestinationRegistry.ts`, `src/cities/AbujaCity.ts`, `src/cities/PortHarcourtCity.ts`, `src/cities/CityExtras.ts` (`placeDoors`, `townDoors`).

Fix: until each has a building, offer only places with a door here. Filter both lists by the same check the probe used. Then give the important ones a door and a room (see I1). Add a suite check that every place offered can be entered.

**N2. Arriving inside something solid.** Bug, **Medium**.

Evidence (probe), where a trip sets the player down:

| Place | Arrival point |
|---|---|
| University of Lagos | (−15, −30) |
| Everyday Supermarket | (10.9, −45) |
| Lagos State Government House | (14, 3990) |
| Zuma Rock | (0, −90) |
| PH Bole & Fish | (−16, 15) |

Each lies within an obstruction's box (with the player's 0.3 m radius). `arriveAt` uses the door's interaction point, or the street spot, without checking it can be stood on.

Files: `src/game/Game.ts:1500-1507`, `doorOf` (`Game.ts:2577`).

Fix: snap the arrival to the nearest point the wayfinder says can be stood on (`Wayfinder.canStand`), facing the door. Check every destination in a suite.

**N3. One Lagos place has no door.** Incomplete, Low.

Evidence (probe): Oga Sunday Premier League Viewing Centre.

Fix: give it a door, or remove it from the lists (as N1).

**N4. Walking routes stop at the edge of central Lagos.** Perf/Design, Medium, needs verifying in play.

Evidence (probe): 45 of the 61 Lagos destinations, the expressway and mainland places from z 300 to 6,270, are outside the half-metre walking grid. A route from them to Broad Street returns nothing. Tap-to-walk there falls back to walking straight.

Files: `src/world/plan/Wayfinder.ts`, `Game.waysHere`.

Fix: a wayfinder grid per area, built when the player is there, so it is not one huge grid. First check in play what tap-to-walk does at, say, Balogun Market.

**N5. Driving yourself to a place, and arriving.** Incomplete as a check, Medium.

The arrows and the arrival point of "Drive yourself" were not measured in this audit. The `access` suite (11 checks, roads-only reach from the main road in all three cities) passed on 12 Nov.

Fix: a probe that drives to each destination and records where it stops, and whether the door is in reach.

**N6. Map pins: labels cut off and pins on pins.** Bug (Design), Medium.

Evidence (probe screenshot, 412 px): labels run off the right edge ("Broad Street Cor…", "Lagos Area Command Police Headqu…", "St. Nicholas…"), University of Lagos lies on Co-Creation Hub, and the filter row is clipped after "Transit".

The map's place card did not open in the probe, so the overlap you reported there (`#map-context-card`) is **not verified either way**.

Files: `src/ui/WorldMapUI.ts`, its stylesheet.

Fix: labels shown only for the nearest or zoomed pins; leader lines or declutter; keep labels inside the screen. Add the place card to `phonefit`.

**N7. Arrival-in-another-city blockers (10 Nov).** Fixed (record): `d59cfe7`. A place in another city is only reached by a flight, a coach or the jet.

**N8. Abuja and Port Harcourt rides set down far from the door; own car offered in the wrong city.** Fixed (record): 8 Nov, `625a9b5` and `149798d`. Not re-measured beyond N1 and N2.

## 2. UI and UX

Evidence: `phonefit` (suite) passed **28/28**. It covers street, toast, quests, flights, travel, bag, map and search, phone and all 30 apps, home and its card, bed and driving, at 316, 360, 390 and 430 px. A new probe opened the surfaces it does not cover at 412×915, 360×780 and 915×412: sign-up, a door card, a conversation, the map with its pins, a ride in motion, a work shift and photo mode. None had anything off the edge of the screen, or a floating panel on another panel.

**U1. The ride-in-motion card under the "⌄" menu button.** Bug, **Medium**.

Evidence (probe screenshot, 412 px): the round "⌄" button sits over the ride card's title ("Yellow taxi · Broad Street → Everyday Supermarket"). You reported this on the A16; it is still there.

Files: `src/transit/TransitHUD.ts`, the HUD's top-menu button.

Fix: hide the "⌄" during a ride, or start the card below it. Add the ride to `phonefit`.

**U2. Taps smaller than a thumb.** Design, Medium.

Evidence (probe), against Android's 48 dp guideline, measured at 40 px:

| Where | Size |
|---|---|
| The money "+" | 36×36 in portrait, **22×22 in landscape** |
| The "today" chip | 36 tall |
| The "⌄" menu button | 46×36 |
| Ride "Skip ride" and "Turn back" | **29 tall** |
| Photo-mode buttons | **27 tall** |
| Landscape sound toggle | 27×27 |
| Landscape nearby-place pills | 28 tall |

`phonefit` passes at 36 px, its own bar.

Files: `src/ui/HUD.ts`, `src/transit/TransitHUD.ts`, photo mode, the phone stylesheet.

Fix: raise the bar to 44 px and fix these; landscape needs its own pass.

**U3. Text at 10 to 10.5 px.** Design, Low to Medium.

Evidence (probe): the clock, money and weather (10.5 px), the ride's traffic and weather badges (10 px), the bottom bar's labels in landscape (10 px). Settings has a text-size option (record), and these should follow it.

Fix: 12 px at least for anything read during play.

**U4. Landscape is not designed.** Design, Medium.

Evidence (probe): the layout works but shrinks: the 22 px "+", 27 px icons and 28 px pills. Nobody has tested or checked landscape (`phonefit` is portrait only).

Fix: decide whether landscape is supported. If it is, give it its own layout and add it to `phonefit`; if not, lock to portrait.

**U5. The inside-the-taxi view.** Design, Low.

Evidence (probe screenshot): the driver's arms are two huge, flat orange shapes filling the bottom half of the screen.

Files: `src/transit/RoadRideExperience.ts` (inside camera).

Fix: a proper low-poly pair of arms and hands, smaller, in the driver's own skin and sleeve colours, or a seat view without them.

**U6. Consistency across surfaces.** Design, Medium.

Evidence (record): earlier rounds found `luxe.css` overriding phone rules, big multi-line toasts, and modals with tall wrapped headings. `phonefit` now guards edges and overlap only. Fonts, radii, padding and card styles across the 30 apps, the place cards, the rooms' cards and the ride screens were not compared in this audit.

Fix: one design-token sheet loaded last; a screenshot contact sheet of every surface reviewed side by side, against Lagos Life's.

**U7. Photo mode on a phone.** Design, Low.

Evidence (probe): 17 taps under 40 px, buttons 27 px tall. The photo-mode bar was slimmed on 8 Nov (record); its taps were not.

## 3. Account system

What exists:
- **Guest accounts:** made on first play, server-side.
- **Sign-up:** username and password (scrypt-hashed). A guest signing up keeps their progress.
- **Sign-in:** username and password on any device, limited per address (`server/accounts.ts:186`).
- **Saves:** everything owned or earned saves to the account and returns on sign-in anywhere (Cursor's PR #13; `accountsave` 23/23 on 12 Nov).
- **Stale devices:** an out-of-date device can no longer overwrite newer progress (`9a82545`).

**A1. No email or phone number.** Incomplete, **High**.

Evidence (code):
- The sign-in screen has only a username and a password (`src/ui/SignInScreen.ts:60-61`).
- The server can send an email sign-in link (`/auth/email`, `/auth/finish`; `server/accounts.ts:205-222`), but the live server is built with `consoleMailer` (`server/game-server.ts:64`), so a link is only written to the server's log and never reaches anyone.
- There is no phone-number support anywhere.

Fix: a real mailer (any transactional email service) behind `Mailer`, an email field at sign-up, and email-link sign-in. Phone by SMS one-time code is a larger job (an SMS provider, costs, and Nigerian number formats).

**A2. A forgotten password loses the account.** Incomplete, **Critical** for launch.

Evidence (code): no reset or recovery route on the server and nothing on the screen.

Fix: password reset by email link (needs A1's mailer), and an email field encouraged at sign-up.

**A3. Backups and history.** Incomplete, **Critical** for launch.

Evidence (record, `docs/SAVE_AUDIT_AND_ROADMAP.md`):
- **Step 2 is not done:** the five kept versions of a save are used up in five minutes of once-a-minute saves.
- **Step 3 is not done:** the daily copy of the database sits on the same Render disk as the database.

Fix: steps 2 and 3 as planned (history by time, backups off the disk).

**A4. Second sign-in while another browser is connected never finishes.** Bug, **Medium**.

Evidence (record, found 12 Nov, still open): signing in on a second browser while the first is open and connected stays on the local guest.

Files: `src/backend/OnlineAccount.ts` (`bindRegistry`), the city socket.

Fix: on sign-in, close the city connection and reconnect as the account.

**A5. The browser is trusted for some things.** Design (security), Medium.

Evidence (record, save audit risk 3): certificate levels, stock, furniture and bag items can be edited in the browser. Money cannot; the server's ledger decides.

Fix: move certificates and stock to the server first, because they open better-paid jobs.

## 4. Interiors

How it is built (code):
- **One `InteriorManager`** with 91 interior templates. Lagos places have their own rooms; the expressway's places are built when first entered.
- **Homes** are `ResidentialInterior` rooms by home type.
- **Abuja and Port Harcourt** have one room per kind of town building (shops, office, bank, market, hotel; `CityExtras.ts` `TOWN_ROOM`), plus their own rooms for the national places.

What is behind a sample of doors, gone into as a player (probe):

| City | Walk-in rooms (objects drawn / things to do) | Card or menu only, no room |
|---|---|---|
| Lagos (Broad Street) | Mama Put (344 / 8), Everyday Supermarket (278 / 8), Executive Barbershop (75 / 5). The bank has a room, shut at the weekend | Cash machine, salon, NaijaBet, Sabo Textiles, Victoria Residence (rent dialogue), Danfo terminus, pharmacy, Victory Phones, filling station, God's Grace Auto Works, the building site, the police checkpoint |
| Abuja | Supermarket (80 / 5), bank (79 / 5), market (169 / 11), hotel (182 / 8), offices (172 / 7), National Assembly (126 / 6), Jabi Lake Mall (124 / 7), National Hospital (122 / 7), FCT Police (82 / 5), airport (295 / 10) | Aso Rock, Federal Secretariat, green cab, motor park sheds, Millennium Park, cash machine |
| Port Harcourt | Supermarket, bank, market, hotel, offices (as Abuja's), mall (123 / 7), Government House (75 / 5), UPTH (121 / 7), police (79 / 5), airport (295 / 10) | Refinery, Bole King, Uniport, motor park, Pleasure Park, cash machine |

**I1. Shared rooms in Abuja and Port Harcourt.** Incomplete, **High**.

Evidence (probe): every supermarket door in Abuja opens "Abuja Supermarket", every bank "Abuja Bank", every office "Abuja Offices". Abuja has 63 shop doors and 65 office doors, and Port Harcourt 96 shops, 52 markets and 46 offices (probe), all sharing one room per kind. Rooms are small: about 80 objects and 5 things to do for a shop or a bank.

Files: `src/cities/CityExtras.ts` (`townDoors`, `TOWN_ROOM`), `src/interiors/places/PlaceSpecs.ts` (`townRooms`).

Fix: variety by building, not one room per kind: a seeded layout per door (size, fittings, staff, stock) from shared parts, and a handful of bespoke rooms for the places players will seek out.

**I2. Dead "Enter / Inspect" buttons.** Bug, **High**.

Evidence (probe, rechecked with a 30 s wait): the Unique Beauty Salon and Sabo Textiles cards offer "Enter / Inspect"; neither has a room (`hoursOfDoor` returns null, and no template), and pressing it does nothing.

Files: `src/ui/HUD.ts` (`showInteractionCard`), the Broad Street building definitions.

Fix: give them rooms, or a card that says what is there (a menu of the shop's services), never a button that does nothing. Add a suite check that every card button does something.

**I3. "Enter / Inspect" on people.** Bug, **Medium**.

Evidence (probe): on the danfo conductor, Segun, Tunde, Emeka, Master Tayo and Sgt. Bello, the button opens the business investment sheet (`economy-modal`).

Fix: no business button on a person; people get Greet, Wave, Buy or Ask only.

**I4. Uniport is a menu.** Incomplete, Medium.

Evidence (probe): "Enter Uniport Academic Quad" opens a menu sheet. Courses exist in the phone (Cursor's Courses app, record).

Fix: a campus room (a lecture hall, a library desk) where a course level is studied, the way a shift is worked.

**I5. Broad Street shops without rooms.** Incomplete, Medium.

Evidence (probe): Victory Phones, the pharmacy, NaijaBet, the filling station, the auto works and the salon are cards and menus.

Fix: rooms for the ones a player uses often (phones shop, pharmacy, salon); the forecourt and the workshop can stay outdoor places with their actions acted out.

**I6. Homes and the Lagos room set.** Not audited in depth.

The record shows many fixes:
- the fridge
- the generator outside
- bed and duvet
- furnished hotel rooms in Abuja and Port Harcourt (`c2aa444`)
- real rooms for every Abuja and Port Harcourt place (`cc13d3a`)

Fix: a room-by-room screenshot review, like U6.

**I7. Rooms are built on first entry.** Design (Perf), Low.

Evidence (probe): before entry a place's room is empty (2 objects), so the first visit builds it.

Fix: none needed; keep it, but measure the hitch of the first entry on the phone (P1).

## 5. Gameplay and onboarding

**G1. Shifts are short.** Incomplete, **High**.

Evidence (code): 4 rounds a shift (`src/jobs/HandWork.ts:44`, `SHIFT_PIECES`). The record (Cursor's question, 10 Nov) asked what the player does for the hour the phone holds a shift; it is not answered in code.

Fix: a shift that keeps the player at the workplace for a stretch with varied tasks (as the building site's course does), or one that runs while they do other things, paid by time.

**G2. Some gigs pay after 4 to 8 seconds.** Design (economy), **Medium**.

Evidence (code, `server/earn.ts:65-69`):

| Gig | Pay | Minimum time |
|---|---|---|
| Code sprint | ₦25,000 | 8 s |
| Generator repair | ₦20,000 | 8 s |
| Danfo run | ₦12,500 | 8 s |
| Generator starting | ₦2,500 | 4 s |

A daily earnings limit applies (record), so the totals are capped, but the pace is not.

Fix: minimum times to match what the work shows, and pay set against the career salaries (record: a day of a 2025-26 salary).

**G3. First five minutes.** Built, not yet tried on a phone.

Evidence (record):
- 7 steps in any order, Chief Alabi, the site, the first pay, sign-up after the first pay. Tests: firstfive 22/22, onboarding 26/26.
- Not yet tried on the A16.
- Open: Chief Alabi does not react to later life events; suya is sold wrapped and not eaten; the guide is Lagos only (`Game.ts`, `firstStepsHost`, `centre`).

Fix: the A16 test, then the open items.

**G4. Nobody to talk to in Abuja's and Port Harcourt's streets.** Incomplete, **High**.

Evidence (code): Lagos has 23 named street people (`src/world/NPCs.ts`). The Abuja and Port Harcourt city files create none; their named people are only inside rooms (nurses, desk sergeants, cashiers; probe).

Fix: a few regulars per city on the street, each with a role, a place and a memory (as Chief Alabi), on the crowd's routines (Living City stage 5 was planned for this).

**G5. Conversations are cards.** Design, Medium.

Evidence (probe): street people offer Greet, Wave, and one trade or service button. Chief Alabi has three replies and a memory (record); most others have a single line.

Fix: short branching exchanges that change with closeness (`Ties`), the hour and what the player has done.

**G6. Jobs, businesses, property, social.** Present, depth not audited.

There are 30 phone apps (code), including Courses, Register a business, Gadgets, Buses, Police and Contacts (record, Cursor's PR #12). The record lists what is still to do: working while offline, and CV-gated jobs beyond certificates.

Fix: a play-through per system with a checklist (what the player sees, does, earns, and whether it is acted out in the world).

**G7. Leaning on instructions.** Design, Medium.

Evidence (record): Settings has a how-to-play guide; the first-steps guide shows "Take me". Many actions are buttons on cards, not things done in the world (I2 to I5).

Fix: every action acted out where it happens (the visible-actions standard), cards as shortcuts only.

## 6. Living City (stages 1 to 3d)

Results: `livingcity` 83/83 on `cbf8739`; 13 regression suites 155/155 (suite). See `docs/LIVING_CITY.md` for every stage.

**L1. Two Port Harcourt stalls block a land plot.** Bug, **Medium** (introduced in stage 3d).

Evidence (code and data): the goods stalls at (12.7, −2.5) and (12.7, 3.5) stand on the pavement in front of 22 Aba Road (plot x 14 to 28, z −8 to 8; `src/realestate/PlotCatalogue.ts:86`). Lagos's stalls keep 3.6 m clear of a plot's front (`CityFabric.beforeAPlot`); the Abuja and Port Harcourt placement does not (`src/cities/CityLife.ts`, `roadsideStalls`). Abuja's stalls happen to clear its plots.

Fix: the same plot-front rule in `roadsideStalls`, and a suite check across all three cities.

**L2. Stalls are quiet in real time.** Incomplete, Medium.

Evidence (suite): in 10 minutes of lunch hour, Port Harcourt served 1 customer, Lagos 3 and Abuja 4. Customers come from the people on the map and their walks take minutes; nobody was added to make it look busy.

Fix: more of the city's people choosing stalls as their routine (breakfast akara, an evening suya habit), not more people.

**L3. Crossings fell when office workers went indoors.** Design, Low.

Evidence (suite): crossings per minute, before stage 3a and now:

| City | Before 3a | Now |
|---|---|---|
| Lagos | about 70 | 32 to 44 |
| Abuja | about 115 | 19.5 to 24.5 |
| Port Harcourt | about 150 | 49 |

No car is ever on top of anyone.

Fix: food places across the avenues and more crossings on them, as the city is filled out (not to meet a number).

**L4. Not built.** Incomplete, Medium.

- Customers seen inside shops (stage 4)
- Story people with routines, and talking to residents (stage 5)
- Reactions to a horn while crossing

**L5. One walker once stood still on an Abuja zebra for 10 s.** Unconfirmed, Low.

Evidence (suite, once): seen once in the fast-clock test; not seen in three replays or the next three full runs. The test now records the walker's mode and speed if it recurs.

## 7. Mobile performance

Evidence (probe), 412×915 headless on the laptop (Intel HD 620), street view on arrival:

| City | Draw calls | Triangles | Frame (ms) | 95th percentile (ms) | Crowd (ms) | Traffic (ms) | JS heap (MB) |
|---|---|---|---|---|---|---|---|
| Lagos | 502 | 169,162 | 30.1 | 47.2 | 0.52 | 1.38 | 279 |
| Abuja | 158 | 181,878 | 18.3 | 28.3 | 0.23 | 0.42 | 353 |
| Port Harcourt | 185 | **421,801** | 20.2 | 35.0 | 0.49 | 0.48 | 347 |

Loading: about **14.8 s** to playable on the laptop. With the CPU slowed 4×, about 22 s, and Lagos's frame went from 30 to 54 ms. The slowdown did not apply evenly (the crowd's own step time did not change), so treat these as indicative only. On the A16 itself, you measured about 20 s to playable on 12 Nov (record).

**P1. Never measured on the A16.** Incomplete, **High**.

Every figure here is from the laptop: frames, loading, memory, the first entry into a room, driving.

Fix: one session on the A16 with the load timer (Settings › Graphics) and a frame-time overlay, in each city, driving and on foot; the numbers recorded against the table above.

**P2. Memory.** Perf, **High**.

Evidence (probe): the JS heap is 279 MB in Lagos, and 347 to 380 MB after visiting the other cities. Each city stays built once visited (code: `CityManager` keeps `abujaCity` and `portHarcourtCity`). A 4 GB phone's Chrome tab can be killed well before this, with the GPU's own memory on top.

Fix: measure the heap on the A16; free a city's meshes and textures when the player leaves it (rebuilding on return), and check for leaks across city changes.

**P3. Port Harcourt draws 422,000 triangles.** Perf, Medium.

Evidence (probe): 2.5 times Lagos's on arrival.

Fix: find the heaviest meshes there (the refinery, the waterfront, the market?) and give them distance-based detail.

**P4. Lagos's 500 draw calls.** Perf, Medium.

Evidence (probe and record): 502 on arrival; the map has about 1,500 (record, 12 Nov). Shadows cost about 30% of a street frame (record).

Fix: merge static street pieces by block, a cheaper shadow setting for low-end phones, and the map drawn as one image when still.

**P5. Traffic is the larger simulation cost in Lagos.** Perf, Low.

Evidence (probe): 1.4 ms against the crowd's 0.5 ms. The crowd's own target (under 1 ms) is met in every city (suite).

Fix: traffic at levels of detail, as the crowd has (stage 1's approach).

Driving and touch: the record shows the steering slider, brake, kerb and pavement fixes (`2597ba7`, `1f2e463`, `09e1573`). You reported on 12 Nov that driving was better. "Driving still jerks on the phone" (8 Nov) has not been re-checked on the A16 since those changes. Covered by P1.

## Not covered by this audit

- **Sound and music:** no audit.
- **The admin and server under load:** `docs/LOADTEST.md` exists (record).
- **Every one of the 91 rooms:** only a sample of each kind was entered.
- **Driving arrival:** see N5.
- **The map's place card:** see N6.
- **Fonts and design consistency:** see U6.
