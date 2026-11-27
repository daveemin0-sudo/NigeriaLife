# Building the player characters

`public/models/characters/human_male.glb` and `human_female.glb` are built by `build_ubc.mjs` from two free CC0 packs by Quaternius:
- Universal Base Characters [Standard]
- Universal Animation Library [Standard]

## What the script does

- Takes the Superhero body (the only body in the free pack) with its dark-skin texture. Adds buzzed hair (male) or buns (female) on the same 65-bone skeleton.
- Slims the body to an everyday build: arms, chest and legs drawn in toward the bones, sculpted muscle smoothed away, the skin's muscle shading softened. Head, hands and feet are untouched.
- Splits the body into pieces named `Body_c<mask>`. The mask has one digit per garment: TopShort, TopLong, BottomLong, BottomShort, Shoes. The game hides a piece when a shown garment has a 1 in that digit.
- Cuts clothing shells from the body itself, so they bend exactly with it:
  - `Outfit_Top_Short`, `Outfit_Top_Long`, `Outfit_Bottom_Long`, `Outfit_Bottom_Short`, `Outfit_Shoes`
  - Cut lines come from the skeleton.
  - The shells are smoothed (no muscles under cloth) and loosened.
  - Their edges are pinned so no gap opens.
- Builds garment models of their own (`Outfit_<kind>__<variant>`): tees, polo, shirt, hoodie, jeans, cargo, chinos, shorts, caps, footwear; skirts, dresses and gowns, the peplum, buba, kaftan and senator tops, the agbada robe, and the gele, fila and kufi.
- Hanging cloth (skirts, gown skirts, tunics, the agbada) is a tube round the hips and legs, skinned to four cloth bones added under the pelvis (`cloth_front`, `cloth_front_low`, `cloth_back`, `cloth_back_low`). No clip animates them: the game turns them from the legs every frame (`src/graphics/people/ClothRig.ts`).
- From the hips to the fingertips, hanging cloth falls straight round the legs as they stand in play, so the hands hang outside it, and flares below them. The legs' stance is measured from the running game by `measure_hand_room.mjs` into `hand_room.json`; run it again if the posture or the arm clips change.
- Bakes everyday colours: very dark brown hair, warm brown skin. The game tints skin, hair and clothes per player in `SkinnedCharacter.ts`, `applyGarmentLayout`.
- Copies 19 animation clips, renamed to the game's names, and resamples them. Scale tracks are dropped, and translation tracks are kept only for the hips, applied as movement from this body's own hip height. The "fall" clip is held at its end for lying in bed.
- Converts textures to WebP: 1024 px colour and normal maps, 512 px roughness.

## Command used

1. Set up the tools once: in this folder, `npm init -y`, then `npm install @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 sharp`.
2. Run, once per gender:

```
UBC_PACK="<unzipped>/Universal Base Characters[Standard]" \
CLIPS='{"idle":"Idle_Loop","walk":"Walk_Loop","run":"Jog_Fwd_Loop","sprint":"Sprint_Loop","sit":"Sitting_Idle_Loop","sit_talk":"Sitting_Talking_Loop","drive":"Driving_Loop","talk":"Idle_Talking_Loop","dance":"Dance_Loop","interact":"Interact","pickup":"PickUp_Table","push":"Push_Loop","walk_formal":"Walk_Formal_Loop","sit_enter":"Sitting_Enter","sit_exit":"Sitting_Exit","kneel":"Crouch_Idle_Loop","crouch_walk":"Crouch_Fwd_Loop","fix":"Fixing_Kneeling","fall":"Death01"}' \
node build_ubc.mjs male human_male.glb "<unzipped>/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb"
```

3. Add the far-away copies (needs `npm install meshoptimizer` too), once per gender:

```
node add_lod.mjs human_male.glb human_male.glb
```

This adds `LOD_<name>` copies of the body pieces, clothes and hair: about 1,000–1,300 triangles a person instead of about 15,000, skinned to the same skeleton. The game never draws them on a model. `src/graphics/people/BakedPeople.ts` poses them a few frames per action and draws everyone beyond the nearest few with them. So a person looks the same at every distance, and the old procedural figures are never drawn.

4. Add the seated shapes, once per gender, after the far-away copies:

```
node add_seated.mjs human_male.glb human_male.glb male
```

This gives each hanging garment a morph target `Seated`, solved against the pose in `seated_pose.json`. If the sit clip or `src/graphics/people/ClothRig.ts` changes, record the pose again with `GAME_URL=<running build> node tools/characters/measure_seated_pose.mjs`, then run this step again.

**Posture:** the everyday stance (shoulders and hips brought in, legs under the hips, arms by the sides, hands open) is applied in the game by `src/graphics/people/Posture.ts`, over every clip. It is not in the file.

**Body type:** the free pack gives one body type per gender, the very muscular "Superhero"; the build slims it (see above). The "Regular" everyday proportions are in the paid Source version. Swapping it in needs only `BODY` changed in the script, and the slimming factors then set near 1.

**One pack quirk:** its glTF refers to `T_Hair_1_Normal_png.png`, `T_Hair_2_Normal_png.png` and `T_Eye_Normal_png.png`, which the zip does not contain. Copy `T_Hair_1_Normal.png` (and the others) to those names first.


## Shipping compression (meshopt + 2 shared skins)

After `add_lod` / `add_seated`, compress with **scene** quantization so skins stay shared:

```
SRC_MALE=/path/to/uncompressed_male.glb SRC_FEMALE=/path/to/uncompressed_female.glb \
  ./compress_shared_skins.sh
```

Or: `npx @gltf-transform/cli meshopt IN OUT --quantization-volume scene`.

Required result: **2 skins** (65 and 73 joints), 102 meshes, 116 primitives, 236 nodes, 19 animations, `Seated` morph, 145,963 / 153,633 triangles. Default `mesh` volume splits to 101/95 skins — do not ship that; do not merge skins after the fact.
