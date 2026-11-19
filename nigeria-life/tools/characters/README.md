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

**Body type:** the free pack gives one body type per gender, the very muscular "Superhero"; the build slims it (see above). The "Regular" everyday proportions are in the paid Source version. Swapping it in needs only `BODY` changed in the script, and the slimming factors then set near 1.

**One pack quirk:** its glTF refers to `T_Hair_1_Normal_png.png`, `T_Hair_2_Normal_png.png` and `T_Eye_Normal_png.png`, which the zip does not contain. Copy `T_Hair_1_Normal.png` (and the others) to those names first.
