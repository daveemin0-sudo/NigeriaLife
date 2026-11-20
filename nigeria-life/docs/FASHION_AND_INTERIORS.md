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
