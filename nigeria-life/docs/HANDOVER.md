# NigeriaLife handover (9 November 2026)

What is live, what was done in the last few days, what is unfinished or unverified, and how to
work on the game safely. Written for whoever picks up the code next (Cursor), and for the owner.

## Where things stand

| | |
| --- | --- |
| Working branch | `claude/next-steps` (PR #7). Every commit below is on it. |
| Live game | GitHub Pages builds from **`stabilise-core`**: https://daveemin0-sudo.github.io/NigeriaLife/ . Live build: `149798d`. |
| World server | Render, auto-deploys from `stabilise-core`: https://nigerialife-server.onrender.com/health (it answers 502 for a minute or two while it redeploys) |
| How to publish | `git push origin claude/next-steps:stabilise-core` (a fast-forward). Phones then show "A new version is ready" (`src/app/Updates.ts` reads `version.json`). **Pushing only to `claude/next-steps` does NOT update the live game.** That is why the owner's phone showed no updates for days. |
| Checklist | `docs/ROADMAP.md`, the phases and their status |

## Done, 6 to 8 November (all live)

- **Duplex homes with an upstairs; street racing (Racing app)** (`86524dc`)
- **Abuja and Port Harcourt as whole grid cities** (`8fd749d`): `src/cities/*`, `src/world/plan/GridRoads.ts`
- **Phone layout** (`acb9c96`, `87e2641`, `fe7400f`)
  - `src/ui/theme/phone.css` is loaded **last** (`src/main.ts`), so it beats `luxe.css` (equal specificity and loaded later, `luxe.css` used to win).
  - Laid out for screens down to 316 px wide. A Samsung set to larger text zooms the page that far: test at that width.
  - The Hide button (`src/ui/CleanView.ts`), the folded room card, slim toasts (`src/ui/GameToast.ts`), and every window as a full-width sheet.
  - The map search is an icon until tapped; the in-game phone fills the screen.
- **Homes**
  - "Go inside" on a plot's page opens that plot's house. The button used plain quotes, so its id was literal code text.
  - In a room, a drag turns the view, a click on a spot walks there, and the arrow keys walk.
- **The bed's own duvet covers the sleeper** (`src/interactions/Duvet.ts`); **a real standing fan** (`fineFan` in `src/housing/FineFurniture.ts`).
- **Doors in Abuja and Port Harcourt** (`625a9b5`)
  - Every shop, office, hotel, bank and market has a door: `townDoors` in `src/cities/CityExtras.ts`. Abuja has 128.
  - Each door leads to one room per kind per city (`townRooms` in `src/interiors/places/PlaceSpecs.ts`), and the player comes back out at that same door.
- **Rides and vehicles**
  - A ride ends at the place's door: `Game.doorOf`, used in `arriveAt`.
  - The player's own car is offered only in the city where it is parked (`OwnedVehicles.ownCar`).
  - The taxi ride scene matches the city (`RideStreet(city)`).
  - The private jet can be flown from the flights terminal in any city (`Game.flyJetFrom`; card in `InterStateModal`).
- **Any fridge in any home opens on its contents** (`ResidentialInterior.openFridge`).
- **Photo mode fits a phone** (`149798d`).

## Not done (the owner asked for these)

1. **Driving still jerks on the phone.** Not reproduced in tests and not fixed.
   - Look at the chase camera in `src/game/Camera.ts`, around lines 476 to 545. It is smoothed twice (`cameraVehYaw`, then `vehCamOffset`) with lerps that depend on frame time, which can stutter at low and uneven frame rates.
   - Also look at the car's checked half-metre steps and the kerb slide in `src/world/DrivableVehicle.ts` (`KERB_SPEED`, `onTheRoad`).
   - Measure it on a real phone or a throttled CPU: log car and camera position each frame.
2. **A bought generator (Mikano) stands inside the house.** It should stand outside: in the compound for a built house, beside the front for a rented flat. Generators are catalogue items with `use: 'power'` (`src/housing/FurnitureModels.ts`, `HouseDecorationSystem`).
3. **A full play-through as a player, fixing the small things.** The owner's words: "check everything... the look, the interactions, the text, the borders, the colour". Compare against Lagos Life. Not started.
4. Older open items are in `docs/ROADMAP.md`: the look editor and characters, Phase 4 performance on cheap phones, hosting races for friends.

## Done but not fully checked (be honest with the owner about these)

- **Own jet from Abuja or Port Harcourt:** the button and its hook were checked. A flight was never flown end to end in a test.
- **Port Harcourt doors:** the same code as Abuja, but only Abuja's were tapped through on a phone screen.
- **The generic rooms:** one per kind per city, shared by every door of that kind, with generic names ("Supermarket", "Office block"). Not on the map, not searchable.
- **`Game.doorOf`** matches a place to a door by its name, within 400 m. Two places sharing words could pick the wrong door.
- **The ride scene per city** changes the scenery mix and traffic only. The shop signs are still Lagos signs.
- **The phone layout check (`phonefit`)** covers 21 surfaces upright at 316 px. Most phone apps were not checked with the phone on its side. The decorate category tabs run past the edge on purpose: they scroll sideways.
- **The cook's meals:** they go into the fridge of the home the cook works in. Not checked across several homes.
- **Touch steering:** no changes to the handling. The owner's "a small turn spins 360°" came from the 2 November build. Not reproduced since.

## How to run and test

- `npm run dev` (port 5173). The owner often plays there too.
- **Tests run against a frozen build, not the dev server.**
  1. Build: `npx vite build --outDir <dir>`.
  2. Serve: `npx vite preview --outDir <dir> --port 4205`.
  3. Run: `GAME_URL=http://localhost:4205/ node tests/e2e/run.mjs <suite> ...`. The suites are listed in `tests/e2e/run.mjs`.
- **Do not build while suites run.** Suites are slow on this laptop (Intel HD 620), and slower still while the owner has the game open. Under that load, failures like "Runtime.callFunctionOn timed out" or timing-sensitive checks (hotel, buka, the home gate) are flaky: run the suite again on its own before believing them.
- Relevant suites: `phonefit` (phone layout at 316 px), `touch`, `phonelife`, `phone`, `bigcities` (Abuja and Port Harcourt), `ownhomes` (several homes, including two built houses), `duplex`, `roadcraft` (driving and the home mouse), `steering`, `racing`, `plan` (city plan rules).
- **Test the way a player plays:**
  - Tap through the real screen (proximity prompt, then the card's button) on a phone viewport. Don't only call game functions directly: `bigcities` entered places through a shortcut and missed that most of Abuja had no doors.
  - Look at screenshots: a check on state alone has passed while a room was not even drawn.

## What the owner expects

- Lagos Life is the floor to beat: real-looking interiors, the car kept on the road, slim and simple cards.
- The phone comes first. Nothing on top of anything else, nothing too big.
- Every place can be entered and has real things to do.
- Every action is acted out in the world.
- Say exactly what was checked and what was not. The owner plays every change, and claims that turn out false cost trust.
