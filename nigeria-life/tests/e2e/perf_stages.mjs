// A measuring tool, not a suite: how long each stage of starting takes (the same record the game
// keeps for Settings > Graphics), on a phone-sized touch screen with the processor slowed.
//   CPU_SLOW=4 RUNS=2 GAME_URL=http://localhost:4206/ node tests/e2e/perf_stages.mjs
import { launch, newPlayer, wait, GAME_URL } from './lib.mjs';
const browser = await launch();
const slow = Number(process.env.CPU_SLOW || 4);
for (let i = 0; i < Number(process.env.RUNS || 2); i++) {
  const page = await (await newPlayer(browser)).newPage();
  await page.emulate({ viewport: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: slow });
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('nl_load_times_v1') || '[]').length > 0; } catch { return false; } }, { timeout: 600000, polling: 500 });
  console.log(`cpu/${slow}`, JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('nl_load_times_v1'))[0])));
  await page.close();
}
await browser.close();
