import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Sequence, steps } from '../interactions/Sequence';
import { PlaceOpeners, type PlaceInterior } from '../interiors/places/PlaceInterior';
import { Figure } from '../interiors/places/Worship';
import { ShiftSkill } from '../jobs/ShiftSkill';
import { Activity } from '../life/Activity';
import { OnlineAccount } from '../online/OnlineAccount';
import { showGameToast } from '../ui/GameToast';
import { Builder, signBoard } from '../world/kit/ArchKit';

/**
 * Studio (Afrobeats Record Label): book studio booth time at Naija Radio House (`radio-house`),
 * record a 3-take vocal session in a 3D soundproof booth with a producer, release hits onto the
 * Lagos Top 10 Chart, earn 5 real days of streaming royalties, and perform live headline release
 * concerts at Lagos stages (`freedom-park`, `afrika-shrine`, `ivory-rooftop`, `eko-grand-hotel`).
 */

export const STUDIO_ROYALTY_DAYS = 5;
export const STUDIO_DAY_MS = 86_400_000;

export type StudioTrackId =
  | 'lagos-sunrise'
  | 'lekki-log-drum'
  | 'third-mainland-cruise'
  | 'ojuelegba-anthem'
  | 'grammy-nights-eko';

export interface StudioTrackSpec {
  id: StudioTrackId;
  title: string;
  genre: string;
  producer: string;
  producerOutfit: number;
  label: string;
  synopsis: string;
  minFame: number;
  studioFee: number;
  advancePay: number;
  dailyRoyalty: number;
  concertVenueKey: string;
  concertVenueName: string;
  concertFee: number;
  fameGain: number;
  takes: [string, string, string];
}

export const STUDIO_TRACKS: readonly StudioTrackSpec[] = [
  {
    id: 'lagos-sunrise',
    title: 'Eko Sunrise',
    genre: 'Afrobeats',
    producer: 'Sarz-Beatz',
    producerOutfit: 0x7c3aed,
    label: 'Kalakuta Sound Lab',
    synopsis: 'Warm highlife guitar riffs over a crisp Ikeja shaker and log-drum bounce.',
    minFame: 0,
    studioFee: 25_000,
    advancePay: 35_000,
    dailyRoyalty: 14_000,
    concertVenueKey: 'freedom-park',
    concertVenueName: 'Freedom Park',
    concertFee: 40_000,
    fameGain: 15,
    takes: [
      'From Mainland to the Island, we dey shine like morning gold!',
      'Hold the talking drum pocket — let the brass section breathe!',
      'Eko o ni baje! Put that final harmony on the top!',
    ],
  },
  {
    id: 'lekki-log-drum',
    title: 'Lekki Log Drum',
    genre: 'Amapiano',
    producer: 'P-Prime',
    producerOutfit: 0x2563eb,
    label: 'Mainland Rhythm Records',
    synopsis: 'Late-night tollgate bassline built for rooftop speakers and Friday traffic.',
    minFame: 15,
    studioFee: 40_000,
    advancePay: 55_000,
    dailyRoyalty: 22_000,
    concertVenueKey: 'afrika-shrine',
    concertVenueName: 'New Afrika Shrine',
    concertFee: 65_000,
    fameGain: 20,
    takes: [
      'When the log drum drop, everybody for Lekki stand attention!',
      'Whisper the pre-chorus right before the whistle comes in!',
      'Oya, run the call-and-response for the Shrine crowd!',
    ],
  },
  {
    id: 'third-mainland-cruise',
    title: 'Third Mainland Cruise',
    genre: 'Afro-Fusion',
    producer: 'Rexxie-Vibe',
    producerOutfit: 0xd97706,
    label: 'Lagoon Wave Music',
    synopsis: 'Smooth saxophone melodies and midnight lagoon vocals for the global playlists.',
    minFame: 35,
    studioFee: 60_000,
    advancePay: 80_000,
    dailyRoyalty: 32_000,
    concertVenueKey: 'ivory-rooftop',
    concertVenueName: 'Ivory Rooftop',
    concertFee: 95_000,
    fameGain: 25,
    takes: [
      'Eleven kilometres over water, city lights in the mirror!',
      'Slide into the falsetto — smooth like lagoon breeze!',
      'Hold that last note till the sax solo takes over!',
    ],
  },
  {
    id: 'ojuelegba-anthem',
    title: 'Ojuelegba Hustle',
    genre: 'Street-Pop',
    producer: 'MagicSticks',
    producerOutfit: 0x059669,
    label: 'Surulere Gold Records',
    synopsis: 'Choir stacks, street strings, and an unforgettable hook every danfo conductor knows.',
    minFame: 60,
    studioFee: 85_000,
    advancePay: 110_000,
    dailyRoyalty: 44_000,
    concertVenueKey: 'afrika-shrine',
    concertVenueName: 'New Afrika Shrine',
    concertFee: 130_000,
    fameGain: 30,
    takes: [
      'Nobody slept under the bridge for nothing — tell our story!',
      'Double the vocal stack with the street choir behind you!',
      'Shout out Surulere and Ikeja on the outro fade!',
    ],
  },
  {
    id: 'grammy-nights-eko',
    title: 'Eko to the World',
    genre: 'Arena Afrobeats',
    producer: 'Kel-V',
    producerOutfit: 0xdc2626,
    label: 'Starboy Atlantic Lagos',
    synopsis: 'Full horn section, talking drums, and stadium-sized melodies aimed at #1.',
    minFame: 90,
    studioFee: 120_000,
    advancePay: 150_000,
    dailyRoyalty: 60_000,
    concertVenueKey: 'eko-grand-hotel',
    concertVenueName: 'Eko Grand Hotel',
    concertFee: 185_000,
    fameGain: 40,
    takes: [
      'Lagos on the map — every stadium singing word for word!',
      'Ride the horn stabs and punch the bridge at full power!',
      'Take it home! That is a number-one record right there!',
    ],
  },
];

export interface ActiveStudioSession {
  trackId: StudioTrackId;
  title: string;
  genre: string;
  producer: string;
  label: string;
  studioFee: number;
  advancePay: number;
  concertVenueKey: string;
  concertVenueName: string;
  concertFee: number;
  bookedAt: number;
}

export interface ReleasedSong {
  id: number;
  trackId: StudioTrackId;
  title: string;
  genre: string;
  producer: string;
  label: string;
  stars: 1 | 2 | 3;
  advancePay: number;
  bonus: number;
  dailyRoyalty: number;
  daysPaid: number;
  totalDays: number;
  totalRoyalties: number;
  streams: number;
  concertVenueKey: string;
  concertVenueName: string;
  concertFee: number;
  concertDone: boolean;
  fameEarned: number;
  releasedAt: number;
}

export interface ChartEntry {
  rank: number;
  artist: string;
  title: string;
  genre: string;
  streams: number;
  isPlayer: boolean;
  stars?: 1 | 2 | 3;
}

const RIVAL_CHART_SONGS: ReadonlyArray<{
  artist: string;
  title: string;
  genre: string;
  streams: number;
}> = [
  { artist: 'Burna V', title: 'Lagoon Boys', genre: 'Afro-Fusion', streams: 920_000 },
  { artist: 'Rema D', title: 'Calm Down Ikeja', genre: 'Rave Afrobeats', streams: 840_000 },
  { artist: 'Ayra S', title: 'Sabi Girl Rhythm', genre: 'Afrobeats', streams: 760_000 },
  { artist: 'Asake M', title: 'Lonely at Obalende', genre: 'Amapiano', streams: 690_000 },
  { artist: 'Tems O', title: 'Marina Breeze', genre: 'Alt-R&B', streams: 640_000 },
  { artist: 'Wiz Ayo', title: 'Ojuelegba Star', genre: 'Afrobeats', streams: 590_000 },
  { artist: 'Davido B', title: 'Unavailable in VI', genre: 'Amapiano', streams: 540_000 },
  { artist: 'Oxlade K', title: 'Ku Lo Sa Express', genre: 'Afro-Pop', streams: 480_000 },
  { artist: 'Shallipopi E', title: 'Elon Musk of Lekki', genre: 'Street-Pop', streams: 420_000 },
  { artist: 'Odumodublvck', title: 'Declan Rice Surulere', genre: 'Drill-Highlife', streams: 350_000 },
];

interface SavedStudioState {
  fame: number;
  active: ActiveStudioSession | null;
  discography: ReleasedSong[];
  nextId: number;
}

const STORAGE_KEY_PREFIX = 'nigeria_life_studio_v1';

export class Studio {
  private static instance: Studio | null = null;
  public static now: () => number = () => Date.now();

  public static get(): Studio {
    if (!Studio.instance) Studio.instance = new Studio();
    return Studio.instance;
  }

  private data: SavedStudioState = {
    fame: 0,
    active: null,
    discography: [],
    nextId: 1,
  };
  private loadedProfile = '';
  private checkAccum = 0;
  public onChange: (() => void) | null = null;

  private constructor() {
    this.load();
  }

  private storageKey(): string {
    return `${STORAGE_KEY_PREFIX}:${Activity.player()}`;
  }

  public load(): void {
    const key = this.storageKey();
    if (this.loadedProfile === key) return;
    this.loadedProfile = key;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedStudioState>;
        this.data = {
          fame: Number(parsed.fame ?? 0),
          active: parsed.active ?? null,
          discography: Array.isArray(parsed.discography) ? parsed.discography : [],
          nextId: Number(parsed.nextId ?? 1),
        };
        return;
      }
    } catch {
      /* ignore corrupt storage */
    }
    this.data = { fame: 0, active: null, discography: [], nextId: 1 };
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.data));
    } catch {
      /* ignore quota */
    }
  }

  public resetForTests(): void {
    this.loadedProfile = '';
    this.data = { fame: 0, active: null, discography: [], nextId: 1 };
    this.save();
    this.changed();
  }

  public tracks(): readonly StudioTrackSpec[] {
    return STUDIO_TRACKS;
  }

  public trackFor(id: string): StudioTrackSpec | null {
    return STUDIO_TRACKS.find((t) => t.id === id) ?? null;
  }

  public fame(): number {
    this.load();
    return this.data.fame;
  }

  public activeSession(): ActiveStudioSession | null {
    this.load();
    return this.data.active;
  }

  public discography(): readonly ReleasedSong[] {
    this.load();
    return this.data.discography;
  }

  public totalRoyaltiesEarned(): number {
    this.load();
    return this.data.discography.reduce((sum, s) => sum + (s.totalRoyalties || 0), 0);
  }

  public totalStreams(): number {
    this.load();
    return this.data.discography.reduce((sum, s) => sum + (s.streams || 0), 0);
  }

  /** Returns the song eligible for a live headline release concert at `venueKey`, if any */
  public unperformedSongAtVenue(venueKey: string): ReleasedSong | null {
    this.load();
    return (
      this.data.discography.find((s) => s.concertVenueKey === venueKey && !s.concertDone) ?? null
    );
  }

  /** Builds the Lagos Top 10 Chart combining rival Afrobeats hits with the player's released songs */
  public topTenChart(): ChartEntry[] {
    this.load();
    const playerName = BackendService.getInstance().getData()?.username || 'You';
    const combined: Array<{
      artist: string;
      title: string;
      genre: string;
      streams: number;
      isPlayer: boolean;
      stars?: 1 | 2 | 3;
    }> = RIVAL_CHART_SONGS.map((r) => ({ ...r, isPlayer: false }));

    for (const s of this.data.discography) {
      combined.push({
        artist: playerName,
        title: s.title,
        genre: s.genre,
        streams: s.streams,
        isPlayer: true,
        stars: s.stars,
      });
    }
    combined.sort((a, b) => b.streams - a.streams);
    return combined.slice(0, 10).map((entry, idx) => ({
      rank: idx + 1,
      ...entry,
    }));
  }

  public async syncFromServer(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    const res = (await online.request('/studio')) as {
      ok: boolean;
      fame?: number;
      active?: ActiveStudioSession | null;
      discography?: ReleasedSong[];
      paidNow?: number;
      wallet?: { cash: number; bank: number };
    };
    if (!res.ok) return;
    if (res.wallet) BackendService.getInstance().applyServerWallet(res.wallet);
    this.load();
    if (typeof res.fame === 'number') this.data.fame = res.fame;
    this.data.active = res.active ?? null;
    if (Array.isArray(res.discography)) this.data.discography = res.discography;
    this.save();
    if (res.paidNow && res.paidNow > 0) {
      showGameToast(
        `🎵 Streaming royalties paid: ₦${res.paidNow.toLocaleString()} into your bank.`,
        'success',
        4000,
      );
    }
    this.changed();
  }

  /** Books a studio recording session at Naija Radio House (`radio-house`) */
  public async bookSession(
    trackId: string,
  ): Promise<{ ok: boolean; reason?: string; active?: ActiveStudioSession }> {
    this.load();
    const spec = this.trackFor(trackId);
    if (!spec) return { ok: false, reason: 'Unknown studio track.' };
    if (this.data.fame < spec.minFame) {
      return {
        ok: false,
        reason: `${spec.title} needs ${spec.minFame} Music Fame (you have ${this.data.fame}).`,
      };
    }
    if (this.data.active) {
      return {
        ok: false,
        reason: `Finish recording "${this.data.active.title}" at Naija Radio House first.`,
      };
    }

    const be = BackendService.getInstance();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/studio/book', { trackId: spec.id })) as {
        ok: boolean;
        reason?: string;
        active?: ActiveStudioSession | null;
        fame?: number;
        wallet?: { cash: number; bank: number };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Could not book studio booth.' };
      if (res.wallet) be.applyServerWallet(res.wallet);
      this.data.active = res.active ?? null;
      if (typeof res.fame === 'number') this.data.fame = res.fame;
      this.save();
      showGameToast(
        `🎙️ Studio B booked for "${spec.title}" with ${spec.producer}! Head to Naija Radio House to record.`,
        'success',
        4200,
      );
      this.changed();
      return { ok: true, active: this.data.active ?? undefined };
    }

    let paid = be.processTransaction({
      type: 'SHOP_PURCHASE',
      amount: spec.studioFee,
      description: `Studio B booking: ${spec.title} (${spec.producer})`,
      source: 'bank',
      funding: 'strict',
    });
    if (!paid.success) {
      paid = be.processTransaction({
        type: 'SHOP_PURCHASE',
        amount: spec.studioFee,
        description: `Studio B booking: ${spec.title} (${spec.producer})`,
        source: 'wallet',
        funding: 'strict',
      });
    }
    if (!paid.success) {
      return {
        ok: false,
        reason: `Booking Studio B for "${spec.title}" costs ₦${spec.studioFee.toLocaleString()}.`,
      };
    }

    const active: ActiveStudioSession = {
      trackId: spec.id,
      title: spec.title,
      genre: spec.genre,
      producer: spec.producer,
      label: spec.label,
      studioFee: spec.studioFee,
      advancePay: spec.advancePay,
      concertVenueKey: spec.concertVenueKey,
      concertVenueName: spec.concertVenueName,
      concertFee: spec.concertFee,
      bookedAt: Studio.now(),
    };
    this.data.active = active;
    this.save();
    Activity.emit({ kind: 'acted', id: `studio_book ${spec.id}` });
    showGameToast(
      `🎙️ Studio B booked for "${spec.title}" with ${spec.producer}! Head to Naija Radio House to record.`,
      'success',
      4200,
    );
    this.changed();
    return { ok: true, active };
  }

  /** Completes the 3-take vocal booth session at Naija Radio House, pays the master advance, and drops the song */
  public async completeRecording(
    trackId: string,
    rawStars: 1 | 2 | 3,
  ): Promise<{ ok: boolean; reason?: string; song?: ReleasedSong; fame?: number }> {
    this.load();
    const active = this.data.active;
    const spec = this.trackFor(trackId);
    if (!spec) return { ok: false, reason: 'Unknown studio track.' };
    if (!active || active.trackId !== spec.id) {
      return {
        ok: false,
        reason: `Book Studio B for "${spec.title}" on the Studio app first.`,
      };
    }

    const stars = Math.min(3, Math.max(1, Math.round(Number(rawStars) || 3))) as 1 | 2 | 3;
    const be = BackendService.getInstance();
    const online = OnlineAccount.get();

    if (online) {
      const res = (await online.request('/studio/record', { trackId: spec.id, stars })) as {
        ok: boolean;
        reason?: string;
        song?: ReleasedSong;
        fame?: number;
        active?: null;
        discography?: ReleasedSong[];
        wallet?: { cash: number; bank: number };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Could not master recording.' };
      if (res.wallet) be.applyServerWallet(res.wallet);
      this.data.active = null;
      if (typeof res.fame === 'number') this.data.fame = res.fame;
      if (Array.isArray(res.discography)) this.data.discography = res.discography;
      this.save();
      be.addSkillExp('charisma', 2);
      be.modifyNeed('fun', 22);
      Activity.emit({ kind: 'acted', id: `studio_record ${spec.id}` });
      this.changed();
      return { ok: true, song: res.song, fame: this.data.fame };
    }

    const bonus =
      stars === 3
        ? Math.round((spec.advancePay * 0.3) / 50) * 50
        : stars === 2
          ? Math.round((spec.advancePay * 0.1) / 50) * 50
          : 0;
    const dailyRoyalty = Math.round((spec.dailyRoyalty * (1 + (stars - 1) * 0.25)) / 100) * 100;
    const fameEarned = spec.fameGain + (stars - 1) * 5;
    const streams = stars * 180_000 + fameEarned * 4_500;
    const releasedAt = Studio.now();

    const song: ReleasedSong = {
      id: this.data.nextId++,
      trackId: spec.id,
      title: spec.title,
      genre: spec.genre,
      producer: spec.producer,
      label: spec.label,
      stars,
      advancePay: spec.advancePay,
      bonus,
      dailyRoyalty,
      daysPaid: 0,
      totalDays: STUDIO_ROYALTY_DAYS,
      totalRoyalties: 0,
      streams,
      concertVenueKey: spec.concertVenueKey,
      concertVenueName: spec.concertVenueName,
      concertFee: spec.concertFee,
      concertDone: false,
      fameEarned,
      releasedAt,
    };

    this.data.active = null;
    this.data.fame += fameEarned;
    this.data.discography.unshift(song);
    this.save();

    const totalUpfront = spec.advancePay + bonus;
    be.processTransaction({
      type: 'BONUS',
      amount: totalUpfront,
      description: `Studio master advance: ${spec.title} (${stars}★)`,
      source: 'bank',
    });
    be.addSkillExp('charisma', 2);
    be.modifyNeed('fun', 22);
    const pData = be.getData();
    pData.stats.streetCred = (pData.stats.streetCred ?? 0) + fameEarned;
    Activity.emit({ kind: 'acted', id: `studio_record ${spec.id}` });
    this.changed();
    return { ok: true, song, fame: this.data.fame };
  }

  /** Performs the live headline release concert for a recorded song at its designated Lagos venue */
  public async performConcert(
    trackId: string,
    rawStars: 1 | 2 | 3,
  ): Promise<{ ok: boolean; reason?: string; paid?: number; song?: ReleasedSong; fame?: number }> {
    this.load();
    const spec = this.trackFor(trackId);
    if (!spec) return { ok: false, reason: 'Unknown studio track.' };
    const song = this.data.discography.find((s) => s.trackId === spec.id);
    if (!song) {
      return {
        ok: false,
        reason: 'Record and release that track at Naija Radio House before headlining a concert.',
      };
    }
    if (song.concertDone) {
      return {
        ok: false,
        reason: `You have already performed the headline release show for "${spec.title}".`,
      };
    }

    const stars = Math.min(3, Math.max(1, Math.round(Number(rawStars) || 3))) as 1 | 2 | 3;
    const be = BackendService.getInstance();
    const online = OnlineAccount.get();

    if (online) {
      const res = (await online.request('/studio/concert', { trackId: spec.id, stars })) as {
        ok: boolean;
        reason?: string;
        paid?: number;
        song?: ReleasedSong;
        fame?: number;
        discography?: ReleasedSong[];
        wallet?: { cash: number; bank: number };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Could not complete headline concert.' };
      if (res.wallet) be.applyServerWallet(res.wallet);
      if (typeof res.fame === 'number') this.data.fame = res.fame;
      if (Array.isArray(res.discography)) this.data.discography = res.discography;
      this.save();
      be.addSkillExp('charisma', 3);
      be.modifyNeed('fun', 28);
      be.modifyNeed('social', 20);
      Activity.emit({ kind: 'acted', id: `studio_concert ${spec.id}` });
      this.changed();
      return { ok: true, paid: res.paid, song: res.song, fame: this.data.fame };
    }

    const bonus =
      stars === 3
        ? Math.round((spec.concertFee * 0.25) / 50) * 50
        : stars === 2
          ? Math.round((spec.concertFee * 0.1) / 50) * 50
          : 0;
    const totalPay = spec.concertFee + bonus;
    const extraFame = 15 + (stars - 1) * 5;
    song.concertDone = true;
    song.streams += 120_000 * stars;
    song.fameEarned += extraFame;
    this.data.fame += extraFame;
    this.save();

    be.processTransaction({
      type: 'BONUS',
      amount: totalPay,
      description: `Headline concert: ${spec.title} live at ${spec.concertVenueName}`,
      source: 'bank',
    });
    be.addSkillExp('charisma', 3);
    be.modifyNeed('fun', 28);
    be.modifyNeed('social', 20);
    const pData = be.getData();
    pData.stats.streetCred = (pData.stats.streetCred ?? 0) + extraFame;
    Activity.emit({ kind: 'acted', id: `studio_concert ${spec.id}` });
    this.changed();
    return { ok: true, paid: totalPay, song, fame: this.data.fame };
  }

  /** Settles any newly elapsed real days of streaming royalties (offline) */
  private checkRoyaltiesOffline(): number {
    this.load();
    const now = Studio.now();
    let totalPaid = 0;
    const be = BackendService.getInstance();
    for (const song of this.data.discography) {
      if (song.daysPaid >= STUDIO_ROYALTY_DAYS) continue;
      const elapsed = Math.min(
        STUDIO_ROYALTY_DAYS,
        Math.max(0, Math.floor((now - song.releasedAt) / STUDIO_DAY_MS)),
      );
      if (elapsed <= song.daysPaid) continue;
      const newDays = elapsed - song.daysPaid;
      const payout = newDays * song.dailyRoyalty;
      const fromDay = song.daysPaid + 1;
      song.daysPaid = elapsed;
      song.totalRoyalties += payout;
      song.streams += newDays * 45_000;
      totalPaid += payout;
      be.processTransaction({
        type: 'BONUS',
        amount: payout,
        description: `Studio streaming royalties: ${song.title} (Day ${fromDay}${newDays > 1 ? `–${elapsed}` : ''})`,
        source: 'bank',
      });
    }
    if (totalPaid > 0) {
      this.save();
      showGameToast(
        `🎵 Streaming royalties paid: ₦${totalPaid.toLocaleString()} into your bank.`,
        'success',
        4000,
      );
      this.changed();
    }
    return totalPaid;
  }

  /** Checks and pays any matured real-day streaming royalties (both offline and online) */
  public async checkRoyalties(): Promise<number> {
    this.load();
    const online = OnlineAccount.get();
    if (!online) return this.checkRoyaltiesOffline();
    const res = (await online.request('/studio/collect', {})) as {
      ok: boolean;
      fame?: number;
      active?: ActiveStudioSession | null;
      discography?: ReleasedSong[];
      paidNow?: number;
      wallet?: { cash: number; bank: number };
    };
    if (!res.ok) return 0;
    if (res.wallet) BackendService.getInstance().applyServerWallet(res.wallet);
    if (typeof res.fame === 'number') this.data.fame = res.fame;
    if (Array.isArray(res.discography)) this.data.discography = res.discography;
    this.save();
    if (res.paidNow && res.paidNow > 0) {
      showGameToast(
        `🎵 Streaming royalties paid: ₦${res.paidNow.toLocaleString()} into your bank.`,
        'success',
        4000,
      );
      this.changed();
    }
    return res.paidNow ?? 0;
  }

  public tick(delta: number): void {
    this.checkAccum += delta;
    if (this.checkAccum < 1.0) return;
    this.checkAccum = 0;
    if (!OnlineAccount.get()) {
      this.checkRoyaltiesOffline();
    }
  }

  private changed(): void {
    this.onChange?.();
  }
}

const CONCERT_STAGE_SPOTS: Record<
  string,
  { mic: [number, number]; manager: [number, number] }
> = {
  'freedom-park': { mic: [3.2, -4.2], manager: [4.5, -4.2] },
  'afrika-shrine': { mic: [3.5, -5.0], manager: [4.8, -5.0] },
  'ivory-rooftop': { mic: [4.2, -3.5], manager: [5.4, -3.5] },
  'eko-grand-hotel': { mic: [-4.2, -3.5], manager: [-5.4, -3.5] },
};

/**
 * Attaches the 3D Afrobeats Studio B vocal booth & producer mixing desk inside `radio-house`,
 * and attaches the 3D Headline Release Concert stage rig inside the four concert venues.
 */
export function attachStudio(room: PlaceInterior, key: string): void {
  if (key === 'radio-house') {
    attachRadioHouseStudioBooth(room);
    return;
  }
  const stageSpot = CONCERT_STAGE_SPOTS[key];
  if (stageSpot) {
    attachVenueHeadlineStage(room, key, stageSpot);
  }
}

function attachRadioHouseStudioBooth(room: PlaceInterior): void {
  const boothGroup = new THREE.Group();
  boothGroup.name = 'studio-booth-radio-house';

  const b = new Builder();
  // Soundproof booth platform & acoustic enclosure on the east side (x=5.6, z=1.5)
  b.box(0x1e1b4b, 3.2, 0.08, 3.0, 5.8, 0, 1.5)
    // Back acoustic wall & side wall
    .box(0x18181b, 0.14, 2.6, 3.0, 7.3, 0.08, 1.5)
    .box(0x18181b, 3.2, 2.6, 0.14, 5.8, 0.08, 0.05)
    // Acoustic gold/purple foam pyramids on back wall
    .box(0x7c3aed, 0.06, 0.55, 0.55, 7.2, 1.1, 0.7)
    .box(0xfacc15, 0.06, 0.55, 0.55, 7.2, 1.1, 1.5)
    .box(0x7c3aed, 0.06, 0.55, 0.55, 7.2, 1.1, 2.3)
    .box(0xfacc15, 0.06, 0.55, 0.55, 7.2, 1.8, 1.1)
    .box(0x7c3aed, 0.06, 0.55, 0.55, 7.2, 1.8, 1.9)
    // Cyan studio glass window separating vocal booth from producer desk
    .box(0x38bdf8, 1.8, 1.3, 0.06, 5.6, 0.95, 2.95, { glow: true })
    .box(0x18181b, 2.0, 0.9, 0.14, 5.6, 0.08, 2.95)
    // Gold condenser microphone on boom stand at [6.3, 1.5]
    .cylinder(0x374151, 0.24, 0.05, 6.3, 0.08, 1.5, { sides: 12 })
    .cylinder(0xd4af37, 0.03, 1.48, 6.3, 0.08, 1.5, { sides: 8 })
    .cylinder(0xfacc15, 0.07, 0.22, 6.22, 1.55, 1.5, { sides: 12 })
    .box(0x111827, 0.03, 0.18, 0.18, 6.08, 1.55, 1.5) // pop filter
    // Glowing REC · STUDIO B indicator
    .box(0xef4444, 0.65, 0.24, 0.08, 5.6, 2.42, 2.95, { glow: true })
    // Producer multi-channel mixing console at [5.4, 3.8]
    .box(0x18181b, 2.2, 0.82, 0.95, 5.4, 0, 3.85)
    .box(0x27272a, 2.0, 0.08, 0.8, 5.4, 0.82, 3.85)
    .box(0x22c55e, 0.45, 0.03, 0.28, 4.9, 0.87, 3.8, { glow: true })
    .box(0xa855f7, 0.45, 0.03, 0.28, 5.4, 0.87, 3.8, { glow: true })
    .box(0x38bdf8, 0.45, 0.03, 0.28, 5.9, 0.87, 3.8, { glow: true })
    // Studio monitor speakers with gold woofer cones
    .box(0x111827, 0.34, 0.48, 0.3, 4.45, 0.86, 3.65)
    .cylinder(0xfacc15, 0.09, 0.02, 4.45, 1.05, 3.5, { pitch: Math.PI / 2, sides: 12 })
    .box(0x111827, 0.34, 0.48, 0.3, 6.35, 0.86, 3.65)
    .cylinder(0xfacc15, 0.09, 0.02, 6.35, 1.05, 3.5, { pitch: Math.PI / 2, sides: 12 });

  boothGroup.add(b.build('studio-booth-rig', { roughness: 0.45 }));

  const sign = signBoard(
    ['🎙️ AFROBEATS STUDIO B', 'Kalakuta Sound Lab · Vocal Booth'],
    2.3,
    0.52,
    '#4c1d95',
    '#fef08a',
  );
  sign.position.set(5.6, 2.85, 2.95);
  boothGroup.add(sign);

  // Sound engineer / producer figure standing at the mixing console
  const producerFig = new Figure(
    boothGroup,
    'studio-producer-fig',
    'Sarz-Beatz',
    {
      gender: 'male',
      username: 'Sarz-Beatz',
      outfitColor: 0x7c3aed,
      outfit: 'casual_tee',
      hairstyle: 'dreads',
    },
    [5.4, 4.65],
    Math.PI,
  );

  // Floating 3D glowing soundwave bars inside the booth while recording
  const waveGroup = new THREE.Group();
  waveGroup.name = 'studio-soundwaves-radio-house';
  const waveBars: THREE.Mesh[] = [];
  const waveMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
  const goldMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  for (let i = 0; i < 8; i++) {
    const geom = new THREE.BoxGeometry(0.06, 0.32, 0.06);
    const bar = new THREE.Mesh(geom, i % 2 === 0 ? waveMat : goldMat);
    bar.position.set(5.6, 1.55, 0.9 + i * 0.18);
    waveGroup.add(bar);
    waveBars.push(bar);
  }
  boothGroup.add(waveGroup);

  room.group.add(boothGroup);

  let pulseTime = 0;
  let recording = false;

  room.ticks.push((delta) => {
    producerFig.tick(delta);
    pulseTime += delta * (recording ? 7.5 : 2.2);
    for (let i = 0; i < waveBars.length; i++) {
      const scaleY = recording
        ? 0.6 + Math.abs(Math.sin(pulseTime + i * 0.7)) * 1.8
        : 0.35 + Math.abs(Math.sin(pulseTime + i * 0.5)) * 0.45;
      waveBars[i].scale.y = scaleY;
    }
  });

  const runBoothSession = (host: PlaceHost) => {
    if (recording) return;
    const st = Studio.get();
    const active = st.activeSession();
    if (!active) {
      host.ask({
        who: 'Sarz-Beatz',
        role: 'Producer · Studio B',
        text: 'Welcome to Studio B! Book a beat on the Studio app to step into the vocal booth, record 3 takes, and drop a record on the Lagos Top 10 Chart.',
        choices: [
          {
            label: '🎙️ Open Studio app to book a beat',
            note: 'From ₦25,000 · 5 days of streaming royalties',
            pick: () => {
              PlaceOpeners.open('app:studio', host);
            },
          },
          { label: 'Maybe later', pick: () => undefined },
        ],
      });
      return;
    }

    const spec = st.trackFor(active.trackId) ?? STUDIO_TRACKS[0];
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    recording = true;

    const skill = ShiftSkill.get();
    skill.begin(`Record: ${spec.title}`, 3);
    let sweep: { end(): void } | null = null;
    let completedTakes = 0;

    const seq = new Sequence(`studio_record ${spec.id}`, [actor]);
    seq.maxSeconds = 90;
    seq.add(
      steps.walk(actor, room.at(5.5, 1.5), { speed: 2.8, ifStuck: 'snap' }),
      steps.face(actor, room.at(6.3, 1.5)),
      steps.call('booth-intro', () => {
        producerFig.pose('stand', 'wave');
        producerFig.say(
          `Mic check! "${spec.title}" with ${spec.producer} — levels are hot, let's go!`,
          2.4,
        );
      }),
    );

    const poses: Array<'talk' | 'wave' | 'reach'> = ['talk', 'wave', 'reach'];
    const producerCues = [
      'Clean take! That melody is pure gold!',
      'Log drum pocket is locked — keep that energy!',
      'Print the master! That is going straight to #1 in Lagos!',
    ];

    spec.takes.forEach((line, idx) => {
      seq.add(
        steps.call(`studio-take-${idx + 1}`, () => {
          sweep = skill.round();
          host.say(`🎙️ Take ${idx + 1}/3: "${line}"`, 'info');
        }),
        steps.animate(actor, { arms: poses[idx % poses.length], legs: 'stand' }, 2.4, [
          {
            at: 0.5,
            run: () => {
              producerFig.pose('stand', idx === 2 ? 'wave' : 'reach');
              producerFig.say(producerCues[idx], 1.8);
            },
          },
          {
            at: 0.95,
            run: () => {
              sweep?.end();
              sweep = null;
              completedTakes = idx + 1;
            },
          },
        ]),
        steps.animate(actor, { arms: 'rest', legs: 'stand' }, 0.1),
      );
    });

    seq.add(
      steps.settle(`master ${spec.id}`, async () => {
        const rated = skill.finish(spec.advancePay);
        const done = await st.completeRecording(spec.id, rated.stars);
        if (!done.ok || !done.song) {
          host.say(done.reason ?? 'Could not finish mastering the track.', 'warning');
          return false;
        }
        const s = done.song;
        const stars = '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars);
        const paid = s.advancePay + s.bonus;
        host.say(
          `🎵 ${stars} "${s.title}" is out now! ${s.label} paid ₦${paid.toLocaleString()} master advance. Music Fame +${s.fameEarned} · Streaming royalties: ₦${s.dailyRoyalty.toLocaleString()}/day for 5 days · Headline show unlocked at ${s.concertVenueName}!`,
          'success',
        );
        return true;
      }),
    );

    seq.onEnd((reason) => {
      sweep?.end();
      sweep = null;
      if (reason !== 'done') {
        skill.finish(0);
        if (completedTakes > 0) {
          host.say(
            `You stepped out of Studio B before mastering "${spec.title}". Step back in when ready.`,
            'warning',
          );
        }
      }
      producerFig.pose('stand', 'rest');
      recording = false;
    });

    if (!host.director.run(seq)) {
      skill.finish(0);
      recording = false;
    }
  };

  room.addCard({
    id: 'studio_vocal_booth',
    name: '🎙️ Studio B — Afrobeats Vocal Booth',
    description: 'Kalakuta Sound Lab · Record 3 vocal takes with Sarz-Beatz & release onto the Lagos Top 10.',
    at: [5.5, 1.5],
    stand: [5.3, 1.5],
    label: () => {
      const active = Studio.get().activeSession();
      if (active) {
        return `🎙️ Record "${active.title}" (${active.producer}) · +₦${active.advancePay.toLocaleString()} advance`;
      }
      return '🎙️ Studio B Vocal Booth · Book on Studio App';
    },
    run: runBoothSession,
  });
}

function attachVenueHeadlineStage(
  room: PlaceInterior,
  key: string,
  spot: { mic: [number, number]; manager: [number, number] },
): void {
  const stageGroup = new THREE.Group();
  stageGroup.name = `studio-concert-${key}`;

  const [mx, mz] = spot.mic;
  const [tx, tz] = spot.manager;

  const b = new Builder();
  // Gold stage monitor wedges & wireless performance mic stand
  b.box(0x18181b, 0.52, 0.26, 0.36, mx - 0.45, 0, mz - 0.35)
    .box(0xfacc15, 0.44, 0.04, 0.28, mx - 0.45, 0.26, mz - 0.35)
    .box(0x18181b, 0.52, 0.26, 0.36, mx + 0.45, 0, mz - 0.35)
    .box(0xfacc15, 0.44, 0.04, 0.28, mx + 0.45, 0.26, mz - 0.35)
    .cylinder(0xd4af37, 0.22, 0.04, mx, 0, mz, { sides: 12 })
    .cylinder(0xfacc15, 0.025, 1.45, mx, 0, mz, { sides: 8 })
    .cylinder(0xa855f7, 0.055, 0.18, mx, 1.46, mz, { sides: 10 });
  stageGroup.add(b.build(`studio-stage-rig-${key}`, { roughness: 0.45 }));

  const faceMic = Math.atan2(mx - tx, mz - tz);
  const managerFig = new Figure(
    stageGroup,
    `studio-mgr-${key}`,
    'Tour Manager',
    {
      gender: 'female',
      username: 'Tour Manager',
      outfitColor: 0x9333ea,
      outfit: 'casual_blouse',
      hairstyle: 'braids',
    },
    [tx, tz],
    faceMic,
  );

  room.group.add(stageGroup);
  room.ticks.push((delta) => {
    managerFig.tick(delta);
  });

  let performing = false;

  const runConcert = (host: PlaceHost) => {
    if (performing) return;
    const st = Studio.get();
    const song = st.unperformedSongAtVenue(key);
    if (!song) {
      host.ask({
        who: 'Tour Manager',
        role: 'Headline Shows · Studio App',
        text: 'Record and release a track at Naija Radio House Whose concert venue is here, then step up to this stage mic to perform your headline release show!',
        choices: [
          {
            label: '🎵 Open Studio app',
            note: 'View beats, Lagos Top 10 & tour dates',
            pick: () => {
              PlaceOpeners.open('app:studio', host);
            },
          },
          { label: 'Close', pick: () => undefined },
        ],
      });
      return;
    }

    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    performing = true;

    const skill = ShiftSkill.get();
    skill.begin(`Live Show: ${song.title}`, 3);
    let sweep: { end(): void } | null = null;
    let completedRounds = 0;

    const seq = new Sequence(`studio_concert ${song.trackId}`, [actor]);
    seq.maxSeconds = 90;
    seq.add(
      steps.walk(actor, room.at(mx, mz), { speed: 2.8, ifStuck: 'snap' }),
      steps.face(actor, room.at(mx, mz + 2.0)),
      steps.call('concert-intro', () => {
        managerFig.pose('stand', 'wave');
        managerFig.say(
          `Lagos make some noise! Performing "${song.title}" live on stage!`,
          2.4,
        );
      }),
    );

    const crowdCues = [
      'The front row knows every lyric — keep the energy high!',
      'Phone flashlights are up across the whole hall!',
      'Encore! You just shut down the stage!',
    ];

    for (let idx = 0; idx < 3; idx++) {
      seq.add(
        steps.call(`concert-round-${idx + 1}`, () => {
          sweep = skill.round();
          host.say(
            `🎤 Live Set ${idx + 1}/3: Performing "${song.title}" for the crowd!`,
            'info',
          );
        }),
        steps.animate(actor, { arms: idx % 2 === 0 ? 'wave' : 'talk', legs: 'dance' }, 2.4, [
          {
            at: 0.5,
            run: () => {
              managerFig.pose('stand', 'wave');
              managerFig.say(crowdCues[idx], 1.8);
            },
          },
          {
            at: 0.95,
            run: () => {
              sweep?.end();
              sweep = null;
              completedRounds = idx + 1;
            },
          },
        ]),
        steps.animate(actor, { arms: 'rest', legs: 'stand' }, 0.1),
      );
    }

    seq.add(
      steps.settle(`concert-pay ${song.trackId}`, async () => {
        const rated = skill.finish(song.concertFee);
        const done = await st.performConcert(song.trackId, rated.stars);
        if (!done.ok) {
          host.say(done.reason ?? 'Could not settle concert performance.', 'warning');
          return false;
        }
        const paid = done.paid ?? song.concertFee;
        host.say(
          `🎤 Headline Show Complete! You performed "${song.title}" live at ${song.concertVenueName} and earned ₦${paid.toLocaleString()} (+${(120_000 * rated.stars).toLocaleString()} streams on the Lagos Top 10 Chart)!`,
          'success',
        );
        return true;
      }),
    );

    seq.onEnd((reason) => {
      sweep?.end();
      sweep = null;
      if (reason !== 'done') {
        skill.finish(0);
        if (completedRounds > 0) {
          host.say('You left the stage before finishing your headline set.', 'warning');
        }
      }
      managerFig.pose('stand', 'rest');
      performing = false;
    });

    if (!host.director.run(seq)) {
      skill.finish(0);
      performing = false;
    }
  };

  room.addCard({
    id: `studio_concert_${key}`,
    name: '🎤 Headline Concert Stage',
    description: 'Perform your released Studio hit live on stage for headline pay and chart streams.',
    at: [mx, mz],
    stand: [mx, mz + 0.6],
    label: () => {
      const song = Studio.get().unperformedSongAtVenue(key);
      if (song) {
        return `🎤 Headline Live Show: "${song.title}" · +₦${song.concertFee.toLocaleString()}`;
      }
      return '🎤 Headline Concert Stage · Record on Studio App';
    },
    run: runConcert,
  });
}
