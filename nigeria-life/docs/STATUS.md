# NigeriaLife: what is built, what is not

This is the working inventory for the "Ultimate Master Upgrade" brief. It is kept up to date
as each phase lands. Nothing is called complete here because it compiles: a line says
"verified" only when a test drives it in the running game, and names the test.

Last updated: 2026-10-11, after the footbridge.

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
`GAME_URL=<url> node tests/e2e/run.mjs [suite ...]`. There are 24 suites.

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

## Phase 1: a real 3D world

| Area | Status | Notes |
| --- | --- | --- |
| Building kit and landmark contract | **Verified** | `landmarks` suite: each landmark is thousands of triangles in at most 24 meshes, and Lagos still passes the city plan with them in it. |
| Stadium, port, airport as architecture | **Verified** | See phase 2. |
| Generated streets (tenements, shops, towers) | **Partial** | Instanced and varied, with dressed fronts on the hand-built ones. Still box-bodied. Not yet rebuilt with the kit. |
| Bungalow, duplex, mansion, hotel, church, mosque, school, refinery, fuel station as kit assets | **Missing** | The kit exists; these have not been made with it. |
| Furniture that reads as furniture | **Verified** | Sofa (seat, back, arms, cushions), armchair, bed (frame, mattress, pillows, cover), television (screen in a frame on a console), bookshelf with books, wardrobe, lamp, freezer and inverter are built with the kit. The catalogue's sofa, bed and television used to come out as one green box. The home's own sofa and beds are dressed the same way. `furnish` suite checks every catalogue piece is a model, not a box. |
| The map of Lagos | **Verified** | The map is the city itself seen from above: its real ground, streets, buildings and landmarks, with district washes and pins added. Zooming in shows the real streets. Every pin stands over the real place (a landmark's middle, or the door a ride drops you at). The match and the aircraft carry on while it is open. `landmarks` suite. |
| The maps of Abuja and Port Harcourt | **Looks only** | Still the old miniature drawings, not drawn from those cities. |
| Clicking a building on the map | **Missing** | Places are chosen by their pins and by the district chips, not by clicking the building. |
| Map search, filters, route preview | **Missing** | |

## Phase 2: landmarks

| Place | Status | Notes |
| --- | --- | --- |
| Murtala Muhammed airport, outside | **Verified** | Terminal with kerbside canopy and car park, control tower with turning radar, apron, hangar, runway, ground equipment, fence. Two airliners in the made-up NigeriaLife Air colours. One works a whole flight: boarding, pushback, taxi, take-off, away, approach, landing, taxi in, arrived. Test: it keeps that order, never passes through a building, and is only ever airborne over the open ground west of the city. |
| Airport, inside | **Partial** | The hall is one room used by all three airports and carries the name of the one it is entered from. Its desk sells tickets and checks in, security clears, and the two gates lead out to the apron, each doing one step of a booking in order (see phase 3). The lounge is still a one-click purchase. No baggage claim. |
| Abuja and Port Harcourt airports | **Verified** | The same airport, from the same maker, set down in each city with a road of its own to the main avenue. Both cities still pass the city plan. `flights` suite. |
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
| Destination framework | **Partial** | Three pieces now work together. `PlaceActions`: any place registers what its own things do, and the card asks there, so a new place adds nothing to the HUD. `Hours`: a room that keeps hours cannot be entered outside them by any route, and its door prompt says so. `Landmark`: ground, gates, street doors, state. Still separate: `DestinationRegistry` keeps hours as text beside the real ones, and older places (bank 8 to 4, for one) do not enforce theirs. NPC roles, jobs and sound are not yet declared per place. |

## Phase 3: flights

| Area | Status | Notes |
| --- | --- | --- |
| Booking and fare | **Verified** | One booking (`travel/Flights.ts`). A ticket is bought at the airport's desk, or on the interstate sheet, for a flight from the city the player is in; the fare is taken once, and a second ticket cannot be bought while one is held. It can be handed back before check-in for four fifths. Kept per profile. |
| Through the airport | **Verified** | Check in at the desk (seat and gate), then security, then the right gate, in that order and no other; the gate leads out to the apron; the aircraft is held on its stand for a checked-in passenger (and comes straight back if it was away); the player walks up the steps and through the door. `flights` suite walks Lagos to Abuja to Port Harcourt and back. |
| Arrival | **Verified** | The player gets off at the foot of the steps on the destination's apron, goes into the terminal and out of its front door into that city. A flight interrupted by closing the game still arrives (`saves` suite). |
| Lifecycle states | **Verified** | Scheduled, boarding closed, taxiing, taking off, in flight, approaching, landing, arrived, cancelled, on the ticket, in order. |
| Aircraft cabin | **Partial** | The existing cabin view with a seat-back screen and three cameras. The seat on the ticket is shown. No crew, cabin service that is acted out, or choosing a seat. The aircraft seen outside is not the one seen from the cabin's outside camera. |
| Coaches | **Partial** | A coach is paid for on the sheet and goes by road. It can be taken from anywhere in the city: there is no coach park to leave from. |

## Phase 4: three cities

| Area | Status | Notes |
| --- | --- | --- |
| Free travel by map tab | **Verified fixed** | Choosing a city on the map now only shows that city's map. The player stays put, pays nothing, and the map goes back to their own city when closed (`landmarks` suite). |
| Abuja, Port Harcourt | **Partial** | One avenue each with a few landmarks; both pass the city plan (`plan` suite). Thin beside Lagos. |
| State carried between cities | **Verified** | Money, inventory, ownership, city and ticket are kept across the journey and across a reload (`flights`, `saves`). |
| What the screen shows in another city | **Partial** | The bar of nearby places is now the real nearest places of the city the player is in, with true distances, and pressing one walks there (it used to be five fixed Lagos shortcuts that jumped the player for nothing). Phone services and job listings are not yet per city. |

## Phases 5 to 11: systems

| Area | Status | Notes |
| --- | --- | --- |
| Interaction framework (walk, face, act, settle at the hand-over) | **Verified** | `buka`, `shop`, `home`, `social`, `actions` suites; now also the ticket booth and the loading bay. |
| Older one-click buttons | **Looks only** | Many street cards still pay or charge on a click with a dialog. Listed in `HUD.handleCardAction`. The stadium, port and nightclub ones are replaced; the nightclub's old branch there is now dead code. |
| Home: bed, sofa, fridge, bath | **Verified** | `home` suite. |
| Furniture buying and placing, wall colours | **Verified** | A piece is chosen in the catalogue and put down where the player wants it: shown see-through on a patch that is green or red, moved by a tap on the floor or the arrows, turned, and paid for when placed. It cannot go through a wall, on other furniture or across the way in. It can be picked up again for nothing and sold for half. People walk round it. Walls can be painted six colours. All of it is kept per profile and survives a reload. `furnish` suite. Still open: furniture does not go with a home when the home is sold; floors cannot be changed; pieces cannot be put on walls. |
| Clothing and appearance | **Partial** | The player's look can be changed and is saved. No clothes shops. |
| Television | **Verified** | The set on the wall and any set the player buys show a picture drawn several times a second: football (the match really being played at the National Stadium, same score), news and music. Channels are changed from the set or, when sitting, from the status line. Sofas and armchairs the player buys are sat on where they were put. `furnish` suite reads the picture and checks it changes. |
| Jobs | **Partial** | One real employer so far, Apapa Port (`jobs/Employment.ts`). The foreman states the terms and takes the player on; the loading bay is shut to anyone else; each lorry loaded is paid once at the rate of the grade reached (casual hand ₦6,000, dock hand ₦9,000 after three, gang leader ₦12,000 after eight) and counts for the career; the job shows in the phone's Jobs app, is kept across a reload, and can be left. `jobs` suite. The phone's other shifts are still timers started from anywhere, and the street gigs are still one click. |
| Land, building, market, letting | **Verified** | `land` and `server` suites: buy a plot, build, list, haggle, sell once. A race in which two tabs could both be sold the same plot was found and closed (see the faults below). |
| Phone (12 apps) and scrolling | **Verified** | `phone`, `scroll` suites. |

## Phase 12: roads, bridges, collision

| Area | Status | Notes |
| --- | --- | --- |
| City plan: roads clear, pavements walkable, nothing overlapping, doors reachable | **Verified** | `plan` suite, all three cities, nine Lagos streets. |
| Footbridge | **Verified** | Its two flights of stairs were built climbing away from the deck. They now climb from the pavement to the deck and arrive against it, as solid flights with a handrail, and the deck rail opens at each stair head. The player climbs, crosses above the road, comes down the other side, is held by the rails while up there, and walks under the bridge at street level like anyone else. `streets` suite. |
| Walking at height elsewhere (stadium rows, steps into buildings) | **Missing** | The footbridge is the one place the player leaves the ground. The stadium's upper rows are still out of reach. |
| Collision with buildings in the street | **Missing** | The player and vehicles pass through walls outdoors. Landmarks already report their footprints, ready for it. |
| Side-road junctions with Broad Street | **Partial** | Stadium Road and Wharf Road meet the Broad Street pavement without a dropped kerb. |

## Phases 13 to 16

| Area | Status | Notes |
| --- | --- | --- |
| Traffic, walkers, vendors, day and night, weather | **Partial** | All present. Opening hours are kept by the stadium and the nightclub only. |
| Multiplayer | **Blocked** | Players on one machine, or on a home or office network through `npm run server`, see each other and trade. The server does not run the rules or hold money, so this is for people who trust each other. A public game needs a server that does: not built. |
| Art direction and audio | **Partial** | One made-up airline, consistent on aircraft, hangar and departures board. Audio not reviewed. |
| Performance | **Partial** | Landmarks add about 50 draw calls in all. The start view is about 1,300 calls on the target Intel HD 620. Interiors are all built at start, not on demand. |

## Phase 17: the journeys

| Journey | Status | Notes |
| --- | --- | --- |
| A. Airport, booking to arrival | **Verified** | `flights` suite: map, terminal, ticket, check-in, security, gate, apron, steps, flight, Abuja apron, terminal, street; then Abuja to Port Harcourt and Port Harcourt to Lagos the same way. |
| B. Home | **Verified** | `furnish` and `home` suites: in, buy and place a sofa and a television, paint the walls, sit, football on, out, reload, still there. The bought bed is not yet slept in (the home's own bed is). |
| C. Property | **Verified** | `land`, `server`. |
| D. Workplace | **Verified** | `jobs` suite: map to the port, turned away, taken on by the foreman, four lorries loaded, paid by grade, promoted, on the phone, kept after a reload. One workplace; more are to be added the same way. |
| E. Landmarks | **Partial** | Port, airport, stadium, bank, hospital, university, nightclub: yes. Refinery: no. |
| F. City switching | **Partial** | By air it is verified both ways, and the free-travel hole is closed. Each city's own services and listings are not yet checked. |
| G. Spatial integrity | **Partial** | The city plan and the footbridge are verified. Buildings can still be walked through outdoors. |
| H. Multiplayer | **Partial** | Two accounts in separate browser contexts and through the world server are tested. That is not evidence of secure online play, and is not claimed as such. |

## What comes next, in the brief's order

1. The map: search and a route preview; the same real-city treatment for Abuja and Port Harcourt once those cities have more in them.
2. Finish the destination framework: real hours for every place that states them, and one record per place instead of two.
3. Travel: a coach park to leave from; cabin crew and service; baggage claim.
4. Collision outdoors: the player and vehicles still pass through buildings in the street. Every landmark and generated building already reports its footprint, so this is a matter of using them. Then stadium rows.
5. The home: sleeping in a bought bed, furniture on walls, floors, and furniture that goes with a home when it is sold.
6. More kit assets (houses, worship, hotels, refinery), then the same treatment for Abuja and Port Harcourt.
7. A server that runs the rules, if the game is to be public.

## Faults found on the way and put right

- The airport hall's two gates took ₦35,000 and ₦32,000, announced an arrival, and left the player standing in Lagos.
- A flight could be taken from anywhere by opening the interstate sheet, and choosing a city on the map moved the player there for nothing.
- The sheet's coach button looked its journey up by city alone, so it ran the flight to that city.
- The five shortcuts under the street view jumped the player across Lagos for nothing, showed made-up distances, and stayed on screen in other cities.
- Quilox sold a ₦25,000 bottle at any hour from a black box.
- Two games in one browser buying the same plot at the same instant could both be charged and one get nothing: localStorage reaches another tab a moment late, so the second buyer could read the registry as it was. The registry is now also kept in the browser's database and read from there while the lock is held. It showed up once in several full runs; a test now forces it.
- The footbridge's stairs were modelled rising away from the deck, with their top step twelve metres from it, and the code that lifts the player was written for stairs that were not there.
- The furniture catalogue took the money and dropped the piece at a random spot in the home, and its sofa, bed and television were each a plain green box.
- Two street-door tests and three phone tests sampled or pressed before the thing they tested had finished moving. The game was right; the tests now wait for it.
