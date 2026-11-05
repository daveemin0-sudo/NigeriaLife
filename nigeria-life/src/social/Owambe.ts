import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import type { PlaceHost } from '../destinations/PlaceActions';
import type { HumanConfig } from '../graphics/HumanMeshBuilder';
import { Sequence, steps } from '../interactions/Sequence';
import { PlaceOpeners, type PlaceInterior } from '../interiors/places/PlaceInterior';
import { Figure } from '../interiors/places/Worship';
import { ShiftSkill } from '../jobs/ShiftSkill';
import { Activity } from '../life/Activity';
import { OnlineAccount } from '../online/OnlineAccount';
import { showGameToast } from '../ui/GameToast';
import { Builder } from '../world/kit/ArchKit';

/**
 * Owambe — Saturday parties, Aso-Ebi fabric, and spraying Naira notes in 3D at real city venues.
 *
 * Players can buy Aso-Ebi outfits, book an Owambe hall (`freedom-park`, `afrika-shrine`,
 * `ivory-rooftop`, `eko-grand-hotel`), walk into the 3D venue where the MC, Talking Drummer,
 * and Celebrant (`Figure`) are waiting beside a banquet table and VIP carpet, and act out a
 * 3-round Naira spraying sequence (`ShiftSkill`) with flying 3D Naira notes.
 */

export type AsoEbiId = 'gold-lace' | 'emerald-asooke' | 'coral-velvet';
export type OwambeTierId = 'island-birthday' | 'shrine-chieftaincy' | 'rooftop-champagne' | 'eko-grand-wedding';

export interface AsoEbiSpec {
  id: AsoEbiId;
  name: string;
  subtitle: string;
  icon: string;
  price: number;
  fameBonus: number;
  colourHex: string;
  description: string;
}

export interface OwambeSpec {
  id: OwambeTierId;
  title: string;
  occasion: string;
  venueKey: string;
  venueName: string;
  district: string;
  mcName: string;
  bandName: string;
  bookingFee: number;
  sprayBundle: number;
  baseFame: number;
  summary: string;
  stageSpot: [number, number];
  standSpot: [number, number];
  mcAppearance: HumanConfig;
  drummerAppearance: HumanConfig;
  celebrantAppearance: HumanConfig;
}

export interface OwambePartyRecord {
  id: number;
  tierId: OwambeTierId;
  title: string;
  occasion: string;
  venueKey: string;
  venueName: string;
  mcName: string;
  bandName: string;
  bookingFee: number;
  sprayBundle: number;
  asoEbiId: AsoEbiId | null;
  stars: 1 | 2 | 3;
  fameEarned: number;
  status: 'booked' | 'completed';
  bookedAt: number;
  completedAt: number | null;
}

interface OwambeSaveData {
  ownedAsoEbi: AsoEbiId[];
  equippedAsoEbi: AsoEbiId | null;
  activeParty: OwambePartyRecord | null;
  history: OwambePartyRecord[];
  nextId: number;
}

export const ASO_EBI_SPECS: readonly AsoEbiSpec[] = [
  {
    id: 'gold-lace',
    name: 'Royal Gold Lace & Fila',
    subtitle: 'Balogun Market dry lace with hand-embroidered cap',
    icon: '👑',
    price: 15_000,
    fameBonus: 5,
    colourHex: '#eab308',
    description: 'Shimmering gold Swiss lace tailored for Lagos Saturday celebrations (+5 Owambe Fame bonus).',
  },
  {
    id: 'emerald-asooke',
    name: 'Emerald Handwoven Aso-Oke',
    subtitle: 'Heavy Iseyin woven agbada & gele set',
    icon: '💚',
    price: 25_000,
    fameBonus: 10,
    colourHex: '#10b981',
    description: 'Rich emerald Aso-Oke with silver threadwork that commands the high table (+10 Owambe Fame bonus).',
  },
  {
    id: 'coral-velvet',
    name: 'Coral Velvet & Edo Beads',
    subtitle: 'Ceremonial velvet with royal coral neck beads',
    icon: '🧣',
    price: 40_000,
    fameBonus: 15,
    colourHex: '#e11d48',
    description: 'Chieftaincy-grade crimson velvet with multi-strand coral beads (+15 Owambe Fame bonus).',
  },
];

export const OWAMBE_SPECS: readonly OwambeSpec[] = [
  {
    id: 'island-birthday',
    title: 'Lagos Island Birthday Owambe',
    occasion: 'Milestone Birthday Bash',
    venueKey: 'freedom-park',
    venueName: 'Freedom Park',
    district: 'Lagos Island',
    mcName: 'Alhaji Tunde Gold',
    bandName: 'Sunny & The Jùjú Rockets',
    bookingFee: 35_000,
    sprayBundle: 15_000,
    baseFame: 15,
    summary: 'Open-air amphitheatre birthday bash with smoky party jollof, talking drums, and lively Island guests.',
    stageSpot: [-6.2, 4.2],
    standSpot: [-6.2, 6.0],
    mcAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0xeab308,
      outfit: 'agbada',
      hairstyle: 'short_crop',
    },
    drummerAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0x16a34a,
      outfit: 'senator',
      hairstyle: 'short_crop',
    },
    celebrantAppearance: {
      gender: 'female',
      username: '',
      outfitColor: 0xdc2626,
      outfit: 'blue_dress',
      hairstyle: 'gele',
    },
  },
  {
    id: 'shrine-chieftaincy',
    title: 'Kalakuta Chieftaincy Night',
    occasion: 'Chieftaincy & Afrobeat Celebration',
    venueKey: 'afrika-shrine',
    venueName: 'New Afrika Shrine',
    district: 'Ikeja',
    mcName: 'MC Shakara',
    bandName: 'Kalakuta Horns Collective',
    bookingFee: 55_000,
    sprayBundle: 25_000,
    baseFame: 22,
    summary: 'Brass horns, heavy percussion, and mainland chiefs spraying crisp notes till daybreak.',
    stageSpot: [-6.8, 3.6],
    standSpot: [-6.8, 5.4],
    mcAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0xdc2626,
      outfit: 'senator',
      hairstyle: 'afro',
    },
    drummerAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0xfacc15,
      outfit: 'casual_tee',
      hairstyle: 'short_crop',
    },
    celebrantAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0x10b981,
      outfit: 'agbada',
      hairstyle: 'short_crop',
    },
  },
  {
    id: 'rooftop-champagne',
    title: 'VI Champagne & Lace Soirée',
    occasion: 'Victoria Island Society Night',
    venueKey: 'ivory-rooftop',
    venueName: 'Ivory Rooftop',
    district: 'Victoria Island',
    mcName: 'Hypeman Dotun',
    bandName: 'Eko Alte & Talking Drums',
    bookingFee: 85_000,
    sprayBundle: 40_000,
    baseFame: 30,
    summary: 'Skyline views over Victoria Island, sparklers, designer Aso-Ebi, and bundles of mint notes.',
    stageSpot: [6.0, 3.8],
    standSpot: [6.0, 5.5],
    mcAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0x9333ea,
      outfit: 'senator',
      hairstyle: 'short_crop',
    },
    drummerAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0x38bdf8,
      outfit: 'casual_tee',
      hairstyle: 'short_crop',
    },
    celebrantAppearance: {
      gender: 'female',
      username: '',
      outfitColor: 0xf43f5e,
      outfit: 'blue_dress',
      hairstyle: 'gele',
    },
  },
  {
    id: 'eko-grand-wedding',
    title: 'Eko Grand Society Wedding',
    occasion: 'Grand Ballroom Society Owambe',
    venueKey: 'eko-grand-hotel',
    venueName: 'Eko Grand Hotel',
    district: 'Victoria Island',
    mcName: 'Chief Ebenezer',
    bandName: 'King Sunny Jùjú Orchestra',
    bookingFee: 120_000,
    sprayBundle: 60_000,
    baseFame: 45,
    summary: 'The biggest society wedding in Lagos: five-star ballroom, full Jùjú orchestra, and high-table dignitaries.',
    stageSpot: [1.2, -1.8],
    standSpot: [1.2, 0.2],
    mcAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0xfef08a,
      outfit: 'agbada',
      hairstyle: 'short_crop',
    },
    drummerAppearance: {
      gender: 'male',
      username: '',
      outfitColor: 0x2563eb,
      outfit: 'senator',
      hairstyle: 'short_crop',
    },
    celebrantAppearance: {
      gender: 'female',
      username: '',
      outfitColor: 0xe11d48,
      outfit: 'blue_dress',
      hairstyle: 'gele',
    },
  },
];

export class Owambe {
  private static instance: Owambe | null = null;
  public static get(): Owambe {
    return (Owambe.instance ??= new Owambe());
  }

  public onChange: (() => void) | null = null;
  private loadedFor = '';
  private data: OwambeSaveData = {
    ownedAsoEbi: [],
    equippedAsoEbi: null,
    activeParty: null,
    history: [],
    nextId: 1,
  };

  private key(): string {
    return `nl_owambe_v1:${Activity.player()}`;
  }

  private load(): void {
    if (OnlineAccount.get() !== null) return;
    const k = this.key();
    if (this.loadedFor === k) return;
    this.loadedFor = k;
    try {
      const raw = JSON.parse(localStorage.getItem(k) || 'null') as Partial<OwambeSaveData> | null;
      if (raw && typeof raw === 'object') {
        this.data = {
          ownedAsoEbi: Array.isArray(raw.ownedAsoEbi) ? raw.ownedAsoEbi : [],
          equippedAsoEbi: raw.equippedAsoEbi ?? (Array.isArray(raw.ownedAsoEbi) && raw.ownedAsoEbi[0] ? raw.ownedAsoEbi[0] : null),
          activeParty: raw.activeParty ?? null,
          history: Array.isArray(raw.history) ? raw.history : [],
          nextId: Number(raw.nextId) || 1,
        };
        return;
      }
    } catch {
      // ignore malformed storage
    }
    this.data = { ownedAsoEbi: [], equippedAsoEbi: null, activeParty: null, history: [], nextId: 1 };
  }

  private save(): void {
    if (OnlineAccount.get() !== null) return;
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.data));
    } catch {
      // ignore private window errors
    }
  }

  private changed(): void {
    this.onChange?.();
  }

  public asoEbiCatalogue(): readonly AsoEbiSpec[] {
    return ASO_EBI_SPECS;
  }

  public partySpecs(): readonly OwambeSpec[] {
    return OWAMBE_SPECS;
  }

  public specFor(tierId: string): OwambeSpec | null {
    return OWAMBE_SPECS.find((s) => s.id === tierId) ?? null;
  }

  public specAtVenue(venueKey: string): OwambeSpec | null {
    return OWAMBE_SPECS.find((s) => s.venueKey === venueKey) ?? null;
  }

  public asoEbiSpec(id: string | null | undefined): AsoEbiSpec | null {
    if (!id) return null;
    return ASO_EBI_SPECS.find((a) => a.id === id) ?? null;
  }

  public ownedAsoEbi(): AsoEbiId[] {
    this.load();
    return [...this.data.ownedAsoEbi];
  }

  public equippedAsoEbi(): AsoEbiSpec | null {
    this.load();
    return this.asoEbiSpec(this.data.equippedAsoEbi);
  }

  public activeParty(): OwambePartyRecord | null {
    this.load();
    return this.data.activeParty ? { ...this.data.activeParty } : null;
  }

  public history(): OwambePartyRecord[] {
    this.load();
    return this.data.history.map((h) => ({ ...h }));
  }

  public totalSprayed(): number {
    this.load();
    return this.data.history.reduce((sum, p) => sum + p.sprayBundle, 0);
  }

  public fameEarned(): number {
    this.load();
    return this.data.history.reduce((sum, p) => sum + p.fameEarned, 0);
  }

  public socialTitle(): string {
    const f = this.fameEarned();
    if (f >= 80) return 'Olowo Eko (Grand Patron)';
    if (f >= 40) return 'High-Table Chief';
    if (f >= 15) return 'Owambe Celebrant';
    return 'Party Guest';
  }

  public async syncFromServer(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    try {
      const res = (await online.request('/owambe')) as {
        ok?: boolean;
        ownedAsoEbi?: AsoEbiId[];
        equippedAsoEbi?: AsoEbiId | null;
        activeParty?: OwambePartyRecord | null;
        history?: OwambePartyRecord[];
      } | null;
      if (res?.ok) {
        this.applySnapshot(res);
      }
    } catch {
      // ignore transient offline
    }
  }

  private applySnapshot(snap: {
    ownedAsoEbi?: AsoEbiId[];
    equippedAsoEbi?: AsoEbiId | null;
    activeParty?: OwambePartyRecord | null;
    history?: OwambePartyRecord[];
  }): void {
    if (Array.isArray(snap.ownedAsoEbi)) this.data.ownedAsoEbi = snap.ownedAsoEbi;
    if (snap.equippedAsoEbi !== undefined) this.data.equippedAsoEbi = snap.equippedAsoEbi;
    if (snap.activeParty !== undefined) this.data.activeParty = snap.activeParty;
    if (Array.isArray(snap.history)) this.data.history = snap.history;
    this.save();
    this.changed();
  }

  public equipAsoEbi(id: AsoEbiId): { ok: boolean; message: string } {
    this.load();
    const spec = this.asoEbiSpec(id);
    if (!spec || !this.data.ownedAsoEbi.includes(id)) {
      return { ok: false, message: 'Buy that Aso-Ebi fabric first.' };
    }
    this.data.equippedAsoEbi = id;
    this.save();
    this.changed();
    return { ok: true, message: `Wearing ${spec.name} (+${spec.fameBonus} Owambe Fame bonus).` };
  }

  public async buyAsoEbi(asoEbiId: AsoEbiId): Promise<{ ok: boolean; message: string }> {
    this.load();
    const spec = this.asoEbiSpec(asoEbiId);
    if (!spec) return { ok: false, message: 'That Aso-Ebi fabric is not available.' };
    if (this.data.ownedAsoEbi.includes(asoEbiId)) {
      this.data.equippedAsoEbi = asoEbiId;
      this.save();
      this.changed();
      return { ok: true, message: `Equipped ${spec.name}.` };
    }

    const backend = BackendService.getInstance();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/owambe/aso-ebi', { asoEbiId, now: Date.now() })) as {
        ok?: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
        snapshot?: Parameters<Owambe['applySnapshot']>[0];
      } | null;
      if (!res?.ok) {
        return { ok: false, message: res?.reason ?? `Could not buy ${spec.name}.` };
      }
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) this.applySnapshot(res.snapshot);
    } else {
      let paid = backend.processTransaction({
        type: 'SHOP_PURCHASE',
        amount: spec.price,
        description: `Aso-Ebi: ${spec.name}`,
        source: 'bank',
        funding: 'strict',
      });
      if (!paid.success) {
        paid = backend.processTransaction({
          type: 'SHOP_PURCHASE',
          amount: spec.price,
          description: `Aso-Ebi: ${spec.name}`,
          source: 'wallet',
          funding: 'strict',
        });
      }
      if (!paid.success) {
        return { ok: false, message: `You need ₦${spec.price.toLocaleString()} to buy ${spec.name}.` };
      }
      this.data.ownedAsoEbi.unshift(asoEbiId);
      this.data.equippedAsoEbi = asoEbiId;
      this.save();
      this.changed();
    }

    backend.addItem({
      id: `asoebi_${spec.id}`,
      name: spec.name,
      icon: spec.icon,
      price: spec.price,
      category: 'luxury',
      usable: false,
      description: spec.description,
    });

    return {
      ok: true,
      message: `${spec.icon} Bought & wore ${spec.name} (+${spec.fameBonus} Owambe Fame bonus)!`,
    };
  }

  public async bookParty(tierId: OwambeTierId): Promise<{ ok: boolean; message: string }> {
    this.load();
    const spec = this.specFor(tierId);
    if (!spec) return { ok: false, message: 'That Owambe party package does not exist.' };
    if (this.data.activeParty) {
      return {
        ok: false,
        message: `You already have ${this.data.activeParty.title} booked at ${this.data.activeParty.venueName}. Visit ${this.data.activeParty.venueName} to spray first!`,
      };
    }

    const backend = BackendService.getInstance();
    const now = Date.now();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/owambe/book', { tierId, now })) as {
        ok?: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
        snapshot?: Parameters<Owambe['applySnapshot']>[0];
      } | null;
      if (!res?.ok) {
        return { ok: false, message: res?.reason ?? `Could not book ${spec.title}.` };
      }
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) this.applySnapshot(res.snapshot);
    } else {
      let paid = backend.processTransaction({
        type: 'SHOP_PURCHASE',
        amount: spec.bookingFee,
        description: `Owambe Booking: ${spec.title} at ${spec.venueName}`,
        source: 'bank',
        funding: 'strict',
      });
      if (!paid.success) {
        paid = backend.processTransaction({
          type: 'SHOP_PURCHASE',
          amount: spec.bookingFee,
          description: `Owambe Booking: ${spec.title} at ${spec.venueName}`,
          source: 'wallet',
          funding: 'strict',
        });
      }
      if (!paid.success) {
        return {
          ok: false,
          message: `You need ₦${spec.bookingFee.toLocaleString()} to book ${spec.title} at ${spec.venueName}.`,
        };
      }

      const id = this.data.nextId++;
      this.data.activeParty = {
        id,
        tierId: spec.id,
        title: spec.title,
        occasion: spec.occasion,
        venueKey: spec.venueKey,
        venueName: spec.venueName,
        mcName: spec.mcName,
        bandName: spec.bandName,
        bookingFee: spec.bookingFee,
        sprayBundle: spec.sprayBundle,
        asoEbiId: this.data.equippedAsoEbi,
        stars: 3,
        fameEarned: 0,
        status: 'booked',
        bookedAt: now,
        completedAt: null,
      };
      this.save();
      this.changed();
    }

    return {
      ok: true,
      message: `🎉 Booked ${spec.title} at ${spec.venueName}! Head inside ${spec.venueName} to spray Naira with ${spec.mcName}.`,
    };
  }

  public async sprayOnFloor(
    venueKey: string,
    stars: 1 | 2 | 3 = 3,
  ): Promise<{ ok: boolean; message: string; fameEarned?: number; paid?: number }> {
    this.load();
    const active = this.data.activeParty;
    if (!active || active.venueKey !== venueKey) {
      return { ok: false, message: 'No active Owambe party booked at this venue.' };
    }

    const spec = this.specFor(active.tierId);
    if (!spec) return { ok: false, message: 'Owambe package not found.' };

    const backend = BackendService.getInstance();
    const now = Date.now();
    const online = OnlineAccount.get();
    let fameEarned = 0;

    if (online) {
      const res = (await online.request('/owambe/spray', { venueKey, stars, now })) as {
        ok?: boolean;
        reason?: string;
        fameEarned?: number;
        wallet?: { cash: number; bank: number };
        snapshot?: Parameters<Owambe['applySnapshot']>[0];
      } | null;
      if (!res?.ok) {
        return { ok: false, message: res?.reason ?? 'Could not complete Naira spray.' };
      }
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) this.applySnapshot(res.snapshot);
      fameEarned = res.fameEarned ?? spec.baseFame;
    } else {
      let paid = backend.processTransaction({
        type: 'SHOP_PURCHASE',
        amount: active.sprayBundle,
        description: `Owambe Naira Spray at ${active.venueName}`,
        source: 'bank',
        funding: 'strict',
      });
      if (!paid.success) {
        paid = backend.processTransaction({
          type: 'SHOP_PURCHASE',
          amount: active.sprayBundle,
          description: `Owambe Naira Spray at ${active.venueName}`,
          source: 'wallet',
          funding: 'strict',
        });
      }
      if (!paid.success) {
        return {
          ok: false,
          message: `You need ₦${active.sprayBundle.toLocaleString()} for mint Naira notes to spray at ${active.venueName}.`,
        };
      }

      const asoBonus = active.asoEbiId ? (this.asoEbiSpec(active.asoEbiId)?.fameBonus ?? 0) : 0;
      const starBonus = stars === 3 ? 10 : stars === 2 ? 5 : 0;
      fameEarned = spec.baseFame + asoBonus + starBonus;

      const completed: OwambePartyRecord = {
        ...active,
        stars,
        fameEarned,
        status: 'completed',
        completedAt: now,
      };
      this.data.activeParty = null;
      this.data.history.unshift(completed);
      this.save();
      this.changed();
    }

    // Restore player needs and give Owambe Souvenir & Party Jollof pack
    backend.modifyNeed('social', 35);
    backend.modifyNeed('fun', 40);
    backend.modifyNeed('hunger', 30);
    backend.addItem({
      id: 'owambe_jollof_pack',
      name: 'Owambe Party Jollof & Souvenir Pack',
      icon: '🎁',
      price: 6000,
      category: 'food',
      usable: true,
      energyRestore: 35,
      description: `Smoky firewood party jollof, fried plantain, peppered goat meat, and a takeaway souvenir from ${spec.venueName}.`,
    });

    Activity.emit({ kind: 'acted', id: `owambe_spray_${spec.id}` });
    const msg = `💸 Sprayed ₦${active.sprayBundle.toLocaleString()} at ${spec.venueName} (${'★'.repeat(stars)})! +${fameEarned} Owambe Fame, +35 Social, +40 Fun & Party Jollof Pack!`;
    showGameToast(msg, 'success');
    return { ok: true, message: msg, fameEarned, paid: active.sprayBundle };
  }
}

/**
 * Builds the 3D Owambe high-table, VIP dance carpet, PA speakers, balloon pillars,
 * flying Naira notes, and 3D Figure characters (MC, Talking Drummer, Celebrant) inside
 * the venue (`freedom-park`, `afrika-shrine`, `ivory-rooftop`, `eko-grand-hotel`).
 */
export function attachOwambe(room: PlaceInterior): void {
  const owambe = Owambe.get();
  const spec = owambe.specAtVenue(room.spec.key);
  if (!spec) return;

  const [sx, sz] = spec.stageSpot;
  const [px, pz] = spec.standSpot;

  const setGroup = new THREE.Group();
  setGroup.name = `owambe_set_${spec.venueKey}`;

  // Build VIP carpet, high-table banquet setup, gold balloon pillars, and speaker stack
  const b = new Builder();
  // Gold outer border + crimson VIP dance carpet
  b.box(0xfacc15, 3.6, 0.025, 2.8, 0, 0.01, 0.4)
    .box(0x991b1b, 3.3, 0.03, 2.5, 0, 0.015, 0.4);
  // High table at the back of the carpet with white tablecloth, gold runner, champagne & chafing dishes
  b.box(0xf8fafc, 2.4, 0.76, 0.75, 0, 0, -0.75)
    .box(0xeab308, 2.44, 0.18, 0.78, 0, 0.62, -0.75)
    .cylinder(0xcbd5e1, 0.22, 0.18, -0.65, 0.76, -0.75, { sides: 12 })
    .dome(0xe2e8f0, 0.2, -0.65, 0.94, -0.75)
    .cylinder(0xcbd5e1, 0.22, 0.18, 0.65, 0.76, -0.75, { sides: 12 })
    .dome(0xe2e8f0, 0.2, 0.65, 0.94, -0.75)
    .cylinder(0x15803d, 0.06, 0.34, -0.12, 0.76, -0.7, { sides: 10 })
    .cylinder(0xfacc15, 0.06, 0.34, 0.12, 0.76, -0.7, { sides: 10 });
  // Gold & crimson balloon arches/pillars flanking the carpet
  for (const side of [-1.6, 1.6]) {
    b.cylinder(0xd97706, 0.05, 1.8, side, 0, -0.6)
      .dome(0xfacc15, 0.24, side, 1.4, -0.6, { glow: true })
      .dome(0xdc2626, 0.22, side, 1.72, -0.6)
      .dome(0xfef08a, 0.2, side, 2.0, -0.6, { glow: true });
  }
  // PA speaker stack on the right
  b.box(0x111827, 0.55, 1.35, 0.48, 1.55, 0, 0.2)
    .cylinder(0x38bdf8, 0.14, 0.04, 1.55, 0.95, 0.45, { pitch: Math.PI / 2, glow: true });

  const stageMesh = b.build(`owambe_stage_${spec.venueKey}`);
  setGroup.add(stageMesh);

  // Three 3D Figures: MC, Talking Drummer, and Celebrant
  const mcFig = new Figure(setGroup, `owambe-mc-${spec.venueKey}`, spec.mcName, spec.mcAppearance, [-0.85, -0.15], 0.2);
  mcFig.pose('stand', 'wave');

  const drummerFig = new Figure(
    setGroup,
    `owambe-drummer-${spec.venueKey}`,
    'Talking Drummer',
    spec.drummerAppearance,
    [0.95, -0.15],
    -0.25,
  );
  drummerFig.pose('stand', 'reach');

  const celebrantFig = new Figure(
    setGroup,
    `owambe-celebrant-${spec.venueKey}`,
    'Celebrant',
    spec.celebrantAppearance,
    [0, 0.35],
    0,
  );
  celebrantFig.pose('dance', 'wave');

  // 3D Flying Naira Notes group (visible during active Owambe / spraying)
  const notesGroup = new THREE.Group();
  notesGroup.name = `owambe-naira-notes-${spec.venueKey}`;
  const noteGeo = new THREE.BoxGeometry(0.22, 0.008, 0.11);
  const noteMatGreen = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 });
  const noteMatGold = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
  const noteItems: Array<{ mesh: THREE.Mesh; phase: number; radius: number; speed: number }> = [];
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(noteGeo, i % 2 === 0 ? noteMatGreen : noteMatGold);
    const angle = (i / 14) * Math.PI * 2;
    const radius = 0.35 + (i % 3) * 0.22;
    mesh.position.set(Math.cos(angle) * radius, 1.1 + (i % 4) * 0.28, 0.35 + Math.sin(angle) * radius);
    mesh.rotation.set(0.3 * i, angle, 0.2 * i);
    notesGroup.add(mesh);
    noteItems.push({ mesh, phase: i * 0.45, radius, speed: 1.8 + (i % 3) * 0.4 });
  }
  setGroup.add(notesGroup);

  setGroup.position.set(sx, 0, sz);
  room.group.add(setGroup);

  let clock = 0;
  let sprayingNow = false;

  room.ticks.push((dt) => {
    clock += dt;
    const active = owambe.activeParty();
    const isBookedHere = active?.venueKey === spec.venueKey;
    notesGroup.visible = isBookedHere || sprayingNow;

    mcFig.tick(dt);
    drummerFig.tick(dt);
    celebrantFig.tick(dt);

    if (notesGroup.visible) {
      for (const n of noteItems) {
        const t = clock * n.speed + n.phase;
        n.mesh.position.x = Math.cos(t) * n.radius;
        n.mesh.position.z = 0.35 + Math.sin(t) * n.radius;
        n.mesh.position.y = 0.45 + ((1.8 - ((t * 0.45) % 1.6) + 1.6) % 1.6);
        n.mesh.rotation.y = t;
        n.mesh.rotation.z = Math.sin(t * 2) * 0.6;
      }
    }
  });

  const runSpray = (host: PlaceHost) => {
    if (sprayingNow) return;
    const active = owambe.activeParty();
    if (!active || active.venueKey !== spec.venueKey) {
      host.ask({
        who: spec.mcName,
        role: `${spec.title} · ${spec.bandName}`,
        text: `Welcome to ${spec.venueName}! Book "${spec.title}" (₦${spec.bookingFee.toLocaleString()}) in the Owambe app to host your celebration and spray Naira on the VIP carpet.`,
        choices: [
          {
            label: '🎉 Open Owambe app to book',
            note: `Booking ₦${spec.bookingFee.toLocaleString()} · Spray ₦${spec.sprayBundle.toLocaleString()}`,
            pick: () => {
              PlaceOpeners.open('app:owambe', host);
            },
          },
          { label: 'Maybe later', pick: () => undefined },
        ],
      });
      return;
    }

    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    sprayingNow = true;
    notesGroup.visible = true;

    const skill = ShiftSkill.get();
    skill.begin(`Spray: ${spec.title}`, 3);
    let sweep: { end(): void } | null = null;

    const seq = new Sequence(`owambe_spray_${spec.venueKey}`, [actor]);
    seq.maxSeconds = 90;
    seq.add(
      steps.walk(actor, room.at(px, pz), { speed: 2.8, ifStuck: 'snap' }),
      steps.face(actor, room.at(sx, sz)),
      steps.call('owambe-welcome', () => {
        mcFig.pose('dance', 'wave');
        mcFig.say(`Olowo Eko! Welcome to ${spec.title}!`, 2.2);
      }),
    );

    const chants = [
      'Spend am! Money na water!!',
      'Aso-Ebi looking royal on the floor!',
      'Chairman! The whole hall dey hail you!',
    ];

    chants.forEach((chant, idx) => {
      seq.add(
        steps.call(`spray-round-${idx + 1}`, () => {
          sweep = skill.round();
          host.say(`💸 Spray Round ${idx + 1}/3: "${chant}"`, 'info');
        }),
        steps.animate(actor, { arms: 'wave', legs: 'dance' }, 2.2, [
          {
            at: 0.45,
            run: () => {
              celebrantFig.pose('dance', 'wave');
              celebrantFig.say(chant, 1.8);
            },
          },
          {
            at: 0.95,
            run: () => {
              sweep?.end();
              sweep = null;
            },
          },
        ]),
        steps.animate(actor, { arms: 'rest', legs: 'stand' }, 0.15),
      );
    });

    seq.add(
      steps.settle(`owambe-settle-${spec.venueKey}`, async () => {
        const rated = skill.finish(active.sprayBundle);
        const done = await owambe.sprayOnFloor(spec.venueKey, rated.stars);
        if (!done.ok) {
          host.say(done.message, 'warning');
          return false;
        }
        return true;
      }),
    );

    seq.onEnd((reason) => {
      sweep?.end();
      sweep = null;
      if (reason !== 'done') {
        skill.finish(0);
      }
      sprayingNow = false;
    });

    if (!host.director.run(seq)) {
      skill.finish(0);
      sprayingNow = false;
    }
  };

  room.addCard({
    id: `owambe_${spec.venueKey}`,
    name: `🎉 ${spec.title}`,
    description: `${spec.mcName} and ${spec.bandName} are on stage at ${spec.venueName}.`,
    at: [sx, sz],
    stand: [px, pz],
    label: () => {
      const active = owambe.activeParty();
      if (active?.venueKey === spec.venueKey) {
        return `🎉 Spray Naira at ${spec.title} (${spec.venueName}) · ₦${active.sprayBundle.toLocaleString()}`;
      }
      return `🎉 Owambe Hall: ${spec.title} · ${spec.mcName}`;
    },
    run: runSpray,
  });
}
