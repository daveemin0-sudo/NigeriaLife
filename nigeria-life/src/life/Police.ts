import { BackendService } from '../backend/BackendService';
import { profileKey } from '../backend/Profile';
import { OnlineAccount } from '../online/OnlineAccount';
import { BRIBE, BRIBE_TAKEN, OFFENCES, clearsAt, sentence, standing, vetsStaff, type Custody, type RecordEntry } from './Offences';

/**
 * The police and the player (src/life/Offences.ts has the charges): arrested, held in the
 * Area Command cell for real minutes, let out when the time is served or bail is paid (by the
 * player, or online by anyone else), a bribe that is taken or becomes a charge of its own, and
 * a record that keeps the vetting employers' doors shut until it lapses.
 *
 * On a game server the server holds the cell and the record, and pays and takes the money;
 * this mirrors what it says. Without one, it is all kept here.
 */
export class Police {
  private static instance: Police | null = null;
  public static get(): Police {
    return (Police.instance ??= new Police());
  }

  private held: Custody | null = null;
  private entries: RecordEntry[] = [];
  private listeners: Array<() => void> = [];
  private readonly key = profileKey('nl_police_v1');
  /** The player has just been arrested: the game takes them to the cell (set by the game) */
  public onArrested: (custody: Custody, offence: string) => void = () => {};
  /** Let out: time served, bail paid, or the officer took the envelope (set by the game) */
  public onReleased: (why: 'served' | 'bail' | 'bribe' | 'bailed', by?: string) => void = () => {};

  private constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) || '{}');
      if (saved?.custody && Number.isFinite(saved.custody.until)) this.held = saved.custody;
      if (Array.isArray(saved?.record)) this.entries = saved.record.filter((r: RecordEntry) => r && typeof r.offence === 'string' && Number.isFinite(r.at));
    } catch {
      // A clean slate
    }
    OnlineAccount.get()?.on('packet', (message: any) => {
      if (message?.type === 'bailed') void this.sync().then(() => this.release('bailed', String(message.by ?? 'Someone')));
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private changed(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify({ custody: this.held, record: this.entries }));
    } catch {
      // Kept for this visit
    }
    for (const listener of this.listeners) listener();
  }

  private take(server: { custody?: Custody | null; record?: RecordEntry[]; now?: number }): void {
    // The server's clock and this one may differ: its custody is kept as time left
    const skew = Number.isFinite(server.now) ? Date.now() - (server.now as number) : 0;
    this.held = server.custody ? { ...server.custody, since: server.custody.since + skew, until: server.custody.until + skew } : null;
    if (Array.isArray(server.record)) this.entries = server.record.map((r) => ({ offence: r.offence, at: r.at + skew }));
    this.changed();
  }

  /** What the server holds, read again (online) */
  public async sync(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    const state = await online.request('/police').catch(() => null);
    if (state?.ok) this.take(state);
  }

  /** In the cell now, or null */
  public custody(): Custody | null {
    return this.held && this.held.until > Date.now() ? this.held : null;
  }

  /** The record as it stands (entries that have not lapsed) */
  public record(): RecordEntry[] {
    return standing(this.entries, Date.now());
  }

  public clearsOn(): number | null {
    return clearsAt(this.entries, Date.now());
  }

  /** Why an employer of this trade will not take the player on, or null */
  public refuses(trade: string): string | null {
    if (!vetsStaff(trade) || !this.record().length) return null;
    const clears = this.clearsOn();
    return `They check police records, and yours is not clear${clears ? `: it clears on ${new Date(clears).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}.`;
  }

  /** Arrested for this: on the record and into the cell */
  public async arrest(offenceId: string): Promise<Custody | null> {
    if (!OFFENCES[offenceId]) return null;
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/police/arrest', { offence: offenceId }).catch(() => null);
      if (!done?.ok) return null;
      this.take(done);
    } else {
      const now = Date.now();
      const given = sentence(offenceId, this.entries, now);
      const held = this.custody();
      this.entries.push({ offence: offenceId, at: now });
      this.held = held
        ? { ...held, until: held.until + given.minutes * 60_000, bail: held.bail + given.bail }
        : { offence: offenceId, since: now, until: now + given.minutes * 60_000, bail: given.bail };
      this.changed();
    }
    const custody = this.custody();
    if (custody) this.onArrested(custody, offenceId);
    return custody;
  }

  /** The player pays their own bail, from the bank and then cash */
  public async payBail(): Promise<{ ok: boolean; message: string }> {
    const held = this.custody();
    if (!held) return { ok: false, message: 'You are not in a cell.' };
    const online = OnlineAccount.get();
    if (online) {
      const done = await online.request('/police/bail', { idem: `bail:${online.id ?? 'x'}:${held.since}` }).catch(() => null);
      if (done?.wallet) BackendService.getInstance().applyServerWallet(done.wallet);
      if (!done?.ok) return { ok: false, message: done?.reason ?? 'The bail did not go through.' };
    } else {
      const paid = BackendService.getInstance().processTransaction({ type: 'FINE_PAYMENT', amount: held.bail, description: `Bail: ${OFFENCES[held.offence]?.name ?? held.offence}`, source: 'bank', funding: 'split' });
      if (!paid.success) return { ok: false, message: `Bail is ₦${held.bail.toLocaleString()} and you do not have it.` };
    }
    this.release('bail');
    return { ok: true, message: `Bail of ₦${held.bail.toLocaleString()} paid. The sergeant unlocks the cell.` };
  }

  /** An envelope through the bars: taken (out you go) or a new charge (more time, more bail) */
  public async bribe(): Promise<{ ok: boolean; taken?: boolean; message: string }> {
    const held = this.custody();
    if (!held) return { ok: false, message: 'You are not in a cell.' };
    const online = OnlineAccount.get();
    let taken: boolean;
    if (online) {
      const done = await online.request('/police/bribe', { idem: `bribe:${online.id ?? 'x'}:${Date.now()}` }).catch(() => null);
      if (done?.wallet) BackendService.getInstance().applyServerWallet(done.wallet);
      if (!done?.ok) return { ok: false, message: done?.reason ?? 'Nobody took it.' };
      this.take(done);
      taken = !!done.taken;
    } else {
      const paid = BackendService.getInstance().processTransaction({ type: 'FINE_PAYMENT', amount: BRIBE, description: 'An envelope for the officer', source: 'wallet', funding: 'split' });
      if (!paid.success) return { ok: false, message: `You do not have ₦${BRIBE.toLocaleString()}.` };
      taken = Math.random() < BRIBE_TAKEN;
      if (!taken) {
        const now = Date.now();
        const given = sentence('bribery', this.entries, now);
        this.entries.push({ offence: 'bribery', at: now });
        this.held = { ...held, until: held.until + given.minutes * 60_000, bail: held.bail + given.bail };
        this.changed();
      }
    }
    if (taken) {
      this.release('bribe');
      return { ok: true, taken: true, message: 'The officer pockets the envelope, looks the other way, and the cell door is left open.' };
    }
    const now = this.custody();
    return { ok: true, taken: false, message: `"You want to bribe an officer?" It goes on your record as a second charge. ${now ? `${Math.ceil((now.until - Date.now()) / 60_000)} minutes now, and bail is ₦${now.bail.toLocaleString()}.` : ''}` };
  }

  /** Who is in a cell and online, to bail out (online only) */
  public async others(): Promise<Array<{ id: string; name: string; bail: number; until: number; offence: string }>> {
    const online = OnlineAccount.get();
    if (!online) return [];
    const done = await online.request('/police/held').catch(() => null);
    return done?.ok ? done.held : [];
  }

  /** Bail paid for another player, from this player's money */
  public async bailFor(id: string): Promise<{ ok: boolean; message: string }> {
    const online = OnlineAccount.get();
    if (!online) return { ok: false, message: 'Only on the game server.' };
    const done = await online.request('/police/bail', { for: id, idem: `bailfor:${online.id ?? 'x'}:${id}:${Math.floor(Date.now() / 60_000)}` }).catch(() => null);
    if (done?.wallet) BackendService.getInstance().applyServerWallet(done.wallet);
    return done?.ok ? { ok: true, message: `You paid ₦${Number(done.bail).toLocaleString()} bail. They are out.` } : { ok: false, message: done?.reason ?? 'The bail did not go through.' };
  }

  private release(why: 'served' | 'bail' | 'bribe' | 'bailed', by?: string): void {
    this.held = null;
    this.changed();
    this.onReleased(why, by);
  }

  /** Called often by the game: time served lets the player out */
  public tick(): void {
    if (this.held && this.held.until <= Date.now()) this.release('served');
  }
}
