// Runs the browser tests against a running dev server:
//
//   npm run dev            (in one terminal)
//   npm run test:e2e       (all suites)
//   npm run test:e2e money (one suite: input | scroll | view | interiors | places | buka | shop | social | actions | home | quests | money | saves)
import { launch, reporter, GAME_URL } from './lib.mjs';

const SUITES = ['input', 'scroll', 'phone', 'self', 'plan', 'streets', 'ways', 'cities', 'hours', 'landmarks', 'club', 'flights', 'coaches', 'furnish', 'jobs', 'land', 'server', 'view', 'interiors', 'places', 'buka', 'shop', 'social', 'actions', 'home', 'quests', 'money', 'saves', 'driving_weather', 'steering', 'danfo', 'sky', 'graphics', 'vehicles', 'online_api', 'online', 'touch', 'bodies', 'phonelife', 'expressway', 'fleet', 'rides', 'fuel', 'profiles', 'politics', 'insides', 'workplaces', 'companies', 'supermarket', 'towers', 'homedetail', 'liveevents', 'convoys', 'sidestreets'];
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
for (const name of wanted.length ? wanted : SUITES) {
  console.log(`\n--- ${name} ---`);
  const browser = await launch();
  try {
    const suite = await import(`./${name}.mjs`);
    await suite.run(browser, check);
  } catch (e) {
    check(`${name}: ran to completion`, false, String((e && e.stack) || e).slice(0, 600));
  } finally {
    try {
      await browser.close();
    } catch {}
  }
}

process.exit(summary() ? 1 : 0);
