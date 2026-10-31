import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { Figure } from '../interiors/places/Worship';
import { Builder } from '../world/kit/ArchKit';
import type { PlaceInterior } from '../interiors/places/PlaceInterior';
import type { PlaceHost } from '../destinations/PlaceActions';
import { Sequence, steps } from '../interactions/Sequence';
import { showGameToast } from '../ui/GameToast';
import { Activity } from '../life/Activity';

/**
 * Chieftaincy & High Society Titles system:
 * - Conferred by the Council of Chiefs & Kabiyesi at Freedom Park Palace Court.
 * - Requires Society Fame + Investiture Offering.
 * - Confers authentic royal regalia (Coral beads, Irukere flywhisk, Beaded cap, Royal staff).
 * - Delivers daily royal tribute from grateful citizens and unlocks societal respect.
 */

export type TitleId = 'otunba' | 'aare' | 'omoba' | 'gbobaniyi';

export interface ChieftaincyTitleSpec {
  id: TitleId;
  name: string;
  prefix: string;
  regaliaId: string;
  regaliaName: string;
  regaliaIcon: string;
  fameRequired: number;
  offeringPrice: number;
  dailyTribute: number;
  oriki: string;
  description: string;
}

export const CHIEFTAINCY_TITLES: Record<TitleId, ChieftaincyTitleSpec> = {
  otunba: {
    id: 'otunba',
    name: 'Otunba of Lagos',
    prefix: 'Otunba',
    regaliaId: 'regalia_beads',
    regaliaName: 'Royal Coral Beads',
    regaliaIcon: '📿',
    fameRequired: 25,
    offeringPrice: 250_000,
    dailyTribute: 15_000,
    oriki: 'Omo Eko Akete, ilu ogbon! A noble pillar whose light shines across the lagoon!',
    description: 'Ancient honorary chieftaincy conferring royal coral beads and permanent VIP recognition across Lagos society.',
  },
  aare: {
    id: 'aare',
    name: 'Aare of Eko',
    prefix: 'Aare',
    regaliaId: 'regalia_irukere',
    regaliaName: 'Horse-tail Flywhisk (Irukere)',
    regaliaIcon: '🪶',
    fameRequired: 50,
    offeringPrice: 500_000,
    dailyTribute: 30_000,
    oriki: 'Akinkanju l’Eko! The valiant champion whose courage shields the city!',
    description: 'Prestigious warrior-protector title granted to distinguished community champions, marked by the sacred Irukere.',
  },
  omoba: {
    id: 'omoba',
    name: 'Omoba of the Realm',
    prefix: 'Omoba',
    regaliaId: 'regalia_cap',
    regaliaName: 'Beaded Royal Cap',
    regaliaIcon: '👑',
    fameRequired: 100,
    offeringPrice: 1_200_000,
    dailyTribute: 75_000,
    oriki: 'Adegboruwa! Son of crowns, blessed in wealth, honoured among kings and merchant chiefs!',
    description: 'High royal princely title conferred for exceptional philanthropy and prominence in Lagos high finance.',
  },
  gbobaniyi: {
    id: 'gbobaniyi',
    name: 'Gbobaniyi of Yorubaland',
    prefix: 'Chief',
    regaliaId: 'regalia_staff',
    regaliaName: 'Gold-tipped Royal Staff',
    regaliaIcon: '🦯',
    fameRequired: 200,
    offeringPrice: 2_500_000,
    dailyTribute: 150_000,
    oriki: 'Oba n ki o! He who adorns kings with greatness, whose name echoes from the Atlantic to the savannah!',
    description: 'Supreme patron chieftaincy title recognized across the Southwest, bearing the ceremonial gold-tipped staff.',
  },
};

export interface ConferredTitleState {
  titleId: TitleId;
  conferredAt: number;
  offeringPaid: number;
}

export interface ChieftaincySaveData {
  conferred: ConferredTitleState[];
  activeTitle: TitleId | null;
}

export class Chieftaincy {
  private static instance: Chieftaincy | null = null;
  public static get(): Chieftaincy {
    return (Chieftaincy.instance ??= new Chieftaincy());
  }

  public onChange: (() => void) | null = null;
  private loadedFor = '';
  private data: ChieftaincySaveData = {
    conferred: [],
    activeTitle: null,
  };

  private key(): string {
    return `nl_chieftaincy_v1:${Activity.player()}`;
  }

  private load(): void {
    if (OnlineAccount.get() !== null) return;
    const k = this.key();
    if (this.loadedFor === k) return;
    this.loadedFor = k;
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.conferred)) {
          this.data = {
            conferred: parsed.conferred.filter((c: any) => c && c.titleId in CHIEFTAINCY_TITLES),
            activeTitle: parsed.activeTitle && parsed.activeTitle in CHIEFTAINCY_TITLES ? parsed.activeTitle : null,
          };
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  private save(): void {
    if (OnlineAccount.get() !== null) return;
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.data));
    } catch {
      // ignore quota
    }
  }

  private changed(): void {
    this.onChange?.();
  }

  public resetForTests(): void {
    this.loadedFor = '';
    this.data = { conferred: [], activeTitle: null };
    this.save();
    this.changed();
  }

  public titles(): ChieftaincyTitleSpec[] {
    return Object.values(CHIEFTAINCY_TITLES);
  }

  public conferred(): ConferredTitleState[] {
    this.load();
    return [...this.data.conferred];
  }

  public isConferred(id: TitleId): boolean {
    this.load();
    return this.data.conferred.some((c) => c.titleId === id);
  }

  public activeTitleId(): TitleId | null {
    this.load();
    return this.data.activeTitle;
  }

  public activeTitleSpec(): ChieftaincyTitleSpec | null {
    const id = this.activeTitleId();
    return id ? CHIEFTAINCY_TITLES[id] ?? null : null;
  }

  public playerFame(): number {
    const be = BackendService.getInstance();
    return Math.round(be.getData().stats?.streetCred ?? 0);
  }

  public async syncOnline(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    try {
      const res = (await online.request('/chieftaincy')) as {
        ok: boolean;
        titles?: Array<{ titleId: TitleId; conferredAt: number; offeringPaid: number }>;
        activeTitle?: TitleId | null;
      };
      if (res.ok && Array.isArray(res.titles)) {
        this.data.conferred = res.titles.map((t) => ({
          titleId: t.titleId,
          conferredAt: t.conferredAt,
          offeringPaid: t.offeringPaid,
        }));
        this.data.activeTitle = res.activeTitle ?? null;
        this.changed();
      }
    } catch {
      // offline fallback
    }
  }

  public async setActiveTitle(id: TitleId | null): Promise<{ ok: boolean; message: string }> {
    this.load();
    if (id !== null && !this.isConferred(id)) {
      return { ok: false, message: 'You have not been conferred that title.' };
    }
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/chieftaincy/active', { titleId: id })) as {
        ok: boolean;
        reason?: string;
        activeTitle?: TitleId | null;
      };
      if (!res.ok) return { ok: false, message: res.reason ?? 'Could not update title.' };
      this.data.activeTitle = res.activeTitle ?? null;
    } else {
      this.data.activeTitle = id;
      this.save();
    }
    this.changed();
    const name = id ? CHIEFTAINCY_TITLES[id].name : 'None';
    return { ok: true, message: `Active title set to ${name}.` };
  }

  public async confer(id: TitleId): Promise<{ ok: boolean; message: string }> {
    this.load();
    const spec = CHIEFTAINCY_TITLES[id];
    if (!spec) return { ok: false, message: 'Invalid chieftaincy title.' };
    if (this.isConferred(id)) return { ok: false, message: `You already hold the title of ${spec.name}.` };

    const fame = this.playerFame();
    if (fame < spec.fameRequired) {
      return {
        ok: false,
        message: `${spec.name} requires ${spec.fameRequired} Society Fame (you currently have ${fame}).`,
      };
    }

    const online = OnlineAccount.get();
    const backend = BackendService.getInstance();

    if (online) {
      const res = (await online.request('/chieftaincy/confer', { titleId: id, fame, now: Date.now() })) as {
        ok: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
        snapshot?: { titles: Array<{ titleId: TitleId; conferredAt: number; offeringPaid: number }>; activeTitle: TitleId | null };
      };
      if (!res.ok) return { ok: false, message: res.reason ?? 'Investiture failed.' };
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) {
        this.data.conferred = res.snapshot.titles.map((t) => ({
          titleId: t.titleId,
          conferredAt: t.conferredAt,
          offeringPaid: t.offeringPaid,
        }));
        this.data.activeTitle = res.snapshot.activeTitle ?? id;
      }
    } else {
      if (!backend.canPay(spec.offeringPrice)) {
        return { ok: false, message: `You need ₦${spec.offeringPrice.toLocaleString()} for the palace investiture offering.` };
      }
      backend.pay(spec.offeringPrice, `Chieftaincy Investiture: ${spec.name}`);
      this.data.conferred.push({
        titleId: id,
        conferredAt: Date.now(),
        offeringPaid: spec.offeringPrice,
      });
      this.data.activeTitle = id;
      this.save();
    }

    // Award authentic royal regalia item to bag
    backend.addItem({
      id: spec.regaliaId,
      name: spec.regaliaName,
      category: 'luxury',
      icon: spec.regaliaIcon,
      price: spec.offeringPrice,
      description: `Official royal insignia of the ${spec.name}. Conferred at the Palace Court.`,
      usable: false,
    });

    backend.modifyNeed('social', 35);
    backend.modifyNeed('fun', 25);

    Activity.emit({ kind: 'acted', id: `conferred_${id}` });
    showGameToast(`👑 Kabiyesi has conferred the title of ${spec.name} upon you! Received ${spec.regaliaName}.`, 'success', 6000);
    this.changed();
    return { ok: true, message: `Conferred ${spec.name}!` };
  }

  public onNewDay(): void {
    const active = this.activeTitleSpec();
    if (!active) return;

    // Daily royal tribute deposited into bank account
    const backend = BackendService.getInstance();
    backend.processTransaction({
      type: 'BUSINESS_INCOME',
      amount: active.dailyTribute,
      description: `Daily Royal Tribute: ${active.prefix}`,
      source: 'bank',
    });
    showGameToast(`🏛️ Received ₦${active.dailyTribute.toLocaleString()} daily royal tribute as ${active.prefix}.`, 'info', 4500);
  }
}

/**
 * Attaches the 3D Palace Investiture Dais and Council of Chiefs to Freedom Park (`freedom-park`).
 */
export function attachPalaceCourt(room: PlaceInterior, key: string): void {
  if (key !== 'freedom-park') return;

  const b = new Builder();
  const daisGroup = new THREE.Group();
  daisGroup.name = 'palace_court_dais';

  // 1. Raised Royal Dais with Red Carpet & Golden Steps
  b.box(0x831843, 6.2, 0.4, 4.2, 0, 0, 4.5); // Velvet platform
  b.box(0xd4af37, 6.4, 0.08, 4.4, 0, 0.38, 4.5); // Gold perimeter trim
  b.box(0xd4af37, 2.4, 0.2, 1.2, 0, 0, 2.0); // Royal entrance steps

  // 2. Twin Royal Thrones (Carved Stools with Beaded Backings)
  b.box(0x451a03, 1.2, 0.7, 0.9, -1.2, 0.4, 5.2);
  b.box(0xd4af37, 1.1, 1.1, 0.15, -1.2, 1.1, 5.6); // Gold carved back
  b.box(0x451a03, 1.2, 0.7, 0.9, 1.2, 0.4, 5.2);
  b.box(0xd4af37, 1.1, 1.1, 0.15, 1.2, 1.1, 5.6); // Gold carved back

  // 3. Royal Brass Canopy & Banner
  b.cylinder(0xd4af37, 0.08, 3.2, -2.8, 0.4, 3.0);
  b.cylinder(0xd4af37, 0.08, 3.2, 2.8, 0.4, 3.0);
  b.cylinder(0xd4af37, 0.08, 3.2, -2.8, 0.4, 6.0);
  b.cylinder(0xd4af37, 0.08, 3.2, 2.8, 0.4, 6.0);
  b.box(0x881337, 5.8, 0.15, 3.2, 0, 3.5, 4.5); // Canopy top
  b.box(0xfde047, 5.6, 0.05, 0.4, 0, 3.4, 3.0); // Gold embroidered valance

  daisGroup.add(b.build('palace_dais_mesh', { roughness: 0.4 }));
  room.group.add(daisGroup);

  // 4. Royal Characters (Oba / Kabiyesi, High Chief Elder, Royal Griot / Praise Singer)
  const obaFig = new Figure(
    daisGroup,
    'kabiyesi_oba',
    'Kabiyesi Oba of Lagos',
    { gender: 'male', username: '', outfit: 'agbada', outfitColor: 0xffffff, trousersColor: 0xffffff, hairstyle: 'fila', skinTone: '#4a2e1c', hasCoralBeads: true },
    [-1.2, 5.0],
    Math.PI,
  );
  obaFig.root.name = 'kabiyesi_oba';
  obaFig.pose('stand', 'rest');

  const chiefElderFig = new Figure(
    daisGroup,
    'high_chief_elder',
    'High Chief Balogun',
    { gender: 'male', username: '', outfit: 'agbada', outfitColor: 0xb91c1c, trousersColor: 0xb91c1c, hairstyle: 'fila', skinTone: '#5e3a22', hasCoralBeads: true },
    [1.2, 5.0],
    Math.PI,
  );
  chiefElderFig.root.name = 'high_chief_elder';
  chiefElderFig.pose('stand', 'reach');

  const griotFig = new Figure(
    daisGroup,
    'royal_griot',
    'Royal Praise Singer (Alaga)',
    { gender: 'male', username: '', outfit: 'senator', outfitColor: 0xca8a04, trousersColor: 0x1e3a8a, hairstyle: 'fila', skinTone: '#6e4327' },
    [2.8, 3.4],
    Math.PI * 0.85,
  );
  griotFig.root.name = 'royal_griot';
  griotFig.pose('stand', 'wave');

  // 5. Interactive Place Action: Investiture & Homage
  const runPalaceInvestiture = (host: PlaceHost) => {
    const chieftaincy = Chieftaincy.get();
    const active = chieftaincy.activeTitleSpec();
    const nextToConfer = chieftaincy.titles().find((t) => !chieftaincy.isConferred(t.id));

    host.ask({
      who: 'Kabiyesi Oba of Lagos',
      role: 'Freedom Park · Palace Court of the Council of Chiefs',
      text: active
        ? `Kabiyesi nods graciously from the golden dais: "Greetings, ${active.prefix}! Your noble deeds bring honour to the realm. May your reign be peaceful and prosperous."`
        : `The Oba of Lagos sits upon the royal dais with the High Chiefs and the Royal Griot: "Only those of proven fame and sterling character may take a chieftaincy title before this court."`,
      choices: [
        ...(nextToConfer
          ? [
              {
                label: `👑 Take Title: ${nextToConfer.name} (₦${nextToConfer.offeringPrice.toLocaleString()})`,
                note: `Req: ${nextToConfer.fameRequired} Fame · Receives ${nextToConfer.regaliaName}`,
                pick: async () => {
                  const res = await chieftaincy.confer(nextToConfer.id);
                  if (!res.ok) {
                    host.say(res.message, 'warning');
                    return;
                  }
                  // Run 3D royal investiture sequence
                  const seq = new Sequence('royal_investiture', [host.actor, obaFig.actor, griotFig.actor]).add(
                    steps.face(host.actor, room.at(0, 4.2)),
                    steps.animate(host.actor, { arms: 'reach' }, 1.5),
                    steps.call('oba_blessing', () => {
                      obaFig.actor.say(`Kabiyesi: "By the authority of our ancestors, I invest you as ${nextToConfer.name}!"`, 3.5);
                    }),
                    steps.wait(1.5),
                    steps.call('griot_oriki', () => {
                      griotFig.actor.say(`Praise Singer: "${nextToConfer.oriki}"`, 4.0);
                      host.say(`🪘 The praise singer drums fiercely and chants your royal Oriki!`, 'info');
                    }),
                    steps.wait(2.0),
                    steps.call('celebrate', () => {
                      showGameToast(`🎉 Investiture complete! You are now ${nextToConfer.name}.`, 'success', 5000);
                    }),
                  );
                  host.director.run(seq);
                },
              },
            ]
          : []),
        {
          label: '🙇 Pay royal homage to Kabiyesi',
          note: 'Social +20, Street Cred +10',
          pick: () => {
            const seq = new Sequence('royal_homage', [host.actor, obaFig.actor]).add(
              steps.face(host.actor, room.at(-1.2, 5.0)),
              steps.animate(host.actor, { arms: 'rest' }, 2.0),
              steps.call('oba_reply', () => {
                obaFig.actor.say(active ? `Kabiyesi: "Rise, ${active.prefix}! The palace doors are always open to you."` : `Kabiyesi: "May peace and fortune walk with you on the streets of Lagos."`, 3.0);
                host.backend.modifyNeed('social', 20);
                showGameToast(`🏛️ You paid humble homage to Kabiyesi.`, 'info', 3600);
              }),
            );
            host.director.run(seq);
          },
        },
      ],
    });
  };

  room.addCard({
    id: 'palace_investiture',
    name: '👑 Palace Court & Royal Investiture',
    description: 'Palace dais at Freedom Park: Royal investiture with Kabiyesi & High Chiefs.',
    at: [0, 2.2],
    stand: [0, 2.0],
    label: () => {
      const active = Chieftaincy.get().activeTitleSpec();
      return active ? `👑 Palace Dais · Homage to Kabiyesi (${active.prefix})` : `👑 Royal Investiture Dais · Council of Chiefs`;
    },
    run: runPalaceInvestiture,
  });
}

