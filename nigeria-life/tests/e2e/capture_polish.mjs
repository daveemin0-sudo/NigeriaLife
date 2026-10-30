// The hotel room (armchair, bathroom), sleeping under the duvet, the fridge, a seated meal, road arrows (scratch capture)
import { launch, newPlayer, wait, playUntil, advance, enterInterior } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'polish';
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(async () => { document.getElementById('dialogue-confirm-btn')?.click(); const g = window.game; g.world.skyEnvironment.setHour(11); const b = g.hud.backend; b.data.bank.balance += 50_000_000; b.saveData(); await g.garage.buyNew('lexus_rx'); });
const shot = async (name) => { await advance(page, 0.6); await wait(300); await page.screenshot({ path: `${out}/${tag}-${name}.png` }); };
const idle = (s = 30) => playUntil(page, () => (window.game.player.actor.sequence ? null : true), s);
const use = async (id, pick) => {
  await page.evaluate((i) => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === i); g.hud.showInteractionCard(o); document.getElementById('card-action-btn')?.click(); }, id);
  await wait(400);
  if (pick) await page.evaluate((t) => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => b.textContent.includes(t))?.click(), pick);
};
const g = (fn, arg) => page.evaluate(fn, arg);

// Home: a 3-bedroom flat; sleep under the duvet
await g(() => { const g = window.game; const data = g.hud.backend.getData(); const p = data.properties.find((x) => x.id === 'prop_mainland_apt'); p.status = 'rented'; p.ownerId = data.id; });
await enterInterior(page, 'residence');
await advance(page, 1);
await shot('home3');
await g(() => window.game.cameraManager.setPreset('aerial'));
await shot('home3-above');
await g(() => window.game.cameraManager.setPreset('street'));
await g(() => window.game.hud.onHomeActivity('flat-bed'));
await playUntil(page, () => (window.game.player.actor.pose.legs === 'lie' && !window.game.player.actor.sequence ? true : null), 30);
await g(() => window.game.cameraManager.setPreset('close'));
await shot('sleep');
await g(() => { window.game.world.interiorManager.residence.life.stop(); window.game.cameraManager.setPreset('street'); });
await idle();
// The fridge: stock it, then eat from it on the sofa
await g(() => window.game.hud.backend.addItem({ id: 'jollof_pack', name: 'Party jollof pack', category: 'food', icon: '🍛', description: 'Smoky jollof', price: 4500, usable: true, effects: { hunger: 40 } }, 2));
await g(() => window.game.hud.onHomeActivity('flat-fridge'));
await wait(500);
await shot('fridge-empty');
await g(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /Put the food/.test(b.textContent))?.click());
await wait(400);
await g(() => window.game.hud.onHomeActivity('flat-fridge'));
await wait(500);
await shot('fridge-full');
await g(() => [...document.querySelectorAll('#game-dialogue-overlay button')].find((b) => /jollof/i.test(b.textContent))?.click());
await playUntil(page, () => (window.game.player.actor.pose.arms === 'eat' && window.game.player.actor.pose.legs === 'sit' ? true : null), 40);
await shot('fridge-eat');
await idle();
await g(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
await wait(1200);

// The hotel room
await g(() => { const g = window.game; return g.world.interiorManager.enterInterior('interior_place_eko-grand-suite', g.player, g.cameraManager, g.hud, g.world); });
await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
await shot('suite');
await use('place_eko-grand-suite_tv');
await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 20);
await g(() => window.game.cameraManager.setPreset('close'));
await shot('suite-armchair');
await g(() => { window.game.player.actor.hold?.release(true); window.game.cameraManager.setPreset('street'); });
await idle();
await use('place_eko-grand-suite_shower');
await playUntil(page, () => (window.game.player.actor.pose.arms === 'reach' ? true : null), 20);
await shot('suite-shower');
await idle();
await g(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
await wait(1200);

// Amala Shitta: order, sit, the plate brought
await g(() => { const g = window.game; return g.world.interiorManager.enterInterior('interior_place_amala-shitta', g.player, g.cameraManager, g.hud, g.world); });
await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
await use('place_amala-shitta_counter', 'Amala, ewedu');
await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 30);
await shot('amala-seated');
await playUntil(page, () => (window.game.player.actor.pose.arms === 'eat' ? true : null), 40);
await shot('amala-eating');
await idle(40);
await g(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
await wait(1200);

// Arrows on the road to the airport
const go = await g(() => { const g = window.game; return g.driveTo('Murtala Muhammed International Airport', new g.player.position.constructor(g.player.position.x + 120, 0, g.player.position.z + 200)); });
await advance(page, 1);
await shot(`arrows-${go}`);
console.log('drive', go);
await browser.close();
