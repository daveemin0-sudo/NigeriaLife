// The game server's rules, through its real HTTP and WebSocket interface: accounts, the
// ledger, limits on money the game reports, a job shift checked and paid by the server,
// players seeing only who is near, filtered and blockable chat, and the admin page's API.
// Starts its own server on a spare port with an empty database.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
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
    await call('/money/report', { cash: 50000, memo: 'Street gig', idem: idem() }, chidi.token);
    const loan = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, chidi.token);
    const second = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, chidi.token);
    const repaid = await call('/money/report', { cash: -55000, memo: 'LOAN_REPAYMENT: Loan repayment to Eko Commercial Bank', idem: idem() }, chidi.token);
    const again2 = await call('/money/report', { cash: 50000, memo: 'LOAN_DISBURSEMENT: Loan from Eko Commercial Bank', idem: idem() }, chidi.token);
    const closed = await call('/money/report', { cash: -50000, memo: 'LOAN_REPAYMENT: Loan repayment', idem: idem() }, chidi.token);
    const huge = await call('/money/report', { cash: 900_000_000, memo: 'LOAN_DISBURSEMENT: devtools', idem: idem() }, chidi.token);
    check('online: a ₦50,000 bank loan is paid at once even after ₦50,000 earned in ten minutes; a second one while the first is open is refused; repaid, another can be taken; nobody borrows ₦900m',
      loan.ok && loan.wallet.cash === 25000 + 50000 + 50000 && !second.ok && repaid.ok && again2.ok && closed.ok && !huge.ok && !huge.held,
      { loan: loan.wallet, second: second.reason, repaid: repaid.ok, again: again2.ok, huge: huge.reason });

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
    check('online: the admin API needs the key, counts verified accounts apart, and shows each ledger row with whether the server checked it', refusedAdmin.status === 403 && stats.accounts.verified === 1 && stats.accounts.all === 3 && ledger.ledger.some((l) => l.kind === 'shift' && l.verified === 1) && ledger.ledger.some((l) => l.kind === 'client' && l.verified === 0), { verified: stats.accounts, kinds: ledger.ledger.map((l) => l.kind) });
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
