/**
 * DO NOT USE for shipping assets.
 *
 * After gltf-transform meshopt/quantize, each skinned mesh gets its own Skin with a
 * slightly different quantized inverseBindMatrices (deltas measured up to ~1.65).
 * Remapping every mesh onto one shared Skin reuses the wrong IBM and explodes vertices
 * at runtime (spidery limbs). Verified 23 Nov 2026 against Broad Street screenshots.
 *
 * Working state: meshopt-compressed GLBs with 101 male / 95 female skins (2 joint
 * counts: 65 and 73). Base (pre-meshopt) GLBs already have exactly 2 shared skins
 * and render correctly, but are ~2.5× larger.
 *
 * To get both meshopt AND 2 skins, compression must preserve shared skins and a single
 * IBM per joint list — do not merge after quantize.
 */
console.error('Refusing to merge skins after meshopt/quantize — see file header.');
process.exit(2);
