// A witness waiting in a room for a case (scratch capture, not a suite)
import { launch, open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { life: true, w: 412, h: 860 });
await closeDialogs(page);
await page.evaluate(() => window.game.modules.Cases.get().take('case-saxophone'));
await page.evaluate(() => {
  const g = window.game;
  const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-afrika-shrine');
  g.world.skyEnvironment.setHour(20);
  g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
  g.hud.showInteractionCard(card);
  document.getElementById('card-action-btn')?.click();
});
await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
await page.evaluate(() => { const g = window.game; const o = g.world.interiorManager.getActiveInteractiveObjects().find((x) => x.id === 'case_witness_afrika-shrine'); g.player.mesh.position.set(o.interactionPoint.x + 1, 0, o.interactionPoint.z + 2.5); });
await advance(page, 1);
await wait(500);
await page.screenshot({ path: `${out}/case-witness.png` });
await browser.close();
