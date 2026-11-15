# M1 execution plan: It runs on the A16

*15 Nov 2026, branch `claude/next-steps` at `ae6db5a`. A plan only: no game code has been changed. It waits for approval.*

M1 covers acceptance requirement 9 (performance suitable for the Samsung A16) and confirms requirement 3 on the phone. It follows the standing rule: every work package ends with something a player notices, proven by a measurement.

**Where the evidence comes from**
- **A16:** the user's two reports.
  - Start-up 16–30 s.
  - One 10.2 s frame.
  - Lagos 8.6 fps (p95 233 ms); Abuja 19 fps; Port Harcourt 20 fps.
  - JS heap readout 376–765 MB.
  - Screenshots.
- **Laptop "A16 emulation":** the A16 screen (320×607, touch) and the CPU slowed 4×. Laptop figures are never presented as phone figures.
- **Investigations:**
  - `A16_INVESTIGATION.md` (P1–P5, U1–U4, C1–C3, section M).
  - A new start-up profile taken for this plan (section 1).

---

## 1. Start-up time and city loading

**Evidence.** Start-up profile, A16 emulation, unminified build of this branch:

| Stage | Laptop at A16 speed | A16 (reports) |
|---|---|---|
| Code and fonts | 3.6 s | 1.4–3.3 s (19.2 s once, downloading a new build: 4 MB of script, 1.2 MB compressed) |
| Building the world (`new Game()`) | 13.9 s | 7.5–18.6 s |
| Preparing shaders | 8.5 s | 3.9–8.3 s |
| First frames | 4.6 s | 1.4–3.1 s |
| **To playable** | **30.7 s** | **16.3–29.8 s** |

Inside the world build (inclusive time):

| Time | Item | When a player sees it |
|---|---|---|
| 3.0 s | Building people (`createHuman`/`buildPerson`) | Street people, at start |
| 2.3 s | Building rooms (`InteriorManager`) | Only when someone goes in |
| 1.8 s | Building the people inside rooms (`InteriorNPCMesh`) | Only when someone goes in |
| 3.4 s | The expressway (`Expressway`, `buildChunk` 1.6 s) | 400 m to 6.6 km from the start |
| 1.3 s | The crowd (`CityPopulation`) | At start |
| 0.8 s | Roads | At start |
| 0.8 s | Landmarks | At start |
| 0.7 s | Footbridges | At start |
| 1.0 s | Shop signboards (drawn text) | At start |

Shader preparation: 56 programs. Most of the time sits in creating each program's uniforms (`WebGLUniforms`, 6.0 s), where the browser waits for each compile to finish.

**Root cause.** Everything is built, and every shader compiled, before the first frame, on the one main thread. That includes a great deal the player cannot see from where they start: rooms, the people inside them, the expressway kilometres away, and the other cities' things.

Two more items, to verify on the phone:
- **Sound:** the test browser spent 3.3 s on sound at start (`ensureContext`, `playToastSound`). On a phone these should not run before the first tap. Measured, not assumed.
- **The first visit to another city** builds both other cities at once (`CityManager.switchCity`).

**Fix:**
1. **Build only what the start can see.**
   - Rooms and the people inside them are built on first entry, behind the door's fade (the room warm-up already exists).
   - The expressway is built in chunks as the player approaches (it is already chunked).
   - Signboards are drawn when first near.
   - **Nothing is removed; it is built later.**
2. **People and crowds are built over several frames** after the city is shown, nearest first, instead of all before the first frame.
3. **Shaders:** show the game once the programs for what is on screen are ready. The rest are prepared in small batches in idle time (see section 2), not in one 8 s block.
4. **A city is built when first visited, not when any other city is.** Going to Abuja no longer builds Port Harcourt (this is also section 6).
5. **Sound:** confirm nothing is created before the first tap. If the phone shows a cost, defer it.

**What the player sees:** the game is playable much sooner. The splash no longer holds for half a minute on the A16.

**Tests and acceptance:**
- **New `perfbudget` suite** (A16 emulation; also run at desktop size). It records the load stages and fails on a 10% rise. Targets, laptop at A16 speed:

  | Measure | Now | Target |
  |---|---|---|
  | To playable | 30.7 s | ≤ 15 s |
  | World build | 13.9 s | ≤ 6 s |
  | Shaders before showing | 8.5 s | ≤ 3 s |

- **A16 target:** playable in ≤ 12 s on a normal (not first-download) load, from the readout's start-up line.
- **Regression:**
  - every room still opens with its people (`interiors`, `insides`, `rooms`)
  - the expressway places are reachable by ride and on foot (`expressway`, `ridesave`)
  - signboards appear

**Dependencies and risks:**
- **Pop-in:** a room or chunk built late could appear visibly. Mitigations:
  - Rooms are built behind the door fade.
  - Chunks are built a block or two ahead.
  - Screenshot checks.
- **Rooms' first entry gets longer.** It is measured and must stay within section 2's limit.
- Depends on section 2 for the shader batching.

---

## 2. Freezes and frame rate

### 2a. First-time freezes

**Evidence** (laptop at A16 speed): worst frame on first use, against the second time.

| First use | Worst frame | Second time | Shader programs |
|---|---|---|---|
| Opening the map | **10,348 ms** | 267 ms | 56 → 88 |
| A room (Mama Put) | 3,116 ms | 216 ms | 9 more |
| A ride | 4,533 ms | n/a | 12 more |
| A flight | about 2 s | n/a | n/a |

The A16 recorded one frame of 10,217 ms. A 4,116 ms frame on a quiet street is still unexplained.

**Root cause:**
- **Map:** it is hidden at start, so start-up never prepared its shaders. Opening it can also rebuild it (`WorldMap.activate` → `loadCity`).
- **Rides and flights:** their scenes are never warmed.
- **Rooms:** they are warmed, but only on entry.

**Fix:**
- **One shader queue, prepared in idle time.**
  - After the game is shown, the remaining programs (map, rides, flight, rooms, other kinds of car and person) are compiled a few at a time, between frames. The browser's parallel compile is used and only checked when finished.
  - Any program still missing when first needed is compiled behind a short fade.
- **The map is built once at start, hidden** (or in idle time), not on opening.
- **A long-frame log in the readout:** any frame over 500 ms is recorded with what ran in it. This settles the 4.1 s frame.

**What the player sees:** no multi-second freeze the first time they open the map, go into a room, take a ride or fly.

**Tests and acceptance:**
- New `firsts` checks in `perfbudget`: first map, first room, first ride, first flight and first drive, in each city.
  - Worst frame **≤ 1,000 ms** on the laptop at A16 speed (from 10,348).
  - No new shader program compiled on first use.
- **A16:** no frame over 2 s in a normal session. The long-frame log shows it.

**Risks:**
- Compiling in idle time competes with play on a slow phone. It is limited to a few milliseconds a frame and pauses while driving.

### 2b. Steady frame rate

**Evidence:**
- **A16:**

  | City | fps | p95 |
  |---|---|---|
  | Lagos on foot | 8.6 | 233 ms |
  | Abuja | 19 | n/a |
  | Port Harcourt | 20 | n/a |

- **Laptop at A16 speed:** each second, drawing takes 600–700 ms and game logic 250–370 ms, so the frame rate is limited by the processor. Lowering quality cut draw calls from 745 to about 165–600 and did not raise fps.
- **Profile:**

  | Share | What |
  |---|---|
  | 12.1% | walking the scene to place still objects (`StillMatrices`) |
  | 7.1% | deciding what to draw (`projectObject`) |
  | 6.8% | frustum tests |
  | 3.1% | traffic |
  | 2.6% | smoke |
  | 2.0% | garbage collection |

- The scene holds 12,459 objects (9,461 meshes), of which about 2,900 are visible.
- **Short-lived memory:** 25 MB/s.

  | Share | Source |
  |---|---|
  | 47% | traffic update |
  | 17% | three.js re-choosing shader programs at draw time |
  | 14% | uniform uploads |

**Root cause:** too much is looked at every frame.
- Still parts of the city are walked over even though they never move.
- Far districts, kilometres away, are still frustum-tested object by object.
- Traffic and some materials make new short-lived objects every frame.
- So the phone's processor spends its frame deciding rather than drawing.

**Fix**, smallest and safest first. Each change keeps what is in the world:
1. **Still groups are skipped as a whole.** Whole groups that never move (buildings, roads, furniture) are marked once, so the per-frame walk skips them. The current patch still visits every object.
2. **Far groups switched off by distance.** Lagos's districts, and the expressway's chunks, beyond the draw distance are hidden as whole groups. The renderer then skips them without testing each object.
3. **Traffic allocates nothing per frame:** reused objects, no new numbers stored on cars.
4. **Find and fix the material that makes three.js re-choose its program at every draw** (probably one material shared by instanced and plain meshes).
5. **Smoke particles** updated at a lower rate on the low tier.
6. **A low-end tier chosen by measurement,** not only by screen type: slow first frames lead to cheaper shadows, a shorter draw distance and the pixel ratio capped. The A16 runs at device pixel ratio 3.375, and Balanced draws it at 1.5. Whether the A16's graphics chip is also a limit is **unverified**; the tier decides from real frame times.

**What the player sees:** smoother walking and driving, with fewer stutters. Lagos is the main target.

**Tests and acceptance:**
- **`perfbudget`** (laptop at A16 speed, Broad Street, Abuja and Port Harcourt):

  | Measure | Now | Target |
  |---|---|---|
  | Main-thread busy time | 850–1,000 ms of each second | ≤ 500 ms |
  | Objects the renderer tests per frame | about 12,500 | ≤ 4,000 |
  | Allocation | 25 MB/s | ≤ 5 MB/s |
  | Crowd step | | under 1 ms |
  | Traffic step | | ≤ 0.8 ms |

- **A16 targets** (provisional, confirmed against the baseline in the closing A16 session):

  | City | fps | p95 |
  |---|---|---|
  | Lagos on foot | ≥ 20 (from 8.6) | ≤ 80 ms |
  | Abuja and Port Harcourt | ≥ 30 | n/a |
  | Driving | ≥ 20 | n/a |

- **Nothing disappears:** rendered-frame and visibility checks (`check what is drawn`), plus screenshots of each city before and after for side-by-side review.

**Risks:**
- **Still groups:** marking something still that does move (doors, lifts, vehicles, people, signs). Only verified-still groups are marked. Moving things keep their per-frame update, and the suites for doors, lifts, vehicles and crowds run after each step.
- **Distance switching:** could hide a landmark meant to be seen from afar. Distance is per group, with screenshot review.

---

## 3. Screen layout, cards and controls

**Evidence:**

| Problem | Source |
|---|---|
| **U1.** The Stage 0 performance readout sits over the player at the left, 42% down. My Stage 0 defect. | A16 screenshot, laptop screenshot |
| **U2.** The RUN button and joystick cover a place's main button ("Enter…", "Interact wit…") | Both screenshots |
| **U3.** The ride card overflows 320 px; the camera view picker and the "⌄" button cover it | Laptop screenshot |
| **U4.** The "⌄" button covers the quest chip; the top third is crowded | Laptop screenshot |
| **New:** in several phone apps at 316–360 px, the phone's bottom bar ("‹", Home, "✕") sits below the bottom of the screen, so it cannot be tapped | `phonefit` suite, on both the build before L1/L2 and after it (e.g. app-buses bottom 848 of 704 px; app-contacts 909 of 704) |

**Root cause:**
- **U1:** the readout is placed by a fixed percentage, not in a reserved spot.
- **U2:** the place's action button and the joystick/RUN are positioned independently, with no shared safe zone.
- **U3:** the ride card has fixed widths built for a wider screen, and the view picker is placed over it.
- **New:** the phone app's height does not account for its own bottom bar on short screens. `luxe.css` rules override the phone layout rules (a known issue from 7 Nov).

**Fix:**
- **One layout of reserved zones for phone screens:** top bar, a left column for the joystick and RUN, a bottom action row above the nav bar, and the right-hand round buttons. Cards and toasts are placed into zones, not by fixed offsets.
- The readout becomes a small collapsible strip at the top right.
- The ride card and its view picker stack vertically under 360 px.
- The phone apps' content area is sized to leave its bottom bar on screen.
- **Desktop is unchanged:** the zones apply only below a phone width.

**What the player sees:** nothing covers the character, the buttons or the phone's own controls on the A16's screen.

**Tests and acceptance:**
- **`phonefit` passes at 316, 320, 360, 390 and 412 px**, on every screen it visits (street, place card, ride, map, phone apps, rooms, home, sleep). For every button, the element at its centre is itself, and it lies inside the screen.
- **New checks:**
  - the readout does not cover the middle third
  - the place button and RUN do not overlap
  - the ride card and its buttons lie inside the screen
- **Desktop:** the `ui`/`touch` suites at 1366×768 are unchanged.
- Screenshots of each screen at 320×607 for review.

**Risks:** `luxe.css` and the HUD styles overlap. Changes are made in one place, with the phone widths tested together.

---

## 4. Cameras: first person, third person and side views

**Evidence:**
- **C1. Narrow view when the phone is held upright.**
  - The street camera's 55° lens is vertical, so at 320×607 the view is about **31° wide**, against about 89° on a laptop screen.
  - The interior lens is 40°, narrower still.
- **C2. The camera's wall check is set once, to Lagos's buildings** (`Game.ts:402`). In Abuja and Port Harcourt it goes through walls. It never sees cars: the place-card screenshot shows the camera inside a parked car.
- **C3. No first-person view on the street.** Choosing "eye" there falls back to the close view. It exists only indoors.
- **Ride views (chase, side, inside):** the A16 user called these poor. My earlier screenshots were spoiled by the open map, so they are **unverified**. They will be captured cleanly as the first step.

**Fix:**
- **Lens by screen shape:**
  - The view's *width* is kept at about 60° or more on a portrait screen, by widening the lens moderately and pulling the camera back and up.
  - Each view is tuned on screenshots at 320×607 and at desktop size, so desktop stays as it is.
- **The wall check follows the city:** it is set on every city change to that city's buildings, plus nearby parked and moving cars.
- **Street first person:**
  - "eye" on the street becomes a real first-person view at head height, with the body hidden and the same controls.
  - Added to the camera cycle as it is indoors.
- **Ride side and inside views:** framed for a portrait screen, so the vehicle and the road are both in view.

**What the player sees:**
- A wider view on an upright phone.
- The camera no longer passes into buildings in Abuja and Port Harcourt, or into cars.
- A first-person view on the street.
- Ride views that frame the ride.

**Tests and acceptance:**
- **Horizontal view:** ≥ 55° on the street at 320×607. Desktop's is unchanged within 5°.
- **Walking along buildings in each city,** with the camera turned toward them, the camera's position is never inside a building's box or a car's box (a new `camera` suite).
- **Screenshots of every view in each city** at 320×607 and 1366×768: street (close, standard, high), first person, room (room view and eye), driving (chase, bonnet) and ride (chase, side, inside). Reviewed side by side with the current ones.
- **Regression:** the `view`, `insideview` and `drivetouch` suites.

**Risks:** camera feel is a matter of taste. The screenshots are for your review before the final values are fixed.

---

## 5. The same performance in all three cities

**Evidence:**
- **Port Harcourt** draws 421,000 triangles, against Abuja's 182,000 and Lagos's 169,000. That is laptop audit P3, and the A16 confirmed 421,196.
- The **A16 frame rate differs widely:** Lagos 8.6 fps; Abuja and Port Harcourt 19–20.
- **Every city stays in memory once built** (section 6).

**Root cause:**
- **Port Harcourt:** the meshes making up the triangles have not been identified yet. That is the first step.
- **Lagos's low frame rate:** the scene-walk cost of section 2b, since Lagos has the most objects.

**Fix:**
- **Find Port Harcourt's heaviest meshes** (triangles by group). Give the heaviest distance-based detail or simpler shapes; the look up close is unchanged.
- **The section 2b changes apply to all three cities,** and are measured in each.

**What the player sees:** each city runs at a similar, steady speed.

**Tests and acceptance:**
- `perfbudget` runs the same checks in Lagos, Abuja and Port Harcourt, plus the trip between them (`crosscity`).
- **Port Harcourt** ≤ 250,000 triangles on arrival (laptop).
- **The A16 gap** between the slowest and fastest city narrows to within 1.5× (from 2.3×), confirmed in the closing A16 session.

---

## 6. Foundations for 36 states (within M1's scope only)

**Evidence:**
- The first change of city builds both other cities (`initAbuja()` and `initPortHarcourt()`), and **no city is ever freed**. Model data: 146 MB for Lagos alone, 220 MB once all three are built.
- City changes are written city by city: `CityManager.switchCity` has a branch per city for fog, sky, light and spawn.

**Root cause:** the city system was written for exactly three cities, all kept in memory.

**Fix (only what M1 needs; no rewrite):**
1. **Build a city when it is first visited** (roadmap 4a). Going to Abuja builds Abuja only.
2. **A city description for the city manager:** each city's fog, sky, light, spawn and builder in one record that `switchCity` reads, instead of one branch per city. A fourth city then adds a record, not code in the manager. The other 47 files that name cities are left to later milestones.
3. **Free a city on leaving** (roadmap 4c) is **not** in M1 unless the closing A16 session shows memory pressure (a tab reload). It is the riskiest change, and the measurements will decide.

**What the player sees:** less memory used on the phone, so Chrome is less likely to drop the tab (the original cause of the ride problem). Visiting one city no longer loads another.

**Tests and acceptance:**
- After going Lagos → Abuja, only Lagos and Abuja are built (`perfbudget`), and model data is below 220 MB.
- **The trip suites pass:** `crosscity`, `ridesave`, `coaches`, `flights`, and `livingcity`'s resume-after-city-change.
- Each city's fog, sky and light are unchanged in screenshots.

**Risks:** systems that assume all cities exist (rooms behind doors, Living City, routes). The trip suites run after each step.

---

## Order of work, dependencies and the closing check

Each package is committed separately. Each ends with its tests passing, before and after numbers, and the player-visible result.

| # | Package | Player-visible result | Depends on |
|---|---|---|---|
| 1 | `perfbudget` suite and readout additions: long-frame log, live-heap note, the spot in each mark, last places tapped | (the measuring stick) | — |
| 2 | Shader queue in idle time; the map built ahead (2a) | No 10 s freeze on the map, rooms, rides or flights | 1 |
| 3 | Build only what the start can see; people over several frames; a city built when visited (1, 6.1) | Much faster start-up | 1, 2 |
| 4 | Still groups, far-group switching, traffic allocations, program re-check, smoke (2b) | Smoother play | 1 |
| 5 | Port Harcourt's heavy meshes; city description record (5, 6.2) | Steady speed in every city | 3, 4 |
| 6 | Screen zones at 320 px; readout strip; ride card; phone app bar (3) | Nothing covers the player or the controls | — (can run alongside 2–5) |
| 7 | Cameras (4) | Wider view; no camera in walls or cars; street first person | 6 (the zones) |
| 8 | **Closing A16 check** | M1 confirmed on the phone | all |

**The closing A16 check** is one short session, not a test procedure.
- **What:** open the game, play normally for about 10 minutes in each city (walk, a ride, drive, open the map, go into a room), then tap **Report**.
- **Why the phone is needed:** frame rate and memory on the A16's own processor and graphics chip cannot be reproduced on the laptop. The laptop's 4× slowdown matches its processor only roughly, and not its graphics chip at all.
- **The report already records** frame times, freezes over 500 ms (package 1), reloads and start-up. Nothing needs to be noted by hand.

**Desktop compatibility:** every suite also runs at 1366×768. Desktop screenshots are compared, and the layout zones apply only to phone widths.

**What M1 does not include:**
- new features
- M2 (doors and rooms)
- M3 (jobs)
- changes to gameplay
- the full city-as-data rewrite
- freeing cities on leaving, unless the A16 check calls for it

**Overall risks:**
- **Visual change:** controlled by screenshot review at each step.
- **Rooms first entered:** deferred building must not add a pause. Section 2's limit applies.
- **Shared laptop:** test timings vary when the laptop is busy, so suites count work (objects, programs, allocations) as well as time.
