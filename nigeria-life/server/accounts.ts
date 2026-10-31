/**
 * Who is playing. Anyone can start as a guest at once (no form, no download). A guest can keep
 * their progress for good by adding an email address: the server sends a sign-in link, and
 * opening it marks the same account verified. Only verified accounts are counted as players
 * in public numbers, and only they will vote in elections.
 *
 * Session tokens are random and only their SHA-256 is stored, so a copy of the database does
 * not let anyone sign in. Sign-ups and sign-in links are rate-limited by address.
 *
 * Email is sent through `Mailer`. Until a sending service is chosen (see docs/ROADMAP.md) the
 * development mailer prints the link in the server's log, and with NL_DEV=1 also returns it to
 * the game so tests can follow it. Phone OTP and Google sign-in need outside accounts: not built.
 */
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { alert, transaction, type Store } from './store.ts';

export interface Account {
  id: string;
  name: string;
  kind: 'guest' | 'email' | 'password';
  email: string | null;
  verified: boolean;
  banned: boolean;
  mutedUntil: number;
}

export interface Mailer {
  send(to: string, subject: string, body: string): void;
}

export const consoleMailer: Mailer = {
  send(to, subject, body) {
    console.log(`[mail to ${to}] ${subject}\n${body}`);
  },
};

/** What a new account starts with: the same as a new game in the browser. */
export const STARTING_CASH = 25_000;
export const STARTING_BANK = 150_000;

const LINK_MINUTES = 15;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

/** At most `limit` events per `windowMs` for each key. */
export class RateLimit {
  private seen = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;
  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }
  allow(key: string): boolean {
    const now = Date.now();
    const recent = (this.seen.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.seen.set(key, recent);
      return false;
    }
    recent.push(now);
    this.seen.set(key, recent);
    return true;
  }
}

/** A name shown to other players: letters, digits, spaces and a little punctuation, 2 to 20 long. */
export function cleanName(raw: unknown): string | null {
  const name = String(raw ?? '').replace(/[^\p{L}\p{N} ._'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return name.length >= 2 ? name : null;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** A username: what a player signs in with and is called by, 3 to 16 letters, digits, _ or . */
export function cleanUsername(raw: unknown): string | null {
  const name = String(raw ?? '').trim().replace(/^@/, '');
  return /^[A-Za-z0-9_.]{3,16}$/.test(name) ? name : null;
}

/** A password kept only as a salted scrypt hash */
function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function passwordMatches(password: string, stored: string | null): boolean {
  const [scheme, saltHex, keyHex] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const want = Buffer.from(keyHex, 'hex');
  const got = scryptSync(password, Buffer.from(saltHex, 'hex'), want.length);
  return got.length === want.length && timingSafeEqual(got, want);
}

export class Accounts {
  private guestsByAddress: RateLimit;
  private linksByAddress = new RateLimit(5, 60 * 60_000);
  private linksByEmail = new RateLimit(3, 60 * 60_000);
  private signInsByAddress = new RateLimit(20, 15 * 60_000);
  private signUpsByAddress = new RateLimit(10, 60 * 60_000);

  private db: Store;
  private mailer: Mailer;
  private publicUrl: string;
  private dev: boolean;

  constructor(db: Store, mailer: Mailer, publicUrl: string, dev: boolean, guestsPerHour = 10) {
    this.db = db;
    this.mailer = mailer;
    this.publicUrl = publicUrl;
    this.dev = dev;
    this.guestsByAddress = new RateLimit(guestsPerHour, 60 * 60_000);
  }

  private row(id: string): Account | null {
    const r = this.db.prepare('SELECT id, name, kind, email, verified, banned, muted_until FROM accounts WHERE id = ?').get(id) as
      | { id: string; name: string; kind: 'guest' | 'email' | 'password'; email: string | null; verified: number; banned: number; muted_until: number }
      | undefined;
    return r ? { id: r.id, name: r.name, kind: r.kind, email: r.email, verified: !!r.verified, banned: !!r.banned, mutedUntil: r.muted_until } : null;
  }

  public get(id: string): Account | null {
    return this.row(id);
  }

  private openSession(accountId: string): string {
    const token = newToken();
    const now = Date.now();
    this.db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, last_seen) VALUES (?, ?, ?, ?)').run(hash(token), accountId, now, now);
    return token;
  }

  /** A new guest, playing at once. */
  public createGuest(rawName: unknown, address: string): { ok: true; token: string; account: Account } | { ok: false; reason: string } {
    const name = cleanName(rawName) ?? 'Guest';
    if (!this.guestsByAddress.allow(address)) {
      alert(this.db, null, 'signup-rate', `guest sign-ups from ${address}`);
      return { ok: false, reason: 'Too many new players from this connection. Try again in an hour.' };
    }
    const id = `acc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const token = transaction(this.db, () => {
      this.db.prepare("INSERT INTO accounts (id, name, kind, created_at, created_ip) VALUES (?, ?, 'guest', ?, ?)").run(id, name, Date.now(), address);
      this.db.prepare('INSERT INTO wallets (account_id, cash, bank) VALUES (?, ?, ?)').run(id, STARTING_CASH, STARTING_BANK);
      this.db
        .prepare("INSERT INTO ledger (account_id, at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo) VALUES (?, ?, 'start', ?, ?, ?, ?, 1, 'Starting money')")
        .run(id, Date.now(), STARTING_CASH, STARTING_BANK, STARTING_CASH, STARTING_BANK);
      return this.openSession(id);
    });
    return { ok: true, token, account: this.row(id)! };
  }

  /**
   * Registers a username and password. From a guest (signed in on this device), the guest keeps
   * everything and becomes that player; otherwise a new player starts with the starting money.
   */
  public register(rawUsername: unknown, rawPassword: unknown, guest: Account | null, address: string): { ok: true; token: string; account: Account; upgraded: boolean } | { ok: false; reason: string } {
    const username = cleanUsername(rawUsername);
    const password = String(rawPassword ?? '');
    if (!username) return { ok: false, reason: 'A username is 3 to 16 letters or numbers (_ and . allowed, no spaces).' };
    if (password.length < 6) return { ok: false, reason: 'The password needs at least 6 characters.' };
    if (!this.signUpsByAddress.allow(address)) return { ok: false, reason: 'Too many new accounts from this connection. Try again in an hour.' };
    const taken = this.db.prepare('SELECT 1 FROM accounts WHERE username = ?').get(username.toLowerCase());
    if (taken) return { ok: false, reason: `@${username} is taken. Choose another username.` };
    const hashed = hashPassword(password);
    return transaction(this.db, () => {
      let accountId: string;
      let upgraded = false;
      const guestHasName = guest ? (this.db.prepare('SELECT username FROM accounts WHERE id = ?').get(guest.id) as { username: string | null } | undefined)?.username : null;
      if (guest && guest.kind === 'guest' && !guestHasName) {
        accountId = guest.id;
        upgraded = true;
        this.db.prepare("UPDATE accounts SET kind = 'password', username = ?, password_hash = ?, name = ?, verified = 1 WHERE id = ?").run(username.toLowerCase(), hashed, username, accountId);
      } else {
        accountId = `acc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        this.db.prepare("INSERT INTO accounts (id, name, kind, verified, created_at, created_ip, username, password_hash) VALUES (?, ?, 'password', 1, ?, ?, ?, ?)").run(accountId, username, Date.now(), address, username.toLowerCase(), hashed);
        this.db.prepare('INSERT INTO wallets (account_id, cash, bank) VALUES (?, ?, ?)').run(accountId, STARTING_CASH, STARTING_BANK);
        this.db
          .prepare("INSERT INTO ledger (account_id, at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo) VALUES (?, ?, 'start', ?, ?, ?, ?, 1, 'Starting money')")
          .run(accountId, Date.now(), STARTING_CASH, STARTING_BANK, STARTING_CASH, STARTING_BANK);
      }
      return { ok: true as const, token: this.openSession(accountId), account: this.row(accountId)!, upgraded };
    });
  }

  /** Signs in with a username and password, on any device */
  public login(rawUsername: unknown, rawPassword: unknown, address: string): { ok: true; token: string; account: Account } | { ok: false; reason: string } {
    if (!this.signInsByAddress.allow(address)) return { ok: false, reason: 'Too many tries. Wait a few minutes and try again.' };
    const username = cleanUsername(rawUsername);
    const r = username ? (this.db.prepare('SELECT id, password_hash, banned FROM accounts WHERE username = ?').get(username.toLowerCase()) as { id: string; password_hash: string | null; banned: number } | undefined) : undefined;
    if (!r || !passwordMatches(String(rawPassword ?? ''), r.password_hash)) return { ok: false, reason: 'That username and password do not match.' };
    if (r.banned) return { ok: false, reason: 'This account has been suspended.' };
    return { ok: true, token: this.openSession(r.id), account: this.row(r.id)! };
  }

  /** The account a session token belongs to, or null. */
  public authenticate(token: string | null | undefined): Account | null {
    if (!token) return null;
    const r = this.db.prepare('SELECT account_id FROM sessions WHERE token_hash = ?').get(hash(token)) as { account_id: string } | undefined;
    if (!r) return null;
    this.db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(Date.now(), hash(token));
    const account = this.row(r.account_id);
    return account && !account.banned ? account : null;
  }

  /**
   * Sends a sign-in link to an email address. From a guest, opening it keeps that guest's
   * progress on a verified account; on a new device, it signs in to the account with that email.
   */
  public startEmail(rawEmail: unknown, guest: Account | null, address: string): { ok: true; devLink?: string } | { ok: false; reason: string } {
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!EMAIL.test(email)) return { ok: false, reason: 'That does not look like an email address.' };
    if (!this.linksByAddress.allow(address) || !this.linksByEmail.allow(email)) {
      return { ok: false, reason: 'Too many sign-in links asked for. Try again in an hour.' };
    }
    const token = newToken();
    this.db
      .prepare('INSERT INTO sign_in_links (token_hash, account_id, email, expires_at) VALUES (?, ?, ?, ?)')
      .run(hash(token), guest?.id ?? null, email, Date.now() + LINK_MINUTES * 60_000);
    const link = `${this.publicUrl}/?signin=${token}`;
    this.mailer.send(email, 'Your Nigeria Life sign-in link', `Open this within ${LINK_MINUTES} minutes to sign in:\n${link}\n\nIf you did not ask for it, ignore this email.`);
    return this.dev ? { ok: true, devLink: link } : { ok: true };
  }

  /** Opens a sign-in link: the account it signs in to, verified, with a new session. */
  public finishEmail(token: unknown): { ok: true; token: string; account: Account; upgraded: boolean } | { ok: false; reason: string } {
    const r = this.db.prepare('SELECT account_id, email, expires_at, used FROM sign_in_links WHERE token_hash = ?').get(hash(String(token ?? ''))) as
      | { account_id: string | null; email: string; expires_at: number; used: number }
      | undefined;
    if (!r || r.used) return { ok: false, reason: 'That sign-in link has been used or is not valid.' };
    if (Date.now() > r.expires_at) return { ok: false, reason: 'That sign-in link has expired. Ask for a new one.' };
    return transaction(this.db, () => {
      this.db.prepare('UPDATE sign_in_links SET used = 1 WHERE token_hash = ?').run(hash(String(token)));
      const existing = this.db.prepare('SELECT id FROM accounts WHERE email = ?').get(r.email) as { id: string } | undefined;
      let accountId: string;
      let upgraded = false;
      if (existing) {
        // That email already has an account: sign in to it (a guest on this device stays a guest)
        accountId = existing.id;
      } else if (r.account_id && this.row(r.account_id)) {
        // The guest who asked keeps everything, now verified
        accountId = r.account_id;
        this.db.prepare("UPDATE accounts SET kind = 'email', email = ?, verified = 1 WHERE id = ?").run(r.email, accountId);
        upgraded = true;
      } else {
        accountId = `acc_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
        this.db.prepare("INSERT INTO accounts (id, name, kind, email, verified, created_at) VALUES (?, ?, 'email', ?, 1, ?)").run(accountId, r.email.split('@')[0].slice(0, 20), r.email, Date.now());
        this.db.prepare('INSERT INTO wallets (account_id, cash, bank) VALUES (?, ?, ?)').run(accountId, STARTING_CASH, STARTING_BANK);
        this.db
          .prepare("INSERT INTO ledger (account_id, at, kind, cash_delta, bank_delta, cash_after, bank_after, verified, memo) VALUES (?, ?, 'start', ?, ?, ?, ?, 1, 'Starting money')")
          .run(accountId, Date.now(), STARTING_CASH, STARTING_BANK, STARTING_CASH, STARTING_BANK);
      }
      this.db.prepare('UPDATE accounts SET verified = 1 WHERE id = ?').run(accountId);
      return { ok: true as const, token: this.openSession(accountId), account: this.row(accountId)!, upgraded };
    });
  }

  /**
   * The player this account is in the ownership registry. Bound once: the first registry id an
   * account brings is its own for good, and no other account can take it. Signing in on another
   * device returns the one already bound, which that device then uses.
   */
  public bindRegistry(account: Account, raw: unknown): { ok: true; id: string } | { ok: false; reason: string } {
    const r = this.db.prepare('SELECT registry_id FROM accounts WHERE id = ?').get(account.id) as { registry_id: string | null } | undefined;
    if (r?.registry_id) return { ok: true, id: r.registry_id };
    const id = String(raw ?? '');
    if (!/^net:[0-9a-f-]{36}$/.test(id)) return { ok: false, reason: 'That is not a player of the registry.' };
    if (this.db.prepare('SELECT 1 FROM accounts WHERE registry_id = ?').get(id)) return { ok: false, reason: 'That player belongs to another account.' };
    this.db.prepare('UPDATE accounts SET registry_id = ? WHERE id = ?').run(id, account.id);
    return { ok: true, id };
  }

  public byRegistry(id: string): Account | null {
    const r = this.db.prepare('SELECT id FROM accounts WHERE registry_id = ?').get(id) as { id: string } | undefined;
    return r ? this.row(r.id) : null;
  }

  public registryOf(account: Account): string | null {
    return (this.db.prepare('SELECT registry_id FROM accounts WHERE id = ?').get(account.id) as { registry_id: string | null } | undefined)?.registry_id ?? null;
  }

  public rename(account: Account, rawName: unknown): Account | null {
    const name = cleanName(rawName);
    if (!name) return null;
    this.db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name, account.id);
    return this.row(account.id);
  }

  public counts(): { all: number; verified: number } {
    const r = this.db.prepare('SELECT COUNT(*) AS all_, SUM(verified) AS verified FROM accounts WHERE banned = 0').get() as { all_: number; verified: number | null };
    return { all: r.all_, verified: r.verified ?? 0 };
  }

  public setBanned(id: string, banned: boolean): void {
    this.db.prepare('UPDATE accounts SET banned = ? WHERE id = ?').run(banned ? 1 : 0, id);
    if (banned) this.db.prepare('DELETE FROM sessions WHERE account_id = ?').run(id);
  }

  public mute(id: string, minutes: number): void {
    this.db.prepare('UPDATE accounts SET muted_until = ? WHERE id = ?').run(Date.now() + minutes * 60_000, id);
  }
}
