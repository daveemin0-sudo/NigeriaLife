import { SERVER_URL, NETWORK_PLAYER_ID } from '../realestate/ServerLink';
import { profileKey } from '../backend/Profile';

/**
 * The player's account on the game server, when the game is using one (see `ServerLink`).
 *
 * The first time, the game signs in as a guest at once, bringing this device's money with it
 * (once, up to the server's limit). After that the server holds the money: the game reports
 * what it spends and earns, and takes the balance the server sends back as the truth, so a
 * number changed in the browser does not survive. A guest keeps their progress for good by
 * adding an email address (Phone › Life › Settings); opening the emailed link (`?signin=`)
 * signs that account in on any device.
 *
 * It also carries the player's packets to and from the city over one WebSocket, reconnecting
 * when the connection drops.
 */

export interface WalletView {
  cash: number;
  bank: number;
}

export interface AccountView {
  id: string;
  name: string;
  kind: 'guest' | 'email';
  email: string | null;
  verified: boolean;
}

type Handler = (message: any) => void;

const TOKEN_KEY = () => profileKey('nigeria_life_session');
const ACCOUNT_KEY = () => profileKey('nigeria_life_account_id');

export class OnlineAccount {
  private static instance: OnlineAccount | null = null;

  public readonly base: string;
  public account: AccountView | null = null;
  public wallet: WalletView | null = null;
  public connected = false;
  /** Resolves once signed in (false if the server could not be reached) */
  public readonly ready: Promise<boolean>;

  private token: string | null;
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private retry = 1000;
  private reports: Promise<unknown> = Promise.resolve();
  private counter = 0;
  private closedForGood = false;

  /** Starts the account if the game has a server; null when playing in this browser only. */
  public static start(options: { name: string; save: WalletView }): OnlineAccount | null {
    if (!SERVER_URL) return null;
    if (!OnlineAccount.instance) OnlineAccount.instance = new OnlineAccount(SERVER_URL, options);
    return OnlineAccount.instance;
  }

  public static get(): OnlineAccount | null {
    return OnlineAccount.instance;
  }

  private constructor(base: string, options: { name: string; save: WalletView }) {
    this.base = base;
    this.token = this.read(TOKEN_KEY());
    const known = this.read(ACCOUNT_KEY());
    if (known) this.account = { id: known, name: options.name, kind: 'guest', email: null, verified: false };
    this.ready = this.signIn(options);
  }

  /** The id other players know this player by, if signed in (or signed in before on this device). */
  public get id(): string | null {
    return this.account?.id ?? null;
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private keep(token: string, account: AccountView): void {
    this.token = token;
    this.account = account;
    try {
      localStorage.setItem(TOKEN_KEY(), token);
      localStorage.setItem(ACCOUNT_KEY(), account.id);
    } catch {
      // Signed in for this visit only
    }
  }

  public on(type: string, handler: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => set!.delete(handler);
  }

  private emit(type: string, message: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) handler(message);
  }

  /** A request to the server as this player. */
  public async request(path: string, body?: unknown): Promise<any> {
    try {
      const response = await fetch(`${this.base}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (data && data.wallet) this.setWallet(data.wallet);
      return { status: response.status, ...data };
    } catch {
      return { ok: false, status: 0, reason: 'The game server could not be reached.' };
    }
  }

  private setWallet(wallet: WalletView): void {
    if (typeof wallet?.cash !== 'number' || typeof wallet?.bank !== 'number') return;
    this.wallet = { cash: wallet.cash, bank: wallet.bank };
    this.emit('wallet', this.wallet);
  }

  private async signIn(options: { name: string; save: WalletView }): Promise<boolean> {
    // Opened from an emailed sign-in link
    try {
      const params = new URLSearchParams(window.location.search);
      const link = params.get('signin');
      if (link) {
        params.delete('signin');
        const rest = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
        const done = await this.request('/auth/finish', { token: link });
        if (done.ok) {
          this.keep(done.token, done.account);
          this.emit('signed-in', { upgraded: done.upgraded, account: done.account });
        } else {
          this.emit('notice', done.reason);
        }
      }
    } catch {
      // Not a page with an address bar (tests)
    }

    if (this.token) {
      const me = await this.request('/me');
      if (me.ok) {
        this.account = me.account;
        if (!(await this.bindRegistry())) return false;
        this.connect();
        return true;
      }
      if (me.status === 0) return false;
      // The server no longer knows this sign-in: start again as a guest
      this.token = null;
    }
    const made = await this.request('/auth/guest', { name: options.name, save: options.save });
    if (!made.ok) {
      this.emit('notice', made.reason);
      return false;
    }
    this.keep(made.token, made.account);
    if (!(await this.bindRegistry())) return false;
    this.connect();
    return true;
  }

  /** The sign-in token, for requests made elsewhere (the registry's) */
  public get authorization(): string | null {
    return this.token;
  }

  /**
   * The player this account is in the ownership registry. The first device's registry id
   * becomes the account's; another device signing in to the same account takes that one on,
   * which needs the page loaded again (the id is read once at start). False while reloading.
   */
  private async bindRegistry(): Promise<boolean> {
    if (!NETWORK_PLAYER_ID) return true;
    const bound = await this.request('/me/registry', { id: NETWORK_PLAYER_ID });
    if (bound.ok && bound.id && bound.id !== NETWORK_PLAYER_ID) {
      try {
        localStorage.setItem(profileKey('nigeria_life_network_player_id'), bound.id);
        window.location.reload();
        return false;
      } catch {
        return true;
      }
    }
    return true;
  }

  /** Asks the server for the balance again (after it refused something, say). */
  public resync(): void {
    void this.request('/me');
  }

  // --- The city -------------------------------------------------------------------------------

  private connect(): void {
    if (!this.token || this.closedForGood) return;
    const url = `${this.base.replace(/^http/, 'ws')}/play?token=${encodeURIComponent(this.token)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      return this.reconnectLater();
    }
    this.socket = socket;
    socket.onopen = () => {
      this.connected = true;
      this.retry = 1000;
      this.emit('connected', true);
    };
    socket.onmessage = (event) => {
      let message: any;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === 'batch') {
        for (const packet of message.packets ?? []) this.emit('packet', packet);
      } else if (message.type === 'wallet') {
        this.setWallet(message.wallet);
      } else if (message.type === 'welcome' || message.type === 'refused' || message.type === 'transfer') {
        if (message.type === 'welcome' && this.account) this.account = { ...this.account, id: message.id, name: message.name, verified: message.verified };
        this.emit(message.type, message);
      } else {
        this.emit('packet', message);
      }
    };
    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.connected = false;
      this.emit('connected', false);
      // Signed in somewhere else, or removed: do not fight it
      if (event.code === 4001 || event.code === 4003) {
        this.closedForGood = true;
        this.emit('notice', event.code === 4001 ? 'You are playing on another device now.' : 'You have been removed from the game.');
        return;
      }
      this.reconnectLater();
    };
  }

  private reconnectLater(): void {
    const wait = this.retry;
    this.retry = Math.min(10_000, this.retry * 2);
    setTimeout(() => this.connect(), wait);
  }

  /** Sends a packet to the city; dropped while not connected (positions are sent again anyway). */
  public send(packet: unknown): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(packet));
  }

  // --- Money ----------------------------------------------------------------------------------

  private idem(prefix: string): string {
    return `${prefix}:${this.id ?? 'x'}:${Date.now().toString(36)}:${(this.counter++).toString(36)}`;
  }

  /**
   * Tells the server about money the game moved itself, in order. The server answers with the
   * balance as it holds it, which the game then shows (see BackendService.applyServerWallet).
   */
  public report(cash: number, bank: number, memo: string): void {
    const idem = this.idem('r');
    this.reports = this.reports.then(async () => {
      await this.ready;
      const result = await this.request('/money/report', { cash, bank, memo, idem });
      if (!result.ok && result.reason) this.emit('notice', result.reason);
    });
  }

  public sendMoney(to: string, amount: number, from: 'bank' | 'wallet', memo: string): Promise<any> {
    return this.request('/money/send', { to, amount, from, into: from === 'bank' ? 'bank' : 'wallet', memo, idem: this.idem('t') });
  }

  // --- Work -----------------------------------------------------------------------------------

  /** Taken on (if not already) and a piece of work started at the workplace; the server says if not. */
  public async startWork(employer: string): Promise<{ ok: boolean; shift?: string; reason?: string; done?: number }> {
    await this.ready;
    const hired = await this.request('/work/hire', { employer });
    if (!hired.ok) return hired;
    const started = await this.request('/work/start', { employer });
    return { ...started, done: hired.done };
  }

  public finishWork(shift: string): Promise<{ ok: boolean; pay?: number; done?: number; reason?: string; replay?: boolean }> {
    return this.request('/work/finish', { shift, idem: this.idem('w') });
  }

  // --- Safety ---------------------------------------------------------------------------------

  /** Nothing more from this player reaches this one: chat, messages, waves. Kept on the server. */
  public block(id: string): Promise<{ ok: boolean }> {
    return this.request('/social/block', { id });
  }

  /** Tells the game team about a player, with what they said, for the admin page. */
  public reportPlayer(id: string, reason: string, context: string): Promise<{ ok: boolean }> {
    return this.request('/social/report', { id, reason, context });
  }

  // --- Keeping progress -----------------------------------------------------------------------

  public askForSignInLink(email: string): Promise<{ ok: boolean; reason?: string; devLink?: string }> {
    return this.request('/auth/email', { email });
  }
}
