// The game on a narrow phone (a Samsung with its larger text: about 316 px across). On every
// main surface nothing runs past the edge of the screen and no panel lies on another: the street,
// a toast, the quests, flights, city travel, the bag, the map and its search, the phone and its
// apps, a home with its card folded and open, asleep in bed, and at the wheel. A row meant to
// scroll sideways may run past the edge; anything else cut off by its window is a fault.
import { newPlayer, closeDialogs, wait, playUntil, GAME_URL } from './lib.mjs';

const APPS = ['jobs', 'bank', 'shopping', 'land', 'odds', 'studio', 'gist', 'ride', 'courses', 'gadgets', 'contacts', 'police', 'buses', 'business'];
// Rows that scroll sideways by design, full width
const SCROLLERS = /cat-tab/;

const measure = (page) => page.evaluate(() => {
  const W = innerWidth, H = innerHeight;
  const visible = (e) => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05; };
  const name = (e) => (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || e.tagName.toLowerCase();
  // Clipped by a scrolling or hidden-overflow ancestor that itself is on the screen: not a problem
  // Fine only inside a row meant to scroll sideways (narrower than the screen, and on it): anything else cut off by its window is cut off for the player
  const clipped = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll)/.test(s.overflowX) && a.scrollWidth > a.clientWidth + 2) { const r = a.getBoundingClientRect(); if (r.right <= W + 1 && r.left >= -1 && r.width < W - 4) return true; } } return false; };
  const off = [];
  const all = [...document.querySelectorAll('body *')];
  for (const e of all) {
    if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H) continue;
    if (!(r.right > W + 1 || r.left < -1)) continue;
    if (!visible(e)) continue;
    let hiddenUp = false;
    for (let a = e.parentElement; a; a = a.parentElement) if (!visible(a)) { hiddenUp = true; break; }
    if (hiddenUp || clipped(e)) continue;
    if (off.some((o) => o.el.contains(e))) continue;
    if (e.closest('.map-pin, .map-area-name, .map-labels, #world-map-labels')) continue;
    off.push({ el: e, what: `${name(e)} ${Math.round(r.left)}..${Math.round(r.right)} "${(e.innerText || '').trim().slice(0, 30).replace(/\s+/g, ' ')}"` });
  }
  // Fixed panels on top of each other (not the full-screen layers)
  const fixed = all.filter((e) => { const s = getComputedStyle(e); if (s.position !== 'fixed' || !visible(e)) return false; const r = e.getBoundingClientRect(); return r.width > 16 && r.height > 14 && r.width * r.height < W * H * 0.5 && r.bottom > 0 && r.top < H && !e.closest('#game-dialogue-overlay'); });
  const hits = [];
  for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) {
    if (fixed[i].contains(fixed[j]) || fixed[j].contains(fixed[i])) continue;
    const a = fixed[i].getBoundingClientRect(), b = fixed[j].getBoundingClientRect();
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    const pair = name(fixed[i]) + name(fixed[j]);
    if (/phone-close-floating-pill/.test(pair) && /hud-/.test(pair)) continue;
    if (ox > 6 && oy > 6) hits.push(`${name(fixed[i])} × ${name(fixed[j])}`);
  }
  // Headings bigger than a phone wants
  const big = all.filter((e) => /^H[1-3]$/.test(e.tagName) && visible(e) && e.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(e).fontSize) > 22).map((e) => `${name(e)} ${getComputedStyle(e).fontSize} "${e.textContent.trim().slice(0, 24)}"`).slice(0, 4);
  return { off: off.map((o) => o.what).slice(0, 8), hits: hits.slice(0, 10), big };
});

const closeAll = async (page) => {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-close, [data-close], .close-btn, [aria-label="Close"], .btn-close').forEach((b) => { if (b.offsetParent) b.click(); });
    window.game.hud.phoneModal?.close?.();
  });
  await page.keyboard.press('Escape');
  await wait(300);
};


export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulate({ viewport: { width: 316, height: 704, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction('window.game', { timeout: 240000 });
  await wait(4000);
  await closeDialogs(page);
  await wait(600);
  const report = {};
  const surface = async (key, open, settle = 700) => {
    try {
      await open();
      await wait(settle);
      const m = await measure(page);
      m.off = m.off.filter((o) => !SCROLLERS.test(o));
      report[key] = m;
    } catch (e) {
      report[key] = { error: String(e.message).slice(0, 120), off: [], hits: [] };
    }
    await closeAll(page);
  };
  await surface('street', async () => {});
  await surface('toast', async () => page.evaluate(() => window.game.modules.showGameToast('You are fully rested. Stay in bed as long as you like, or get up when you are ready.', 'success', 6000)));
  await surface('quests', async () => page.evaluate(() => window.game.hud.questModal.open()));
  await surface('flights', async () => page.evaluate(() => window.game.hud.interstateModal.open('lagos')));
  await surface('travel', async () => page.evaluate(() => window.game.hud.travelModal?.open?.()));
  await surface('bag', async () => page.evaluate(() => window.game.hud.openInventory()));
  await surface('map', async () => page.evaluate(() => document.getElementById('nav-btn-map').click()), 2500);
  let searchOpen = false;
  await surface('map-search', async () => {
    await page.evaluate(() => { if (document.body.dataset.uiMode !== 'world-map') document.getElementById('nav-btn-map').click(); });
    await wait(2000);
    await page.evaluate(() => document.querySelector('#map-search .map-search-ico')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await wait(500);
    searchOpen = await page.evaluate(() => { const i = document.getElementById('map-search-input'); return !!i && i.getBoundingClientRect().width > 120; });
  }, 500);
  await page.evaluate(() => document.getElementById('btn-map-back-street')?.click());
  await wait(1500);
  await surface('phone', async () => page.evaluate(() => document.getElementById('nav-btn-phone').click()), 1200);
  for (const app of APPS) await surface(`app-${app}`, async () => page.evaluate((a) => window.game.hud.phoneModal.openApp(a), app), 900);
  await page.evaluate(() => { const g = window.game; g.hud.backend.performGig(5_000_000, 0, 'phonefit'); g.hud.backend.rentProperty('prop_mainland_apt'); g.hud.onEnterInterior('residence:prop_mainland_apt'); });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await surface('home', async () => {}, 1500);
  await surface('home-card', async () => page.evaluate(() => document.getElementById('place-fold-btn')?.click()));
  await surface('sleep', async () => { await page.evaluate(() => [...document.querySelectorAll('.place-chip')].find((c) => /Bed$/.test(c.textContent.trim()))?.click()); await wait(5000); await page.evaluate(() => [...document.querySelectorAll('#interaction-card button')].find((b) => /sleep|lie/i.test(b.textContent))?.click()); }, 5000);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
  await surface('driving', async () => page.evaluate(() => { const g = window.game; const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'sedan'); g.player.mesh.position.copy(v.mesh.position); g.enterVehicle(v); }), 1500);

  // A banner shown for a moment when a door is passed lies over whatever is there: not a layout fault
  const passing = (h) => !/interior-transition-banner/.test(h);
  const offEdge = Object.entries(report).filter(([, r]) => r.off.length).map(([k, r]) => `${k}: ${r.off.join('; ')}`);
  const onTop = Object.entries(report).filter(([, r]) => r.hits.filter(passing).length).map(([k, r]) => `${k}: ${r.hits.filter(passing).join('; ')}`);
  const failed = Object.entries(report).filter(([, r]) => r.error).map(([k, r]) => `${k}: ${r.error}`);
  check(`phonefit: at 316 px across, nothing on ${Object.keys(report).length} surfaces runs past the edge of the screen`, offEdge.length === 0 && failed.length === 0, [...failed, ...offEdge].slice(0, 8));
  check('phonefit: and no panel lies on top of another (the top rows, the round buttons, the bar of buttons, the room card, the action button, toasts)', onTop.length === 0, onTop.slice(0, 8));
  check('phonefit: on the map the search is its icon until tapped, then a field to type in', searchOpen, { searchOpen });
  check('phonefit: no errors in the page', errors.length === 0, errors.slice(0, 4));
  await ctx.close();
}
