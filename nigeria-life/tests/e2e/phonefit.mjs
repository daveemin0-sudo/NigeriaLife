// The game on a narrow phone (a Samsung with its larger text: about 316 px across). On every
// main surface nothing runs past the edge of the screen and no panel lies on another: the street,
// a toast, the quests, flights, city travel, the bag, the map and its search, the phone and its
// apps, a home with its card folded and open, asleep in bed, and at the wheel. A row meant to
// scroll sideways may run past the edge; anything else cut off by its window is a fault.
import fs from 'node:fs';
import { newPlayer, closeDialogs, wait, playUntil, GAME_URL } from './lib.mjs';

// Width and height of each phone tried (PHONE_WIDTHS=316,390 tries only those)
const PHONES = [[316, 704], [360, 780], [390, 844], [430, 932]].filter(([w]) => !process.env.PHONE_WIDTHS || process.env.PHONE_WIDTHS.split(',').includes(String(w)));
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
  // Things to tap: big enough for a thumb, on the screen, and not under something else
  const scrollBox = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll)/.test(s.overflowY) || /(auto|scroll)/.test(s.overflowX)) return a; } return null; };
  const small = [], covered = [], below = [];
  // A window open over the game (a dialog, the phone, the map): what is behind it cannot be tapped and is not measured
  const rootOf = (e) => { let top = null; for (let a = e; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === 'fixed') top = a; return top; };
  const mid = document.elementFromPoint(W / 2, H / 2);
  const midRoot = mid ? rootOf(mid) : null;
  const modal = midRoot && midRoot.tagName !== 'CANVAS' && midRoot.getBoundingClientRect().width * midRoot.getBoundingClientRect().height > W * H * 0.5 && !/hud-overlay|virtual-mobile|game-container/.test(midRoot.id) ? midRoot : null;
  const taps = all.filter((e) => e.matches('button, a[href], [role="button"], input:not([type="hidden"]), select, textarea, .place-chip, [data-app], [data-act]'));
  for (const e of taps) {
    if (e.disabled) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || !visible(e)) continue;
    let hiddenUp = false;
    for (let a = e.parentElement; a; a = a.parentElement) { const s = getComputedStyle(a); if (!visible(a) || s.pointerEvents === 'none' && getComputedStyle(e).pointerEvents === 'none') { hiddenUp = true; break; } }
    if (hiddenUp || getComputedStyle(e).pointerEvents === 'none') continue;
    const box = scrollBox(e);
    const label = `${name(e)} ${Math.round(r.width)}x${Math.round(r.height)} "${(e.innerText || e.getAttribute('aria-label') || e.title || e.placeholder || '').trim().slice(0, 22).replace(/\s+/g, ' ')}"`;
    // What of it shows through the windows it sits in (a list that scrolls, a card with rounded ends): scrolled
    // mostly out of its list it can be scrolled to, so it is not counted here
    let vl = r.left, vr = r.right, vt = r.top, vb = r.bottom;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const st = getComputedStyle(a); if (st.overflowX !== 'visible' || st.overflowY !== 'visible') { const ar = a.getBoundingClientRect(); vl = Math.max(vl, ar.left); vr = Math.min(vr, ar.right); vt = Math.max(vt, ar.top); vb = Math.min(vb, ar.bottom); } }
    if (vr - vl < r.width * 0.6 || vb - vt < r.height * 0.6) continue;
    if (r.bottom <= 0 || r.right <= 0 || r.left >= W) continue;
    if (r.top >= H - 2 || r.bottom > H + 2) { if (!box) below.push(label + ` bottom ${Math.round(r.bottom)}/${H}`); continue; }
    if (e.matches('input[type="range"], input[type="checkbox"], input[type="radio"], input[type="color"]')) continue;
    const x = Math.min(W - 1, Math.max(0, (vl + vr) / 2)), y = (vt + vb) / 2;
    const top = document.elementFromPoint(x, y);
    const reached = !top || top === e || e.contains(top) || top.contains(e);
    if (modal && !modal.contains(e) && !reached) continue;
    if (e.closest('.map-pin, #world-map-labels')) continue;
    if (Math.min(r.width, r.height) < 36) small.push(label);
    if (top && top !== e && !e.contains(top) && !top.contains(e)) {
      // A tappable thing inside another (a row with a button in it) is reached through the inner one
      const inner = top.closest('button, a[href], [role="button"], .place-chip, [data-app], [data-act], label');
      // Under a bar that lies over its list (the phone's own buttons, a basket): fine while the list can still be scrolled on; at the end of the list it is a fault
      const more = box && box.scrollHeight - box.scrollTop - box.clientHeight > 4;
      if (!(inner && e.contains(inner)) && !(inner && inner.contains(e)) && !more) covered.push(label + ` under ${name(top)}`);
    }
  }
  const uniq = (l) => [...new Set(l)];
  return { off: off.map((o) => o.what).slice(0, 8), hits: hits.slice(0, 10), big, small: uniq(small).slice(0, 40), covered: uniq(covered).slice(0, 20), below: uniq(below).slice(0, 20) };
});

const closeAll = async (page) => {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-close, [data-close], .close-btn, [aria-label="Close"], .btn-close').forEach((b) => { if (b.offsetParent) b.click(); });
    window.game.hud.phoneModal?.close?.();
  });
  await page.keyboard.press('Escape');
  await wait(300);
};


async function phone(browser, W, H) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulate({ viewport: { width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
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
      // And with every list scrolled to its end: the last thing in it must come clear of any bar over it
      const scrolled = await page.evaluate(() => { let n = 0; for (const e of document.querySelectorAll('body *')) { if (e.scrollHeight > e.clientHeight + 8 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.getBoundingClientRect().height > 60) { e.scrollTop = e.scrollHeight; n += 1; } } return n; });
      if (scrolled) { await wait(250); const end = await measure(page); m.covered = [...new Set([...m.covered, ...end.covered.map((c) => c + ' (end of list)')])]; m.small = [...new Set([...m.small, ...end.small])]; }
      report[key] = m;
      if (process.env.PHONEFIT_SHOTS) await page.screenshot({ path: `${process.env.PHONEFIT_SHOTS}/${W}-${key}.png` });
    } catch (e) {
      report[key] = { error: String(e.message).slice(0, 120), off: [], hits: [], small: [], covered: [], below: [] };
    }
    await closeAll(page);
  };
  await surface('street', async () => {});
  await surface('toast', async () => page.evaluate(() => window.game.modules.showGameToast('You are fully rested. Stay in bed as long as you like, or get up when you are ready.', 'success', 6000)));
  await surface('street-card', async () => page.evaluate(() => { const g = window.game; const p = g.player.mesh.position; const o = g.world.interactiveObjects.filter((x) => x.interactionPoint).sort((a, b) => Math.hypot(a.interactionPoint.x - p.x, a.interactionPoint.z - p.z) - Math.hypot(b.interactionPoint.x - p.x, b.interactionPoint.z - p.z))[0]; g.hud.showInteractionCard(o); }));
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  await surface('look', async () => page.evaluate(() => window.game.hud.creatorModal.open('look')), 1200);
  await page.evaluate(() => { const b = document.getElementById('creator-save-btn'); if (b && b.offsetParent) b.click(); });
  await wait(600);
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
  // Every app the phone's home screen offers
  await page.evaluate(() => document.getElementById('nav-btn-phone').click());
  await wait(900);
  const apps = await page.evaluate(() => [...new Set([...document.querySelectorAll('#smartphone-wrapper .nlphone-app[data-app]')].map((b) => b.dataset.app))]);
  await closeAll(page);
  for (const app of apps) await surface(`app-${app}`, async () => page.evaluate((a) => window.game.hud.phoneModal.openApp(a), app), 900);
  await page.evaluate(() => { const g = window.game; g.hud.backend.performGig(5_000_000, 0, 'phonefit'); g.hud.backend.rentProperty('prop_mainland_apt'); g.hud.onEnterInterior('residence:prop_mainland_apt'); });
  await playUntil(page, () => (window.game.world.interiorManager.currentInterior?.type === 'residence' && !window.game.world.interiorManager.busy ? true : null), 25);
  await surface('home', async () => {}, 1500);
  await surface('home-card', async () => page.evaluate(() => document.getElementById('place-fold-btn')?.click()));
  const chips = await page.evaluate(() => [...document.querySelectorAll('.place-card .place-chip')].filter((c) => c.getBoundingClientRect().height > 0).map((c) => Math.round(c.getBoundingClientRect().height)));
  await surface('home-thing', async () => { await page.evaluate(() => [...document.querySelectorAll('.place-chip')].find((c) => /Fridge|Wardrobe|TV|Sofa/.test(c.textContent))?.click()); await wait(4000); }, 800);
  await page.evaluate(() => window.game.hud.hideInteractionCard());
  await surface('sleep', async () => { await page.evaluate(() => [...document.querySelectorAll('.place-chip')].find((c) => /Bed$/.test(c.textContent.trim()))?.click()); await wait(5000); await page.evaluate(() => [...document.querySelectorAll('#interaction-card button')].find((b) => /sleep|lie/i.test(b.textContent))?.click()); }, 3500);
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await playUntil(page, () => (!window.game.world.interiorManager.currentInterior && !window.game.world.interiorManager.busy ? true : null), 20);
  await surface('driving', async () => page.evaluate(() => { const g = window.game; const v = g.world.vehicles.drivableVehicles.find((x) => x.type === 'sedan'); g.player.mesh.position.copy(v.mesh.position); g.enterVehicle(v); }), 1500);
  await ctx.close();
  return { report, searchOpen, errors, chips };
}

export async function run(browser, check) {
  const all = {};
  for (const [W, H] of PHONES) {
    const { report, searchOpen, errors, chips } = await phone(browser, W, H);
    all[W] = report;
    // A banner shown for a moment when a door is passed lies over whatever is there: not a layout fault
    const passing = (h) => !/interior-transition-banner/.test(h);
    const list = (field, keep = () => true) => Object.entries(report).filter(([, r]) => (r[field] ?? []).filter(keep).length).map(([k, r]) => `${k}: ${r[field].filter(keep).join('; ')}`);
    const failed = Object.entries(report).filter(([, r]) => r.error).map(([k, r]) => `${k}: ${r.error}`);
    const offEdge = list('off'), onTop = list('hits', passing), small = list('small'), covered = list('covered'), below = list('below');
    check(`phonefit: at ${W} px across, nothing on ${Object.keys(report).length} surfaces runs past the edge of the screen`, offEdge.length === 0 && failed.length === 0, [...failed, ...offEdge].slice(0, 8));
    check(`phonefit: at ${W} px no panel lies on top of another (the top rows, the round buttons, the bar of buttons, the room card, the action button, toasts)`, onTop.length === 0, onTop.slice(0, 8));
    check(`phonefit: at ${W} px everything to tap is at least 36 px both ways`, small.length === 0, small.slice(0, 12));
    check(`phonefit: at ${W} px nothing to tap lies under something else or below the bottom of the screen`, covered.length + below.length === 0, [...covered, ...below].slice(0, 12));
    check(`phonefit: at ${W} px the chips on a room's card are 40 px tall or more`, chips.length > 0 && Math.min(...chips) >= 40, { chips: chips.slice(0, 6) });
    check(`phonefit: at ${W} px on the map the search is its icon until tapped, then a field to type in`, searchOpen, { searchOpen });
    check(`phonefit: at ${W} px no errors in the page`, errors.length === 0, errors.slice(0, 4));
  }
  if (process.env.PHONEFIT_REPORT) fs.writeFileSync(process.env.PHONEFIT_REPORT, JSON.stringify(all, null, 1));
}
