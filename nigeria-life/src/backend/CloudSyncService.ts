import { OnlineAccount } from '../online/OnlineAccount';
import { profileKey } from './Profile';
import { showGameToast } from '../ui/GameToast';

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
/** This browser's name for itself (not part of the save: the prefix is denied) */
const DEVICE_KEY = 'nl_account_save_device';
/** Said once after the page loads again with the account's newer copy */
const BEHIND_KEY = 'nl_account_save_behind';
/** When this tab last loaded again because another device was ahead (this tab only) */
const RELOADED_KEY = 'nl_account_save_reloaded_at';
/** "Play here instead" was pressed: this device takes the life over on its next save */
const TAKE_KEY = 'nl_account_save_take';
/** Behind again this soon after loading the newer copy: the other device is being played */
const STILL_BEHIND_MS = 90_000;

/** A random name for this browser, made once and kept: the server knows which device wrote its copy */
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      id = `d${random}`.slice(0, 40);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'd-no-storage';
  }
}

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
  /** The life is being played on another device: this one does not save (see stepAside) */
  private paused = false;
  /** This device has taken the life over: its next save is kept even though it is behind */
  private taking = false;

  private decide: (loading: boolean) => void = () => undefined;
  /**
   * Settles once the first sign-in has decided whose copy is newer: true if the account's newer
   * copy is being loaded (the page is about to load again), false if this device's stands.
   */
  public readonly decided: Promise<boolean> = new Promise((resolve) => { this.decide = resolve; });

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
    // Loaded again because another device was ahead: say so, once
    try {
      if (sessionStorage.getItem(BEHIND_KEY)) {
        sessionStorage.removeItem(BEHIND_KEY);
        window.setTimeout(() => showGameToast('☁️ This device was behind. Your newer progress from your other device has been loaded.', 'info', 6000), 1500);
      }
    } catch {
      // Nothing to say
    }
    try {
      if (sessionStorage.getItem(TAKE_KEY)) {
        sessionStorage.removeItem(TAKE_KEY);
        this.taking = true;
      }
    } catch {
      // Not taken over
    }
    void online.ready.then(async (ok) => {
      if (!ok || online.leaving) {
        this.decide(online.leaving);
        return;
      }
      // Taking the life over: the copy loaded a moment ago is the one to play on, even if the
      // other device has saved since
      const pulled = this.taking ? false : await this.pullIfNewer();
      this.decide(pulled);
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
    if (Number(remote.version) > this.version()) return this.catchUp(remote.doc, remote.version, remote.savedAt, false);
    this.savedAt = Number(remote.savedAt) || this.savedAt;
    return false;
  }

  private async send(): Promise<boolean> {
    const online = this.online ?? OnlineAccount.get();
    // A sign-in is about to load the account's copy. Don't send this device's guest life over it.
    if (online?.leaving || this.quiet() || this.paused) return true;
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
    // The version this device built on, and its name: the server refuses to let an out-of-date
    // device overwrite what another has saved since (server/saves.ts)
    const result = await online.request('/me/save', { doc, base: this.version(), device: deviceId(), ...(this.taking ? { take: true } : {}) });
    if (!result.ok || !result.doc) {
      this.offline = true;
      this.publish();
      return false;
    }
    this.offline = false;
    this.taking = false;
    // Another device saved since this one last did: its newer copy is loaded here instead
    if (result.kept === 'server') return this.catchUp(result.doc, result.version, result.savedAt, true);
    if (result.stripped) {
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

  /**
   * This device is behind the account's copy. It loads the newer copy, once. Behind again within
   * a minute and a half of that, the other device is plainly being played: this one steps aside
   * rather than load again and again (it used to, for as long as the other was played).
   */
  private catchUp(doc: SaveDoc, version: number, savedAt: number, say: boolean): boolean {
    const online = this.online ?? OnlineAccount.get();
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOADED_KEY) || 0);
    } catch {
      // Never loaded again in this tab
    }
    if (Date.now() - last < STILL_BEHIND_MS) {
      this.stepAside();
      return false;
    }
    try {
      sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
      if (say) sessionStorage.setItem(BEHIND_KEY, '1');
    } catch {
      // Loaded again without the word
    }
    this.apply(doc, version, savedAt);
    this.publish();
    if (online) online.leaving = true;
    window.location.reload();
    return true;
  }

  /**
   * The life is being played on another device. This one stops saving, so it cannot overwrite
   * that progress, and says so over the game, with a way to play here instead (the other device
   * is then the one that steps aside, the next time it saves).
   */
  private stepAside(): void {
    if (this.paused) return;
    this.paused = true;
    this.live = false;
    this.publish();
    if (document.getElementById('nl-elsewhere')) return;
    const veil = document.createElement('div');
    veil.id = 'nl-elsewhere';
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-modal', 'true');
    veil.setAttribute('aria-labelledby', 'nl-elsewhere-title');
    veil.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(8,10,14,0.82);';
    veil.innerHTML = `
      <div style="max-width:360px;width:100%;background:#151821;color:#f4f1ea;border:1px solid rgba(201,162,39,0.5);border-radius:16px;padding:20px;font:15px/1.45 system-ui,sans-serif;box-shadow:0 18px 48px rgba(0,0,0,0.5)">
        <div id="nl-elsewhere-title" style="font-weight:700;font-size:18px;margin-bottom:8px">📱 Playing on another device</div>
        <div style="margin-bottom:16px;color:#d6d0c4">Your life is open on another device and is being saved from there. This one has stopped saving, so it cannot overwrite that progress.</div>
        <button type="button" id="nl-elsewhere-here" style="width:100%;min-height:46px;border:0;border-radius:12px;background:#c9a227;color:#111;font-weight:700;font-size:15px;cursor:pointer">Play here instead</button>
      </div>`;
    document.body.appendChild(veil);
    veil.querySelector<HTMLButtonElement>('#nl-elsewhere-here')?.addEventListener('click', () => void this.playHere());
  }

  /** Loads the account's copy as it is now and plays on from it here: the other device steps aside */
  private async playHere(): Promise<void> {
    const online = this.online ?? OnlineAccount.get();
    if (!online) return;
    const button = document.getElementById('nl-elsewhere-here') as HTMLButtonElement | null;
    if (button) {
      button.disabled = true;
      button.textContent = 'Loading your life…';
    }
    const remote = await online.request('/me/save');
    if (!remote.ok || !remote.doc) {
      if (button) {
        button.disabled = false;
        button.textContent = 'Could not reach the server. Try again';
      }
      return;
    }
    this.apply(remote.doc, remote.version, remote.savedAt);
    try {
      sessionStorage.setItem(TAKE_KEY, '1');
      sessionStorage.removeItem(RELOADED_KEY);
    } catch {
      // Taken over on the next save that names it
    }
    online.leaving = true;
    window.location.reload();
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
      DEVICE_KEY,
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
