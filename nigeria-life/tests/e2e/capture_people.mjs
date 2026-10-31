// People close up: the player and some of the crowd, and the look editor (scratch capture)
import { launch, newPlayer, wait, advance } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'now';
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.world.skyEnvironment.setHour(11); });
// Close on the player, front on
await page.evaluate(() => { const g = window.game; g.player.mesh.rotation.y = Math.PI; g.cameraManager.setCloseUp?.(true); });
await advance(page, 1.5);
await wait(400);
await page.screenshot({ path: `${out}/people-${tag}-player.png` });
// A line-up of looks built side by side in front of the camera
await page.evaluate(() => {
  const g = window.game;
  const T = g.modules.THREE;
  const H = g.modules.HumanMeshBuilder;
  if (!H) return;
  const looks = [
    { gender: 'male', outfit: 'agbada', hairstyle: 'fade', outfitColor: 0x1e3a8a },
    { gender: 'female', outfit: 'blue_dress', hairstyle: 'braids', outfitColor: 0xdb2777 },
    { gender: 'male', outfit: 'casual_tee', hairstyle: 'afro', outfitColor: 0x16a34a },
    { gender: 'female', outfit: 'casual_blouse', hairstyle: 'gele', outfitColor: 0xf59e0b },
  ];
  const p = g.player.position;
  looks.forEach((l, i) => {
    const rig = H.createHuman({ username: '', lod: 'detailed', ...l });
    rig.nameTag.visible = false;
    rig.group.position.set(p.x - 2.4 + i * 1.6, 0, p.z - 2.2);
    rig.group.rotation.y = Math.PI;
    g.scene.add(rig.group);
  });
});
await advance(page, 0.5);
await wait(400);
await page.screenshot({ path: `${out}/people-${tag}-lineup.png` });
await browser.close();
