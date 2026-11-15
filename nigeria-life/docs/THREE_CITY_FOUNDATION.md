# NigeriaLife first release: the three-city foundation

*15 Nov 2026. An honest assessment against the first-release direction. Documentation only; nothing here has been built.*

## The direction (agreed)

- **The first release has three cities: Lagos, Abuja and Port Harcourt.** All three must be accessible and playable, and all three must support the core game loop.
- **The vision is all 36 states.** The game is built so states can be added without rebuilding it.
- **The three cities need not be equally detailed on day one.** They share the same core systems, and each grows its own identity:

  | City | Identity |
  |---|---|
  | Lagos | Commerce, markets, ports, traffic, nightlife |
  | Abuja | Capital, government districts, estates, institutions, planned streets |
  | Port Harcourt | Industry, oil and gas, waterfronts, markets, neighbourhoods |

- **Rule: no development without visible product progress.** Every cycle delivers something a player can see or do, alongside any essential maintenance. Technical work must serve the game.

## Where each city stands against the nine first-release requirements

Key:
- **Playable** = works end to end today.
- **Partly** = works, with gaps a player will hit.
- **Missing** = not there.

Evidence is from the quality audit (`QUALITY_AUDIT.md`, 14 Nov), the A16 investigation (`A16_INVESTIGATION.md`), the code, and the automated tests. Phone figures are from the user's A16 reports; everything else is from the laptop.

| # | Requirement | Lagos | Abuja | Port Harcourt |
|---|---|---|---|---|
| 1 | **Accessible, functioning city** | **Playable**: 60 of 61 Ride app places have a door | **Partly**: only 20 of 81 places can be entered (25%) | **Partly**: 15 of 33 (45%) |
| 2 | **One character and progression system** | **Partly**: careers, courses, certificates and CV exist, but certificates are only checked on the phone, not the server (Stage 2b) | Same system | Same system |
| 3 | **Working transport** | **Playable**: rides (now saved through reloads, tested 74/74), driving, own car, train (Red Line), coach, flights | **Playable**: rides, coach, flights; no train | **Playable**: rides, coach, flights; no train |
| 4 | **Meaningful jobs and earning** | **Partly**: 20 employers, but shifts are short and repetitive (4 rounds) | **Missing in practice**: 1 employer | **Missing in practice**: 2 employers |
| 5 | **Functional buildings and interiors** | **Partly**: own rooms for most places; some Broad Street places have none (salon, Sabo Textiles, NaijaBet, cash machine) | **Partly**: every office, bank, shop or market door opens one shared room; apartment blocks and houses have no door at all | **Partly**: shared rooms as in Abuja |
| 6 | **NPCs with everyday routines** | **Playable**: Living City routines and stalls; 23 named people to talk to | **Partly**: routines and stalls, but **no one to talk to in the street** | **Partly**: as Abuja; two stalls block the 22 Aba Road plot |
| 7 | **Property and business ownership** | **Playable**: land, building, homes, businesses; money and land held by the server | **Partly**: listings exist, but no home has a door in the street | **Partly**: as Abuja |
| 8 | **Reliable saving and accounts** | **Partly**: progress is saved to the account and journeys survive reloads (Step 1, L2). There is no password reset, the save history keeps only 5 versions, and backups sit on the same server disk. | Same | Same |
| 9 | **Performance on the Samsung A16** | **Not yet**: 8.6 fps on foot, a 10 s freeze on first map open, start-up 16–30 s | **Not yet**: 19 fps | **Not yet**: 20 fps, the heaviest city (421,000 triangles) |

**Plainly:**
- **Lagos** is the most complete. It is playable but rough: jobs are thin, a few places have no room, and it runs too slowly on the A16.
- **Abuja and Port Harcourt** can be reached and walked, and they have living streets. A player soon runs out of things to do there: most places cannot be entered, there is almost no work, nobody to talk to, and no home to go into.
- **Across all three,** speed on the A16 and account safety (password reset, backups) are not yet ready for real players.

## Is the game built to grow to 36 states?

**Not yet.** Adding a fourth city today would mean editing code in many places, not adding data:
- The city name `'abuja'` appears in **48 source files**.
- City changes are written city by city: `CityManager.switchCity` has a branch for each city.
- The saved-position limits, flights, coaches, jobs, quests and destinations are each listed per city in their own files.
- **Every city is kept in memory once built.** The first city change builds both other cities, and none is freed. With three cities that is about 220 MB of model data. With 36 it would not fit on a phone.

What 36 states needs, introduced gradually:
1. **A city as data.** One description of a city (its map, places, prices, jobs, routes and identity) that the systems read, instead of code naming each city.
2. **Build a city when it is visited, and free it when it is left.** This is already planned as roadmap Stage 4a and 4c.
3. **Journeys from data.** Flights, coaches and roads between any two cities, from one timetable.

This can be done one system at a time while the three cities keep working. It should be built in, not added at the end.

## Applying "visible progress" to the plan

Each cycle pairs the essential work with something a player will notice. A suggested order, for discussion; nothing is approved or started:

| Cycle | Essential work | What a player sees |
|---|---|---|
| A16 Step 2 | Remove first-time freezes (map, rooms, rides, flights) | The 10 s freeze on opening the map is gone |
| A16 Step 3 | Screen layout at 320 px | Nothing covers the character or the buttons; the ride card fits |
| A16 Step 4 | Cameras | A wider view on a phone held upright; no camera inside walls in Abuja or Port Harcourt |
| Abuja and PH doors | Doors and cards for the 61 + 18 places that cannot be entered (audit N1) | Abuja and Port Harcourt places open |
| Work in every city | Employers and shifts in Abuja and Port Harcourt that suit each city (civil service, estates and institutions in Abuja; oil and gas, port and markets in PH) | A job in each city, paid properly |
| People to talk to | Named street people in Abuja and Port Harcourt | Someone to greet and do business with in every city |
| Homes in Abuja and PH | Doors on homes; rented or bought homes that open | A home in every city |
| Stage 1 + 2 | Backups off the server disk; password reset and account recovery | "Forgot password" works; progress cannot be lost |
| Stage 4 | Memory and speed; a city built when visited | Smoother play on the A16; groundwork for more states |

The account-safety stages (1 and 2) are invisible to a player but essential before launch. Following the rule, each is paired with a visible cycle rather than done alone.

## What this document does not promise

No launch date. The table above is the gap. Each cycle is measured by what a player can do afterwards that they could not before, and is tested in all three cities.
