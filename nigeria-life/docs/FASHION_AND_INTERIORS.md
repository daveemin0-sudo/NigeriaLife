# Fashion and interiors: the plan

The owner's brief (20 November 2026): a real clothing collection at the quality of the best open-world games, with our own designs and Nigerian fashion at its heart; a Boutique phone app; boutiques you walk into; a city of people dressed by who they are and where they are; and interiors that feel like real places. Clothing quality and interiors are separate milestones, and each stage is shown with pictures before the next one starts.

## What there is today

| Part | Today | What is missing |
|---|---|---|
| Bodies | Two skinned bodies (male, female) on one skeleton, everyday posture | Body sizes to choose from |
| Garments | Five shells cut from the body: short top, long top, long bottom, short bottom, shoes | Distinct shapes: collars, plackets, cuffs, hoods, pockets; jeans cuts; caps and hats; accessories |
| Fabric | A flat colour per garment, and a cloth sheen | Woven textures, denim twill, piqué, leather, prints, stitching, folds |
| Catalogue | 69 items in `WARDROBE_CATALOGUE` (`src/player/CharacterCustomization.ts`), most of them a colour on the same shape | Real items: each its own garment model and fabric |
| Buying | The wardrobe screen; money through `BackendService` | A Boutique app; saved outfits |
| Shops | Sabo Textiles (fabric), market stalls | Clothing boutiques with racks, mannequins, mirrors and a fitting room |
| Street | People's clothes picked from a few looks per crowd variant | Dress by gender, age, place, time, weather and job |

## Milestone F: clothing

| Stage | What | Done when |
|---|---|---|
| F1 | **Garment pipeline v2.** The build adds real garment models on the shared skeleton: crew-neck tee, polo (collar, placket), button shirt (collar, cuffs, button line), hoodie (hood, front pocket), slim, straight and baggy jeans (silhouettes that differ toward the ankle), cargo trousers (side pockets), chinos, joggers, shorts, skirt, dress, and kaftan or agbada. Caps, bucket hats, beanies and gele as rigid meshes on the head bone; sneakers, sandals, boots and formal shoes; a watch, a chain and sunglasses. | Each piece fitted on both bodies with no clipping, shown in the viewer and in the game |
| F2 | **Fabric.** Textures made in code with normal maps: cotton jersey, piqué, oxford weave, denim twill with seams and stitching, leather, linen, sportswear mesh, Ankara and aso-oke prints, original graphic tees. | Close-up pictures read as cloth, not plastic |
| F3 | **Catalogue v2.** Every item is a garment model plus a fabric plus a colour, with a price. The old item ids keep working (saved players are not broken). | Every item renders on both bodies |
| F4 | **Dressed city.** People's outfits come from the catalogue by gender, age, place, time of day, weather and job (shopkeepers, drivers, security, office staff, house staff, market traders). Named characters keep theirs. | A street picture with no two people dressed alike, in the right clothes for the place |

### Progress

- **Stage 1 (garment models), approved 20 Nov.** Fifteen garments with their own shapes: tee, oversized tee, polo, shirt, hoodie, slim/straight/baggy jeans, cargo, chinos, shorts, cargo shorts, cap, bucket hat, beanie.
- **Stage 2 (fabrics and footwear), built 20 Nov; final polish done the same evening, awaiting sign-off.**
  - Every cloth part names its fabric in its material (`Cloth_Top:pique`, `Cloth_Bottom:denim`, ...). `src/graphics/people/GarmentFabrics.ts` draws it: a weave made in code, bump, colour variation, stitch rows along hems and the outer leg seam, denim fade, creases at knees and elbows, and a shoe's sole drawn by height.
  - The material takes a `FabricLook` (kind, colour, stitch colour, wear), so prints, logos and dirt can be added later without new models.
  - Fabrics: jersey, piqué, oxford, denim, twill, rib, fleece, canvas, leather, rubber.
  - Rounded pockets (jeans back pockets, cargo pockets and flaps, the hoodie's kangaroo pocket).
  - The neckline follows the body: a ring round the neck at the height the shoulders meet it, with the rib on that line. The skin under it is hidden by the same rule, so there are no holes.
  - Trousers end over the shoe, never inside it.
  - Footwear: sneakers, formal shoes, boots and slides (bare feet), picked by the outfit's shoe style.
  - Cost: 8 to 10 draws and 16k to 18.5k triangles per dressed person close up (the old plain outfit was 7 draws, 15.5k). Far people stay baked.
  - Final polish:
    - Cargo pockets are bent round the thigh and set on the trousers' own surface.
    - The hoodie's rib hem hangs below the hem, so it no longer shows through as a notch.
    - A band of neck skin is kept under the collar, and neckline points move with the chest.
    - Boot shafts are lower and taper in at the top.
    - Folded or flattened cloth triangles at hems and sleeve ends are left out.
  - Tests: `tests/e2e/clothingperf.mjs` measures 6, 20, 50 and 100 nearby dressed people, and repeated outfit changes. Draws and triangles are within about 1% of the pre-clothing build (c7e6519). Outfit changes take about 1 ms each and add no textures or shader programs once every garment has been worn.
  - Known leftovers: a slightly ragged cuff edge when the wrist bends (most on the shirt); formal shoes a little rounded; the female shorts hem slightly uneven.
- **Stage 2 approved 21 Nov.**
- **Stage 3 (customisation), built 21 Nov, awaiting review.**
  - Four things are kept apart:
    - the clothing definitions (`WARDROBE_CATALOGUE`);
    - the garment geometry and materials (the build, `GarmentFabrics.ts`);
    - the customisation (`src/player/ClothingStyle.ts`: a `GarmentStyle` per slot);
    - what is worn (`topId`, `bottomId`, `shoesId`, `headwearId`).
  - A style belongs to a slot (top, trousers, shoes, hat). It sets:
    - the main colour;
    - the cloth, from the ones that garment can be made in (`FABRIC_CHOICES`);
    - a pattern or print and its colours: stripes, pinstripe, check, camouflage, Ankara, six original graphic prints, or the player's own logo (up to 12 letters in a shape), with size, angle and place on the chest;
    - the thread colour;
    - the condition: clean, worn, dirty or damaged.
  - Rendering: all of it is drawn by the same fabric program from uniforms, so no new shader is compiled and no new garment model is needed.
  - Caching:
    - prints are drawn on a canvas once and the 12 most recent are kept, the oldest released;
    - materials are cached by body, cut, part and look (600 kept), so people dressed alike share them.
  - Hats: the cap, bucket hat and beanie models can now be bought and worn by the player (headwear items).
  - Studio: the **Style & outfits** tab in the wardrobe.
    - Pick a garment, then a region (main, pattern, accent, stitching); palettes and any colour; cloth; pattern; sliders; condition.
    - A picture of the player's real model in it, turned and framed on the whole look or one garment.
    - Changes are worn at once (dressed again in place, no reload) and saved.
  - Saved outfits: up to 12. Each can be saved, worn, updated, renamed and deleted, and is kept in the character save, which goes to the account save. Wearing an outfit whose item is no longer owned keeps what is worn in that slot.
  - Prepared, not drawn yet:
    - accessory slots (watch, chain, glasses, bracelet, belt, headwear), with the bone each will hang on;
    - a saved `accessories` field in outfits.
  - Tests: `tests/e2e/clothingstyle.mjs` checks:
    - every garment and footwear style on both bodies in each motion;
    - the studio;
    - outfits through a reload;
    - 800 style changes.
  - Performance is compared with `clothingperf` against Stage 2.
- **Stage 3 approved 21 Nov.**
- **Stage 4 (NPC wardrobe), built 21 Nov, awaiting review.**
  - The engine (`src/world/population/NpcWardrobe.ts`, data and arithmetic only):
    - Every street person has a wardrobe profile made from their city and their number, so they are the same person at every meeting and in every session. It holds their leanings (formal, premium, young, traditional), four colours plus a signature colour, the shoes they reach for, how they keep their clothes, and when they dress.
    - Occupations, each with its working days and its work clothes: office, student, mechanic, construction, security, market trader, driver, shopkeeper, fitness, hawker, out and about, elder, night owl. `registerOccupation` and `registerTemplate` add more without touching the engine. The crowd's roles and workplaces map onto them (`occupationFor`).
    - Outfit templates: about 30, each made of the existing garments, footwear and cloths. Each says who wears it, for what (work, everyday, evening, occasion, sport), and its leanings, colours, patterns and condition.
    - Each person keeps two or three outfits per purpose and rotates them day by day. Uniforms keep the employer's colour.
  - Districts (`src/world/population/FashionDistricts.ts`): every district of the three maps points at a fashion profile: business, premium business, premium casual, student, market, everyday, island mixed, tech, industrial, capital formal, capital residential, nightlife. Each profile sets formality, premium, youth, tradition, practicality and colours. Home taste comes from where a person lives; work taste from where they work.
  - Time:
    - People dress at their own morning hour; some change at their own evening hour.
    - Nobody changes between morning and afternoon. The small hours belong to the night before.
    - Office workers wear native dress on Fridays; churchgoers wear occasion dress on Sundays.
    - A change waits while the person is within 45 m of the player or is a close-up model.
  - Weather, applied when people dress:
    - rain: closed shoes, caps, sometimes a hoodie and long trousers;
    - harmattan mornings: hoodies, beanies, long trousers;
    - hot days: tees instead of hoodies, some shorts and slides.
    - When rain starts mid-day, only those who carry a cap put it on. Nobody's outfit changes.
  - Persistence:
    - Everything follows from the person's number, so only the regulars' choices are stored (traders, shopkeepers, guards): the outfit they put on today and the weather they dressed in.
    - Stored under `nl_npc_wardrobe_v1` on the device, apart from the player's outfits and out of the account save. It is written once, a few seconds after a change.
  - Rendering:
    - The crowd (`CityPopulation`) gives each person their own look and look number. The near models and the far figures use the same look.
    - No new geometry, textures or shader programs. NPC prints come from a fixed set of five, plus the SECURITY lettering.
    - Far off, the far figures treat a tee, a polo and an oversized tee as one cut, and slim, straight and baggy jeans, chinos and cargo trousers as another. Hoods, shorts and hats still show. This keeps the cuts baked at 25 to 29 (74 before the merge).
  - Not drawn until garments are modelled for them: skirts, dresses, gowns (ankara gown, buba and iro) and the agbada. The existing shells show these as a catsuit or shorts, so the wardrobe uses two-piece sets instead (ankara blouse and trousers, a senator shirt with matching trousers).
  - Tests: `tests/e2e/npcwardrobe.mjs` (13 checks) covers occupations, districts, time, weather, a shower starting, the evening on the live street, the 100 nearest people, near and far looks, regulars across a reload, the whole crowd identical after a reload, every occupation on the model in each motion, and Abuja and Port Harcourt.
- Next, after review: Stage 5 Boutique (only once the clothes pass), Stage 6 dirt, wear and weather (the condition states are the start of it), accessories drawn, and models for skirts, dresses, gowns and the agbada (needs approval: new geometry). Clothing definitions stay apart from geometry, materials and the character's equipment.

## Milestone B: buying

| Stage | What | Done when |
|---|---|---|
| B1 | **Boutique app** on the phone: categories, item pages, preview on your own character (turn it round), size where it applies, price, buy with game money through `BackendService`, saved outfits, equip. | Buying and equipping persist after a restart |
| B2 | **Boutiques you walk into:** a Lagos boutique (and one each in Abuja and Port Harcourt), with racks of real garments, mannequins dressed in them, shelves, display tables, mirrors, a fitting room and a till. The same stock, prices and ownership as the app. | Bought in the shop, seen in the app, and the other way round |

## Milestone I: interiors

| Stage | What | Done when |
|---|---|---|
| I1 | **Audit:** every enterable place pictured and scored (layout, furniture, light, people, things to do). | A list of what each one needs |
| I2 | **Furniture kit:** real chairs, benches, tables, beds, counters, shelves, racks and lamps, with wood, fabric, metal and tile materials, to replace boxes everywhere. | Placed in one place of each kind |
| I3 | **Places, one kind at a time:** Mama Put and bukas (pots, steam, plates of real food), the airport (check-in, security, bureau de change, departures, arrivals, signs, staff), offices, hotels, homes, the supermarket, hospital, bank, police, church and mosque. | Each with its pictures and a test |
| I4 | **Food you can see:** jollof and turkey, egusi and pounded yam, suya, on real plates in the hand and on the table; the fridge serves dishes. | Every meal shows its own dish |

## Rules for all of it

- Original designs only: no copyrighted clothing, logos or assets.
- One character system: garments go on the existing skeleton and pipeline (`tools/characters/`, `SkinnedCharacter.ts`), not a second one.
- Performance: garments have low-detail versions for people far away (as the bodies do); textures are shared and sized for phones.
- Saved players and their clothes keep working.
