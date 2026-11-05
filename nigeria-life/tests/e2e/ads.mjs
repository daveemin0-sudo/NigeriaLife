// Eko Ads: billboards on the expressway rented from the phone. Every unipole face is listed with
// where it stands and its price; a board is rented by writing a headline, picking a colour and a
// length and pressing the button; the rent leaves the bank once; the advert is painted on that
// board in the world (and drawn, when the player is near); an advert naming a business the
// player owns lifts its takings; when the rental runs out the board's own advert comes back.
import { open, newPlayer, closeDialogs, wait, money, playUntil } from './lib.mjs';

const tap = async (page, selector) => {
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, reachable: !!top && (top === el || el.contains(top)) };
  }, selector);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await wait(300);
  return at.reachable;
};

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.setViewport({ width: 420, height: 860 });
  await wait(600);
  await page.evaluate(() => {
    const g = window.game;
    g.modules.Adverts.now = () => Date.now();
    g.modules.Adverts.get().clear();
    g.hud.backend.data.bank.balance = 5_000_000;
    g.hud.backend.saveData();
    g.hud.phoneModal.open();
    g.hud.phoneModal.openApp('ads');
  });
  await wait(900);
  const list = await page.evaluate(() => {
    const boards = window.game.modules.Adverts.get().boards();
    const rows = [...document.querySelectorAll('#ads-boards [data-board]')].map((el) => el.dataset.board);
    return { boards: boards.length, rows: rows.length, first: rows[0], faces: new Set(boards.map((b) => b.face.face)).size, named: boards.every((b) => b.near && b.km) };
  });
  check('ads: Eko Ads lists every billboard face on the expressway, each with where it stands and a price a day', list.boards >= 40 && list.rows === list.boards && list.faces === 2 && list.named, list);

  // Rent the first island board for a day
  let opened = await tap(page, `#ads-boards [data-board="${list.first}"]`);
  await wait(500);
  const where = await page.evaluate(() => ({ field: !!document.getElementById('ads-headline'), title: document.querySelector('#smartphone-wrapper')?.innerText.slice(0, 80) }));
  if (!where.field) {
    console.log('ads: first tap did not open the board', JSON.stringify({ opened, where }));
    opened = await tap(page, `#ads-boards [data-board="${list.first}"]`) && false;
    await wait(500);
  }
  await page.evaluate(() => { for (const id of ['ads-headline', 'ads-line']) { const el = document.getElementById(id); if (el) el.value = ''; } });
  await page.focus('#ads-headline');
  await page.keyboard.type('Mama T Suya');
  await page.focus('#ads-line');
  await page.keyboard.type('Hot every night on Allen');
  await wait(300);
  await tap(page, '.ea-swatch:nth-child(3)');
  await tap(page, '[data-set="ads.days"][data-value="1"]');
  await wait(300);
  const previewText = await page.evaluate(() => document.getElementById('ads-preview')?.innerText ?? '');
  check('ads: the board opens with a preview that shows the words as they are typed', opened && /MAMA T SUYA/i.test(previewText) && /Hot every night/.test(previewText), { opened, previewText });
  const m0 = await money(page);
  const price = await page.evaluate((id) => window.game.modules.Adverts.get().boards().find((b) => b.face.id === id) && Number(document.getElementById('ads-rent').textContent.replace(/[^\d]/g, '')), list.first);
  const rented = await tap(page, '#ads-rent');
  await wait(800);
  const m1 = await money(page);
  const painted = await page.evaluate((id) => {
    const { Adverts } = window.game.modules;
    const face = Adverts.get().boards().find((b) => b.face.id === id).face;
    const map = face.mesh.material.map;
    return { showing: window.game.modules.Adverts.get().mine().map((r) => r.headline), notBase: map !== face.base, canvas: map?.image?.width ?? 0, z: face.z, x: face.x };
  }, list.first);
  check('ads: Put it up takes the day’s rent from the bank once and paints the advert on that board in the world',
    rented && m0.bank - m1.bank === price && price > 0 && painted.showing[0] === 'Mama T Suya' && painted.notBase && painted.canvas === 640, { rented, paid: m0.bank - m1.bank, price, painted });

  // Seen where it stands: the player beside it, the board and everything above it drawn
  await page.evaluate((at) => {
    const g = window.game;
    g.hud.phoneModal.close();
    g.player.stopMoving?.();
    g.player.mesh.position.set(at.x > 0 ? at.x - 8 : at.x + 8, 0, at.z - 25);
  }, painted);
  const drawn = await playUntil(page, (id) => {
    const face = window.game.modules.Adverts.get().boards().find((b) => b.face.id === id).face;
    for (let o = face.mesh; o; o = o.parent) if (!o.visible) return null;
    return true;
  }, 10, list.first);
  check('ads: walking up to the board, it is drawn (it and everything it hangs from are visible)', drawn === true, { drawn });

  // An advert for a business the player owns lifts its takings
  const lift = await page.evaluate(async () => {
    const g = window.game;
    const { Adverts } = g.modules;
    const b = g.hud.backend.data.businesses[0];
    b.owned = true;
    g.hud.backend.saveData();
    const before = Adverts.get().lift(b.id);
    const second = Adverts.get().boards().find((s) => !s.rental && s.face.z > 2000).face.id;
    const why = await Adverts.get().rent(second, 7, { headline: 'Shop with us', line: '', colour: '#0b7a43', business: b.id });
    return { before, after: Adverts.get().lift(b.id), why, other: Adverts.get().lift('nobody') };
  });
  check('ads: an advert naming a business the player owns lifts its takings 8%; others are unchanged', lift.why === null && lift.before === 1 && Math.abs(lift.after - 1.08) < 1e-9 && lift.other === 1, lift);

  // The rental runs out: the board's own advert comes back
  const expired = await page.evaluate((id) => {
    const { Adverts } = window.game.modules;
    Adverts.now = () => Date.now() + 2 * 86_400_000;
    Adverts.get().tick();
    const face = Adverts.get().boards().find((b) => b.face.id === id).face;
    const back = face.mesh.material.map === face.base;
    const left = Adverts.get().mine().length;
    Adverts.now = () => Date.now();
    Adverts.get().tick();
    return { back, left, weekLeft: Adverts.get().mine().length };
  }, list.first);
  check('ads: when a day’s rental runs out the board shows its own advert again; a week’s rental is still up', expired.back && expired.left === 1 && expired.weekLeft === 2, expired);

  check('ads: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
