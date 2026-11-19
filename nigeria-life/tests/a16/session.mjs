// The A16 test session (quality roadmap, stage 0): this branch's game and this branch's own game
// server, served from the laptop to the phone over the home Wi-Fi, with a brand-new, throwaway
// database. Nothing here touches the live game, the live server or any player's data.
//
//   npm run a16:session                  build, start both, print the address for the phone
//   npm run a16:session -- --ip 192.168.1.5   if the laptop's Wi-Fi address is not found right
//   npm run a16:session -- --data <dir>       reuse a test database from an earlier session
//
// Stop with Ctrl+C. The test database is left in place (its folder is printed) so it can be looked
// at; delete the folder when done.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLIENT_PORT = 5180;
const SERVER_PORT = 8799;
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

// Never on a hosted server, never pointed at the live one
if (process.env.RENDER || process.env.RENDER_EXTERNAL_URL) {
  console.error('Refusing to run: this looks like the hosted server (RENDER is set). The A16 session is for the laptop only.');
  process.exit(1);
}

/** The laptop's address on the home network: a private IPv4 on a real interface */
function lanAddress() {
  const wanted = arg('--ip');
  if (wanted) return wanted;
  const found = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address) && !/vEthernet|VirtualBox|VMware|WSL|Hyper-V/i.test(name)) found.push(a.address);
    }
  }
  return found[0] ?? null;
}

const ip = lanAddress();
if (!ip) {
  console.error('No home-network address found. Connect the laptop to the same Wi-Fi as the phone, or pass --ip <address>.');
  process.exit(1);
}
const serverUrl = `http://${ip}:${SERVER_PORT}`;
const clientUrl = `http://${ip}:${CLIENT_PORT}`;
if (/onrender\.com|github\.io/i.test(serverUrl)) {
  console.error(`Refusing to run: the server address ${serverUrl} is a hosted one.`);
  process.exit(1);
}

// A fresh test database, outside the project and outside anything the live server uses
const dataDir = arg('--data') ? path.resolve(arg('--data')) : mkdtempSync(path.join(tmpdir(), 'nigerialife-a16-'));
const repoData = path.join(ROOT, 'server', 'data');
if (path.resolve(dataDir) === path.resolve(repoData)) {
  console.error('Refusing to use server/data: the session keeps its own throwaway database.');
  process.exit(1);
}
const clientDir = path.join(dataDir, 'client');

let sha = 'unknown';
try { sha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* not a git checkout */ }
let branch = 'unknown';
try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim(); } catch { /* not a git checkout */ }

console.log(`Branch ${branch} at ${sha}`);
console.log(`Building the game for the phone, talking to ${serverUrl} ...`);
execSync(`npx vite build --outDir "${clientDir}" --emptyOutDir`, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_DEFAULT_SERVER: serverUrl, VITE_BUILD_ID: `a16-${sha}` },
});

const children = [];
const run = (label, command, cmdArgs, env) => {
  const child = spawn(command, cmdArgs, { cwd: ROOT, env: { ...process.env, ...env }, shell: process.platform === 'win32' });
  child.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
  child.on('exit', (code) => { if (!stopping) { console.error(`[${label}] stopped (${code}); stopping the session.`); stop(1); } });
  children.push(child);
  return child;
};
let stopping = false;
const stop = (code = 0) => {
  stopping = true;
  for (const c of children) {
    try {
      if (process.platform === 'win32') execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: 'ignore' });
      else c.kill('SIGTERM');
    } catch { /* already gone */ }
  }
  console.log(`\nSession stopped. The test database is in ${dataDir} (delete it when done).`);
  process.exit(code);
};
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

// This branch's own server, on its own test database. NL_DEV: sign-in links are printed here, not emailed.
run('server', 'node', ['server/game-server.ts'], { PORT: String(SERVER_PORT), NL_DATA: dataDir, NL_BACKUP_DIR: path.join(dataDir, 'backups'), NL_DEV: '1', NL_PUBLIC_URL: clientUrl, NL_GUESTS_PER_HOUR: '1000' });
run('game', 'npx', ['vite', 'preview', '--outDir', clientDir, '--host', '0.0.0.0', '--port', String(CLIENT_PORT), '--strictPort'], {});

const answers = (url) => new Promise((done) => {
  const req = http.get(url, (res) => { res.resume(); done(res.statusCode && res.statusCode < 500); });
  req.on('error', () => done(false));
  req.setTimeout(3000, () => { req.destroy(); done(false); });
});
for (let t = 0; t < 60; t++) {
  if ((await answers(`http://127.0.0.1:${SERVER_PORT}/health`)) && (await answers(`http://127.0.0.1:${CLIENT_PORT}/`))) break;
  await new Promise((r) => setTimeout(r, 1000));
}
const phoneUrl = `${clientUrl}/?perf=1&server=${encodeURIComponent(serverUrl)}`;
console.log(`
======================================================================
 A16 test session is running (branch ${branch} at ${sha})
 Open this on the phone (same Wi-Fi), in Chrome:

   ${phoneUrl}

 Game server (this branch, test database only): ${serverUrl}/health
 Test database folder: ${dataDir}
 Nothing here talks to the live game or the live server.
 Steps and what to record: docs/A16_TEST_SESSION.md
 Stop with Ctrl+C.
======================================================================
`);
