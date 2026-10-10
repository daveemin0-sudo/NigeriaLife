# City plan, land, building, the player market and the world server

How NigeriaLife decides what ground is for, who owns what, and how things change hands.

## What is kept apart

| Thing | What it is | Where it lives |
| --- | --- | --- |
| Zone | A carriageway or a walkway. Nothing is built on one. | `world/plan/CityPlan.ts`, from `world/density/StreetLayout.ts` |
| Plot | A parcel of land with a fixed id and boundary. | `realestate/PlotCatalogue.ts` |
| Title | Who owns an asset now, and everyone who has. | the registry |
| Building | A structure on a plot, going up or finished. | the registry |
| Tenancy | A finished building offered to let, or let, to another player. | the registry |
| Listing | An owner's asking price for one asset. | the registry |
| Negotiation | One buyer and the seller trading offers on a listing. | the registry |
| Sale | A completed transfer of money and title, recorded once. | the registry |
| Vehicle | One particular machine: model, plate, mileage, condition. | the registry |

A plot never moves and never changes shape. A building can be built, sold with its plot, let,
pulled down and replaced without the plot or its history changing.

## The city plan

`CityPlan.ts` holds the streets as zones and checks a city against five rules:

1. no building on a carriageway, and every road keeps a clear lane (a checkpoint may take one lane, never the road);
2. every walkway keeps a clear way through along its whole length: 2 m on Broad Street, 1.2 m elsewhere. Stalls, bins and bus stops are allowed as long as that way stays open;
3. buildings do not overlap;
4. every door and destination can be walked to from the street;
5. every planned street was actually laid.

`game.validateCity(city)` returns the violations for Lagos, Abuja or Port Harcourt (an empty
list is a pass). It reads what is really standing in the scene: hand-built landmarks and
districts, the generated streets, street furniture, and players' buildings. `zonesFor(city)`
gives the zones of a city and `game.standingIn(city)` what stands in it.

Two tags let a mesh opt out of the scan: `userData.surface = true` for things that are part of
the ground (a speed bump), and a name starting `facade_` for trim fixed to a wall. A mesh
drawn with a fully transparent material (a box that only marks where to click) is ignored.

In Abuja the plan found Shehu Shagari Way running on under Aso Rock, through the lookout
platform: the avenue now stops at the lookout, and has pavements. In Port Harcourt the transit
terminal's entrance point was in the middle of the building.

The generated city (`CityFabric`) leaves every plot empty, keeps a street's line reserved even
where it could not be laid, and lets a street pass under an overhead canopy.

`tests/e2e/plan.mjs` asserts the city passes, and that each rule fires when broken on purpose.
`node tests/e2e/_planmap.mjs out.png` draws the plan from above.

When the validator was first run it found 30 faults, all fixed at source: the CMS tower stood
in Broad Street; the UNILAG senate tower stood on the pavement and through the pharmacy; the
CcHub covered the pavement; three apartment blocks stood inside other landmarks; four shops
overlapped their neighbours; the hospital, police and airport entrances were inside their own
walls; the Lekki bridge cut Kakawa Street; speed bumps lay along the road; back-street stalls
left less than 1.2 m of pavement.

## The registry

`realestate/Registry.ts` is one document holding all ownership. A player's own saved game holds
their money and nothing about who owns what.

Every change goes through `Registry.transact(change)`: take the lock, read the document
fresh, let `change` check and alter it, write it back. A change that returns `{ ok: false }`
writes nothing. Money is taken inside the same step, and the player's account is checkpointed
first: if the document then cannot be saved, the account is put back as it was.

Where the document lives:

- **No server (the default).** In the browser's storage, shared by the players in that
  browser, locked across tabs with `navigator.locks`.
- **With the world server.** On the server, shared by every device connected to it, locked
  by the server.

### Players

Without a server, a tab plays as the local profile named in `?player=<name>` (default `main`,
which uses the storage keys the game always used). Each profile has its own saved game
(`backend/Profile.ts`) and the id `local:<profile>`. Two tabs on the same profile are the same
person and mirror each other.

On a server, each device's player gets an id made once and kept (`net:<uuid>`).

## The world server (`server/world-server.mjs`)

    npm run server                              # port 8787, registry in server/data/
    PORT=9000 NL_KEY=secret npm run server      # another port, and a room key

Then on each device either open the game with `?server=http://<host>:8787` (add `&key=secret`
if there is one) or enter the address in the phone's Settings. `?server=off` goes back to
playing in the browser alone.

It does two things: it holds the registry and hands out the lock on it, and it relays
movement, chat and private messages so players on different devices see each other. It has no
dependencies beyond Node.

**What it is not.** It does not run the game's rules or hold money; the games do. Anyone who
can reach it (and knows the key, if set) can write to the registry. It is for playing with
people you trust on a home or office network. It is not hardened for the public internet,
and a public game needs a server that also applies the rules and keeps the accounts.

A player who joins a server brings what they own in the browser's own registry
(`realestate/Carry.ts`): their plots, the buildings on them as they stand, and their vehicles.
A plot that already has an owner on the server stays behind in the browser. What comes across
is removed from the browser's registry, so it exists in one world. Homes and businesses in the
saved game are claimed on the server the same way, if they are free there.

`tests/e2e/server.mjs` starts a real server and drives two separate browsers against it.

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

The seller receives the price less a 2% fee (`SALE_FEE_RATE`). A kind of asset joins the
market by supplying an `AssetProvider`: land, vehicles, homes and businesses do.

## Land (`realestate/Land.ts`, `PlotCatalogue.ts`)

29 plots: 20 in Lagos (four of them on Banana Island), 5 in Abuja, 4 in Port Harcourt, each
fronting a named street. Prices come from one table of in-game naira per square metre by
district (`LAND_PRICE_PER_SQM`). They are game prices, not valuations.

Status is derived, never stored: available, owned, listed, negotiating, reserved, building, developed.

## Building (`realestate/BuildingCatalogue.ts`, `WorldClock.ts`)

One table of designs drives footprint, height, cost, build time, permitted use, income and
upkeep. `Land.cannotPlace` applies the plot's rules and then `CityPlan.cannotBuild`: inside the
boundary, 1 m back from it, off every zone, clear of other buildings.

`startBuilding` takes the cost once and records when work began. Nothing else is stored: how
far along a building is, whether it is finished and what it has earned are worked out from
that time (`WorldClock.ts`), so work goes on whether or not the owner is playing and every
player sees the same stage. A game hour of work is 25 real seconds. `PlotWorld.raise` draws
every design at every stage from the table. Stopping work refunds half of the cost of the
work not done; demolition costs a tenth of the build cost.

Finished buildings earn `incomePerDay - upkeepPerDay` per game day, held for up to seven days
and collected by whoever is running the building. A finished house, duplex or apartment
block is a home.

## Letting (`Land.offerToLet`, `payRent`, `stopLetting`, `leaveTenancy`)

An owner offers a finished building at a weekly rent (a week is seven game days). A tenant
pays a week in advance; the rent is set aside for the owner as a payout. The tenant lives
there (a home) or runs it and collects its takings (a business). A tenant's game pays the next
week when the current one is nearly up. An owner can give notice: the tenant stays for what is
paid and cannot renew. A let building cannot be pulled down.

## Homes and businesses bought outright (`realestate/Deeds.ts`)

The apartments, houses and businesses in `BackendService` are bought from the open market in
the player's own game as before. Buying one outright now claims a title in the registry, so
only one player can own each, and it can be listed and sold to another player. `Deeds.reconcile`
keeps the saved game and the registry in step: it claims titles for what the game holds, gives
the game what the registry says the player has bought, and takes back what they have sold. If
two players buy the same one at the same instant, the second is refunded. A lease from a
landlord is not ownership and stays in the tenant's own game.

The upgrades installed in a business are kept in the registry beside its title (`fittings`),
so they are sold with it: the buyer gets them, and the seller's copy goes back to a bare one.

## Vehicles (`realestate/Garage.ts`, `OwnedVehicles.ts`)

The dealer makes a new vehicle, registers it to the buyer and takes the price in one step.
Every parked vehicle is shown to everyone where its owner left it, under the owner's name,
and only the owner can get in. Selling it puts the seller out of the seat at once.

A driver's game sends where their vehicle is with their own position, several times a
second, and `multiplayer/VehicleSync.ts` moves the same vehicle in everyone else's game. That
covers the city's own vehicles as well as owned ones. While someone is at the wheel nobody
else can get in, and their body is not drawn separately.

## Not built yet

- A server that applies the rules and holds the money (see "What it is not" above).
- Two players getting into the same city vehicle in the same instant are not arbitrated: each
  drives their own copy until one gets out.
- Staff and stock for buildings; rent between players for the older apartments.
- Furniture placed in a home does not go with the home when it is sold.
