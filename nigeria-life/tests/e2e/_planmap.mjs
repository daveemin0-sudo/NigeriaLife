// Draws the city plan from above: roads, pavements, plots, what stands on the ground, doors, and any violations circled.
// usage: node _planmap.mjs out.png [minX maxX minZ maxZ] [scale]
import { launch, open, newPlayer } from './lib.mjs';
const [out, a, b, c, d, s] = process.argv.slice(2);
const view = a ? { minX: +a, maxX: +b, minZ: +c, maxZ: +d } : { minX: -60, maxX: 60, minZ: -125, maxZ: 125 };
const scale = +(s || 6);
const browser = await launch();
const ctx = await newPlayer(browser);
const { page } = await open(ctx, { settle: 4000 });
const data = await page.evaluate(() => {
  const w = window.game.world;
  const input = w.planInput();
  const plots = window.game.land ? window.game.land.plots().map((p) => ({ ...p.rect, id: p.id })) : [];
  return { zones: input.zones, things: input.obstructions, doors: input.doors, violations: w.validateCityPlan(), plots };
});
const W = (view.maxX - view.minX) * scale, H = (view.maxZ - view.minZ) * scale;
const X = (x) => (x - view.minX) * scale, Z = (z) => (z - view.minZ) * scale;
const rect = (r, fill, stroke = 'none', extra = '') => `<rect x="${X(r.minX)}" y="${Z(r.minZ)}" width="${(r.maxX - r.minX) * scale}" height="${(r.maxZ - r.minZ) * scale}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="background:#cfd8c0;font:10px sans-serif">`;
for (const z of data.zones) svg += rect(z, z.kind === 'carriageway' ? '#4b5563' : '#d6d3d1');
for (const p of data.plots) svg += rect(p, 'rgba(250,204,21,0.45)', '#a16207', 'stroke-width="2"');
for (const t of data.things) svg += rect(t, t.owner.startsWith('Generated') ? '#a8a29e' : t.structure ? '#1d4ed8' : '#f97316', t.structure ? '#0f172a' : 'none', 'fill-opacity="0.75"');
for (const dd of data.doors) svg += `<circle cx="${X(dd.x)}" cy="${Z(dd.z)}" r="4" fill="#16a34a" stroke="#fff"/>`;
for (const v of data.violations) svg += `<circle cx="${X(v.at.x)}" cy="${Z(v.at.z)}" r="9" fill="none" stroke="#dc2626" stroke-width="3"/>`;
for (let g = Math.ceil(view.minZ / 10) * 10; g < view.maxZ; g += 10) svg += `<text x="2" y="${Z(g) + 3}" fill="#111">z ${g}</text><line x1="0" x2="${W}" y1="${Z(g)}" y2="${Z(g)}" stroke="rgba(0,0,0,0.12)"/>`;
for (let g = Math.ceil(view.minX / 10) * 10; g < view.maxX; g += 10) svg += `<text x="${X(g) + 2}" y="10" fill="#111">x ${g}</text><line y1="0" y2="${H}" x1="${X(g)}" x2="${X(g)}" stroke="rgba(0,0,0,0.12)"/>`;
svg += '</svg>';
const sheet = await ctx.newPage();
await sheet.setViewport({ width: Math.ceil(W), height: Math.ceil(H) });
await sheet.setContent(`<body style="margin:0">${svg}</body>`);
await sheet.screenshot({ path: out });
console.log('violations', data.violations.length, 'wrote', out);
await browser.close();
