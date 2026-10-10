// Runs the browser tests against a running dev server:
//
//   npm run dev            (in one terminal)
//   npm run test:e2e       (all suites)
//   npm run test:e2e money (one suite: input | view | interiors | places | buka | shop | social | actions | home | quests | money | saves)
import { launch, reporter, GAME_URL } from './lib.mjs';

const SUITES = ['input', 'view', 'interiors', 'places', 'buka', 'shop', 'social', 'actions', 'home', 'quests', 'money', 'saves'];
const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !SUITES.includes(name));
if (unknown.length) {
  console.error(`Unknown suite: ${unknown.join(', ')}. Choose from: ${SUITES.join(', ')}`);
  process.exit(2);
}

try {
  await fetch(GAME_URL);
} catch {
  console.error(`The game is not reachable at ${GAME_URL}. Start it with "npm run dev" (or set GAME_URL).`);
  process.exit(2);
}

const { check, summary } = reporter();
const browser = await launch();

for (const name of wanted.length ? wanted : SUITES) {
  console.log(`\n--- ${name} ---`);
  try {
    const suite = await import(`./${name}.mjs`);
    await suite.run(browser, check);
  } catch (e) {
    check(`${name}: ran to completion`, false, String((e && e.stack) || e).slice(0, 600));
  }
}

await browser.close();
process.exit(summary() ? 1 : 0);
