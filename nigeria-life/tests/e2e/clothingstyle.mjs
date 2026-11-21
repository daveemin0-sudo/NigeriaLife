// Clothing customisation (Stage 3): colours, cloth, patterns and prints, thread, condition, and saved outfits.
//
// 1. Every garment model (15) and footwear style (4) on both bodies takes a colour, a cloth it can be made in
//    and a pattern, through the same garment models (no new geometry): checked on the materials the model wears,
//    and drawn standing, walking, running and sitting with no shader errors.
// 2. The player's studio (the Style & outfits tab): picking a pattern, a colour, a cloth, a logo and a condition
//    changes what the player wears at once.
// 3. Saved outfits: save, rename, change clothes, wear the outfit again (its colours come back), and all of it
//    still there after the page is loaded again (the save); delete.
// 4. Repeated customisation: hundreds of style changes add no shader programs, and textures and materials stay
//    bounded (prints and materials are cached and the oldest let go).
// SHOTS=<dir> saves pictures of each look for the review page.
import fs from 'node:fs';
import path from 'node:path';
import { newPlayer, open, closeDialogs, wait, reload } from './lib.mjs';

const SHOTS = process.env.SHOTS || '';
async function saveShot(name, dataUrl) {
  if (!SHOTS || !dataUrl) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}.jpg`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}

// The garments: [slot kind, variant, the street style that wears it]
const GARMENTS = [
  ['top', 'tee', 'tshirt'], ['top', 'tee_oversized', 'tee_oversized'], ['top', 'polo', 'polo_shirt'], ['top', 'shirt', 'button_shirt'], ['top', 'hoodie', 'hoodie'],
  ['bottom', 'jeans_slim', 'jeans_slim'], ['bottom', 'jeans_straight', 'jeans'], ['bottom', 'jeans_baggy', 'jeans_baggy'], ['bottom', 'cargo', 'cargo_pants'], ['bottom', 'chinos', 'chinos'],
  ['bottom', 'shorts', 'shorts'], ['bottom', 'cargo_shorts', 'cargo_shorts'],
  ['hat', 'cap', 'cap'], ['hat', 'bucket', 'bucket_hat'], ['hat', 'beanie', 'beanie'],
];
const FOOTWEAR = [['sneaker', 'sneakers'], ['formal', 'oxfords'], ['boot', 'boots'], ['slides', 'sandals']];

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page } = await open(ctx, { w: 1366, h: 768 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && /shader|program|WebGL|GL_/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await closeDialogs(page);
  await page.evaluate(() => { window.game.world.skyEnvironment.setHour(12); });

  // ------------------------------------------------------------------ 1. Every garment, both bodies
  const fit = await page.evaluate(async (GARMENTS, FOOTWEAR) => {
    const g = window.game;
    const api = g.modules.SkinnedCharacterApi;
    const { LookPreview } = api;
    const out = { rows: [], shots: {} };
    for (const gender of ['male', 'female']) {
      const handle = await api.loadSkinnedCharacter(gender, { gender });
      g.scene.add(handle.root);
      handle.root.position.copy(g.player.position).add(new g.modules.THREE.Vector3(2, 0, 0));
      const worn = (root, kind) => {
        const mats = [];
        root.traverse((o) => {
          const m = /^Outfit_(Top_Short|Top_Long|Bottom_Long|Bottom_Short|Shoes|Hat|Feet)__([a-z_]+)$/.exec(o.name);
          if (!m || !o.visible) return;
          o.traverse((c) => { if (c.isMesh && c.visible) for (const mat of [].concat(c.material)) mats.push({ variant: m[2], mat }); });
        });
        return mats.filter((x) => kind === 'any' || x.variant === kind);
      };
      const all = [...GARMENTS.map(([slot, variant, style]) => ({ slot, variant, style })), ...FOOTWEAR.map(([variant, style]) => ({ slot: 'shoes', variant, style }))];
      for (const { slot, variant, style } of all) {
        // The second cloth the garment can be made in (or its only one), a pattern it can take, a colour
        const fabricsFor = { tee: ['jersey', 'cotton'], tee_oversized: ['jersey', 'cotton'], polo: ['pique', 'jersey'], shirt: ['oxford', 'cotton'], hoodie: ['fleece', 'jersey'], jeans_slim: ['denim', 'twill'], jeans_straight: ['denim', 'twill'], jeans_baggy: ['denim', 'canvas'], cargo: ['twill', 'canvas'], chinos: ['twill', 'cotton'], shorts: ['twill', 'denim'], cargo_shorts: ['twill', 'canvas'], cap: ['twill', 'canvas'], bucket: ['twill', 'denim'], beanie: ['rib', 'fleece'], sneaker: ['canvas', 'leather'], formal: ['leather'], boot: ['leather', 'canvas'], slides: ['rubber', 'leather'] };
        const fabric = fabricsFor[variant][1] ?? fabricsFor[variant][0];
        const plainOnly = fabric === 'leather' || fabric === 'rubber';
        const pattern = plainOnly ? undefined : slot === 'top' ? { kind: 'stripes', colour2: '#111827', colour3: '#facc15' } : slot === 'bottom' ? { kind: 'check', colour2: '#1e3a8a' } : { kind: 'camo', colour2: '#4d5b3a', colour3: '#2f3424' };
        const look = {
          gender,
          outfit: slot === 'top' ? style : 'tshirt',
          bottom: slot === 'bottom' ? style : 'jeans',
          hat: slot === 'hat' ? style : '',
          shoes: slot === 'shoes' ? style : 'sneakers',
          styles: { [slot]: { colour: '#b91c1c', fabric, pattern, stitch: '#facc15', condition: 'worn' } },
        };
        api.applyStreetLook(handle.root, look);
        const mats = worn(handle.root, variant);
        const bodyMats = mats.filter((x) => (x.mat.name.split(':')[0] !== 'Sole') && api.fabricUniforms(x.mat));
        const body = bodyMats.find((x) => x.mat.userData.fabric === fabric);
        const u = body ? api.fabricUniforms(body.mat) : null;
        const red = body ? body.mat.color.getHexString() : '';
        const ok = !!body && red === 'b91c1c' && (plainOnly ? u.uPat.value === 0 : u.uPat.value > 0) && Math.abs(u.uStitch.value.x - 0.96) < 0.06;
        // Drawn in each motion, no errors
        for (const clip of ['idle', 'walk', 'run', 'sit']) {
          handle.play(clip, 0);
          handle.update(0.3);
          g.renderer.render(g.scene, g.cameraManager.camera);
        }
        out.rows.push({ gender, slot, variant, fabric, pattern: pattern?.kind ?? 'plain', parts: mats.length, ok });
      }
      g.scene.remove(handle.root);
      handle.dispose();
    }
    return out;
  }, GARMENTS, FOOTWEAR);
  const bad = fit.rows.filter((r) => !r.ok);
  console.log('GARMENTS', JSON.stringify(fit.rows.map((r) => `${r.gender[0]}:${r.variant}:${r.fabric}:${r.pattern}:${r.ok ? 'ok' : 'BAD'}`)));
  check('all 15 garments and 4 footwear styles take a colour, cloth, pattern and thread on both bodies (same models)', fit.rows.length === 38 && bad.length === 0, bad);
  check('styled garments drawn standing, walking, running and sitting with no shader errors', errors.length === 0, errors);

  // Pictures of each garment styled (for the review page)
  if (SHOTS) {
    const looks = [
      ['male_tee_stripes', 'male', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', styles: { top: { colour: '#f8fafc', pattern: { kind: 'stripes', colour2: '#1e3a8a', colour3: '#b91c1c' } } } }, 'top'],
      ['female_tee_stripes', 'female', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', styles: { top: { colour: '#f8fafc', pattern: { kind: 'stripes', colour2: '#1e3a8a', colour3: '#b91c1c' } } } }, 'top'],
      ['male_shirt_check', 'male', { outfit: 'button_shirt', bottom: 'chinos', shoes: 'oxfords', styles: { top: { colour: '#f8fafc', pattern: { kind: 'check', colour2: '#1d4ed8', colour3: '#f8fafc', scale: 0.8 } } } }, 'top'],
      ['female_shirt_pinstripe', 'female', { outfit: 'button_shirt', bottom: 'chinos', shoes: 'oxfords', styles: { top: { colour: '#e2e8f0', pattern: { kind: 'pinstripe', colour2: '#1e3a8a', angle: 90 } } } }, 'top'],
      ['male_hoodie_camo', 'male', { outfit: 'hoodie', bottom: 'cargo_pants', shoes: 'boots', styles: { top: { colour: '#6b7a4f', pattern: { kind: 'camo', colour2: '#4d5b3a', colour3: '#2f3424' } }, bottom: { colour: '#57534e', fabric: 'canvas' } } }, 'full'],
      ['female_polo_ankara', 'female', { outfit: 'polo_shirt', bottom: 'jeans_slim', shoes: 'sneakers', styles: { top: { colour: '#ea580c', pattern: { kind: 'ankara', colour2: '#0e7490', colour3: '#facc15' } } } }, 'top'],
      ['male_tee_graphic', 'male', { outfit: 'tee_oversized', bottom: 'jeans_baggy', shoes: 'sneakers', styles: { top: { colour: '#111827', pattern: { kind: 'graphic', design: 'eko_sun', colour2: '#f8fafc', colour3: '#f59e0b' } } } }, 'top'],
      ['female_tee_logo', 'female', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', styles: { top: { colour: '#f8fafc', pattern: { kind: 'logo', text: 'ADA', shape: 'circle', colour2: '#f8fafc', colour3: '#008751' } } } }, 'top'],
      ['male_tee_graphic_lagos', 'male', { outfit: 'tshirt', bottom: 'shorts', shoes: 'sandals', styles: { top: { colour: '#facc15', pattern: { kind: 'graphic', design: 'lagos_234', colour2: '#111827', colour3: '#008751' } } } }, 'top'],
      ['female_jeans_fabrics', 'female', { outfit: 'tshirt', bottom: 'jeans_straight', shoes: 'boots', styles: { bottom: { colour: '#7c2d12', fabric: 'twill' } } }, 'bottom'],
      ['male_cargo_dirty', 'male', { outfit: 'tshirt', bottom: 'cargo_pants', shoes: 'boots', styles: { bottom: { colour: '#a8a29e', condition: 'dirty' }, shoes: { condition: 'dirty' } } }, 'bottom'],
      ['male_jeans_damaged', 'male', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', styles: { bottom: { condition: 'damaged' } } }, 'bottom'],
      ['male_jeans_clean', 'male', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', styles: { bottom: { condition: 'clean' } } }, 'bottom'],
      ['female_shorts_check', 'female', { outfit: 'tshirt', bottom: 'shorts', shoes: 'sandals', styles: { bottom: { colour: '#f8fafc', pattern: { kind: 'check', colour2: '#db2777' } } } }, 'bottom'],
      ['male_sneaker_canvas_camo', 'male', { outfit: 'tshirt', bottom: 'jeans_slim', shoes: 'sneakers', styles: { shoes: { colour: '#6b7a4f', pattern: { kind: 'camo', colour2: '#4d5b3a', colour3: '#2f3424' } } } }, 'shoes'],
      ['female_sneaker_leather', 'female', { outfit: 'tshirt', bottom: 'jeans_slim', shoes: 'sneakers', styles: { shoes: { colour: '#f8fafc', fabric: 'leather', stitch: '#b91c1c' } } }, 'shoes'],
      ['male_boot_canvas', 'male', { outfit: 'tshirt', bottom: 'jeans_slim', shoes: 'boots', styles: { shoes: { colour: '#a16207', fabric: 'canvas' } } }, 'shoes'],
      ['male_formal', 'male', { outfit: 'button_shirt', bottom: 'chinos', shoes: 'oxfords', styles: { shoes: { colour: '#3f1d0b' } } }, 'shoes'],
      ['male_cap_denim', 'male', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', hat: 'cap', hatColor: 0x111827, styles: { hat: { colour: '#2b4a7e', fabric: 'denim' } } }, 'hat'],
      ['female_bucket_ankara', 'female', { outfit: 'tshirt', bottom: 'jeans', shoes: 'sneakers', hat: 'bucket_hat', styles: { hat: { colour: '#db2777', pattern: { kind: 'ankara', colour2: '#facc15', colour3: '#0e7490' } } } }, 'hat'],
      ['male_beanie_stripes', 'male', { outfit: 'hoodie', bottom: 'jeans', shoes: 'sneakers', hat: 'beanie', styles: { hat: { colour: '#b91c1c', pattern: { kind: 'stripes', colour2: '#f8fafc' } } } }, 'hat'],
    ];
    for (const [name, gender, look, focus] of looks) {
      for (const [yaw, suffix] of [[-0.35, ''], [Math.PI - 0.35, '_back']]) {
        if (suffix && !['male_tee_stripes', 'male_hoodie_camo', 'female_polo_ankara', 'male_jeans_damaged'].includes(name)) continue;
        const url = await page.evaluate(async (gender, look, focus, yaw) => {
          const api = window.game.modules.SkinnedCharacterApi;
          return api.LookPreview.shootClothes({ gender }, yaw, focus, (root) => api.applyStreetLook(root, { gender, ...look }));
        }, gender, look, focus, yaw);
        await saveShot(name + suffix, url);
      }
    }
    // Motion: the same styled outfit standing, walking, running and sitting
    for (const clip of ['idle', 'walk', 'run', 'sit']) {
      for (const gender of ['male', 'female']) {
        const url = await page.evaluate(async (gender, clip) => {
          const api = window.game.modules.SkinnedCharacterApi;
          return api.LookPreview.shootClothes({ gender }, -0.5, 'full', (root) => api.applyStreetLook(root, { gender, outfit: 'hoodie', bottom: 'cargo_pants', shoes: 'boots', styles: { top: { colour: '#6b7a4f', pattern: { kind: 'camo', colour2: '#4d5b3a', colour3: '#2f3424' } }, bottom: { colour: '#d6c7a1', pattern: { kind: 'check', colour2: '#78350f', scale: 1.4 } } } }), clip);
        }, gender, clip);
        await saveShot(`motion_${gender}_${clip}`, url);
      }
    }
  }

  // ------------------------------------------------------------------ 2. The player's studio
  const opened = await page.evaluate(async () => {
    const g = window.game;
    g.hud.creatorModal.open('style');
    await new Promise((r) => setTimeout(r, 300));
    return { studio: !!document.querySelector('#clothing-studio-host .cs-studio'), slots: [...document.querySelectorAll('.cs-slot')].map((b) => b.dataset.slot) };
  });
  await page.waitForFunction(() => (document.querySelector('#cs-shot')?.getAttribute('src') ?? '').startsWith('data:image'), { timeout: 15000 }).catch(() => {});
  const shotShown = await page.evaluate(() => (document.querySelector('#cs-shot')?.getAttribute('src') ?? '').startsWith('data:image'));
  check('the Style & outfits tab opens with the slots worn and a picture of the real model', opened.studio && opened.slots.includes('top') && opened.slots.includes('shoes') && shotShown, { opened, shotShown });

  const playerTop = () => page.evaluate(() => {
    const g = window.game;
    const api = g.modules.SkinnedCharacterApi;
    let found = null;
    g.player.mesh.traverse((o) => {
      if (found || !o.visible || !/^Outfit_Top_(Short|Long)__/.test(o.name)) return;
      o.traverse((c) => {
        if (found || !c.isMesh) return;
        for (const m of [].concat(c.material)) {
          const u = api.fabricUniforms(m);
          if (u && m.name.startsWith('Cloth_Top') && m.userData.fabric !== 'rib') { found = { fabric: m.userData.fabric, colour: m.color.getHexString(), pat: u.uPat.value, print: u.uPrint.value?.isCanvasTexture ?? false, dirt: u.uDirt.value }; return; }
        }
      });
    });
    return found;
  });
  const click = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await wait(250); };
  await click('.cs-slot[data-slot="top"]');
  await click('.cs-pattern[data-pattern="stripes"]');
  const striped = await playerTop();
  await click('.cs-region[data-region="main"]');
  await click('.cs-pal[data-pal="naija"]');
  await click('.cs-swatch[data-colour="#db2777"]');
  const coloured = await playerTop();
  const fabricBtn = await page.evaluate(() => [...document.querySelectorAll('.cs-fabric')].map((b) => b.dataset.fabric));
  await click(`.cs-fabric[data-fabric="${fabricBtn[1]}"]`);
  const refabric = await playerTop();
  await click('.cs-cond[data-cond="dirty"]');
  const dirty = await playerTop();
  await click('.cs-pattern[data-pattern="logo"]');
  await page.evaluate(() => { const i = document.querySelector('#cs-logo'); i.value = 'EKO 1'; i.dispatchEvent(new Event('input')); });
  await wait(900);
  const logo = await playerTop();
  const logoText = await page.evaluate(() => window.game.player.config.clothingStyles?.top?.pattern?.text);
  check('studio: pattern, colour, cloth, condition and logo each change what the player wears at once',
    striped?.pat === 1 && coloured?.colour === 'db2777' && refabric?.fabric === fabricBtn[1] && dirty?.dirt > 0.5 && logo?.pat === 7 && logo?.print && logoText === 'EKO 1',
    { striped, coloured, fabricBtn, refabric, dirty, logo, logoText });
  if (SHOTS) {
    await wait(600);
    const dialog = await page.$('.creator-dialog');
    if (dialog) await dialog.screenshot({ path: path.join(SHOTS, 'studio_panel.png') });
  }

  // ------------------------------------------------------------------ 3. Saved outfits
  await page.evaluate(() => { const i = document.querySelector('#cs-outfit-name'); i.value = 'Friday Logo'; });
  await click('#cs-outfit-save');
  const afterSave = await page.evaluate(() => window.game.player.config.outfits?.map((o) => o.name));
  // Change clothes, then wear the outfit again
  await click('.cs-pattern[data-pattern="plain"]');
  await click('.cs-swatch[data-colour="#008751"]');
  const changed = await playerTop();
  await click('.cs-outfit [data-act="wear"]');
  const restored = await playerTop();
  // Rename
  await click('.cs-outfit [data-act="rename"]');
  await page.evaluate(() => { const i = document.querySelector('.cs-rename'); i.value = 'Logo Friday'; });
  await click('.cs-outfit [data-act="rename"]');
  const renamed = await page.evaluate(() => window.game.player.config.outfits?.map((o) => o.name));
  // A second outfit, plain
  await click('.cs-pattern[data-pattern="plain"]');
  await page.evaluate(() => { const i = document.querySelector('#cs-outfit-name'); i.value = 'Plain Pink'; });
  await click('#cs-outfit-save');
  if (SHOTS) {
    const dialog = await page.$('.creator-dialog');
    await page.evaluate(() => document.querySelector('.cs-outfits')?.scrollIntoView());
    await wait(500);
    if (dialog) await dialog.screenshot({ path: path.join(SHOTS, 'studio_outfits.png') });
  }
  check('outfits: save, change clothes, wear it again (its look comes back), rename',
    afterSave?.[0] === 'Friday Logo' && changed?.pat === 0 && restored?.pat === 7 && restored?.colour === logo?.colour && renamed?.[0] === 'Logo Friday',
    { afterSave, changed, restored, renamed });

  // Wear the logo outfit, load the page again (the save), and check everything came back
  await click('.cs-outfit [data-act="wear"]');
  await page.evaluate(() => window.game.modules.CloudSyncService.getInstance().saveNow?.());
  await reload(page, 4000);
  await closeDialogs(page);
  await page.waitForFunction(() => window.game?.player?.mesh && (() => { let n = 0; window.game.player.mesh.traverse((o) => { if (/^Outfit_Top/.test(o.name) && o.visible) n++; }); return n > 0; })(), { timeout: 30000 }).catch(() => {});
  await wait(1500);
  const back = await page.evaluate(() => ({ outfits: window.game.player.config.outfits?.map((o) => o.name), pattern: window.game.player.config.clothingStyles?.top?.pattern?.kind }));
  const backTop = await playerTop();
  check('outfits and the worn style are still there after loading again, and the model wears them',
    back.outfits?.join() === 'Logo Friday,Plain Pink' && back.pattern === 'logo' && backTop?.pat === 7 && backTop?.print, { back, backTop });
  // Delete one
  await page.evaluate(async () => { window.game.hud.creatorModal.open('style'); await new Promise((r) => setTimeout(r, 300)); });
  await click('.cs-outfit[data-id] [data-act="delete"]');
  await click('.cs-outfit[data-id] [data-act="delete"]');
  const left = await page.evaluate(() => window.game.player.config.outfits?.map((o) => o.name));
  await reload(page, 4000);
  const leftAfter = await page.evaluate(() => window.game.player.config.outfits?.map((o) => o.name));
  check('delete: an outfit deleted is gone, also after loading again', left?.join() === 'Plain Pink' && leftAfter?.join() === 'Plain Pink', { left, leftAfter });
  await closeDialogs(page);

  // ------------------------------------------------------------------ 4. Repeated customisation
  const churn = await page.evaluate(async () => {
    const g = window.game;
    const api = g.modules.SkinnedCharacterApi;
    const handles = [];
    for (const gender of ['male', 'female', 'male', 'female']) {
      const h = await api.loadSkinnedCharacter(gender, { gender });
      h.root.position.copy(g.player.position).add(new g.modules.THREE.Vector3(handles.length - 1.5, 0, 3));
      g.scene.add(h.root);
      handles.push(h);
    }
    const kinds = ['plain', 'stripes', 'pinstripe', 'check', 'camo', 'ankara', 'graphic', 'logo'];
    const colours = ['#f8fafc', '#111827', '#b91c1c', '#16a34a', '#1e3a8a', '#facc15', '#db2777'];
    const tops = ['tshirt', 'polo_shirt', 'button_shirt', 'hoodie', 'tee_oversized'];
    const designs = ['eko_sun', 'lagos_234', 'palm', 'danfo', 'adire', 'bridge'];
    const render = () => g.renderer.render(g.scene, g.cameraManager.camera);
    const lookAt = (k, i) => ({
      gender: i % 2 ? 'female' : 'male', outfit: tops[(k + i) % tops.length], bottom: 'jeans', shoes: 'sneakers',
      styles: { top: { colour: colours[k % colours.length], pattern: { kind: kinds[k % kinds.length], colour2: colours[(k + 3) % colours.length], design: designs[k % designs.length], text: `NL${k % 30}` } }, bottom: { colour: colours[(k + 1) % colours.length], condition: ['clean', 'worn', 'dirty', 'damaged'][k % 4] } },
    });
    // Warm: every pattern and top seen once
    for (let k = 0; k < 40; k++) { handles.forEach((h, i) => api.applyStreetLook(h.root, lookAt(k, i))); render(); }
    const info = g.renderer.info;
    const before = { programs: info.programs?.length ?? 0, textures: info.memory.textures, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 };
    let total = 0, worst = 0, n = 0;
    for (let k = 40; k < 240; k++) {
      for (let i = 0; i < handles.length; i++) {
        const s = performance.now();
        api.applyStreetLook(handles[i].root, lookAt(k, i));
        const t = performance.now() - s;
        total += t; worst = Math.max(worst, t); n++;
      }
      render();
    }
    const after = { programs: info.programs?.length ?? 0, textures: info.memory.textures, heap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0 };
    const res = { changes: n, msPerChange: +(total / n).toFixed(2), worstMs: +worst.toFixed(1), before, after, programsAdded: after.programs - before.programs, texturesAdded: after.textures - before.textures, materialsKept: api.garmentMaterialsKept(), printsHeld: api.printsHeld() };
    handles.forEach((h) => { g.scene.remove(h.root); h.dispose(); });
    return res;
  });
  console.log('CHURN', JSON.stringify(churn));
  check('800 style changes: no new shader programs, textures bounded (prints kept to 12), materials bounded, cheap',
    churn.programsAdded === 0 && churn.texturesAdded <= 12 && churn.printsHeld <= 12 && churn.materialsKept <= 600 && churn.msPerChange < 4, churn);
  await ctx.close();
}
