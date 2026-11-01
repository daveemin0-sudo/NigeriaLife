import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { OnlineAccount } from '../online/OnlineAccount';
import { Figure } from '../interiors/places/Worship';
import { Builder } from '../world/kit/ArchKit';
import { buildKitCar } from '../world/vehicles/KitCar';
import { PlaceOpeners, type PlaceInterior } from '../interiors/places/PlaceInterior';
import type { PlaceHost } from '../destinations/PlaceActions';
import { showGameToast } from '../ui/GameToast';
import { Activity } from '../life/Activity';
import { Garage, newPlate } from '../realestate/Garage';
import { Registry, MY_ID } from '../realestate/Registry';
import { assetKey } from '../realestate/types';

/**
 * Luxury Car Showroom & Tuning Garage ("Eko Motors"):
 * - Exclusive dealership for high-end luxury SUVs, supercars, and presidential convoys.
 * - Performance engineering (Stage 2 Twin-Turbo ECU Remaps, Akrapovič titanium exhausts).
 * - Custom cosmetic styling (Lekki emerald pearlescent, satin black, 24K mirror chrome gold).
 * - Aerospace-grade forged rims and Executive VIP Convoy Siren & Strobe flasher packages.
 */

export interface LuxuryCarSpec {
  id: string;
  name: string;
  badge: string;
  brand: string;
  category: 'suv' | 'supercar' | 'luxury';
  price: number;
  horsepower: number;
  topSpeedKmh: number;
  accelSeconds: number;
  icon: string;
  kitSpecId: string;
  defaultPaint: number;
  description: string;
}

export const LUXURY_CARS: Record<string, LuxuryCarSpec> = {
  gwagon: {
    id: 'gwagon',
    name: 'Mercedes-AMG G63 ("G-Wagon")',
    badge: 'AMG 4.0L Bi-Turbo',
    brand: 'Mercedes-Benz',
    category: 'suv',
    price: 145_000_000,
    horsepower: 577,
    topSpeedKmh: 240,
    accelSeconds: 4.5,
    icon: '🚙',
    kitSpecId: 'gwagon',
    defaultPaint: 0x0f172a,
    description: 'The indisputable kingpin SUV of Lagos high society, commanding instant deference from Lekki to Ikoyi.',
  },
  range_rover: {
    id: 'range_rover',
    name: 'Range Rover Autobiography LWB',
    badge: 'P530 V8 Twin-Turbo',
    brand: 'Land Rover',
    category: 'suv',
    price: 120_000_000,
    horsepower: 523,
    topSpeedKmh: 230,
    accelSeconds: 4.8,
    icon: '🚘',
    kitSpecId: 'range_rover',
    defaultPaint: 0x14532d,
    description: 'Supreme British royal comfort and whisper-quiet suspension for high-net-worth Lagos executives.',
  },
  porsche_911: {
    id: 'porsche_911',
    name: 'Porsche 911 GT3 (992)',
    badge: '4.0L Flat-6 Boxer',
    brand: 'Porsche',
    category: 'supercar',
    price: 95_000_000,
    horsepower: 502,
    topSpeedKmh: 318,
    accelSeconds: 3.4,
    icon: '🏎️',
    kitSpecId: 'porsche_911',
    defaultPaint: 0xf8fafc,
    description: 'Naturally aspirated motorsport thoroughbred tuned for high-speed runs on the Lekki-Epe expressway.',
  },
  land_cruiser: {
    id: 'land_cruiser',
    name: 'Toyota Land Cruiser 300 VXR',
    badge: '3.5L Twin-Turbo V6',
    brand: 'Toyota',
    category: 'suv',
    price: 75_000_000,
    horsepower: 409,
    topSpeedKmh: 210,
    accelSeconds: 6.7,
    icon: '🚙',
    kitSpecId: 'suv',
    defaultPaint: 0x2b3340,
    description: 'The bulletproof convoy flagship of Nigerian governors, senators, and elite captains of industry.',
  },
  cullinan: {
    id: 'cullinan',
    name: 'Rolls-Royce Cullinan Black Badge',
    badge: '6.75L Twin-Turbo V12',
    brand: 'Rolls-Royce',
    category: 'luxury',
    price: 280_000_000,
    horsepower: 592,
    topSpeedKmh: 250,
    accelSeconds: 4.9,
    icon: '👑',
    kitSpecId: 'cullinan',
    defaultPaint: 0x1f2937,
    description: 'The pinnacle of global automotive luxury with bespoke coach doors, starlight headliner, and floating wheel caps.',
  },
};

export interface TuningOptionSpec {
  id: string;
  category: 'wrap' | 'turbo' | 'rims' | 'siren';
  name: string;
  icon: string;
  price: number;
  bonusSpeed: number;
  bonusHp: number;
  colorHex?: number;
  description: string;
}

export const TUNING_OPTIONS: Record<string, TuningOptionSpec> = {
  // Wraps
  wrap_emerald: {
    id: 'wrap_emerald',
    category: 'wrap',
    name: 'Lekki Emerald Pearlescent Wrap',
    icon: '🟢',
    price: 8_500_000,
    bonusSpeed: 0,
    bonusHp: 0,
    colorHex: 0x059669,
    description: 'Multi-stage iridescent pearlescent vinyl shifting from oceanic emerald to liquid gold under the Lagos sun.',
  },
  wrap_satin_black: {
    id: 'wrap_satin_black',
    category: 'wrap',
    name: 'Satin Midnight Matte Black Wrap',
    icon: '⚫',
    price: 7_500_000,
    bonusSpeed: 0,
    bonusHp: 0,
    colorHex: 0x18181b,
    description: 'Ultra-sleek light-absorbing satin finish delivering an imposing stealth silhouette.',
  },
  wrap_chrome_gold: {
    id: 'wrap_chrome_gold',
    category: 'wrap',
    name: '24K Eko Mirror Chrome Gold Wrap',
    icon: '🟡',
    price: 14_000_000,
    bonusSpeed: 0,
    bonusHp: 0,
    colorHex: 0xf59e0b,
    description: 'Brilliant mirror chrome gold finish that turns every head across Victoria Island and Banana Island.',
  },
  // Turbo & Engine
  tune_stage2: {
    id: 'tune_stage2',
    category: 'turbo',
    name: 'Twin-Turbo Stage 2 ECU Remap',
    icon: '⚡',
    price: 15_000_000,
    bonusSpeed: 28,
    bonusHp: 120,
    description: 'High-flow downpipes, upgraded turbo wastegates, and dyno-tuned ECU remap unleashing +120 horsepower.',
  },
  tune_exhaust: {
    id: 'tune_exhaust',
    category: 'turbo',
    name: 'Akrapovič Titanium Race Exhaust',
    icon: '🔥',
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
    icon: '🔘',
    price: 6_500_000,
    bonusSpeed: 5,
    bonusHp: 0,
    description: 'Aerospace-grade forged monoblock alloy wheels delivering razor-sharp steering feedback.',
  },
  rims_bronze: {
    id: 'rims_bronze',
    category: 'rims',
    name: '22" Multi-Spoke Satin Bronze Alloys',
    icon: '🔘',
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
    icon: '🚨',
    price: 12_000_000,
    bonusSpeed: 0,
    bonusHp: 0,
    description: 'High-intensity dual red & blue grille LED flashers and multi-tone electronic wail horn for convoy passage.',
  },
};

export interface MotorsVehicleRecord {
  vehicleId: string;
  modelId: string;
  boughtAt: number;
  pricePaid: number;
  wrap: string | null;
  turbo: string | null;
  rims: string | null;
  hasVipSiren: boolean;
}

export interface MotorsSaveData {
  vehicles: MotorsVehicleRecord[];
  activeVehicleId: string | null;
}

export class Motors {
  private static instance: Motors | null = null;
  public static get(): Motors {
    return (Motors.instance ??= new Motors());
  }

  public onChange: (() => void) | null = null;
  private loadedFor = '';
  private data: MotorsSaveData = {
    vehicles: [],
    activeVehicleId: null,
  };

  private key(): string {
    return `nl_motors_v1:${Activity.player()}`;
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
        if (parsed && Array.isArray(parsed.vehicles)) {
          this.data = {
            vehicles: parsed.vehicles.filter((v: any) => v && v.modelId in LUXURY_CARS),
            activeVehicleId: typeof parsed.activeVehicleId === 'string' ? parsed.activeVehicleId : null,
          };
          this.syncToGarage();
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
    this.data = { vehicles: [], activeVehicleId: null };
    this.save();
    this.changed();
  }

  public models(): LuxuryCarSpec[] {
    return Object.values(LUXURY_CARS);
  }

  public modelFor(id: string): LuxuryCarSpec | null {
    return LUXURY_CARS[id] ?? null;
  }

  public tuningOptions(): TuningOptionSpec[] {
    return Object.values(TUNING_OPTIONS);
  }

  public owned(): MotorsVehicleRecord[] {
    this.load();
    return [...this.data.vehicles];
  }

  public activeVehicle(): MotorsVehicleRecord | null {
    this.load();
    return this.data.vehicles.find((v) => v.vehicleId === this.data.activeVehicleId) ?? this.data.vehicles[0] ?? null;
  }

  public vehicleById(vehicleId: string): MotorsVehicleRecord | null {
    this.load();
    return this.data.vehicles.find((v) => v.vehicleId === vehicleId) ?? null;
  }

  public syncVehicleToGarage(vehicleId: string, modelId: string, pricePaid: number): void {
    const registry = Registry.get();
    const spec = LUXURY_CARS[modelId];
    if (!spec) return;
    const now = Date.now();
    registry.transact((state) => {
      if (!state.vehicles[vehicleId]) {
        state.vehicles[vehicleId] = {
          id: vehicleId,
          modelId: spec.id,
          condition: 100,
          mileage: 0,
          fuel: 100,
          plate: newPlate(state.serial),
          boughtNewAt: now,
          upgrades: {
            engine: 0,
            tyres: false,
            paint: spec.defaultPaint,
          },
        };
      }
      const titleKey = assetKey({ kind: 'vehicle', id: vehicleId });
      if (!state.titles[titleKey]) {
        const saleId = Registry.nextId(state, 'sale');
        state.titles[titleKey] = {
          ownerId: MY_ID,
          history: [{ at: now, from: null, to: MY_ID, price: pricePaid, saleId }],
        };
        state.sales.push({
          id: saleId,
          asset: { kind: 'vehicle', id: vehicleId },
          sellerId: null,
          buyerId: MY_ID,
          price: pricePaid,
          fee: 0,
          at: now,
        });
      }
    });
  }

  public syncToGarage(): void {
    const registry = Registry.get();
    const peek = registry.peek();
    for (const v of this.data.vehicles) {
      if (!peek.vehicles[v.vehicleId]) {
        const spec = LUXURY_CARS[v.modelId];
        if (!spec) continue;
        const now = v.boughtAt || Date.now();
        registry.transact((state) => {
          if (state.vehicles[v.vehicleId]) return;
          const wrapOpt = v.wrap ? TUNING_OPTIONS[v.wrap] : null;
          const turboOpt = v.turbo ? TUNING_OPTIONS[v.turbo] : null;
          const rimsOpt = v.rims ? TUNING_OPTIONS[v.rims] : null;
          const paint = wrapOpt?.colorHex ?? spec.defaultPaint;
          const engine = turboOpt?.id === 'tune_stage2' ? 2 : turboOpt ? 1 : 0;
          const tyres = Boolean(rimsOpt);
          state.vehicles[v.vehicleId] = {
            id: v.vehicleId,
            modelId: spec.id,
            condition: 100,
            mileage: 0,
            fuel: 100,
            plate: newPlate(state.serial),
            boughtNewAt: now,
            upgrades: {
              engine,
              tyres,
              paint,
            },
          };
          const titleKey = assetKey({ kind: 'vehicle', id: v.vehicleId });
          if (!state.titles[titleKey]) {
            const saleId = Registry.nextId(state, 'sale');
            state.titles[titleKey] = {
              ownerId: MY_ID,
              history: [{ at: now, from: null, to: MY_ID, price: v.pricePaid || spec.price, saleId }],
            };
            state.sales.push({
              id: saleId,
              asset: { kind: 'vehicle', id: v.vehicleId },
              sellerId: null,
              buyerId: MY_ID,
              price: v.pricePaid || spec.price,
              fee: 0,
              at: now,
            });
          }
        });
      }
    }
  }

  public async syncOnline(): Promise<void> {
    const online = OnlineAccount.get();
    if (!online) return;
    try {
      const res = (await online.request('/motors')) as {
        ok: boolean;
        vehicles?: MotorsVehicleRecord[];
      };
      if (res.ok && Array.isArray(res.vehicles)) {
        this.data.vehicles = res.vehicles.map((v) => ({
          vehicleId: v.vehicleId,
          modelId: v.modelId,
          boughtAt: v.boughtAt,
          pricePaid: v.pricePaid,
          wrap: v.wrap ?? null,
          turbo: v.turbo ?? null,
          rims: v.rims ?? null,
          hasVipSiren: Boolean(v.hasVipSiren),
        }));
        this.syncToGarage();
        this.changed();
      }
    } catch {
      // offline fallback
    }
  }

  public async buy(modelId: string): Promise<{ ok: boolean; message: string; vehicle?: MotorsVehicleRecord }> {
    this.load();
    const spec = LUXURY_CARS[modelId];
    if (!spec) return { ok: false, message: 'Invalid luxury vehicle model selection.' };

    const online = OnlineAccount.get();
    const backend = BackendService.getInstance();
    let vehicleId = '';

    if (online) {
      const res = (await online.request('/motors/buy', { modelId, now: Date.now() })) as {
        ok: boolean;
        reason?: string;
        vehicle?: MotorsVehicleRecord;
        wallet?: { cash: number; bank: number };
        snapshot?: { vehicles: MotorsVehicleRecord[] };
      };
      if (!res.ok) return { ok: false, message: res.reason ?? 'Purchase failed.' };
      if (res.wallet) backend.applyServerWallet(res.wallet);
      vehicleId = res.vehicle?.vehicleId ?? `eko_car_${modelId}_${Math.random().toString(36).slice(2, 8)}`;
      if (res.snapshot) {
        this.data.vehicles = res.snapshot.vehicles;
        this.data.activeVehicleId = vehicleId;
      }
    } else {
      if (!backend.canPay(spec.price)) {
        return { ok: false, message: `You need ₦${spec.price.toLocaleString()} to purchase the ${spec.name}.` };
      }
      backend.pay(spec.price, `Eko Motors Purchase: ${spec.name}`);
      vehicleId = `eko_car_${modelId}_${Math.random().toString(36).slice(2, 8)}`;
      const rec: MotorsVehicleRecord = {
        vehicleId,
        modelId,
        boughtAt: Date.now(),
        pricePaid: spec.price,
        wrap: null,
        turbo: null,
        rims: null,
        hasVipSiren: false,
      };
      this.data.vehicles.unshift(rec);
      this.data.activeVehicleId = vehicleId;
      this.save();
    }

    // Register into the canonical Registry & Garage so it is fully drivable,
    // appears in the Garage app, home carport, and street spawning!
    this.syncVehicleToGarage(vehicleId, modelId, spec.price);

    // Add luxury car key document to inventory
    backend.addItem({
      id: `key_${modelId}`,
      name: `Keys to ${spec.name}`,
      category: 'luxury',
      icon: '🔑',
      price: spec.price,
      description: `Official biometric key fob for your ${spec.name} from Eko Motors.`,
      usable: false,
    });

    backend.modifyNeed('fun', 40);
    Activity.emit({ kind: 'acted', id: `bought_car_${modelId}` });
    showGameToast(`🏎️ Congratulations! You now own the ${spec.name}. Registered in your fleet and Garage.`, 'success', 6000);
    this.changed();
    return { ok: true, message: `Purchased ${spec.name}!`, vehicle: this.activeVehicle() ?? undefined };
  }

  public async tune(vehicleId: string, optionId: string): Promise<{ ok: boolean; message: string }> {
    this.load();
    const car = this.vehicleById(vehicleId);
    if (!car) return { ok: false, message: 'Vehicle not found in your fleet.' };

    const option = TUNING_OPTIONS[optionId];
    if (!option) return { ok: false, message: 'Invalid tuning package selected.' };

    const online = OnlineAccount.get();
    const backend = BackendService.getInstance();

    if (online) {
      const res = (await online.request('/motors/tune', { vehicleId, optionId })) as {
        ok: boolean;
        reason?: string;
        wallet?: { cash: number; bank: number };
        snapshot?: { vehicles: MotorsVehicleRecord[] };
      };
      if (!res.ok) return { ok: false, message: res.reason ?? 'Tuning failed.' };
      if (res.wallet) backend.applyServerWallet(res.wallet);
      if (res.snapshot) {
        this.data.vehicles = res.snapshot.vehicles;
      }
    } else {
      if (!backend.canPay(option.price)) {
        return { ok: false, message: `You need ₦${option.price.toLocaleString()} for the ${option.name}.` };
      }
      backend.pay(option.price, `Eko Motors Tuning: ${option.name}`);
      if (option.category === 'wrap') car.wrap = optionId;
      else if (option.category === 'turbo') car.turbo = optionId;
      else if (option.category === 'rims') car.rims = optionId;
      else if (option.category === 'siren') car.hasVipSiren = true;
      this.save();
    }

    // Apply performance and visual upgrades directly to the real Garage vehicle
    if (option.category === 'wrap' && option.colorHex !== undefined) {
      void Garage.get().upgrade(vehicleId, { paint: option.colorHex });
    } else if (option.category === 'turbo') {
      const stage = optionId === 'tune_stage2' ? 2 : 1;
      void Garage.get().upgrade(vehicleId, { engine: stage });
    } else if (option.category === 'rims') {
      void Garage.get().upgrade(vehicleId, { tyres: true });
    }

    backend.modifyNeed('fun', 25);
    Activity.emit({ kind: 'acted', id: `tuned_${optionId}` });
    showGameToast(`🔧 Installed ${option.name}! Upgrades applied to vehicle.`, 'success', 5000);
    this.changed();
    return { ok: true, message: `Installed ${option.name}!` };
  }

  public setActiveVehicle(vehicleId: string): void {
    this.load();
    if (this.data.vehicles.some((v) => v.vehicleId === vehicleId)) {
      this.data.activeVehicleId = vehicleId;
      this.save();
      this.changed();
    }
  }
}

/**
 * Attaches the 3D Luxury Showroom turntable, flagship car, and master dealer figure
 * to the Sankofa Motors showroom venue (`sankofa-motors`).
 */
export function attachEkoMotors(room: PlaceInterior, key: string): void {
  if (key !== 'sankofa-motors') return;

  const showroomGroup = new THREE.Group();
  showroomGroup.name = 'eko_motors_showroom_group';

  // 1. Central Elevated Turntable Platform at [0, 0, -3]
  const b = new Builder();
  b.cylinder(0x0f172a, 3.4, 0.16, 0, 0, -3, { sides: 32 }); // Outer dark platform base
  b.cylinder(0xd4af37, 3.25, 0.04, 0, 0.16, -3, { sides: 32 }); // Gold trim halo ring
  b.cylinder(0x1e293b, 3.1, 0.04, 0, 0.18, -3, { sides: 32 }); // Polished inner turntable disc
  b.cylinder(0x38bdf8, 3.12, 0.02, 0, 0.19, -3, { sides: 32 }); // Cyan ambient neon edge glow

  // Showroom pillars & neon overhead halos
  b.cylinder(0x1e293b, 0.22, 3.8, -4.5, 0, -3, { sides: 16 });
  b.cylinder(0x1e293b, 0.22, 3.8, 4.5, 0, -3, { sides: 16 });
  b.box(0xd4af37, 9.2, 0.12, 0.35, 0, 3.8, -3); // Gold canopy crossbar
  b.box(0x38bdf8, 8.8, 0.04, 0.1, 0, 3.75, -3); // Neon strip

  const platformMesh = b.build('eko_motors_turntable_mesh', { roughness: 0.2, metalness: 0.8 });
  showroomGroup.add(platformMesh);

  // 2. Rotating Flagship Luxury Car on Turntable
  const turntableGroup = new THREE.Group();
  turntableGroup.name = 'eko_motors_turntable_rotor';
  turntableGroup.position.set(0, 0.2, -3);

  const flagshipCar = buildKitCar('gwagon', 0x059669); // Emerald G-Wagon
  flagshipCar.group.name = 'eko_motors_flagship_gwagon';
  turntableGroup.add(flagshipCar.group);
  showroomGroup.add(turntableGroup);

  room.group.add(showroomGroup);

  // Rotate turntable continuously
  room.ticks.push((delta) => {
    turntableGroup.rotation.y += delta * 0.35;
  });

  // 3. Master Dealer & Automotive Engineer Figure
  const dealerFig = new Figure(
    room.group,
    'eko_motors_dealer',
    'Engr. Femi · Master Dealer & Tuner',
    { gender: 'male', username: '', outfit: 'suit', outfitColor: 0x0f172a, trousersColor: 0x0f172a, hairstyle: 'short_crop', skinTone: '#4a2e1c', hasTie: true },
    [-3.2, 4.8],
    Math.PI * 0.15,
  );
  dealerFig.root.name = 'eko_motors_dealer';
  dealerFig.pose('stand', 'rest');

  // 4. Interactive Place Card / Action: Eko Motors Luxury Showroom & Tuning Bay
  const runShowroomStation = (host: PlaceHost) => {
    const motors = Motors.get();
    const owned = motors.owned();
    const active = motors.activeVehicle();

    host.ask({
      who: 'Engr. Femi',
      role: 'Eko Motors · Lead Automotive Specialist',
      text: owned.length > 0
        ? `Welcome back, Boss! Your ${active ? LUXURY_CARS[active.modelId]?.name : 'luxury fleet'} is prepped and primed. Are you looking to acquire another beast or dyno-tune your current machine?`
        : `Welcome to Eko Motors! We import the finest high-performance SUVs and supercars directly into Lagos. Every vehicle comes dyno-tested and ready for full bespoke tuning.`,
      choices: [
        {
          label: '🏎️ Open Eko Motors Showroom & Tuning Bay',
          note: 'Browse fleet, custom pearlescent wraps & Stage 2 turbo remaps',
          pick: () => {
            PlaceOpeners.open('app:motors', host);
          },
        },
        {
          label: 'Inspect Turntable Flagship Mercedes-AMG G63',
          note: '577 hp · Bi-Turbo V8 in Lekki Emerald Pearlescent',
          pick: () => {
            dealerFig.actor.say('Engr. Femi: "That G63 is pushing 577 horsepower with full bespoke exhaust tuning. A true Lagos royalty machine!"', 4.0);
            showGameToast('🏎️ You admired the flawless emerald pearlescent finish of the AMG G63.', 'info', 4000);
          },
        },
      ],
    });
  };

  room.addCard({
    id: 'eko_motors_terminal',
    name: '🏎️ Eko Motors Showroom & Tuning Bay',
    description: 'Luxury automobile dealership & performance customization garage.',
    at: [-3.0, 4.2],
    stand: [-3.0, 4.0],
    label: () => '🏎️ Eko Motors · Luxury Showroom & Tuning Bay',
    run: runShowroomStation,
  });
}
