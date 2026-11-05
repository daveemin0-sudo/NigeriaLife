// The interface at a phone's size and a laptop's: street, a card, a dialogue, a toast, a place,
// the phone (scratch capture for looking at the design, not a suite)
import { launch, newPlayer, wait, playUntil, advance } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'ui';
const browser = await launch();

async function shots(width, height, scale, mobile, name) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  if (process.env.DARK) await page.evaluateOnNewDocument(() => localStorage.setItem('nl_theme_v1', 'dark'));
  await page.setViewport({ width, height, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile });
  await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game', { timeout: 120000 });
  await wait(9000);
  await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.world.skyEnvironment.setHour(11); });
  await advance(page, 0.5);
  await wait(500);
  await page.screenshot({ path: `${out}/${tag}-${name}-street.png` });
  // The View sheet, then a clean screen
  await page.evaluate(() => document.getElementById('view-fab')?.click());
  await wait(500);
  await page.screenshot({ path: `${out}/${tag}-${name}-view.png` });
  await page.evaluate(() => document.querySelector('#view-sheet [data-view="aerial"]')?.click());
  await advance(page, 1);
  await wait(500);
  await page.screenshot({ path: `${out}/${tag}-${name}-view2.png` });
  await page.evaluate(() => { document.querySelector('#view-sheet [data-view="street"]')?.click(); document.querySelector('#view-sheet [data-act="clean"]')?.click(); });
  await advance(page, 0.5);
  await wait(500);
  await page.screenshot({ path: `${out}/${tag}-${name}-clean.png` });
  await page.evaluate(() => document.getElementById('view-fab')?.click());
  await wait(300);
  // A toast and someone's card
  await page.evaluate(() => {
    const g = window.game;
    g.hud.showNotification('🛎️ Checked in: room 205, second floor, until noon on Sun 1.', 'success');
    const near = g.hud.currentInteractionTarget?.interactiveObject ?? g.world.interactiveObjects.find((o) => o.id === 'mama-put' || o.id.startsWith('dest_'));
    if (near) g.hud.showInteractionCard(near);
  });
  await wait(700);
  await page.screenshot({ path: `${out}/${tag}-${name}-card.png` });
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  // A dialogue with choices
  await page.evaluate(() => {
    const g = window.game;
    g.hud.showDialogueModal({ speakerName: 'Mama Ronke', speakerRole: 'Fish seller, Makoko floating market', speakerAvatar: '🐟', dialogueText: 'Fresh catfish and smoked bonga from the lagoon this morning!', choices: [{ label: 'A bowl of smoked fish', badge: '₦4,000', onSelect: () => {} }, { label: 'No, thank you', onSelect: () => {} }] });
  });
  await wait(700);
  await page.screenshot({ path: `${out}/${tag}-${name}-dialogue.png` });
  await page.keyboard.press('Escape');
  await wait(300);
  // Inside a place
  await page.evaluate(() => {
    const g = window.game;
    const card = g.world.interactiveObjects.find((o) => o.id === 'roadside-eko-grand-hotel');
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.hud.showInteractionCard(card);
    document.getElementById('card-action-btn')?.click();
  });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.isTransitioning ? true : null), 20);
  await advance(page, 1);
  await wait(600);
  await page.screenshot({ path: `${out}/${tag}-${name}-place.png` });
  // The phone
  await page.evaluate(() => document.getElementById('nav-btn-phone')?.click());
  await wait(1200);
  await page.screenshot({ path: `${out}/${tag}-${name}-phone.png` });
  await ctx.close();
}

await shots(420, 816, 2, true, 'phone');
await shots(1366, 768, 1, false, 'laptop');
await browser.close();
