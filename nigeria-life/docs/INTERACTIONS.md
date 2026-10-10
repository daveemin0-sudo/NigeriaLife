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

## Actors

An `Actor` wraps a character body (the player or any NPC) so the same steps drive both.
While `actor.scripted` is true the character's usual owner must leave the body alone
(see the early returns in `Player.update`, `InteriorNPCMesh.update` and `NPCs.update`).
Register an actor under the id of the object the player clicks, and it can be waved at.

Poses are two layers that combine: legs (`stand`, `walk`, `sit`) and arms (`rest`, `swing`,
`wave`, `eat`, `carry`, `reach`, `talk`). Add a pose in `Poses.ts`.

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
