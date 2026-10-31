import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { MessageService } from '../phone/services/MessageService';
import { Figure } from '../interiors/places/Worship';
import { Builder } from '../world/kit/ArchKit';
import { PlaceInterior, PlaceOpeners } from '../interiors/places/PlaceInterior';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Sequence, steps } from '../interactions/Sequence';
import { Activity } from '../life/Activity';
import type { HumanConfig } from '../graphics/HumanMeshBuilder';

/**
 * Spark — Lagos dating app.
 *
 * - Browse profiles of made-up people in Lagos (`Zainab Bello`, `Tolu Adebayo`, `Amaka Okafor`,
 *   `Damilola Coker`, `Chuka Eze`, `Kemi Adesanya`).
 * - Like a profile to match; matched profiles appear in `MessageService` (`src/phone/services/MessageService.ts`)
 *   so the player can chat with them both inside Spark and in the phone's Messages app.
 * - Arrange a date at a real restaurant or lounge (`The Library`, `Ivory Rooftop`, `Allen Lounge`,
 *   `Chop Express`, `Amala Shitta`) where the date is standing in 3D, waiting for the player.
 */

export type SparkProfileId = 'zainab' | 'tolu' | 'amaka' | 'damilola' | 'chuka' | 'kemi';

export interface SparkProfile {
  id: SparkProfileId;
  contactId: string;
  name: string;
  age: number;
  title: string;
  area: string;
  bio: string;
  interests: string[];
  venueKey: string;
  venueName: string;
  venueArea: string;
  dateDish: string;
  dateBill: number;
  accentColor: string;
  icebreaker: string;
  chatReplies: string[];
  dateGreeting: string;
  dateToast: string;
  afterDateText: string;
  look: HumanConfig;
}

export const SPARK_PROFILES: SparkProfile[] = [
  {
    id: 'zainab',
    contactId: 'spark:zainab',
    name: 'Zainab Bello',
    age: 26,
    title: 'Architect',
    area: 'Ikoyi',
    bio: 'Designing coastal villas by day, hunting for the best peppered snail and jazz in Ikoyi by night.',
    interests: ['Architecture', 'Fine dining', 'Live jazz'],
    venueKey: 'the-library',
    venueName: 'The Library',
    venueArea: 'Ikoyi · fine dining',
    dateDish: 'Grilled prawns & chapman by candlelight',
    dateBill: 45_000,
    accentColor: '#e11d48',
    icebreaker: 'Hey! Glad we matched on Spark ✨ Have you tried the grilled prawns at The Library in Ikoyi?',
    chatReplies: [
      'I just wrapped up my blueprints for the day! Tell me, what is your favourite spot on the island?',
      'Haha I love that energy. Whenever you are free, let us do dinner at The Library in Ikoyi!',
      'I will dress up if you do! Book us a table on Spark and meet me inside The Library.',
    ],
    dateGreeting: 'You made it! I saved us the quiet corner table here at The Library.',
    dateToast: 'Here is to good conversation, warm candlelight, and the best prawns in Ikoyi!',
    afterDateText: 'Tonight at The Library was wonderful ❤️ Thank you for dinner — let us do it again soon!',
    look: {
      gender: 'female',
      username: 'Zainab Bello',
      outfitColor: 0xe11d48,
      outfit: 'ankara_gown',
      hairstyle: 'braids',
    },
  },
  {
    id: 'tolu',
    contactId: 'spark:tolu',
    name: 'Tolu Adebayo',
    age: 28,
    title: 'Fintech Lead',
    area: 'Victoria Island',
    bio: 'Building payment rails on Adeola Odeku. Weak for rooftop views, Afrobeats, and people who keep their word.',
    interests: ['Rooftops', 'Afrobeats', 'Road trips'],
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    venueArea: 'Victoria Island · sky lounge',
    dateDish: 'Rooftop cocktails & suya skewers over the lagoon',
    dateBill: 35_000,
    accentColor: '#9333ea',
    icebreaker: 'Hey stranger 👋 Matching with you just made my afternoon in VI a lot brighter.',
    chatReplies: [
      'Work in Victoria Island has been hectic today, I definitely need a rooftop breeze tonight.',
      'You sound like trouble in the best way 😄 Let us link up at Ivory Rooftop!',
      'I am down! Set the date on Spark and come meet me upstairs at Ivory Rooftop.',
    ],
    dateGreeting: 'Look at that lagoon view! I have been waiting for you by the terrace rail.',
    dateToast: 'To city lights, cold cocktails, and finally meeting face to face at Ivory Rooftop!',
    afterDateText: 'Best rooftop night in VI in a long time ✨ Text me when you get home safe!',
    look: {
      gender: 'male',
      username: 'Tolu Adebayo',
      outfitColor: 0x7c3aed,
      outfit: 'senator',
      hairstyle: 'fade',
    },
  },
  {
    id: 'amaka',
    contactId: 'spark:amaka',
    name: 'Amaka Okafor',
    age: 25,
    title: 'Fashion Stylist',
    area: 'Lekki',
    bio: 'Styling music videos and red carpets. If your shoe game is neat and you like small chops, swipe right.',
    interests: ['Runway', 'Small chops', 'Late lounges'],
    venueKey: 'allen-lounge',
    venueName: 'Allen Lounge',
    venueArea: 'Ikeja · Allen Avenue',
    dateDish: 'Small chops platter & mocktails under the neon lights',
    dateBill: 25_000,
    accentColor: '#db2777',
    icebreaker: 'Okay wait, 10/10 style 👏 Where are you taking me for small chops and good music?',
    chatReplies: [
      'I just left a wardrobe fitting! Music and small chops at Allen Lounge would hit the spot.',
      'Haha no dulling o! I like someone who knows how to have fun in Lagos.',
      'Oya schedule our date on Spark! I will be standing by the VIP booth at Allen Lounge.',
    ],
    dateGreeting: 'Hey! The DJ is playing a madness tonight — come stand with me by our table!',
    dateToast: 'Small chops, cold drinks, and 10/10 company! Allen Lounge never disappoints.',
    afterDateText: 'You actually know how to show a girl a good time 🔥 Let us hang out again soon!',
    look: {
      gender: 'female',
      username: 'Amaka Okafor',
      outfitColor: 0xdb2777,
      outfit: 'casual_blouse',
      hairstyle: 'afro',
    },
  },
  {
    id: 'damilola',
    contactId: 'spark:damilola',
    name: 'Damilola Coker',
    age: 29,
    title: 'Sound Producer',
    area: 'Yaba',
    bio: 'Mixing drums in Yaba until midnight. Big fan of smoky party jollof, vinyl records, and zero pretence.',
    interests: ['Vinyl records', 'Jollof rice', 'Studio nights'],
    venueKey: 'chop-express',
    venueName: 'Chop Express',
    venueArea: 'Ikeja · fast food',
    dateDish: 'Smoky party jollof, spiced chicken & vanilla ice cream',
    dateBill: 12_000,
    accentColor: '#ea580c',
    icebreaker: 'Yo! 🎧 Honest question: Chop Express jollof or fancy small-plate dinner?',
    chatReplies: [
      'Nothing beats real conversation over hot jollof and ice cream at Chop Express.',
      'I just bounced a new beat in the studio! Ready to step out whenever you are.',
      'Say less! Lock in the date on Spark and meet me inside Chop Express in Ikeja.',
    ],
    dateGreeting: 'There you are! You can smell the smoky jollof from the door, right?',
    dateToast: 'Best jollof in Ikeja and even better company across the table!',
    afterDateText: 'Zero pretence, 100% vibes 🎶 Thanks for meeting up at Chop Express!',
    look: {
      gender: 'male',
      username: 'Damilola Coker',
      outfitColor: 0xea580c,
      outfit: 'casual_tee',
      hairstyle: 'dreads',
    },
  },
  {
    id: 'chuka',
    contactId: 'spark:chuka',
    name: 'Chuka Eze',
    age: 31,
    title: 'Marine Engineer',
    area: 'Victoria Island',
    bio: 'Back onshore after two weeks at sea. Looking for a warm smile and a slow three-course dinner in Ikoyi.',
    interests: ['Sailing', 'Seafood', 'Old highlife'],
    venueKey: 'the-library',
    venueName: 'The Library',
    venueArea: 'Ikoyi · fine dining',
    dateDish: 'Three-course seafood dinner & aged red wine',
    dateBill: 40_000,
    accentColor: '#0284c7',
    icebreaker: 'Hello! Just got back onshore in Lagos — would love to take you to The Library in Ikoyi.',
    chatReplies: [
      'After weeks on the water, sitting down at The Library in Ikoyi sounds like heaven.',
      'You have a great sense of humour! When are we having dinner?',
      'Set it up on Spark and I will be waiting for you inside The Library.',
    ],
    dateGreeting: 'Good evening! It is a pleasure to finally see you in person here at The Library.',
    dateToast: 'To calm waters and a wonderful evening together in Ikoyi!',
    afterDateText: 'Thank you for a memorable dinner at The Library. I cannot wait to see you again.',
    look: {
      gender: 'male',
      username: 'Chuka Eze',
      outfitColor: 0x0284c7,
      outfit: 'agbada',
      hairstyle: 'short_crop',
    },
  },
  {
    id: 'kemi',
    contactId: 'spark:kemi',
    name: 'Kemi Adesanya',
    age: 24,
    title: 'Food Photographer',
    area: 'Surulere',
    bio: 'Documenting the best kitchens on the mainland. If you appreciate hot amala, ewedu and gbegiri, we already get along.',
    interests: ['Film cameras', 'Amala spots', 'Art galleries'],
    venueKey: 'amala-shitta',
    venueName: 'Amala Shitta',
    venueArea: 'Surulere · buka',
    dateDish: 'Hot amala, ewedu, gbegiri & assorted meat',
    dateBill: 8_500,
    accentColor: '#16a34a',
    icebreaker: 'Hi! 📸 Please tell me you are not too posh for Amala Shitta in Surulere!',
    chatReplies: [
      'I just finished editing a shoot in Surulere! Amala Shitta is calling my name.',
      'Haha yes! Anyone who respects hot amala and ewedu is an automatic 10.',
      'Book our date on Spark and come meet me inside Amala Shitta!',
    ],
    dateGreeting: 'Welcome to Surulere! The amala is steaming hot — come join me!',
    dateToast: 'Nothing brings two people closer than proper Amala Shitta!',
    afterDateText: 'That was the most fun date I have had all year 📸💚 Let us go again soon!',
    look: {
      gender: 'female',
      username: 'Kemi Adesanya',
      outfitColor: 0x16a34a,
      outfit: 'ankara_gown',
      hairstyle: 'gele',
    },
  },
];

export interface SparkMatchState {
  profileId: SparkProfileId;
  matchedAt: number;
  closeness: number;
  datesCount: number;
}

export interface SparkActiveDate {
  id: number;
  profileId: SparkProfileId;
  name: string;
  venueKey: string;
  venueName: string;
  bill: number;
  status: 'waiting' | 'completed';
  scheduledAt: number;
  completedAt: number | null;
}

interface SparkSaveData {
  matches: SparkMatchState[];
  passed: SparkProfileId[];
  activeDate: SparkActiveDate | null;
  completedDates: SparkActiveDate[];
  cursor: number;
}

/** Coordinates inside each restaurant/lounge where the Spark date stands waiting */
interface DateVenueSpot {
  venueKey: string;
  venueName: string;
  dateAt: [number, number];
  playerStand: [number, number];
  tableAt: [number, number];
  facing: number;
}

const DATE_VENUE_SPOTS: Record<string, DateVenueSpot> = {
  'the-library': {
    venueKey: 'the-library',
    venueName: 'The Library',
    dateAt: [2.5, 1.5],
    playerStand: [2.5, 2.8],
    tableAt: [1.5, 2.1],
    facing: 0,
  },
  'ivory-rooftop': {
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    dateAt: [4.2, 1.8],
    playerStand: [4.2, 3.1],
    tableAt: [3.2, 2.4],
    facing: 0,
  },
  'allen-lounge': {
    venueKey: 'allen-lounge',
    venueName: 'Allen Lounge',
    dateAt: [4.2, 1.8],
    playerStand: [4.2, 3.1],
    tableAt: [3.2, 2.4],
    facing: 0,
  },
  'chop-express': {
    venueKey: 'chop-express',
    venueName: 'Chop Express',
    dateAt: [2.2, 2.0],
    playerStand: [2.2, 3.3],
    tableAt: [1.3, 2.6],
    facing: 0,
  },
  'amala-shitta': {
    venueKey: 'amala-shitta',
    venueName: 'Amala Shitta',
    dateAt: [2.2, 1.4],
    playerStand: [2.2, 2.7],
    tableAt: [1.3, 2.0],
    facing: 0,
  },
};

export class Spark {
  private static instance: Spark | null = null;
  public static get(): Spark {
    if (!Spark.instance) Spark.instance = new Spark();
    return Spark.instance;
  }

  public onChange: (() => void) | null = null;
  private data: SparkSaveData = {
    matches: [],
    passed: [],
    activeDate: null,
    completedDates: [],
    cursor: 0,
  };
  private loadedFor = '';
  private replyIndex = new Map<string, number>();

  private constructor() {
    this.load();
    this.registerMessageHooks();
  }

  private key(): string {
    return `nl_spark_v1:${Activity.player()}`;
  }

  private registerMessageHooks(): void {
    MessageService.extraContacts = () => {
      this.load();
      return this.data.matches
        .map((m) => {
          const p = this.profileFor(m.profileId);
          if (!p) return null;
          const activeHere = this.data.activeDate?.profileId === p.id;
          return {
            id: p.contactId,
            name: p.name,
            note: activeHere
              ? `Waiting at ${p.venueName}`
              : m.datesCount > 0
                ? `Spark · ${m.datesCount} date${m.datesCount > 1 ? 's' : ''}`
                : `Spark match · ${p.area}`,
            standing: (m.closeness >= 60 ? 'friend' : 'acquaintance') as 'friend' | 'acquaintance',
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    };

    MessageService.customReply = (contactId: string) => {
      if (!contactId.startsWith('spark:')) return null;
      const profileId = contactId.slice('spark:'.length) as SparkProfileId;
      const profile = this.profileFor(profileId);
      if (!profile) return null;
      const idx = this.replyIndex.get(contactId) ?? 0;
      this.replyIndex.set(contactId, idx + 1);
      return profile.chatReplies[idx % profile.chatReplies.length];
    };
  }

  private load(): void {
    if (OnlineAccount.get() !== null) return;
    const k = this.key();
    if (this.loadedFor === k) return;
    this.loadedFor = k;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) {
        this.data = { matches: [], passed: [], activeDate: null, completedDates: [], cursor: 0 };
        return;
      }
      const parsed = JSON.parse(raw) as Partial<SparkSaveData>;
      this.data = {
        matches: Array.isArray(parsed.matches) ? parsed.matches : [],
        passed: Array.isArray(parsed.passed) ? parsed.passed : [],
        activeDate: parsed.activeDate ?? null,
        completedDates: Array.isArray(parsed.completedDates) ? parsed.completedDates : [],
        cursor: typeof parsed.cursor === 'number' ? parsed.cursor : 0,
      };
    } catch {
      this.data = { matches: [], passed: [], activeDate: null, completedDates: [], cursor: 0 };
    }
  }

  private save(): void {
    if (OnlineAccount.get() !== null) return;
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.data));
    } catch {
      // ignore storage errors
    }
  }

  private changed(): void {
    this.onChange?.();
  }

  private clockText(): string {
    return '19:30';
  }

  public profiles(): SparkProfile[] {
    return SPARK_PROFILES;
  }

  public profileFor(id: string): SparkProfile | null {
    const clean = id.startsWith('spark:') ? id.slice('spark:'.length) : id;
    return SPARK_PROFILES.find((p) => p.id === clean) ?? null;
  }

  public matches(): Array<SparkMatchState & { profile: SparkProfile }> {
    this.load();
    return this.data.matches
      .map((m) => {
        const profile = this.profileFor(m.profileId);
        return profile ? { ...m, profile } : null;
      })
      .filter((x): x is SparkMatchState & { profile: SparkProfile } => x !== null);
  }

  public isMatched(profileId: SparkProfileId): boolean {
    this.load();
    return this.data.matches.some((m) => m.profileId === profileId);
  }

  public activeDate(): (SparkActiveDate & { profile: SparkProfile }) | null {
    this.load();
    const active = this.data.activeDate;
    if (!active || active.status !== 'waiting') return null;
    const profile = this.profileFor(active.profileId);
    if (!profile) return null;
    return { ...active, profile };
  }

  public completedDates(): SparkActiveDate[] {
    this.load();
    return [...this.data.completedDates];
  }

  /** Profiles still available to discover (unmatched first, or cycles through all profiles). */
  public discoverable(): SparkProfile[] {
    this.load();
    const matchedIds = new Set(this.data.matches.map((m) => m.profileId));
    const unmatched = SPARK_PROFILES.filter((p) => !matchedIds.has(p.id) && !this.data.passed.includes(p.id));
    if (unmatched.length > 0) return unmatched;
    const anyUnmatched = SPARK_PROFILES.filter((p) => !matchedIds.has(p.id));
    return anyUnmatched.length > 0 ? anyUnmatched : SPARK_PROFILES;
  }

  public currentDiscoverProfile(): SparkProfile {
    const list = this.discoverable();
    const idx = ((this.data.cursor % list.length) + list.length) % list.length;
    return list[idx];
  }

  public pass(profileId?: SparkProfileId): SparkProfile {
    this.load();
    const target = profileId ?? this.currentDiscoverProfile().id;
    if (!this.data.passed.includes(target)) {
      this.data.passed.push(target);
    }
    this.data.cursor = (this.data.cursor + 1) % SPARK_PROFILES.length;
    this.save();
    this.changed();
    return this.currentDiscoverProfile();
  }

  /** Likes a profile on Spark, creating a mutual match and opening a chat thread in `MessageService`. */
  public async like(profileId: SparkProfileId): Promise<{
    ok: boolean;
    reason?: string;
    profile?: SparkProfile;
    matched?: boolean;
  }> {
    this.load();
    const profile = this.profileFor(profileId);
    if (!profile) return { ok: false, reason: 'That Spark profile does not exist.' };

    const now = Date.now();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/spark/like', { profileId, now })) as {
        ok: boolean;
        reason?: string;
        snapshot?: {
          matches: SparkMatchState[];
          activeDate: SparkActiveDate | null;
          completedDates: SparkActiveDate[];
        };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Could not like profile.' };
      if (res.snapshot) {
        this.data.matches = res.snapshot.matches;
        this.data.activeDate = res.snapshot.activeDate;
        this.data.completedDates = res.snapshot.completedDates;
      }
    } else if (!this.isMatched(profileId)) {
      this.data.matches.unshift({
        profileId,
        matchedAt: now,
        closeness: 35,
        datesCount: 0,
      });
    }

    this.data.passed = this.data.passed.filter((id) => id !== profileId);
    this.save();

    // Ensure they have familiarity and send their opening icebreaker in MessageService if thread is empty
    const be = BackendService.getInstance();
    be.addFamiliarity(profile.contactId, 35);
    const existingThread = be.thread(profile.contactId);
    if (existingThread.messages.length === 0) {
      be.addMessage(
        profile.contactId,
        { from: 'them', text: profile.icebreaker, at: this.clockText() },
        true,
      );
    }
    Activity.emit({ kind: 'acted', id: `spark_match_${profile.id}` });
    this.changed();
    return { ok: true, profile, matched: true };
  }

  /** Arranges a date with a matched profile at their favourite real restaurant or lounge. */
  public async scheduleDate(profileId: SparkProfileId): Promise<{
    ok: boolean;
    reason?: string;
    date?: SparkActiveDate;
    profile?: SparkProfile;
  }> {
    this.load();
    const profile = this.profileFor(profileId);
    if (!profile) return { ok: false, reason: 'That Spark profile does not exist.' };
    if (!this.isMatched(profileId)) {
      return { ok: false, reason: `Match with ${profile.name} on Spark before scheduling a date.` };
    }

    const now = Date.now();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/spark/schedule-date', { profileId, now })) as {
        ok: boolean;
        reason?: string;
        date?: SparkActiveDate;
        snapshot?: {
          matches: SparkMatchState[];
          activeDate: SparkActiveDate | null;
          completedDates: SparkActiveDate[];
        };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Could not schedule date.' };
      if (res.snapshot) {
        this.data.matches = res.snapshot.matches;
        this.data.activeDate = res.snapshot.activeDate;
        this.data.completedDates = res.snapshot.completedDates;
      } else if (res.date) {
        this.data.activeDate = res.date;
      }
    } else {
      this.data.activeDate = {
        id: now,
        profileId,
        name: profile.name,
        venueKey: profile.venueKey,
        venueName: profile.venueName,
        bill: profile.dateBill,
        status: 'waiting',
        scheduledAt: now,
        completedAt: null,
      };
    }

    this.save();
    BackendService.getInstance().addMessage(
      profile.contactId,
      {
        from: 'them',
        text: `It's a date! 💕 I am heading to ${profile.venueName} (${profile.venueArea}) now — come meet me inside!`,
        at: this.clockText(),
      },
      true,
    );
    Activity.emit({ kind: 'acted', id: `spark_schedule_${profile.id}` });
    this.changed();
    return { ok: true, date: this.data.activeDate!, profile };
  }

  /** Completes the date inside the restaurant/lounge, paying the bill and raising closeness & vitals. */
  public async completeDate(
    profileId: SparkProfileId,
    venueKey: string,
  ): Promise<{
    ok: boolean;
    reason?: string;
    paid?: number;
    closeness?: number;
    profile?: SparkProfile;
  }> {
    this.load();
    const active = this.data.activeDate;
    const profile = this.profileFor(profileId);
    if (!profile) return { ok: false, reason: 'Unknown Spark profile.' };
    if (!active || active.status !== 'waiting' || active.profileId !== profileId) {
      return { ok: false, reason: `Schedule a date with ${profile.name} on Spark first.` };
    }

    const be = BackendService.getInstance();
    const now = Date.now();
    const online = OnlineAccount.get();

    if (online) {
      const res = (await online.request('/spark/complete-date', { profileId, venueKey, now })) as {
        ok: boolean;
        reason?: string;
        paid?: number;
        closeness?: number;
        wallet?: { cash: number; bank: number };
        snapshot?: {
          matches: SparkMatchState[];
          activeDate: SparkActiveDate | null;
          completedDates: SparkActiveDate[];
        };
      };
      if (!res.ok) return { ok: false, reason: res.reason ?? 'Could not complete date.' };
      if (res.wallet) be.applyServerWallet(res.wallet);
      if (res.snapshot) {
        this.data.matches = res.snapshot.matches;
        this.data.activeDate = res.snapshot.activeDate;
        this.data.completedDates = res.snapshot.completedDates;
      } else {
        this.data.activeDate = null;
      }
      this.save();
    } else {
      const bankBalance = be.getData().bank.balance;
      const paid = be.processTransaction({
        type: 'FOOD_PURCHASE',
        amount: active.bill,
        description: `Spark date with ${profile.name} at ${profile.venueName}`,
        source: bankBalance >= active.bill ? 'bank' : 'wallet',
        funding: 'strict',
      });
      if (!paid.success) {
        return {
          ok: false,
          reason: `You need ₦${active.bill.toLocaleString()} to pay for the date at ${profile.venueName}.`,
        };
      }
      const completed: SparkActiveDate = {
        ...active,
        status: 'completed',
        completedAt: now,
      };
      this.data.activeDate = null;
      this.data.completedDates.unshift(completed);
      const match = this.data.matches.find((m) => m.profileId === profileId);
      if (match) {
        match.closeness = Math.min(100, match.closeness + 25);
        match.datesCount += 1;
      }
      this.save();
    }

    be.modifyNeed('social', 35);
    be.modifyNeed('fun', 30);
    be.modifyNeed('hunger', 40);
    be.addFamiliarity(profile.contactId, 25);
    be.addSkillExp('charisma', 2);
    be.addMessage(
      profile.contactId,
      { from: 'them', text: profile.afterDateText, at: this.clockText() },
      true,
    );
    Activity.emit({ kind: 'acted', id: `spark_date_${profile.id}` });
    this.changed();

    const matchAfter = this.data.matches.find((m) => m.profileId === profileId);
    return {
      ok: true,
      paid: active.bill,
      closeness: matchAfter?.closeness ?? 60,
      profile,
    };
  }

  public async syncFromServer(): Promise<void> {
    this.load();
    const online = OnlineAccount.get();
    if (!online) return;
    const res = (await online.request('/spark')) as {
      ok?: boolean;
      matches?: SparkMatchState[];
      activeDate?: SparkActiveDate | null;
      completedDates?: SparkActiveDate[];
    } | null;
    if (res && res.ok) {
      if (Array.isArray(res.matches)) this.data.matches = res.matches;
      if (res.activeDate !== undefined) this.data.activeDate = res.activeDate;
      if (Array.isArray(res.completedDates)) this.data.completedDates = res.completedDates;
      this.save();
      this.changed();
    }
  }
}

/**
 * Attaches the 3D Spark date table and waiting date `Figure` to any restaurant or lounge
 * in `DATE_VENUE_SPOTS` (`the-library`, `ivory-rooftop`, `allen-lounge`, `chop-express`, `amala-shitta`).
 */
export function attachSparkDate(room: PlaceInterior, key: string): void {
  const spot = DATE_VENUE_SPOTS[key];
  if (!spot) return;

  const spark = Spark.get();
  const dateGroup = new THREE.Group();
  dateGroup.name = `spark_date_set_${key}`;

  // Build a romantic reserved table setting with a rose vase and warm candle glow
  const b = new Builder();
  const [tx, tz] = spot.tableAt;
  b.cylinder(0x1f2937, 0.38, 0.74, tx, 0, tz, { sides: 14 })
    .cylinder(0xfef2f2, 0.44, 0.04, tx, 0.74, tz, { sides: 16 })
    .cylinder(0xe11d48, 0.06, 0.18, tx - 0.08, 0.78, tz, { sides: 10 })
    .cone(0xf43f5e, 0.09, 0.14, tx - 0.08, 0.96, tz, 10)
    .cylinder(0xfef08a, 0.04, 0.12, tx + 0.1, 0.78, tz + 0.06, { glow: true });
  dateGroup.add(b.build(`spark_table_${key}`, { roughness: 0.5 }));

  room.group.add(dateGroup);

  let currentProfileId: SparkProfileId | null = null;
  let dateFig: Figure | null = null;
  let dating = false;

  const ensureDateFigure = (): { fig: Figure; profile: SparkProfile } | null => {
    const active = spark.activeDate();
    // Pick the active date at this venue, or if none is active at this venue, hide the figure
    const profile =
      active && active.venueKey === key
        ? active.profile
        : null;

    if (!profile) {
      if (dateFig) {
        dateFig.root.visible = false;
      }
      currentProfileId = null;
      return null;
    }

    if (!dateFig || currentProfileId !== profile.id) {
      if (dateFig) {
        dateGroup.remove(dateFig.root);
      }
      dateFig = new Figure(
        dateGroup,
        `spark-date-${profile.id}`,
        profile.name,
        profile.look,
        spot.dateAt,
        spot.facing,
      );
      dateFig.pose('stand', 'wave');
      currentProfileId = profile.id;
    }
    dateFig.root.visible = true;
    return { fig: dateFig, profile };
  };

  // Sync immediately when entering the venue
  ensureDateFigure();

  room.ticks.push((delta) => {
    const activeFig = ensureDateFigure();
    if (activeFig) {
      activeFig.fig.tick(delta);
    }
  });

  const runDate = (host: PlaceHost) => {
    if (dating) return;
    const ready = ensureDateFigure();
    if (!ready) {
      const venueProfiles = SPARK_PROFILES.filter((p) => p.venueKey === key);
      const names = venueProfiles.map((p) => p.name).join(' or ');
      host.ask({
        who: 'Reserved Table',
        role: `${spot.venueName} · Spark Date Table`,
        text: `This candlelit table is reserved for Spark dates (${names} love coming to ${spot.venueName}). Open the Spark app to match and schedule a date here!`,
        choices: [
          {
            label: '💘 Open Spark dating app',
            note: 'Match, chat & book a date',
            pick: () => {
              PlaceOpeners.open('app:spark', host);
            },
          },
          { label: 'Maybe later', pick: () => undefined },
        ],
      });
      return;
    }

    const { fig, profile } = ready;
    const player = host.actor;
    if (host.director.interrupt(player) === 'locked') return;
    dating = true;

    const standWorld = room.at(spot.playerStand[0], spot.playerStand[1]);
    const figWorld = room.at(spot.dateAt[0], spot.dateAt[1]);

    const seq = new Sequence(`spark_date_${profile.id}`, [player, fig.actor]);
    seq.maxSeconds = 60;
    seq.add(
      steps.walk(player, standWorld, { speed: 2.6, ifStuck: 'snap' }),
      steps.face(player, figWorld),
      steps.face(fig.actor, standWorld),
      steps.call('greet', () => {
        fig.pose('stand', 'wave');
        fig.say(profile.dateGreeting, 3.0);
        host.say(`💘 ${profile.name}: "${profile.dateGreeting}"`, 'info');
      }),
      steps.animate(player, { arms: 'wave', legs: 'stand' }, 1.4),
      steps.call('toast', () => {
        fig.pose('stand', 'talk');
        fig.say(profile.dateToast, 3.2);
      }),
      steps.animate(player, { arms: 'talk', legs: 'stand' }, 2.2),
      steps.settle(`date_settle_${profile.id}`, async () => {
        const res = await spark.completeDate(profile.id, key);
        if (!res.ok) {
          host.say(res.reason ?? 'Could not complete the date.', 'warning');
          return false;
        }
        fig.pose('stand', 'wave');
        fig.say(profile.afterDateText, 3.5);
        host.say(
          `💘 Date with ${profile.name} at ${profile.venueName} complete! Paid ₦${(res.paid ?? profile.dateBill).toLocaleString()} · Social +35, Fun +30, Hunger +40 · Closeness ${res.closeness ?? 60}/100.`,
          'success',
        );
        return true;
      }),
    );

    seq.onEnd(() => {
      fig.pose('stand', 'rest');
      dating = false;
    });

    if (!host.director.run(seq)) {
      dating = false;
    }
  };

  room.addCard({
    id: `spark_date_${key}`,
    name: `💘 Spark Date Table`,
    description: `A candlelit table at ${spot.venueName}.`,
    at: spot.dateAt,
    stand: spot.playerStand,
    label: () => {
      const active = spark.activeDate();
      if (active && active.venueKey === key) {
        return `💘 Meet ${active.name} for your date · ₦${active.bill.toLocaleString()}`;
      }
      return `💘 Spark Reserved Table · ${spot.venueName}`;
    },
    run: runDate,
  });
}
