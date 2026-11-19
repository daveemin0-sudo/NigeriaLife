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
| `human_male.glb` | Player male | Quaternius Matt (Zombie Apocalypse Kit) | CC0 |
| `human_female.glb` | Player female | Quaternius Casual_Female | CC0 |
| `human_male_alt_soldier.glb` | Optional alt | Quaternius Soldier_Male | CC0 |

Mixamo Xbot was evaluated and **rejected** as the default male (joint-dummy silhouette).

## LOD / performance (HD 620 · Galaxy A16)

| Tier | Who | Tech |
| --- | --- | --- |
| High | Local player | Skinned GLB + mixer, shadows on |
| Medium | Nearby agents | Skinned GLB, fewer clips, no shadows |
| Low / far | Crowd | PersonBuilder `lod: 'street'` (unchanged) |

## Next asset upgrades (ordered)

1. Replace Xbot with a **Nigerian-facing Mixamo or Quaternius Universal Base** male (civilian clothes, African skin albedo).
2. Author **outfit variant GLBs** (polo, kaftan, ankara) sharing one skeleton — wardrobe becomes mesh swaps, not tints.
3. Import Quaternius **Universal Animation Library** clips (sit, drive, emotes) retargeted to the same rig.
4. Optional: Ready Player Me / custom scanned heads for hero close-ups only.

## Do not

- Rip GTA / commercial game meshes
- Delete procedural fallback
- Change save-schema wardrobe IDs without migration
