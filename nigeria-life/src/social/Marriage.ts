import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { SPARK_PROFILES, Spark, type SparkProfile, type SparkProfileId } from './Spark';
import { Figure } from '../interiors/places/Worship';
import { showGameToast } from '../ui/GameToast';
import { Activity } from '../life/Activity';
import type { HomePlan } from '../housing/HomePlan';
import type { InteractiveObject } from '../world/World';
import { Fridge } from '../housing/Fridge';

/**
 * Marriage, proposals, and spouse system.
 * - Ring shops at Computer Village (reputable jewellery counter).
 * - Proposals at the date venue when closeness >= 60 with a purchased ring.
 * - Traditional wedding celebration (dowry payment, owambe blessings).
 * - Spouse living in player's home (`ResidentialInterior`):
 *   stands inside parlour, greets player, cooks home meals, and offers sweet dialogue.
 */

export type RingTierId = 'silver' | 'gold' | 'diamond';

export interface WeddingRingSpec {
  id: RingTierId;
  name: string;
  icon: string;
  price: number;
  closenessBonus: number;
  description: string;
}

export const WEDDING_RINGS: Record<RingTierId, WeddingRingSpec> = {
  silver: {
    id: 'silver',
    name: 'Silver Promise Band',
    icon: '💍',
    price: 35_000,
    closenessBonus: 10,
    description: 'Polished sterling silver band with delicate engraving. A sincere symbol of commitment.',
  },
  gold: {
    id: 'gold',
    name: '18K Yellow Gold Wedding Ring',
    icon: '👑',
    price: 120_000,
    closenessBonus: 20,
    description: 'Heavy solid 18-karat yellow gold ring. The traditional Lagos standard of honour.',
  },
  diamond: {
    id: 'diamond',
    name: 'Solitaire Platinum Diamond Ring',
    icon: '💎',
    price: 350_000,
    closenessBonus: 30,
    description: 'Flawless brilliant-cut solitaire diamond set in pure platinum. Pure Ikoyi luxury.',
  },
};

export interface MarriageState {
  spouseId: SparkProfileId;
  spouseName: string;
  ringTier: RingTierId;
  status: 'engaged' | 'married';
  closeness: number;
  proposedAt: number;
  marriedAt: number | null;
  dowryPaid: number;
}

export interface MarriageSaveData {
  rings: RingTierId[];
  marriage: MarriageState | null;
}

export class Marriage {
  private static instance: Marriage | null = null;
  public static get(): Marriage {
    return (Marriage.instance ??= new Marriage());
  }

  public onChange: (() => void) | null = null;
  private loadedFor = '';
  private data: MarriageSaveData = {
    rings: [],
    marriage: null,
  };

  private homeFigure: Figure | null = null;
  private homeGroup: THREE.Group | null = null;
  private homePlan: HomePlan | null = null;
  private homeInteractive: InteractiveObject[] = [];

  private key(): string {
    return `nl_marriage_v1:${Activity.player()}`;
  }

  private load(): void {
    if (OnlineAccount.get() !== null) return;
    const k = this.key();
    if (this.loadedFor === k) return;
    this.loadedFor = k;
    try {
      const raw = JSON.parse(localStorage.getItem(k) || 'null') as Partial<MarriageSaveData> | null;
      if (raw && typeof raw === 'object') {
        this.data = {
          rings: Array.isArray(raw.rings) ? raw.rings : [],
          marriage: raw.marriage ?? null,
        };
        return;
      }
    } catch {
      // ignore malformed storage
    }
    this.data = { rings: [], marriage: null };
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
    this.data = { rings: [], marriage: null };
    this.save();
    this.refreshHomeFigure();
    this.changed();
  }

  public ringsOwned(): RingTierId[] {
    this.load();
    return [...this.data.rings];
  }

  public ownedRings(): RingTierId[] {
    return this.ringsOwned();
  }

  public bestRing(): RingTierId | null {
    const owned = this.ringsOwned();
    if (owned.includes('diamond')) return 'diamond';
    if (owned.includes('gold')) return 'gold';
    if (owned.includes('silver')) return 'silver';
    return null;
  }

  public currentMarriage(): MarriageState | null {
    this.load();
    return this.data.marriage ? { ...this.data.marriage } : null;
  }

  public snapshot(): { ok: true; rings: RingTierId[]; marriage: MarriageState | null } {
    this.load();
    return {
      ok: true,
      rings: [...this.data.rings],
      marriage: this.data.marriage ? { ...this.data.marriage } : null,
    };
  }

  public isMarried(): boolean {
    this.load();
    return this.data.marriage?.status === 'married';
  }

  public isEngaged(): boolean {
    this.load();
    return this.data.marriage?.status === 'engaged';
  }

  public spouseProfile(): SparkProfile | null {
    const m = this.currentMarriage();
    if (!m) return null;
    return SPARK_PROFILES.find((p) => p.id === m.spouseId) ?? null;
  }

  public async syncFromServer(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    try {
      const res = (await online.request('/marriage')) as {
        ok?: boolean;
        rings?: RingTierId[];
        marriage?: MarriageState | null;
      } | null;
      if (res?.ok) {
        if (Array.isArray(res.rings)) this.data.rings = res.rings;
        if (res.marriage !== undefined) this.data.marriage = res.marriage;
        this.save();
        this.changed();
        this.refreshHomeFigure();
      }
    } catch {
      // ignore network errors
    }
  }

  public async buyRing(ringId: RingTierId): Promise<{ ok: boolean; message: string }> {
    this.load();
    const spec = WEDDING_RINGS[ringId];
    if (!spec) return { ok: false, message: 'Invalid wedding ring selection.' };
    if (this.data.rings.includes(ringId)) {
      return { ok: false, message: `You already own the ${spec.name}.` };
    }

    const backend = BackendService.getInstance();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/marriage/ring', { ringId, now: Date.now() })) as {
        ok?: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
        snapshot?: { rings: RingTierId[]; marriage: MarriageState | null };
      } | null;
      if (!res?.ok) return { ok: false, message: res?.reason ?? `Could not buy ${spec.name}.` };
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) {
        this.data.rings = res.snapshot.rings;
        this.data.marriage = res.snapshot.marriage;
        this.save();
        this.changed();
      }
    } else {
      let paid = backend.processTransaction({
        type: 'SHOP_PURCHASE',
        amount: spec.price,
        description: `Jewellery: ${spec.name}`,
        source: 'bank',
        funding: 'strict',
      });
      if (!paid.success) {
        paid = backend.processTransaction({
          type: 'SHOP_PURCHASE',
          amount: spec.price,
          description: `Jewellery: ${spec.name}`,
          source: 'wallet',
          funding: 'strict',
        });
      }
      if (!paid.success) {
        return { ok: false, message: `You need ₦${spec.price.toLocaleString()} for the ${spec.name}.` };
      }
      this.data.rings.push(ringId);
      this.save();
      this.changed();
    }

    backend.addItem({
      id: `ring_${spec.id}`,
      name: spec.name,
      category: 'luxury',
      icon: spec.icon,
      price: spec.price,
      description: spec.description,
      usable: false,
    });

    showGameToast(`💍 Bought ${spec.name}! Keep it safe for your proposal.`, 'success', 4000);
    return { ok: true, message: `Purchased ${spec.name}.` };
  }

  public async propose(spouseId: SparkProfileId, ringId: RingTierId): Promise<{ ok: boolean; message: string }> {
    this.load();
    const profile = SPARK_PROFILES.find((p) => p.id === spouseId);
    if (!profile) return { ok: false, message: 'Invalid proposal partner.' };
    if (this.data.marriage) {
      return { ok: false, message: `You are already ${this.data.marriage.status} to ${this.data.marriage.spouseName}.` };
    }
    const ring = WEDDING_RINGS[ringId];
    if (!ring || !this.data.rings.includes(ringId)) {
      return { ok: false, message: 'You must buy a wedding ring before proposing.' };
    }

    const spark = Spark.get();
    const match = spark.matches().find((m) => m.profileId === spouseId);
    if (!match || match.closeness < 60) {
      return { ok: false, message: `You need at least 60% closeness with ${profile.name} before proposing.` };
    }

    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/marriage/propose', { spouseId, ringId, now: Date.now() })) as {
        ok?: boolean;
        reason?: string;
        marriage?: MarriageState;
        snapshot?: { rings: RingTierId[]; marriage: MarriageState | null };
      } | null;
      if (!res?.ok) return { ok: false, message: res?.reason ?? 'Could not complete proposal.' };
      if (res.snapshot) {
        this.data.rings = res.snapshot.rings;
        this.data.marriage = res.snapshot.marriage;
        this.save();
        this.changed();
      }
    } else {
      const newCloseness = Math.min(100, match.closeness + ring.closenessBonus);
      match.closeness = newCloseness;
      this.data.marriage = {
        spouseId,
        spouseName: profile.name,
        ringTier: ringId,
        status: 'engaged',
        closeness: newCloseness,
        proposedAt: Date.now(),
        marriedAt: null,
        dowryPaid: 0,
      };
      this.save();
      this.changed();
    }

    Activity.emit({ kind: 'acted', id: `proposed to ${profile.name}` });
    showGameToast(`💍 ${profile.name} said YES! You are officially engaged! ❤️`, 'success', 5000);
    return { ok: true, message: `${profile.name} accepted your proposal!` };
  }

  public async marry(dowryAmount = 75_000): Promise<{ ok: boolean; message: string }> {
    this.load();
    if (!this.data.marriage) {
      return { ok: false, message: 'You must get engaged before holding a wedding ceremony.' };
    }
    if (this.data.marriage.status === 'married') {
      return { ok: false, message: `You are already married to ${this.data.marriage.spouseName}.` };
    }

    const backend = BackendService.getInstance();
    const online = OnlineAccount.get();
    if (online) {
      const res = (await online.request('/marriage/marry', { dowry: dowryAmount, now: Date.now() })) as {
        ok?: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
        snapshot?: { rings: RingTierId[]; marriage: MarriageState | null };
      } | null;
      if (!res?.ok) return { ok: false, message: res?.reason ?? 'Could not hold wedding ceremony.' };
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) {
        this.data.rings = res.snapshot.rings;
        this.data.marriage = res.snapshot.marriage;
        this.save();
        this.changed();
      }
    } else {
      let paid = backend.processTransaction({
        type: 'RENT_PAYMENT',
        amount: dowryAmount,
        description: `Traditional Wedding Dowry & Ceremony: ${this.data.marriage.spouseName}`,
        source: 'bank',
        funding: 'strict',
      });
      if (!paid.success) {
        paid = backend.processTransaction({
          type: 'RENT_PAYMENT',
          amount: dowryAmount,
          description: `Traditional Wedding Dowry & Ceremony: ${this.data.marriage.spouseName}`,
          source: 'wallet',
          funding: 'strict',
        });
      }
      if (!paid.success) {
        return { ok: false, message: `You need ₦${dowryAmount.toLocaleString()} to pay the dowry and host the wedding ceremony.` };
      }
      this.data.marriage.status = 'married';
      this.data.marriage.marriedAt = Date.now();
      this.data.marriage.dowryPaid = dowryAmount;
      this.data.marriage.closeness = 100;
      this.save();
      this.changed();
    }

    const spouseName = this.data.marriage?.spouseName ?? 'Spouse';
    Activity.emit({ kind: 'acted', id: `married ${spouseName}` });
    showGameToast(`🎉 Traditional Wedding Complete! ${spouseName} is now your spouse and moving into your home! 🏡❤️`, 'success', 6000);
    this.refreshHomeFigure();
    return { ok: true, message: `Married to ${spouseName}!` };
  }

  /**
   * Syncs the spouse figure into the player's residential interior.
   */
  public syncHome(group: THREE.Group, plan: HomePlan | null, interactiveList: InteractiveObject[]): void {
    this.homeGroup = group;
    this.homePlan = plan;
    void this.homePlan;
    this.homeInteractive = interactiveList;
    this.refreshHomeFigure();
  }

  private refreshHomeFigure(): void {
    if (this.homeFigure) {
      if (this.homeFigure.root.parent) this.homeFigure.root.parent.remove(this.homeFigure.root);
      this.homeFigure = null;
    }
    const idx = this.homeInteractive.findIndex((o) => o.id === 'home_spouse');
    if (idx >= 0) this.homeInteractive.splice(idx, 1);

    if (!this.homeGroup || !this.isMarried()) return;
    const profile = this.spouseProfile();
    if (!profile) return;

    // Place spouse comfortably in the living room / parlour area
    const spot: [number, number] = [0.8, -1.2];
    const figure = new Figure(
      this.homeGroup,
      'home-spouse',
      profile.name,
      profile.look,
      spot,
      Math.PI / 2,
    );
    this.homeFigure = figure;

    const interactiveObj: InteractiveObject = {
      mesh: figure.root,
      id: 'home_spouse',
      name: `❤️ ${profile.name} (Your Spouse)`,
      category: 'Home & Family',
      description: `Your married spouse. Happily living together in your Lagos home.`,
      interactionPoint: new THREE.Vector3(spot[0], 0, spot[1] + 1.2),
    };
    this.homeInteractive.push(interactiveObj);
  }

  public tick(delta: number): void {
    if (this.homeFigure && this.homeFigure.root.visible) {
      this.homeFigure.tick(delta);
    }
  }

  public onNewDay(): void {
    if (!this.isMarried()) return;
    const profile = this.spouseProfile();
    if (!profile) return;

    // Spouse cooks a loving meal in the fridge and boosts social need
    Fridge.get().put({
      id: 'spouse_special_jollof',
      name: `${profile.name}'s Special Jollof`,
      icon: '🍲',
      category: 'food',
      description: `A delicious home-cooked meal prepared with love by your spouse ${profile.name}.`,
      price: 0,
      usable: true,
      energyRestore: 65,
    });
    BackendService.getInstance().restoreNeed('social', 25);
    showGameToast(`❤️ ${profile.name} cooked a fresh meal for you and stocked the fridge!`, 'info', 4500);
  }
}
