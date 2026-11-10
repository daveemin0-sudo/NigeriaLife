import { OnlineAccount } from '../online/OnlineAccount';
import { profileKey } from './Profile';

/**
 * The cloud pill. It used to write a backup code into this browser and call that synced.
 * It now sends the life to the account on the game server, and the pill says whether that
 * happened. Money and land are not part of what this decides: the server's ledgers are.
 *
 * With no server, or while the player is still a guest, the pill says to sign up. A guest
 * who never does can lose everything on this device.
 */

export interface CloudSyncInfo {
  status: 'saved' | 'offline' | 'guest';
  /** The words on the pill, exactly */
  label: string;
  lastSyncedTimestamp: number;
  lastSyncedFormatted: string;
}

interface SaveDoc {
  v: 1;
  at: number;
  bags: Record<string, string>;
}

/** Kept in step with server/saves.ts. These never go into the account. */
const DENY = [
  'nigeria_life_session',
  'nigeria_life_account_id',
  'nigeria_life_cloud_',
  'nigeria_cloud_code_',
  'nigeria_life_world_registry',
  'nigeria_life_world_server',
  'nl_account_save_',
  'nigeria_life_network_player_id',
  'nigeria_life_account_data_v1__backup',
];

const VERSION_KEY = () => profileKey('nl_account_save_version');
const AT_KEY = () => profileKey('nl_account_save_at');
const QUIET_KEY = () => profileKey('nl_account_save_quiet');

function denied(key: string): boolean {
  return DENY.some((prefix) => key === prefix || key.startsWith(prefix));
}

function ago(ts: number): string {
  if (!ts) return 'never';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins <= 0) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}

export class CloudSyncService {
  private static instance: CloudSyncService;
  private online: OnlineAccount | null = null;
  private listeners: Array<(info: CloudSyncInfo) => void> = [];
  private timer = 0;
  private flying: Promise<boolean> | null = null;
  private again = false;
  private offline = false;
  private savedAt = 0;
  /** Pushes start once the first sign-in has decided whether the server's copy is newer. */
  private live = false;
  private armed = false;

  private constructor() {
    this.savedAt = Number(localStorage.getItem(AT_KEY()) || 0);
  }

  public static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) CloudSyncService.instance = new CloudSyncService();
    return CloudSyncService.instance;
  }

  /** Called when the game has a server. Loads a newer save, then keeps sending. */
  public attach(online: OnlineAccount): void {
    this.online = online;
    void online.ready.then(async (ok) => {
      if (!ok || online.leaving) return;
      const pulled = await this.pullIfNewer();
      if (pulled) return;
      this.live = true;
      this.arm();
      this.publish();
    });
  }

  /** A local save changed. Sent shortly after, and in full every minute while playing. */
  public note(): void {
    if (!this.live) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.pushNow(), 2000);
  }

  public async pushNow(): Promise<boolean> {
    if (this.flying) {
      this.again = true;
      return this.flying;
    }
    this.flying = this.send();
    const ok = await this.flying;
    this.flying = null;
    if (this.again) {
      this.again = false;
      return this.pushNow();
    }
    return ok;
  }

  /** The server's copy replaces this device, then the page loads again so every system reads it. */
  public async replaceFromServer(): Promise<boolean> {
    const online = this.online ?? OnlineAccount.get();
    if (!online) return false;
    const remote = await online.request('/me/save');
    if (!remote.ok) return false;
    if (!remote.doc) {
      this.clearGameKeys();
      this.remember(0, 0);
      return true;
    }
    this.apply(remote.doc, remote.version, remote.savedAt);
    return true;
  }

  public async download(): Promise<string | null> {
    const online = this.online ?? OnlineAccount.get();
    if (!online) return null;
    const remote = await online.request('/me/save');
    if (!remote.ok || !remote.doc) return null;
    return JSON.stringify(remote.doc, null, 2);
  }

  public async changeEmail(email: string, password: string): Promise<{ ok: boolean; reason?: string }> {
    const online = this.online ?? OnlineAccount.get();
    if (!online) return { ok: false, reason: 'Not signed in.' };
    const result = await online.request('/me/email', { email, password });
    if (result.ok && result.account) online.account = result.account;
    return result.ok ? { ok: true } : { ok: false, reason: result.reason ?? 'The email was not changed.' };
  }

  public async signOut(): Promise<void> {
    const online = this.online ?? OnlineAccount.get();
    await online?.request('/auth/logout', {});
    try {
      localStorage.clear();
    } catch {
      // The session on the server is already closed
    }
    window.location.reload();
  }

  public async deleteAccount(password: string): Promise<{ ok: boolean; reason?: string }> {
    const online = this.online ?? OnlineAccount.get();
    if (!online) return { ok: false, reason: 'Not signed in.' };
    const result = await online.request('/me/delete', { password });
    if (!result.ok) return { ok: false, reason: result.reason ?? 'The account was not deleted.' };
    try {
      localStorage.clear();
    } catch {
      // Closed on the server either way
    }
    window.location.reload();
    return { ok: true };
  }

  public getSyncInfo(): CloudSyncInfo {
    const online = this.online ?? OnlineAccount.get();
    const guest = !online?.account || online.account.kind === 'guest' || !online.account.verified;
    let status: CloudSyncInfo['status'] = 'guest';
    let label = 'Guest: sign up to keep your progress';
    if (!guest) {
      if (this.offline || !this.savedAt) {
        status = 'offline';
        label = 'Not saved: no connection';
      } else {
        status = 'saved';
        label = `Saved to your account · ${ago(this.savedAt)}`;
      }
    }
    return { status, label, lastSyncedTimestamp: this.savedAt, lastSyncedFormatted: ago(this.savedAt) };
  }

  public subscribe(cb: (info: CloudSyncInfo) => void): () => void {
    this.listeners.push(cb);
    cb(this.getSyncInfo());
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== cb);
    };
  }

  private async pullIfNewer(): Promise<boolean> {
    const online = this.online ?? OnlineAccount.get();
    if (!online) return false;
    const remote = await online.request('/me/save');
    if (!remote.ok || !remote.doc) return false;
    if (Number(remote.version) > this.version()) {
      this.apply(remote.doc, remote.version, remote.savedAt);
      online.leaving = true;
      window.location.reload();
      return true;
    }
    this.savedAt = Number(remote.savedAt) || this.savedAt;
    return false;
  }

  private async send(): Promise<boolean> {
    const online = this.online ?? OnlineAccount.get();
    // A sign-in is about to load the account's copy. Don't send this device's guest life over it.
    if (online?.leaving || this.quiet()) return true;
    if (!online) {
      this.offline = true;
      this.publish();
      return false;
    }
    const id = online.id;
    await online.settled();
    // The session may have changed while the money reports were in flight: this device's guest
    // life must not be written onto the account that was just signed in.
    if (online.leaving || online.id !== id || this.quiet()) return true;
    const doc = this.collect();
    const result = await online.request('/me/save', { doc, base: this.version() });
    if (!result.ok || !result.doc) {
      this.offline = true;
      this.publish();
      return false;
    }
    this.offline = false;
    if (result.kept === 'server' || result.stripped) {
      this.apply(result.doc, result.version, result.savedAt);
      this.publish();
      online.leaving = true;
      window.location.reload();
      return true;
    }
    this.remember(Number(result.version) || 0, Number(result.savedAt) || Date.now());
    this.publish();
    return true;
  }

  private collect(): SaveDoc {
    const bags: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || denied(key)) continue;
        const value = localStorage.getItem(key);
        if (value === null || value.length > 400_000) continue;
        bags[key] = value;
      }
    } catch {
      // Whatever could be read is what is sent
    }
    return { v: 1, at: Date.now(), bags };
  }

  private apply(doc: SaveDoc, version: number, savedAt: number): void {
    this.clearGameKeys();
    for (const [key, value] of Object.entries(doc.bags || {})) {
      if (denied(key) || typeof value !== 'string') continue;
      try {
        localStorage.setItem(key, value);
      } catch {
        // This device could not hold it; the account still has it
      }
    }
    this.remember(Number(version) || 0, Number(savedAt) || Date.now());
    try {
      localStorage.setItem(QUIET_KEY(), String(Date.now() + 20_000));
    } catch {
      // A reload still has the save
    }
  }

  /** Everything except the sign-in itself, so the account's copy is the whole device. */
  private clearGameKeys(): void {
    const keep = new Set([
      profileKey('nigeria_life_session'),
      profileKey('nigeria_life_account_id'),
      profileKey('nigeria_life_network_player_id'),
      'nigeria_life_world_server',
      'nigeria_life_world_server_key',
    ]);
    const drop: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keep.has(key)) drop.push(key);
      }
      for (const key of drop) localStorage.removeItem(key);
    } catch {
      // Cleared as far as the browser allowed
    }
  }

  private remember(version: number, savedAt: number): void {
    this.savedAt = savedAt;
    try {
      localStorage.setItem(VERSION_KEY(), String(version));
      localStorage.setItem(AT_KEY(), String(savedAt));
    } catch {
      // The page is about to load again
    }
  }

  private version(): number {
    return Number(localStorage.getItem(VERSION_KEY()) || 0);
  }

  private quiet(): boolean {
    return Date.now() < Number(localStorage.getItem(QUIET_KEY()) || 0);
  }

  private arm(): void {
    if (this.armed) return;
    this.armed = true;
    window.setInterval(() => void this.pushNow(), 60_000);
    window.setInterval(() => this.publish(), 20_000);
    window.addEventListener('online', () => void this.pushNow());
  }

  private publish(): void {
    const info = this.getSyncInfo();
    for (const listener of this.listeners) listener(info);
  }
}
