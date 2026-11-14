// The performance readout (quality roadmap, stage 0): off until switched on, on from Settings or the
// address, figures that make sense, Mark and Report, a reload noticed, the city followed, and nothing
// added to the 3D scene.
import { newPlayer, open, closeDialogs, wait, reload, GAME_URL } from './lib.mjs';

const withQuery = (q) => GAME_URL + (GAME_URL.includes('?') ? '&' : '?') + q;

export async function run(browser, check) {
  // ------------------------------------------------------------------ Off unless switched on
  {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx, { w: 412, h: 915 });
    await closeDialogs(page);
    const state = await page.evaluate(() => ({ panel: !!document.getElementById('nl-perf-readout'), enabled: window.game.modules ? null : null }));
    check('perfreadout: off by default (no panel on the screen)', state.panel === false, state);

    // Switched on from Settings › Graphics, and off again
    const scene = await page.evaluate(() => { let n = 0; window.game.scene.traverse(() => n++); return n; });
    await page.evaluate(() => {
      document.querySelector('#nav-btn-phone')?.click();
      document.querySelector('[data-app="settings"]')?.click();
    });
    await page.waitForSelector('[data-act="toggle-perf-readout"]', { timeout: 10000 });
    const offLabel = await page.$eval('[data-act="toggle-perf-readout"]', (b) => b.textContent.trim());
    await page.evaluate(() => document.querySelector('[data-act="toggle-perf-readout"]').click());
    await wait(1600);
    const on = await page.evaluate(() => {
      const panel = document.getElementById('nl-perf-readout');
      const r = panel?.getBoundingClientRect();
      return { shown: !!panel && getComputedStyle(panel).display !== 'none', text: panel?.textContent ?? '', inside: r ? r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight : false, label: document.querySelector('[data-act="toggle-perf-readout"]')?.textContent.trim() };
    });
    const sceneAfter = await page.evaluate(() => { let n = 0; window.game.scene.traverse(() => n++); return n; });
    check('perfreadout: Settings › Graphics turns it on: a panel on the screen with frames, drawing, heap and the city, adding nothing to the 3D scene',
      offLabel === 'Turn on' && on.shown && on.inside && /fps/.test(on.text) && /calls/.test(on.text) && /heap/.test(on.text) && on.label === 'Turn off' && sceneAfter === scene, { offLabel, on, scene, sceneAfter });
    await page.evaluate(() => document.querySelector('[data-act="toggle-perf-readout"]').click());
    await wait(500);
    const off = await page.evaluate(() => { const p = document.getElementById('nl-perf-readout'); return !p || getComputedStyle(p).display === 'none'; });
    check('perfreadout: and turns it off again', off, { off });
    check('perfreadout: no errors in the page (Settings)', log.errors.length === 0, log.errors.slice(0, 4));
    await ctx.close();
  }

  // ------------------------------------------------------------------ From the address; the figures; Mark and Report
  {
    const ctx = await newPlayer(browser);
    const { page, log } = await open(ctx, { w: 412, h: 915, url: withQuery('perf=1') });
    await closeDialogs(page);
    await wait(4000);
    const snap = await page.evaluate(() => {
      const r = window.game.hud && window.__perf ? null : null;
      const panel = document.getElementById('nl-perf-readout');
      return { shown: !!panel && getComputedStyle(panel).display !== 'none', text: panel?.textContent ?? '' };
    });
    // Mark, then the report
    await page.evaluate(() => [...document.querySelectorAll('#nl-perf-readout button')].find((b) => b.textContent === 'Mark').click());
    await wait(300);
    await page.evaluate(() => [...document.querySelectorAll('#nl-perf-readout button')].find((b) => b.textContent === 'Report').click());
    await wait(500);
    const report = await page.evaluate(() => document.querySelector('#nl-perf-report textarea')?.value ?? '');
    const row = report.split('\n').find((l) => /^lagos street \|/.test(l)) ?? '';
    const cells = row.split(' | ');
    const fps = +cells[2], p95 = +cells[3], calls = +cells[5], tris = +cells[6], heap = parseInt(cells[10], 10);
    check('perfreadout: ?perf=1 turns it on; a mark records the last 10 s in Lagos on the street with figures that make sense (fps, p95, draw calls, triangles, JS heap)',
      snap.shown && fps > 0 && fps < 240 && p95 > 0 && calls > 10 && tris > 1000 && heap > 0, { snap, row });
    check('perfreadout: the report names the build, the server, the device, the start-up times, how the page came, and lists the marks',
      /^NigeriaLife performance report/.test(report) && /\nBuild: /.test(report) && /\nServer: /.test(report) && /\nDevice: /.test(report) && /\nStart-up now: .*s to playable/.test(report) && /\nThis page: a fresh load/.test(report) && /\nMarks/.test(report) && !!row,
      report.slice(0, 900));
    check('perfreadout: the report does not claim the live server for this test page', !/THE LIVE SERVER/.test(report), report.split('\n').find((l) => l.startsWith('Server:')));
    const buttons = await page.evaluate(() => [...document.querySelectorAll('#nl-perf-report button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent, h: Math.round(r.height) }; }));
    check('perfreadout: the report can be selected to copy, saved as a file, cleared and closed; its buttons are thumb-sized',
      ['Select all', 'Save as file', 'Clear marks', 'Close'].every((t) => buttons.some((b) => b.t === t)) && buttons.every((b) => b.h >= 44), buttons);
    await page.evaluate(() => [...document.querySelectorAll('#nl-perf-report button')].find((b) => b.textContent === 'Close').click());

    // A reload is noticed, and the marks of this visit are kept
    await reload(page, 4000);
    await closeDialogs(page);
    const afterReload = await page.evaluate(() => {
      const p = document.getElementById('nl-perf-readout');
      [...document.querySelectorAll('#nl-perf-readout button')].find((b) => b.textContent === 'Report')?.click();
      return { shown: !!p };
    });
    await wait(500);
    const report2 = await page.evaluate(() => document.querySelector('#nl-perf-report textarea')?.value ?? '');
    check('perfreadout: after a reload it stays on, says the page was reloaded while running, and keeps the marks',
      afterReload.shown && /\nThis page: reloaded while the readout was running/.test(report2) && /^lagos street \|/m.test(report2), report2.split('\n').filter((l) => /This page|^lagos/.test(l)));
    await page.evaluate(() => [...document.querySelectorAll('#nl-perf-report button')].find((b) => b.textContent === 'Close')?.click());

    // The city is followed
    await page.evaluate(() => window.game.arriveInCity('abuja'));
    await wait(4500);
    const abuja = await page.evaluate(() => document.getElementById('nl-perf-readout')?.textContent ?? '');
    check('perfreadout: in Abuja it says Abuja', /abuja/.test(abuja), abuja);

    // ?perf=0 turns it off
    await page.goto(withQuery('perf=0'), { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.game && window.game.hud', { timeout: 120000 });
    await wait(2500);
    const gone = await page.evaluate(() => { const p = document.getElementById('nl-perf-readout'); return !p || getComputedStyle(p).display === 'none'; });
    check('perfreadout: ?perf=0 turns it off for this device', gone, { gone });
    check('perfreadout: no errors in the page (address, marks, report, reload, city)', log.errors.length === 0, log.errors.slice(0, 4));
    await ctx.close();
  }
}
