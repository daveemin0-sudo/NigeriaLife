// A brand-new player on a phone, from the first screen to the first pay, with real taps.
// The title welcomes them (it does not show a made-up life to "continue"); in the world one slim
// line says the next thing to do: a name and a look, walk, open the phone, take the first shift,
// collect the pay. Each step is ticked by what was really done. After a reload the title offers
// to continue their own life, by their own name, and the guide does not come back.
import { newPlayer, wait, GAME_URL } from './lib.mjs';

const PHONE = { viewport: { width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.emulate(PHONE);
  // The title and the guide are on, as they are for a real visitor
  await page.evaluateOnNewDocument(() => { window.__titleOn = true; window.__firstStepsOn = true; });
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction('window.game && window.titleScreen', { timeout: 240000 });
  await wait(1500);

  const centre = (sel) => page.evaluate((s) => {
    const e = [...document.querySelectorAll(s)].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && getComputedStyle(x).display !== 'none'; });
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, reachable: top === e || e.contains(top), inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
  }, sel);
  const tap = async (sel) => {
    const c = await centre(sel);
    if (c) await page.touchscreen.tap(c.x, c.y);
    await wait(500);
    return c;
  };
  const guide = () => page.evaluate(() => {
    const e = document.getElementById('nl-first-steps');
    if (!e || getComputedStyle(e).display === 'none') return null;
    const r = e.getBoundingClientRect();
    return { n: e.querySelector('.fs-n')?.textContent ?? '', text: e.querySelector('.fs-text')?.textContent ?? '', inView: r.left >= 0 && r.right <= innerWidth, button: e.querySelector('.fs-do')?.textContent ?? null };
  });
  const until = async (fn, seconds) => {
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
      const v = await fn();
      if (v) return v;
      await wait(300);
    }
    return null;
  };

  // ------------------------------------------------------------------ The first screen
  const title = await page.evaluate(() => {
    const card = document.getElementById('title-card');
    return { text: card?.innerText.replace(/\s+/g, ' ') ?? '', buttons: [...(card?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) };
  });
  check('onboarding: a first visit is welcomed and offered "Start your life": no made-up life to continue, no name that is not theirs',
    /Welcome/.test(title.text) && title.buttons.length === 1 && title.buttons[0] === 'Start your life' && !/Bayo/.test(title.text), title);
  const start = await tap('#title-continue');
  check('onboarding: the start button is on the screen and can be tapped', !!start && start.reachable && start.inView, start);

  // ------------------------------------------------------------------ A name and a look
  const first = await until(guide, 6);
  check('onboarding: in the world a slim guide says the first thing to do: a name and a look, with a button for it',
    !!first && first.n === '1/5' && /name/i.test(first.text) && first.button === 'Choose' && first.inView, first);
  const choose = await tap('#nl-first-steps .fs-do');
  await wait(900);
  const named = await page.evaluate(() => {
    const input = document.getElementById('creator-name-input');
    if (!input) return false;
    input.value = 'Tunde';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  const stepOut = await tap('#creator-save-btn');
  await wait(800);
  const afterName = await until(async () => { const g = await guide(); return g && g.n !== '1/5' ? g : null; }, 6);
  const name = await page.evaluate(() => window.game.hud.backend.getData().username);
  check('onboarding: Choose opens the look and name editor; with a name given the guide moves on to walking',
    !!choose?.reachable && named && !!stepOut?.reachable && name === 'Tunde' && !!afterName && afterName.n === '2/5' && /stick|arrow/i.test(afterName.text), { choose, named, afterName, name });

  // ------------------------------------------------------------------ Walk
  const stick = await centre('.v-joystick-base');
  if (stick) {
    await page.touchscreen.touchStart(stick.x, stick.y);
    await page.touchscreen.touchMove(stick.x, stick.y - 40);
    await until(async () => { const g = await guide(); return !!g && g.n !== '2/5'; }, 20);
    await page.touchscreen.touchEnd();
  }
  await wait(600);
  const afterWalk = await guide();
  check('onboarding: walking with the stick ticks the step, and the guide points at the phone', !!stick && !!afterWalk && afterWalk.n === '3/5' && /phone/i.test(afterWalk.text) && (await page.evaluate(() => document.getElementById('nav-btn-phone')?.classList.contains('fs-point'))), afterWalk);

  // ------------------------------------------------------------------ The phone, the first shift, the pay
  const phone = await tap('#nav-btn-phone');
  await wait(900);
  const before = await page.evaluate(() => { const d = window.game.hud.backend.getData(); return { money: d.walletCash + d.bank.balance, paid: d.career.completedGigs }; });
  await page.evaluate(() => window.game.hud.phoneModal.openApp('jobs'));
  await wait(700);
  const take = await tap('#smartphone-wrapper [data-start-job="job_shop_assistant"]');
  const onShift = await until(() => page.evaluate(() => window.game.hud.backend.getActiveJobShift() !== null), 5);
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(700);
  const waiting = await guide();
  check('onboarding: the phone opens from its button, the starter shift is taken from Jobs, and the guide then says to collect the pay',
    !!phone?.reachable && !!take && !!onShift && !!waiting && waiting.n === '5/5' && /collect/i.test(waiting.text), { phone, take, onShift, waiting });
  await until(() => page.evaluate(() => window.game.hud.backend.getActiveJobShift()?.isReady === true), 40);
  await tap('#nl-first-steps .fs-do');
  await wait(900);
  const claim = await tap('#btn-claim-shift-salary');
  await wait(1200);
  const after = await page.evaluate(() => { const d = window.game.hud.backend.getData(); return { money: d.walletCash + d.bank.balance, paid: d.career.completedGigs, guide: !!document.getElementById('nl-first-steps'), toast: [...document.querySelectorAll('.game-toast')].map((t) => t.textContent).join(' | ') }; });
  check('onboarding: the pay is collected (money up, one job done), the guide is gone and says what comes next',
    !!claim && after.paid === before.paid + 1 && after.money > before.money && !after.guide && /first pay/i.test(after.toast), { claim, before, after });

  // ------------------------------------------------------------------ Coming back
  await page.evaluate(() => window.game.hud.phoneModal.close());
  await wait(1500);
  await page.reload({ waitUntil: 'load', timeout: 240000 });
  await page.waitForFunction('window.game && window.titleScreen', { timeout: 240000 });
  await wait(1500);
  const back = await page.evaluate(() => { const card = document.getElementById('title-card'); return { text: card?.innerText.replace(/\s+/g, ' ') ?? '', buttons: [...(card?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim()) }; });
  await tap('#title-continue');
  await wait(2500);
  const again = await guide();
  check('onboarding: after a reload the title offers to continue their own life by their own name, and the guide does not come back',
    back.buttons.includes('Continue') && /Tunde/.test(back.text) && !/Welcome\./.test(back.text) && again === null, { back, again });

  check('onboarding: no errors in the page', errors.length === 0, errors.slice(0, 4));
  await ctx.close();
}
