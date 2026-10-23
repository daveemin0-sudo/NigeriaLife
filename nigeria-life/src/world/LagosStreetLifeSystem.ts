import { SoundEngine } from '../audio/SoundEngine';
import { BackendService } from '../backend/BackendService';
import { showGameToast } from '../ui/GameToast';
import type { Roads } from './Roads';
import type { Districts } from './Districts';
import type { CityDensityManager } from './density/CityDensityManager';
import type { AtmosphereManager } from './AtmosphereManager';
import type { InteractiveObject } from './World';

export interface HawkerGoods {
  waterPrice: number;
  galaPrice: number;
}

/**
 * LagosStreetLifeSystem
 * The living soul of Lagos streets:
 * 1. NEPA grid blackouts & power restoration ("UP NEPA!") with generator mechanics
 * 2. In-traffic street hawkers approaching car windows in go-slow
 * 3. Danfo conductor shouting routes, collecting fares, and slapping the bus roof
 * 4. Agbero road checkpoint / terminus levy interactions
 */
export class LagosStreetLifeSystem {
  private static instance: LagosStreetLifeSystem;

  // NEPA & Generator Grid State
  public isNepaOn: boolean = true;
  private blackoutTimer: number = 240; // Next automatic event in seconds
  public isGeneratorRunning: boolean = false;
  private roadsRef: Roads | null = null;
  private districtsRef: Districts | null = null;
  private densityRef: CityDensityManager | null = null;
  public atmosphereRef: AtmosphereManager | null = null;

  // In-Traffic Hawker State
  public isHawkerAtWindow: boolean = false;
  private trafficWaitTimer: number = 0;
  private lastHawkerToastTime: number = 0;

  // Agbero Checkpoint State
  private lastAgberoInteractionTime: number = 0;
  public agberoObject: InteractiveObject | null = null;
  public generatorObject: InteractiveObject | null = null;

  private conductorPhrases = [
    'CMS! CMS! Marina straight! Enter with your 100 naira change!',
    'Obalende direct! No five hundred naira note o!',
    'Wole pelu change e! One seat left for front!',
    'Drop, drop! Conductor hold am!',
    'Broad Street express! Oya enter fast!',
    'Lekki toll gate straight! Jump inside!',
  ];

  private constructor() {}

  public static getInstance(): LagosStreetLifeSystem {
    if (!LagosStreetLifeSystem.instance) {
      LagosStreetLifeSystem.instance = new LagosStreetLifeSystem();
    }
    return LagosStreetLifeSystem.instance;
  }

  public registerSystems(
    roads: Roads,
    districts: Districts,
    density: CityDensityManager,
    atmosphere: AtmosphereManager
  ): void {
    this.roadsRef = roads;
    this.districtsRef = districts;
    this.densityRef = density;
    this.atmosphereRef = atmosphere;
  }

  // =========================================================================
  // 1. NEPA GRID BLACKOUT & GENERATOR ENGINE ("UP NEPA!")
  // =========================================================================
  public triggerNepaBlackout(): void {
    if (!this.isNepaOn) return;
    this.isNepaOn = false;

    // 1. Audio: Explosive transformer trip
    SoundEngine.getInstance().playTransformerTrip();

    // 2. Shut off streetlights
    if (this.roadsRef) {
      for (const light of this.roadsRef.streetPointLights) {
        light.intensity = 0;
      }
      for (const mat of this.roadsRef.streetBulbMaterials) {
        mat.emissiveIntensity = 0.02;
      }
    }

    // 3. Extinguish building window light
    if (this.densityRef) {
      this.densityRef.setNightLighting('morning'); // Shuts down window emissives
    }

    showGameToast('⚡ NEPA has struck! "Ahhhh! NEPA na bastard! Who off light?!"', 'warning', 4500);

    // 4. After 2.5 seconds, private shop generators cough and kick in
    setTimeout(() => {
      if (!this.isNepaOn) {
        this.isGeneratorRunning = true;
        SoundEngine.getInstance().playGeneratorPull();
        showGameToast('💨 "I pass my neighbor" Tiger generator roaring to life outside Bet9ja!', 'info', 3500);
      }
    }, 2400);
  }

  public restoreNepaPower(period: string = 'night'): void {
    if (this.isNepaOn) return;
    this.isNepaOn = true;
    this.isGeneratorRunning = false;

    // 1. Audio: Power grid surge & contactor snap
    SoundEngine.getInstance().playNepaRestored();

    // 2. Restore streetlights
    if (this.roadsRef) {
      this.roadsRef.setNightLighting(period);
    }

    // 3. Restore building windows
    if (this.densityRef) {
      this.densityRef.setNightLighting(period);
    }
    if (this.districtsRef) {
      this.districtsRef.setNightLighting(period);
    }

    showGameToast('🎉 UP NEPAAAA! Light don come back! The whole street is rejoicing!', 'success', 5000);
  }

  public toggleNepaPower(period: string = 'night'): boolean {
    if (this.isNepaOn) {
      this.triggerNepaBlackout();
    } else {
      this.restoreNepaPower(period);
    }
    return this.isNepaOn;
  }

  /** Player manually pulls the recoil cord on the Bet9ja Tiger generator */
  public pullGeneratorCord(): boolean {
    SoundEngine.getInstance().playGeneratorPull();
    const backend = BackendService.getInstance();

    if (!this.isNepaOn) {
      this.isGeneratorRunning = true;
      backend.addCash(2500, 'Generator Starting Assistance');
      backend.addStreetCred(12);
      showGameToast('⚡ Vrr-chug-chug! You started the Tiger generator! Bet9ja & Mama Put rewarded you ₦2,500 + 12 Cred!', 'success', 4500);
      return true;
    } else {
      showGameToast('🔌 NEPA light is currently ON. Tiger TG950 generator is safely on standby.', 'info', 3000);
      return false;
    }
  }

  // =========================================================================
  // 2. DANFO CONDUCTOR ROOF SLAP & ROUTE SHOUTING
  // =========================================================================
  public triggerConductorShout(customPhrase?: string): string {
    const phrase = customPhrase || this.conductorPhrases[Math.floor(Math.random() * this.conductorPhrases.length)];
    SoundEngine.getInstance().playConductorSlap();
    showGameToast(`📢 Conductor: "${phrase}"`, 'info', 3200);
    return phrase;
  }

  // =========================================================================
  // 3. IN-TRAFFIC WINDOW HAWKER (Pure Water & Beef Gala)
  // =========================================================================
  public updateTrafficHawker(delta: number, speedMps: number, isDriving: boolean): void {
    if (!isDriving) {
      this.isHawkerAtWindow = false;
      this.trafficWaitTimer = 0;
      return;
    }

    // If vehicle is crawling in go-slow (< 2.2 m/s / ~8 km/h)
    if (Math.abs(speedMps) < 2.2) {
      this.trafficWaitTimer += delta;
      if (this.trafficWaitTimer >= 1.6 && !this.isHawkerAtWindow) {
        this.isHawkerAtWindow = true;
        const now = Date.now();
        if (now - this.lastHawkerToastTime > 18000) {
          this.lastHawkerToastTime = now;
          SoundEngine.getInstance().playClickSound();
          showGameToast('🥤 Chidi at your window: "Oga buy cold pure water! Hot Gala dey!" [Press J for Water, G for Gala]', 'info', 4500);
        }
      }
    } else {
      this.isHawkerAtWindow = false;
      this.trafficWaitTimer = 0;
    }
  }

  public buyFromWindowHawker(itemType: 'water' | 'gala'): boolean {
    const backend = BackendService.getInstance();
    const data = backend.getData();

    if (itemType === 'water') {
      const price = 100;
      if (data.walletCash < price) {
        showGameToast('Oga your money no reach ₦100 for pure water o.', 'warning', 2500);
        return false;
      }
      backend.spendCash(price, 'Pure Water from Traffic Hawker', 'FOOD_PURCHASE');
      backend.addStreetCred(1);
      SoundEngine.getInstance().playTransactionSuccess();
      backend.addItem({
        id: 'water_sachet',
        name: 'Chilled Pure Water Sachet',
        category: 'food',
        icon: '💧',
        description: 'Cold sachet water bought in Lagos go-slow.',
        price: 100,
        usable: true,
        energyRestore: 15,
      }, 1);
      showGameToast('💧 Chilled Pure Water bought through car window! Energy +15 restored.', 'success', 3000);
      return true;
    } else {
      const price = 250;
      if (data.walletCash < price) {
        showGameToast('Oga your money no reach ₦250 for Gala o.', 'warning', 2500);
        return false;
      }
      backend.spendCash(price, 'Beef Gala from Traffic Hawker', 'FOOD_PURCHASE');
      backend.addStreetCred(1);
      SoundEngine.getInstance().playTransactionSuccess();
      backend.addItem({
        id: 'gala_snack',
        name: 'Beef Gala Sausage Roll',
        category: 'food',
        icon: '🌭',
        description: 'The legendary King of highway and street snacks.',
        price: 250,
        usable: true,
        energyRestore: 25,
      }, 1);
      showGameToast('🌭 Hot Beef Gala bought through window! Hunger satisfied.', 'success', 3000);
      return true;
    }
  }

  // =========================================================================
  // 4. AGBERO ROAD CHECKPOINT ENCOUNTER
  // =========================================================================
  public handleAgberoToll(action: 'settle' | 'evade'): void {
    const backend = BackendService.getInstance();
    const now = Date.now();
    if (now - this.lastAgberoInteractionTime < 5000) return;
    this.lastAgberoInteractionTime = now;

    if (action === 'settle') {
      const fee = 200;
      const data = backend.getData();
      if (data.walletCash >= fee) {
        backend.spendCash(fee, 'Agbero Terminal Dues', 'TRAVEL_COST');
        backend.addStreetCred(5);
        SoundEngine.getInstance().playConductorSlap();
        showGameToast('🤝 Paid ₦200 loading dues! Agbero: "Clear road for Chairman! +5 Cred"', 'success', 3800);
      } else {
        showGameToast('Agbero: "You no get ₦200?! Oya park your motor one side!"', 'warning', 3200);
      }
    } else {
      // Zoom past
      SoundEngine.getInstance().playVehicleHorn('danfo');
      showGameToast('💨 You sped past the checkpoint! Agbero: "Weyrey driver! You go meet me for next roundabout!"', 'info', 4000);
    }
  }

  // =========================================================================
  // MAIN UPDATE LOOP
  // =========================================================================
  public update(delta: number, currentPeriod: string): void {
    // Random NEPA power fluctuation cycle (~every 6 minutes)
    this.blackoutTimer -= delta;
    if (this.blackoutTimer <= 0) {
      this.blackoutTimer = 280 + Math.random() * 180;
      if (this.isNepaOn && (currentPeriod === 'night' || Math.random() < 0.45)) {
        this.triggerNepaBlackout();
      } else if (!this.isNepaOn) {
        this.restoreNepaPower(currentPeriod);
      }
    }
  }
}
