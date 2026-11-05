// Yarn: what Lagos is saying. The feed opens busy with the city's regulars; a post typed and
// sent goes to the top as the player's; a like counts once and can be taken back; a share chip
// writes the post for the player; the player can delete their own post.
import { open, newPlayer, closeDialogs, wait } from './lib.mjs';

const tap = async (page, selector) => {
  const at = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, reachable: !!top && (top === el || el.contains(top)) };
  }, selector);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await wait(350);
  return at.reachable;
};
const posts = (page) => page.evaluate(() => [...document.querySelectorAll('#yarn-feed [data-post]')].map((el) => ({ id: el.dataset.post, mine: el.dataset.mine === '1', text: el.querySelector('.yn-text')?.textContent ?? '', like: el.querySelector('.yn-like')?.textContent.trim() ?? '', on: el.querySelector('.yn-like')?.classList.contains('is-on') ?? false })));

export async function run(browser, check) {
  const ctx = await newPlayer(browser);
  const { page, log } = await open(ctx);
  await closeDialogs(page);
  await page.setViewport({ width: 420, height: 860 });
  await wait(500);
  await page.evaluate(() => { const g = window.game; g.hud.phoneModal.open(); g.hud.phoneModal.openApp('yarn'); });
  await wait(900);
  const first = await posts(page);
  check('yarn: the feed opens busy with the city’s regulars', first.length >= 10 && first.every((p) => !p.mine && p.text.length > 5), { count: first.length });

  await page.focus('#yarn-text');
  await page.keyboard.type('Just landed in Lagos. Where the suya dey?');
  await wait(300);
  const sent = await tap(page, '#yarn-post');
  await wait(500);
  const after = await posts(page);
  check('yarn: a post typed and sent goes to the top as the player’s, and the box empties', sent && after[0]?.mine && after[0].text === 'Just landed in Lagos. Where the suya dey?' && (await page.$eval('#yarn-text', (el) => el.value)) === '', { sent, top: after[0] });

  const target = after.find((p) => !p.mine);
  const before = Number(target.like.replace(/[^\d]/g, ''));
  await tap(page, `[data-post="${target.id}"] .yn-like`);
  await wait(300);
  const liked = (await posts(page)).find((p) => p.id === target.id);
  await tap(page, `[data-post="${target.id}"] .yn-like`);
  await wait(300);
  const unliked = (await posts(page)).find((p) => p.id === target.id);
  check('yarn: a like counts once and tapping again takes it back', liked.on && Number(liked.like.replace(/[^\d]/g, '')) === before + 1 && !unliked.on && Number(unliked.like.replace(/[^\d]/g, '')) === before, { before, liked, unliked });

  const shared = await page.evaluate(() => {
    const chip = [...document.querySelectorAll('.yn-quick [data-act="share"]')].find((b) => /rank/i.test(b.textContent));
    chip?.click();
    return !!chip;
  });
  await wait(400);
  const draft = await page.$eval('#yarn-text', (el) => el.value);
  check('yarn: the share chip writes the post for the player (their place on the Rich List)', shared && /#18 on the Naija Rich List/.test(draft), { shared, draft });

  await page.evaluate(() => { const el = document.getElementById('yarn-text'); el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await tap(page, '#yarn-feed [data-mine="1"] .yn-del');
  await wait(400);
  const gone = await posts(page);
  check('yarn: the player can delete their own post', !gone.some((p) => p.mine), { mine: gone.filter((p) => p.mine) });

  check('yarn: no errors in the page', log.errors.length === 0, log.errors.slice(0, 5));
  await ctx.close();
}
