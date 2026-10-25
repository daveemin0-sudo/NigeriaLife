/**
 * Where the server keeps what must survive a restart: accounts, sign-in sessions, wallets, the
 * ledger of every money movement, employment, shifts, reports and alerts.
 *
 * Node's built-in SQLite, so the server needs no database installed. Nothing outside this file
 * knows it is SQLite: moving to Postgres means rewriting this one module.
 *
 * Money is whole naira in INTEGER columns. The ledger is append-only: a wallet is only ever
 * changed in the same transaction that writes the ledger row explaining it.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,              -- 'guest' | 'email'
  email TEXT UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  banned INTEGER NOT NULL DEFAULT 0,
  muted_until INTEGER NOT NULL DEFAULT 0,
  imported INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  created_ip TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sign_in_links (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT,                 -- the guest asking to keep their progress, if any
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wallets (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  cash INTEGER NOT NULL,
  bank INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL,              -- 'start' | 'import' | 'shift' | 'client' | 'transfer' | 'grant' | ...
  cash_delta INTEGER NOT NULL,
  bank_delta INTEGER NOT NULL,
  cash_after INTEGER NOT NULL,
  bank_after INTEGER NOT NULL,
  verified INTEGER NOT NULL,       -- 1: the server checked why; 0: reported by the game, within limits
  memo TEXT NOT NULL,
  idem TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_idem ON ledger(account_id, idem) WHERE idem IS NOT NULL;
CREATE INDEX IF NOT EXISTS ledger_recent ON ledger(account_id, at);
CREATE TABLE IF NOT EXISTS jobs (
  account_id TEXT NOT NULL,
  employer TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  since INTEGER NOT NULL,
  PRIMARY KEY (account_id, employer)
);
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  employer TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  reporter TEXT NOT NULL,
  reported TEXT NOT NULL,
  reason TEXT NOT NULL,
  context TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks (
  account_id TEXT NOT NULL,
  blocked TEXT NOT NULL,
  PRIMARY KEY (account_id, blocked)
);
CREATE TABLE IF NOT EXISTS business_clock (
  account_id TEXT PRIMARY KEY,
  credit INTEGER NOT NULL,         -- what the player's businesses may still have taken, unpaid
  at INTEGER NOT NULL              -- when that was last worked out
);
CREATE TABLE IF NOT EXISTS held (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  memo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'   -- 'waiting' | 'released' | 'refused'
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  account_id TEXT,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL
);
`;

export type Store = DatabaseSync;

export function openStore(dataDir: string): Store {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'nigerialife.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;');
  db.exec(SCHEMA);
  // Columns added after the first release of the schema
  const columns = (db.prepare('PRAGMA table_info(accounts)').all() as Array<{ name: string }>).map((c) => c.name);
  if (!columns.includes('registry_id')) db.exec('ALTER TABLE accounts ADD COLUMN registry_id TEXT');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS accounts_registry ON accounts(registry_id) WHERE registry_id IS NOT NULL');
  return db;
}

/** Runs `work` as one transaction: all of it is kept, or none of it. */
export function transaction<T>(db: Store, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function alert(db: Store, accountId: string | null, kind: string, detail: string): void {
  db.prepare('INSERT INTO alerts (at, account_id, kind, detail) VALUES (?, ?, ?, ?)').run(Date.now(), accountId, kind, detail);
  console.warn(`[alert] ${kind} ${accountId ?? '-'}: ${detail}`);
}
