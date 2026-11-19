# Interior quality audit (Nov 2026)

Concise gap report before the interior overhaul. Do not clone Lagos Life / Vatar assets.

## Architecture to reuse (do not duplicate)

| System | Role |
|---|---|
| `InteriorManager` | Enter / exit / doors / cutaway / nav |
| `PlaceInterior` + `PLACE_SPECS` + `PlaceActions` | Scalable city places |
| `ResidentialInterior` + `HouseDecorationSystem` + `FurnishBar` | Home layout, decorate, persist |
| `HomeLife` / `Fridge` / `HomePower` | Sit, sleep, eat, bath, NEPA |
| `InteriorPrefabs` / `FineFurniture` / `CityDress` | Shared shells and city dress |

## What exists

**Named Lagos hubs (unique templates):** residence, restaurant (Mama Put), shop, club, airport, bank, hospital, police, UNILAG.

**~100 PlaceSpec interiors:** Lagos roadside density; Abuja/PH landmarks; `townRooms` with 3 layout variants per kind per city (not literal clones).

**Home loop (richest):** sit, sleep, TV, fridge stock/eat, bath, decorate (localStorage), stairs, power, garden, pets.

## Quality gaps (by impact)

1. **Home cook is free “Party Jollof”** — does not consume fridge stock; kitchen loop feels fake next to shopping.
2. **Bank / hospital / police / UNILAG** — enterable but thin geometry; interactions still HUD if-else, not PlaceActions.
3. **`def.ambientLight*` unused** — InteriorManager never applies ambient from defs.
4. **Abuja/PH landmark depth** thinner than Lagos Balogun / Mama Put.
5. **Furniture not in SaveSchema** — browser localStorage only (known roadmap item).
6. **Town offices/shops** often open phone apps rather than deep in-room play.

## City identity

Lagos hubs are unique. Abuja/PH use PlaceSpecs + CityDress palettes. Same `ResidentialInterior` worldwide for owned/rented homes — street fabric differs by city.

## Controlled increments (this effort)

1. Residential: cook consumes fridge food; clearer kitchen feedback.
2. Apply interior ambient lighting from defs on enter.
3. Bank + police visual densification (props, waiting areas) without new managers.
4. Residential presentation (reuse ResidentialInterior + HouseDecorationSystem):
   - Dark timber door / entrance frames for readable room divisions
   - Teal curtained burglar-proof windows
   - Black-and-white checkered bathroom/ensuite floors
   - Wider shell framing + warmer ambient fill
   - Aerial dollhouse camera (pitch ~1.42) + RoomCutaway stub walls when high
   - View picker **Home** (isometric cutaway) for whole-house inspection
5. Demo e2e: `homelayout` (Lekki duplex exterior → aerial → rooms → walk → exit) + `cookhome`
4. Tests for cook + enter/exit.

Deferred: full PlaceActions migration of bank/hospital; furniture cloud save; every townRoom redesign.

## Acceptance for each increment

Player can enter/leave; layout reads as a place; intended interactions work; decoration/fridge persist; `tsc` clean; e2e for the new path.