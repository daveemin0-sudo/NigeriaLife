// Sitting down in places: whatever is done sitting (a haircut, a film, a show, a meal) is done on
// something to sit on, never on the floor or in the air; a barber's chair faces its mirror; a meal
// is taken to a table where a chair or a bench stands; and the player is seen sat on it.
import { open, newPlayer, closeDialogs, playUntil, advance, enterInterior, useStation, wait } from './lib.mjs';

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  const all = await page.evaluate(() => {
    const g = window.game;
    const out = [];
    for (const place of g.world.interiorManager.places) {
      for (const [id, s] of place.seats) out.push({ place: place.spec.key, id, top: +place.topAt(s.seat[0], s.seat[1]).toFixed(2), yaw: +s.yaw.toFixed(2) });
      for (const st of place.spec.stations) {
        if (!st.choices.some((c) => c.sit && /Hunger \+/.test(c.note ?? ''))) continue;
        const spot = place.tables.length ? place.freeSeat(st.stand) : null;
        if (spot) out.push({ place: place.spec.key, id: `${st.id} meal`, top: +place.topAt(spot.seat[0], spot.seat[1]).toFixed(2), table: true });
      }
    }
    return out;
  });
  const onAir = all.filter((s) => s.top < 0.3 || s.top > 0.75);
  check('seats: everything done sitting in a place has a chair, a bench or a seat under it', all.length >= 30 && onAir.length === 0, { seats: all.length, onAir });
  const barber = all.find((s) => s.place === 'allen-salon' && s.id === 'barber');
  check('seats: in the barber\'s chair the player faces the mirror, their back to the room', !!barber && Math.abs(Math.abs(barber.yaw) - Math.PI) < 0.3, barber);
  const buka = all.find((s) => s.place === 'amala-shitta' && /meal/.test(s.id));
  check('seats: at Amala Shitta a meal is eaten at a table, on its bench', !!buka && buka.table, buka);

  // Seen: in the barber's chair, sat on its seat
  await page.evaluate(() => { const b = window.game.hud.backend; b.data.bank.balance += 1_000_000; b.saveData(); window.game.world.skyEnvironment.setHour(12); });
  await enterInterior(page, 'interior_place_allen-salon');
  await useStation(page, 'place_allen-salon_barber');
  await wait(300);
  await page.evaluate(() => [...document.querySelectorAll('#dialogue-choices-row .dialogue-choice-btn')].find((b) => /low cut/i.test(b.innerText))?.click());
  const seated = await playUntil(page, () => {
    const g = window.game;
    const a = g.player.actor;
    if (a.pose.legs !== 'sit') return null;
    const place = g.world.interiorManager.places.find((p) => p.spec.key === 'allen-salon');
    const o = place.group.position;
    const s = place.seats.get('barber');
    return { off: +Math.hypot(g.player.position.x - o.x - s.seat[0], g.player.position.z - o.z - s.seat[1]).toFixed(2), yaw: +a.yaw.toFixed(2) };
  }, 30);
  await playUntil(page, () => (window.game.player.actor.sequence ? null : true), 30);
  const after = await page.evaluate(() => ({ legs: window.game.player.actor.pose.legs, free: !window.game.player.actor.scripted }));
  check('seats: the haircut is had sitting in the barber\'s chair, and the player gets up after', !!seated && seated.off < 0.15 && after.legs === 'stand' && after.free, { seated, after });

  check('seats: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
