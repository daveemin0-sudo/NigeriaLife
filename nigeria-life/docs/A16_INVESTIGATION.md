# A16 investigation (14 Nov 2026)

This investigates the problems found in the Stage 0 Samsung A16 session (build `a16-0887dde`). It is documentation only. No game code has been changed, and nothing has been merged, deployed or published.

## Where each result comes from

- **A16 (physical device):** only the user's report from the Stage 0 session:
  - Android Chrome 157; window 320×607 at device pixel ratio 3.375.
  - Start-up 16.3 to 19.1 s.
  - One mark on a Lagos street: 0.4 fps, with one frame of 10,217 ms.
  - Later: 8.6 fps, p95 233 ms, 178 draw calls, 221k triangles, JS heap 483 MB.
  - The page was reloaded while the readout was running.

  I have not tested on the A16 myself. Every other figure here comes from the laptop.
- **Laptop, A16 emulation:**
  - headless Chrome at 320×607, touch, `isMobile`
  - the CPU slowed 4× through DevTools
  - an unminified build of `0887dde`

  This shows *where* time goes and *what* happens. It does not give phone timings.
- **Code:** file and line references are given for every root cause.

Probe scripts and their outputs are kept out of the repository (scratchpad). Each finding names the probe that produced it.

## Summary

| # | Finding | Status | Severity |
|---|---|---|---|
| R1 | A saved position is clamped to ±400 m, but most of Lagos (and parts of Abuja and Port Harcourt) is beyond that. After any reload, a far place becomes a spot back toward the centre. | Confirmed (laptop + code) | Critical |
| R2 | A reload during a ride loses the ride: the fare is taken and the player is back where they booked it. | Confirmed (laptop) | Critical |
| R3 | The set-down is not saved straight away (only by the 5 s autosave). | Confirmed (laptop + code) | High |
| R4 | The ride itself does set down at the door, in all three cities, both played through and skipped (the 8 Nov fix works within a session). | Confirmed working (laptop) | n/a |
| P1 | The first map open freezes the game for about 10 s: 32 shaders compiled at once. | Confirmed (laptop 10,348 ms; A16 frame of 10,217 ms) | Critical |
| P2 | The first room entry (3.1 s) and the first ride (4.5 s) freeze the same way. | Confirmed (laptop) | High |
| P3 | Steady play is CPU-bound: about 12,500 scene objects walked twice a frame, plus traffic and smoke logic. Lowering graphics quality does not raise fps. | Confirmed (laptop profile) | High |
| P4 | A 4.1 s frame on a quiet street, cause not yet found. | Seen once (laptop) | Medium, unconfirmed |
| P5 | The A16's JS heap (483 MB) is far above the laptop's (about 290 MB). | A16 figure; cause unknown | High, needs USB |
| U1 | The Stage 0 performance readout sits over the player character. | Confirmed (screenshot); my defect | High |
| U2 | Beside a place, the RUN button covers the place's main action button. | Confirmed (screenshot) | High |
| U3 | The ride card overflows the 320 px screen; the view picker and the "⌄" button cover parts of it. | Confirmed (screenshot) | Medium |
| U4 | The "⌄" button covers the quest chip at the top. | Confirmed (screenshot) | Medium |
| C1 | The street camera's 55° lens is vertical: on a portrait phone the view is only about 31° wide. | Confirmed (code + arithmetic + screenshots) | High |
| C2 | The camera's wall check knows only Lagos buildings: in Abuja and Port Harcourt it goes through walls, and it never sees parked cars. | Code confirmed; cars by screenshot | High |
| C3 | There is no first-person view on the street; "eye" falls back to the close view. | Confirmed (code) | Medium |
| A1 | Abuja's apartment blocks, houses, duplexes and bungalows have no door and no card. | Confirmed (code) | High |
| A2 | Every Abuja office and every market opens one shared room (audit I1); the big shed-like buildings are these. | Confirmed (audit probe) | High |
| A3 | Which building the user tapped as "the warehouse" is not known. | Open; device step below | n/a |
| G1 | My A16 test steps told a new player to fly to Abuja: flights cost ₦3.6 to 4.2 million against a start of ₦175,000. | Confirmed (my procedure error) | High |
| G2 | Early earning against early costs | Partly measured | Medium |

## R. Rides that "return the player to where they started"

**What was reported:** a far destination was chosen in the Ride app. The journey appeared to complete, but the player was back at the starting point. This had been reported before.

### R4. The ride itself works (in one session)

Probe `inv_ride.mjs`:
- It books the farthest place the Ride app lists, the way the app does (`rides.book`), then waits for the driver, the trip and the set-down.
- It traps every jump of the player's x or z with the code that made it.

Results:

| City | Destination | Played through | Skipped |
|---|---|---|---|
| Lagos | Murtala Muhammed Airport, z 6,268 | set down there, still there 8 s later | same |
| Abuja | FCT Police Command | set down there, held | |
| Port Harcourt | Rivers State Police Command | set down there, held | |

The only jumps came from `arriveAt` (`src/game/Game.ts:1502`), called from `onRideCompleted` (`Game.ts:681`). Nothing moved the player back during the session.

A second probe (`inv_ride2.mjs`) tapped through Phone › Ride › the airport › Taxi at 320×607 with the CPU at 4×, in real time. Same result: set down at (−53, 6268.8).

So the 8 Nov fix (`625a9b5`, rides set down at the door) works. The return happens when the page is loaded again.

### R1. A reload moves a far player back toward the centre (root cause)

- `src/backend/SaveSchema.ts:243-244` clamps the saved position to ±400 m:
  ```ts
  x: Math.min(400, Math.max(-400, world.x)),
  z: Math.min(400, Math.max(-400, world.z)),
  ```
- The cities are much larger. Places beyond ±400 (probe `inv_bounds.mjs`):

  | City | Ride app destinations outside | Places with a card outside | Farthest place |
  |---|---|---|---|
  | Lagos | **43 of 61** | 139 of 438 | z 6,633 |
  | Abuja | 1 of 81 | 61 of 166 | x 533, z 743 |
  | Port Harcourt | 0 of 33 | 90 of 227 | x 531, z 520 |

- Probe `inv_ride2.mjs`, variants A and C: set down at the airport (−53, 6268.8); the save held (−53, 6268.8); the tab was reloaded.
  - **The player came back at (−53, 400)**: the island end of the expressway, about 350 m from where the ride started.
  - On screen that reads as "I was taken back".
- The reload is what Chrome does when it discards a tab under memory pressure. It also happens on several sign-in paths:
  - `Game.ts:1001`: signing in to an account that has a life on another device
  - `OnlineAccount.ts:244`: binding the registry id
  - `CloudSyncService.ts`: five places
- The A16 report says the page **was reloaded while the readout was running**, and its heap was 483 MB.

### R2. A reload during a ride loses it

- The probe reloaded the tab in the middle of the ride (variant B).
  - The fare (₦4,500) had been taken.
  - After the reload the player was **at the booking spot** and the ride was gone.
- Cause:
  - `saveWorldState` skips saving while a ride is active (`Game.ts:3908-3915`), which is correct.
  - But a road ride never saves "in transit" with its destination, as coaches and flights do (`saveArrivalInTransit`, `Game.ts:3851`; restore at `Game.ts:3965`).
  - So the last save is the pre-ride spot.
- On the A16 a ride lasts many seconds of slow frames, and arriving at a far place loads a part of the city not drawn before. This is the most likely moment for Chrome to drop the tab.

### R3. The set-down is not saved at once

- `arriveAt` (`Game.ts:1502`) moves the player and does not save. Saving waits for the 5 s autosave (`AUTOSAVE_SECONDS`, `Game.ts:185`).
- In variant C the save still held the starting spot at the moment of set-down.
- On the A16, one 10 s frame can stretch that window to 10 s or more.

**Conclusion:** the most likely chain on the A16 is: a far ride, then the tab reloaded (R2 during the ride, or R1 after it), then the player is back at or near the start.

The physical-device step below confirms which one it was.

### R5. Seen in passing (needs confirming)

If the map is open when the driver arrives, the ride plays behind the map: `startJourney` closes the phone, not the map (`Game.ts:1496`). My probe hit this by accident. A player could too, by opening the map while waiting for the driver.

## P. Performance

### P1. The first map open freezes the game for about 10 seconds (root cause found)

Probe `inv_firsts.mjs`: 320×607, CPU 4×, 25 s after start-up. For each step: the worst frame in the next 12 s, and the shader programs compiled.

| Step | Worst frame | Frames over 0.5 s | Shader programs |
|---|---|---|---|
| Standing on the street (baseline) | 4,116 ms (see P4) | 1 | 56 → 56 |
| **First map open** | **10,348 ms** | 1 | **56 → 88** |
| Map closed | 233 ms | 0 | 88 |
| Second map open | 267 ms | 0 | 88 |
| **First room (Mama Put)** | **3,116 ms** | 1 | 88 → 97 |
| Leaving the room | 216 ms | 0 | 97 → 101 |
| **First ride (to the airport)** | **4,533 ms** | 2 | 101 → 113 |
| First drive | 300 ms | 0 | 113 |

- The A16's 10,217 ms frame matches the first map open, both in size and in being a one-off.
- Cause:
  - The map's group is in the scene but hidden until opened (`src/world/map/WorldMap.ts:66`).
  - On opening, `activate()` may rebuild the map for the "real world" view (`WorldMap.ts:482`, `loadCity`). The scene's object count changed from 12,458 to 10,831 at that moment.
  - The start-up warm-up (`warmShaders`, `Game.ts:1532`) therefore never compiled the map's materials. All 32 were compiled in one frame on first open.
- Rooms have a 6 s warm-up (`InteriorManager.warm`), but compiling still costs a 3 s frame on first entry.
- The ride scene (`RoadRideExperience`) has no warm-up at all.

### P3. Steady play is CPU-bound

From the earlier emulation run (`inv_perf.mjs`): CPU 4×, the automatic quality step live, a 10 s CPU profile.

- Per second of play, drawing took 600 to 700 ms and game logic 250 to 370 ms, of which traffic was 63 to 224 ms and people 18 to 91 ms.
- The scene has 12,458 objects (9,460 meshes).
- Time by function:

  | Share | Function |
  |---|---|
  | 12.1% | the still-matrix walk (`installStillMatrices` in the renderer patch) |
  | 7.1% | `projectObject` |
  | 6.8% | the frustum test |
  | 3.1% | `TrafficSpawner.update` |
  | 2.6% | smoke particles |
  | 1.5% | crowd |
  | 1.4% | instance buffer uploads |

- The quality step-down (Balanced to Low at 9.5 fps) cut draw calls from 745 to about 165–600, **and fps did not rise**.
- So pixels and the GPU are not the main cost on a slow CPU. Walking 12,500 objects twice a frame is.

### P4. One 4.1 s frame on a quiet street

Seen once, 25 s after start-up, with no shader compiled and no object added. Candidates:
- garbage collection
- a first shadow redraw at a new size
- a first-time crowd or traffic event

Not yet confirmed. The repair stage will log long frames with what ran in them.

### P5. The A16's heap

- A16: 483 MB of JS heap (Chrome's rounded figure, limit 1,387 MB).
- Laptop at the same screen: 250 to 300 MB.
- Possible causes: larger GPU-side copies kept in JS on that GPU driver; or a reload part-way through keeping old copies.

This needs the USB step below. I will not guess.

## U. The screen at 320×607

Probe `inv_views.mjs` took screenshots and measured every on-screen element.

- **U1. My Stage 0 readout covers the player.**
  - It is fixed at the left, 42% down (`src/ui/PerfReadout.ts`), which is where the player stands on a portrait screen.
  - Every street screenshot shows the character behind it.
  - This is my defect from Stage 0. My test checked that the panel is inside the screen, not what it covers.
- **U2. RUN covers the action button.** Beside a place, the green main button ("Enter Lagos…") starts under the RUN button and the joystick ring.
- **U3. The ride card does not fit.**
  - Its right side is cut off ("Shift started … AM").
  - The Chase / Side / Inside picker sits over its right half.
  - The "⌄" button sits over the GO-SLOW badge.
- **U4. The top is crowded.** The "⌄" button covers the quest chip ("Ch. 1: Mainl…"). The date bar, the city chip, Street Chat, music and camera buttons all compete for the top third.

## C. Cameras

- **C1. Narrow view on a phone held upright.**
  - The street camera uses a 55° vertical field of view (`src/game/Camera.ts:9`, `STREET_FOV`).
  - At 320×607 (aspect 0.53) that is 2·atan(tan 27.5° × 0.53) ≈ **31° wide**, against about 89° on a 16:9 laptop.
  - The default view sits 8.5 m back (`Camera.ts:316`). So the player sees a tall, thin slice of street with a small figure in it.
  - The close view (5.2 m) is better but still a tunnel. Interiors use 40° (`INTERIOR_FOV`), which is even narrower on a portrait screen.
- **C2. The camera passes through walls in Abuja and Port Harcourt.**
  - The camera's wall check is set once: `collisionObjects = [world.buildings.group, world.districts.group]` (`Game.ts:402`).
  - Abuja's and Port Harcourt's buildings are in their own groups, added to the scene by `src/cities/CityManager.ts:93` and `:101`. They are never in that list.
  - Parked and moving cars are not in it either. The place-card screenshot shows the camera behind a parked car's body, filling the screen.
- **C3. No first-person view on the street.** `setPreset('eye')` on the street becomes 'close' (`Camera.ts:332`). Indoors there is an eye view (`EYE_FOV` 62°).
- **Not yet captured:** the room and eye-view screenshots at 320×607 (my probe's door tap missed), and clean ride views (the map was still open in that probe run). The repair stage's tests take these.

## A. Abuja: "warehouse" and "apartment"

- **A1. Abuja's homes cannot be entered or even tapped.**
  - Abuja's districts are built from offices, shops, flats, houses, duplexes, bungalows, hotels, markets and banks (`src/cities/AbujaDistricts.ts:53-72`).
  - Only shops, offices, hotels, banks and markets get a door (`TOWN_ROOM`, `src/cities/CityExtras.ts:64`). The comment there says "the homes stay private".
  - So every apartment block (`flats`) and house in Abuja is scenery: walking up to one shows nothing.
  - Abuja's property listings do include homes (Gwarinpa duplex, Asokoro penthouse; `src/world/data/AbujaMapData.ts:413-450`), but none has a door in the street.
- **A2. Abuja's big buildings share rooms.** Every Abuja office opens "Abuja Offices" and every market "Abuja Market" (audit I1). These large plain blocks are the most likely "warehouse".
- **A3. The Utako goods shed** is the only shed-like place with its own action ("Goods shed: buy and sell", `src/world/landmarks/MotorPark.ts:305`). It is wired to open the Trade app (`Game.ts:1239`). My probe did not confirm the tap end to end.
- **What I could not settle without the phone:** which building was tapped and what happened. The report will carry this from now on (repair step 3). The device step below names the building.

## G. A new player's money

- **G1. My test procedure was wrong for a new player.**
  - `docs/A16_TEST_SESSION.md` step 5 says to fly to Abuja. A new player has ₦25,000 cash and ₦150,000 in the bank (`server/accounts.ts:38-39`; `src/backend/types.ts:1477`).
  - Flights are ₦3.6 to 4.2 million (`src/travel/Flights.ts:38-43`).
  - The coach (₦36,000 to 42,000, `src/travel/CoachTimetable.ts:30-35`) was the way to go.
  - The procedure will be corrected with the repair plan.
- **G2. Early earning against costs.**

  | Item | Amount | Source |
  |---|---|---|
  | Starting jobs | ₦5,000 to 18,000 a shift | `src/jobs/employers.ts` |
  | Taxi to the airport | ₦4,500 | |
  | A coach | ₦36,000 to 42,000 | |
  | Cheapest Lagos rent | ₦25,000 | |
  | First course fee | ₦35,000 to 50,000 | `src/life/Qualifications.ts:21-23` |

  How long a starting shift takes in real minutes was not measured in this pass. It is the remaining question for "frustrating with limited money", and the first test in repair step 7.

## Repair plan (proposed; nothing started)

Ordered by harm to the player, then by how much each unblocks the next. Each step is small and separately approvable. None removes a gameplay system.

| Step | Fixes | What changes | Files |
|---|---|---|---|
| 1 | R1, R2, R3 | <ul><li>The save's position check uses each city's real bounds (from its places), not ±400.</li><li>A road ride saves "in transit" to its destination when it starts, so a reload finishes the ride at the destination (as coaches do).</li><li>The set-down saves at once.</li><li>The map closes when a ride starts.</li></ul> | `SaveSchema.ts`, `Game.ts` (`startJourney`, `arriveAt`, `onRideTo`, `restoreWorldState`) |
| 2 | P1, P2 | <ul><li>The map is built and its shaders compiled during start-up's warm-up (it is in the scene, hidden).</li><li>The ride scene is warmed too.</li><li>Rooms are warmed behind the door fade before they are shown.</li></ul> | `Game.ts` (`warmShaders` scope), `WorldMap.ts`, `RoadRideExperience.ts`, `InteriorManager.ts` |
| 3 | U1–U4, A3 | <ul><li>The readout moves to a small collapsible strip at the top right, never over the middle column.</li><li>The place action button sits above the joystick.</li><li>The ride card fits 320 px with its view picker below it.</li><li>The "⌄" button stops covering chips.</li><li>The report adds the last 5 places tapped and what opened, and each mark records the player's spot.</li></ul> | `PerfReadout.ts`, `luxe.css` / HUD styles, `TransitHUD.ts` |
| 4 | C1, C2, C3 | <ul><li>On a portrait screen the camera keeps at least about 50° across, by widening the lens a little and pulling the camera back and up, and is tuned on screenshots.</li><li>The wall check follows the current city's buildings and includes cars.</li><li>A street first-person view is added to the camera cycle.</li></ul> | `Camera.ts`, `Game.ts:402`, `CityManager.ts` |
| 5 | P3, P4 | <ul><li>Less per-frame scene walking: still groups skipped whole, far district groups switched off by distance, smoke and traffic logic thinned at low quality.</li><li>A long-frame log names what ran.</li></ul> This is Stage 4's work, brought forward only as far as the A16 measurements justify. | `StillMatrices`, `Game.ts` loop, `TrafficSpawner.ts`, `GraphicsQuality.ts` |
| 6 | A1, A2 | Needs your decision on scope: homes in Abuja with doors (rented or owned ones open their home; others show a card), and distinct rooms per building kind. This overlaps roadmap Stage 3 and audit I1, so I propose it is decided with Stage 3. | `CityExtras.ts`, `AbujaCity.ts` |
| 7 | G1, G2 | <ul><li>Correct the A16 procedure (coach, not flight).</li><li>Measure first-hour earning in real minutes.</li><li>Report before changing any price.</li></ul> | `docs/A16_TEST_SESSION.md` |

My recommendation is to do steps 1 to 4 before Stage 1. They are what makes the next A16 session useful.

## Tests that prove each fix

| Step | Test (added to `npm run test:e2e` unless noted) |
|---|---|
| 1 | <ul><li>For the farthest Ride app place in each city, ride, reload: the player is within 3 m of the set-down.</li><li>Reload mid-ride: the player is at the destination, fare taken once, ride cleared.</li><li>The save holds the set-down within one frame of arriving.</li><li>A ride booked with the map open plays with the map closed.</li></ul> |
| 2 | <ul><li>At 320×607 with the CPU 4× (the `inv_firsts` probe turned into a suite): the first map open, first room and first ride each add no shader programs.</li><li>Their worst frame is under 1,000 ms on the laptop. The A16 target is set from the next device session, not assumed.</li></ul> |
| 3 | <ul><li>At 320×607 and 360×800: the readout does not cover the screen's middle third.</li><li>The place action button and the joystick/RUN do not overlap (`elementFromPoint` at the button's centre is the button).</li><li>The ride card and its buttons are inside the screen and uncovered.</li><li>The report lists the places tapped.</li></ul> |
| 4 | <ul><li>At 320×607: the horizontal view is ≥ 50° on the street.</li><li>In Abuja and Port Harcourt, walking along a building with the camera turned toward it, the camera never ends up inside a building's box.</li><li>Standing beside a parked car, the camera does not end up inside the car.</li><li>Screenshots of every view are saved for review.</li></ul> |
| 5 | <ul><li>The CPU profile share of the still-matrix walk plus `projectObject` drops by at least half at the same scene.</li><li>No change in what is drawn (the rendered-frame checks).</li><li>Crowd stays under 1 ms per city.</li></ul> |
| 6 | Per the decision. |
| 7 | <ul><li>A new player can reach Abuja by coach on starting money.</li><li>First-hour earning measured and reported.</li></ul> |

Every step also runs the full suite. Results are reported separately for the laptop and the phone.

## Focused A16 steps (short, no diagnosis needed)

To run with the next session (`npm run a16:session`, local server only). Each one says what to do and what to send; the report does the rest.

1. **The ride.** Tap Mark. Then Phone › Ride › Murtala Muhammed International Airport › Taxi. Ride all the way. When you are set down, wait 10 s and tap Mark. Then close Chrome completely, open the address again, and tap Mark once you can walk. Send the report, and say in one line whether you were at the airport after reopening. Today's report shows whether Chrome reloaded the page, but not the spot. Repair step 3 adds the spot to each mark.
2. **The map.** After loading, wait 30 s, tap Mark, open the map once, close it, wait 30 s, tap Mark. Send the report: the worst frame between the two marks is the map's.
3. **The Abuja building.** Go to the building you meant. Tap it as before, then tap Mark straight away. After repair step 3 the report names the last places tapped and what opened.
4. **Optional, with a USB cable** (`docs/A16_TEST_SESSION.md` section 3): `adb shell dumpsys meminfo com.android.chrome` at the two map marks. This shows the memory Chrome is actually using and settles P5.
