// Land, building and trading between players. Three players share one browser, each with a
// saved game of their own; ownership lives in the registry they all read.
import { wait, newPlayer, advance, closeDialogs, money, GAME_URL } from './lib.mjs';

const PHONE = '#smartphone-wrapper';

async function join(ctx, player, cash = 60_000_000) {
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text().slice(0, 200)); });
  await page.goto(player ? `${GAME_URL}?player=${player}` : GAME_URL, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.game && window.game.plotWorld', { timeout: 120000 });
  await wait(2500);
  await closeDialogs(page);
  await page.evaluate((amount) => { const b = window.game.hud.backend; b.data.bank.balance = amount; b.saveData(); }, cash);
  return { page, errors };
}

/** Waits until something is true in a page, letting the tabs talk to each other meanwhile. */
async function until(page, test, arg, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const value = await page.evaluate(test, arg);
    if (value) return value;
    await wait(150);
  }
  return null;
}

const me = (page) => page.evaluate(() => window.game.assetMarket.me);
const ledger = (page, kind) => page.evaluate((type) => window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === type).length, kind);
const plotState = (page, id) => page.evaluate((plotId) => { const g = window.game; return { status: g.land.status(plotId), owner: g.land.ownerOf(plotId), asking: g.land.askingPrice(plotId) }; }, id);
const tap = async (page, selector) => {
  const ok = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el || el.disabled) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, `${PHONE} ${selector}`);
  await wait(220);
  return ok;
};
const yes = async (page) => { await wait(120); await page.evaluate(() => document.getElementById('phone-confirm-yes').click()); await wait(350); };
const typeInto = async (page, selector, value) => {
  const at = await page.evaluate((sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, `${PHONE} ${selector}`);
  await page.bringToFront();
  await page.mouse.click(at.x, at.y);
  await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(String(value));
  await wait(160);
};
const openApp = async (page, id, route = '') => {
  const wasOpen = await page.evaluate(({ id, route }) => { const phone = window.game.hud.phoneModal; const open = phone.isOpen; phone.openApp(id, route); return open; }, { id, route });
  await wait(wasOpen ? 180 : 650);
};
const notice = (page) => page.evaluate(() => { const el = document.getElementById('phone-notice'); return el && !el.hidden ? el.textContent : null; });

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const A = await join(ctx, null);
  const B = await join(ctx, 'tunde');
  const a = A.page;
  const b = B.page;
  const idA = await me(a);
  const idB = await me(b);
  check('two tabs opened as different players are different people with their own money', idA !== idB && idA === 'local:main' && idB === 'local:tunde', { idA, idB });

  // ------------------------------------------------------------------ The land there is
  const catalogue = await a.evaluate(() => {
    const g = window.game;
    const list = g.land.plots();
    const perSqm = (id) => { const p = g.land.plot(id); return p.statePrice / p.area; };
    return {
      count: list.length,
      allAvailable: list.every((p) => g.land.status(p.id) === 'available' && g.land.ownerOf(p.id) === null),
      complete: list.every((p) => p.id && p.neighbourhood && p.area > 100 && p.statePrice > 0 && p.uses.length > 0 && p.maxFloors > 0),
      places: [...new Set(list.map((p) => p.neighbourhood))],
      island: perSqm('lag-kakawa-w3'),
      mainland: perSqm('lag-odunlami-w2'),
    };
  });
  check('the registry holds 16 plots, each with a place, a size, permitted uses and a state price, all unsold to begin with',
    catalogue.count === 16 && catalogue.allAvailable && catalogue.complete && catalogue.places.length >= 4, catalogue);
  check('land in a prime neighbourhood costs several times what mainland land does, metre for metre', catalogue.island > catalogue.mainland * 2.5, { island: Math.round(catalogue.island), mainland: Math.round(catalogue.mainland) });

  // ------------------------------------------------------------------ Inspecting a plot in the world
  const P1 = 'lag-odunlami-w1';
  await a.bringToFront();
  const prompt = await a.evaluate(async (plotId) => {
    const g = window.game;
    const card = g.plotWorld.interactiveList.find((item) => item.id === `plot_${plotId}`);
    g.player.stopMoving();
    g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z);
    g.cameraManager.snapToPlayer(g.player, 'street');
    await g.advance(0.2);
    return { target: g.hud.currentInteractionTarget?.id ?? null, label: g.hud.currentInteractionTarget?.label ?? null, board: card.description };
  }, P1);
  await a.keyboard.press('e');
  await wait(400);
  await a.evaluate(() => document.getElementById('card-action-btn').click());
  await wait(800);
  const inspected = await a.evaluate(() => ({ open: window.game.hud.phoneModal.isOpen, title: document.getElementById('phone-title').textContent, facts: document.getElementById('land-facts')?.textContent.replace(/\s+/g, ' ') ?? '', buy: document.getElementById('land-buy')?.textContent ?? null }));
  check('standing at a plot\'s board and pressing E opens what the land registry knows about it: owner, size, permitted building, restrictions and price',
    prompt.target === `plot_${P1}` && /Inspect/.test(prompt.label) && /LAND FOR SALE/.test(prompt.board) && inspected.open && inspected.title === '9 Odunlami Street'
      && /Lagos State/.test(inspected.facts) && /up to 4 floors/.test(inspected.facts) && /never on the road/.test(inspected.facts) && /Buy from Lagos State/.test(inspected.buy), { prompt, inspected });

  // ------------------------------------------------------------------ Buying from the state, through the app
  const price1 = await a.evaluate((id) => window.game.land.plot(id).statePrice, P1);
  let a0 = await money(a);
  await tap(a, '#land-buy');
  const asked = await a.evaluate(() => !document.getElementById('phone-confirm').hidden);
  const before = await plotState(a, P1);
  await yes(a);
  let a1 = await money(a);
  let p1 = await plotState(a, P1);
  check('buying from the state asks first, then takes the state price once and the title is the buyer\'s',
    asked && before.status === 'available' && a0.total - a1.total === price1 && p1.owner === idA && p1.status === 'owned' && (await ledger(a, 'ASSET_PURCHASE')) === 1, { asked, paid: a0.total - a1.total, price1, p1 });

  const again = await a.evaluate((id) => window.game.land.buyFromState(id), P1);
  const a2 = await money(a);
  check('buying it a second time is refused and takes nothing', !again.ok && a2.total === a1.total, again);

  // The other player sees it as someone else's, and cannot take it
  const seenByB = await until(b, (id) => (window.game.land.ownerOf(id) ? { status: window.game.land.status(id), owner: window.game.land.ownerOf(id) } : null), P1);
  let b0 = await money(b);
  const bTries = await b.evaluate(async (id) => {
    const g = window.game;
    return {
      buy: await g.land.buyFromState(id),
      list: await g.assetMarket.list({ kind: 'plot', id }, 5000000, ''),
      build: g.land.cannotPlace(id, 'bungalow', (g.land.plot(id).rect.minX + g.land.plot(id).rect.maxX) / 2, (g.land.plot(id).rect.minZ + g.land.plot(id).rect.maxZ) / 2, 0),
      start: await g.land.startBuilding(id, 'bungalow', (g.land.plot(id).rect.minX + g.land.plot(id).rect.maxX) / 2, (g.land.plot(id).rect.minZ + g.land.plot(id).rect.maxZ) / 2, 0),
    };
  }, P1);
  let b1 = await money(b);
  await b.bringToFront();
  await openApp(b, 'land', `plot:${P1}`);
  const bScreen = await b.evaluate(() => ({ closed: document.getElementById('land-closed')?.textContent ?? null, buy: !!document.getElementById('land-buy'), offer: !!document.getElementById('land-offer-btn') }));
  check('another player sees the plot as privately owned and not for sale, and cannot buy it, list it or build on it',
    seenByB && seenByB.owner === idA && !bTries.buy.ok && /can only be bought from them/.test(bTries.buy.reason) && !bTries.list.ok && /Only the owner/.test(bTries.list.reason)
      && /Only the owner/.test(bTries.build) && !bTries.start.ok && b1.total === b0.total && /not for sale/.test(bScreen.closed ?? '') && !bScreen.buy && !bScreen.offer, { seenByB, bTries, bScreen });

  // ------------------------------------------------------------------ Two buyers, one plot, at the same moment
  const P2 = 'lag-martins-s1';
  const price2 = await a.evaluate((id) => window.game.land.plot(id).statePrice, P2);
  a0 = await money(a);
  b0 = await money(b);
  const race = await Promise.all([a.evaluate((id) => window.game.land.buyFromState(id), P2), b.evaluate((id) => window.game.land.buyFromState(id), P2)]);
  await wait(500);
  a1 = await money(a);
  b1 = await money(b);
  const p2 = await plotState(a, P2);
  const winners = race.filter((r) => r.ok).length;
  const paidA = a0.total - a1.total;
  const paidB = b0.total - b1.total;
  check('when two players buy the same plot at the same instant, exactly one gets it and exactly one pays',
    winners === 1 && paidA + paidB === price2 && (paidA === 0 || paidB === 0) && p2.owner === (race[0].ok ? idA : idB), { race, paidA, paidB, owner: p2.owner });

  // The same press twice by one player
  const P3 = 'lag-azikiwe-s2';
  const price3 = await a.evaluate((id) => window.game.land.plot(id).statePrice, P3);
  a0 = await money(a);
  const twice = await a.evaluate((id) => Promise.all([window.game.land.buyFromState(id), window.game.land.buyFromState(id)]), P3);
  a1 = await money(a);
  check('pressing Buy twice at once buys once and pays once', twice.filter((r) => r.ok).length === 1 && a0.total - a1.total === price3, { twice, paid: a0.total - a1.total });

  // ------------------------------------------------------------------ Listing
  const ask = 5_000_000;
  await a.bringToFront();
  await openApp(a, 'land', `plot:${P1}`);
  await tap(a, '#land-sell');
  await typeInto(a, '#land-ask', '5m');
  await tap(a, '#land-list-btn');
  p1 = await plotState(a, P1);
  const listing = await a.evaluate((id) => window.game.land.listingFor(id), P1);
  check('the owner lists the plot at a price of their choosing; it is on the market and still theirs',
    p1.status === 'listed' && p1.owner === idA && p1.asking === ask && listing && listing.sellerId === idA && listing.status === 'active', { p1, listing });

  const ownOffer = await a.evaluate((id) => window.game.assetMarket.offer(id, 4000000), listing.id);
  check('the seller cannot make an offer on their own listing', !ownOffer.ok && /own listing/.test(ownOffer.reason), ownOffer);

  // ------------------------------------------------------------------ Negotiation: 4.2m, countered 4.7m, countered 4.5m, accepted
  await until(b, (id) => (window.game.land.status(id) === 'listed' ? true : null), P1);
  await b.bringToFront();
  await openApp(b, 'land', `plot:${P1}`);
  const forSale = await b.evaluate(() => ({ field: !!document.getElementById('land-offer'), price: document.getElementById('land-facts').textContent.replace(/\s+/g, ' ') }));
  await typeInto(b, '#land-offer', '4,200,000');
  b0 = await money(b);
  await tap(b, '#land-offer-btn');
  const offered = await b.evaluate((id) => window.game.assetMarket.negotiationsOn(id)[0] ?? null, listing.id);
  b1 = await money(b);
  check('the buyer sees the asking price and offers less; the offer is recorded against both players and no money moves',
    forSale.field && /5,000,000/.test(forSale.price) && offered && offered.amount === 4_200_000 && offered.buyerId === idB && offered.sellerId === idA && offered.awaiting === 'seller' && offered.status === 'open' && b1.total === b0.total,
    { forSale, offered });

  const tooSoon = await b.evaluate((id) => window.game.assetMarket.accept(id), offered.id);
  check('a buyer cannot accept their own offer on the seller\'s behalf', !tooSoon.ok && /other side/.test(tooSoon.reason), tooSoon);

  // The seller counters from the offer screen
  await until(a, (id) => (window.game.assetMarket.negotiationsOn(id).length ? true : null), listing.id);
  const badge = await a.evaluate(() => window.game.assetMarket.waitingOnMe());
  await a.bringToFront();
  await openApp(a, 'land', `deal:${offered.id}`);
  await typeInto(a, '#deal-counter', '4.7m');
  await tap(a, '#deal-counter-btn');
  await until(b, (id) => (window.game.assetMarket.myNegotiations().find((n) => n.id === id)?.awaiting === 'buyer' ? true : null), offered.id);
  const countered = await b.evaluate((id) => window.game.assetMarket.myNegotiations().find((n) => n.id === id), offered.id);
  await b.evaluate((id) => window.game.assetMarket.counter(id, 4500000), offered.id);
  await until(a, (id) => (window.game.assetMarket.myNegotiations().find((n) => n.id === id)?.amount === 4500000 ? true : null), offered.id);
  check('the seller is told an offer is waiting, counters with 4.7m, and the buyer comes back with 4.5m: each step is on the record',
    badge === 1 && countered.amount === 4_700_000 && countered.history.length === 2, { badge, amount: countered.amount, steps: countered.history.map((s) => `${s.by} ${s.action} ${s.amount}`) });

  // The seller accepts. The buyer's game takes the payment and the title moves.
  const boughtBefore = await ledger(b, 'ASSET_PURCHASE');
  const soldBefore = await ledger(a, 'ASSET_SALE');
  a0 = await money(a);
  b0 = await money(b);
  await a.bringToFront();
  await openApp(a, 'land', `deal:${offered.id}`);
  await tap(a, '#deal-accept');
  await yes(a);
  const done = await until(b, (id) => (window.game.land.ownerOf(id) === window.game.assetMarket.me ? true : null), P1, 60);
  await until(a, () => (window.game.hud.backend.getData().transactionHistory.some((tx) => tx.type === 'ASSET_SALE') ? true : null));
  a1 = await money(a);
  b1 = await money(b);
  p1 = await plotState(b, P1);
  const record = await b.evaluate(({ id, negotiationId }) => {
    const g = window.game;
    const state = g.registry.peek();
    const deal = state.negotiations[negotiationId];
    return {
      deal: deal.status, steps: deal.history.map((s) => `${s.by} ${s.action} ${s.amount}`), listing: state.listings[deal.listingId].status,
      sales: state.sales.filter((s) => s.negotiationId === negotiationId).length, sale: state.sales.find((s) => s.negotiationId === negotiationId),
      owners: state.titles[`plot:${id}`].history.map((h) => h.to),
      payouts: Object.values(state.payouts).filter((p) => p.toId === deal.sellerId).map((p) => ({ amount: p.amount, claimed: !!p.claimedAt })),
    };
  }, { id: P1, negotiationId: offered.id });
  check('on acceptance the buyer pays the agreed 4.5m once, the seller receives it less the 2% fee once, and the title passes to the buyer',
    done && b0.total - b1.total === 4_500_000 && a1.total - a0.total === 4_410_000 && p1.owner === idB && p1.status === 'owned'
      && record.deal === 'completed' && record.listing === 'sold' && record.sales === 1 && record.sale.price === 4_500_000 && record.sale.fee === 90_000
      && record.owners.join() === [idA, idB].join() && record.payouts.length === 1 && record.payouts[0].claimed
      && (await ledger(b, 'ASSET_PURCHASE')) === boughtBefore + 1 && (await ledger(a, 'ASSET_SALE')) === soldBefore + 1,
    { paid: b0.total - b1.total, received: a1.total - a0.total, record });

  // Doing any of it again changes nothing
  const repeat = await b.evaluate(async (id) => { const g = window.game; await g.assetMarket.complete(id); await g.assetMarket.settleMine(); return true; }, offered.id);
  const reaccept = await a.evaluate((id) => window.game.assetMarket.accept(id), offered.id);
  await a.evaluate(() => window.game.assetMarket.settleMine());
  await wait(300);
  const a3 = await money(a);
  const b3 = await money(b);
  check('completing or accepting the same sale again moves no more money and no more titles',
    repeat && !reaccept.ok && a3.total === a1.total && b3.total === b1.total && (await b.evaluate((id) => window.game.registry.peek().sales.filter((s) => s.negotiationId === id).length, offered.id)) === 1, { reaccept });

  const oldOwner = await a.evaluate(async (id) => ({ list: await window.game.assetMarket.list({ kind: 'plot', id }, 9000000, ''), mine: window.game.land.isMine(id) }), P1);
  check('the seller no longer owns it and cannot list it again', !oldOwner.mine && !oldOwner.list.ok, oldOwner);

  // ------------------------------------------------------------------ Not enough money
  // P3 is A's. B offers what they can afford, then spends the money before A accepts.
  const l3 = await a.evaluate((id) => window.game.assetMarket.list({ kind: 'plot', id }, 3000000, 'Corner plot'), P3);
  await until(b, (id) => (window.game.land.status(id) === 'listed' ? true : null), P3);
  const rich = (await money(b)).total;
  const beyond = await b.evaluate(({ id, amount }) => window.game.assetMarket.offer(id, amount), { id: l3.listingId, amount: rich + 1 });
  check('an offer of more money than the buyer has is refused', !beyond.ok && /cannot offer/.test(beyond.reason), beyond);

  const o3 = await b.evaluate((id) => window.game.assetMarket.offer(id, 2800000), l3.listingId);
  await b.evaluate(() => { const bk = window.game.hud.backend; bk.data.bank.balance = 1000; bk.data.walletCash = 0; bk.saveData(); });
  await until(a, (id) => (window.game.assetMarket.negotiationsOn(id).length ? true : null), l3.listingId);
  a0 = await money(a);
  b0 = await money(b);
  await a.evaluate((id) => window.game.assetMarket.accept(id), o3.negotiationId);
  const fell = await until(b, (id) => { const n = window.game.assetMarket.myNegotiations().find((x) => x.id === id); return n && n.status === 'failed' ? n.history[n.history.length - 1].note : null; }, o3.negotiationId, 60);
  await wait(300);
  a1 = await money(a);
  b1 = await money(b);
  let p3 = await until(a, (id) => (window.game.land.status(id) === 'listed' ? { status: window.game.land.status(id), owner: window.game.land.ownerOf(id) } : null), P3);
  check('if the buyer cannot pay when the seller accepts, the sale falls through: no money moves, the seller keeps the land and it is back on the market',
    fell && /does not cover/.test(fell) && a1.total === a0.total && b1.total === b0.total && p3 && p3.owner === idA && p3.status === 'listed', { fell, p3 });
  await b.evaluate(() => { const bk = window.game.hud.backend; bk.data.bank.balance = 40000000; bk.saveData(); });

  // ------------------------------------------------------------------ Two buyers bidding: only one sale
  const C = await join(ctx, 'ada', 30_000_000);
  const c = C.page;
  const idC = await me(c);
  await until(c, (id) => (window.game.land.status(id) === 'listed' ? true : null), P3);
  const ob = await b.evaluate((id) => window.game.assetMarket.offer(id, 2900000), l3.listingId);
  const oc = await c.evaluate((id) => window.game.assetMarket.offer(id, 2950000), l3.listingId);
  await until(a, (id) => (window.game.assetMarket.negotiationsOn(id).filter((n) => n.status === 'open').length === 2 ? true : null), l3.listingId);
  const mid = await plotState(a, P3);
  a0 = await money(a);
  b0 = await money(b);
  const c0 = await money(c);
  // The seller says yes to both in the same breath
  const both = await a.evaluate(({ x, y }) => Promise.all([window.game.assetMarket.accept(x), window.game.assetMarket.accept(y)]), { x: ob.negotiationId, y: oc.negotiationId });
  const sold = await until(a, (id) => (window.game.land.ownerOf(id) !== window.game.assetMarket.me ? window.game.land.ownerOf(id) : null), P3, 60);
  await until(a, () => (window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === 'ASSET_SALE').length >= 2 ? true : null));
  await wait(400);
  a1 = await money(a);
  b1 = await money(b);
  const c1 = await money(c);
  const sales3 = await a.evaluate((id) => window.game.registry.peek().sales.filter((s) => s.asset.id === id && s.sellerId !== null), P3);
  const loser = await (sold === idB ? c : b).evaluate((id) => { const n = window.game.assetMarket.myNegotiations().find((x) => x.id === id); return { status: n.status, note: n.history[n.history.length - 1].note ?? null }; }, sold === idB ? oc.negotiationId : ob.negotiationId);
  const spentB = b0.total - b1.total;
  const spentC = c0.total - c1.total;
  check('with two offers open the plot shows as under negotiation; accepting both at once sells it once, to one buyer, for one payment',
    mid.status === 'negotiating' && both.filter((r) => r.ok).length === 1 && sales3.length === 1 && (sold === idB || sold === idC)
      && (sold === idB ? spentB === 2_900_000 && spentC === 0 : spentC === 2_950_000 && spentB === 0) && a1.total - a0.total === Math.round(sales3[0].price * 0.98),
    { both, sold, spentB, spentC, got: a1.total - a0.total });
  check('the buyer who lost out is told it was sold to someone else, and paid nothing', loser.status === 'rejected' && /another buyer|already been agreed/i.test(loser.note ?? ''), loser);

  // ------------------------------------------------------------------ Withdrawing
  const P4 = 'lag-kakawa-e2';
  await a.evaluate(async (id) => { await window.game.land.buyFromState(id); }, P4);
  const l4 = await a.evaluate((id) => window.game.assetMarket.list({ kind: 'plot', id }, 9000000, ''), P4);
  await until(b, (id) => (window.game.land.status(id) === 'listed' ? true : null), P4);
  const o4 = await b.evaluate((id) => window.game.assetMarket.offer(id, 8000000), l4.listingId);
  await until(a, (id) => (window.game.assetMarket.negotiationsOn(id).length ? true : null), l4.listingId);
  await a.evaluate((id) => window.game.assetMarket.withdraw(id), l4.listingId);
  const lapsed = await until(b, (id) => { const n = window.game.assetMarket.myNegotiations().find((x) => x.id === id); return n && n.status === 'rejected' ? n.history[n.history.length - 1].note : null; }, o4.negotiationId);
  const late = await b.evaluate((id) => window.game.assetMarket.offer(id, 8500000), l4.listingId);
  const lateAccept = await b.evaluate((id) => window.game.assetMarket.accept(id), o4.negotiationId);
  const p4 = await plotState(a, P4);
  check('a listing can be withdrawn: offers on it lapse, no new offer is taken, and the land stays the owner\'s',
    /withdrawn/.test(lapsed ?? '') && !late.ok && !lateAccept.ok && p4.owner === idA && p4.status === 'owned', { lapsed, late, p4 });

  // ------------------------------------------------------------------ Building: what may go where
  await a.bringToFront();
  const rules = await a.evaluate((id) => {
    const g = window.game;
    const plot = g.land.plot(id);
    const cx = (plot.rect.minX + plot.rect.maxX) / 2;
    const cz = (plot.rect.minZ + plot.rect.maxZ) / 2;
    const designs = Object.fromEntries(g.land.designsFor(id).map((d) => [d.type.id, d.why]));
    return {
      designs,
      centre: g.land.cannotPlace(id, 'duplex', cx, cz, 0),
      overEdge: g.land.cannotPlace(id, 'duplex', plot.rect.minX + 2, cz, 0),
      atEdge: g.land.cannotPlace(id, 'duplex', plot.rect.minX + 4.2, cz, 0),
      onRoad: g.land.cannotPlace(id, 'duplex', plot.rect.minX - 6, cz, 0),
      plot: { w: plot.rect.maxX - plot.rect.minX, d: plot.rect.maxZ - plot.rect.minZ, floors: plot.maxFloors, cx, cz },
    };
  }, P4);
  check('a plot offers only the designs its rules allow, and says why not for the rest',
    rules.designs.duplex === null && rules.designs.bungalow === null && rules.designs.shop === null && /too small/.test(rules.designs.hotel) === false && rules.designs.hotel === null, rules.designs);
  const small = await a.evaluate(() => Object.fromEntries(window.game.land.designsFor('lag-martins-s1').map((d) => [d.type.id, d.why])));
  check('a small two-storey residential plot refuses a shop (wrong use), an apartment block (too tall) and says so',
    /residential use only/.test(small.shop) && /No more than 2 floors/.test(small.apartments) && small.bungalow === null, small);
  check('a building may stand in the middle of the plot, not across its boundary, not within the setback, and not on the street',
    rules.centre === null && /cross the boundary/.test(rules.overEdge) && /at least 1 m back/.test(rules.atEdge) && /cross the boundary/.test(rules.onRoad), rules);

  // ------------------------------------------------------------------ Placing it, through the app and the bar
  await a.evaluate((id) => { const g = window.game; const card = g.plotWorld.interactiveList.find((item) => item.id === `plot_${id}`); g.player.stopMoving(); g.player.mesh.position.set(card.interactionPoint.x, 0, card.interactionPoint.z); g.cameraManager.snapToPlayer(g.player, 'street'); }, P4);
  await advance(a, 0.3);
  await openApp(a, 'land', `build:${P4}`);
  a0 = await money(a);
  await tap(a, '[data-design="duplex"]');
  await wait(500);
  const placing = await a.evaluate(() => ({ bar: window.game.buildBar.isOpen, phone: window.game.hud.phoneModal.isOpen, ghost: window.game.plotWorld.previewing, placing: window.game.buildBar.placing }));
  a1 = await money(a);
  check('choosing a design closes the phone and shows the building on the plot as a preview, with nothing paid yet',
    placing.bar && !placing.phone && placing.ghost && placing.placing.blocked === null && a1.total === a0.total, placing);

  for (let i = 0; i < 12; i++) await a.evaluate(() => document.querySelector('#build-bar [data-move="-1,0"]').click());
  const off = await a.evaluate(() => ({ blocked: window.game.buildBar.placing.blocked, off: document.getElementById('build-bar-confirm').disabled, say: document.getElementById('build-bar-say').textContent }));
  await a.evaluate(() => document.getElementById('build-bar-confirm').click());
  await wait(300);
  const stillNone = await a.evaluate((id) => window.game.land.building(id), P4);
  check('moved over the edge of the plot, the preview says why it cannot stand there and cannot be confirmed',
    /boundary/.test(off.blocked) && off.off && /boundary/.test(off.say) && stillNone === null && (await money(a)).total === a0.total, off);

  // A click on the plot moves it back inside
  const spot = await a.evaluate((id) => {
    const g = window.game;
    const plot = g.land.plot(id);
    const p = new g.player.mesh.position.constructor((plot.rect.minX + plot.rect.maxX) / 2 + 1, 0, (plot.rect.minZ + plot.rect.maxZ) / 2);
    p.project(g.cameraManager.camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight, onCanvas: document.elementFromPoint(((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight)?.tagName };
  }, P4);
  const stood = await a.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
  if (spot.onCanvas === 'CANVAS') await a.mouse.click(spot.x, spot.y);
  else await a.evaluate((c) => window.game.buildBar.moveTo(c.cx + 1, c.cz), rules.plot);
  await wait(250);
  await advance(a, 0.4);
  const moved = await a.evaluate(() => ({ placing: window.game.buildBar.placing, x: window.game.player.position.x, z: window.game.player.position.z, moving: window.game.player.isMoving }));
  check('a click on the plot moves the preview there, and does not send the character walking',
    moved.placing.blocked === null && Math.abs(moved.placing.x - (rules.plot.cx + 1)) < 1.5 && Math.hypot(moved.x - stood.x, moved.z - stood.z) < 0.05 && !moved.moving, { spot, moved: moved.placing });

  const duplexCost = 1_200_000;
  await a.evaluate(() => { const btn = document.getElementById('build-bar-confirm'); btn.click(); btn.click(); });
  await until(a, (id) => (window.game.land.building(id) ? true : null), P4);
  a1 = await money(a);
  const site = await a.evaluate((id) => {
    const g = window.game;
    const building = g.land.building(id);
    const root = g.plotWorld.group.children.find((child) => child.name === `Plot ${g.land.plot(id).name}`);
    let meshes = 0;
    root.traverse((obj) => { if (obj.isMesh) meshes++; });
    return { building, status: g.land.status(id), bar: g.buildBar.isOpen, ghost: g.plotWorld.previewing, meshes, inPlan: g.plotWorld.obstructions().length, plan: g.world.validateCityPlan().length, board: g.plotWorld.interactiveList.find((i) => i.id === `plot_${id}`).description };
  }, P4);
  check('confirming takes the cost once, even pressed twice, and a building site appears on the plot and in the registry',
    a0.total - a1.total === duplexCost && (await ledger(a, 'CONSTRUCTION_COST')) === 1 && site.building && site.building.typeId === 'duplex' && site.building.hoursDone === 0
      && site.status === 'building' && !site.bar && !site.ghost && site.meshes > 12 && /GOING UP/.test(site.board), { paid: a0.total - a1.total, site });
  check('the building site obeys the city plan like any other building', site.inPlan >= 1 && site.plan === 0, { inPlan: site.inPlan, violations: site.plan });

  const blockedSale = await a.evaluate((id) => window.game.assetMarket.list({ kind: 'plot', id }, 12000000, ''), P4);
  const second = await a.evaluate((c) => window.game.land.startBuilding(c.id, 'bungalow', c.cx, c.cz, 0), { id: P4, cx: rules.plot.cx, cz: rules.plot.cz });
  check('land with work under way cannot be sold, and a second building cannot be started on it', !blockedSale.ok && /under way/.test(blockedSale.reason) && !second.ok && /already a building/.test(second.reason), { blockedSale, second });

  // ------------------------------------------------------------------ Work goes on with the clock, and survives a restart
  const stages = [];
  const timeScale = 0.04; // game hours per second
  let expected = 0;
  for (const hours of [1.2, 3.5, 5.5]) {
    await advance(a, hours / timeScale);
    expected += hours;
    // The work done reaches the registry a moment after the clock has moved
    await until(a, ({ id, least }) => (window.game.registry.peek().buildings[id].hoursDone >= least ? true : null), { id: P4, least: expected - 0.05 });
    stages.push(await a.evaluate((id) => { const g = window.game; const building = g.registry.peek().buildings[id]; return { done: +building.hoursDone.toFixed(1), stage: g.plotWorld.interactiveList.find((i) => i.id === `plot_${id}`).description.split(' · ')[1] }; }, P4));
  }
  check('work advances with the game clock through its stages, and each stage is what stands on the plot',
    stages[0].done >= 1 && stages[1].done > stages[0].done && stages[2].done > stages[1].done && new Set(stages.map((s) => s.stage)).size >= 2 && stages.every((s) => s.done <= 14), stages);

  const seenFromB = await until(b, (id) => { const g = window.game; const building = g.land.building(id); return building && building.hoursDone > 5 ? { done: building.hoursDone, status: g.land.status(id), board: g.plotWorld.interactiveList.find((i) => i.id === `plot_${id}`).description } : null; }, P4);
  check('another player sees the same site at the same stage, under its owner\'s name', seenFromB && seenFromB.status === 'building' && /OWNER: /.test(seenFromB.board), seenFromB);

  const beforeReload = await a.evaluate((id) => window.game.registry.peek().buildings[id].hoursDone, P4);
  const costsBefore = await ledger(a, 'CONSTRUCTION_COST');
  await a.reload({ waitUntil: 'load', timeout: 120000 });
  await a.waitForFunction('window.game && window.game.plotWorld', { timeout: 120000 });
  await wait(2500);
  await closeDialogs(a);
  const afterReload = await a.evaluate((id) => ({ done: window.game.land.building(id)?.hoursDone ?? null, owner: window.game.land.ownerOf(id), mine: window.game.land.myPlots().map((p) => p.id), sales: window.game.registry.peek().sales.length }), P4);
  const salesNow = await b.evaluate(() => window.game.registry.peek().sales.length);
  check('closing and reopening the game keeps the land, the building and its progress, and charges nothing again',
    afterReload.done >= beforeReload - 0.01 && afterReload.owner === idA && afterReload.mine.includes(P4) && (await ledger(a, 'CONSTRUCTION_COST')) === costsBefore && afterReload.sales === salesNow, { beforeReload, afterReload });

  // ------------------------------------------------------------------ Finished: a home, and it can be sold with the land
  await advance(a, 10 / timeScale);
  await wait(500);
  const finished = await until(a, (id) => { const g = window.game; return g.land.status(id) === 'developed' ? { home: g.land.hasHome(), backend: g.hud.backend.hasHome(), board: g.plotWorld.interactiveList.find((i) => i.id === `plot_${id}`).description, plan: g.world.validateCityPlan().length } : null; }, P4);
  check('the finished duplex is a developed plot, gives its owner a home, and the city plan still holds', finished && finished.home && finished.backend && /DUPLEX/.test(finished.board) && finished.plan === 0, finished);

  const resale = await a.evaluate((id) => window.game.assetMarket.list({ kind: 'plot', id }, 15000000, 'Duplex included'), P4);
  await until(b, (id) => (window.game.land.askingPrice(id) === 15000000 ? true : null), P4);
  const bid = await b.evaluate((id) => window.game.assetMarket.offer(id, 14000000), resale.listingId);
  await until(a, (id) => (window.game.assetMarket.negotiationsOn(id).length ? true : null), resale.listingId);
  await a.evaluate((id) => window.game.assetMarket.accept(id), bid.negotiationId);
  const passed = await until(b, (id) => { const g = window.game; return g.land.isMine(id) ? { building: g.land.building(id)?.typeId, home: g.land.hasHome(), status: g.land.status(id) } : null; }, P4, 60);
  const sellerHome = await until(a, (id) => (!window.game.land.isMine(id) ? { home: window.game.land.hasHome() } : null), P4);
  check('a developed plot sells with its building: the buyer now has the duplex and a home, and the seller has neither',
    passed && passed.building === 'duplex' && passed.home && passed.status === 'developed' && sellerHome && sellerHome.home === false, { passed, sellerHome });

  // ------------------------------------------------------------------ A business building earns, and stopping work refunds by rule
  const P5 = 'lag-martins-n1';
  const shopAt = await a.evaluate(async (id) => { const g = window.game; await g.land.buyFromState(id); const r = g.land.plot(id).rect; const at = { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 }; await g.land.startBuilding(id, 'shop', at.x, at.z, 0); return at; }, P5);
  await advance(a, 3 / timeScale);
  await wait(400);
  a0 = await money(a);
  const stopped = await a.evaluate((id) => window.game.land.cancelBuilding(id), P5);
  a1 = await money(a);
  check('stopping work part-way clears the site and pays back half of the cost of the work not yet done',
    stopped.ok && stopped.refund > 0 && stopped.refund < 150_000 && a1.total - a0.total === stopped.refund && (await a.evaluate((id) => window.game.land.building(id), P5)) === null, stopped);

  await a.evaluate((c) => window.game.land.startBuilding(c.id, 'shop', c.x, c.z, 0), { id: P5, ...shopAt });
  await advance(a, 6.5 / timeScale);
  await until(a, (id) => (window.game.land.status(id) === 'developed' ? true : null), P5);
  await advance(a, 24 / timeScale);
  await wait(500);
  const due = await a.evaluate((id) => window.game.land.takings(id), P5);
  a0 = await money(a);
  const got = await a.evaluate((id) => window.game.land.collect(id), P5);
  const againCollect = await a.evaluate((id) => window.game.land.collect(id), P5);
  a1 = await money(a);
  check('a finished shop takes money each game day, less its upkeep; the owner collects it once',
    due >= 7000 && due <= 8000 && got.ok && got.amount >= due && a1.bank - a0.bank === got.amount && (!againCollect.ok || againCollect.amount < 500), { due, got, againCollect });
  const notMine = await b.evaluate((id) => window.game.land.collect(id), P5);
  check('nobody but the owner can collect a building\'s takings', !notMine.ok, notMine);

  a0 = await money(a);
  const down = await a.evaluate((id) => window.game.land.demolish(id), P5);
  a1 = await money(a);
  check('pulling down a finished building costs a tenth of its price and leaves the plot empty and still owned',
    down.ok && a0.total - a1.total === 30_000 && (await plotState(a, P5)).status === 'owned', { down, paid: a0.total - a1.total });

  // ------------------------------------------------------------------ Vehicles
  await a.bringToFront();
  await a.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(10, 0, 96); g.cameraManager.snapToPlayer(g.player, 'street'); });
  await advance(a, 0.3);
  await openApp(a, 'garage');
  const noCars = await a.evaluate(() => !!document.querySelector('#smartphone-wrapper .nl-empty'));
  await tap(a, '[data-set="garage.tab"][data-value="dealer"]');
  a0 = await money(a);
  await tap(a, '[data-model="okada"]');
  await yes(a);
  a1 = await money(a);
  const car = await a.evaluate(() => { const g = window.game; const mine = g.garage.mine(); return { count: mine.length, record: mine[0], owner: mine[0] ? g.garage.ownerOf(mine[0].id) : null, out: mine[0] ? g.ownedVehicles.isOut(mine[0].id) : null }; });
  check('a new vehicle from the dealer is paid for once and registered to the buyer, with a plate, no mileage and full condition',
    noCars && a0.total - a1.total === 280_000 && car.count === 1 && car.owner === idA && car.record.mileage === 0 && car.record.condition === 100 && /^LAG-\d{3}-[A-Z]{2}$/.test(car.record.plate), { paid: a0.total - a1.total, car });

  await openApp(a, 'garage', `car:${car.record.id}`);
  await tap(a, '#garage-bring');
  await wait(400);
  const brought = await a.evaluate((id) => {
    const g = window.game;
    const v = g.world.vehicles.drivableVehicles.find((x) => x.id === `veh-own-${id}`);
    return v ? { near: Math.hypot(v.mesh.position.x - g.player.position.x, v.mesh.position.z - g.player.position.z), onRoad: Math.abs(v.mesh.position.x) < 7, card: g.world.interactiveObjects.some((o) => o.id === v.id), phone: g.hud.phoneModal.isOpen } : null;
  }, car.record.id);
  check('the owner has it brought to the kerb beside them: a real vehicle in the street that can be walked up to', brought && brought.near < 8 && brought.onRoad && brought.card && !brought.phone, brought);

  // Drive it: get in, go up the road, get out
  await a.evaluate((id) => { const g = window.game; const v = g.world.vehicles.drivableVehicles.find((x) => x.id === `veh-own-${id}`); g.enterVehicle(v); }, car.record.id);
  await a.keyboard.down('w');
  await advance(a, 4);
  await a.keyboard.up('w');
  await a.evaluate(() => window.game.exitVehicle());
  const driven = await until(a, (id) => { const r = window.game.garage.record(id); return r.mileage > 0 ? r : null; }, car.record.id);
  check('driving it puts distance on its clock and a little wear on its condition, and it stays where it was left', driven && driven.mileage > 0.1 && driven.condition < 100 && driven.condition > 95 && !!driven.parkedAt, driven);

  const stolen = await b.evaluate((id) => window.game.assetMarket.list({ kind: 'vehicle', id }, 100000, ''), car.record.id);
  check('another player cannot list a vehicle that is not theirs', !stolen.ok && /Only the owner/.test(stolen.reason), stolen);

  // Sell it to B by negotiation
  await openApp(a, 'garage', `car:${car.record.id}`);
  await typeInto(a, '#garage-ask', '250000');
  await tap(a, '#garage-list');
  const carListing = await a.evaluate((id) => window.game.garage.listingFor(id), car.record.id);
  await until(b, () => (window.game.garage.forSale().length ? true : null));
  await b.bringToFront();
  await openApp(b, 'garage');
  await tap(b, '[data-set="garage.tab"][data-value="market"]');
  const shown = await b.evaluate(() => document.querySelector('#garage-market')?.textContent.replace(/\s+/g, ' ') ?? '');
  await tap(b, `[data-car="${car.record.id}"]`);
  await typeInto(b, '#garage-offer', '200000');
  await tap(b, '#garage-offer-btn');
  const carDeal = await until(a, (id) => window.game.assetMarket.negotiationsOn(id)[0] ?? null, carListing.id);
  await a.evaluate((id) => window.game.assetMarket.counter(id, 230000), carDeal.id);
  await until(b, (id) => (window.game.assetMarket.myNegotiations().find((n) => n.id === id)?.awaiting === 'buyer' ? true : null), carDeal.id);
  a0 = await money(a);
  b0 = await money(b);
  // The buyer accepts the counter: the sale completes there and then, in the buyer's game
  await openApp(b, 'land', `deal:${carDeal.id}`);
  await tap(b, '#deal-accept');
  await yes(b);
  const handed = await until(b, (id) => (window.game.garage.ownerOf(id) === window.game.assetMarket.me ? true : null), car.record.id, 60);
  await until(a, (id) => (window.game.garage.mine().length === 0 && !window.game.ownedVehicles.isOut(id) ? true : null), car.record.id);
  await until(a, () => (window.game.hud.backend.getData().transactionHistory.filter((tx) => tx.type === 'ASSET_SALE').length >= 4 ? true : null));
  a1 = await money(a);
  b1 = await money(b);
  const afterCar = {
    seller: await a.evaluate((id) => { const g = window.game; return { mine: g.garage.mine().length, inWorld: g.world.vehicles.drivableVehicles.some((x) => x.id === `veh-own-${id}`), card: g.world.interactiveObjects.some((o) => o.id === `veh-own-${id}`), relist: null }; }, car.record.id),
    buyer: await b.evaluate((id) => { const g = window.game; const r = g.garage.record(id); return { mine: g.garage.mine().map((x) => x.id), mileage: r.mileage, owners: g.registry.peek().titles[`vehicle:${id}`].history.length, sales: g.registry.peek().sales.filter((s) => s.asset.id === id && s.sellerId !== null).length }; }, car.record.id),
  };
  const relist = await a.evaluate((id) => window.game.assetMarket.list({ kind: 'vehicle', id }, 300000, ''), car.record.id);
  check('the listing shows the vehicle\'s mileage, condition, plate and seller; the buyer negotiates it down and accepts the seller\'s counter',
    /km/.test(shown) && /condition/.test(shown) && /LAG-/.test(shown) && /Seller:/.test(shown) && handed, { shown: shown.slice(0, 120) });
  check('on completion the buyer pays the agreed price once, the seller is paid once less the fee, and the same vehicle with its mileage is now the buyer\'s',
    b0.total - b1.total === 230_000 && a1.total - a0.total === 225_400 && afterCar.buyer.mine.includes(car.record.id) && afterCar.buyer.mileage === driven.mileage && afterCar.buyer.owners === 2 && afterCar.buyer.sales === 1,
    { paid: b0.total - b1.total, received: a1.total - a0.total, buyer: afterCar.buyer });
  check('the seller no longer has it: it is gone from their garage and from their street, and they cannot sell it again',
    afterCar.seller.mine === 0 && !afterCar.seller.inWorld && !afterCar.seller.card && !relist.ok, { seller: afterCar.seller, relist });

  await b.evaluate(() => { const g = window.game; g.player.stopMoving(); g.player.mesh.position.set(-10, 0, 96); });
  const bBrought = await b.evaluate((id) => { const g = window.game; const why = g.ownedVehicles.bringRound(id); return { why, inWorld: g.world.vehicles.drivableVehicles.some((x) => x.id === `veh-own-${id}`) }; }, car.record.id);
  check('the new owner can have it brought round and drive it', bBrought.why === null && bBrought.inWorld, bBrought);

  // ------------------------------------------------------------------ After everything: one owner each, books that add up
  const books = await a.evaluate(() => {
    const state = window.game.registry.peek();
    const owners = Object.entries(state.titles).filter(([, t]) => t.ownerId !== null);
    const salesWithIds = new Set(state.sales.map((s) => s.id)).size === state.sales.length;
    const payoutsDue = Object.values(state.payouts).filter((p) => !p.claimedAt).length;
    const stuck = Object.values(state.listings).filter((l) => l.status === 'pending').length;
    const perSale = state.sales.filter((s) => s.sellerId !== null).every((s) => Object.values(state.payouts).filter((p) => p.saleId === s.id).length === 1);
    return { owners: owners.length, salesWithIds, payoutsDue, stuck, perSale, sales: state.sales.length };
  });
  check('at the end every sale has one record and one payout, nothing is left half-sold, and every asset has exactly one owner',
    books.salesWithIds && books.payoutsDue === 0 && books.stuck === 0 && books.perSale && books.owners >= 6, books);

  const errors = [...A.errors, ...B.errors, ...C.errors];
  check('land: no console errors in any of the three games', errors.length === 0, errors.slice(0, 6));
  await ctx.close();
}
