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
