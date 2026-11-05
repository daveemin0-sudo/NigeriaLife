// Traits: one per character, picked in the Character Studio and confirmed, kept for good and
// through a reload, and doing what each says (needs drain slower, skills grow faster, fares and
// food cost less). A save from before traits loads without one. The server keeps the account's
// trait once and refuses a different one.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { open, newPlayer, closeDialogs, advance, reload, wait } from './lib.mjs';

const PORT = 8806;
const BASE = `http://localhost:${PORT}`;

const data = (page) => page.evaluate(() => window.game.hud.backend.getData());

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx, { w: 390, h: 844 });
  await closeDialogs(page);

  // ------------------------------------------------------------------ A new character has none yet
  check('traits: a new character starts without a trait', (await data(page)).trait === undefined);

  // ------------------------------------------------------------------ Picking one in the studio
  await page.evaluate(() => window.game.hud.creatorModal.open('presets'));
  await wait(300);
  const cards = await page.evaluate(() => [...document.querySelectorAll('.trait-card')].map((c) => c.dataset.trait));
  check('traits: the studio shows 12 traits to choose from', cards.length === 12, cards);
  await page.evaluate(() => document.querySelector('.trait-card[data-trait="iron_belle"]')?.click());
  await wait(200);
  const afterOneTap = await data(page);
  const confirm = await page.evaluate(() => document.getElementById('btn-confirm-trait')?.textContent ?? null);
  check('traits: one tap only selects (nothing is set until it is confirmed)', afterOneTap.trait === undefined && /Iron Belle/.test(confirm ?? ''), { trait: afterOneTap.trait, confirm });
  // Changing their mind before confirming is fine
  await page.evaluate(() => document.querySelector('.trait-card[data-trait="motor_park_connect"]')?.click());
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-confirm-trait')?.click());
  await wait(300);
  check('traits: confirming sets the trait', (await data(page)).trait === 'motor_park_connect');
  await page.evaluate(() => document.querySelector('.trait-card[data-trait="iron_belle"]')?.click());
  await wait(200);
  const locked = await page.evaluate(() => ({ trait: window.game.hud.backend.getData().trait, confirm: !!document.getElementById('btn-confirm-trait'), byCode: window.game.hud.backend.chooseTrait('iron_belle') }));
  check('traits: once picked it cannot be changed, from the studio or from code', locked.trait === 'motor_park_connect' && !locked.confirm && !locked.byCode.applied, locked);
  const fits = await page.evaluate(() => {
    const grid = document.querySelector('.trait-grid');
    return grid ? grid.scrollWidth <= grid.clientWidth + 1 : false;
  });
  check('traits: the trait cards fit a phone screen without sideways scrolling', fits);
  await page.evaluate(() => window.game.hud.creatorModal.close?.());

  // ------------------------------------------------------------------ It does what it says
  const prices = await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.walletCash = 100000;
    b.saveData();
    const before = b.getData().walletCash;
    b.spendCash(1000, 'Danfo Bus Fare', 'TRAVEL_COST');
    const afterFare = b.getData().walletCash;
    b.spendCash(1000, 'Suya', 'FOOD_PURCHASE');
    const afterFood = b.getData().walletCash;
    return { fare: before - afterFare, food: afterFare - afterFood };
  });
  check('traits: Motor Park Connect pays ₦800 for a ₦1,000 fare, and full price for food', prices.fare === 800 && prices.food === 1000, prices);

  const skills = await page.evaluate(() => {
    const b = window.game.hud.backend;
    b.data.skills.driving = 1;
    b.data.skills.cooking = 1;
    b.data.skillCarry = {};
    for (let i = 0; i < 4; i++) {
      b.addSkillExp('driving', 1);
      b.addSkillExp('cooking', 1);
    }
    return { driving: b.data.skills.driving, cooking: b.data.skills.cooking };
  });
  check('traits: four gains of driving count as six with Motor Park Connect; cooking is unchanged', skills.driving === 7 && skills.cooking === 5, skills);

  // Need drain: the same time played with and without a hunger trait
  const drain = await page.evaluate(() => {
    const b = window.game.hud.backend;
    const run = (trait) => {
      b.data.trait = trait;
      b.data.stats.hunger = 100;
      b.vitalsAccumulator = 0;
      b.updateVitals(100, false, false);
      return 100 - b.data.stats.hunger;
    };
    const plain = run(undefined);
    const belle = run('iron_belle');
    const gym = run('gym_bro');
    b.data.trait = 'motor_park_connect';
    b.saveData();
    return { plain, belle, gym };
  });
  check('traits: Iron Belle drains hunger 30% slower, Gym Bro 15% faster', Math.abs(drain.belle / drain.plain - 0.7) < 0.01 && Math.abs(drain.gym / drain.plain - 1.15) < 0.01, drain);

  // ------------------------------------------------------------------ Kept through a reload
  await reload(page);
  check('traits: the trait is still there after a reload', (await data(page)).trait === 'motor_park_connect');

  // ------------------------------------------------------------------ A save from before traits
  const old = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /nigeria_life_account_data_v1$/.test(k));
    const save = JSON.parse(localStorage.getItem(key));
    save.schemaVersion = 2;
    delete save.trait;
    delete save.skillCarry;
    save.trait = 'not_a_real_trait';
    localStorage.setItem(key, JSON.stringify(save));
    return key;
  });
  await reload(page);
  const migrated = await data(page);
  check('traits: a save from before traits (version 2) loads at version 3 with no trait, so the player can pick one', !!old && migrated.schemaVersion === 3 && migrated.trait === undefined, { schemaVersion: migrated.schemaVersion, trait: migrated.trait });
  await advance(page, 1);
  check('traits: no errors in the game', log.errors.filter((e) => !/Failed to load resource|ERR_CONNECTION|favicon/.test(e)).length === 0, log.errors.slice(0, 5));
  await ctx.close();

  // ------------------------------------------------------------------ The server keeps it once
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-traits-'));
  const child = spawn(process.execPath, ['server/game-server.ts'], { env: { ...process.env, PORT: String(PORT), NL_DATA: dataDir, NL_DEV: '1', NL_STATIC: path.join(dataDir, 'none') }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(`${BASE}/health`)).ok) break;
      } catch {}
      await wait(200);
    }
    const call = async (p, body, token) => {
      const r = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, ...(await r.json()) };
    };
    const g = await call('/auth/guest', { name: 'Tolu' });
    const none = await call('/me', null, g.token);
    const bad = await call('/me/trait', { trait: 'billionaire' }, g.token);
    const set = await call('/me/trait', { trait: 'bookworm' }, g.token);
    const same = await call('/me/trait', { trait: 'bookworm' }, g.token);
    const other = await call('/me/trait', { trait: 'gym_bro' }, g.token);
    const me = await call('/me', null, g.token);
    check('traits: the server has no trait for a new account, refuses one that does not exist, and keeps the first one picked', none.trait === null && bad.status === 400 && set.ok && same.ok && me.trait === 'bookworm', { none: none.trait, bad, set, me: me.trait });
    check('traits: the server refuses a different trait later and says which one the account has', other.status === 409 && other.trait === 'bookworm', other);
  } finally {
    child.kill('SIGTERM');
  }
}
