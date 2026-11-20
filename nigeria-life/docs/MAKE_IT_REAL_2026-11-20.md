# Make it real — the 20 November 2026 list

The owner's list after playing the new character models (PR #45). The bar is Lagos Life's latest: everything looks and behaves like the real thing, and nothing glitches. Work goes top to bottom, one commit per item, each shown with a picture. Status: `todo`, `doing`, `done (commit)`.

## A. People

| # | Item | Status |
|---|------|--------|
| A1 | Everyone slimmed to normal Nigerian builds: men strong but not bulky (no superhero arms, chest, thighs), women a little slimmer | done (aafc636): build slims arms, thighs, chest, back, waist, neck; Posture.ts brings shoulders and hips in |
| A2 | Normal stance and walk: feet under the hips, arms relaxed at the sides, no superhero posture | done (aafc636): legs under the hips, arms by the sides, hands open, over every upright clip |
| A3 | Standing still means still: the player's legs stop moving when not walking | done (4479306) |
| A4 | The old look is gone at every distance: far-away people are the new model too (no swapping as they come near and go) | done: BakedPeople draws everyone beyond the nearest few as the low-detail model; the old figures are never drawn (street crowd, named characters) |
| A5 | Shopkeepers and people inside buildings on the new model; workers in their work clothes | done: StandIns draws every procedural person (shops, bukas, hotels, airport, staff, events, riders) as the models, sitting where seated |
| A6 | A body size choice in the look editor (slim, medium, big) | todo |

## B. Nothing sinks, nothing passes through

| # | Item | Status |
|---|------|--------|
| B1 | Feet on every raised pavement in every city (Broad Street done in d631aef; the expressway and the rest still sink) | done: groundAt() knows Broad Street, side streets, expressway pavements and forecourts; the player stands on them |
| B2 | Parked cars and bikes half up on the kerb stand on it, not in it | done: parked and drivable vehicles stand on the ground under them, tilted half up a kerb |
| B3 | Broad Street fuel pumps stand on the forecourt, not in it | done: pumps on the forecourt |
| B4 | The train bridge pillars are out of the expressway's fast lane (cars stopped on them) | done: columns no wider than the median barrier |
| B5 | End of Broad Street: pedestrians on the road, cars driving through buildings | doing: traffic U-turns at the end of Broad Street instead of driving into the buildings |

## C. Street details

| # | Item | Status |
|---|------|--------|
| C1 | Expressway parking cut-outs bigger, and not all of them taken | done: lay-bys 16 m long and 3 m deep, about a third with a car |
| C2 | Bus-shelter benches can be sat on | done: Sit down and rest (Energy +8) |
| C3 | Billboards show the whole advert on both faces | done: the boards were angled 0.18 rad into their own frame; now flat on it |
| C4 | Prettier buildings: more colour and paint, nicer banners | todo |
| C5 | Real trees and flowers where a city would have them | todo |
| C6 | Big empty spaces become water or green fields, never blank ground | todo |
| C7 | Broad Street as wide as the expressway (large change: lanes, pavements, buildings, tests) | todo |

## D. Water and Apapa

| # | Item | Status |
|---|------|--------|
| D1 | Water that looks like water (waves, movement, light), everywhere water is | todo |
| D2 | Apapa: everything behind the quay is sea; nobody walks on the water | todo |
| D3 | Ships are solid (entered only where allowed) and look real | todo |
| D4 | A real working port: cranes lift and set down containers of many colours (no mid-air drops), trucks come in and leave, workers in work clothes, a working gate | todo |
| D5 | Boats on the lagoon by Third Mainland Bridge: canoes, ships, log rafts | todo |

## E. Interiors and things

| # | Item | Status |
|---|------|--------|
| E1 | Furniture that looks like furniture (wooden benches, chairs, tables), not boxes | todo |
| E2 | Mama Put: real pots, steam rising from the food | todo |
| E3 | Airport with departments: check-in, security, bureau de change, departures, arrivals, signs, staff, pilots | todo |
| E4 | Offices and hotels with people working and waiting | todo |
| E5 | Real food on the plate: jollof rice and turkey, egusi; the fridge serves real dishes | todo |
| E6 | Travel bags for the player when flying | todo |

## F. Private jet

| # | Item | Status |
|---|------|--------|
| F1 | The private jet looks as good as the airliner | todo |
| F2 | A full journey: boarding, cabin, take-off, flight, landing, as for an airline flight (not a 3-second jump) | todo |
