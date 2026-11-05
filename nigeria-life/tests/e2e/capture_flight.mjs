// Screenshots of a flight at each stage, in each view (scratch, not a suite)
import { launch, open, newPlayer, closeDialogs, advance, wait } from './lib.mjs';
const out = process.argv[2];
const only = process.argv.slice(3);
const browser = await launch();
const ctx = await newPlayer(browser);
const { page, log } = await open(ctx);
await closeDialogs(page);
await page.evaluate(() => {
  const g = window.game;
  g.world.skyEnvironment.setHour(13);
  g.world.setStreetModeVisibility(false);
  g.player.mesh.visible = false;
  const details = { flightCode: 'NL 204', airlineName: 'NigeriaLife Air', travelClass: 'Economy · seat 14A', tailNumber: '5N-NLA', originId: 'lagos', destinationId: 'abuja', originCode: 'LOS', destinationCode: 'ABV', originName: 'Murtala Muhammed International Airport (LOS)', destinationName: 'Nnamdi Azikiwe International Airport (ABV)', durationSeconds: 120 };
  g.flightExperience.startFlight(details);
  g.transitHUD.showFlightHUD(details);
});
const shots = [
  ['gate', 3, 'outside'], ['gate-seat', 4, 'seat'], ['gate-cabin', 5, 'cabin'],
  ['push', 13, 'outside'], ['demo', 22, 'cabin'], ['taxi', 26, 'outside'],
  ['roll', 33, 'outside'], ['rotate', 37.6, 'outside'], ['climb', 42, 'outside'], ['clouds', 46, 'seat'],
  ['cruise', 58, 'outside'], ['cruise-seat', 62, 'seat'], ['trolley', 70, 'cabin'], ['served', 76, 'seat'],
  ['descent', 90, 'outside'], ['descent-seat', 96, 'seat'], ['final', 104, 'outside'], ['flare', 108.4, 'outside'],
  ['rollout', 110.5, 'outside'], ['rollout-seat', 112, 'seat'], ['taxiin', 116, 'outside'],
];
for (const [name, at, view] of shots) {
  await page.evaluate((v) => { const g = window.game; g.flightExperience.setCameraView(v); }, view);
  const now = await page.evaluate(() => window.game.flightExperience.progress().elapsed);
  if (at > now) await advance(page, at - now);
  await wait(200);
  const p = await page.evaluate(() => window.game.flightExperience.progress());
  if (!only.length || only.includes(name)) await page.screenshot({ path: `${out}/fl-${name}.png` });
  console.log(name, p.stage, p.elapsed.toFixed(1));
}
console.log('errors', JSON.stringify(log.errors.slice(0, 5)));
await browser.close();
