# Visible interactions and doors

How the game shows an action happening in the world instead of announcing it. Code lives in
`src/interactions/`; the buka (`src/interiors/buka/`) is the worked example.

## The one primitive

Every visible action is the same five beats:

1. walk to a point (around furniture, if the room has a floor map)
2. turn to face the target
3. play an animation
4. apply the game effect part-way through the animation
5. finish cleanly and hand control back

An action is described as data (`InteractionDef` in `InteractionDirector.ts`): the actor, where
to stand, what to face, which animation, for how long, what it requires, and its effect.
`InteractionDirector.get().perform(def)` runs one; pass an array to run several as one scene.
Longer scenes that need waiting ("until the customer is seated") build a `Sequence` from
`steps.*` and `director.stepsFor(def)`.

Rules the system enforces, so individual actions do not have to:

- An effect runs at most once, and only if its animation actually reaches that moment.
- A sequence always ends exactly once (`done`, `cancelled` or `failed`) and its `onEnd`
  handlers always run. Put clean-up there.
- A walk that cannot finish either fails the sequence or snaps to the destination
  (`ifStuck`), and any sequence running longer than `maxSeconds` is failed. Nobody stays frozen.
- The player can break out of any sequence that is not `locked()` by moving or clicking.
  Doorways are locked; everything else is not.
- Seats and standing spots are claimed with `director.reserve(spot, actor)`.
- A sequence marked `asCasual()` (an answering wave, a word of welcome) can be dropped for
  anything else. `actor.engaged` is true only for real work, so small talk never pulls a
  waiter off a delivery but is not refused because someone was mid-wave.
- A sequence with `closeUp = true` moves the room camera in on the player while it runs.

## Actors

An `Actor` wraps a character body (the player or any NPC) so the same steps drive both.
While `actor.scripted` is true the character's usual owner must leave the body alone
(see the early returns in `Player.update`, `InteriorNPCMesh.update` and `NPCs.update`).
Register an actor under the id of the object the player clicks, and it can be waved at.

Poses are two layers that combine: legs (`stand`, `walk`, `sit`, `lie`) and arms (`rest`,
`swing`, `wave`, `eat`, `carry`, `reach`, `talk`, `greet`, `shake`). Add a pose in `Poses.ts`.
Something in the player's hands stays held while they walk about freely (`holdCarriedItem`).

`actor.hold` pins someone in place between sequences (a seat). Whatever sets it supplies
`release()`, which is what runs when the player moves off.

## Doors: the same for every place

`InteriorManager.enterThroughDoor` and `leaveThroughDoor` walk the player to the door, open
it, walk them through, and bring them out of the same door on the other side.

- Every interior already has a hinged exit door (`InteriorPrefabs.createExitDoor`).
- A street building gets one by building a `HingedDoor` and pushing a `StreetDoor`
  (`buildingId`, `outside`, `inside`) onto `Buildings.placeDoors`. That is all: the interior's
  street entrance and the map's arrival point follow the door. See `buildMamaPutBuka`.
- A building with no street door yet falls back to the plain fade.

## Adding a place like the buka

1. Give the street building a door (above).
2. In the interior template, expose `nav` (a `NavGrid` with the furniture blocked) and,
   if it runs anything, `onPlayerEntered` / `onPlayerLeft`. Stop everything in `onPlayerLeft`.
3. Describe what happens there as interaction data and sequences.
4. Add a suite under `tests/e2e/` that plays it. `advance(page, seconds)` and
   `playUntil(page, test)` run the game forward without waiting for frames to be drawn.

## Second example: home

`src/interiors/home/HomeLife.ts` uses the same pieces for the apartment: the compound's
rolling gate is its street door (`SlidingGate`, any `Doorway` works), the bed uses the `lie`
pose and a hold, the sofa a `sit` hold, and the fridge and bath are plain `InteractionDef`s.
What an activity gives arrives while it runs (`update`), so stopping early keeps what was earned.

## Money and goods change hands in one moment

Whatever is being bought, the charge and the goods land in the same `moments` callback, at the
point in the animation where the thing is handed over, guarded by a flag so it can only happen
once. Before that moment nothing is owed and nothing is owned, so walking away, running out of
money or closing the game leaves the books straight without any undo.

- Buka: charged when the plate is set down (`putPlateDown`).
- Supermarket: charged when the cashier hands over the bag (`ShopService.handOver`). What is
  in the basket is not in the inventory; leaving with it puts it back on the shelves.
- Street sellers: charged when the customer takes the thing from the seller's hand
  (`buyFromVendor` in `world/StreetVendors.ts`). Add a seller by adding an entry to
  `STREET_VENDORS` under the id of the person the player clicks.

## Third example: the supermarket

`src/interiors/shop/`: `ShopCatalog.ts` is what is sold, `ShopProps.ts` the shelves, basket,
bag and till, `ShopService.ts` the logic. One sequence runs the whole till with two actors in
it (the customer and the cashier), so either can be seen acting and the player moving off
cancels it for both. `service.layout` says where everything stands; tests read it.

## People

`interactions/Social.ts`: `waveAt`, `greet`, `shakeHands`, `chatWith`. Each is acted out by
both people, and the other person's answer depends on `standingWith(actor)`, which comes from
`BackendService.familiarity(actor.id)` (0 to 100, saved). Meeting someone counts toward it
once per kind of contact every 20 game seconds. `cannotShakeHands` says why not (seated, a
counter in the way) and the card hides the button then.

Another player online is not an `Actor` anyone here may direct. A gesture toward them is made
locally (`gestureToward`) and announced with `NetworkManager.sendSocial`; the pose itself
travels in the normal state packet (`PlayerNetState.pose`), and `RemotePlayer` shows it with
the same body and pose code as everyone else.

## Stations inside buildings

Any station whose id matches `HUD.ACTED_OUT` is used by walking up to it, facing it and
reaching or talking; what it does happens part-way through (`HUD.actOut`). The ATM, bank desks,
hospital, police, university and airport stations all go through this. Tests that click a
station's button must run the game on a little (`useStation` in `tests/e2e/lib.mjs` does).

## Seeing into rooms

`interiors/RoomCutaway.ts` looks after the view indoors. It lowers the outer walls on the
camera's side, turns see-through anything at least 1.4 m tall that comes between the camera and
the player, and hides what is hung on a wall that has been cut. Everything eases, lingers a
moment so it cannot flicker, and is put back exactly on leaving. A room needs nothing special:
any direct child of the interior's group is treated as one piece. `interiorManager.cutaway.state()`
shows what is cut or faded right now.

Free walking with the keys is stopped by furniture wherever the room has a `nav`
(`InteriorManager.keepOffFurniture`).

## Pointer and wheel

`game/PointerScope.ts` owns the only wheel listener. A wheel turn over the 3D view goes to
whatever registered with `PointerScope.onGameWheel` (street camera, map); anywhere else it
scrolls the nearest scrolling panel under the pointer and nothing behind it. Ask
`PointerScope.isGameView(event.target)` before treating a click or drag as aimed at the world.

## Testing without the dev server reloading under you

The dev server reloads open pages when a source file changes, which wrecks a test run in
progress. To test while still editing, build a frozen copy and serve it:

    npx vite build --outDir <somewhere outside the repo> --emptyOutDir
    npx vite preview --outDir <the same place> --port 4199 --strictPort
    GAME_URL=http://localhost:4199/ npm run test:e2e

Tests reach game modules through `window.game.modules`, which works the same on both.

## Dressing a street building

`world/FacadeKit.ts` turns a plain block into a building: `dressBuilding(group, { style, facing,
accent, ... })` finds the group's largest box and adds a painted lower band, floor bands, corner
piers, framed windows, and what suits the style (`bank` portico, `shop` awning, `flats`
balconies and stair screen, `house` porch, `eatery` bench and menu board), plus a parapet roof
with a tank and a dish. Everything it adds is baked into two meshes, so a dressed building
costs two draw calls. The instanced city behind the street gets its variety from
`CityFabric.createFacadeTexture`, which draws two bays by two floors per building type.
