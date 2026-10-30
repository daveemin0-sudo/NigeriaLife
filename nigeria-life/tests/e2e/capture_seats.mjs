// Seated in places: a meal at the buka's table, a haircut in the barber's chair, a film at the cinema (scratch capture)
import { launch, newPlayer, wait, playUntil, advance, enterInterior, useStation } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: 420, height: 816, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(8000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); const g = window.game; g.world.skyEnvironment.setHour(12); const b = g.hud.backend; b.data.bank.balance += 5_000_000; b.data.cash = (b.data.cash ?? 0) + 200000; b.saveData(); });
const shot = async (name) => { await wait(300); await page.screenshot({ path: `${out}/seat-${name}.png` }); };
const pick = (text) => page.evaluate((t) => [...document.querySelectorAll('#dialogue-choices-row .dialogue-choice-btn')].find((b) => b.innerText.includes(t))?.click(), text);
const sat = () => playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 40);

for (const [place, station, choice, name, extra] of [
  ['place_amala-shitta', 'place_amala-shitta_counter', 'Amala with goat meat', 'buka', 6],
  ['place_allen-salon', 'place_allen-salon_barber', 'A low cut', 'barber', 1.5],
  ['place_shopwell-mall', 'place_shopwell-mall_cinema', '', 'cinema', 1.5],
  ['place_freedom-park', 'place_freedom-park_show', 'Sit and watch', 'show', 1.5],
]) {
  await enterInterior(page, place.replace(/^place_/, 'interior_place_'));
  let inside = await page.evaluate(() => window.game.world.interiorManager.currentInterior?.id);
  if (!inside) { await enterInterior(page, place); inside = await page.evaluate(() => window.game.world.interiorManager.currentInterior?.id); }
  await useStation(page, station);
  await wait(300);
  const choices = await page.evaluate(() => [...document.querySelectorAll('#dialogue-choices-row .dialogue-choice-btn')].map((b) => b.innerText.replace(/\s+/g, ' ')));
  if (choice) await pick(choice); else await page.evaluate(() => document.querySelector('#dialogue-choices-row .dialogue-choice-btn')?.click());
  const ok = await sat();
  await advance(page, extra);
  console.log(name, inside, ok, choices.slice(0, 3).join(' / '));
  await shot(name);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 40);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(1500);
}
await browser.close();
