// Shared helpers for the browser tests. They drive the real game in headless Chrome.
//
//   GAME_URL     where the dev server is running (default http://localhost:5174/)
//   CHROME_PATH  path to a Chrome/Chromium executable, if it is not in the usual place
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

export const GAME_URL = process.env.GAME_URL || 'http://localhost:5174/';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.');
  return found;
}

export async function launch() {
  return puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: [
      // Real GPU rendering, so WebGL behaves as it does for a player
      '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });
}

/** A private browser context: a brand new player with an empty save. */
export const newPlayer = (browser) => browser.createBrowserContext();

/** Opens the game and waits until it is running. `before` is script text run before the page loads. */
export async function open(ctx, opts = {}) {
  const page = await ctx.newPage();
  await page.setViewport({ width: opts.w || 1366, height: opts.h || 768 });
  const log = { errors: [] };
  page.on('pageerror', (e) => log.errors.push('PAGEERR ' + e.message.slice(0, 240)));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push('CONSOLE ' + m.text().slice(0, 240)); });
  if (opts.before) await page.evaluateOnNewDocument(opts.before);
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game', { timeout: 120000 });
  await wait(opts.settle ?? 3000);
  return { page, log };
}

export async function reload(page, settle = 2500) {
  await page.reload({ waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game', { timeout: 120000 });
  await wait(settle);
}

export const money = (page) => page.evaluate(() => {
  const d = window.game.hud.backend.getData();
  return { cash: d.walletCash, bank: d.bank.balance, total: d.walletCash + d.bank.balance, ledger: (d.transactionHistory || []).length };
});

export const quest = (page, id) => page.evaluate((qid) => {
  const q = window.game.hud.questManager.getAllQuests().find((x) => x.id === qid);
  return { status: q.status, obj: Object.fromEntries(q.objectives.map((o) => [o.id, o.isCompleted])) };
}, id);

export async function enterInterior(page, type) {
  await page.evaluate((t) => { const g = window.game; return g.world.interiorManager.enterInterior(t, g.player, g.cameraManager, g.hud, g.world); }, type);
  await wait(900);
}

export async function leaveInterior(page) {
  await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
  await wait(900);
}

export async function closeDialogs(page) {
  await page.evaluate(() => document.getElementById('dialogue-confirm-btn')?.click());
  if (await page.evaluate(() => !!document.getElementById('game-dialogue-overlay'))) await page.keyboard.press('Escape');
  await wait(120);
}

/**
 * What a player does at a station: stand at it, press E for its card, press the card's button.
 * `inside` picks the current interior's objects; otherwise the street's.
 */
export async function useStation(page, id, inside = true) {
  const prompt = await page.evaluate(async ({ id, inside }) => {
    const g = window.game;
    const list = inside ? g.world.interiorManager.getActiveInteractiveObjects() : g.world.interactiveObjects;
    const o = list.find((x) => x.id === id);
    if (!o) return 'not-found';
    document.getElementById('dialogue-confirm-btn')?.click();
    document.getElementById('game-dialogue-overlay')?.remove();
    g.hud.hideInteractionCard();
    g.player.stopMoving();
    g.player.mesh.position.set(o.interactionPoint.x, 0, o.interactionPoint.z);
    await new Promise((r) => setTimeout(r, 250));
    return g.hud.currentInteractionTarget?.id || 'no-prompt';
  }, { id, inside });
  if (prompt !== id) return { ok: false, prompt };
  await page.keyboard.press('e');
  await wait(350);
  const card = await page.evaluate(() => {
    const btn = document.getElementById('card-action-btn');
    const obj = window.game.hud.currentActiveObject;
    if (btn && obj) { btn.click(); return obj.id; }
    return null;
  });
  await wait(350);
  return { ok: true, card };
}

export function reporter() {
  const results = [];
  const check = (name, pass, detail) => {
    results.push({ name, pass: !!pass });
    let extra = '';
    if (detail !== undefined) {
      const text = JSON.stringify(detail);
      extra = '  ' + (pass && text.length > 200 ? text.slice(0, 200) + '…' : text);
    }
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra}`);
  };
  const summary = () => {
    const failed = results.filter((r) => !r.pass);
    console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
    for (const f of failed) console.log('  FAILED: ' + f.name);
    return failed.length;
  };
  return { check, summary };
}
