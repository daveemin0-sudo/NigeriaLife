// Server-authoritative Luxury Car Showroom & Tuning Garage ("Eko Motors"):
// handles luxury vehicle purchases, custom pearlescent wraps, performance tuning,
// forged alloy rims, and VIP executive clearance siren packages.
import type { DatabaseSync } from 'node:sqlite';
import type { ServerEconomy } from './economy';

export interface ServerLuxuryCarSpec {
  id: string;
  name: string;
  badge: string;
  category: 'suv' | 'supercar' | 'luxury';
  price: number;
  horsepower: number;
  topSpeedKmh: number;
  accelSeconds: number;
  description: string;
}

export const SERVER_LUXURY_CARS: Record<string, ServerLuxuryCarSpec> = {
  gwagon: {
    id: 'gwagon',
    name: 'Mercedes-AMG G63 ("G-Wagon")',
    badge: 'AMG 4.0L Bi-Turbo',
    category: 'suv',
    price: 145_000_000,
    horsepower: 577,
    topSpeedKmh: 240,
    accelSeconds: 4.5,
    description: 'The indisputable kingpin SUV of Lagos high society, commanding instant deference from Lekki to Ikoyi.',
  },
  range_rover: {
    id: 'range_rover',
    name: 'Range Rover Autobiography LWB',
    badge: 'P530 V8 Twin-Turbo',
    category: 'suv',
    price: 120_000_000,
    horsepower: 523,
    topSpeedKmh: 230,
    accelSeconds: 4.8,
    description: 'Supreme British royal comfort and whisper-quiet suspension for high-net-worth Lagos executives.',
  },
  porsche_911: {
    id: 'porsche_911',
    name: 'Porsche 911 GT3 (992)',
    badge: '4.0L Flat-6 Boxer',
    category: 'supercar',
    price: 95_000_000,
    horsepower: 502,
    topSpeedKmh: 318,
    accelSeconds: 3.4,
    description: 'Naturally aspirated motorsport thoroughbred tuned for high-speed runs on the Lekki-Epe expressway.',
  },
  land_cruiser: {
    id: 'land_cruiser',
    name: 'Toyota Land Cruiser 300 VXR',
    badge: '3.5L Twin-Turbo V6',
    category: 'suv',
    price: 75_000_000,
    horsepower: 409,
    topSpeedKmh: 210,
    accelSeconds: 6.7,
    description: 'The bulletproof convoy flagship of Nigerian governors, senators, and elite captains of industry.',
  },
  cullinan: {
    id: 'cullinan',
    name: 'Rolls-Royce Cullinan Black Badge',
    badge: '6.75L Twin-Turbo V12',
    category: 'luxury',
    price: 280_000_000,
    horsepower: 592,
    topSpeedKmh: 250,
    accelSeconds: 4.9,
    description: 'The pinnacle of global automotive luxury with bespoke coach doors, starlight headliner, and floating wheel caps.',
  },
};

export interface ServerTuningOption {
  id: string;
  category: 'wrap' | 'turbo' | 'rims' | 'siren';
  name: string;
  price: number;
  bonusSpeed: number;
  bonusHp: number;
  description: string;
}

export const SERVER_TUNING_OPTIONS: Record<string, ServerTuningOption> = {
  // Wraps
  wrap_emerald: {
    id: 'wrap_emerald',
    category: 'wrap',
    name: 'Lekki Emerald Pearlescent Wrap',
    price: 8_500_000,
    bonusSpeed: 0,
    bonusHp: 0,
    description: 'Multi-stage iridescent pearlescent vinyl shifting from oceanic emerald to liquid gold under the Lagos sun.',
  },
  wrap_satin_black: {
    id: 'wrap_satin_black',
    category: 'wrap',
    name: 'Satin Midnight Matte Black Wrap',
    price: 7_500_000,
    bonusSpeed: 0,
    bonusHp: 0,
    description: 'Ultra-sleek light-absorbing satin finish delivering an imposing stealth silhouette.',
  },
  wrap_chrome_gold: {
    id: 'wrap_chrome_gold',
    category: 'wrap',
    name: '24K Eko Mirror Chrome Gold Wrap',
    price: 14_000_000,
    bonusSpeed: 0,
    bonusHp: 0,
    description: 'Brilliant mirror chrome gold finish that turns every head across Victoria Island and Banana Island.',
  },
  // Engine & Performance
  tune_stage2: {
    id: 'tune_stage2',
    category: 'turbo',
    name: 'Twin-Turbo Stage 2 ECU Remap',
    price: 15_000_000,
    bonusSpeed: 28,
    bonusHp: 120,
    description: 'High-flow downpipes, upgraded turbo wastegates, and dyno-tuned ECU remap unleashing +120 horsepower.',
  },
  tune_exhaust: {
    id: 'tune_exhaust',
    category: 'turbo',
    name: 'Akrapovič Titanium Race Exhaust',
    price: 9_500_000,
    bonusSpeed: 12,
    bonusHp: 35,
    description: 'Lightweight titanium exhaust with active valves producing deep bass roars and ferocious overrun crackles.',
  },
  // Rims
  rims_forged: {
    id: 'rims_forged',
    category: 'rims',
    name: '23" Monoblock Forged Platinum Rims',
    price: 6_500_000,
    bonusSpeed: 5,
    bonusHp: 0,
    description: 'Aerospace-grade forged monoblock alloy wheels delivering razor-sharp steering feedback.',
  },
  rims_bronze: {
    id: 'rims_bronze',
    category: 'rims',
    name: '22" Multi-Spoke Satin Bronze Alloys',
    price: 5_500_000,
    bonusSpeed: 4,
    bonusHp: 0,
    description: 'Racing-derived multi-spoke geometry finished in bespoke satin bronze with diamond cut lip.',
  },
  // VIP Sirens & Strobes
  mod_siren: {
    id: 'mod_siren',
    category: 'siren',
    name: 'Executive VIP Convoy Siren & Strobe Kit',
    price: 12_000_000,
    bonusSpeed: 0,
    bonusHp: 0,
    description: 'High-intensity dual red & blue grille LED flashers and multi-tone electronic wail horn for convoy passage.',
  },
};

export interface OwnedMotorsVehicle {
  vehicleId: string;
  modelId: string;
  boughtAt: number;
  pricePaid: number;
  wrap: string | null;
  turbo: string | null;
  rims: string | null;
  hasVipSiren: boolean;
}

export class ServerMotors {
  private readonly db: DatabaseSync;
  private readonly economy: ServerEconomy;

  public constructor(db: DatabaseSync, economy: ServerEconomy) {
    this.db = db;
    this.economy = economy;
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS player_motors_vehicles (
        user_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        bought_at INTEGER NOT NULL,
        price_paid INTEGER NOT NULL,
        PRIMARY KEY (user_id, vehicle_id)
      );
      CREATE TABLE IF NOT EXISTS player_motors_tuning (
        user_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        wrap TEXT,
        turbo TEXT,
        rims TEXT,
        has_vip_siren INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, vehicle_id)
      );
    `);
  }

  public snapshot(userId: string): {
    ok: true;
    vehicles: OwnedMotorsVehicle[];
  } {
    const rows = this.db
      .prepare(`
        SELECT v.vehicle_id, v.model_id, v.bought_at, v.price_paid,
               t.wrap, t.turbo, t.rims, t.has_vip_siren
        FROM player_motors_vehicles v
        LEFT JOIN player_motors_tuning t
          ON v.user_id = t.user_id AND v.vehicle_id = t.vehicle_id
        WHERE v.user_id = ?
        ORDER BY v.bought_at DESC
      `)
      .all(userId) as Array<{
      vehicle_id: string;
      model_id: string;
      bought_at: number;
      price_paid: number;
      wrap: string | null;
      turbo: string | null;
      rims: string | null;
      has_vip_siren: number | null;
    }>;

    const vehicles: OwnedMotorsVehicle[] = rows.map((r) => ({
      vehicleId: r.vehicle_id,
      modelId: r.model_id,
      boughtAt: r.bought_at,
      pricePaid: r.price_paid,
      wrap: r.wrap ?? null,
      turbo: r.turbo ?? null,
      rims: r.rims ?? null,
      hasVipSiren: Boolean(r.has_vip_siren),
    }));

    return { ok: true, vehicles };
  }

  private debit(
    userId: string,
    amount: number,
    memo: string,
    idem: string,
  ): { ok: true; wallet: { cash: number; bank: number } } | { ok: false; reason: string } {
    const wallet = this.economy.wallet(userId);
    if (wallet.cash + wallet.bank < amount) {
      return { ok: false, reason: 'Not enough money.' };
    }
    if (wallet.bank >= amount) {
      const res = this.economy.holdFee(userId, amount, memo, idem);
      if (res.ok && res.wallet) return { ok: true, wallet: res.wallet };
    }
    const fromBank = Math.min(wallet.bank, amount);
    const fromCash = amount - fromBank;
    const res = this.economy.report(userId, {
      cash: -fromCash,
      bank: -fromBank,
      memo,
      idem,
    });
    if (res.ok && res.wallet) {
      return { ok: true, wallet: res.wallet };
    }
    return { ok: false, reason: res.reason ?? 'Payment failed.' };
  }

  public buy(
    userId: string,
    raw: { modelId?: unknown; now?: unknown },
  ):
    | {
        ok: true;
        vehicle: OwnedMotorsVehicle;
        paid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerMotors['snapshot']>;
      }
    | { ok: false; reason: string } {
    const modelId = String(raw.modelId ?? '').trim();
    const spec = SERVER_LUXURY_CARS[modelId];
    if (!spec) return { ok: false, reason: 'Invalid luxury vehicle model selection.' };

    const now = typeof raw.now === 'number' && Number.isFinite(raw.now) ? Math.trunc(raw.now) : Date.now();
    const vehicleId = `eko_car_${modelId}_${Math.random().toString(36).slice(2, 8)}`;

    const paid = this.debit(userId, spec.price, `Eko Motors Purchase: ${spec.name}`, `motors:${userId}:${vehicleId}`);
    if (!paid.ok) {
      return { ok: false, reason: `You need ₦${spec.price.toLocaleString()} in your account to buy the ${spec.name}.` };
    }

    this.db.prepare(
      'INSERT INTO player_motors_vehicles (user_id, vehicle_id, model_id, bought_at, price_paid) VALUES (?, ?, ?, ?, ?)',
    ).run(userId, vehicleId, modelId, now, spec.price);

    this.db.prepare(
      'INSERT INTO player_motors_tuning (user_id, vehicle_id, wrap, turbo, rims, has_vip_siren) VALUES (?, ?, NULL, NULL, NULL, 0)',
    ).run(userId, vehicleId);

    const vehicle: OwnedMotorsVehicle = {
      vehicleId,
      modelId,
      boughtAt: now,
      pricePaid: spec.price,
      wrap: null,
      turbo: null,
      rims: null,
      hasVipSiren: false,
    };

    return {
      ok: true,
      vehicle,
      paid: spec.price,
      wallet: paid.wallet,
      snapshot: this.snapshot(userId),
    };
  }

  public tune(
    userId: string,
    raw: { vehicleId?: unknown; optionId?: unknown },
  ):
    | {
        ok: true;
        option: ServerTuningOption;
        paid: number;
        wallet: { cash: number; bank: number };
        snapshot: ReturnType<ServerMotors['snapshot']>;
      }
    | { ok: false; reason: string } {
    const vehicleId = String(raw.vehicleId ?? '').trim();
    const optionId = String(raw.optionId ?? '').trim();

    const option = SERVER_TUNING_OPTIONS[optionId];
    if (!option) return { ok: false, reason: 'Invalid tuning package selected.' };

    const owned = this.db
      .prepare('SELECT model_id FROM player_motors_vehicles WHERE user_id = ? AND vehicle_id = ?')
      .get(userId, vehicleId) as { model_id: string } | undefined;
    if (!owned) return { ok: false, reason: 'You do not own this vehicle.' };

    const paid = this.debit(userId, option.price, `Eko Motors Tuning: ${option.name}`, `tune:${userId}:${vehicleId}:${optionId}`);
    if (!paid.ok) {
      return { ok: false, reason: `You need ₦${option.price.toLocaleString()} for the ${option.name}.` };
    }

    if (option.category === 'wrap') {
      this.db.prepare('UPDATE player_motors_tuning SET wrap = ? WHERE user_id = ? AND vehicle_id = ?').run(optionId, userId, vehicleId);
    } else if (option.category === 'turbo') {
      this.db.prepare('UPDATE player_motors_tuning SET turbo = ? WHERE user_id = ? AND vehicle_id = ?').run(optionId, userId, vehicleId);
    } else if (option.category === 'rims') {
      this.db.prepare('UPDATE player_motors_tuning SET rims = ? WHERE user_id = ? AND vehicle_id = ?').run(optionId, userId, vehicleId);
    } else if (option.category === 'siren') {
      this.db.prepare('UPDATE player_motors_tuning SET has_vip_siren = 1 WHERE user_id = ? AND vehicle_id = ?').run(userId, vehicleId);
    }

    return {
      ok: true,
      option,
      paid: option.price,
      wallet: paid.wallet!,
      snapshot: this.snapshot(userId),
    };
  }
}

