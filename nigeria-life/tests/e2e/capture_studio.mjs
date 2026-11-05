// A studio shot of people: a line-up full length and their faces close, rendered with a camera of our own (scratch capture)
import fs from 'node:fs';
import { launch, newPlayer, wait } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'v';
const set = process.argv[4] ?? 'a';
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 1 });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(7000);
const LOOKS = {
  a: [
    { gender: 'male', outfit: 'agbada', hairstyle: 'fila', headShape: 'round', beard: 'full', outfitColor: 0x1e3a8a },
    { gender: 'female', outfit: 'ankara_gown', hairstyle: 'box_braids', headShape: 'oval', outfitColor: 0xdb2777, accentColor: 0xfacc15 },
    { gender: 'male', outfit: 'tshirt', hairstyle: 'afro', headShape: 'long', outfitColor: 0x16a34a },
    { gender: 'female', outfit: 'buba_iro', hairstyle: 'gele', headShape: 'heart', outfitColor: 0x7c3aed },
    { gender: 'male', outfit: 'suit', hairstyle: 'waves', headShape: 'square', beard: 'goatee' },
    { gender: 'female', outfit: 'casual_blouse', hairstyle: 'bob_wig', headShape: 'diamond', outfitColor: 0xf59e0b },
  ],
  b: [
    { gender: 'male', outfit: 'kaftan', hairstyle: 'dreads', headShape: 'oval', outfitColor: 0xf5f5f4 },
    { gender: 'female', outfit: 'hoodie', hairstyle: 'bun', headShape: 'round', outfitColor: 0x111827 },
    { gender: 'male', outfit: 'jersey', hairstyle: 'fade', headShape: 'round', outfitColor: 0x15803d },
    { gender: 'female', outfit: 'peplum_skirt', hairstyle: 'cornrows', headShape: 'oval', outfitColor: 0x0e7490 },
    { gender: 'male', outfit: 'button_shirt', hairstyle: 'twists', headShape: 'diamond', beard: 'stubble', outfitColor: 0x1d4ed8 },
    { gender: 'female', outfit: 'bodycon', hairstyle: 'long_wig', headShape: 'heart', outfitColor: 0xb91c1c },
  ],
};
const shots = await page.evaluate((looks) => {
  const g = window.game;
  const T = g.modules.THREE;
  const H = g.modules.HumanMeshBuilder;
  const base = new T.Vector3(600, 0, -600);
  const stage = new T.Group();
  g.scene.add(stage);
  const floor = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshStandardMaterial({ color: 0xd6d3d1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.copy(base);
  stage.add(floor);
  const light = new T.DirectionalLight(0xffffff, 1.6);
  light.position.set(base.x + 3, 6, base.z + 8);
  light.target.position.copy(base);
  stage.add(light, light.target, new T.HemisphereLight(0xffffff, 0x8a7a6a, 0.9));
  const rigs = looks.map((l, i) => {
    const rig = H.createHuman({ username: '', lod: 'detailed', ...l });
    rig.nameTag.visible = false;
    rig.group.position.set(base.x - 3.1 + i * 1.24, 0, base.z);
    rig.updateAnimation(0.3, false);
    stage.add(rig.group);
    return rig;
  });
  const cam = new T.PerspectiveCamera(30, 900 / 700, 0.05, 200);
  const shot = () => { g.renderer.render(g.scene, cam); return g.renderer.domElement.toDataURL('image/png'); };
  const out = [];
  cam.position.set(base.x, 1.05, base.z + 9.5);
  cam.lookAt(base.x, 0.95, base.z);
  out.push(shot());
  // Faces, two at a time
  for (let i = 0; i < looks.length; i++) {
    const x = base.x - 3.1 + i * 1.24;
    const y = looks[i].gender === 'female' ? 1.6 : 1.68;
    cam.position.set(x + 0.18, y, base.z + 1.05);
    cam.lookAt(x, y - 0.02, base.z);
    out.push(shot());
  }
  return out;
}, LOOKS[set]);
shots.forEach((data, i) => fs.writeFileSync(`${out}/studio-${tag}-${set}-${i}.png`, Buffer.from(data.split(',')[1], 'base64')));
console.log('shots', shots.length);
await browser.close();
