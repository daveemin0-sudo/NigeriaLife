# NigeriaLife — Production Character Pipeline

## Decision (2026-11-19)

**Stop iterating the procedural mannequin as the player hero.**  
The player uses **skinned GLB humanoids** with an `AnimationMixer`.  
`PersonBuilder` remains the **NPC / offline / zero-latency fallback** only.

This matches `docs/ASSETS.md` (Mixamo-compatible humanoid under `public/models/characters/`).

## Why not more procedural sculpting?

Procedural lathes + spheres cannot deliver:
- continuous skinned shoulders / necks
- authored facial topology
- cloth that deforms with the body
- Mixamo-quality locomotion without snapping joints

Those require **authored meshes + skin weights + animation clips**.

## Architecture

```
CharacterConfig (wardrobe / skin / gender)
        │
        ▼
HumanFromConfig / Player.buildHumanMesh
        │
        ├── [sync] PersonBuilder fallback → HumanRig (Actor poses, crowds)
        │
        └── [async] AssetManager.instantiate(/models/characters/human_{gender}.glb)
                    │
                    ▼
              SkinnedCharacter
                - SkeletonUtils clone
                - AnimationMixer (idle / walk / run / sit)
                - applySkinTone / applyOutfitColors
                - ground / scale normalize
```

### Compatibility rules
- Do **not** remove `HumanRig` or `PersonBuilder` — interiors, Actor scripts, and city crowds depend on them.
- When a skinned GLB is active, `Actor.getRig()` returns `null` (same as today) so scripted bone poses don’t fight the mixer. Carry/attach can later bind to named bones (`mixamorigRightHand`, etc.).
- Wardrobe catalogue IDs stay stable; skinned path tints materials / swaps variant GLBs; procedural path still builds full outfits for NPCs.

## Current base meshes

| File | Role | Source | License |
| --- | --- | --- | --- |
| `human_male.glb` | Player male | Quaternius **Universal Base Characters** (Superhero_Male, dark skin texture, Hair_Buzzed) plus **Universal Animation Library** clips | CC0 |
| `human_female.glb` | Player female | Quaternius **Universal Base Characters** (Superhero_Female, dark skin texture, Hair_Buns) plus **Universal Animation Library** clips | CC0 |
| `human_male_alt_soldier.glb` | Optional alt | Quaternius Soldier_Male | CC0 |

- **How they are built:** `tools/characters/build_ubc.mjs` (see `tools/characters/README.md`).
- **Sizes:** about 1.7 MB (male) and 2.0 MB (female) each. That covers 13 clips, WebP textures and one 65-bone skeleton (Unreal mannequin naming).
- **Earlier meshes:** the player meshes from #45 (Characters_Matt, Casual_Female) are in git history.
- Mixamo Xbot was evaluated and **rejected** as the default male (joint-dummy silhouette).

### Garment layout (what `SkinnedCharacter.applyGarmentLayout` relies on)

**Garment nodes.** Each is a skinned shell cut from the body by the build, so it bends exactly with the body:

| Node | Covers |
| --- | --- |
| `Outfit_Top_Short` | Torso and upper arm (tee, polo, jersey, Ankara shirt, blouse) |
| `Outfit_Top_Long` | Torso and arms to the wrist (button-up, hoodie, suit, kaftan, senator; gowns and robes for now) |
| `Outfit_Bottom_Long` | Waist to just over the shoe (trousers, jeans, chinos; gowns and jumpsuits in the top's colour) |
| `Outfit_Bottom_Short` | Waist to above the knee (skirts; a bodycon dress in the top's colour) |
| `Outfit_Shoes` | Feet |

**Body pieces** `Body_c<mask>`. The mask has one digit per garment, in the order above. The game hides a piece when a garment that is shown has a 1 in that digit, so skin never shows through and no hole is left.

**Materials, by name:**

| Material | Game tint |
| --- | --- |
| `Skin_Body` | The player's skin tone, scaled from the baked tone |
| `Hair` | The player's hair colour |
| `Eyes` | — |
| `Cloth_Top`, `Cloth_Bottom`, `Cloth_Shoes` | The wardrobe item's colour |

**Clip names:** `idle`, `walk`, `run`, `sprint`, `sit`, `sit_talk`, `drive`, `talk`, `dance`, `interact`, `pickup`, `push`, `walk_formal`. `phone_call` falls back to `idle`.

### Known limits of this first version

- **Body type.** The free pack's only body per gender is the very muscular "Superhero" one. The "Regular" everyday proportions are in Quaternius's paid Source version ($19.99, also CC0); the build needs only the body file changed.
- **Cloth.** Clothing is close-fitting and plain-coloured: no prints, collars or buttons yet, and no flowing cloth. Agbada, gowns and wrappers are drawn as their closest fitted cut. The Ankara pattern is not shown, only its main colour.
- **Edges.** Hem and neckline edges follow the body's triangles, so they are slightly ragged up close.
- **Idle.** The library's only idle is a confident wide stance.
- **NPCs** still use PersonBuilder.

## LOD / performance (HD 620 · Galaxy A16)

| Tier | Who | Tech |
| --- | --- | --- |
| High | Local player | Skinned GLB + mixer, shadows on |
| Medium | Nearby agents | Skinned GLB, fewer clips, no shadows |
| Low / far | Crowd | PersonBuilder `lod: 'street'` (unchanged) |

## Next asset upgrades (ordered)

1. **Everyday bodies:** the Regular proportions (paid Source pack, CC0), or a custom civilian body on the same skeleton.
2. **Authored garments** on the same skeleton for what shells cannot do: collars and plackets (polo, shirt), the kaftan and senator's length, agbada, gowns, buba and iro, gele, with printed Ankara textures. The wardrobe IDs stay stable.
3. **More clips from the Universal Animation Library** (it has 43 CC0 clips; 13 are used): a relaxed idle, carrying, phone, more sitting.
4. **Skinned NPCs near the camera**, within the A16 budget (milestone M1), with PersonBuilder kept for far crowds.

## Do not

- Rip GTA / commercial game meshes
- Delete procedural fallback
- Change save-schema wardrobe IDs without migration
