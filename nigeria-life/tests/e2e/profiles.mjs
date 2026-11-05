// Players to one another: tapping another player opens their card (chat, family, bae, hustle
// rating, credibility, level, CV, hire); family and bae are asked and answered; a job is offered,
// taken, done, then paid for and rated, the money moving once, and the rating showing on the card.
import { wait, newPlayer, advance, closeDialogs, GAME_URL } from './lib.mjs';

const tick = async (a, b, rounds = 6) => {
  for (let i = 0; i < rounds; i++) {
    await advance(a, 0.2);
    await advance(b, 0.2);
    await wait(150);
  }
};
const sheet = (page) => page.evaluate(() => {
  const el = document.getElementById('profile-sheet');
  if (!el || el.style.display === 'none') return null;
  return { text: el.innerText.replace(/\s+/g, ' '), buttons: [...el.querySelectorAll('button')].map((b) => b.textContent.trim()) };
});
const click = (page, selector) => page.evaluate((s) => { const el = document.querySelector(`#profile-sheet ${s}`); if (!el) return false; el.click(); return true; }, selector);
const bank = (page) => page.evaluate(() => window.game.hud.backend.getData().bank.balance);

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const open = async (who) => {
    const page = await ctx.newPage();
    await page.setViewport({ width: 420, height: 800 });
    await page.goto(`${GAME_URL}?player=${who}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction('window.game', { timeout: 120000 });
    await wait(2500);
    await closeDialogs(page);
    return page;
  };
  const a = await open('ada');
  const b = await open('bayo');
  const errors = [];
  for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));
  await a.evaluate(() => window.game.player.mesh.position.set(4, 0, 10));
  await b.evaluate(() => window.game.player.mesh.position.set(6, 0, 11));
  await tick(a, b, 10);
  const ids = {
    a: await a.evaluate(() => window.game.network.localId),
    b: await b.evaluate(() => window.game.network.localId),
  };
  const seen = await a.evaluate((id) => { const r = window.game.network.remotePlayers.get(id); return r ? { name: r.name, profile: !!r.profile } : null; }, ids.b);
  check('profiles: two players see each other, and each has the other\'s card', !!seen && seen.profile, { seen, ids });

  // ------------------------------------------------------------------ The card
  await a.evaluate((id) => window.game.hud.onOpenProfile(id), ids.b);
  await wait(300);
  let shown = await sheet(a);
  check('profiles: tapping another player opens their card: chat, bae (locked until closer), family, hustle, credibility, level, CV, hire',
    !!shown && /@bayo|@[A-Za-z]/.test(shown.text) && /Chat/.test(shown.text) && /Ask to be my Bae/.test(shown.text) && /\(0\/40\)/.test(shown.text) && /Add as family/.test(shown.text)
      && /Hustle/.test(shown.text) && /Credibility/.test(shown.text) && /Lv \d+ · (Bronze|Silver|Gold|Platinum)/.test(shown.text) && /View CV/.test(shown.text) && /Hire for a job/.test(shown.text), shown);

  await click(a, '[data-cv]');
  await wait(200);
  shown = await sheet(a);
  check('profiles: their CV has work, education and criminal record, the record kept private unless they share it',
    !!shown && /WORK/.test(shown.text) && /EDUCATION/.test(shown.text) && /CRIMINAL RECORD/.test(shown.text) && /keeps this private/.test(shown.text) && /game’s own records/.test(shown.text), shown);
  await click(a, '[data-back]');

  // ------------------------------------------------------------------ Family
  await click(a, '[data-family]');
  await tick(a, b, 3);
  let asked = await sheet(b);
  await click(b, '[data-tie-yes]');
  await tick(a, b, 3);
  const family = { a: await a.evaluate((id) => window.game.profileTies.isFamily(id), ids.b), b: await b.evaluate((id) => window.game.profileTies.isFamily(id), ids.a) };
  check('profiles: asked to be family, the other player is asked; when they accept, both have each other as family', !!asked && /wants to add you as family/.test(asked.text) && family.a && family.b, { asked, family });

  // ------------------------------------------------------------------ Bae, once close enough
  // Waves and chats bring two players closer, a little at a time
  const before = await a.evaluate((id) => window.game.profileTies.closeness(id), ids.b);
  await b.evaluate((id) => window.game.network.sendSocial(id, 'wave'), ids.a);
  await tick(a, b, 2);
  const after = await a.evaluate((id) => window.game.profileTies.closeness(id), ids.b);
  check('profiles: a wave from the other player brings them a little closer', after > before, { before, after });
  // Time together, as if they had hung out for days
  for (const [page, id] of [[a, ids.b], [b, ids.a]]) await page.evaluate((other) => window.game.profileTies.grow(other, 'friend', 45), id);
  await a.evaluate((id) => window.game.hud.onOpenProfile(id), ids.b);
  await wait(200);
  shown = await sheet(a);
  const unlocked = !!shown && shown.buttons.some((t) => /Ask to be my Bae/.test(t));
  await click(a, '[data-bae]');
  await tick(a, b, 3);
  asked = await sheet(b);
  await click(b, '[data-tie-yes]');
  await tick(a, b, 3);
  const baes = { a: await a.evaluate(() => window.game.profileTies.bae()?.id ?? null), b: await b.evaluate(() => window.game.profileTies.bae()?.id ?? null) };
  check('profiles: close enough (40), "Ask to be my Bae" opens; asked and accepted, each is the other\'s bae', unlocked && !!asked && /bae/.test(asked.text) && baes.a === ids.b && baes.b === ids.a, { unlocked, asked, baes });

  // ------------------------------------------------------------------ A job
  await a.evaluate(() => { const be = window.game.hud.backend; be.data.bank.balance += 200000; be.saveData(); });
  await a.evaluate((id) => window.game.hud.onOpenProfile(id), ids.b);
  await wait(200);
  await click(a, '[data-hire]');
  await wait(150);
  await click(a, '[data-role="cook"]');
  await a.evaluate(() => {
    const set = (sel, v) => { const el = document.querySelector(`#profile-sheet ${sel}`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('[data-field="details"]', 'Jollof for my birthday');
    set('[data-field="fee"]', '50000');
  });
  const aBank0 = await bank(a);
  const bBank0 = await bank(b);
  await click(a, '[data-offer]');
  await tick(a, b, 3);
  const offer = await sheet(b);
  check('profiles: a job offer arrives with what, when and the fee, to accept or turn down; nothing is paid yet',
    !!offer && /Job offer/.test(offer.text) && /Cook/.test(offer.text) && /50,000/.test(offer.text) && /Jollof for my birthday/.test(offer.text) && (await bank(a)) === aBank0, offer);
  await click(b, '[data-accept]');
  await tick(a, b, 3);
  await click(b, '[data-done]');
  await tick(a, b, 3);
  const toPay = await sheet(a);
  await click(a, '[data-stars="4"]');
  await click(a, '[data-pay]');
  await tick(a, b, 6);
  const aBank1 = await bank(a);
  const bBank1 = await bank(b);
  const states = {
    a: await a.evaluate(() => window.game.profileTies.offers()[0]?.state),
    b: await b.evaluate(() => window.game.profileTies.offers()[0]),
  };
  check('profiles: accepted, done, then the one who hired pays the fee once and rates it; the money moves from one bank to the other',
    !!toPay && /Pay ₦50,000/.test(toPay.buttons.join(' ')) && aBank0 - aBank1 === 50000 && bBank1 - bBank0 === 50000 && states.a === 'paid' && states.b?.state === 'paid' && states.b?.rating === 4,
    { toPay, paid: aBank0 - aBank1, got: bBank1 - bBank0, states });

  await b.evaluate(() => window.game.network.broadcastProfile());
  await tick(a, b, 3);
  const card = await a.evaluate((id) => window.game.network.remotePlayers.get(id)?.profile?.hustle, ids.b);
  check('profiles: the job and its rating show on the worker\'s card for everyone', card?.done === 1 && card?.rating === 4 && card?.roles?.cook === 1, card);

  // ------------------------------------------------------------------ One's own card
  await a.evaluate(() => window.game.profileSheet.open(null));
  await wait(200);
  shown = await sheet(a);
  check('profiles: the player\'s own card shows how others see them, their hustle and a switch for their record', !!shown && /how other players see you/.test(shown.text) && /My hustle/.test(shown.text) && /criminal record/.test(shown.text), shown);

  check('profiles: no errors in either page', errors.length === 0, errors.slice(0, 5));
  await ctx.close();
}
