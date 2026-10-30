// The map at a phone's size and a laptop's: the map, a place's card, the search (scratch capture)
import { launch, newPlayer, wait, advance } from './lib.mjs';
const out = process.argv[2];
const tag = process.argv[3] ?? 'map';
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
  await page.evaluate(() => document.getElementById('nav-btn-map')?.click());
  await advance(page, 1.5);
  await wait(1200);
  await page.screenshot({ path: `${out}/${tag}-${name}-map.png` });
  // A place's card
  await page.evaluate(() => {
    const pins = Array.from(document.querySelectorAll('#map-pin-layer [data-place], #map-pin-layer .map-pin'));
    const seen = pins.filter((p) => { const r = p.getBoundingClientRect(); return r.width && r.top > 140 && r.top < innerHeight - 200 && r.left > 20 && r.right < innerWidth - 20; });
    (seen[Math.floor(seen.length / 2)] ?? pins[0])?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(900);
  await page.screenshot({ path: `${out}/${tag}-${name}-mapcard.png` });
  await page.evaluate(() => document.getElementById('map-card-close')?.click());
  // Search
  await page.evaluate(() => { const s = document.getElementById('map-search-input'); s.focus(); s.value = 'bank'; s.dispatchEvent(new Event('input')); });
  await wait(600);
  await page.screenshot({ path: `${out}/${tag}-${name}-mapsearch.png` });
  await ctx.close();
}

await shots(420, 816, 2, true, 'phone');
await shots(1366, 768, 1, false, 'laptop');
await browser.close();
