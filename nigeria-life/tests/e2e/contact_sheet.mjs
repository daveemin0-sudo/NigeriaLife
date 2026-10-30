// Lays pictures side by side in one image: node contact_sheet.mjs out.png cols width a.png b.png ...
import { launch } from './lib.mjs';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const [outFile, cols, width, ...files] = process.argv.slice(2);
const w = Number(width);
const html = `<html><body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px;width:max-content">${files
  .map((f) => `<figure style="margin:0"><img src="${pathToFileURL(f).href}" style="width:${w}px;display:block"><figcaption style="font:12px sans-serif;color:#fff">${f.split(/[\/]/).pop()}</figcaption></figure>`)
  .join('')}</body></html>`;
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 300 });
writeFileSync(`${outFile}.html`, html);
await page.goto(pathToFileURL(`${outFile}.html`).href, { waitUntil: 'load' });
const box = await page.evaluate(() => ({ w: document.body.scrollWidth, h: document.body.scrollHeight }));
await page.setViewport({ width: box.w, height: box.h });
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
