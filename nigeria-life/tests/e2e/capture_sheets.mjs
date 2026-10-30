// The sheets a player opens over the world, one picture each at a phone's size (scratch capture)
import { launch, newPlayer, wait } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'sheets';
const W = Number(process.env.W ?? 420), H = Number(process.env.H ?? 816);
const browser = await launch();
const ctx = await newPlayer(browser);
const page = await ctx.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
await page.goto(process.env.GAME_URL, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.game', { timeout: 120000 });
await wait(9000);
await page.evaluate(() => { document.getElementById('dialogue-confirm-btn')?.click(); window.game.world.skyEnvironment.setHour(11); });
const sheets = {
  menu: () => document.getElementById('top-menu-btn')?.click(),
  buy: () => document.getElementById('nav-btn-buy')?.click(),
  today: () => window.game.today.open('today'),
  music: () => document.getElementById('music-fab')?.click(),
  bag: () => window.game.hud.openInventory(),
  quests: () => window.game.hud.questModal.open(),
  flights: () => window.game.hud.interstateModal.open('lagos'),
  self: () => window.game.input.onSelfClicked?.({ x: 210, y: 520 }),
};
const more = {
  atm: () => window.game.hud.openAtm(),
  travel: () => window.game.hud.travelModal.open(),
  buka: () => window.game.bukaUI.open(),
  wardrobe: () => window.game.hud.openWardrobe(),
  photo: () => window.game.photoMode.open(),
  profile: () => window.game.profileSheet?.open?.(null),
  catalogue: () => window.game.catalogueSheet?.open?.() ?? window.game.hud.catalogueSheet?.open?.(),
};
const chosen = process.env.SET === 'more' ? more : sheets;
for (const [name, open] of Object.entries(chosen)) {
  try {
    await page.evaluate(`(${open.toString()})()`);
    await wait(900);
    await page.screenshot({ path: `${out}/${tag}-${name}.png` });
  } catch (e) {
    console.log(name, 'failed', e.message);
  }
  await page.keyboard.press('Escape');
  await wait(250);
  await page.evaluate(() => {
    try { window.game.today.close(); } catch {}
    // Any close button still showing
    for (const b of document.querySelectorAll('button')) {
      const r = b.getBoundingClientRect();
      if (!r.width || getComputedStyle(b).visibility === 'hidden') continue;
      if (/^(×|✕|✕ Close|Close)$/.test(b.textContent.trim()) || /close/i.test(b.getAttribute('aria-label') || '') || /close/i.test(b.id)) b.click();
    }
  });
  await page.keyboard.press('Escape');
  await wait(500);
}
await browser.close();
