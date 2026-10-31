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
 * Nollywood: casting calls for made-up Lagos productions, a three-take scene audition scored
 * like `ShiftSkill`, a location shoot on a real 3D film set inside the city's venues, the film's
 * release with box-office takings paid over the next five real days, and the player's filmography
 * and rising Fame.
 */

export const RELEASE_DAYS = 5;
export const DAY_MS = 86_400_000;
export type SweepGrade = 'good' | 'ok' | 'miss';

export interface CastingCall {
  id: string;
  title: string;
  genre: string;
  director: string;
  directorGender: 'male' | 'female';
  directorOutfit: number;
  studio: string;
  role: string;
  synopsis: string;
  venueKey: string;
  venueName: string;
  minFame: number;
  shootPay: number;
  dailyRoyalty: number;
  fameGain: number;
  lines: [string, string, string];
  setSpot: {
    mark: [number, number];
    director: [number, number];
    camera: [number, number];
    light: [number, number];
  };
}

export const CASTING_CALLS: readonly CastingCall[] = [
  {
    id: 'blood-on-the-lagoon',
    title: 'Blood on the Lagoon',
    genre: 'Crime thriller',
    director: 'Kunle Adebayo',
    directorGender: 'male',
    directorOutfit: 0x7c2d12,
    studio: 'Surulere Pictures',
    role: 'Inspector Tunde',
    synopsis: 'A missing shipping container pulls a sharp Marina detective into a high-rise conspiracy.',
    venueKey: 'marina-towers',
    venueName: 'Marina Towers',
    minFame: 0,
    shootPay: 45_000,
    dailyRoyalty: 18_000,
    fameGain: 15,
    lines: [
      'Drop the briefcase on the marble floor — slowly!',
      'You think Marina money can buy my badge?',
      'Cuff him before the ferry leaves the jetty!',
    ],
    setSpot: {
      mark: [4.5, 2.5],
      director: [2.2, 2.5],
      camera: [2.2, 3.6],
      light: [3.2, 1.2],
    },
  },
  {
    id: 'royal-wedding-in-lekki',
    title: 'Royal Wedding in Lekki',
    genre: 'Romantic comedy',
    director: 'Bisi Olatunji',
    directorGender: 'female',
    directorOutfit: 0xbe185d,
    studio: 'Eko Reel Studios',
    role: 'Prince Adewale',
    synopsis: 'Three families, two wrong brides, and one five-star hotel lobby on wedding morning.',
    venueKey: 'eko-grand-hotel',
    venueName: 'Eko Grand Hotel',
    minFame: 0,
    shootPay: 60_000,
    dailyRoyalty: 24_000,
    fameGain: 20,
    lines: [
      'Mama, I cannot marry someone I met on Tuesday!',
      'Wait — is that her standing by the chandelier?',
      'Stop the talking drums, I have made my choice!',
    ],
    setSpot: {
      mark: [4.8, 1.5],
      director: [2.5, 1.5],
      camera: [2.5, 2.6],
      light: [3.6, 0.2],
    },
  },
  {
    id: 'king-of-balogun',
    title: 'King of Balogun',
    genre: 'Market drama',
    director: 'Chukwudi Nwachukwu',
    directorGender: 'male',
    directorOutfit: 0x1d4ed8,
    studio: 'Idumota Film Works',
    role: 'Chief Emeka',
    synopsis: 'Rival textile dynasties clash over the biggest lace shipment ever to dock on Lagos Island.',
    venueKey: 'balogun-market',
    venueName: 'Balogun Market',
    minFame: 0,
    shootPay: 50_000,
    dailyRoyalty: 20_000,
    fameGain: 18,
    lines: [
      'Not one yard of lace leaves this lane without my stamp!',
      'My father built this stall with twenty naira and sweat.',
      'Open the gates — let the whole market hear the truth!',
    ],
    setSpot: {
      mark: [-1.5, 6.5],
      director: [-3.8, 6.5],
      camera: [-3.8, 7.6],
      light: [-2.6, 5.2],
    },
  },
  {
    id: 'midnight-at-the-shrine',
    title: 'Midnight at the Shrine',
    genre: 'Musical drama',
    director: 'Sade Kuti-Bello',
    directorGender: 'female',
    directorOutfit: 0xd97706,
    studio: 'Kalakuta Motion',
    role: 'Dapo the Saxophonist',
    synopsis: 'A young horn player risks everything for one legendary Thursday night solo in Ikeja.',
    venueKey: 'afrika-shrine',
    venueName: 'New Afrika Shrine',
    minFame: 15,
    shootPay: 75_000,
    dailyRoyalty: 30_000,
    fameGain: 25,
    lines: [
      'When the horn cries at midnight, Ikeja listens.',
      'They took my saxophone, not my breath!',
      'One last solo for the people in the back!',
    ],
    setSpot: {
      mark: [-3.0, 2.5],
      director: [-5.3, 2.5],
      camera: [-5.3, 3.6],
      light: [-4.1, 1.2],
    },
  },
  {
    id: 'island-heist',
    title: 'Island Heist',
    genre: 'Action thriller',
    director: 'Tobi Bankole',
    directorGender: 'male',
    directorOutfit: 0x0f172a,
    studio: 'Third Mainland Films',
    role: 'Zero',
    synopsis: 'Ten floors above Victoria Island, a black-tie cocktail night masks the boldest vault job of the decade.',
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    minFame: 30,
    shootPay: 100_000,
    dailyRoyalty: 40_000,
    fameGain: 30,
    lines: [
      'Ten floors up, one glass elevator, ninety seconds.',
      'Cut the rooftop lights when the champagne toast begins.',
      'See you on the lagoon, gentlemen!',
    ],
    setSpot: {
      mark: [0.5, 3.5],
      director: [-1.8, 3.5],
      camera: [-1.8, 4.6],
      light: [-0.6, 2.2],
    },
  },
];

export interface ActiveRole {
  filmId: string;
  title: string;
  role: string;
  director: string;
  studio: string;
  venueKey: string;
  venueName: string;
  auditionStars: 1 | 2 | 3;
  shootPay: number;
  castAt: number;
}

export interface ReleasedFilm {
  id: number;
  filmId: string;
  title: string;
  genre: string;
  role: string;
  director: string;
  studio: string;
  venueKey: string;
  venueName: string;
  auditionStars: 1 | 2 | 3;
  shootStars: 1 | 2 | 3;
  stars: 1 | 2 | 3;
  shootPay: number;
  tip: number;
  dailyTaking: number;
  daysPaid: number;
  totalDays: number;
  totalTakings: number;
  fameEarned: number;
  releasedAt: number;
}

export interface AuditionSession {
  filmId: string;
  title: string;
  role: string;
  director: string;
  lines: [string, string, string];
  takeIndex: number;
  hits: SweepGrade[];
  startedAt: number;
  pinAt: number;
}

interface SavedNollywood {
  fame: number;
  active: ActiveRole | null;
  filmography: ReleasedFilm[];
  nextId: number;
}

/** Green sweet-spot and amber bounds, matching `src/jobs/ShiftSkill.ts` */
const SWEET_FROM = 0.56;
const SWEET_TO = 0.78;
const OK_FROM = 0.42;
const OK_TO = 0.88;

export class Nollywood {
  private static instance: Nollywood | null = null;
  public static get(): Nollywood {
    return (Nollywood.instance ??= new Nollywood());
  }

  /** Clock hook so tests can advance real days without waiting 24 hours */
  public static now: () => number = () => Date.now();

  public onChange: (() => void) | null = null;
  private loadedFor = '';
  private data: SavedNollywood = { fame: 0, active: null, filmography: [], nextId: 1 };
  private auditioning: {
    call: CastingCall;
    hits: SweepGrade[];
    takeStartedAt: number;
  } | null = null;
  private lastResult: {
    filmId: string;
    title: string;
    role: string;
    venueName: string;
    stars: 1 | 2 | 3;
    score: number;
    hits: SweepGrade[];
  } | null = null;
  private checkAccum = 0;

  private key(): string {
    return `nl_nollywood_v1:${Activity.player()}`;
  }

  private load(): void {
    if (OnlineAccount.get() !== null) return;
    const k = this.key();
    if (this.loadedFor === k) return;
    this.loadedFor = k;
    try {
      const raw = JSON.parse(localStorage.getItem(k) || 'null');
      if (raw && typeof raw === 'object') {
        this.data = {
          fame: Number(raw.fame) || 0,
          active: raw.active ?? null,
          filmography: Array.isArray(raw.filmography) ? raw.filmography : [],
          nextId: Number(raw.nextId) || 1,
        };
        return;
      }
    } catch {
      // ignore malformed storage
    }
    this.data = { fame: 0, active: null, filmography: [], nextId: 1 };
  }

  private save(): void {
    if (OnlineAccount.get() !== null) return;
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.data));
    } catch {
      // private window
    }
  }

  public calls(): readonly CastingCall[] {
    return CASTING_CALLS;
  }

  public callFor(filmId: string): CastingCall | null {
    return CASTING_CALLS.find((c) => c.id === filmId) ?? null;
  }

  public callAtVenue(venueKey: string): CastingCall | null {
    return CASTING_CALLS.find((c) => c.venueKey === venueKey) ?? null;
  }

  public fame(): number {
    this.load();
    return this.data.fame;
  }

  public fameTitle(): string {
    const f = this.fame();
    if (f >= 80) return 'Nollywood Legend';
    if (f >= 40) return 'Lead Star';
    if (f >= 15) return 'Rising Actor';
    return 'New Face';
  }

  public activeRole(): ActiveRole | null {
    this.load();
    return this.data.active ? { ...this.data.active } : null;
  }

  public filmography(): ReleasedFilm[] {
    this.load();
    return this.data.filmography.map((f) => ({ ...f }));
  }

  public lastAuditionResult() {
    return this.lastResult;
  }

  /** Live state of an in-progress 3-take scene audition */
  public auditionState(): AuditionSession | null {
    if (!this.auditioning) return null;
    const { call, hits, takeStartedAt } = this.auditioning;
    const elapsedSec = Math.max(0, (performance.now() - takeStartedAt) / 1000);
    // Starts at 0.64 (inside the green sweet spot 0.56..0.78) and sweeps back and forth like ShiftSkill
    const phase = (0.64 + elapsedSec * 0.85) % 2;
    const pinAt = phase <= 1 ? phase : 2 - phase;
    return {
      filmId: call.id,
      title: call.title,
      role: call.role,
      director: call.director,
      lines: call.lines,
      takeIndex: hits.length,
      hits: [...hits],
      startedAt: takeStartedAt,
      pinAt,
    };
  }

  /** Syncs with the server when online and settles any matured daily box-office takings */
  public async sync(): Promise<void> {
    this.load();
    const online = OnlineAccount.get();
    if (!online) {
      this.checkTakingsOffline();
      return;
    }
    const res = (await online.request('/nollywood')) as {
      ok: boolean;
      fame?: number;
      active?: ActiveRole | null;
      filmography?: ReleasedFilm[];
      paidNow?: number;
      wallet?: { cash: number; bank: number };
    };
    if (!res.ok) return;
    if (res.wallet) BackendService.getInstance().applyServerWallet(res.wallet);
    this.data.fame = res.fame ?? this.data.fame;
    this.data.active = res.active ?? null;
    if (Array.isArray(res.filmography)) this.data.filmography = res.filmography;
    this.save();
    if (res.paidNow && res.paidNow > 0) {
      showGameToast(`🎬 Nollywood royalties paid: ₦${res.paidNow.toLocaleString()} into your bank.`, 'success', 4000);
    }
    this.changed();
  }

  /** Starts a 3-take scene test audition for a casting call */
  public startAudition(filmId: string): { ok: boolean; reason?: string } {
    this.load();
    const call = this.callFor(filmId);
    if (!call) return { ok: false, reason: 'That casting call is not available.' };
    if (this.data.fame < call.minFame) {
      return { ok: false, reason: `${call.title} requires ${call.minFame} Fame (you have ${this.data.fame}).` };
    }
    if (this.data.active && this.data.active.filmId !== filmId) {
      return {
        ok: false,
        reason: `You are already cast in ${this.data.active.title}. Shoot your scene at ${this.data.active.venueName} first.`,
      };
    }
    this.lastResult = null;
    this.auditioning = {
      call,
      hits: [],
      takeStartedAt: performance.now(),
    };
    this.changed();
    return { ok: true };
  }

  public cancelAudition(): void {
    if (!this.auditioning) return;
    this.auditioning = null;
    this.changed();
  }

  /** Delivers the current take's line in the scene test, scoring it like `ShiftSkill` */
  public async deliverLine(forcedGrade?: SweepGrade): Promise<{
    ok: boolean;
    done: boolean;
    grade?: SweepGrade;
    stars?: 1 | 2 | 3;
    active?: ActiveRole | null;
    reason?: string;
  }> {
    const state = this.auditionState();
    if (!this.auditioning || !state) return { ok: false, done: false, reason: 'No audition is running.' };

    const pin = state.pinAt;
    const grade: SweepGrade =
      forcedGrade ??
      (pin >= SWEET_FROM && pin <= SWEET_TO ? 'good' : pin >= OK_FROM && pin <= OK_TO ? 'ok' : 'miss');

    this.auditioning.hits.push(grade);

    if (this.auditioning.hits.length < 3) {
      this.auditioning.takeStartedAt = performance.now();
      this.changed();
      return { ok: true, done: false, grade };
    }

    // All 3 takes completed: score identically to ShiftSkill.ts
    const hits = [...this.auditioning.hits];
    const call = this.auditioning.call;
    const score = hits.reduce((s, h) => s + (h === 'good' ? 2 : h === 'ok' ? 1 : 0), 0);
    const stars: 1 | 2 | 3 = score >= 5 ? 3 : score >= 3 ? 2 : 1;
    this.auditioning = null;

    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/nollywood/audition', { filmId: call.id, stars })) as {
        ok: boolean;
        reason?: string;
        active?: ActiveRole | null;
        fame?: number;
      };
      if (!res.ok) {
        this.changed();
        return { ok: false, done: true, reason: res.reason ?? 'Could not record audition.' };
      }
      this.data.active = res.active ?? null;
      if (typeof res.fame === 'number') this.data.fame = res.fame;
    } else {
      this.data.active = {
        filmId: call.id,
        title: call.title,
        role: call.role,
        director: call.director,
        studio: call.studio,
        venueKey: call.venueKey,
        venueName: call.venueName,
        auditionStars: stars,
        shootPay: call.shootPay,
        castAt: Nollywood.now(),
      };
    }
    this.lastResult = {
      filmId: call.id,
      title: call.title,
      role: call.role,
      venueName: call.venueName,
      stars,
      score,
      hits,
    };
    this.save();
    Activity.emit({ kind: 'acted', id: `audition ${call.id}` });
    const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    showGameToast(
      `🎬 ${starText} You got the part of ${call.role} in "${call.title}"! Report to ${call.venueName} for the shoot.`,
      'success',
      4500
    );
    this.changed();
    return { ok: true, done: true, grade, stars, active: this.data.active };
  }

  /** Helper for tests and keyboard shortcuts: hits the green sweet spot on the active audition or shoot */
  public tapPerfect(): Promise<{ ok: boolean; done: boolean; grade?: SweepGrade; stars?: 1 | 2 | 3 }> {
    if (this.auditioning) return this.deliverLine('good');
    ShiftSkill.get().tapPerfect();
    return Promise.resolve({ ok: true, done: false, grade: 'good' });
  }

  /** Completes the location shoot at the venue, pays the wrap fee, releases the film, and raises Fame */
  public async completeShoot(
    filmId: string,
    shootStars: 1 | 2 | 3
  ): Promise<{ ok: boolean; reason?: string; film?: ReleasedFilm; fame?: number }> {
    this.load();
    const active = this.data.active;
    const call = this.callFor(filmId);
    if (!call) return { ok: false, reason: 'Unknown film.' };
    if (!active || active.filmId !== filmId) {
      return { ok: false, reason: `Audition for ${call.title} on the Nollywood app first.` };
    }

    const be = BackendService.getInstance();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/nollywood/shoot', { filmId, stars: shootStars })) as {
        ok: boolean;
        reason?: string;
        film?: ReleasedFilm;
        fame?: number;
        active?: null;
        filmography?: ReleasedFilm[];
        wallet?: { cash: number; bank: number };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Shoot could not be settled.' };
      if (res.wallet) be.applyServerWallet(res.wallet);
      this.data.fame = res.fame ?? this.data.fame;
      this.data.active = null;
      if (Array.isArray(res.filmography)) this.data.filmography = res.filmography;
      this.save();
      be.addSkillExp('charisma', 2);
      be.modifyNeed('fun', 20);
      Activity.emit({ kind: 'acted', id: `shoot ${call.id}` });
      this.changed();
      return { ok: true, film: res.film, fame: this.data.fame };
    }

    const stars = (Math.min(3, Math.max(1, Math.round((active.auditionStars + shootStars) / 2))) as 1 | 2 | 3);
    const tip =
      shootStars === 3
        ? Math.round((call.shootPay * 0.3) / 50) * 50
        : shootStars === 2
          ? Math.round((call.shootPay * 0.1) / 50) * 50
          : 0;
    const dailyTaking = Math.round((call.dailyRoyalty * (1 + (stars - 1) * 0.25)) / 100) * 100;
    const fameEarned = call.fameGain + (stars - 1) * 5;
    const releasedAt = Nollywood.now();
    const film: ReleasedFilm = {
      id: this.data.nextId++,
      filmId: call.id,
      title: call.title,
      genre: call.genre,
      role: call.role,
      director: call.director,
      studio: call.studio,
      venueKey: call.venueKey,
      venueName: call.venueName,
      auditionStars: active.auditionStars,
      shootStars,
      stars,
      shootPay: call.shootPay,
      tip,
      dailyTaking,
      daysPaid: 0,
      totalDays: RELEASE_DAYS,
      totalTakings: 0,
      fameEarned,
      releasedAt,
    };

    this.data.active = null;
    this.data.fame += fameEarned;
    this.data.filmography.unshift(film);
    this.save();

    const totalUpfront = call.shootPay + tip;
    be.processTransaction({
      type: 'BONUS',
      amount: totalUpfront,
      description: `Nollywood shoot wrap: ${call.title} (${call.role})`,
      source: 'bank',
    });
    be.addSkillExp('charisma', 2);
    be.modifyNeed('fun', 20);
    const playerData = be.getData();
    playerData.stats.streetCred = (playerData.stats.streetCred ?? 0) + fameEarned;
    Activity.emit({ kind: 'acted', id: `shoot ${call.id}` });
    this.changed();
    return { ok: true, film, fame: this.data.fame };
  }

  /** Settles any newly elapsed real days of box-office takings for released films (offline) */
  private checkTakingsOffline(): number {
    this.load();
    const now = Nollywood.now();
    let totalPaid = 0;
    const be = BackendService.getInstance();
    for (const film of this.data.filmography) {
      if (film.daysPaid >= RELEASE_DAYS) continue;
      const elapsed = Math.min(RELEASE_DAYS, Math.max(0, Math.floor((now - film.releasedAt) / DAY_MS)));
      if (elapsed <= film.daysPaid) continue;
      const newDays = elapsed - film.daysPaid;
      const payout = newDays * film.dailyTaking;
      const fromDay = film.daysPaid + 1;
      film.daysPaid = elapsed;
      film.totalTakings += payout;
      totalPaid += payout;
      be.processTransaction({
        type: 'BONUS',
        amount: payout,
        description: `Nollywood box-office takings: ${film.title} (Day ${fromDay}${newDays > 1 ? `–${elapsed}` : ''})`,
        source: 'bank',
      });
    }
    if (totalPaid > 0) {
      this.save();
      showGameToast(`🎬 Box-office takings paid: ₦${totalPaid.toLocaleString()} into your bank.`, 'success', 4000);
      this.changed();
    }
    return totalPaid;
  }

  /** Checks and pays any matured real-day takings (both offline and online) */
  public async checkTakings(): Promise<number> {
    this.load();
    const online = OnlineAccount.get();
    if (!online) return this.checkTakingsOffline();
    const res = (await online.request('/nollywood/collect', {})) as {
      ok: boolean;
      fame?: number;
      active?: ActiveRole | null;
      filmography?: ReleasedFilm[];
      paidNow?: number;
      wallet?: { cash: number; bank: number };
    };
    if (!res.ok) return 0;
    if (res.wallet) BackendService.getInstance().applyServerWallet(res.wallet);
    if (typeof res.fame === 'number') this.data.fame = res.fame;
    if (Array.isArray(res.filmography)) this.data.filmography = res.filmography;
    this.save();
    if (res.paidNow && res.paidNow > 0) {
      showGameToast(`🎬 Box-office takings paid: ₦${res.paidNow.toLocaleString()} into your bank.`, 'success', 4000);
      this.changed();
    }
    return res.paidNow ?? 0;
  }

  public tick(delta: number): void {
    this.checkAccum += delta;
    if (this.checkAccum < 1.0) return;
    this.checkAccum = 0;
    if (!OnlineAccount.get()) {
      this.checkTakingsOffline();
    }
  }

  private changed(): void {
    this.onChange?.();
  }
}

/**
 * Builds the 3D Nollywood location film set inside the venue when `key` is one of our shoot
 * venues: cinema camera on tripod, key light, clapperboard floor mark, director and cameraman
 * figures, and the interactive shoot station.
 */
export function attachNollywood(room: PlaceInterior, key: string): void {
  const call = Nollywood.get().callAtVenue(key);
  if (!call) return;

  const setGroup = new THREE.Group();
  setGroup.name = `nollywood ${key}`;
  const { mark, director, camera, light } = call.setSpot;

  // 3D Cinema Camera on Tripod, Key Light Softbox, Clapperboard Stand & Actor Floor T-Mark
  const b = new Builder();
  const [cx, cz] = camera;
  const [lx, lz] = light;
  const [mx, mz] = mark;
  b.cylinder(0x1f2937, 0.04, 1.35, cx, 0, cz, { sides: 8 })
    .cylinder(0x374151, 0.26, 0.05, cx, 0.02, cz, { sides: 10 })
    .box(0x0f172a, 0.46, 0.28, 0.32, cx, 1.35, cz)
    .box(0x1e293b, 0.22, 0.22, 0.18, cx + 0.3, 1.38, cz)
    .cylinder(0x334155, 0.14, 0.08, cx - 0.08, 1.72, cz, { pitch: Math.PI / 2, sides: 14 })
    .cylinder(0x334155, 0.14, 0.08, cx + 0.12, 1.72, cz, { pitch: Math.PI / 2, sides: 14 })
    .box(0xef4444, 0.06, 0.06, 0.06, cx + 0.24, 1.66, cz, { glow: true });
  b.cylinder(0x374151, 0.24, 0.05, lx, 0.02, lz, { sides: 10 })
    .cylinder(0x1f2937, 0.035, 1.85, lx, 0, lz, { sides: 8 })
    .box(0x111827, 0.65, 0.45, 0.14, lx, 1.75, lz)
    .box(0xfef08a, 0.58, 0.38, 0.03, lx, 1.78, lz + 0.08, { glow: true });
  b.box(0xfacc15, 0.65, 0.015, 0.1, mx, 0.01, mz)
    .box(0xfacc15, 0.1, 0.015, 0.65, mx, 0.01, mz);
  setGroup.add(b.build(`nollywood-rig-${key}`, { roughness: 0.55 }));

  const sign = signBoard(['🎬 NOLLYWOOD SET', `${call.title} · ${call.studio}`], 2.2, 0.52, '#7c2d12', '#fef08a');
  sign.position.set(director[0], 2.55, director[1]);
  setGroup.add(sign);

  const faceMarkFromDir = Math.atan2(mark[0] - director[0], mark[1] - director[1]);
  const faceMarkFromCam = Math.atan2(mark[0] - camera[0], mark[1] - camera[1]);

  const directorFig = new Figure(
    setGroup,
    `nollywood-dir-${key}`,
    call.director,
    {
      gender: call.directorGender,
      username: call.director,
      outfitColor: call.directorOutfit,
      outfit: call.directorGender === 'female' ? 'casual_blouse' : 'casual_tee',
      hairstyle: call.directorGender === 'female' ? 'gele' : 'short_crop',
    },
    director,
    faceMarkFromDir
  );

  const camPos: [number, number] = [camera[0] - 0.55, camera[1]];
  const cameramanFig = new Figure(
    setGroup,
    `nollywood-cam-${key}`,
    'Camera Operator',
    {
      gender: 'male',
      username: '',
      outfitColor: 0x1e293b,
      outfit: 'casual_tee',
      hairstyle: 'afro',
    },
    camPos,
    faceMarkFromCam
  );
  cameramanFig.pose('stand', 'reach');

  room.group.add(setGroup);
  room.ticks.push((delta) => {
    directorFig.tick(delta);
    cameramanFig.tick(delta);
  });

  let shooting = false;

  const runShoot = (host: PlaceHost) => {
    if (shooting) return;
    const nw = Nollywood.get();
    const active = nw.activeRole();
    if (!active || active.filmId !== call.id) {
      host.ask({
        who: call.director,
        role: `Director · ${call.studio}`,
        text: `We are shooting "${call.title}" here at ${call.venueName}. Role: ${call.role} (wrap pay ₦${call.shootPay.toLocaleString()} + 5 days of box-office royalties).`,
        choices: [
          {
            label: '🎬 Open Nollywood app to audition',
            note: call.minFame > 0 ? `Requires ${call.minFame} Fame` : '3-take scene test',
            pick: () => {
              nw.startAudition(call.id);
              PlaceOpeners.open('app:nollywood', host);
            },
          },
          { label: 'Maybe later', pick: () => undefined },
        ],
      });
      return;
    }

    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    shooting = true;
    const skill = ShiftSkill.get();
    skill.begin(`Shoot: ${call.title}`, 3);
    let sweep: { end(): void } | null = null;
    let completedTakes = 0;

    const seq = new Sequence(`shoot ${call.id}`, [actor]);
    seq.maxSeconds = 90;
    seq.add(
      steps.walk(actor, room.at(mark[0], mark[1]), { speed: 2.8, ifStuck: 'snap' }),
      steps.face(actor, room.at(camera[0], camera[1])),
      steps.call('slates', () => {
        directorFig.pose('stand', 'wave');
        directorFig.say(`Quiet on set! "${call.title}" — ${call.role}, Scene 1, Action!`, 2.5);
      })
    );

    const poses: Array<'talk' | 'wave' | 'reach'> = ['talk', 'wave', 'reach'];
    const cues = [
      'Good! Hold the camera’s eye!',
      'Camera two, push in for the close-up!',
      'Cut! Print it — that is a wrap!',
    ];

    call.lines.forEach((line, idx) => {
      seq.add(
        steps.call(`take-${idx + 1}-start`, () => {
          sweep = skill.round();
          host.say(`🎬 Take ${idx + 1}/3: "${line}"`, 'info');
        }),
        steps.animate(actor, { arms: poses[idx % poses.length], legs: 'stand' }, 2.4, [
          {
            at: 0.5,
            run: () => {
              directorFig.pose('stand', idx === 2 ? 'wave' : 'reach');
              directorFig.say(cues[idx], 1.8);
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
        steps.animate(actor, { arms: 'rest', legs: 'stand' }, 0.1)
      );
    });

    seq.add(
      steps.settle(`wrap ${call.id}`, async () => {
        const rated = skill.finish(call.shootPay);
        const done = await nw.completeShoot(call.id, rated.stars);
        if (!done.ok || !done.film) {
          host.say(done.reason ?? 'Could not complete shoot.', 'warning');
          return false;
        }
        const f = done.film;
        const stars = '★'.repeat(f.stars) + '☆'.repeat(3 - f.stars);
        const paid = f.shootPay + f.tip;
        host.say(
          `🎬 ${stars} That's a wrap on "${f.title}"! ${call.director} paid ₦${paid.toLocaleString()} (${f.tip > 0 ? `incl. ₦${f.tip.toLocaleString()} star bonus` : 'wrap fee'}). Fame +${f.fameEarned} · Box-office royalties: ₦${f.dailyTaking.toLocaleString()}/day for 5 days.`,
          'success'
        );
        return true;
      })
    );

    seq.onEnd((reason) => {
      sweep?.end();
      sweep = null;
      if (reason !== 'done') {
        skill.finish(0);
        if (completedTakes > 0) {
          host.say(`You walked off the set of "${call.title}" before the wrap. Shoot the scene again when ready.`, 'warning');
        }
      }
      directorFig.pose('stand', 'rest');
      shooting = false;
    });

    if (!host.director.run(seq)) {
      skill.finish(0);
      shooting = false;
    }
  };

  room.addCard({
    id: `nollywood_${key}`,
    name: `🎬 ${call.title} — Film Set`,
    description: `${call.studio} · Directed by ${call.director}. Role: ${call.role}.`,
    at: director,
    stand: mark,
    label: () => {
      const active = Nollywood.get().activeRole();
      if (active?.filmId === call.id) {
        return `🎬 Shoot "${call.title}" (${call.role}) · ₦${call.shootPay.toLocaleString()}`;
      }
      return `🎬 Film Set: ${call.title} · ${call.director}`;
    },
    run: runShoot,
  });
}
