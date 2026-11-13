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
