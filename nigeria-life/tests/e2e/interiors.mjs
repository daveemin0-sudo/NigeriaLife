// Every interior: each station, NPC and exit door can be reached with the E prompt,
// and the door actually lets the player out.
import { open, wait, newPlayer, playUntil } from './lib.mjs';

const TYPES = ['hospital', 'bank', 'restaurant', 'police', 'residence', 'university', 'airport'];

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);

  for (const type of TYPES) {
    const entered = await page.evaluate((t) => {
      const g = window.game;
      return g.world.interiorManager.enterInterior(t, g.player, g.cameraManager, g.hud, g.world);
    }, type);
    await wait(900);
    if (!entered) { check(`${type}: enter`, false); continue; }

    const objs = await page.evaluate(() => {
      const im = window.game.world.interiorManager;
      const o = im.currentInterior.interiorOrigin;
      return im.getActiveInteractiveObjects().map((x) => ({
        id: x.id,
        offX: +(x.interactionPoint.x - o.x).toFixed(1),
        offZ: +(x.interactionPoint.z - o.z).toFixed(1),
      }));
    });

    const unreachable = [];
    for (const o of objs) {
      const got = await page.evaluate(async (id) => {
        const g = window.game;
        const x = g.world.interiorManager.getActiveInteractiveObjects().find((y) => y.id === id);
        g.hud.hideInteractionCard();
        g.player.stopMoving();
        g.player.mesh.position.set(x.interactionPoint.x, 0, x.interactionPoint.z);
        await window.game.advance(0.1);
        const p = g.player.mesh.position;
        return { target: g.hud.currentInteractionTarget?.id || null, pushedBack: +Math.hypot(p.x - x.interactionPoint.x, p.z - x.interactionPoint.z).toFixed(1) };
      }, o.id);
      if (got.target === o.id) continue;
      // An attendant standing on the same spot as their own station gives E to the station (they stay clickable)
      const yieldsToStation = o.id.startsWith('interior_npc_') && got.target && !got.target.startsWith('interior_npc_')
        && objs.some((s) => s.id === got.target && Math.hypot(s.offX - o.offX, s.offZ - o.offZ) < 0.3);
      if (yieldsToStation) continue;
      unreachable.push({ id: o.id, offsetFromRoom: [o.offX, o.offZ], promptShows: got.target, pushedBack: got.pushedBack });
    }
    check(`${type}: E prompt reaches all ${objs.length} objects`, unreachable.length === 0, unreachable.length ? unreachable : undefined);

    const door = await page.evaluate(async () => {
      const g = window.game;
      const d = g.world.interiorManager.getActiveInteractiveObjects().find((y) => y.id === 'interior_exit_door');
      if (!d) return { hasDoor: false };
      g.hud.hideInteractionCard();
      g.player.mesh.position.set(d.interactionPoint.x, 0, d.interactionPoint.z);
      await window.game.advance(0.1); // a frame of game logic, so the prompt reflects the new position
      return { hasDoor: true, prompt: g.hud.currentInteractionTarget?.id || null };
    });
    await page.keyboard.press('e');
    // The player opens the door and walks out through it, which takes a moment
    const out = !!(await playUntil(page, () => {
      const g = window.game;
      return !g.world.interiorManager.isPlayerInside() && !g.world.interiorManager.busy && !g.player.actor.sequence ? true : null;
    }, 20));
    check(`${type}: E at the exit door leaves the interior`, out, out ? undefined : door);
    if (!out) {
      await page.evaluate(() => { const g = window.game; return g.world.interiorManager.exitCurrentInterior(g.player, g.cameraManager, g.hud, g.world); });
      await wait(900);
    }
  }

  // Interior objects are also in the street list; none may sit where a player on the street can trigger them
  const stray = await page.evaluate(() => {
    const out = [];
    for (const o of window.game.world.interactiveObjects) {
      const interior = o.id === 'interior_exit_door' || /^(interior_npc_|hosp_|bank_|buka_|police_|unilag_|airport_)/.test(o.id);
      if (interior && Math.hypot(o.interactionPoint.x, o.interactionPoint.z) < 150) out.push(o.id);
    }
    return out;
  });
  check('no interior interaction points on the Lagos street', stray.length === 0, stray.length ? stray : undefined);
  check('interiors: no console errors', log.errors.length === 0, log.errors.slice(0, 5));

  await ctx.close();
}
