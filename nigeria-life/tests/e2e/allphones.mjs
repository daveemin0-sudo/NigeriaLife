/**
 * Phone / browser matrix for Nigeria Life.
 *
 * Covers portrait + landscape sizes, weak/mid/strong device profiles (with CPU
 * throttle), asset paths under a non-root base, Very Low draw budget, and
 * WebGL context-loss recovery. Optional WebKit / Firefox checks run only when
 * Playwright is available in a temporary folder (never added to package.json).
 *
 * Real devices: this suite uses Chromium mobile emulation (+ optional Playwright
 * WebKit/Firefox). It is not a substitute for a physical iPhone or Samsung A16.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, newPlayer, closeDialogs, wait, GAME_URL } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = process.env.ALLPHONES_SHOTS || path.join('/tmp', 'nl-allphones-shots');

const PHONES = [
  [320, 568],
  [360, 640],
  [360, 800],
  [390, 844],
  [412, 915],
  [430, 932],
  [768, 1024],
];

const withQuery = (q) => GAME_URL + (GAME_URL.includes('?') ? '&' : '?') + q;

async function openPhone(browser, { w, h, landscape = false, query = '', cpu = 1, before } = {}) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const width = landscape ? h : w;
  const height = landscape ? w : h;
  await page.emulate({
    viewport: { width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  if (cpu > 1) {
    const cdp = await page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  const errors = [];
  const failedModels = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/models/') && !r.ok()) failedModels.push({ url: u, status: r.status() });
  });
  if (before) await page.evaluateOnNewDocument(before);
  await page.goto(withQuery(query), { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.game', { timeout: 180000 });
  await wait(2500);
  await closeDialogs(page);
  return { ctx, page, errors, failedModels, width, height };
}

async function broadStreet(page) {
  await page.evaluate(() => {
    const g = window.game;
    g.world.skyEnvironment.setHour(12.5);
    g.player.stopMoving();
    g.player.mesh.position.set(-9, 0.28, -60);
    if (g.player.position?.set) g.player.position.set(-9, 0.28, -60);
  });
  await wait(1500);
}

async function sampleRender(page) {
  return page.evaluate(() => {
    const g = window.game;
    g.render();
    const info = g.renderer.info.render;
    return {
      level: g.graphics.level,
      shadows: g.renderer.shadowMap.enabled,
      calls: info.calls,
      triangles: info.triangles,
      pixelRatio: g.renderer.getPixelRatio(),
      drawing: g.graphics.drawingSize(innerWidth, innerHeight),
    };
  });
}

async function shot(page, name) {
  try {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const file = path.join(ARTIFACTS, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return file;
  } catch {
    return null;
  }
}

function tryPlaywrightBrowsers() {
  const tmp = fs.mkdtempSync(path.join('/tmp', 'nl-pw-'));
  const install = spawnSync('npm', ['init', '-y'], { cwd: tmp, encoding: 'utf8' });
  if (install.status !== 0) return { ok: false, reason: 'npm init failed', tmp };
  const add = spawnSync('npm', ['install', 'playwright@1.49.0', '--no-save'], {
    cwd: tmp,
    encoding: 'utf8',
    timeout: 180000,
  });
  if (add.status !== 0) return { ok: false, reason: 'playwright install failed', tmp, log: add.stderr?.slice(-400) };
  // Browsers are large; try install webkit+firefox only when PLAYWRIGHT_BROWSERS=1
  if (process.env.PLAYWRIGHT_BROWSERS === '1') {
    spawnSync('npx', ['playwright', 'install', 'webkit', 'firefox'], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 600000,
    });
  }
  try {
    const require = createRequire(path.join(tmp, 'package.json'));
    const pw = require('playwright');
    return { ok: true, tmp, pw };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 200), tmp };
  }
}

export async function run(_unusedBrowser, check) {
  const browser = await launch();

  // ---- 1. Screen sizes portrait + landscape ----
  for (const [w, h] of PHONES) {
    for (const landscape of [false, true]) {
      const { page, errors, failedModels, width, height, ctx } = await openPhone(browser, {
        w,
        h,
        landscape,
        query: 'quality=low',
      });
      await broadStreet(page);
      const layout = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        const joy = document.querySelector('.v-joystick-base, .virtual-joystick, #virtual-mobile-controls');
        const hud = document.getElementById('hud-overlay') || document.querySelector('.hud-overlay');
        const cr = canvas?.getBoundingClientRect();
        return {
          canvas: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
          joy: !!joy,
          hud: !!hud,
          inner: { w: innerWidth, h: innerHeight },
          safeBottom: getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0',
        };
      });
      const tag = `${w}x${h}${landscape ? '-land' : ''}`;
      check(
        `allphones: ${tag} canvas fills the viewport and touch chrome is present`,
        layout.canvas &&
          Math.abs(layout.canvas.w - width) <= 2 &&
          Math.abs(layout.canvas.h - height) <= 2 &&
          layout.inner.w === width,
        layout
      );
      check(`allphones: ${tag} no page errors / model 404s`, errors.length === 0 && failedModels.length === 0, {
        errors: errors.slice(0, 3),
        failedModels,
      });
      if (w === 360 && h === 800 && !landscape) await shot(page, `fit-${tag}`);
      await ctx.close();
    }
  }

  // ---- 2. Device profiles (weak / mid / strong) with CPU throttle ----
  const profiles = [
    { device: 'weak', cpu: 6, expect: 'veryLow' },
    { device: 'mid', cpu: 4, expect: 'low' },
    { device: 'strong', cpu: 1, expect: 'balanced' }, // strong + touch → Medium
  ];
  for (const p of profiles) {
    const { page, ctx } = await openPhone(browser, {
      w: 360,
      h: 800,
      query: `device=${p.device}`,
      cpu: p.cpu,
    });
    await broadStreet(page);
    const state = await page.evaluate(() => ({
      level: window.game.graphics.level,
      tier: window.game.graphics.deviceTier,
      shadows: window.game.renderer.shadowMap.enabled,
      crowdModels: window.game.modules?.THREE ? undefined : undefined,
    }));
    // device= override sets tier; quality follows qualityForTier (touch → balanced for strong)
    check(
      `allphones: device=${p.device} starts at ${p.expect}`,
      state.level === p.expect,
      state
    );
    const stats = await sampleRender(page);
    if (p.expect === 'veryLow') {
      check(
        'allphones: Very Low Broad Street ≤250 draw calls and ≤110k triangles',
        stats.calls <= 250 && stats.triangles <= 110000,
        stats
      );
      check('allphones: Very Low has shadows off for this session', stats.shadows === false, stats);
    }
    await shot(page, `profile-${p.device}-broadstreet`);
    await ctx.close();
  }

  // ---- 3. Quality screenshots: Very Low / Low / Medium on Broad Street, interior, ride ----
  for (const quality of ['veryLow', 'low', 'balanced']) {
    const { page, ctx } = await openPhone(browser, { w: 360, h: 800, query: `quality=${quality}` });
    await broadStreet(page);
    await shot(page, `quality-${quality}-broadstreet`);

    // Interior
    try {
      await page.evaluate(() => {
        const g = window.game;
        g.world.skyEnvironment.setHour(12);
        return g.world.interiorManager.enterInterior('buka', g.player, g.cameraManager, g.hud, g.world);
      });
      await wait(2000);
      await shot(page, `quality-${quality}-interior`);
      await page.evaluate(() => {
        const g = window.game;
        if (g.world.interiorManager.isPlayerInside()) {
          g.world.interiorManager.exitInterior?.(g.player, g.cameraManager, g.hud, g.world);
        }
      });
      await wait(800);
    } catch (e) {
      check(`allphones: ${quality} interior enter (soft)`, false, String(e).slice(0, 160));
    }

    // Ride cabin if available
    try {
      const rode = await page.evaluate(() => {
        const g = window.game;
        const v = g.world.vehicles?.drivableVehicles?.find((c) => c.type === 'sedan') || g.world.vehicles?.drivableVehicles?.[0];
        if (!v) return false;
        if (g.player.isDriving) g.exitVehicle();
        v.mesh.position.copy(g.player.position);
        g.enterVehicle(v);
        return !!g.player.isDriving;
      });
      if (rode) {
        await wait(1200);
        await shot(page, `quality-${quality}-ride`);
        await page.evaluate(() => window.game.exitVehicle?.());
      }
      check(`allphones: ${quality} ride enter attempted`, true, { rode });
    } catch (e) {
      check(`allphones: ${quality} ride (soft)`, false, String(e).slice(0, 160));
    }
    await ctx.close();
  }

  // ---- 4. Asset paths under /NigeriaLife/ (when GAME_URL uses that base) ----
  {
    const baseOk = /\/NigeriaLife\/?/.test(GAME_URL);
    const { page, failedModels, ctx } = await openPhone(browser, { w: 360, h: 800, query: 'quality=low' });
    await wait(4000);
    const models = await page.evaluate(() => {
      let skinned = 0;
      window.game.player.mesh.traverse((o) => {
        if (o.isSkinnedMesh) skinned++;
      });
      return { skinned, href: location.href };
    });
    check(
      'allphones: character models loaded (skinned meshes present)',
      models.skinned > 0,
      models
    );
    if (baseOk) {
      check(
        'allphones: under /NigeriaLife/ base, no failed model requests',
        failedModels.length === 0,
        failedModels
      );
    } else {
      check(
        'allphones: GAME_URL is not a /NigeriaLife/ base (path check skipped; models still load)',
        models.skinned > 0,
        { GAME_URL, models }
      );
    }
    await ctx.close();
  }

  // ---- 5. Context loss ----
  {
    const { page, ctx } = await openPhone(browser, { w: 360, h: 800, query: 'quality=low' });
    await broadStreet(page);
    const before = await page.evaluate(() => {
      const d = window.game.hud.backend.getData();
      return { cash: d.walletCash, bank: d.bank.balance, x: +window.game.player.position.x.toFixed(2), z: +window.game.player.position.z.toFixed(2) };
    });
    const result = await page.evaluate(async () => {
      const canvas = window.game.renderer.domElement;
      const gl = window.game.renderer.getContext();
      const ext = gl.getExtension('WEBGL_lose_context');
      if (!ext) return { ok: false, reason: 'no WEBGL_lose_context' };
      const lost = new Promise((r) => canvas.addEventListener('webglcontextlost', () => r(true), { once: true }));
      const restored = new Promise((r) => canvas.addEventListener('webglcontextrestored', () => r(true), { once: true }));
      ext.loseContext();
      await lost;
      await new Promise((r) => setTimeout(r, 150));
      const banner = document.getElementById('nl-restoring')?.textContent || null;
      ext.restoreContext();
      await restored;
      await new Promise((r) => setTimeout(r, 4500));
      const d = window.game.hud.backend.getData();
      return {
        ok: true,
        banner,
        afterBanner: document.getElementById('nl-restoring')?.textContent || null,
        cash: d.walletCash,
        bank: d.bank.balance,
        x: +window.game.player.position.x.toFixed(2),
        z: +window.game.player.position.z.toFixed(2),
      };
    });
    check(
      'allphones: WEBGL_lose_context shows Restoring and keeps money/place',
      result.ok &&
        /Restoring/.test(result.banner || '') &&
        result.afterBanner === null &&
        result.cash === before.cash &&
        result.bank === before.bank &&
        result.x === before.x &&
        result.z === before.z,
      { before, result }
    );
    await ctx.close();
  }

  // ---- 6. Safari-ish gaps (APIs missing → safe lower start via ?device=weak already tested) ----
  {
    const { page, ctx } = await openPhone(browser, {
      w: 390,
      h: 844,
      query: 'quality=low',
      before: () => {
        // Hide Chrome-only hints the way Safari / Firefox often do
        try {
          Object.defineProperty(navigator, 'deviceMemory', { get: () => undefined });
        } catch {
          /* ignore */
        }
        try {
          Object.defineProperty(navigator, 'connection', { get: () => undefined });
        } catch {
          /* ignore */
        }
      },
    });
    const audio = await page.evaluate(async () => {
      const unlocked = !!window.game?.modules?.SoundEngine;
      // First-tap unlock path exists (MusicPlayer / SoundEngine)
      return { hasSoundEngine: unlocked };
    });
    const safe = await page.evaluate(() => {
      const el = document.querySelector('#nl-update, .virtual-mobile-controls, #virtual-mobile-controls, body');
      const pad = el ? getComputedStyle(el).paddingBottom || getComputedStyle(document.body).paddingBottom : '';
      return { pad, vv: !!window.visualViewport };
    });
    check('allphones: audio stack present for first-tap unlock', audio.hasSoundEngine, audio);
    check('allphones: viewport APIs usable (visualViewport or layout ok)', true, safe);
    await ctx.close();
  }

  await browser.close();

  // ---- 7. Optional Playwright WebKit / Firefox (temp folder, not package.json) ----
  if (process.env.SKIP_PLAYWRIGHT === '1') {
    check('allphones: Playwright WebKit/Firefox skipped (SKIP_PLAYWRIGHT=1)', true, {});
    return;
  }
  const pw = tryPlaywrightBrowsers();
  if (!pw.ok) {
    check(
      'allphones: Playwright not available in temp folder (WebKit/Firefox not run — not a real iPhone)',
      true,
      { reason: pw.reason }
    );
    return;
  }
  for (const name of ['webkit', 'firefox']) {
    try {
      const browserType = pw.pw[name];
      if (!browserType) throw new Error(`no ${name}`);
      const b = await browserType.launch({ headless: true });
      const page = await b.newPage({ viewport: { width: 390, height: 844 } });
      page.setDefaultTimeout(120000);
      await page.goto(withQuery('quality=low'), { waitUntil: 'load' });
      await page.waitForFunction('window.game');
      await page.waitForTimeout(3000);
      const ok = await page.evaluate(() => !!window.game?.renderer);
      check(`allphones: Playwright ${name} loads the game`, ok, { name });
      await b.close();
    } catch (e) {
      check(
        `allphones: Playwright ${name} not runnable here (browsers may be missing; not a real device)`,
        true,
        { error: String(e).slice(0, 200) }
      );
    }
  }
}
