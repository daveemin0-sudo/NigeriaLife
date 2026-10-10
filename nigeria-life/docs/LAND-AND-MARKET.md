# City plan, land, building and the player market

How NigeriaLife decides what ground is for, who owns what, and how things change hands.

## What is kept apart

| Thing | What it is | Where it lives |
| --- | --- | --- |
| Zone | A carriageway or a walkway. Nothing is built on one. | `world/plan/CityPlan.ts`, from `world/density/StreetLayout.ts` |
| Plot | A parcel of land with a fixed id and boundary. | `realestate/PlotCatalogue.ts` |
| Title | Who owns an asset now, and everyone who has. | the registry |
| Building | A structure on a plot, going up or finished. | the registry |
| Listing | An owner's asking price for one asset. | the registry |
| Negotiation | One buyer and the seller trading offers on a listing. | the registry |
| Sale | A completed transfer of money and title, recorded once. | the registry |
| Vehicle | One particular machine: model, plate, mileage, condition. | the registry |

A plot never moves and never changes shape. A building can be built, sold with its plot,
pulled down and replaced without the plot or its history changing.

## The city plan

`CityPlan.ts` holds the streets as zones and checks the city against five rules:

1. no building on a carriageway, and every road keeps a clear lane (a checkpoint may take one lane, never the road);
2. every walkway keeps a clear way through along its whole length: 2 m on Broad Street, 1.2 m on back streets. Stalls, bins and bus stops are allowed as long as that way stays open;
3. buildings do not overlap;
4. every door and destination can be walked to from the street;
5. every planned street was actually laid.

`world.validateCityPlan()` returns the violations (an empty list is a pass). It reads what is
really standing in the scene: hand-built landmarks and districts, the generated streets, street
furniture, and players' buildings. `world.planInput()` gives the raw zones, obstructions and doors.

Two tags let a mesh opt out of the scan: `userData.surface = true` for things that are part of
the ground (a speed bump), and a name starting `facade_` for trim fixed to a wall (awnings,
cornices, canopies).

The generated city (`CityFabric`) already avoided roads through its occupancy grid. It now also
leaves every plot empty, keeps a street's line reserved even where it could not be laid, and
lets a street pass under an overhead canopy.

`tests/e2e/plan.mjs` asserts the city passes, and that each rule fires when broken on purpose.
`tests/e2e/_planmap.mjs out.png` draws the plan from above.

When the validator was first run on the city it found 30 faults, all fixed at source:
the CMS tower stood in Broad Street; the UNILAG senate tower stood on the pavement and through
the pharmacy; the CcHub covered the pavement; three apartment blocks stood inside other
landmarks; four shops overlapped their neighbours; the hospital, police and airport entrances
were inside their own walls; the Lekki bridge cut Kakawa Street; speed bumps lay along the
road instead of across it; back-street stalls left less than 1.2 m of pavement.

## The registry

`realestate/Registry.ts` is one document in the browser's storage, shared by every player in
that browser. All ownership lives there; a player's own saved game holds their money and
nothing about who owns what.

Every change goes through `Registry.transact(change)`, which takes a cross-tab lock
(`navigator.locks`), reads the document fresh, lets `change` check and alter it, and writes it
back. A change that returns `{ ok: false }` writes nothing. Money is taken inside the same
step, through `BackendService.processTransaction`, so a title never moves without its payment.

**This is not a server.** It makes trading between players on one computer correct: no asset
gets two owners, no sale is paid twice. It is not secure: anyone at the computer can edit
browser storage, and players on other devices do not share it. Real multiplayer ownership
needs a server that holds this document and runs these same checks. The functions are written
as "take the state, check it, change it in one step" so they can be moved to one.

### Players

A tab plays as the local profile named in `?player=<name>` (default `main`, which uses the
storage keys the game always used). Each profile has its own saved game, character and quests
(`backend/Profile.ts`). A player's id is `local:<profile>`. Two tabs on the same profile are
the same person and mirror each other.

## The market (`realestate/AssetMarket.ts`)

- `buyFromState(asset)`: first sale of something nobody owns, at the state's price.
- `list / editListing / withdraw`: only the owner. Listing sells nothing.
- `offer / counter / reject`: a buyer has one negotiation per listing. Only the side whose
  turn it is can counter or accept.
- `accept`: marks the negotiation agreed and the listing `pending`, which holds the asset for
  that buyer. If the buyer accepted, the sale completes at once.
- `complete`: runs in the buyer's game, because that is where the buyer's money is. It checks
  again that the listing is still held for this negotiation, the seller still owns the asset,
  no sale is already recorded, and the buyer can pay. Then it debits the buyer, moves the
  title, records the sale and sets aside a payout for the seller. If any check fails the
  negotiation is marked `failed`, the listing reopens and nothing moves.
- `settleMine`: on start-up and whenever the registry changes, a game pays for anything a
  seller has agreed to sell it and collects any payout it is owed. Payouts are claimed once.
- `release`: a seller lets a buyer go if the payment never comes.

The seller receives the price less a 2% fee (`SALE_FEE_RATE`).

A new kind of asset joins the market by supplying an `AssetProvider`. Land and vehicles do.

## Land (`realestate/Land.ts`, `PlotCatalogue.ts`)

Sixteen plots, each fronting a named street. Prices come from one table of in-game naira per
square metre by district (`LAND_PRICE_PER_SQM`). They are game prices, not valuations.

Status is derived, never stored: available, owned, listed, negotiating, reserved, building, developed.

## Building (`realestate/BuildingCatalogue.ts`)

One table of designs drives footprint, height, cost, build time, permitted use, income and
upkeep. `Land.cannotPlace` applies the plot's rules and then `CityPlan.cannotBuild`: inside the
boundary, 1 m back from it, off every zone, clear of other buildings.

`startBuilding` takes the cost once and records the project. Work advances with the game clock
while the owner is in the game, through cleared, foundation, structure, exterior and finished;
`PlotWorld.raise` draws every design at every stage from the table. Stopping work refunds half
of the cost of the work not done; demolition costs a tenth of the build cost.

Finished buildings earn `incomePerDay - upkeepPerDay` per game day, held for up to seven days
and collected by the owner. A finished house, duplex or apartment block counts as a home.

## Vehicles (`realestate/Garage.ts`, `OwnedVehicles.ts`)

The dealer makes a new vehicle, registers it to the buyer and takes the price in one step.
A vehicle exists in a player's world only while the registry says it is theirs, so a sold
vehicle disappears from the seller's street (and they are put out of it if driving).

## Not built yet

- A server: see above. Everything here is one browser.
- Other players' vehicles and plot interiors are not shown live in the world; plots and
  buildings are, because they come from the shared registry.
- Renting a building to another player; staff and stock for commercial buildings.
- The older apartments and businesses in `BackendService` are still per-save and are not on
  the player market.
- Plots in Abuja and Port Harcourt, and a Banana Island district (the price band exists, the
  place does not).
