// The game server's rules, through its real HTTP and WebSocket interface: accounts, the
// ledger, limits on money the game reports, a job shift checked and paid by the server,
// players seeing only who is near, filtered and blockable chat, and the admin page's API.
// Starts its own server on a spare port with an empty database.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { DatabaseSync } from 'node:sqlite';
import { wait } from './lib.mjs';

const PORT = 8803;
const BASE = `http://localhost:${PORT}`;
const ADMIN = 'test-admin-key';

async function call(pathname, body, token, admin) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (admin) headers['x-nl-admin'] = admin;
  const r = await fetch(BASE + pathname, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
}

/** A player's WebSocket, collecting everything the server sends. */
function connect(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/play?token=${encodeURIComponent(token)}`);
    const got = [];
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'batch') got.push(...m.packets);
      else got.push(m);
    });
    ws.on('open', () => resolve({ ws, got, send: (p) => ws.send(JSON.stringify(p)) }));
    ws.on('error', reject);
  });
}

const stand = (x, z, city = 'lagos') => ({ type: 'state', player: { id: 'claimed-id', name: 'Claimed Name', position: { x, y: 0, z }, rotationY: 0, isMoving: false, currentEmote: 'idle', config: {}, city } });
const idem = () => `t:${Math.random().toString(36).slice(2)}${Date.now()}`;

export async function run(_browser, check) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-online-'));
  const child = spawn(process.execPath, ['server/game-server.ts'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_ADMIN_KEY: ADMIN, NL_STATIC: path.join(dataDir, 'no-static') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break;
      } catch {}
      await wait(200);
    }

    // Accounts
    const ada = await call('/auth/guest', { name: 'Ada' });
    const bayo = await call('/auth/guest', { name: 'Bayo <script>' });
    check('online: anyone can start as a guest at once, with the starting money held by the server', ada.ok && ada.account.kind === 'guest' && !ada.account.verified && ada.wallet.cash === 25000 && ada.wallet.bank === 150000, ada);
    check('online: a name is cleaned before anyone sees it', bayo.account.name === 'Bayo script', bayo.account);
    const noToken = await call('/me');
    check('online: without signing in, nothing of anyone is shown', noToken.status === 401, noToken);

    // Money the game reports: spending yes, earning only within a limit
    const spent = await call('/money/report', { cash: -2000, memo: 'Suya', idem: idem() }, ada.token);
    const repeatKey = idem();
    const earned = await call('/money/report', { cash: 30000, memo: 'Street gig', idem: repeatKey }, ada.token);
    const again = await call('/money/report', { cash: 30000, memo: 'Street gig', idem: repeatKey }, ada.token);
    check('online: spending is taken, and the same report sent twice is paid once', spent.ok && spent.wallet.cash === 23000 && earned.wallet.cash === 53000 && again.ok && again.wallet.cash === 53000, { spent: spent.wallet, earned: earned.wallet, again: again.wallet });
    const tooMuch = await call('/money/report', { cash: 1_000_000_000, memo: 'devtools', idem: idem() }, ada.token);
    const overdraw = await call('/money/report', { cash: -10_000_000, memo: 'too dear', idem: idem() }, ada.token);
    check('online: a billion naira from the game is not paid but held for checking, nothing goes below zero, and the wallet is unchanged', !tooMuch.ok && tooMuch.held > 0 && tooMuch.wallet.cash === 53000 && !overdraw.ok && overdraw.wallet.cash === 53000, { tooMuch, overdraw });

    // A loan is debt, not earnings: paid even after a good ten minutes, one at a time, within the limit
    const chidi = await call('/auth/guest', { name: 'Chidi' });
    await call('/money/report', { cash: 20000, memo: 'Street gig', idem: idem() }, chidi.token);
    const loan = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, chidi.token);
    const second = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, chidi.token);
    const repaid = await call('/money/report', { cash: -55000, memo: 'LOAN_REPAYMENT: Loan repayment to Eko Commercial Bank', idem: idem() }, chidi.token);
    const again2 = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, chidi.token);
    const closed = await call('/money/report', { cash: -50000, memo: 'LOAN_REPAYMENT: Loan repayment', idem: idem() }, chidi.token);
    const huge = await call('/money/report', { cash: 900_000_000, memo: 'LOAN_DISBURSEMENT: devtools', idem: idem() }, chidi.token);
    check('online: a ₦50,000 bank loan is paid at once even after ₦20,000 earned in ten minutes; a second one while the first is open is refused; repaid, another can be taken; nobody borrows ₦900m',
      loan.ok && loan.wallet.cash === 25000 + 20000 + 50000 && !second.ok && repaid.ok && again2.ok && closed.ok && !huge.ok && !huge.held,
      { loan: loan.wallet, second: second.reason, repaid: repaid.ok, again: again2.ok, huge: huge.reason });

    // Weekly instalments: each is taken once however many devices send it, and the loan stays
    // open until the payment that clears it (a Lapo loan the player starts with was never lent here)
    const emeka = await call('/auth/guest', { name: 'Emeka' });
    const lapoCleared = await call('/money/report', { cash: -5000, memo: 'LOAN_REPAYMENT: Last instalment, loan cleared: Lapo Microfinance Bank', idem: idem() }, emeka.token);
    const lent = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, emeka.token);
    const week = 'due:loan:Eko-Commercial-Bank:40:test';
    const part = await call('/money/report', { cash: -6875, memo: 'LOAN_INSTALMENT: Weekly instalment: Eko Commercial Bank', idem: week }, emeka.token);
    const partAgain = await call('/money/report', { cash: -6875, memo: 'LOAN_INSTALMENT: Weekly instalment: Eko Commercial Bank', idem: week }, emeka.token);
    const whileOpen = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, emeka.token);
    const last = await call('/money/report', { cash: -48125, memo: 'LOAN_REPAYMENT: Last instalment, loan cleared: Eko Commercial Bank', idem: idem() }, emeka.token);
    const next = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, emeka.token);
    check('online: a weekly instalment sent twice is taken once; the loan stays open after it and after an old Lapo loan was cleared, and closes with the last payment',
      lapoCleared.ok && lent.ok && part.ok && partAgain.ok && partAgain.wallet.cash === 25000 - 5000 + 50000 - 6875 && !whileOpen.ok && last.ok && next.ok,
      { lapoCleared: lapoCleared.ok, lent: lent.ok, part: part.wallet, partAgain: partAgain.wallet, whileOpen: whileOpen.reason, last: last.ok, next: next.ok });

    // A job shift, checked by the server
    const a = await connect(ada.token);
    const b = await connect(bayo.token);
    await wait(300);
    const welcome = a.got.find((m) => m.type === 'welcome');
    check('online: the server says who the player is (its id, not one the game makes up)', welcome?.id === ada.account.id, welcome);
    a.send(stand(0, 0));
    await wait(300);
    const notHired = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    const hired = await call('/work/hire', { employer: 'apapa-port' }, ada.token);
    const notThere = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    check('online: work cannot start before being taken on, nor away from the workplace', !notHired.ok && hired.ok && !notThere.ok && /not at the workplace/.test(notThere.reason), { notHired, notThere });
    // Arriving at the bay in a jump nobody could walk: not believed for ten seconds
    a.send(stand(-73, 55));
    await wait(300);
    const jumped = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    check('online: someone who appears at the workplace in a jump is not believed to be there for a while', !jumped.ok && /cannot see where you are/.test(jumped.reason), jumped);
    const hold = setInterval(() => a.send(stand(-73, 55)), 500);
    await wait(10_500);
    clearInterval(hold);
    const started = await call('/work/start', { employer: 'apapa-port' }, ada.token);
    const tooSoon = await call('/work/finish', { shift: started.shift, idem: idem() }, ada.token);
    check('online: at the loading bay the shift starts, and finishing it at once is refused as faster than anyone could', started.ok && !tooSoon.ok && /faster/.test(tooSoon.reason), { started, tooSoon });
    // Keep telling the server where Ada is while she works (the game does this ten times a second)
    const beat = setInterval(() => a.send(stand(-73, 55)), 500);
    await wait(12_500);
    clearInterval(beat);
    a.send(stand(-73, 55));
    await wait(200);
    const before = (await call('/me', null, ada.token)).wallet.cash;
    const finishKey = idem();
    const paid = await call('/work/finish', { shift: started.shift, idem: finishKey }, ada.token);
    const paidAgain = await call('/work/finish', { shift: started.shift, idem: finishKey }, ada.token);
    const after = (await call('/me', null, ada.token)).wallet.cash;
    const pushed = a.got.filter((m) => m.type === 'wallet').pop();
    check('online: after a real 12 s at the bay the server pays the casual hand rate (₦6,000) once, and tells the game the new balance', paid.ok && paid.pay === 6000 && after - before === 6000 && paidAgain.ok && paidAgain.replay && pushed?.wallet.cash === after, { paid, paidAgain, before, after, pushed });

    // Seeing each other: only those near
    b.send(stand(-70, 50));
    await wait(400);
    const seesBayo = a.got.some((m) => m.type === 'state' && m.player.id === bayo.account.id);
    const bayoState = a.got.filter((m) => m.type === 'state' && m.player.id === bayo.account.id).pop();
    b.send(stand(300, 300));
    await wait(400);
    const lostBayo = a.got.some((m) => m.type === 'leave' && m.id === bayo.account.id);
    check('online: a player near sees the other, under the server\'s id and name, and is told when they go out of sight', seesBayo && bayoState?.player.name === 'Bayo script' && lostBayo, { seesBayo, name: bayoState?.player.name, lostBayo });

    // Chat: filtered, slowed, blockable
    b.send(stand(-70, 50));
    await wait(300);
    b.send({ type: 'chat', message: { text: 'you be ashawo', id: 'c1' } });
    await wait(300);
    const rude = a.got.filter((m) => m.type === 'chat').pop();
    for (let i = 0; i < 5; i++) b.send({ type: 'chat', message: { text: `hello ${i}`, id: `s${i}` } });
    await wait(300);
    const refused = b.got.some((m) => m.type === 'refused' && m.what === 'chat');
    await call('/social/block', { id: bayo.account.id }, ada.token);
    const heardBefore = a.got.filter((m) => m.type === 'chat').length;
    await wait(6500);
    b.send({ type: 'chat', message: { text: 'are you there', id: 'c9' } });
    b.send({ type: 'dm', toId: ada.account.id, text: 'private hello' });
    await wait(400);
    const heardAfter = a.got.filter((m) => m.type === 'chat' || m.type === 'dm').length - heardBefore;
    check('online: an insult is masked before anyone sees it, a flood is slowed down, and someone blocked is not heard at all', rude && /\*{3}/.test(rude.message.text) && !/ashawo/.test(rude.message.text) && refused && heardAfter === 0, { rude: rude?.message.text, refused, heardAfter });

    // Money between players only through the server
    b.send({ type: 'p2p_transfer', transfer: { id: 'x', senderId: bayo.account.id, recipientId: ada.account.id, amount: 5_000_000, memo: 'free' } });
    await wait(300);
    const noPeerMoney = b.got.some((m) => m.type === 'refused' && m.what === 'p2p_transfer');
    const adaCash = (await call('/me', null, ada.token)).wallet;
    const sent = await call('/money/send', { to: ada.account.id, amount: 1000, from: 'bank', into: 'bank', memo: 'for suya', idem: idem() }, bayo.token);
    const adaAfter = (await call('/me', null, ada.token)).wallet;
    check('online: money passed player to player directly is refused; sent through the server it moves once, from one to the other', noPeerMoney && sent.ok && sent.wallet.bank === 149000 && adaAfter.bank - adaCash.bank === 1000, { noPeerMoney, sent: sent.wallet, ada: adaAfter });

    // Keeping progress: a guest adds an email and stays the same account
    const link = await call('/auth/email', { email: 'ada@example.com' }, ada.token);
    const token = new URL(link.devLink).searchParams.get('signin');
    const finished = await call('/auth/finish', { token });
    const reused = await call('/auth/finish', { token });
    check('online: a guest who adds an email keeps the same account and money, now verified; the link works once', finished.ok && finished.upgraded && finished.account.id === ada.account.id && finished.account.verified && finished.wallet.cash === after && !reused.ok, { finished, reused });

    // Admin
    const refusedAdmin = await call('/admin/stats');
    const stats = await call('/admin/stats', null, null, ADMIN);
    const ledger = await call(`/admin/ledger?id=${ada.account.id}`, null, null, ADMIN);
    const alerts = stats.economy?.alerts?.map((x) => x.kind) ?? [];
    check('online: the admin API needs the key, counts verified accounts apart, and shows each ledger row with whether the server checked it', refusedAdmin.status === 403 && stats.accounts.verified === 1 && stats.accounts.all === 4 && ledger.ledger.some((l) => l.kind === 'shift' && l.verified === 1) && ledger.ledger.some((l) => l.kind === 'client' && l.verified === 0), { verified: stats.accounts, kinds: ledger.ledger.map((l) => l.kind) });
    check('online: the held billion and the too-fast shift were raised as alerts', alerts.includes('earning-held') && alerts.includes('shift-too-fast'), alerts);
    // An honest big sale held the same way is paid once when the admin releases it
    const sale = await call('/money/report', { cash: 250000, memo: 'Sold a plot', idem: idem() }, bayo.token);
    const bayoBefore = (await call('/me', null, bayo.token)).wallet.cash;
    const released = await call('/admin/held', { held: sale.held, release: true }, null, ADMIN);
    const releasedAgain = await call('/admin/held', { held: sale.held, release: true }, null, ADMIN);
    const bayoAfter = (await call('/me', null, bayo.token)).wallet.cash;
    check('online: held money the admin releases is paid once', sale.held > 0 && released.ok && !releasedAgain.ok && bayoAfter - bayoBefore === 250000, { sale, bayoBefore, bayoAfter });

    // Business takings: paid at once to someone who owns the business, as far as it could have
    // taken; held for anybody who owns nothing; and takings held earlier let through with them
    const chi = await call('/auth/guest', { name: 'Chi' });
    const regId = `net:${'00000000-0000-4000-8000-'}${Date.now().toString(16).padStart(12, '0').slice(-12)}`;
    await call('/me/registry', { id: regId }, chi.token);
    const heldBefore = await call('/money/report', { bank: 200000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, chi.token);
    const lock = await call('/lock', { client: 'test' });
    const doc = JSON.parse(lock.text || '{}');
    doc.titles = { ...(doc.titles ?? {}), 'business:biz_pos_kiosk': { ownerId: regId } };
    await call('/commit', { token: lock.token, text: JSON.stringify(doc) });
    const chiBefore = (await call('/me', null, chi.token)).wallet;
    const takings = await call('/money/report', { bank: 180000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, chi.token);
    const chiAfter = (await call('/me', null, chi.token)).wallet;
    const greedy = await call('/money/report', { bank: 5_000_000_000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, chi.token);
    const nobody = await call('/money/report', { bank: 180000, memo: 'BUSINESS_INCOME: Lagos Enterprise Profit Payout', idem: idem() }, ada.token);
    check('online: business takings are paid at once to the owner of a business, up to what it could have taken, and takings held before are let through with them; ₦5bn from a POS kiosk is held, and takings for someone who owns no business are held',
      heldBefore.held > 0 && takings.ok && chiAfter.bank + chiAfter.cash - chiBefore.bank - chiBefore.cash === 380000 && !greedy.ok && greedy.held > 0 && !nobody.ok && nobody.held > 0,
      { heldBefore: heldBefore.held, takings: takings.ok, gained: chiAfter.bank + chiAfter.cash - chiBefore.bank - chiBefore.cash, greedy: greedy.held, nobody: nobody.held });
    // Naija Odds: a bet's stake is held by the server; seeds only for matches that have kicked off;
    // a bet on the match already playing is refused. (Settling at full time is in the League's own test.)
    const funmi = await call('/auth/guest', { name: 'Funmi' });
    const league = await call('/league', null, funmi.token);
    const slot = Math.floor(Date.now() / 300_000);
    const placedBet = await call('/bets/place', { slot: slot + 1, pick: 'X', stake: 20000 }, funmi.token);
    const lateBet = await call('/bets/place', { slot, pick: '1', stake: 1000 }, funmi.token);
    const myBets = await call('/bets/mine', null, funmi.token);
    check('online: a bet on the next match holds its stake on the server; a bet on the match already playing is refused; the seed of the next match is not out before kick-off',
      league.ok && (slot in league.seeds) && !((slot + 1) in league.seeds) && placedBet.ok && placedBet.wallet.bank === 150000 - 20000 && placedBet.bet.price > 1 && !lateBet.ok && myBets.bets.length === 1 && myBets.bets[0].status === 'open',
      { seeds: Object.keys(league.seeds ?? {}), placedBet, lateBet: lateBet.reason, mine: myBets.bets });

    // Eko Ads: a board rented by one player is charged on the server, seen by everyone, and cannot be taken by another
    const tunde = await call('/auth/guest', { name: 'Tunde' });
    const rentA = await call('/ads/rent', { board: 'board-2370-b', days: 1, headline: 'Tunde Tailors', line: 'Agbada in 3 days', colour: '#0b7a43' }, tunde.token);
    const rentB = await call('/ads/rent', { board: 'board-2370-b', days: 1, headline: 'Funmi Foods', line: '', colour: '#0b7a43' }, funmi.token);
    const seen = await call('/ads', null, funmi.token);
    const bogus = await call('/ads/rent', { board: 'board-x', days: 1, headline: 'Hi there' }, funmi.token);
    check('online: a billboard rented on Eko Ads is charged on the server (₦90,000 a day for a back face on the expressway), everyone sees it, and another player cannot take it',
      rentA.ok && rentA.wallet.bank === 150000 - 90000 && !rentB.ok && /Tunde/.test(rentB.reason) && seen.ads.some((a) => a.board === 'board-2370-b' && a.headline === 'Tunde Tailors' && !a.mine) && !bogus.ok,
      { rentA: rentA.wallet, rentB: rentB.reason, seen: seen.ads, bogus: bogus.reason });

    // The players' rich list: richest first, and where this player stands
    const rich = await call('/richlist', null, tunde.token);
    check('online: the rich list ranks players by cash and bank, richest first, and says where this player stands',
      rich.ok && rich.list.length >= 3 && rich.list.every((p, i) => i === 0 || rich.list[i - 1].worth >= p.worth) && rich.rank >= 1 && rich.count >= rich.list.length && rich.list.some((p) => p.me) === (rich.rank <= rich.list.length),
      { top: rich.list?.slice(0, 3), rank: rich.rank, count: rich.count });

    // Yarn: one feed for every player; filtered, one post every 20 seconds, a like counted once
    const said = await call('/feed/post', { text: 'Who dey Oga Sunday’s for the match?' }, tunde.token);
    const yarnTooSoon = await call('/feed/post', { text: 'And again' }, tunde.token);
    const likeOnce = await call('/feed/like', { id: said.post?.id }, funmi.token);
    const seenFeed = await call('/feed', null, funmi.token);
    const post = seenFeed.posts?.find((p) => p.id === said.post?.id);
    await call('/feed/like', { id: said.post?.id }, funmi.token);
    const unliked = (await call('/feed', null, funmi.token)).posts?.find((p) => p.id === said.post?.id);
    check('online: a Yarn post is read by every player, a second one inside 20 seconds is refused, and a like counts once and can be taken back',
      said.ok && !yarnTooSoon.ok && likeOnce.ok && post && post.by === 'Tunde' && post.likes === 1 && post.liked && !post.mine && unliked.likes === 0 && !unliked.liked,
      { said: said.ok, tooSoon: yarnTooSoon.reason, post, unliked });

    // Nollywood: auditioning casts the player, shooting without an audition is refused, and completing the shoot pays wrap fee + raises Fame on the server
    const lockedAudition = await call('/nollywood/audition', { filmId: 'island-heist', stars: 3 }, funmi.token);
    const shootWithoutRole = await call('/nollywood/shoot', { filmId: 'blood-on-the-lagoon', stars: 3 }, funmi.token);
    const castRes = await call('/nollywood/audition', { filmId: 'blood-on-the-lagoon', stars: 3 }, funmi.token);
    const funmiBeforeShoot = (await call('/me', null, funmi.token)).wallet;
    const shootRes = await call('/nollywood/shoot', { filmId: 'blood-on-the-lagoon', stars: 3 }, funmi.token);
    const shootAgain = await call('/nollywood/shoot', { filmId: 'blood-on-the-lagoon', stars: 3 }, funmi.token);
    const nwGet = await call('/nollywood', null, funmi.token);
    const nwCollect = await call('/nollywood/collect', {}, funmi.token);
    check('online: Nollywood enforces Fame requirements, casts on audition, pays the 3-star shoot wrap fee (₦45,000 + ₦13,500 bonus) once on the server, and records filmography and Fame',
      !lockedAudition.ok && !shootWithoutRole.ok && castRes.ok && castRes.active?.filmId === 'blood-on-the-lagoon' && shootRes.ok && shootRes.fame === 25 && shootRes.wallet.cash + shootRes.wallet.bank - (funmiBeforeShoot.cash + funmiBeforeShoot.bank) === 58500 && !shootAgain.ok && shootRes.filmography?.length === 1 && nwGet.ok && nwCollect.ok && nwCollect.fame === 25,
      { lockedAudition: lockedAudition.reason, shootWithoutRole: shootWithoutRole.reason, castRes, shootRes, shootAgain: shootAgain.reason, nwGet, nwCollect });

    // Home staff: hiring deducts first day's wage from the bank, daily pay-day deducts from bank once per day, and dismiss removes the role
    const funmiBeforeStaff = (await call('/me', null, funmi.token)).wallet;
    const hireCook = await call('/staff/hire', { role: 'cook', day: 1, now: Date.now() }, funmi.token);
    const staffSnap = await call('/staff', null, funmi.token);
    const hireCookAgain = await call('/staff/hire', { role: 'cook', day: 1, now: Date.now() }, funmi.token);
    const payDay2 = await call('/staff/pay-day', { day: 2 }, funmi.token);
    const dismissCook = await call('/staff/dismiss', { role: 'cook' }, funmi.token);
    check('online: Home Staff hires a cook for ₦4,500/day from the bank, refuses duplicate hire, deducts ₦4,500 from the bank on day 2, and dismisses cleanly',
      hireCook.ok && hireCook.paid === 4500 && staffSnap.ok && staffSnap.hired.length === 1 && funmiBeforeStaff.bank - hireCook.wallet.bank === 4500 && !hireCookAgain.ok && payDay2.ok && payDay2.paid === 4500 && hireCook.wallet.bank - payDay2.wallet.bank === 4500 && dismissCook.ok && dismissCook.snapshot.hired.length === 0,
      { hireCook, staffSnap, hireCookAgain: hireCookAgain.reason, payDay2, dismissCook });

    // Spark dating app: scheduling before matching is refused, liking matches, scheduling sets a waiting date at the venue, and completing the date deducts the bill once and raises closeness
    const dateBeforeMatch = await call('/spark/schedule-date', { profileId: 'zainab' }, funmi.token);
    const likeZainab = await call('/spark/like', { profileId: 'zainab', now: Date.now() }, funmi.token);
    const scheduleZainab = await call('/spark/schedule-date', { profileId: 'zainab', now: Date.now() }, funmi.token);
    const sparkSnap = await call('/spark', null, funmi.token);
    const funmiBeforeDate = (await call('/me', null, funmi.token)).wallet;
    const completeZainab = await call('/spark/complete-date', { profileId: 'zainab', venueKey: 'the-library', now: Date.now() }, funmi.token);
    const completeZainabAgain = await call('/spark/complete-date', { profileId: 'zainab', venueKey: 'the-library', now: Date.now() }, funmi.token);
    check('online: Spark refuses date before matching, matches with Zainab Bello, schedules a date at The Library (₦45,000), deducts the bill once on completion, and raises closeness to 60',
      !dateBeforeMatch.ok && likeZainab.ok && scheduleZainab.ok && sparkSnap.ok && sparkSnap.activeDate?.venueKey === 'the-library' && completeZainab.ok && completeZainab.paid === 45000 && funmiBeforeDate.bank - completeZainab.wallet.bank === 45000 && completeZainab.closeness === 60 && !completeZainabAgain.ok && completeZainab.snapshot.completedDates.length === 1,
      { dateBeforeMatch: dateBeforeMatch.reason, likeZainab, scheduleZainab, sparkSnap, completeZainab, completeZainabAgain: completeZainabAgain.reason });

    // Owambe app: buying Aso-Ebi, booking Freedom Park (₦35,000), refusing duplicate booking, and spraying Naira (₦15,000) once for +30 Fame
    const sprayBeforeBook = await call('/owambe/spray', { venueKey: 'freedom-park', stars: 3 }, funmi.token);
    const funmiBeforeOwambe = (await call('/me', null, funmi.token)).wallet;
    const buyLace = await call('/owambe/aso-ebi', { asoEbiId: 'gold-lace', now: Date.now() }, funmi.token);
    const bookFreedom = await call('/owambe/book', { tierId: 'island-birthday', now: Date.now() }, funmi.token);
    const bookDuplicate = await call('/owambe/book', { tierId: 'shrine-chieftaincy', now: Date.now() }, funmi.token);
    const owambeSnap = await call('/owambe', null, funmi.token);
    const sprayFreedom = await call('/owambe/spray', { venueKey: 'freedom-park', stars: 3, now: Date.now() }, funmi.token);
    const sprayAgain = await call('/owambe/spray', { venueKey: 'freedom-park', stars: 3, now: Date.now() }, funmi.token);
    check('online: Owambe buys Royal Gold Lace (₦15,000), books Freedom Park (₦35,000), refuses duplicate booking, sprays ₦15,000 once on the floor, and awards +30 Owambe Fame',
      !sprayBeforeBook.ok && buyLace.ok && buyLace.paid === 15000 && bookFreedom.ok && bookFreedom.paid === 35000 && !bookDuplicate.ok && owambeSnap.ok && owambeSnap.activeParty?.venueKey === 'freedom-park' && sprayFreedom.ok && sprayFreedom.paid === 15000 && sprayFreedom.fameEarned === 30 && funmiBeforeOwambe.bank - sprayFreedom.wallet.bank === 65000 && !sprayAgain.ok && sprayFreedom.snapshot.history.length === 1,
      { sprayBeforeBook: sprayBeforeBook.reason, buyLace, bookFreedom, bookDuplicate: bookDuplicate.reason, owambeSnap, sprayFreedom, sprayAgain: sprayAgain.reason });

    // Studio app: enforces Music Fame requirements, books Studio B (₦25,000), records Eko Sunrise (+₦45,500 advance), and performs the Freedom Park headline show (+₦50,000) once
    const lockedStudio = await call('/studio/book', { trackId: 'lekki-log-drum' }, funmi.token);
    const recordBeforeBook = await call('/studio/record', { trackId: 'lagos-sunrise', stars: 3 }, funmi.token);
    const funmiBeforeStudio = (await call('/me', null, funmi.token)).wallet;
    const bookStudio = await call('/studio/book', { trackId: 'lagos-sunrise' }, funmi.token);
    const bookStudioDup = await call('/studio/book', { trackId: 'lagos-sunrise' }, funmi.token);
    const recordStudio = await call('/studio/record', { trackId: 'lagos-sunrise', stars: 3 }, funmi.token);
    const concertStudio = await call('/studio/concert', { trackId: 'lagos-sunrise', stars: 3 }, funmi.token);
    const concertAgain = await call('/studio/concert', { trackId: 'lagos-sunrise', stars: 3 }, funmi.token);
    // Net change: -25,000 booking + 45,500 advance + 50,000 concert = +70,500
    check('online: Studio enforces Music Fame, books Studio B (₦25,000), masters Eko Sunrise (+₦45,500), and settles the Freedom Park headline concert (+₦50,000) once for 50 Music Fame',
      !lockedStudio.ok && !recordBeforeBook.ok && bookStudio.ok && bookStudio.paid === 25000 && !bookStudioDup.ok && recordStudio.ok && recordStudio.fame === 25 && concertStudio.ok && concertStudio.paid === 50000 && concertStudio.fame === 50 && !concertAgain.ok && (concertStudio.wallet.cash + concertStudio.wallet.bank) - (funmiBeforeStudio.cash + funmiBeforeStudio.bank) === 70500,
      { lockedStudio: lockedStudio.reason, recordBeforeBook: recordBeforeBook.reason, bookStudio, bookStudioDup: bookStudioDup.reason, recordStudio, concertStudio, concertAgain: concertAgain.reason });

    // Marriage app: buys Silver Ring (₦35,000), fails proposal if closeness < 60, proposes with 60% closeness, and marries with dowry (₦75,000)
    const proposeLowCloseness = await call('/marriage/propose', { spouseId: 'zainab', ringId: 'silver', closeness: 40 }, funmi.token);
    const funmiBeforeMarriage = (await call('/me', null, funmi.token)).wallet;
    const buySilverRing = await call('/marriage/ring', { ringId: 'silver' }, funmi.token);
    const proposeValid = await call('/marriage/propose', { spouseId: 'zainab', ringId: 'silver', closeness: 65 }, funmi.token);
    const proposeAgain = await call('/marriage/propose', { spouseId: 'zainab', ringId: 'silver', closeness: 65 }, funmi.token);
    const marryValid = await call('/marriage/marry', { dowryAmount: 75000 }, funmi.token);
    const marryAgain = await call('/marriage/marry', { dowryAmount: 75000 }, funmi.token);
    const marriageSnap = await call('/marriage', null, funmi.token);
    // Net cost: -35,000 ring - 75,000 dowry = -110,000
    check('online: Marriage buys Silver Ring (₦35,000), checks 60% closeness on proposal, and holds traditional wedding ceremony with dowry (₦75,000)',
      !proposeLowCloseness.ok && buySilverRing.ok && buySilverRing.paid === 35000 && proposeValid.ok && proposeValid.marriage?.status === 'engaged' && !proposeAgain.ok && marryValid.ok && marryValid.marriage?.status === 'married' && marryValid.dowryPaid === 75000 && !marryAgain.ok && marriageSnap.ok && marriageSnap.marriage?.status === 'married' && (funmiBeforeMarriage.cash + funmiBeforeMarriage.bank) - (marryValid.wallet.cash + marryValid.wallet.bank) === 110000,
      { proposeLowCloseness: proposeLowCloseness.reason, buySilverRing, proposeValid, proposeAgain: proposeAgain.reason, marryValid, marryAgain: marryAgain.reason, marriageSnap });

    // Chieftaincy app: checks Fame requirements, confers Otunba title with investiture offering (₦250,000), awards title regalia, sets active title, and refuses duplicate title
    const chief = await call('/auth/guest', { name: 'ObaCandidate', save: { cash: 300000, bank: 800000 } });
    const conferLowFame = await call('/chieftaincy/confer', { titleId: 'otunba', fame: 10 }, chief.token);
    const chiefBefore = (await call('/me', null, chief.token)).wallet;
    const conferOtunba = await call('/chieftaincy/confer', { titleId: 'otunba', fame: 30 }, chief.token);
    const conferDup = await call('/chieftaincy/confer', { titleId: 'otunba', fame: 30 }, chief.token);
    const chiefSnap = await call('/chieftaincy', null, chief.token);
    const setActive = await call('/chieftaincy/active', { titleId: 'otunba' }, chief.token);
    check('online: Chieftaincy checks Fame requirements, confers Otunba of Lagos (₦250,000), refuses duplicate investiture, and tracks active royal title on the server',
      !conferLowFame.ok && conferOtunba.ok && conferOtunba.paid === 250000 && !conferDup.ok && chiefSnap.ok && chiefSnap.titles.length === 1 && chiefSnap.activeTitle === 'otunba' && setActive.ok && (chiefBefore.cash + chiefBefore.bank) - (conferOtunba.wallet.cash + conferOtunba.wallet.bank) === 250000,
      { conferLowFame: conferLowFame.reason, conferOtunba, conferDup: conferDup.reason, chiefSnap, setActive });

    // Eko Motors & Luxury Tuning Garage: buying Toyota Land Cruiser 300 VXR (₦75,000,000), tuning Twin-Turbo Stage 2 (₦15,000,000), Emerald wrap (₦8,500,000), and VIP Convoy Siren (₦12,000,000)
    const tycoon = await call('/auth/guest', { name: 'EkoTycoon' });
    const deposit = await call('/money/report', { bank: 150000000, memo: 'Oil Block Royalty Liquidation', idem: idem() }, tycoon.token);
    await call('/admin/held', { held: deposit.held, release: true }, null, ADMIN);
    const tycoonBefore = (await call('/me', null, tycoon.token)).wallet;
    const buyLandCruiser = await call('/motors/buy', { modelId: 'land_cruiser', now: Date.now() }, tycoon.token);
    const motorsSnap = await call('/motors', null, tycoon.token);
    const carId = buyLandCruiser.vehicle?.vehicleId;
    const tuneTurbo = await call('/motors/tune', { vehicleId: carId, optionId: 'tune_stage2' }, tycoon.token);
    const tuneWrap = await call('/motors/tune', { vehicleId: carId, optionId: 'wrap_emerald' }, tycoon.token);
    const tuneSiren = await call('/motors/tune', { vehicleId: carId, optionId: 'mod_siren' }, tycoon.token);
    const tycoonAfter = (await call('/me', null, tycoon.token)).wallet;
    // Net spent: 75,000,000 + 15,000,000 + 8,500,000 + 12,000,000 = 110,500,000
    check('online: Eko Motors purchases Land Cruiser 300 (₦75,000,000), installs Stage 2 Twin-Turbo (₦15,000,000), Emerald wrap (₦8,500,000), and VIP Convoy Siren (₦12,000,000) on the server',
      buyLandCruiser.ok && buyLandCruiser.paid === 75000000 && motorsSnap.ok && motorsSnap.vehicles.length === 1 && tuneTurbo.ok && tuneWrap.ok && tuneSiren.ok && (tycoonBefore.cash + tycoonBefore.bank) - (tycoonAfter.cash + tycoonAfter.bank) === 110500000,
      { buyLandCruiser, motorsSnap, tuneTurbo, tuneWrap, tuneSiren, tycoonBefore, tycoonAfter });

    // The allowance, now that the large earners are checked by the server. ₦48,000 still
    // clears; the next ₦1,000 in the same ten minutes is held.
    const bola = await call('/auth/guest', { name: 'Bola' });
    const within = await call('/money/report', { cash: 48_000, memo: 'Fares and a remittance', idem: idem() }, bola.token);
    const pastIt = await call('/money/report', { cash: 1000, memo: 'One more fare', idem: idem() }, bola.token);
    check('online: unverified earnings clear up to ₦48,000 in ten minutes, and the next ₦1,000 is held', within.ok && within.wallet.cash === 25_000 + 48_000 && !pastIt.ok && pastIt.held > 0, { within: within.wallet, pastIt });

    // A guest stood on a spot from the first packet, and kept there, so the server believes them.
    const onSpot = async (name, x, z, city = 'lagos') => {
      const guest = await call('/auth/guest', { name });
      const sock = await connect(guest.token);
      await wait(200);
      const beat = setInterval(() => sock.send(stand(x, z, city)), 400);
      sock.send(stand(x, z, city));
      await wait(300);
      return { guest, sock, stop: () => { clearInterval(beat); sock.ws.close(); } };
    };

    // 1. Plot takings. A shop nets ₦200,000 a game day. Two days on the plot, paid by the server into the bank.
    const sade = await call('/auth/guest', { name: 'Sade' });
    const sadeReg = `net:${randomUUID()}`;
    await call('/me/registry', { id: sadeReg }, sade.token);
    const HOUR = 25_000;
    const DAY = 24 * HOUR;
    const lock2 = await call('/lock', { client: 'takings' });
    const doc2 = JSON.parse(lock2.text || '{}');
    doc2.titles = { ...(doc2.titles ?? {}), 'plot:lag-kakawa-e1': { ownerId: sadeReg, history: [] }, 'plot:lag-kakawa-e2': { ownerId: sadeReg, history: [] } };
    doc2.buildings = {
      ...(doc2.buildings ?? {}),
      'lag-kakawa-e1': { plotId: 'lag-kakawa-e1', typeId: 'shop', x: 58, z: 22, turns: 0, builderId: sadeReg, cost: 8_000_000, hoursNeeded: 6, startedAt: Date.now() - 2 * DAY - 6 * HOUR - 5_000 },
      'lag-kakawa-e2': { plotId: 'lag-kakawa-e2', typeId: 'shop', x: 57, z: 41, turns: 0, builderId: sadeReg, cost: 8_000_000, hoursNeeded: 6, startedAt: Date.now() },
    };
    await call('/commit', { token: lock2.token, text: JSON.stringify(doc2) });
    const owner = await connect(sade.token);
    await wait(200);
    const keep = setInterval(() => owner.send(stand(58.5, 22)), 400);
    owner.send(stand(58.5, 22));
    await wait(300);
    const bankBefore = (await call('/me', null, sade.token)).wallet.bank;
    const takeKey = idem();
    const took = await call('/money/takings', { plot: 'lag-kakawa-e1', idem: takeKey, amount: 999_999_999 }, sade.token);
    const tookAgain = await call('/money/takings', { plot: 'lag-kakawa-e1', idem: takeKey, amount: 999_999_999 }, sade.token);
    const tooSoonTake = await call('/money/takings', { plot: 'lag-kakawa-e1', idem: idem() }, sade.token);
    const bankAfter = (await call('/me', null, sade.token)).wallet.bank;
    check('online: shop takings are the server\'s figure for the days it stood (about ₦400,000), paid once into the bank, and a named amount is ignored',
      took.ok && took.pay >= 400_000 && took.pay <= 410_000 && took.pay % 100 === 0 && bankAfter - bankBefore === took.pay && tookAgain.ok && tookAgain.replay && !tooSoonTake.ok && /nothing has come in/i.test(tooSoonTake.reason),
      { took, tookAgain, tooSoonTake, bankBefore, bankAfter });
    clearInterval(keep);
    owner.send(stand(70, 22));
    await wait(300);
    const offPlot = await call('/money/takings', { plot: 'lag-kakawa-e1', idem: idem() }, sade.token);
    owner.send(stand(57.5, 41));
    await wait(300);
    const unfinished = await call('/money/takings', { plot: 'lag-kakawa-e2', idem: idem() }, sade.token);
    owner.ws.close();
    const stranger = await onSpot('Kunle', 58.5, 22);
    await call('/me/registry', { id: `net:${randomUUID()}` }, stranger.guest.token);
    const notYours = await call('/money/takings', { plot: 'lag-kakawa-e1', idem: idem() }, stranger.guest.token);
    stranger.stop();
    check('online: takings are refused off the plot, on a building that is not finished, and to someone who does not own it',
      !offPlot.ok && /not on that plot/.test(offPlot.reason) && !unfinished.ok && /not finished/.test(unfinished.reason) && !notYours.ok && /not your building/.test(notYours.reason),
      { offPlot, unfinished, notYours });

    // A worksite shift: hired, standing there, too fast refused, then the grade's pay and not a number the client sent.
    const gradeShift = async (name, employer, x, z, city, seconds) => {
      const there = await onSpot(name, x, z, city);
      const hired = await call('/work/hire', { employer }, there.guest.token);
      const started = await call('/work/start', { employer }, there.guest.token);
      const tooFast = await call('/work/finish', { shift: started.shift, idem: idem(), amount: 9_999_999 }, there.guest.token);
      await wait(seconds);
      there.sock.send(stand(x, z, city));
      await wait(200);
      const before = (await call('/me', null, there.guest.token)).wallet.cash;
      const paid = await call('/work/finish', { shift: started.shift, idem: idem(), amount: 9_999_999 }, there.guest.token);
      there.stop();
      return { hired, started, tooFast, paid, gained: (paid.wallet?.cash ?? 0) - before };
    };
    // 3, 4, 5. The three minigames, entry grade.
    const cchub = await gradeShift('Wale', 'cchub-yaba', -10, -25, 'lagos', 6_800);
    const away = await onSpot('Tobi', 80, 80);
    await call('/work/hire', { employer: 'cchub-yaba' }, away.guest.token);
    const notAtHub = await call('/work/start', { employer: 'cchub-yaba' }, away.guest.token);
    away.stop();
    const refinery = await gradeShift('Ife', 'ph-refinery', 55, -10, 'port_harcourt', 6_800);
    const lastma = await gradeShift('Seun', 'lastma-warden', 0, 1.5, 'lagos', 6_800);
    check('online: CcHUB, the refinery and LASTMA pay the entry grade once the server has timed the shift, and not from across town',
      cchub.hired.ok && cchub.started.ok && !cchub.tooFast.ok && /faster/.test(cchub.tooFast.reason) && cchub.paid.pay === 16_000 && cchub.gained === 16_000
      && !notAtHub.ok && /not at the workplace/.test(notAtHub.reason)
      && refinery.paid.pay === 12_000 && refinery.gained === 12_000 && !refinery.tooFast.ok
      && lastma.paid.pay === 8_500 && lastma.gained === 8_500 && !lastma.tooFast.ok,
      { cchub, notAtHub, refinery, lastma });

    // 2. The generator cord: on the spot, too fast refused, then ₦2,500. A pull from anywhere is refused.
    const gen = await onSpot('Ngozi', 8.5, 24);
    const genStart = await call('/work/gig/start', { gig: 'street:generator' }, gen.guest.token);
    const genFast = await call('/work/gig/finish', { shift: genStart.shift, idem: idem(), amount: 9_999_999 }, gen.guest.token);
    await wait(4_800);
    gen.sock.send(stand(8.5, 24));
    await wait(200);
    const genBefore = (await call('/me', null, gen.guest.token)).wallet.cash;
    const genPaid = await call('/work/gig/finish', { shift: genStart.shift, idem: idem(), amount: 9_999_999 }, gen.guest.token);
    gen.stop();
    const genAway = await call('/work/gig/start', { gig: 'street:generator' }, bola.token);
    check('online: the generator pays ₦2,500 after a few seconds beside it, and a pull from nowhere is refused',
      genStart.ok && !genFast.ok && /faster/.test(genFast.reason) && genPaid.pay === 2_500 && genPaid.wallet.cash - genBefore === 2_500 && !genAway.ok,
      { genStart, genFast, genPaid, genAway });

    // PAYE, taken by the server. Earlier this month the player was paid ₦300,000 in wages, with
    // ₦36,500 PAYE on them (put straight into the server's payslips); a CcHUB shift now is taxed at 18%.
    const lagosMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
    const taxed = await onSpot('Taiwo', -10, -25);
    const seeded = new DatabaseSync(path.join(dataDir, 'nigerialife.db'));
    seeded.exec('PRAGMA busy_timeout = 2000');
    seeded
      .prepare("INSERT INTO payslips (account_id, at, month, employer, title, office, gross, relief, paye, net, month_gross, month_paye, rate, idem) VALUES (?, ?, ?, 'Earlier employer', 'Earlier work', 'Lagos State Internal Revenue Service', 300000, 0, 36500, 263500, 300000, 36500, 0.18, 'seed')")
      .run(taxed.guest.account.id, Date.now() - 60_000, lagosMonth);
    seeded.close();
    await call('/work/hire', { employer: 'cchub-yaba' }, taxed.guest.token);
    const taxStart = await call('/work/start', { employer: 'cchub-yaba' }, taxed.guest.token);
    // A career shift is a wage too (a payslip, no PAYE yet on a first ₦4,500); the generator is cash in hand
    const clerk = await call('/auth/guest', { name: 'Clerk' });
    const clerkStart = await call('/work/gig/start', { gig: 'career:job_shop_assistant' }, clerk.token);
    await wait(10_300);
    taxed.sock.send(stand(-10, -25));
    await wait(200);
    const taxBefore = (await call('/me', null, taxed.guest.token)).wallet.cash;
    const taxPaid = await call('/work/finish', { shift: taxStart.shift, idem: idem() }, taxed.guest.token);
    const clerkPaid = await call('/work/gig/finish', { shift: clerkStart.shift, idem: idem() }, clerk.token);
    // Home rent paid this month earns relief (a fifth, at most ₦41,667); a staff wage does not
    await call('/money/report', { bank: -100000, memo: 'RENT_PAYMENT: Saturday rent: Room in Mushin', idem: idem() }, taxed.guest.token);
    await call('/money/report', { bank: -5000, memo: 'RENT_PAYMENT: Home Staff Wage: Cook (Cook)', idem: idem() }, taxed.guest.token);
    const taxBook = await call('/me/tax', null, taxed.guest.token);
    taxed.stop();
    check('online: PAYE is the server\'s: ₦16,000 at CcHUB after ₦300,000 this month is taxed at 18% (₦2,880), ₦13,120 is paid, the payslip says so, and the tax page has the month, the year, rent relief and both payslips',
      taxPaid.ok && taxPaid.pay === 16_000 && taxPaid.slip?.paye === 2_880 && taxPaid.slip.net === 13_120 && taxPaid.wallet.cash - taxBefore === 13_120 && taxPaid.slip.rate === 0.18 && /Lagos State/.test(taxPaid.slip.office)
      && taxBook.ok && taxBook.month === lagosMonth && taxBook.gross === 316_000 && taxBook.paye === 39_380 && taxBook.rent === 100_000 && taxBook.relief === 20_000 && taxBook.yearPaye === 39_380
      && taxBook.slips.length === 2 && taxBook.slips[1].paye === 2_880 && taxBook.slips[1].monthGross === 316_000,
      { taxPaid, taxBook });
    check('online: a career shift comes with a payslip from its employer; the generator gig is paid whole with none',
      clerkPaid.ok && clerkPaid.pay === 4_500 && clerkPaid.slip?.employer === 'Balogun Wholesale Market' && clerkPaid.slip.paye === 0 && clerkPaid.wallet.cash === 25_000 + 4_500 && genPaid.ok && genPaid.slip === undefined,
      { clerkPaid, gen: genPaid.slip });

    // The next tier, same gig clock: the code sprint the phone used to pay at once.
    const kode = await call('/auth/guest', { name: 'Kode' });
    const codeStart = await call('/work/gig/start', { gig: 'life:code' }, kode.token);
    const codeFast = await call('/work/gig/finish', { shift: codeStart.shift, idem: idem(), amount: 9_999_999 }, kode.token);
    await wait(8_600);
    const codeBefore = (await call('/me', null, kode.token)).wallet.cash;
    const codePaid = await call('/work/gig/finish', { shift: codeStart.shift, idem: idem(), amount: 9_999_999 }, kode.token);
    check('online: the code sprint pays the server\'s ₦25,000 after its own clock, not a figure the game sends',
      codeStart.ok && !codeFast.ok && /faster/.test(codeFast.reason) && codePaid.pay === 25_000 && codePaid.wallet.cash - codeBefore === 25_000,
      { codeStart, codeFast, codePaid });

    await call('/admin/mute', { id: bayo.account.id, minutes: 5 }, null, ADMIN);
    b.send({ type: 'chat', message: { text: 'can you hear me', id: 'm1' } });
    await wait(300);
    check('online: a player muted from the admin page cannot chat', b.got.some((m) => m.type === 'refused' && /muted/.test(m.reason)));

    a.ws.close();
    b.ws.close();
  } finally {
    child.kill();
  }
}
