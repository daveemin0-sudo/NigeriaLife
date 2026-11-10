/**
 * A copy of the server's data, once a day, in a second place.
 * `NL_BACKUP_DIR` is that place (another disk). Without it, the copy goes in the data
 * directory's `backups` folder, which is still a second file the game never writes to.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Store } from './store.ts';

function copyToday(db: Store, dataDir: string): void {
  const dir = process.env.NL_BACKUP_DIR || path.join(dataDir, 'backups');
  const day = new Date().toISOString().slice(0, 10);
  const dest = path.join(dir, `nl-${day}.sqlite`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  fs.mkdirSync(dir, { recursive: true });
  const sqlPath = dest.replace(/'/g, "''");
  try {
    db.exec(`VACUUM INTO '${sqlPath}'`);
  } catch (err) {
    console.warn('[backup] a consistent copy failed, copying the file instead', err);
    fs.copyFileSync(path.join(dataDir, 'nigerialife.db'), dest);
  }
  const registry = path.join(dataDir, 'registry.json');
  if (fs.existsSync(registry)) fs.copyFileSync(registry, path.join(dir, `registry-${day}.json`));
  console.log(`[backup] ${dest}`);
}

/** Copies today's data now, and again whenever the day rolls over. */
export function startDailyBackup(db: Store, dataDir: string): void {
  const run = () => {
    try {
      copyToday(db, dataDir);
    } catch (err) {
      console.warn('[backup] not written', err);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
