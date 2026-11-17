// Journey card on a phone: fits 320×607, nothing covers Skip / badges / camera pills.
import { launch, wait, newPlayer, closeDialogs, GAME_URL } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));

  await page.emulate({
    viewport: { width: 320, height: 607, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A165F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  });
  await page.goto(GAME_URL, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction('window.game && window.game.hud', { timeout: 180000 });
  await wait(2000);
  await closeDialogs(page);

  const shown = await page.evaluate(() => {
    const t = window.game.transitHUD;
    if (!t?.showRideHUD) return false;
    t.showRideHUD({
      vehicleName: 'SwiftRoute coach SR 12',
      originName: 'Jibowu Motor Park',
      destinationName: 'Utako Motor Park',
      trafficCondition: 'Clear',
      weatherCondition: 'Sunny',
    }, {});
    t.updateRideProgress(4);
    return true;
  });
  await wait(400);

  const layout = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      return {
        left: +r.left.toFixed(1),
        top: +r.top.toFixed(1),
        right: +r.right.toFixed(1),
        bottom: +r.bottom.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
        inside: r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1,
      };
    };
    const card = document.getElementById('ride-hud-card');
    const cams = document.getElementById('ride-camera-bar');
    const skip = document.getElementById('btn-ride-skip');
    const music = document.querySelector('.music-fab, #music-fab');
    const leave = document.getElementById('place-leave-btn');
    const view = document.getElementById('view-fab');
    const menu = document.getElementById('top-menu-btn');
    const shift = document.querySelector('.ride-shift-time');
    const camRects = [...(cams?.querySelectorAll('.ride-cam-btn') ?? [])].map(box);
    const cardBox = box(card);
    const camsBox = box(cams);
    const skipBox = box(skip);
    const menuBox = box(menu);
    const overlaps = (a, b) => a && b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    const visible = (el) => !!(el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getBoundingClientRect().width > 0);
    return {
      vw,
      vh,
      card: cardBox,
      cams: camsBox,
      skip: skipBox,
      camRects,
      musicVisible: visible(music),
      leaveVisible: visible(leave),
      viewVisible: visible(view),
      menuVisible: visible(menu),
      menuOverCard: overlaps(cardBox, menuBox),
      shiftGone: !shift,
      cardOverCams: overlaps(cardBox, camsBox),
      mode: document.body.getAttribute('data-ui-mode'),
    };
  });

  check('journeycard: ride HUD can be shown at 320×607', shown && !!layout.card && layout.vw === 320, { shown, card: layout.card });
  check('journeycard: the card stays fully on screen', !!layout.card?.inside, layout.card);
  check('journeycard: Skip ride stays fully on screen and thumb-sized',
    !!layout.skip?.inside && layout.skip.h >= 40, layout.skip);
  check('journeycard: camera pills stay on screen and do not sit on the card',
    !!layout.cams?.inside && !layout.cardOverCams && layout.camRects.every((c) => c?.inside),
    { cams: layout.cams, over: layout.cardOverCams });
  check('journeycard: music / leave / view / ⌄ do not sit on the journey card',
    !layout.musicVisible && !layout.leaveVisible && !layout.viewVisible && !layout.menuVisible && !layout.menuOverCard,
    { music: layout.musicVisible, leave: layout.leaveVisible, view: layout.viewVisible, menu: layout.menuVisible });
  check('journeycard: the fake "Shift started · Home at …" line is gone',
    layout.shiftGone, { shiftGone: layout.shiftGone });
  check('journeycard: no page errors', errors.length === 0, errors.slice(0, 4));

  await ctx.close();
}

// Allow running alone: node tests/e2e/journeycard.mjs
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('journeycard.mjs')) {
  const { reporter } = await import('./lib.mjs');
  const { check, summary } = reporter();
  const browser = await launch();
  try {
    await run(browser, check);
  } finally {
    await browser.close();
  }
  process.exit(summary() ? 1 : 0);
}
