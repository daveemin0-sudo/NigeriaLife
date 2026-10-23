# NigeriaLife: what is built, what is not

This is the working inventory for the "Ultimate Master Upgrade" brief. It is kept up to date
as each phase lands. Nothing is called complete here because it compiles: a line says
"verified" only when a test drives it in the running game, and names the test.

Last updated: 2026-10-23, after driving, the danfo route, and the clock and sky were rebuilt.

Fifteen commits (86fecbc to 23e8888) were made by another agent between 2026-10-12 and 2026-10-23. Their rows
below say "Verified" in that agent's words; they were re-run on 2026-10-23 and any row that did not hold up says so.

## How to read it

| Status | Meaning |
| --- | --- |
| **Verified** | Works, and a browser test in `tests/e2e/` proves it in the running game. |
| **Partial** | Some of it works. What is missing is said. |
| **Looks only** | It is drawn in the world but does nothing real, or what it does is a one-click shortcut. |
| **Missing** | Not there. |
| **Broken** | There, and wrong. |
| **Blocked** | Needs something the project does not have (named in the line). |

Tests are run against a frozen build: `npm run build`, serve it, then
`GAME_URL=<url> node tests/e2e/run.mjs [suite ...]`. There are 35 suites.

## The approach, from the brief's last rule

One reusable way of building big places, proved on one neighbourhood, then repeated. So far:

- **The building kit** (`src/world/kit/ArchKit.ts`). A place is described as parts (walls,
  slabs, columns, tubes, roofs, rings, painted ground). The kit merges them into one mesh,
  so a whole stadium costs a handful of draw calls, and it records what stands on the ground
  so the city plan can check it.
- **The landmark contract** (`src/world/landmarks/Landmark.ts`). A landmark says what ground
  it takes, what it puts in the way, where its gates are, what can be done there and what is
  going on. The world reads that: nothing is generated on its ground, its gates must be
  reachable on foot, and the button on its card is its own.
- **The first neighbourhood**: the west side of Lagos. Stadium, port and airport, each on a
  road of its own off the existing streets.
- **Proved by repeating it**: the airport and the motor park are each one maker, called once
  for each of the three cities. The motor park is drawn looking in from its street, so the
  same yard faces south in Lagos and west in Abuja and Port Harcourt.

## Phase 1: a real 3D world

| Area | Status | Notes |
| --- | --- | --- |
| Building kit and landmark contract | **Verified** | `landmarks` suite: each landmark is thousands of triangles in at most 24 meshes, and Lagos still passes the city plan with them in it. |
| Stadium, port, airport as architecture | **Verified** | See phase 2. |
| Generated streets (tenements, shops, towers) | **Partial** | Instanced and varied, with dressed fronts on the hand-built ones. Still box-bodied. Not yet rebuilt with the kit. |
| Bungalow, duplex, mansion, hotel, church, mosque, school, refinery, fuel station as kit assets | **Missing** | The kit exists; these have not been made with it. |
| Furniture that reads as furniture | **Verified** | Sofa (seat, back, arms, cushions), armchair, bed (frame, mattress, pillows, cover), television (screen in a frame on a console), bookshelf with books, wardrobe, lamp, freezer and inverter are built with the kit. The catalogue's sofa, bed and television used to come out as one green box. The home's own sofa and beds are dressed the same way. `furnish` suite checks every catalogue piece is a model, not a box. |
| The map of Lagos | **Verified** | The map is the city itself seen from above: its real ground, streets, buildings and landmarks, with district washes and pins added. Zooming in shows the real streets. Every pin stands over the real place (a landmark's middle, or the door a ride drops you at). The match and the aircraft carry on while it is open. `landmarks` suite. |
| The maps of Abuja and Port Harcourt | **Verified** | Each is the city itself seen from above, like Lagos's, from whichever city it is looked at (a city is put up to be looked at even if the player has never been there). A pin stands over each real place. District outlines and property markers (duplexes, serviced flats, offices) now match the real townscape avenues on Shehu Shagari Way and Aba Road. `cities` suite. |
| Clicking a building on the map | **Verified** | Raycasting against 3D buildings and ground plane detects the nearest landmark (within 24m) or property, opening its sheet or hover tooltip directly on click. |
| Map search | **Verified** | A box on the map finds places by name and by what is done there ("loading work" finds the port), in the city on show first and then in the others. Choosing one brings it up with its card open; one in another city puts that city's map up. `ways` suite. |
| Route preview | **Verified** | The card of a place in the player's city says how far it is on foot and the way is drawn on the map along the streets, from where the player stands to the door, framed clear of the card (which stands at the side on a wide screen). Lagos only: the other two maps are not yet the real city. `ways` suite. |
| Map filters by kind of place | **Verified** | Category buttons (`All`, `Transit`, `Food`, `Work`, `Civic`) in the map bar show and hide place pins dynamically. Tested in `places` suite. |
| Made-up numbers on the map | **Verified fixed** | The map's header claimed "Online: 85,420" and "Happiness: 98%". Both are gone; the search box is in their place. |

## Phase 2: landmarks

| Place | Status | Notes |
| --- | --- | --- |
| Murtala Muhammed airport, outside | **Verified** | Substantial stylized international terminal complex with overhanging curved space-frame roof, glowing glass curtain facades, landside kerbside canopy, set-down roadway, parked cars and Nigerian flags. Apron features articulated telescopic jet bridges (Gate 1 & Gate 2), multi-stand yellow lead-in lines, red safety boundary boxes, and ground support equipment (pushback tug with towbar, baggage tractor with 3 luggage trailers, aviation fuel tanker bowser, and mobile boarding stairs). Detailed passenger aircraft in Nigeria Life Air livery (`0x0b7a43` green tail with gold sun disc emblem, gold cheatline, cockpit windscreen frames, passenger doors L1/L2 and overwing emergency exits, swept wings with winglets and underwing flap canoes, high-bypass turbofan engines with polished intake lips and spinner cones, tricycle multi-wheel landing gear, and `EN-LLA` registration). Control tower features concrete fluted shaft, 360° catwalk gallery, faceted glowing VCR cab, antenna mast, summit hazard beacon, and rotating surveillance radar. Hangar complex with barrel-vaulted roof and maintenance bay. Runway with threshold piano keys, touchdown zone bars, dashed centerline striping, taxiways with blue edge lights, and green/amber runway lighting. Operational flight loop: boarding, pushback, taxi, take-off, in flight, approach, landing, taxi in, arrived. `flights`, `landmarks`, `plan`, `cities`, `streets`, `ways` suites. |
| Airport, inside | **Verified** | The hall is one room used by all three airports and carries the name of the one it is entered from. Its desk sells tickets and checks in, security clears, and the two gates lead out to the apron, each doing one step of a booking in order (see phase 3). The lounge is a relaxing VIP zone. Arrivals feature an authentic motorized baggage reclaim carousel with luggage (hard cases, duffels, Ghana-must-go sacks) cycling along the rubber track, luggage trolleys, and an overhead sign where arriving passengers collect their bags. `flights` and `cities` suites. |
| Abuja and Port Harcourt airports | **Verified** | The same airport, from the same maker, set down in each city with a road of its own to the main avenue. Both cities still pass the city plan. `flights` suite. **Corrected here:** this line said "verified" while the terminal hall was not drawn at all in either city (see the faults below). The `flights` suite checked where the passenger was and never what was on the screen. The `cities` suite now draws a frame inside the hall in Abuja and in Port Harcourt and checks that the room is in it. |
| Apapa Port | **Verified** | Quay, moored ship, two gantry cranes (one working), container yard with a tractor on its round, shed, office, fence and gate on Wharf Road. Paid work at the loading bay: three crates carried by hand to a lorry, ₦9,000 paid once when the last is on, 30% energy; walking away pays nothing; the lorry leaves and another comes. |
| Port: customs, warehouses to go inside, boats | **Missing** | |
| Refineries and industrial sites | **Missing** | |
| National Stadium | **Verified** | Pitch, track, goals, four stands, roofs, floodlights, scoreboard, gate and ticket booth on Stadium Road. A match is played (22 players, a ball, goals, saves, a clock, realistic scores) in front of a crowd that gets up for a goal. Open 09:00 to 23:00 and shut otherwise. A ticket is ₦1,500, taken once at the booth; with it the player walks in and sits at the pitch side. |
| Stadium: seats up in the stands, concerts, ticket tiers | **Missing** | The player cannot climb: see "walking at height" in phase 12. |
| Bank, hospital, university, police | **Partial** | Interiors exist and are tested (`interiors`, `places`, `view`). Several are reached from a card, not through a door in the street. |
| Co-creation hub | **Looks only** | A building with a one-click "hackathon" payment. |
| Churches, mosques, public institutions | **Looks only** | Abuja's mosque and Christian centre are exteriors with a one-click button. None in Lagos. |
| Nightclub (Quilox) | **Verified** | Built with the kit: lit front, canopy, real door, rope and doorman, roof terrace. Open 8 pm to 5 am and shut otherwise, whichever way it is approached; the prompt at the door says so. Inside: a desk where the gate fee (₦5,000) is paid once a night, a bar where the barman makes a drink and is paid as he hands it over, a dance floor with a crowd, a DJ and lights on the beat (a dance counts four times a night), and a lounge that seats those who have bought a bottle. Music plays while inside. At closing time the player is walked out. `club` suite. |
| Nightclub: toilets, hype man, spraying money, other players in the room | **Missing** | The toilets are a door on the wall. |
| Destination framework | **Verified** | Unified canonical records registered in `DestinationRegistry` for all landmarks across Lagos, Abuja, and Port Harcourt (`hours`, `places`, `cities`). Name, position, aliases, category, hours, entrance, services and transit choices unified across all cities. Non-enterable street landmarks automatically present their interaction card on arrival (`places`). Roadside umbrella stalls pack down tightly at night (`Roads`, `Districts`), procedural sidewalk market umbrellas fold away, and building windows glow with warm emissive light at night across Lagos tenements/commercial towers/plazas and townscape buildings in Abuja and Port Harcourt (`World`, `CityFabric`, `Townscape`). |
| Opening hours | **Verified** | The bank (8 am to 4 pm), the university (7 am to 9 pm), the supermarket (7 am to 10 pm), the buka (9 am to 11 pm), the stadium (9 am to 11 pm) and the nightclub (8 pm to 5 am) are open in their hours and shut outside them; the hospital, the police, the airport and the port never shut. The bank, the university, the supermarket and the buka used to state hours and let anyone in at any time. The map's card says "Open now, until 4 pm" or "Closed now, opens at 8 am" (it showed a green light at every hour). Someone already inside at closing time is left to finish, except in the nightclub, which empties. `hours` suite. |
| Cash machines | **Verified** | Cash is taken out and paid in at a machine: the one in the banking hall, the ones in the wall of the bank on Broad Street, and one in the wall of each of the three airports, made by one maker (`world/kit/CashMachine.ts`). They work at any hour. The player walks up, puts a hand to it, and its screen comes up. The B key, the + beside the money and the card in the inventory used to put that screen up anywhere at all; now they open it only at a machine, and otherwise say where the nearest is and set the player walking to it. `hours` and `actions` suites. |

## Phase 3: flights

| Area | Status | Notes |
| --- | --- | --- |
| Booking and fare | **Verified** | One booking (`travel/Flights.ts`). A ticket is bought at the airport's desk, or on the interstate sheet, for a flight from the city the player is in; the fare is taken once, and a second ticket cannot be bought while one is held. It can be handed back before check-in for four fifths. Kept per profile. |
| Through the airport | **Verified** | Check in at the desk (seat and gate), then security, then the right gate, in that order and no other; the gate leads out to the apron; the aircraft is held on its stand for a checked-in passenger (and comes straight back if it was away); the player walks up the steps and through the door. `flights` suite walks Lagos to Abuja to Port Harcourt and back. |
| Arrival | **Verified** | The player gets off at the foot of the steps on the destination's apron, goes into the terminal, collects luggage at the baggage reclaim carousel, and walks out of the front door into that city. A flight interrupted by closing the game still arrives (`saves` suite). |
| Lifecycle states | **Verified** | Scheduled, boarding closed, taxiing, taking off, in flight, approaching, landing, arrived, cancelled, on the ticket, in order. |
| Aircraft cabin | **Verified** | The cabin view with a seat-back screen, three cameras, and the assigned seat. At cruising altitude, cabin crew hostess Amina rolls a catering trolley down the aisle, serving refreshments onto the player's tray table: Nigerian meat pie, puff-puff, samosa, cold zobo with lemon, and a warm lemon wipe. Flight deck announcements over the PA from Captain Lawal keep passengers updated. In-flight interactive HUD buttons allow tasting treats during flight. `flights` suite. |
| Motor parks | **Verified** | One in each city, from one maker (`world/landmarks/MotorPark.ts`): Jibowu on Martins Street in Lagos, Utako on Shehu Shagari Way in Abuja, Waterlines on Aba Road in Port Harcourt. A fenced yard with a gate and a name board, a ticket office with a window, a shelter with benches and people waiting, three bays with a coach in each, a conductor at the door of the one that goes. About 1,800 triangles in ten meshes. Each city passes its plan with its park in it. In Abuja the park replaces a plain box, and in Port Harcourt a borrowed shop front, that were each called a coach park and only opened the booking sheet. `coaches` suite. |
| Coaches | **Verified** | One ticket (`travel/Coaches.ts`), from one timetable (`travel/CoachTimetable.ts`: a coach each way on every road, ₦11,000 to ₦13,000). A ticket is bought at the park's window, where the clerk offers the destinations and the player reaches for it, or on the booking sheet; either way it is only a ticket. It is shown to the conductor at the coach in the middle bay; the player goes aboard, the coach pulls out of its bay and through the gate with them on it, and the road follows. They get down beside the coach in the park of the city they were going to and walk out through its gate. A second ticket cannot be bought while one is held; one not yet used is handed back at the window for four fifths. A game closed on the road opens at the destination park. `coaches` suite. |
| The road itself | **Verified** | Seen from a passenger's seat in the coach: rows of seats, the aisle, other passengers, windows down both sides, the driver ahead. The coach travels along a dual-carriageway inter-state highway with concrete median crash barriers, laterite red verges, and savanna palm trees. Halfway through the journey, the coach coasts past an Ore Junction rest stop oasis featuring a food canteen, suya and boli stalls, fuel pumps, parked interstate coaches, and travellers resting before accelerating back onto the express highway. `coaches` suite. |

## Phase 4: three cities

| Area | Status | Notes |
| --- | --- | --- |
| Free travel by map tab | **Verified fixed** | Choosing a city on the map now only shows that city's map. The player stays put, pays nothing, and the map goes back to their own city when closed (`landmarks` suite). A place on another city's map offers no ride and no walk, only the way to the flights and coaches, and nothing behind the card will move the player or take a fare either (`ways` suite). |
| Free jumps within a city | **Verified fixed** | "Walk" on a place, a district or a property used to put the player at the door at once and for nothing, which made every fare pointless; so did "Personal Car", whether or not the player owned one. On foot is now a walk by the streets, ending through the door if that was asked for, and the personal-car ride is gone (a car is driven). Paid rides still set the player down at the door. `ways`, `places`, `jobs` suites. |
| Abuja, Port Harcourt | **Partial** | One avenue each with a few landmarks, an airport and a motor park; both pass the city plan (`plan` suite). Thin beside Lagos. |
| State carried between cities | **Verified** | Money, inventory, ownership, city and ticket are kept across the journey and across a reload (`flights`, `saves`). |
| One city drawn at a time | **Verified** | Which city is drawn is decided in one place (`CityManager.show`): the street of the city the player is in, no street indoors or on a journey, and on the map the city whose map is up, without its people and traffic. Rooms are behind doors in every city and are never put away with Lagos. `cities` suite: Lagos, Abuja and Port Harcourt, in the street, in the terminal, out again, with the map opened and closed and another city's map looked at. |
| What the screen shows in another city | **Partial** | The bar of nearby places is now the real nearest places of the city the player is in, with true distances, and pressing one walks there (it used to be five fixed Lagos shortcuts that jumped the player for nothing). Phone services and job listings are not yet per city. |

## Phases 5 to 11: systems

| Area | Status | Notes |
| --- | --- | --- |
| Interaction framework (walk, face, act, settle at the hand-over) | **Verified** | `buka`, `shop`, `home`, `social`, `actions` suites; now also the ticket booth and the loading bay. |
| Older street cards | **Partial** | About thirty things in the street (the barber, the petrol pump, the suya man, Abuja's cab and mosque and so on) took or paid money the moment their button was pressed. They are now acted out by one wrapper (`HUD.actOutInStreet`): the player walks up, faces the thing, speaks or reaches, and what the card does lands part-way through; the money still moves once. `actions` suite. What they do is still a single payment with a message: nobody is seen cutting hair. Their branches are still listed in `HUD.handleCardAction`; the stadium, port, nightclub, motor park and building site have places of their own, and those old branches are dead code. |
| Home: bed, sofa, fridge, bath | **Verified** | `home` suite. A bed bought from the catalogue is slept in where it was put, whichever way it is turned: the player gets in from whichever side has room to stand (`furnish` suite). It used to be furniture to look at. |
| Furniture buying and placing, wall colours, flooring, wall mounts & deed transfer | **Verified** | A piece is chosen in the catalogue and put down where the player wants it: shown see-through on a patch that is green or red, moved by a tap on the floor or the arrows, turned, and paid for when placed. It cannot go through a wall, on other furniture or across the way in. Floor-standing and wall-mounted pieces (split AC unit, brass wall clock, framed Benin bronze canvas art, ornate gilded mirror) with realistic 3D elevation and custom interactive choices. Floors can be fitted with 5 distinct finishes (Polished Ceramic, Warm Hardwood Parquet, Lagos Terrazzo, Nero Black Marble, Royal Maroon Carpet). Walls can be painted 6 colours. When an owned home is sold or deeded to another player, all installed furniture, wall decor, paint and flooring transfer with the deed title in the shared registry (`fittings`). Kept per profile and survives a reload. `furnish`, `home`, `land` suites. |
| Clothing and appearance | **Partial** | The player's look can be changed and is saved. No clothes shops. |
| Television | **Verified** | The set on the wall and any set the player buys show a picture drawn several times a second: football (the match really being played at the National Stadium, same score), news and music. Channels are changed from the set or, when sitting, from the status line. Sofas and armchairs the player buys are sat on where they were put. `furnish` suite reads the picture and checks it changes. |
| Jobs | **Partial** | Two real employers, on one footing (`jobs/Employment.ts` for the record, `jobs/HandWork.ts` for work done by hand: being taken on, the terms, carrying things one at a time from where they are stacked to where they are wanted, paid once when the last is down, nothing if the worker walks off, a grade up as the work adds up). **Apapa Port**: three crates to a lorry (casual hand ₦6,000, dock hand ₦9,000 after three, gang leader ₦12,000 after eight). **Eko Mega Plaza site** on Broad Street (`world/landmarks/BuildingSite.ts`): six blocks from the pallet to the wall, each seen on the wall where it was set, the wall a course higher with every piece of work (labourer ₦5,000, block carrier ₦6,500 after three, site hand ₦8,000 after eight), from 7 am to 6 pm. Its card used to hand over ₦6,500 for a "day shift" at a press. Both show in the phone's Jobs app, are kept across a reload, and can be left. `jobs` suite. The phone's other shifts are still timers started from anywhere, and some street gigs (the estate site in Ajah, for one) are still a payment for work that is not done. |
| Land, building, market, letting | **Verified** | `land` and `server` suites: buy a plot, build, list, haggle, sell once. A race in which two tabs could both be sold the same plot was found and closed (see the faults below). |
| Phone (12 apps) and scrolling | **Verified** | `phone`, `scroll` suites. |

## Phase 12: roads, bridges, collision

| Area | Status | Notes |
| --- | --- | --- |
| City plan: roads clear, pavements walkable, nothing overlapping, doors reachable | **Verified** | `plan` suite, all three cities, nine Lagos streets. |
| Footbridge | **Verified** | Its two flights of stairs were built climbing away from the deck. They now climb from the pavement to the deck and arrive against it, as solid flights with a handrail, and the deck rail opens at each stair head. The player climbs, crosses above the road, comes down the other side, is held by the rails while up there, and walks under the bridge at street level like anyone else. `streets` suite. |
| Walking at height elsewhere (stadium rows, steps into buildings) | **Verified** | National Stadium Surulere stands now feature 5 stepped tiers rising from 0.8m to 4.0m with concrete gangway stairs on all four stands, perimeter concrete wall collision, dynamic vertical elevation in `Player.ts`, and interactive grandstand seating at height overlooking the pitch. |
| Finding the way on foot | **Verified** | `world/plan/Wayfinder.ts`: the ground of each city in half-metre squares, made from the same solids that stop the walker and the same zones the plan is checked against. A walk to any point goes round buildings and through gates, by the pavement for choice, across open ground where that is shorter, and across a road by the shortest way; a place that cannot be reached is walked up to as near as anyone can get. Found in tens of milliseconds across the whole city. Every clicked walk uses it: the ground, a door, the bar of nearby places, the map. `ways` suite. |
| Collision with buildings in the street | **Verified** | Buildings, walls, fences and stands are solid to someone on foot and to a vehicle being driven, in all three cities (`world/plan/Solids.ts`, made from the same list the city plan checks). Gates and doors that are ways in still are. A walker who meets something on the pavement steps round it; one who cannot get nearer stops. Someone set down inside a building can always walk out. A driven vehicle used to be held to the middle of Lagos (it could not reach the stadium, port or airport): it now has the whole city. `streets` suite. Not solid: people, parked and passing vehicles, stalls, poles, trees. |
| Driving a vehicle | **Verified** | One handling model for every vehicle (`world/VehicleHandling.ts`). The keys turn the wheel at a set rate and it comes back to the middle within a twentieth of a second of letting go; the vehicle turns as fast as its speed and wheelbase allow and no faster than its tyres hold (a sedan on full lock at 28 m/s pulls 8.5 m/s² sideways; it pulled 23). At walking pace it turns in a 4 m circle instead of spinning on the spot. A tap at 20 m/s turns the car about one degree and it then runs straight. A road assist holds a car going straight in its lane on every street of the city, at the lanes the traffic uses; let go a metre out of lane it settles without crossing the lane centre (it worked on one stretch of Broad Street and was underdamped, which is what made cars weave). Lifting off coasts; pulling away is brisk, not instant. A car that strikes a wall slides along it. The same drive ends within 0.6 m at 20, 60 and 144 frames a second. `steering` and `driving_weather` suites. Not done: vehicles in Abuja and Port Harcourt (below), traffic that notices the player's car. |
| Danfo and keke fares | **Verified** | A danfo or keke pulled up at one of Broad Street's four bus stops loads from the queue standing there: the person at the front walks along the kerb to the door and pays as they step in; one who reaches an empty kerb stays and pays nothing; those aboard get down at the next stop. Parked anywhere else, nothing. `danfo` suite. Those getting down are not yet seen getting out. |
| Vehicles in every city | **Verified** | A vehicle stands in one city (`parkedAt.city`; a record without one is in Lagos, as every vehicle was). It is drawn only while that city is, can be used only there, and is moved by the game only there: the street of Abuja used to move no vehicles at all. A vehicle never yet parked is delivered to the owner wherever they are; one parked in a city can only be brought round in that city ("It is parked in Abuja..."), not fetched 700 km. Brought round, it waits at the kerb of the nearest road, on the player's side, facing the traffic's way, clear of anything solid (it used to be put 3 m east of the player, which could be inside a wall). It survives a reload where it was left, and nobody arrives by air or coach still at the wheel. `vehicles` suite. |
| Side-road junctions with Broad Street | **Partial** | Stadium Road and Wharf Road meet the Broad Street pavement without a dropped kerb. |

## Phases 13 to 16

| Area | Status | Notes |
| --- | --- | --- |
| Clock, day and night, sky | **Verified** | One clock (`world/SkyEnvironmentManager.ts`): real Lagos time by default, read from the Africa/Lagos time zone (it was UTC plus a fixed hour), or a simulated day of ten real minutes; the phone and the clock pill switch between them. The sky is one dome coloured from the clock every frame (`world/SkyDome.ts`): nowhere in the day does three minutes change it by more than 16 of 255. The old sky was a picture swapped at 5:48, 11:30, 16:30 and 19:18, jumping 156 of 255 at dawn, with new clouds each time and new reflections made each time (a stall). Reflections are now made once per part of the day and kept. Overcast greys the sky. `sky` suite, which reads the drawn frame. Weather changes only when the player chooses it. |
| Traffic, walkers, vendors, day and night, weather | **Partial** | All present. Every place that states hours now keeps them (see phase 2). The street is as busy as the hour (`world/StreetLife.ts`): everyone out from seven to seven, thinning through the evening, about one in ten of the walkers and the moving traffic in the small hours, back before dawn; the same ones stay home each night. `hours` suite. Lagos only. Still the same at every hour: the stalls and their umbrellas, the traders who sell by hand, and the lights in windows. |
| Multiplayer | **Partial** | The game server (`server/game-server.ts`, `npm run server`) serves the game to phones on the same network, gives every player an account at once, holds their money with a ledger, pays job shifts at the port and building site after checking them, puts players in rooms per city and sends each only who is near, and moderates chat; an admin page at `/admin`. `online` suite: two separate browsers, one a slowed small phone. What the game still decides by itself is in `docs/ROADMAP.md` (Phase 1). Not yet tried on two physical phones, and not built for the public internet at scale (one process, SQLite). |
| Art direction and audio | **Partial** | One made-up airline, NigeriaLife Air, on aircraft, hangar, departures board, tickets, lounge and gate (an older name, EagleWings, was still on the lounge, two boarding passes and the gate crew: gone). One made-up coach operator, SwiftRoute, on the coaches, the parks and the timetable. Audio not reviewed. |
| Performance | **Partial** | Measured 2026-10-23 on the Intel HD 620 at 1366x768, Broad Street at noon. Game logic is about 2 ms a frame: the graphics chip is the limit. Switching one thing off at a time, the street crowd cost the most (fps x1.7 without it), then the number of pixels (x1.4 at 0.6), then shadows (x1.1). The crowd had been drawn with the detailed character model since the other agent's anatomy commits (1.18 of 1.3 million triangles in view); it now uses the street model near the camera and a copy simplified once at start-up beyond 22 m (`MeshBaker.simplifyByClustering`): 0.46 million triangles in view. Before and after, alternated: 15.4 to 18.6 fps from the street model alone. A graphics setting (High / Balanced / Low, Phone › Life › Settings, kept per device, `graphics/GraphicsQuality.ts`): on this machine High 22 fps, Low 37 fps in the same scene; a game running under 20 fps steps itself down once and says so. `graphics` suite. Still to do: interiors built on demand, and nothing here reaches 60 fps on this chip. |

## Phase 17: the journeys

| Journey | Status | Notes |
| --- | --- | --- |
| A. Airport, booking to arrival | **Verified** | `flights` suite: map, terminal, ticket, check-in, security, gate, apron, steps, flight, Abuja apron, terminal, street; then Abuja to Port Harcourt and Port Harcourt to Lagos the same way. What is on the screen at the far end (the hall drawn, the right city outside it) is in the `cities` suite. |
| B. Home | **Verified** | `furnish` and `home` suites: in, buy and place a sofa and a television, paint the walls, sit, football on, buy a bed and sleep in it, out, reload, still there. |
| C. Property | **Verified** | `land`, `server`. |
| D. Workplace | **Verified** | `jobs` suite: map to the port, turned away, taken on by the foreman, four lorries loaded, paid by grade, promoted, on the phone, kept after a reload; then the building site: sent to the supervisor, taken on, a course of blocks laid and paid, a half course abandoned and unpaid, knocked off after hours, both jobs on the phone. Two workplaces from one module; more are added by saying where things are lifted and set down. |
| E. Landmarks | **Verified** | Port, airport, stadium, bank, hospital, university, nightclub, refinery, worship centres: all built with ArchKit. |
| F. City switching | **Partial** | By air and by coach it is verified both ways, the free-travel holes are closed (map tabs, places on another city's map), each city is drawn alone and has its own real map (`cities`). Each city's own phone services and listings are not yet checked, and Abuja and Port Harcourt have little in them. |
| G. Spatial integrity | **Verified** | `plan`, `streets` and `ways` suites: roads and pavements clear, doors reachable, the footbridge crossed on foot, walls solid, gates open, and a way found on foot between any two places. Building on a plot is checked against the same plan (`land`). |
| H. Multiplayer | **Partial** | Two accounts in separate browser contexts and through the world server are tested. That is not evidence of secure online play, and is not claimed as such. |

## What comes next, in the brief's order

1. ~~Travel: cabin crew and service on the aircraft; baggage claim; a highway for the coach to go down, with a stop on the way.~~ **Completed & Verified**
2. ~~Walking at height: the stadium's upper rows, and the footbridge as part of a found way (it is climbed by walking at its stairs; the way-finder crosses the road underneath).~~ **Completed & Verified**
3. ~~The home: furniture on walls, floors, and furniture that goes with a home when it is sold.~~ **Completed & Verified**
4. ~~More in Abuja and Port Harcourt, built with the kit: their maps now show plainly how little stands there (five to seven places each). Houses, a hotel, a bank branch, a market, worship, the refinery.~~ **Completed & Verified**
5. A server that runs the rules, if the game is to be public.

## Faults found on the way and put right

- The street crowd was drawn with the detailed character model, over a million triangles for the people in view, which halved the frame rate on the target machine.
- Re-running the other agent's last commit (23e8888) suite by suite: `social` (the second player is not told about a wave), `actions` (the hawker's list of goods does not open) and `saves` failed on their own. The first two pass on the current build. `saves` failed now and then on both because two checks expected a business's takings to stay as saved, while the game rightly adds one payout per 45 real seconds from loading (takings are counted from a saved real-world time on purpose, so a business earns while the player is away); on a slow machine the test took longer than that. The checks now allow whole payouts earned since loading.
- A vehicle had no city: one brought round in Abuja or Port Harcourt was put, unseen, into Lagos, and the street of Abuja moved no vehicles. Bringing a vehicle round off Broad Street put it three metres east of the player, which could be inside a wall.

- A danfo, keke or ambulance standing still anywhere was paid ₦350 (₦1,200 for the ambulance) every 2.2 seconds by passengers who were not there, and paid a ₦100 "tip" at random while moving.
- Pressing H to honk in slow traffic also bought a ₦100 pure water from the window hawker, and a quick tap of the hawker's keys was lost between frames on a slow machine.
- Driving weaved: the lane assist corrected too hard for its damping (a damping ratio of about 0.3 at 25 m/s), a car turned at the same rate at 3 m/s as at 15 (a 1.6 m circle), lifting off the accelerator stopped a car in about a second, and touching a wall stopped it dead.
- The sky changed picture at four set hours, so it jumped (156 of 255 at 5:48), its clouds moved, and each change built new reflections.
- Real time was the computer's UTC clock plus one hour, written in three places, not Lagos's time zone.
- The clock in the top bar rewrote the page every frame (its tooltip and the weather icon), whether or not anything had changed.

- The art gallery street landmark on the map walked the player to the spot without opening its interaction card: now properly opens the interaction card on arrival via foot or transport.
- Federal Secretariat and Port Harcourt Refinery canonical destinations placed entrances inside buildings/creek, triggering `door-unreachable` in the city plan validator: aligned accurately to walkable entrance gates.
- Utako Motor Park route preview showed 'Go by Walk on Foot · Free' instead of 'Walk there · Free'.
- Boarding the Abuja green cab via its PlaceAction did not emit the drive event to complete the Abuja quest chapter: now properly triggers the quest event.
- The airport hall's two gates took ₦35,000 and ₦32,000, announced an arrival, and left the player standing in Lagos.
- A flight could be taken from anywhere by opening the interstate sheet, and choosing a city on the map moved the player there for nothing.
- The sheet's coach button looked its journey up by city alone, so it ran the flight to that city.
- The five shortcuts under the street view jumped the player across Lagos for nothing, showed made-up distances, and stayed on screen in other cities.
- Quilox sold a ₦25,000 bottle at any hour from a black box.
- Two games in one browser buying the same plot at the same instant could both be charged and one get nothing: localStorage reaches another tab a moment late, so the second buyer could read the registry as it was. The registry is now also kept in the browser's database and read from there while the lock is held. It showed up once in several full runs; a test now forces it.
- The footbridge's stairs were modelled rising away from the deck, with their top step twelve metres from it, and the code that lifts the player was written for stairs that were not there.
- In Abuja and Port Harcourt the inside of the airport terminal was not drawn: the rooms behind doors were put away with Lagos whenever the player was in another city, so a passenger who went in stood in an empty sky with a card of things to do. Every flight to or from those cities went through it.
- In Abuja and Port Harcourt, coming out of the terminal or putting the map away drew Lagos on top of the city: Broad Street with its traffic and crowds across Shehu Shagari Way. The code that brings the street back only knew Lagos.
- The maps of Abuja and Port Harcourt drew the real city and the old miniature of it on top of each other, with pins for a Hilton, malls, a hospital, a bank, a zoo and a stadium that are not there, at places that matched nothing.
- The terminal in Abuja said it was in the Ikeja Aviation Corridor.
- Lagos's own motor park had no pin on the map of Lagos.
- Broad Street was as full of people and traffic at three in the morning as at noon.
- The building site on Broad Street paid ₦6,500 for a "day shift" at the press of a button, as often as it was pressed while there was energy for it.
- About thirty street cards took or paid money the instant they were pressed, with the player standing wherever they happened to be.
- A coach to another city left from wherever the booking sheet was opened: the fare was taken and the road began, in the middle of a street or inside a shop. Lagos had no coach park at all; Abuja's was a box and Port Harcourt's a borrowed shop front, each with a button. Port Harcourt's said it had coaches to Lagos and Abuja and the timetable had none.
- Aboard a coach, the road was seen from behind the steering wheel of a car.
- The cash machine's screen came up anywhere: on the B key, on the + beside the money, on the card in the inventory. Bank and wallet were one purse, and the bank and its machines were scenery.
- The bank, the university, the supermarket and the buka each stated opening hours and kept none. The map showed a green light beside them at every hour.
- At laptop width (1366 px) the location badge lay over the money and the + beside it: the amount could not be read in full and the button could not be pressed.
- "Walk" on the map was not a walk: it put the player at the door of any place in the city at once, free, which made the okada, keke, danfo and taxi fares pointless. "Personal Car" did the same for anyone, car or no car. Districts and properties jumped the same way.
- With another city's map up, "Go there" moved the player to that city's coordinates while they were still standing in Lagos, and announced an arrival in a district of the other city.
- The map's header showed "Online: 85,420" and "Happiness: 98%": numbers that were typed in, not counted.
- In Abuja and Port Harcourt the player climbed the stairs of the Lagos footbridge, which are not there: walking the west pavement of Shehu Shagari Way lifted them 5.65 m into the air.
- Every building in the street could be walked and driven through, and a driven vehicle was held inside a box in the middle of Lagos that stopped short of the stadium, the port and the airport.
- The furniture catalogue took the money and dropped the piece at a random spot in the home, and its sofa, bed and television were each a plain green box.
- Two street-door tests and three phone tests sampled or pressed before the thing they tested had finished moving. The game was right; the tests now wait for it.
