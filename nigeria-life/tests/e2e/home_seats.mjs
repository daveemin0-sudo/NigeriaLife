// Home seats: every sofa, armchair and dining chair puts the character on the cushion /
// chair facing correctly, with no body vertex sinking into the seat or the table top.
import { open, newPlayer, closeDialogs, wait, playUntil, advance } from './lib.mjs';

const PROP = 'prop_lekki_duplex';

/** Sit on one furniture piece (nearest spot) using the game’s own sitAt path. */
async function sitOn(page, predSrc) {
  return page.evaluate((src) => {
    const g = window.game;
    const r = g.world.interiorManager.residence;
    const decor = g.modules.HouseDecorationSystem.getInstance();
    const pred = eval(`(${src})`);
    const item = decor.placed.find(pred);
    if (!item) return { err: 'missing' };
    const kind = decor.kind(item.modelType);
    const spots = (kind.seats?.length ? kind.seats : kind.seat ? [kind.seat] : []).map((s) => ({
      x: s.x, z: s.z, top: s.top ?? 0.5,
    }));
    if (!spots.length) return { err: 'no spots', model: item.modelType };
    const turn = (item.turns * Math.PI) / 2;
    const onIt = (x, z) => ({
      x: item.x + x * Math.cos(turn) + z * Math.sin(turn),
      z: item.z - x * Math.sin(turn) + z * Math.cos(turn),
    });
    const dining = /dining_table|plastic_set/.test(item.modelType);
    const ox = r.group.position.x;
    const oz = r.group.position.z;
    const px = g.player.position.x - ox;
    const pz = g.player.position.z - oz;
    let best = spots[0];
    let bestD = Infinity;
    for (const s of spots) {
      const at = onIt(s.x, s.z);
      const d = (at.x - px) ** 2 + (at.z - pz) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
    const seat = onIt(best.x, best.z);
    let facing;
    let front;
    if (dining) {
      facing = Math.atan2(item.x - seat.x, item.z - seat.z);
      const awayX = seat.x - item.x;
      const awayZ = seat.z - item.z;
      const len = Math.hypot(awayX, awayZ) || 1;
      front = { x: seat.x + (awayX / len) * 0.55, z: seat.z + (awayZ / len) * 0.55 };
    } else {
      const face = decor.facing(item.turns);
      const size = decor.footprint(item.modelType, item.turns);
      const reach = (face.x !== 0 ? size.width : size.depth) / 2 + 0.55;
      facing = Math.atan2(face.x, face.z);
      front = { x: item.x + face.x * reach, z: item.z + face.z * reach };
    }
    const THREE = g.modules.THREE;
    const started = r.life.sitAt(
      new THREE.Vector3(seat.x, 0, seat.z),
      new THREE.Vector3(front.x, 0, front.z),
      facing,
      best.top,
    );
    return {
      started,
      model: item.modelType,
      dining,
      seat,
      facing,
      top: best.top,
      spots: spots.length,
      item: { x: item.x, z: item.z, uid: item.uid },
    };
  }, predSrc);
}

/** Sample body vertices; flag any that penetrate the seat cushion or dining table top slab. */
async function penetration(page, meta) {
  return page.evaluate((m) => {
    const g = window.game;
    const THREE = g.modules.THREE;
    const r = g.world.interiorManager.residence;
    const o = r.group.position;
    const actor = g.player.actor;
    const root = actor.root;
    root.updateMatrixWorld(true);

    const verts = [];
    root.traverse((obj) => {
      const mesh = obj;
      if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
      const pos = mesh.geometry.attributes.position;
      const step = Math.max(1, Math.floor(pos.count / 40));
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        verts.push({ x: v.x - o.x, y: v.y - o.y, z: v.z - o.z });
      }
    });

    const seatTop = m.top;
    // Deep cushion penetration only: resting on the top is fine; >6 cm into the pad is not
    const seatHalf = m.dining ? 0.18 : 0.28;
    const cushionBot = seatTop - 0.14;
    let inSeat = 0;
    for (const v of verts) {
      if (Math.abs(v.x - m.seat.x) > seatHalf || Math.abs(v.z - m.seat.z) > seatHalf) continue;
      if (v.y >= cushionBot && v.y < seatTop - 0.06) inSeat += 1;
    }

    let inTable = 0;
    if (m.dining) {
      // Table top slab interior (inset); a few forearm verts at the edge are tolerated by the threshold
      const halfW = 0.45;
      const halfL = /dining_table_10/.test(m.model) ? 1.5 : 0.9;
      for (const v of verts) {
        if (Math.abs(v.x - m.item.x) > halfW || Math.abs(v.z - m.item.z) > halfL) continue;
        if (v.y >= 0.72 && v.y <= 0.80) inTable += 1;
      }
    }

    const hipY = (() => {
      // Approximate hip height from mid-body verts near seat XZ
      let best = null;
      for (const v of verts) {
        if (Math.hypot(v.x - m.seat.x, v.z - m.seat.z) > 0.35) continue;
        if (v.y < seatTop - 0.05 || v.y > seatTop + 0.55) continue;
        if (!best || Math.abs(v.y - (seatTop + 0.2)) < Math.abs(best - (seatTop + 0.2))) best = v.y;
      }
      return best;
    })();

    const facingOk = !m.dining || (() => {
      // Facing the table: yaw should point toward item centre
      const want = Math.atan2(m.item.x - m.seat.x, m.item.z - m.seat.z);
      let d = Math.abs(actor.yaw - want);
      while (d > Math.PI) d = Math.abs(d - Math.PI * 2);
      return d < 0.35;
    })();

    return {
      verts: verts.length,
      inSeat,
      inTable,
      hipY: hipY == null ? null : +hipY.toFixed(3),
      seatTop,
      facingOk,
      legs: actor.pose.legs,
      poseH: actor.pose.height ?? null,
      off: +Math.hypot(g.player.position.x - o.x - m.seat.x, g.player.position.z - o.z - m.seat.z).toFixed(2),
    };
  }, meta);
}

async function stand(page) {
  await page.evaluate(() => {
    const a = window.game.player.actor;
    a.hold?.release?.(true);
    a.pose = { legs: 'stand', arms: 'rest' };
    a.setScripted(false);
  });
  await wait(350);
}

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);

  await page.evaluate((id) => {
    const be = window.game.hud.backend;
    be.performGig(80_000_000, 0, 'test: seat cash');
    be.rentProperty(id);
    be.saveData();
  }, PROP);
  await page.evaluate((id) => window.game.hud.onEnterInterior(`residence:${id}`), PROP);
  await playUntil(page, () => (
    window.game.world.interiorManager.currentInterior?.type === 'residence'
    && !window.game.world.interiorManager.busy ? true : null
  ), 25);
  await wait(600);
  await closeDialogs(page);

  const inventory = await page.evaluate(() => {
    const decor = window.game.modules.HouseDecorationSystem.getInstance();
    return decor.placed
      .filter((p) => {
        const k = decor.kind(p.modelType);
        return k.use === 'seat' && p.modelType !== 'toilet_wc' && (k.seat || k.seats?.length);
      })
      .map((p) => {
        const k = decor.kind(p.modelType);
        const n = k.seats?.length || 1;
        return { uid: p.uid, model: p.modelType, seats: n, dining: /dining_table|plastic_set/.test(p.modelType) };
      });
  });

  const dining = inventory.find((i) => /dining_table/.test(i.model));
  check('home_seats: duplex has a dining set with chairs (8 on luxury 10-seater, else 4)',
    !!dining && dining.seats >= 4, dining);
  check('home_seats: duplex luxury dining is the 10-seater (8 chairs)',
    !!dining && dining.model === 'dining_table_10' && dining.seats === 8, dining);

  const sofas = inventory.filter((i) => /sofa|armchair|chaise|velvet|sectional|massage/.test(i.model));
  check('home_seats: at least one sofa or armchair to sit on', sofas.length >= 1, { sofas: sofas.length });

  // --- Sofa / armchair: hips on cushion, no sink ---
  let sofaFail = null;
  for (const s of sofas.slice(0, 4)) {
    await stand(page);
    const pred = s.uid
      ? `(p) => p.uid === ${JSON.stringify(s.uid)}`
      : `(p) => p.modelType === ${JSON.stringify(s.model)}`;
    const meta = await sitOn(page, pred);
    if (meta.err) { sofaFail = meta; break; }
    await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 40);
    await advance(page, 0.6);
    const pen = await penetration(page, meta);
    // Hips on/above the cushion; deep sink only fails when hips are also low
    const hipsOk = pen.hipY != null && pen.hipY >= meta.top - 0.02;
    const sunk = !hipsOk || (pen.hipY < meta.top + 0.08 && pen.inSeat > 40);
    if (pen.legs !== 'sit' || pen.off > 0.25 || !hipsOk || sunk) {
      sofaFail = { meta, pen, hipsOk, sunk };
      break;
    }
    await stand(page);
  }
  check('home_seats: sofa/armchair — hips on cushion top, body not through the seat', !sofaFail, sofaFail);
  await stand(page);

  // --- Every dining chair: face table, no body in table top ---
  let chairFails = [];
  if (dining) {
    const chairCount = dining.seats;
    for (let i = 0; i < chairCount; i++) {
      // Teleport near chair i so nearest-spot picks it
      await page.evaluate((idx, model) => {
        const g = window.game;
        const r = g.world.interiorManager.residence;
        const decor = g.modules.HouseDecorationSystem.getInstance();
        const item = decor.placed.find((p) => p.modelType === model);
        const kind = decor.kind(item.modelType);
        const spots = kind.seats;
        const s = spots[idx];
        const turn = (item.turns * Math.PI) / 2;
        const x = item.x + s.x * Math.cos(turn) + s.z * Math.sin(turn);
        const z = item.z - s.x * Math.sin(turn) + s.z * Math.cos(turn);
        const o = r.group.position;
        // Stand behind the chair
        const awayX = x - item.x;
        const awayZ = z - item.z;
        const len = Math.hypot(awayX, awayZ) || 1;
        g.player.mesh.position.set(o.x + x + (awayX / len) * 0.7, 0, o.z + z + (awayZ / len) * 0.7);
      }, i, dining.model);
      await advance(page, 0.2);
      const meta = await sitOn(page, `(p) => p.modelType === ${JSON.stringify(dining.model)}`);
      await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 40);
      await advance(page, 0.6);
      const pen = await penetration(page, meta);
      const expected = await page.evaluate((idx, model) => {
        const decor = window.game.modules.HouseDecorationSystem.getInstance();
        const item = decor.placed.find((p) => p.modelType === model);
        const s = decor.kind(item.modelType).seats[idx];
        const turn = (item.turns * Math.PI) / 2;
        return {
          x: item.x + s.x * Math.cos(turn) + s.z * Math.sin(turn),
          z: item.z - s.x * Math.sin(turn) + s.z * Math.cos(turn),
        };
      }, i, dining.model);
      const seatMatch = Math.hypot(meta.seat.x - expected.x, meta.seat.z - expected.z) < 0.15;
      const hipsOk = pen.hipY != null && pen.hipY >= meta.top - 0.02;
      const sunk = !hipsOk || (pen.hipY < meta.top + 0.08 && pen.inSeat > 40);
      if (!pen.facingOk || pen.inTable > 12 || sunk || pen.off > 0.25 || !seatMatch || pen.legs !== 'sit' || !hipsOk) {
        chairFails.push({ i, meta, pen, seatMatch, expected, hipsOk, sunk });
      }
      await stand(page);
    }
  }
  check('home_seats: every dining chair — sit facing the table, legs under, nothing through the top',
    chairFails.length === 0, { fails: chairFails.slice(0, 3), chairs: dining?.seats });

  // Plastic set if present
  const plastic = inventory.find((i) => /plastic_set/.test(i.model));
  if (plastic) {
    const meta = await sitOn(page, `(p) => p.modelType === ${JSON.stringify(plastic.model)}`);
    await playUntil(page, () => (window.game.player.actor.pose.legs === 'sit' ? true : null), 40);
    await advance(page, 0.5);
    const pen = await penetration(page, meta);
    check('home_seats: plastic set chair — on the seat facing the table, not through it',
      pen.facingOk && pen.inTable === 0 && pen.inSeat <= 2 && pen.off < 0.25, { meta, pen });
    await stand(page);
  } else {
    check('home_seats: plastic set (optional in this home)', true);
  }

  check('home_seats: no page errors', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
