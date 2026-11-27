/**
 * DO NOT USE for shipping assets.
 *
 * After gltf-transform meshopt with default quantizationVolume "mesh", each
 * skinned mesh gets its own Skin with a slightly different quantized
 * inverseBindMatrices. Remapping every mesh onto one shared Skin reuses the
 * wrong IBM and explodes vertices at runtime (spidery limbs).
 *
 * Correct pipeline (see compress_shared_skins.sh):
 *   gltf-transform meshopt IN OUT --quantization-volume scene
 * That keeps exactly 2 skins (65 and 73 joints) with shared IBMs, meshopt
 * compression, 102 meshes / 116 primitives / 236 nodes / 19 animations /
 * Seated morph, and 145,963 (male) / 153,633 (female) triangles.
 *
 * Fallback if scene quantization cannot be applied: ship the pre-meshopt
 * GLBs from git c20db99 (~6.4 / 6.9 MB) which already have 2 shared skins.
 */
console.error('Refusing to merge skins after meshopt — use compress_shared_skins.sh (quantizationVolume: scene).');
process.exit(2);
