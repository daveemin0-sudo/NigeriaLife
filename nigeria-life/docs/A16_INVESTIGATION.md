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

## M. Memory when changing cities (15 Nov 2026)

Laptop measurements on the Step 1 build (probes `inv_memory`, `inv_memory2`, `inv_memory3`, `inv_alloc`). The live heap is read after a forced collection; GPU geometries are three.js's count; model data is the vertex arrays the game holds outside the JS heap. Rooms are the number of interior templates.

| After | Live JS heap MB | GPU geometries | Model data MB | Scene objects | Cities built |
|---|---|---|---|---|---|
| Lagos at start | 81 | 506 | 146 | 12,459 | Lagos |
| Lagos, one room | 82 | 1,136 | 146 | 12,459 | Lagos |
| Abuja, first visit | 91 | 1,198 | 220 | 14,829 | all three |
| Port Harcourt, first visit | 91 | 1,221 | 220 | 14,829 | all three |
| Lagos, Abuja, Port Harcourt, then Lagos again | 93 to 95 | 1,612 to 1,771 | 220 | 14,829 | all three |

- **The readout's heap counts garbage.** Standing in Lagos, the readout figure was 245 to 265 MB while the live heap was 81 MB. After four Lagos–Abuja trips it was 361 to 379 MB, with a live heap of 90 MB. The A16's 687 to 765 MB is the same measure on a phone whose collector runs behind.
- **Short-lived memory: about 25 MB a second** on Lagos's street.

  | Share | What |
  |---|---|
  | 47% | `TrafficSpawner.update` |
  | 17% | three.js re-choosing shader programs |
  | 14% | uniform uploads |

- **No leak.**
  - Three minutes standing still: no new geometry made. The GPU count rose 605 → 668 only as existing people and cars were first drawn, bounded by the 9,150 in the scene.
  - Four Lagos–Abuja round trips: +129, +10, +4 geometries.
- **What stays:** the first city change builds both other cities (`CityManager.switchCity` calls `initAbuja()` and `initPortHarcourt()`), and no city is freed.

The fixes are in roadmap Stage 4 (4a build a city only when visited, 4b cut per-frame garbage, then free a city on leaving).

## Repair plan

**Step 1 (rides and saving) done**, on `claude/next-steps`; laptop only, not yet tried on the A16.
- Saved spots are checked against each city's own bounds (`SAVED_CITY_BOUNDS` in `SaveSchema.ts`), not ±400 m.
- A paid ride in a city saves where it sets down before it starts (`rideTo`), so a reload on the way opens the game there, told and not charged again.
- The set-down is saved the moment the ride ends.
- A ride closes the map.
- Proven by `tests/e2e/ridesave.mjs` (35 checks).

Steps 2 to 7 are not started.

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

1. **The ride.** Use the Step 1 check below; it replaces this step.
2. **The map.** After loading, wait 30 s, tap Mark, open the map once, close it, wait 30 s, tap Mark. Send the report: the worst frame between the two marks is the map's.
3. **The Abuja building.** Go to the building you meant. Tap it as before, then tap Mark straight away. After repair step 3 the report names the last places tapped and what opened.
4. **Optional, with a USB cable** (`docs/A16_TEST_SESSION.md` section 3): `adb shell dumpsys meminfo com.android.chrome` at the two map marks. This shows the memory Chrome is actually using and settles P5.

## Step 1 check on the A16: rides survive a reload

**Optional, not needed to accept Step 1.** The automated phone run in the verification report below covers these checks. This list is kept only in case you ever want to see it on the phone yourself.

This checks build `a8ce080` or later on the phone. Allow about 20 minutes, plus the coach trip for part C.

### Before you start

1. On the laptop, in the `nigeria-life` folder, run `npm run a16:session`. Its first line must say `Branch claude/next-steps at` with `a8ce080` or a later commit; an older build does not have the fix.
2. Open the printed address in Chrome on the A16. A brand-new player is fine: the fares below are well within the starting money.
3. **How to reload Chrome:** tap **⋮** (top right), then the **circular arrow** at the top of the menu. Wait until you can walk again.
4. **How to check a fare:** open Phone › **Bank** and type the place's name in the search box. Each ride shows one line, for example "Taxi / Bolt Cab to Murtala Muhammed International Airport (LOS)", with the fare.

### A. A ride played to the end, then a reload (Lagos)

1. Note your cash at the top of the screen.
2. Phone › **Ride**. Search "Murtala" and tap **Murtala Muhammed International Airport (LOS)**. Tap **Taxi / Bolt Cab** and note the fare. Wait on the street: the driver comes in a few seconds.
3. Let the ride play to the end; don't press Skip.
4. **Check:** the message "You have arrived at Murtala Muhammed International Airport (LOS)" appears, and you are standing outside the airport terminal. Open Phone › Ride and note the line under "You are in", then close the phone.
5. Reload Chrome.
6. **Check:** you are still outside the airport terminal, not back on the island where you started. Phone › Ride shows the same "You are in" line as in step 4.
7. **Check:** in the Bank app, searching "Murtala" shows exactly **one** fare line, and your cash went down by that one fare.

### B. A reload in the middle of a ride (Lagos)

1. From the airport: Phone › **Ride** › **Computer Village (Otigba Technology Market)** › **Taxi / Bolt Cab**. Note the fare and your cash.
2. As soon as the ride view appears (the ride card at the top with "Skip ride"), reload Chrome straight away. The ride lasts only about 10 seconds, so be quick. If it ends before you reload, write "too late" and repeat B.
3. **Check:** after the reload, the message "You have arrived at Computer Village (Otigba Technology Market)" appears, and you are outside Computer Village. You are **not** at the airport.
4. Wait a minute. **Check:** in the Bank app, searching "Computer Village" shows exactly **one** fare line, and your cash went down by one fare only: not twice, and not nothing.

### C. Once in Abuja

1. Get to Abuja by coach (a flight costs millions): Phone › Ride › **Jibowu Motor Park**. At the park's ticket window buy the coach to Abuja (₦42,000), then board at the coach.
2. In Abuja: Phone › Ride › **FCT Police Command** (the Abuja place farthest from the park) › Taxi. Ride to the end.
3. **Check:** you are outside the FCT Police Command. Reload Chrome. **Check:** you are still there.
4. Phone › Ride › any other place › Taxi, and reload as soon as the ride view appears.
5. **Check:** you open at that place with the "You have arrived at …" message, and the Bank app shows one fare line for it.

### What to send me

For each of A, B and C: each **Check** marked yes or no, plus a screenshot of anything that looks wrong. Then tap **Report** on the performance panel and send that too: it records each Chrome reload, so it confirms that each reload really happened.

## Step 1: two remaining limitations (recommended fixes, not implemented)

### L1. "Turn back" acts like "Skip ride"

**What happens now:** the ride card has two buttons, "Skip ride" and "Turn back". Both call the same thing (`src/transit/TransitHUD.ts:161`, `onSkipRide`), so "Turn back" takes the player **to the destination**, the opposite of what it says.

**Recommended fix:**
- "Turn back" ends the ride where it was booked. The player is set down at the pickup spot, which `startRoadRide` already knows. At that moment the save is changed to the pickup spot, so a reload after turning back opens there too.
- **Fare:** the fare was paid when the driver arrived, as for any taxi. I recommend keeping it, with the button saying so before it is pressed: "Turn back: to <pickup place>, fare not refunded". It is honest and simple, and there is no money path to exploit.
  - The alternative is to refund part of the fare for the distance not ridden. That needs a refund the game server checks, so it is better done with the money work in Stage 2b. **This needs your decision.**
- The Ride app, the map cab and the keke to a station all behave the same way.

**Files:** `TransitHUD.ts` (its own callback), `RoadRideExperience.ts` (a "turned back" end), `Game.ts` (`startRoadRide` keeps the pickup spot; the turned-back path sets the player down there and saves).

**Tests:**
- Turning back sets the player within 3 m of the pickup spot, in each city.
- A reload after turning back keeps them there.
- The fare is taken once (or the refund is exact, if you choose refunds).
- "Skip ride" still goes to the destination.

### L2. Clearing the browser just after arriving can bring back an older position

**What happens now:**
- On the phone itself, the arrival is saved the moment the player is set down.
- The copy on the **game server** is sent about 2 seconds after any save (`CloudSyncService.note()`, a 2 s wait), and in full every minute.
- If the browser's data is wiped in those 2 seconds, signing in again brings back the server's previous copy: the pickup spot, or wherever the last save was.
- A normal reload, closing the tab or Chrome dropping the tab are **not** affected: they read the save kept on the phone.

**Recommended fix:**
1. **Send important moments at once.** When a ride starts (the saved set-down) and when it ends (the arrival), send the save to the server straight away (`pushNow`), not after the 2 s wait. The same applies to the other journeys that move the player (coach and flight arrivals). This closes the gap to the time one request takes.
2. **Send on the way out.** When the page is hidden or closed, send the save with a request the browser finishes after the page has gone (`fetch` with `keepalive`).
   - Browsers limit such a request to 64 KB, so this is used only when the save fits under that.
   - Larger saves rely on point 1.
3. **Offline:** the save stays on the phone and is sent when the connection returns, as now. The report would show "not yet saved to your account" until then.

Point 1 is the main fix. Point 2 also covers a player who closes the game straight after arriving and then plays on another device.

**Files:** `CloudSyncService.ts` (an immediate push, and the keepalive send), `Game.ts` (calls at ride start, arrival, and coach and flight arrival).

**Tests (local test server):**
- Arrive at the airport, clear the browser 300 ms later, sign in: the player is at the airport.
- Close the tab during a ride and sign in on a second browser: the player is at the destination.
- With the server stopped, arrive, then restart the server: the arrival reaches the account when the connection returns.
- The existing account-save suite still passes, including two devices and "behind" handling.

Both fixes wait for your A16 results and your approval. Nothing here has been implemented.

## Step 1 verification report (15 Nov 2026)

Step 1 was verified without asking for more phone testing: the A16 evidence already sent, plus automated tests, including an A16-sized, slowed-down phone run.

### 1. The A16 evidence

**Confirmed on the A16** (report `a16-569767f`, 23:20; screenshot):
- The phone was running the fixed build (`Build: a16-569767f`).
- A ride in Port Harcourt set the player down at its destination: "You have arrived at Delta Bank.", standing on Aba Road.
- **Port Harcourt figures:**
  - 20.1 fps, p95 88.8 ms, 169 draw calls, 421,196 triangles
  - readout heap 687 MB (765 MB in the screenshot)
- **Start-ups on the fixed build:**
  - 42.3 s on the first load (19.2 s of it downloading the new code once)
  - then 24.3 s and 29.8 s
- **Abuja (old build, 22:57):** 19.1 fps, p95 111 ms; ride view 50 fps.

**Not confirmed on the A16:**
- Whether that Port Harcourt arrival was a normal arrival or the game reopening after a reload. The message reads the same.
- That a Chrome reload happened during or after any ride. The report only describes the page open at the time, and that was "a fresh load".
- A Lagos airport arrival, and the fare-once checks, on the phone.

Those are covered below by tests that do the same things on the laptop, with the phone's screen, touch and a CPU four times slower.

### 2. Automated tests added and results

`tests/e2e/ridesave.mjs` now has 48 checks in four parts. It runs on its own with `npm run test:e2e -- ridesave`, or by part with `RIDESAVE_ONLY=cities,phone,map,account`.

| Part | What it does | Result |
|---|---|---|
| **cities** (Lagos, Abuja, Port Harcourt) | <ul><li>The farthest Ride app place (beyond 400 m in Lagos and Abuja), played to the end and skipped.</li><li>A reload straight after arriving.</li><li>A reload in the middle of a ride.</li><li>**Chrome killing the tab mid-ride:** the page crashes, with no chance to save, and is opened again in a new tab.</li><li>The fare counted in the money and the ledger after each.</li></ul> | 36/36 |
| **phone** (320×607, touch, CPU 4× slower, real time) | <ul><li>Phone › Ride › search › Murtala Muhammed International Airport › Taxi, **by tapping**. The ride plays to the end in real time.</li><li>The tab is killed the moment the player arrives and reopened: the player is at the airport, 6.3 km out.</li><li>Then a ride to Computer Village, the tab killed mid-ride: the game reopens at Computer Village with "You have arrived at…".</li><li>Each fare taken exactly once.</li></ul> | 5/5 |
| **map** | <ul><li>A map cab in Port Harcourt to a place 531 m out, reloaded mid-ride: at the place, charged once.</li><li>A ride starting while the map is open: the map closes and the ride sets down at the door.</li></ul> | 3/3 |
| **account** (a local test server, never the live one) | <ul><li>A signed-up player rides to the airport: the game server's **own ledger** has that fare exactly once, and its wallet equals the game's.</li><li>A reload mid-ride while signed in: one fare on the server, wallets equal.</li><li>The browser cleared and signed in again: the player is where the last ride set them down.</li></ul> | 4/4 |

Notes:
- **Test mistakes found and fixed while strengthening the suite**, none of them a game fault:
  - a tap on a list item the phone screen had just redrawn
  - a check that expected the first ride's spot after a second ride had moved the player on
- **The full suite, end to end, after those fixes: 48/48 passed** (one run, about 30 minutes, on the Step 1 build).
- **Regression** (from the Step 1 commit): 366/367 across 21 related suites. The one failure, `online`, also fails on the build from before Step 1; it times out loading a page on this laptop with the CPU slowed.

### 3. Memory when changing cities

The full evidence is in section M below and in roadmap Stage 4. In short:
- The readout's "heap" (687 to 765 MB on the A16) is mostly memory waiting to be collected.
- On the laptop, the memory the game actually keeps is 81 MB at start and 95 MB after seven city changes. There is **no leak**.
- What does stay is every city once built. The first change of city builds both other cities, and none is ever freed: 146 → 220 MB of model data, outside the readout's figure.
- About 25 MB a second of short-lived memory is made on Lagos's street, half of it by the traffic update.
- Three changes were added to Stage 4: build a city only when visited, cut the per-frame garbage, and then free a city on leaving.

### 4. Remaining ride limitations: do they need code? The safest fixes

| # | Limitation | Needs code? | Safest fix | Risk if left |
|---|---|---|---|---|
| L1 | "Turn back" does what "Skip ride" does: it goes to the destination. | Yes (`TransitHUD.ts:161` wires both buttons to skip). | A turned-back end in `RoadRideExperience`, setting the player down at the pickup spot (kept by `startRoadRide`) and saving there; the fare is kept and the button says so. A part refund is your call and belongs with server-checked money (Stage 2b). About 40 lines. | Confusing, but no loss: the player arrives where they paid to go. |
| L2 | The browser cleared within about 2 s of arriving brings back the server's older spot. | Yes (`CloudSyncService.note()` waits 2 s). | Send the save to the server at once when a ride starts and ends (`pushNow`), and on page-hide with `fetch` keepalive when the save is under 64 KB. | Only when a player deliberately clears the browser within 2 s; a reload, a closed tab or Chrome killing the tab are covered (tested). |
| L3 *(new)* | If Android closes **the whole of Chrome**, not just the tab, within moments of a save, the last write may never have reached the disk. | Partly | Chrome writes browser storage to disk shortly after a change, not instantly. The L2 fix (sending the arrival to the server at once) covers signed-in players. Guests cannot be covered from the page. | Low; cannot be reproduced reliably on the laptop (see 5). |
| L4 *(new)* | If the tab dies in the instant between paying at pickup and the payment's report reaching the server, the server never records the fare. The server's wallet wins on the next load, so the fare is **not** charged. | Yes, later | Server-settled fares (the server takes the fare before the ride starts), the same pattern as shift pay. Belongs with Stage 2b. | Very low, and never a double charge: at worst one fare not taken. |

All four are small and none blocks Step 1. My recommended order:
1. **L1** first: a misleading button.
2. **L2**, together with L3.
3. **L4** with Stage 2b.

### 5. What genuinely needs the phone, and the alternative

| Question | Why the laptop cannot settle it | Alternative without a testing session |
|---|---|---|
| Chrome on the A16 really reopens the tab the way the laptop's crash test does | Android decides when and how to drop a tab. The laptop crash test does the same thing to the page (kills it, no page-hide, storage kept), but it is not Android's decision. | **None needed for normal play.** Whenever you next play, the report already notes "BROUGHT BACK AFTER CHROME DISCARDED IT" or "reloaded". If a ride ever ends somewhere else, send that report. |
| L3: whether Android sometimes closes all of Chrome before storage reaches the disk | Depends on Android's memory manager on that phone | The L2 fix removes it for signed-in players. No test session is useful. |
| The phone's true memory use (what Android weighs) | The page cannot see it | `adb` with a USB cable (`A16_TEST_SESSION.md` section 3): one command, no gameplay. Only needed for Stage 4. |

### 6. Recommendation

**I recommend accepting Step 1.**
- **The cause is removed.** The 400 m limit is gone, a ride's destination is saved before the ride plays, and the arrival is saved immediately.
- **Every way a player can lose a ride is tested**, in all three cities and on an A16-sized phone running four times slower than the laptop:
  - a reload straight after arriving
  - a reload mid-ride
  - Chrome killing the tab at arrival and mid-ride
  - signing in again on a cleared browser
- **The fare is taken exactly once**, in the game and on the server's own ledger.
- **On the A16 itself,** the fixed build ran and set a player down at a Port Harcourt destination. What the phone has not shown directly, a reload during a ride, is the case the laptop tests reproduce most closely.
- **The open items (L1 to L4) do not affect what Step 1 promised,** and each has a small, separate fix. L1 and L2 are ready to do when you approve them.

## L1 and L2 done; L3 and L4 recorded (15 Nov 2026)

Approved: L1 and L2 only. L4 is left for Stage 2b. Step 2 and Stage 4 are not started.

### L1. "Turn back" goes back to where the ride was booked

- **The button now reads "↩ Turn back · no refund".** Its title and spoken label say "Turn back to <the place it was booked>. The fare is not refunded."
- **Pressed,** the ride ends at the pickup spot, which `startRoadRide` keeps when the ride begins. That spot is saved at once and sent to the account.
- **The fare stays paid,** once. The message reads "You turned back to <place>. The fare is not refunded."
- **Where it appears:** only on a paid ride within a city (Ride app, map cab, keke to a station).
  - Coach journeys and the car from the airport after a flight no longer show "Turn back". It used to act as Skip there.
  - "Skip ride" is unchanged everywhere.
- **Files:**
  - `src/transit/TransitHUD.ts`: own callback; shown only when told where to turn back to.
  - `src/transit/RoadRideExperience.ts`: `turnBack()` and `endedBy`.
  - `src/phone/services/RideService.ts`: `endTrip()`.
  - `src/game/Game.ts`: the pickup kept; `setDownAtPickup`.

### L2. A journey's start and end reach the account at once

- **What counts as an important moment.** Each of these is sent to the game server immediately (`CloudSyncService.saveNow()`), not after the usual 2 s wait:
  - a ride in a city starting (its saved set-down)
  - a ride ending, including turned back
  - a coach or flight boarded (the in-transit save)
  - a coach pulling in
  - a flight landing
  - a ride finished by reopening the game
- **As the page goes away** (closed, or hidden), a last copy is sent with `fetch` keepalive, which the browser completes after the page has gone. This happens only if something was saved since the account's copy, and only if the copy is under 60 KB. Today's save is 35 to 41 KB.
- **The quiet moment after signing in is no longer a hole.**
  - After loading the account's copy, a device stays quiet for 20 s. This was already in the design: it keeps the reloading page's start-up from writing over the account.
  - Until now, anything saved in those 20 s waited for the next full copy, up to a minute later.
  - It is now sent the moment the quiet ends. The quiet itself is unchanged.
- **A device knows its own last copy.**
  - A copy sent as the page closes is stored by the server, but the closing page never hears the reply. On the next load the account's copy is one version "newer" than the device knows.
  - Without care, that made the game reload once more at start and could say "This device was behind". The regression suites caught it.
  - The server now says which device wrote the copy it holds; it already kept this for its lost-reply rule. A device seeing its own copy just notes the version and does not load it again. A copy from any other device, or one put back by the game team, still loads as before.
- **Files:**
  - `src/backend/CloudSyncService.ts`: `saveNow`, `sendOnLeave`, `quietLeft`, own-copy check on load; a pending count so a save made while a copy is on its way is not taken as sent.
  - `server/saves.ts`: `read` also returns the device that wrote the copy (no change to what is stored or accepted).
  - `src/online/OnlineAccount.ts`: `sendAsLeaving`.
  - `src/game/Game.ts`: the calls at each journey point.

### L3. What remains on Android (documented, as asked)

Even with L2, a few seconds can exist where the newest position is only on the phone. L2 makes these as short as the page allows.

| Moment | How long | Why | Protection |
|---|---|---|---|
| Right after a journey starts or ends | One request: about 20 ms on the laptop; on a phone, one or two network round trips | The save is sent at once but has to travel | L2 |
| The first 20 s after loading the account's copy (signing in on a device) | Up to 20 s | The quiet moment that stops a reloading page from overwriting the account | Sent the moment it ends |
| The first flight of a visit | About 2 s on the laptop, longer on the A16 | Boarding draws the flight scene for the first time and the page freezes (P2); nothing can be sent until it draws again | Repair step 2 removes the freeze |
| Android closing **all of Chrome** (not just the tab) | Moments | Chrome writes browser storage to disk shortly after a change, not instantly; if the whole of Chrome is killed in that moment, the phone's copy can be one save behind | For a signed-in player, the account already has it (L2). A guest has only the phone's copy, and no web page can force Chrome to write to disk. |
| Signing in on another browser | 30 to 100 s on the busy laptop, before and after this change | The sign-in loads the game several times (account copy, then the player registry); each load is a full start-up | Unchanged by L2; noted for the start-up work |
| Two devices open at once | While both are open | The newer device steps aside ("Playing on another device") so it cannot overwrite the other; existing behaviour | By design; "Play here instead" |

**Strongest practical protection:** be signed in. With L2, every journey's start and end are on the server within a request of happening. The only Android-specific gap left (all of Chrome killed in the same moment) is then covered by the account.

### L4

Left for Stage 2b as decided. The fare is reported to the server after it is paid in the game. If the tab dies within that instant, the fare is not charged; it is never charged twice.

### Tests

`tests/e2e/ridesave.mjs` gained two parts:

- **`turnback`:**
  - In Lagos, Abuja and Port Harcourt: the button's words, being set down at the pickup spot, that spot saved at once, the fare once, still there after a reload, and a new ride bookable.
  - A coach journey shows no "Turn back", and Skip still arrives.
- **L2,** inside `account`, on a local test server, one device at a time. In each case the browser's data is wiped 0.3 s after the moment, then the player signs in on a new browser:

  | Moment | Signed in again, the player is |
  |---|---|
  | A ride's end | at the airport |
  | 0.3 s into a ride | at its destination, the fare once on the server |
  | A coach boarded | at Utako |
  | A coach pulling in | at Waterlines |
  | A flight boarded (0.3 s after the page draws again) | on the Lagos apron |
  | A flight landing | on the Abuja apron |

  Plus two more checks:
  - The page closed within 2 s of a move: the last copy reached the account as the page went.
  - A ride taken in the quiet moment after signing in reached the account as soon as the quiet ended.

**Results** (laptop; `GAME_URL` a frozen build of this change):

| Run | Result |
|---|---|
| `ridesave` in one full run (cities, phone, turnback, map, account with L2) | **74/74** |
| Regression across 18 suites | **339/343** |
| `perfreadout` run alone | 12/12 |

The four regression failures:
- `online` fails the same way on the build from before this change (a 401 on `/ads`).
- `phonefit` fails on the build from before too, on different checks each run.
- `perfreadout` timed out loading at the end of the long run, and passed 12/12 alone.
- `accountsave` and `server` failed while the own-copy problem above was present, and pass now: `accountsave` 23/23 alone, and both in the full regression run.
