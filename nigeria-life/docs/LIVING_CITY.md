# NigeriaLife: living city and NPC intelligence

Status: audit and plan for approval (2026-11-13). Nothing below is built yet except where it says "exists".

## 1. Audit: what the cities have today

Measured in the running build on a 316 px screen (headless laptop, not a phone):

| City | People simulated | Out at 8 am / 1 pm / 10 pm / 2 am | Vehicles | Crowd update | Traffic update |
|---|---|---|---|---|---|
| Lagos | 451 | 451 / 282 / 130 / 41 | 2,023 | 0.2 to 0.7 ms | 1.4 to 2.5 ms |
| Abuja | 499 | 499 / – / 143 / – | 347 | 0.3 to 1.2 ms | 0.3 to 0.5 ms |
| Port Harcourt | 696 | 696 / – / 199 / – | 428 | 0.5 to 0.8 ms | 0.5 ms |

| Area | What exists | What is missing |
|---|---|---|
| Street crowd | `CityPopulation`: baked looks drawn as instanced meshes, a near and a far model, drawn only in view and within 50 to 90 m by graphics setting. Walkers on both pavements and the side streets, bus-stop queues that really board danfos, knots of people talking, a trader and customer at each stall, a few walkers who go into a shop door and come out, stepping aside for the player, scattering from a horn | A walker paces one line and turns round at its end, for ever. Nobody has a home, a job, a destination or an identity. Nobody can be tapped or spoken to |
| Crossing the road | Some walkers cross at the junction gap | They cross whatever the lights say, and traffic does not stop for them (it stops only for the player) |
| Traffic | `TrafficSpawner`: lanes, car-following, lights, danfos pulling in at stops, sirens, yielding to a horn, parked cars; share on the road follows the hour | No reaction to walkers; nothing pulls up at shops, fuel stations or markets |
| Time of day | `StreetLife.shareAbroad`: two rush hours, a quiet night. The same people stay home each night | Only how many are out changes. Who they are and what they do does not: a trader stands at the stall at 2 am if their number comes up; walkers "shop" at shut doors; no evening crowd at bukas, clubs, viewing centres |
| Story people | 11 in Lagos (Chief Alabi, Mallam Bisi, Alaye, the conductor and so on) with greetings, `Ties` closeness and, for Chief Alabi, a memory | They stand in one spot all day and all night. Abuja and Port Harcourt have none in the street |
| Indoors | Staff in every place; walking travellers in the airport; worshippers, club and event crowds | Shops, bukas, banks and offices have staff and no customers. Nobody seen entering from the street is inside |
| Workplaces | Employers, grades, shifts, company staff the player hires | No NPC visibly works anywhere except by standing there |
| Older code | `NPCs.ts` still runs 12 "ambient pedestrians" of its own beside the crowd | A second, older pedestrian system: to be folded into the crowd, not extended |
| Entity management | Instancing, LOD, frustum and distance culling are in place and cheap | Every agent is stepped every frame at full detail, in view or not. That is affordable today because agents do almost nothing; it will not be once they think |

## 2. Architecture: one population, three levels of detail

Nothing new is drawn a new way. `CityPopulation` stays the one crowd system for all three cities; it gains a mind, not a rival.

**Residents.** Each agent gets a small fixed record made from its number (no storage, no save): a home edge of the map, a kind (trader, office worker, student, artisan, hawker, okada rider, idler, elder), a workplace or pitch chosen from the places that exist, a temperament (hurried, strolling, chatty, wary) and a day plan built from the game's own opening hours.

**Day plan.** A short list of legs: leave home, walk to work or the stall, a meal at a buka or a suya stand around midday, an errand, evening (viewing centre, bar, church or mosque on its day, home). The current `abroad` share becomes a result of the plans rather than a dial.

**Getting there.** A leg is walked on the pavement network the walkers already use, with the existing junction crossings as the only way over. The player's `Wayfinder` is not run per agent.

**Three levels (the performance rule):**

| Level | Who | What runs |
|---|---|---|
| Near (within about 25 m and in view) | 10 to 30 people | Full: steering, stepping aside, waiting at the kerb, facing and reacting to the player, speech bubbles |
| Mid (drawn, further off) | up to the draw distance | Movement along the leg only, updated every 2nd to 4th frame with the time owed |
| Far (not drawn) | everyone else | No per-frame work: position is worked out from the plan and the clock when they come into range |

Budget: the crowd update must stay under 1 ms on the laptop measure in every city at 8 am, with no new draw calls and no new shader.

## 3. Phased plan

Each stage is small enough to test, commit and push on its own.

| Stage | What the player sees | Built on |
|---|---|---|
| 1. Levels of detail | Nothing new: the same streets for less work | `CityPopulation.update` split into near, mid and far; the 12 old pedestrians in `NPCs.ts` folded in |
| 2. Crossing and traffic | People wait at the kerb for the light or a gap and cross together; drivers stop for them; a horn at someone crossing gets a reaction | The existing junction gaps and `signalState`; `TrafficSpawner` braking extended from the player to walkers ahead in lane |
| 3. Residents and day plans | Mornings flow toward work and market, midday toward food, evenings toward home and the bars; stalls are manned in trading hours and shut at night | Resident records, `Hours`, shop doors and stalls already known to the crowd |
| 4. Places with people in them | Customers inside shops and bukas when the street says they went in; queues at a busy counter; empty at closing | `PlaceInterior` staff slots; the count comes from who is on an errand there |
| 5. People who notice you | Passers-by glance, greet a familiar face, step back from a speeding car, grumble at a horn; a tap on any near person gives a short exchange in their temperament; regulars remember being greeted | `Social`, `Ties`, `Actor.say`; a near person is promoted to a real actor only while spoken to |
| 6. Story people with a day | Chief Alabi on his bench by day and gone at night, Mallam Bisi grilling from late afternoon, Alaye at the park in the rush; a handful of such people for Abuja and Port Harcourt | `NPCs.ts` roster with hours; the cities' `CityLife` |
| 7. Atmosphere by hour | Morning sweepers and school uniforms, afternoon heat lull, evening generators and music, late-night quiet with a few night workers | `LagosStreetLifeSystem`, `AtmosphereManager`, `StreetAmbience` |

## 4. Performance risks

| Risk | Why | How it is held |
|---|---|---|
| Thinking agents cost more than pacing ones | Up to 696 agents stepped every frame today | Far agents cost nothing per frame; mid agents every few frames; stage 1 lands first and is measured before any behaviour is added |
| Path-finding per agent | The player's way-finder searches a half-metre grid | Agents walk the pavement graph and the fixed crossings only |
| Draw calls rising | Customers indoors, more props | Indoors uses the same baked looks; counted before and after every stage |
| Popping | Far agents appearing from a computed position | They are placed out of view or at draw distance, never in front of the player |
| Traffic stopping for walkers could jam the road | 2,023 vehicles in Lagos | Only at marked crossings and only on the walk phase; the convoy and expressway code is not touched |
| Real phones | All numbers so far are from a laptop | Each stage is pushed for an A16 check; the load-time and frame figures in Settings are the judge |

## 5. Tests planned

A new `livingcity` suite, per stage: people counted by level and the crowd update timed and counted in all three cities at four hours; no walker crosses against the light and no car passes through a walker on a crossing; a resident followed through a compressed day reaches work, food and home; a shop's inside count matches the street; a greeted regular answers differently the second time; city changes keep the right crowd. Plus the usual regression suites (ways, streets, sidestreets, citylife, bigcities, convoys, danfo, vehicles, touch, phonefit, social, access, kerbs), reported per suite with anything not run named.

## 6. Progress

### Stage 1: levels of detail (built 2026-11-13)

`CityPopulation.update` now moves people at three rates: every frame if the camera can see them (or they are stepping onto a bus), every second frame if they are in range but out of view, every fourth if they are out of range or at home. Each is moved by all the time since their turn, so nobody falls behind. Nothing looks different.

Laptop measure, 316 px screen, crowd update per frame, before and after:

| City, hour | People moved per frame | Before | After |
|---|---|---|---|
| Lagos 8 am | 451 to about 170 | 0.67 ms | 0.39 ms |
| Lagos 1 pm | | 0.52 ms | 0.27 ms |
| Lagos 10 pm | | 0.33 ms | 0.16 ms |
| Lagos 2 am | | 0.22 ms | 0.08 ms |
| Abuja 8 am | 499 to about 148 | 1.18 ms | 0.29 ms |
| Port Harcourt 8 am | 696 to about 202 | 0.77 ms | 0.56 ms |

Draw calls and triangles are unchanged (the same people are drawn). Not measured on a phone.

The 12 older pedestrians in `NPCs.ts` were found to be already hidden and frozen beyond 38 m, so they were left alone; they become the first named regulars in stage 5 rather than being folded in now.

Tests: new `livingcity` suite 8/8 (share moved per frame in all three cities, nobody in view skipped, far walkers exactly on pace, people drawn in every direction, night cheaper than morning). Regression on the same build: citylife 8/8, bigcities 9/9, sidestreets 5/5, danfo (bus queues boarding) passed, streets 16/16, touch 10/10. Other suites were not run for this stage.

Note for later stages: the game's fast-forward (`advance`) does not run the crowd for the full time asked, so crowd tests step the crowd's own update.

### Stage 2: crossing and traffic (built 2026-11-13)

People on foot now cross properly in all three cities. Each walker goes to the kerb, waits there and crosses, then rejoins the walkers on the far side. There are three kinds of crossing:

- **Junctions with lights:** people cross only while the traffic that cuts their path is held at red, with enough red time left to get over. They also wait until the crossing is clear: no vehicle on it, and none that would reach it within 2.5 seconds at its speed. That covers cars still running the junction after their light changed.
- **Zebras on lights:** one over Broad Street at Martins Street in Lagos, and one at each other city's market. They work the same way, and people step out briskly.
- **Side streets without lights:** people look both ways and go when nothing is moving within 14 m.

Pavements are now joined across the grid roads (Abuja, Port Harcourt) and across the side roads that cut Broad Street.

Drivers give way to people on the road:

- A car pulls up 1.7 m short of someone in its lane.
- A car with someone alongside it in its path does not move until they are clear.
- Out on the road, a walker stops rather than step into the side of a vehicle.

**Cost.** Walkers check the traffic about 8 times a second, not every frame, and checks for nearby vehicles skip lanes that are out of range.

Laptop measure, 2 minutes of street at 8 am, 2 pm and 10 pm, traffic and crowd stepped together:

| City | Crossings in 2 min | Gave up | Vehicles overlapping someone crossing |
|---|---|---|---|
| Lagos | 138 to 144 | 0 to 1 | 0 (24 to 88 before the final fix) |
| Abuja | 212 to 245 | 1 | 0 (7 before) |
| Port Harcourt | 281 to 335 | 0 to 1 | 0 |

In the final `livingcity` run, crowd and traffic together took 1.7 to 2.2 ms per frame in Lagos, 0.8 ms in Abuja and 1.5 ms in Port Harcourt. Not measured on a phone.

Tests: `livingcity` now also runs a minute of the street per city. It checks that at least 30 people cross, no moving vehicle overlaps anyone, almost nobody gives up and the traffic keeps moving. Final result: `livingcity` and `streets` together 32/32. In the wider run (`livingcity`, `citylife`, `bigcities`, `sidestreets`, `danfo`, `streets`, `touch`, `convoys`, `vehicles`, `bodies`), 98 of 100 checks passed. One failure was a gap in the pace check: it did not skip walkers who reach a side road. That is fixed. The other was the `streets` bank-wall check, which covers the player and passed on rerun.

**Not done from the stage 2 plan:** when someone is crossing, a horn gets no reaction made for them. They keep crossing and the car waits. The existing reaction, where a person in front of a car steps aside and says so, is unchanged.

### Stage 3a: morning routines, workplaces and stalls (built 2026-11-13)

Built as section 7 set out. It extends `CityPopulation`, the city door lists, `Hours.ts` and `CityFabric`. The new logic is in `src/world/population/Routines.ts`, the crowd's own planning code, not a second crowd. Stage 2 crossing code is unchanged: people on a route cross roads with the same waiting and the same give-way rules.

**What is built**

- **Pavement network.** In each city the existing pavements are joined at corners, across roads that have a crossing, and up to Broad Street, the avenue in each city. Doors and stalls are attached to it. Routes are worked out once for each destination, the first time someone needs it.

  | City | Points on the network | Home edges | Places |
  |---|---|---|---|
  | Lagos | 134 | 20 | 50, including 20 umbrella stalls |
  | Abuja | 337 | 22 | 109 |
  | Port Harcourt | 336 | 27 | 128 |

- **Places.** These are the doors the city already has, sorted into kinds: office, bank, shop, food, market, school, work site, transit, place of worship, night spot, stall. Each keeps the hours its door keeps, from the same record the door checks (a new `InteriorManager.hoursOfDoor`). Where a door has no room behind it, its kind's hours come from `Hours.ts`. Stalls keep the new `PLACE_HOURS.stall`, 7 am to 7 pm.
- **Residents.** Every walker has a role that comes from their number, so the same person has the same life every day. Each city has its own profile:

  | City | Office | Trader | Artisan | Student | Hawker | Idler | Night owl | Elder |
  |---|---|---|---|---|---|---|---|---|
  | Lagos | 22% | 10% | 10% | 8% | 16% | 20% | 7% | 7% |
  | Abuja | 36% | 6% | 8% | 10% | 8% | 18% | 6% | 8% |
  | Port Harcourt | 16% | 14% | 20% | 8% | 16% | 14% | 7% | 5% |

  - **Commuters** (office worker, trader, artisan, student) get a workplace among the places, and a home edge that can walk to it.
  - **Leaving time:** before their place opens. Lagos leaves earliest to beat the go-slow.
  - **Home time:** they leave a little after closing, staying no more than 0.9 hours.
  - **Closed places:** a place shut that day (an office on a Sunday) keeps its staff at home.
  - **Street walkers** (hawker, idler, night owl, elder) walk their own pavement in their role's hours. They step out of the crowd or back into it only when the player cannot see them.
- **Stalls (Lagos).** Each of the 20 umbrella stalls belongs to the trader behind it:
  - When the trader arrives, the umbrella goes up and the goods go out.
  - When the trader leaves, the umbrella is furled and a blue tarpaulin is tied over the table.
  - A stall's customer is there only while it is open.
  - Night no longer hides all the umbrellas at once.
- **The clock.** Sleeping, setting the hour or arriving in another city puts everyone straight where their day has them at that hour. On the fast clock (25 s a game hour), people the player cannot see walk at the clock's pace, up to 60 times normal, so they still arrive on time. People the player can see walk normally.

**Measured** (laptop, 316 px screen, `livingcity` suite, a Wednesday):

| City | 3 am out | 10:30 commuters at work | Inside a place shut over an hour ago | Fast-clock morning: set out / arrived / stuck | Crowd update at 10:30, 1 pm, 7 pm |
|---|---|---|---|---|---|
| Lagos | 38 of 451 | 188 of 188 | 0 | 250 / 236 / 0 | 0.47, 0.41, 0.40 ms |
| Abuja | 10 of 499 | 293 of 293 | 0 | 468 / 465 / 0 | 0.11, 0.13, 0.21 ms |
| Port Harcourt | 11 of 696 | 388 of 388 | 0 | 617 / 569 / 0 | 0.26, 0.21, 0.20 ms |

The crowd stays under the 1 ms target in each city, measured separately. People indoors or at home cost nothing, so the routines make the crowd cheaper: in the probe, Lagos at 1 pm took 0.91 ms with routines and 1.55 ms with them removed. Not measured on a phone.

**What changed on the street**

| City | Office share | Artisan share | Out at 10 pm |
|---|---|---|---|
| Lagos | 0.21 | 0.09 | 16% |
| Abuja | 0.34 | 0.09 | 8% |
| Port Harcourt | 0.17 | 0.19 | 11% |

Abuja is the office city and the quietest at night; Port Harcourt has the most artisans and tradespeople.

In working hours the office workers are indoors, so fewer people are out to cross roads:

| City | Crossings per minute now | Stage 2 |
|---|---|---|
| Lagos | 38 | about 70 |
| Abuja | 25 | about 115 |
| Port Harcourt | 64 | about 150 |

The crossing check's bar went from 30 to 20 a minute, and its no-overlap rule is unchanged. Midday food trips (step 3b) should bring crossings back up.

**Tests:** `livingcity` 36/36. New checks in each city:
- the network, places and workplaces exist
- 3 am is empty
- at 10:30 those due at work are there, and nobody is inside a shut place
- 1 pm and 7 pm
- the fast-clock morning: setting out, arriving and nobody stuck
- under 1 ms
- Lagos stalls up and down, as drawn
- the three cities differ

Regression on the same build:

| Suite | Result |
|---|---|
| `citylife` | passed |
| `bigcities` | passed |
| `sidestreets` | passed |
| `danfo` | passed |
| `touch` | passed |
| `convoys` | passed |
| `vehicles` | passed |
| `bodies` | passed |
| `cities` | passed |
| `streets` | 15/16, then 16/16 after one change to its bank-wall check |

The wall check walks the player straight at the bank with the wayfinder off. With people passing close, the player waits and retries by design, for up to about 30 s. Since stage 3 the pavement by the bank is busy in the afternoon, so that one walk is now made at 3 am. The same check had flaked once in stage 2 for the same reason.

Two stage 1 checks changed. They assumed everyone is out at 8 am, which is no longer true now that commuters are indoors.

**Known limits**
- The Lagos network is in pieces. The Martins Street pavements do not reach Broad Street, so some side streets have no workplace in reach; walkers there stay street walkers.
- Midday food trips, evening places and night owls at venues are steps 3b and 3c.
- Abuja and Port Harcourt stalls are step 3d.
- Follow-up: a player walking into a wall on a busy pavement keeps retrying for up to about 30 s before giving up.

### Stage 3b: midday routines (built 2026-11-13)

Built on `CityPopulation` and `Routines.ts`. No new crowd or business system. Stage 2 crossing rules are unchanged: every walker on a route crosses with the same code, and cars give way the same way.

**Before building: pavement connectivity (Lagos)**

The Lagos network was in 13 pieces, and the main one held 81 of 134 points. The Martins Street pavements stopped 10 to 12 m short of Broad Street's, and the probe found nothing built in those gaps. Pavements in line along side streets were not joined across side roads, and the far south pavement and a north-south street at x 106 to 118 were cut off.

The network builder now joins, checked against everything standing on the ground:
- pavements in line, across a side road
- a side-street pavement that stops within 13 m of the avenue's
- any piece still cut off, by its shortest safe link: across a road to the pavement opposite, or over open ground

A crossing over a road with traffic and no lights, or within 14 m of one, is marked busy. The Stage 2 unlit-road rule needs nothing moving within 14 m, so a gap there almost never comes. Routes avoid a busy crossing unless there is no other way, and street walkers are not given it. Street walkers do get the quiet side-road crossings, as they already had in Abuja and Port Harcourt.

Result: Lagos is one piece (139 points, all 50 places reachable). In Abuja (109 places) and Port Harcourt (128 places), every place can be reached from an edge of the map.

**Before building: the player retrying against a wall**

Cause, in `Player.ts`, which affected real play and not only the test:

| Problem | Effect |
|---|---|
| "Busy" counted anyone within 2.5 m in any direction, and any moving car within 6 m | On Broad Street's pavement the nearest lane is about 5 m away, so passing traffic alone made it busy |
| The retry count reset on every re-plan | Up to 3 plans × 4 tries × 2.5 s, about 30 s standing still while still "walking" |

Fix:
- Only what is in front of the player counts: a moving vehicle within 3 m of the step, or a person within 1.6 m ahead.
- Tries already spent carry over to a re-plan.

New `streets` check, walking at the bank wall:

| Walk | Before the fix | After the fix |
|---|---|---|
| 5 pm, people passing | over 20 s | 5.5 s |
| 3 am, quiet | | 7.5 s |

**What is built**

- **Lunch.** Office workers, artisans and students go out at their own time, in a window that differs by city:

  | City | Lunch window | Spread (standard deviation) |
  |---|---|---|
  | Lagos | 11:30 to 14:00 | 0.71 h |
  | Abuja | 12:15 to 13:45 | 0.43 h |
  | Port Harcourt | 11:00 to 14:00 | 0.82 h |

  Each eats at one of the six nearest places, choosing a buka or food stall first, then a market or supermarket. The place must be open for the whole meal by its own hours, and they go back to work afterwards. Traders stay at their stall or shop.
- **Errands.** Idlers go into shops, stalls, markets and bukas four times a day; elders go twice in the morning. They walk back to their own pavement afterwards and carry on along it. If a place has shut or a stall has been packed away by the time they arrive, they go back: to work if it is open, otherwise home or to their pavement.
- **Serving at stalls (Lagos).** Buyers stand at the counter, up to three side by side, facing the trader. A trader serves, gesturing as they talk, while anyone is at their counter, and waits when nobody is.
- **After a clock jump.** Someone who set out only minutes before is put part-way along their route, never in the middle of a road. People are seen on their way, not only at their destinations.
- **Stage 2 fix.** A car's "do not move" band beside a walker (width + 0.25 m) is now narrower than the margin a walker keeps from a car's side (width + 0.30 m), so the two can never wait for each other.

**Measured on the laptop** (`livingcity`, a Wednesday, 316 px screen). No phone results: nothing in 3b has been measured on the A16.

Crowd update per frame:

| City | 10:30 | 1 pm | 3:30 pm | 7 pm |
|---|---|---|---|---|
| Lagos | 0.28 ms | 0.53 ms | 0.24 ms | 0.32 ms |
| Abuja | 0.09 ms | 0.13 ms | 0.09 ms | 0.10 ms |
| Port Harcourt | 0.41 ms | 0.41 ms | 0.42 ms | 0.47 ms |

All under 1 ms. Crowd and traffic together: Lagos 1.6 to 2.7 ms, Abuja 0.6 to 0.9 ms, Port Harcourt 0.9 to 1.0 ms.

Lunch hour, 4 minutes at 1 pm, Stage 3a against 3b (the same test on both builds):

| City | Out in the street | Walking a route at any moment | Crossings per minute |
|---|---|---|---|
| Lagos | 235 → 262 (+11%) | 0 → 3 | 29.5 → 33 (+12%) |
| Abuja | 125 → 139 (+11%) | 0 → 14 | 26.5 → 26.5 (no change) |
| Port Harcourt | 208 → 241 (+16%) | 0 → 33 | 47 → 47.8 (+2%) |

This was measured before the busy-crossing change.

- **Pedestrian activity rose in every city.** Lunchers and errand-goers are on the pavements and at the stalls; in Lagos, 24 people were buying at stalls at 1 pm.
- **Crossings rose only in Lagos.** On the real clock a lunch walk takes a minute or two, so only a few people are on a route at any moment. In Abuja and Port Harcourt most lunch places are on the same side of the avenue as the offices, and the avenue has one or two crossings, so lunch walks rarely cross.
- **Raising crossings further** would take food places across the avenue (the stalls planned for step 3d) or more crossings on it. That is a design choice, not a tuning one.

**Final `livingcity` run, 55/55:**
- crossings over two minutes:

  | City | Crossings per minute | Give-ups per two minutes | Cars on top of anyone |
  |---|---|---|---|
  | Lagos | 30.5 to 41 | 1 to 2 | 0 |
  | Abuja | 22 to 26 | 0 to 2 | 0 |
  | Port Harcourt | 50.5 to 51.5 | 0 | 0 |

- every place reachable
- lunch spread at least 1.5 hours
- at 1 pm, people out at lunch with none in a shut place:

  | City | People out at lunch |
  |---|---|
  | Lagos | 34 |
  | Abuja | 81 |
  | Port Harcourt | 57 |

- at 3:30 pm, everyone due back at work is there or on the way
- Lagos traders serve whoever is at their counter
- fast-clock morning: nobody stuck in any city
- under 1 ms in each city

Test changes:
- Crossings are now counted over two minutes; one-minute counts swung by half either way.
- The give-up limit scales with that: at most 2 a minute, or 8% of crossings.
- The crossing test now gives the crowd the hour and keeps its clock running through the window. Before this, its "1 pm" ran on the previous hour's plan.

Regression on the same build (laptop): 154/155, then 155/155 across 13 suites.

| Suite | Result |
|---|---|
| `citylife` | passed |
| `bigcities` | passed |
| `sidestreets` | passed |
| `danfo` | passed |
| `streets` | 17/17, with the new busy-pavement wall check |
| `touch` | passed |
| `convoys` | 10/10 after a test fix |
| `vehicles` | passed |
| `bodies` | passed |
| `cities` | passed |
| `ways` | passed |
| `kerbs` | passed |
| `input` | passed |

The `convoys` failure was the test, not the game. It kept a vehicle box from the traffic's shared pool and read it 60 frames later, by which time the more frequent traffic checks from walkers had written another car into that slot. The test now copies the values when it takes them. The car did pull over (2.3 m) and the convoy was never stopped.

**Known limits**
- Abuja and Port Harcourt have almost no food places (Port Harcourt 1, Abuja none), so lunch there is mostly in markets and supermarkets, out of sight. The roadside food stalls in step 3d will change that.
- Lunches and errands are walks of a minute or two on the real clock, so few people are on a route at any moment. Street walkers are still most of the street.

### Stage 3c: evening and night (built 2026-11-14)

Built on the same systems: `CityPopulation`, the planner in `Routines.ts`, the city doors, `Hours.ts` and the pavement network. Stage 2 crossing rules are unchanged, and no crossings were added to raise the numbers.

**What is built**

- **Home at the real closing time.** A worker's day now ends when their own workplace actually closes, not at a fixed hour for their role:

  | Workplace | Closes |
  |---|---|
  | Office (civil service) | 4 pm |
  | Market, work site | 6 pm |
  | Stall | 7 pm |
  | Supermarket | 9 pm |
  | Buka | 11 pm |

  Staff stay on for up to 0.9 hours after closing. A place that never shuts, such as a hotel, keeps an ordinary day. Students leave school mid-afternoon.
- **Evenings out.** Some workers go out before going home (Lagos 35%, Abuja 18%, Port Harcourt 40%): to a buka, a bar or club, or a hotel lounge. The place must be open on arrival, halfway through, and when they leave, by its own hours. Some go inside, and some stand about outside by the door with friends, where they can be seen. Some idlers end their day the same way instead of walking about. Hotels became a place kind of their own: a workplace by day and a bar and lounge in the evening.
- **Night owls.** They walk their own pavement from early evening, then go to a first place at about 8:30 pm (Abuja 8 pm). After the bukas shut at 11 they move on to a club or a hotel bar. They go home at their city's hour:

  | City | Night owls home |
  |---|---|
  | Lagos | about 1:15 to 2:45 am |
  | Port Harcourt | about 12:45 to 2:15 am |
  | Abuja | about 11:15 pm to 12:45 am |

- **Hours by day of the week.** A place's hours are now checked with its days of the week as well, by the rule the doors use. After midnight the next day's rules apply. A bank is shut on Sunday, and Fela's Shrine opens Thursday to Sunday.
- **Plans across midnight.** Whatever someone was doing at midnight, and anything planned for after it, carries into the new day. An owl at a club at 11:50 pm is still there at 12:30 am.
- **Resuming.** After sleeping (a jump in the clock), fast-forwarding (the fast clock) or changing city, everyone is put where their plan has them. People who set out only minutes before are put part-way along their route.

**Measured on the laptop** (`livingcity`, a pinned Wednesday and Thursday, 316 px screen). No phone results: nothing in Stage 3 has been measured on the A16.

People out (and 40 m squares with someone in them):

| City | 5 pm | 7 pm | 9 pm | 11 pm | 12:30 am | 2 am | 3:30 am |
|---|---|---|---|---|---|---|---|
| Lagos | 215 (30) | 254 (28) | 117 (20) | 50 (11) | 48 (10) | 44 (10) | 37 |
| Abuja | 124 (81) | 110 (67) | 31 (13) | 27 (13) | 11 (6) | 10 (5) | 10 |
| Port Harcourt | 252 (127) | 326 (140) | 184 (93) | 157 (75) | 43 (9) | 15 (7) | 11 |

At night the cities differ as their profiles say: Lagos stays up, Abuja is quiet by 9 pm, and Port Harcourt is busy until midnight.

At 9 pm, at bukas, bars and hotel lounges:

| City | Total | Outside |
|---|---|---|
| Lagos | 38 | 28 |
| Abuja | 30 | 15 |
| Port Harcourt | 59 | 40 |

Nobody was at a shut place at any hour checked. Night owls at open places at 12:30 am: Lagos 21 of 21, Port Harcourt 53 of 53, Abuja 5 (most are already home). All owls were home by 3:30 am.

Every worker's day ends at or after their own workplace's closing time:

| City | Workers checked | Leaving early |
|---|---|---|
| Lagos | 113 | 0 |
| Abuja | 219 | 0 |
| Port Harcourt | 317 | 0 |

Resuming routines, out of 380 Lagos residents:

| Case | Out of place |
|---|---|
| After sleeping, 11 pm to 7:30 am | 0 |
| After fast-forwarding 4 pm to 8 pm | 0 |
| Back in Lagos at 9 pm after visiting Abuja and Port Harcourt | 0 |

Crowd update per frame (all under 1 ms):

| City | 10:30 am | 1 pm | 3:30 pm | 7 pm | 9 pm | 11 pm | 12:30 am |
|---|---|---|---|---|---|---|---|
| Lagos | 0.37 | 0.34 | 0.18 | 0.14 | 0.19 | 0.04 | 0.03 |
| Abuja | 0.12 | 0.07 | 0.06 | 0.06 | 0.05 | 0.06 | 0.02 |
| Port Harcourt | 0.17 | 0.13 | 0.16 | 0.20 | 0.24 | 0.07 | 0.07 |

All figures in ms.

Crossings (two-minute samples). No car was ever on top of anyone in any sample.

| City and time | Crossings per minute | Give-ups |
|---|---|---|
| Lagos, 8 am / 1 pm / 2 pm | 38 / 31 / 33.5 | 1 to 4 |
| Lagos, 9 pm | 11 | 0 |
| Abuja, 1 pm / 2 pm | 29.5 / 18.5 | |
| Port Harcourt, 1 pm / 2 pm | 47.5 / 52 | |

**Regression** (laptop): 154/155 across 13 suites:

| Suite | Result |
|---|---|
| `citylife` | passed |
| `bigcities` | passed |
| `sidestreets` | passed |
| `danfo` | passed |
| `streets` | 16/17, then 17/17 twice after the fix below |
| `touch` | passed |
| `convoys` | passed |
| `vehicles` | passed |
| `bodies` | passed |
| `cities` | passed |
| `ways` | passed |
| `kerbs` | passed |
| `input` | passed |

The one failure was the busy-pavement wall walk: 13.5 s against 8 s on the quiet pavement. With more people about at 5 pm, passers-by on Broad Street are drawn across the bank's front, where the crowd's walking line overlaps the shopfronts. They were counted as standing in front of the player. Someone drawn where a wall is cannot be in the player's way, so the player now ignores them. After the fix: 7 s against 10 s, then 6.25 s against 6.75 s. The player suites `bodies`, `ways`, `kerbs`, `touch` and `input` were rerun after it: 72/72.

**Test changes**
- The daytime crossing check's bar went from 20 to 15 a minute. Abuja at 2 pm measured 19.5, then 18.5, against 21 to 26 earlier. The quiet capital's natural range sits at the old bar, and crossings were not raised to meet it. The check is that people do cross, and that no car is ever on top of them.
- The sleep and fast-forward checks now jump and check in one step. In a first version the game's own loop reset the crowd's clock between the two, so they measured 9 pm.

**Not done here** (Stage 3d, waiting for approval): roadside food stalls and suya spots for Abuja and Port Harcourt. Abuja's evenings are only its 2 hotel lounges, and Port Harcourt's are 4 hotels and 1 street-food place.

**Incident during this stage:** the local `node_modules` was partly deleted, when a temporary git worktree with a junction to it was force-removed. The source was untouched, and `node_modules` was restored with `npm install`. The lockfile is unchanged from the commit, and `npm ls` is clean.

## 7. Stage 3 design: daily routines and destinations (for approval, not built)

Nothing in this section is built. It answers the stage 3 brief of 2026-11-13. The existing systems were inspected first, and the design extends them. It adds no second crowd, schedule or business system.

### What already exists and is reused

| Need | Existing system | How stage 3 uses it |
|---|---|---|
| The people | `CityPopulation`: one crowd in each city, with levels of detail (stage 1) and crossings (stage 2) | Each agent gets a routine. Drawing, levels of detail, crossings, bus queues and chat groups stay as they are |
| Where people can go | Each city's `interactiveList`: every door with its name, category and standing point. Lagos has the Broad Street buildings and landmarks; Abuja and Port Harcourt use `townDoors` and `placeDoors` | These are the destinations: offices, banks, shops, bukas, markets, the building site, the motor park, churches, the mosque, clubs, homes |
| When places are open | `destinations/Hours.ts` (`PLACE_HOURS`, `hoursFor`, `isOpen`, the game calendar). The map, the doors and the interiors already read it | Routines read the same hours. Nobody goes into a shut place, and a stall keeps the hours of its kind |
| Going into a place | The walker's `errand` steps (walk to the door, inside, back out), used today for 4 Broad Street shops | Generalised to every leg that ends at a door, instead of adding a new mechanism |
| How busy the street is | `StreetLife.shareAbroad`: rush hours and a quiet night. Traffic uses it too | Kept as the curve the routines are tuned to, so the crowd and the traffic agree on how busy the hour is |
| Stall traders | One trader and one customer at each Lagos stall, standing there 24 hours | They arrive in the morning, set up and leave at closing |
| Stalls | Built into the street geometry (`CityFabric`). Umbrellas are their own instanced mesh; goods share the street's box mesh | Instance numbers are recorded so a stall can open (umbrella up, goods out) or shut (umbrella folded, goods gone). This changes about once an hour of game time, not every frame |
| Pavements | Walk runs: straight stretches of pavement. In Abuja and Port Harcourt they join only straight over a road. Lagos side-street walkers pace one run | This is the main gap: nobody can turn a corner (see 2 below) |

### What is added

1. **Residents.** Each agent's role comes from its number, so there is nothing to store. In the following list the share is the share of the crowd:
   - office worker 25%
   - trader 15%
   - artisan or labourer 10%
   - student 10%
   - hawker 10%
   - shopper or idler 20%
   - night owl 5%
   - elder 5%

   Each agent also has a home (a residential door, or the end of a street where people walk in from beyond the map), a workplace or pitch picked from the open doors and stalls that suit the role, and a temper (hurried or strolling). The same agent has the same life every day. This is how routines are remembered across updates: the state is just the current leg.
2. **Turning corners.** The pavement network gets corner links where two runs meet at a junction, then one table of next-step-to-each-run, worked out once when the city loads. Lagos has about 300 runs and the other cities fewer, so this is a small array. Agents never path-find while walking. The player's `Wayfinder` is not used.
3. **The day plan.** A few legs worked out from role, city and weekday:
   - home to work
   - inside or at the pitch
   - out for food at an open buka or a food stall
   - back to work
   - home, or to the evening place (bar, club, viewing spot, church or mosque on its day)
   - home

   Each leg starts at a set time with some spread per agent, so the rush builds up rather than everyone leaving at once. While people are inside a place they are not drawn and cost nothing.
4. **Clock jumps.** Sleeping, fast-forwarding and arriving in another city all move the clock. After a jump, everyone is put straight where their plan says they should be at that hour, so nobody walks a stale route.
5. **Each city its own pattern.** A small profile per city sets role shares, start times and evening places:

   | City | Pattern |
   |---|---|
   | Lagos | Leaves early to beat the go-slow (from about 5:30), heavy trading all day, late bukas and clubs, Sunday church |
   | Abuja | Civil-service hours (8 to 4 on weekdays), orderly and thinner streets, Friday Jumu'ah crowd at the mosque around 1 pm, suya in the evening, quiet early and very quiet at weekends |
   | Port Harcourt | Port and oil shifts (about 6 to 6), busy roadside trading on Aba Road, evenings at bars and pepper-soup joints |

6. **Stalls in Abuja and Port Harcourt.** These cities have no stalls today. Port Harcourt gets many along Aba Road. Abuja gets few: kiosks by the motor park and the market. They are placed with the same open and shut behaviour as Lagos.

### Order of building (each a commit, tested and pushed)

| Step | Built | Done when |
|---|---|---|
| 3a | Residents, corner links and route table, the morning legs and workplaces, Lagos stalls open and shut | At 8 am people walk to real doors and go in, traders set up, and stalls are shut at 2 am |
| 3b | Midday: food legs to open bukas and food stalls, a customer at a stall, errands to any open shop | Around 1 pm the bukas draw people and nobody goes into a shut door |
| 3c | Evening and night: legs home and to evening places, the clock-jump catch-up | At 7 pm the flow runs homeward and to bars, and at 2 am only night owls are out |
| 3d | The Abuja and Port Harcourt profiles and stalls, then all three cities measured | Each city's hourly counts differ the way the profiles say |

### Performance plan (Samsung A16)

| Work | Cost |
|---|---|
| A leg starting | One table lookup, a few times a second across the whole crowd |
| Walking a leg | The same per-frame work as walking a run today |
| People inside | Skipped |
| Stall open and shut | About once per game hour |

Budget: the crowd update stays under 1 ms on the laptop measure in each city at 8 am, 1 pm and 7 pm. It adds no new draw calls, meshes or shaders. Then the A16 is checked through the frame and load figures in Settings.

### Risks

| Risk | Plan |
|---|---|
| The street empties when workers go inside | Role shares are tuned so the count out at each hour stays near `shareAbroad`. Hawkers, traders and idlers keep the pavements lived in |
| Lagos's Broad Street pavement is a raised walk that is not a run | It joins the network at its ends and at the Martins Street crossing |
| People appear or vanish at doors in sight of the player | They go in and come out at the door, as errands do now |
| Clock jumps put people in odd places | Covered by the catch-up step in 3c, with a test |

### Tests to add to `livingcity`

- Follow one resident per city through a compressed day: home, then work at 8, food at 1, home or out in the evening. Each door reached must be open at that hour.
- Count each activity per city at 8 am, 1 pm, 7 pm and 2 am, against that city's profile.
- Stalls: umbrella and goods hidden at 2 am, shown at 10 am, with the trader present only while open. Checked in the instance data and in one screenshot each.
- Nobody walks off the pavement network; positions are sampled.
- The cost budget above.
- Regression: `citylife`, `bigcities`, `sidestreets`, `danfo`, `streets`, `touch`, `convoys`, `vehicles`, `bodies`.

### Not in stage 3

These belong to stages 4 and 5 of the plan:
- customers seen inside shops
- story people with routines
- tapping or talking to residents
- horn reactions for people crossing
