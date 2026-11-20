// Adds low-detail copies of a character model's body pieces, clothes and hair (nodes named LOD_<name>,
// skinned to the same skeleton) for drawing people far away: the game bakes them into posed frames and
// draws a whole street of them at once (src/graphics/people/BakedPeople.ts).
//
//   node add_lod.mjs <in.glb> <out.glb>
//
// Needs, beside @gltf-transform/*: npm install meshoptimizer
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplifyPrimitive, weldPrimitive, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
await MeshoptSimplifier.ready;

/** How much of each part is kept: the body and clothes to a few hundred triangles, hair a little more */
const RATIO = [
  [/^Body_c/, 0.09],
  [/^Outfit_/, 0.12],
  [/^Hair/, 0.22],
];

let before = 0, after = 0;
for (const node of doc.getRoot().listNodes()) {
  const name = node.getName();
  const ratio = RATIO.find(([re]) => re.test(name))?.[1];
  const mesh = node.getMesh();
  if (!ratio || !mesh || !node.getSkin()) continue;
  const lod = doc.createMesh(`LOD_${name}`);
  for (const prim of mesh.listPrimitives()) {
    const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
    // Only where the vertices are and how they hang on the bones: no UVs or normals, so seams weld shut
    for (const semantic of ['POSITION', 'JOINTS_0', 'WEIGHTS_0']) {
      const a = prim.getAttribute(semantic);
      if (a) p.setAttribute(semantic, a.clone());
    }
    p.setIndices(prim.getIndices().clone());
    before += p.getIndices().getCount() / 3;
    weldPrimitive(p, {});
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio, error: 0.02, lockBorder: false });
    after += p.getIndices().getCount() / 3;
    lod.addPrimitive(p);
  }
  const lodNode = doc.createNode(`LOD_${name}`).setMesh(lod).setSkin(node.getSkin());
  const parent = node.getParentNode();
  if (parent) parent.addChild(lodNode);
  else for (const scene of doc.getRoot().listScenes()) if (scene.listChildren().includes(node)) scene.addChild(lodNode);
}
await doc.transform(prune());
await io.write(output, doc);
console.log(`${output}: far-away copies ${Math.round(before)} -> ${Math.round(after)} triangles`);
