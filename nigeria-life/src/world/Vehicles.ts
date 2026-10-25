import * as THREE from 'three';
import { DrivableVehicle } from './DrivableVehicle';
import type { InteractiveObject } from './World';
import { SignageLibrary } from '../materials/SignageLibrary';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { bodyOf, type CarBody } from './Bodies';

export interface TrafficCar {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  lane: 'north' | 'south';
  speed: number;
  type: string;
}

export class Vehicles {
  public group: THREE.Group;
  public drivableVehicles: DrivableVehicle[] = [];
  public interactiveList: InteractiveObject[] = [];

  // Dynamic Ambient Traffic System
  private trafficCars: TrafficCar[] = [];
  public parkedVehicles: THREE.Group[] = [];

  constructor() {
    this.group = new THREE.Group();

    // 1. Drivable Vehicles (Ready on Broad Street)
    this.spawnDrivableVehicles();

    // 2. Realistic Parked Vehicles across key city locations
    this.spawnParkedVehicles();

    // 3. Moving traffic is owned by TrafficSpawner, which instances these same vehicle models
  }

  /** Puts another vehicle that can be driven into the city (a player's own, brought to them). */
  /** Adds a vehicle to be driven; `holder` is where it is drawn (Lagos's traffic group unless it stands in another city). */
  public addDrivable(vehicle: DrivableVehicle, holder: THREE.Object3D = this.group): void {
    this.drivableVehicles.push(vehicle);
    holder.add(vehicle.mesh);
  }

  public removeDrivable(vehicle: DrivableVehicle): void {
    this.drivableVehicles = this.drivableVehicles.filter((entry) => entry !== vehicle);
    vehicle.mesh.parent?.remove(vehicle.mesh);
  }

  // =========================================================================
  // 1. DRIVABLE VEHICLES
  // =========================================================================
  private spawnDrivableVehicles(): void {
    // 1. Drivable Danfo parked near Danfo Terminus
    const danfo = new DrivableVehicle(
      {
        id: 'veh-danfo',
        name: 'Danfo Minibus (Broad St Express)',
        type: 'danfo',
        maxSpeed: 24,
        reverseSpeed: 8,
        acceleration: 15,
        braking: 16,
        turnSpeed: 2.3,
        friction: 2.2,
        hornText: '📢 PAA-PAA! OYA CLEAR ROAD!',
      },
      new THREE.Vector3(-8.5, 0, 10),
      0
    );

    // 2. Drivable Keke parked near Market / POS Kiosk
    const keke = new DrivableVehicle(
      {
        id: 'veh-keke',
        name: 'Lagos Keke Napep Tricycle',
        type: 'keke',
        maxSpeed: 18,
        reverseSpeed: 7,
        acceleration: 17,
        braking: 18,
        turnSpeed: 3.4,
        friction: 2.8,
        hornText: '📢 PII-PII! KEKE DEY PASS!',
      },
      // In the kerbside bay with the ambulance and the okadas, not across the pavement where people walk
      new THREE.Vector3(12.4, 0, 12.5),
      0
    );

    // 3. Drivable Luxury Black SUV parked in front of Victoria Compound
    const suv = new DrivableVehicle(
      {
        id: 'veh-suv',
        name: 'Executive Black SUV (V8 Big Boy Spec)',
        type: 'suv',
        maxSpeed: 32,
        reverseSpeed: 10,
        acceleration: 22,
        braking: 20,
        turnSpeed: 2.6,
        friction: 2.0,
        hornText: '📢 POM-POM! VIP ESCORT / CLEAR WAY!',
      },
      // Parked beside the compound gate, not across it: the gateway is where the owner walks in
      new THREE.Vector3(-9.2, 0, 36.5),
      -Math.PI / 2
    );

    // 4. Drivable Okada parked near Suya Spot
    const okada = new DrivableVehicle(
      {
        id: 'veh-okada',
        name: 'QuickChop Delivery Okada',
        type: 'okada',
        maxSpeed: 28,
        reverseSpeed: 6,
        acceleration: 24,
        braking: 22,
        turnSpeed: 4.2,
        friction: 2.5,
        hornText: '📢 PEEP-PEEP! OKADA DEY COME!',
      },
      new THREE.Vector3(-8.8, 0, -2.0),
      Math.PI / 2
    );

    // 5. Toyota Corolla Tokunbo Sedan parked outside Eko Commercial Bank
    const sedan = new DrivableVehicle(
      {
        id: 'veh-sedan',
        name: 'Toyota Corolla Tokunbo (Cold AC Spec)',
        type: 'sedan',
        maxSpeed: 30,
        reverseSpeed: 9,
        acceleration: 20,
        braking: 20,
        turnSpeed: 3.0,
        friction: 2.1,
        hornText: '📢 PEEP-PEEP! RIDE-HAILING ARRIVED!',
      },
      new THREE.Vector3(12.5, 0, -6.5),
      Math.PI / 2
    );

    // 6. Mercedes-AMG G63 G-Wagon parked outside VIP Lounge
    const gwagon = new DrivableVehicle(
      {
        id: 'veh-gwagon',
        name: 'Mercedes-AMG G63 (Billionaire Row Edition)',
        type: 'gwagon',
        maxSpeed: 36,
        reverseSpeed: 11,
        acceleration: 30,
        braking: 25,
        turnSpeed: 2.4,
        friction: 1.9,
        hornText: '📢 BOOM-BOOM! HEAVY CONVOY MOVING!',
      },
      // Along the wall north of the footbridge, not across the pavement beside its stairs
      new THREE.Vector3(12.4, 0, 33.0),
      0
    );

    // 7. Porsche 911 GT3 Supercar parked outside Marina Luxury Showroom
    const sportsCar = new DrivableVehicle(
      {
        id: 'veh-sports',
        name: 'Porsche 911 GT3 (Rosso Corsa Supercar)',
        type: 'sports_car',
        maxSpeed: 46,
        reverseSpeed: 14,
        acceleration: 38,
        braking: 32,
        turnSpeed: 3.8,
        friction: 1.6,
        hornText: '📢 BEEP-BEEP! TRACK SPEC!',
      },
      new THREE.Vector3(-8.5, 0, -22.0),
      Math.PI
    );

    // 8. LASAMBUS Emergency Rescue Van in Emergency Bay
    const ambulance = new DrivableVehicle(
      {
        id: 'veh-ambulance',
        name: 'LASAMBUS Lagos Emergency Rescue Van',
        type: 'ambulance',
        maxSpeed: 34,
        reverseSpeed: 10,
        acceleration: 23,
        braking: 24,
        turnSpeed: 2.5,
        friction: 2.1,
        hornText: '🚨 WEE-WOO! EMERGENCY PASSING!',
      },
      new THREE.Vector3(12.0, 0, 1.5),
      0
    );

    this.drivableVehicles = [danfo, keke, suv, okada, sedan, gwagon, sportsCar, ambulance];

    for (const v of this.drivableVehicles) {
      this.group.add(v.mesh);

      this.interactiveList.push({
        mesh: v.mesh,
        id: v.id,
        name: v.name,
        category: 'Drivable Vehicle',
        description: `Get behind the wheel! Press [F] to enter driver's seat. Controls: W/S Gas/Brake, A/D Steer, H Horn.`,
        interactionPoint: new THREE.Vector3(
          v.mesh.position.x + 1.8,
          0,
          v.mesh.position.z
        ),
      });
    }
  }

  public getNearestDrivableVehicle(pos: THREE.Vector3, maxDist: number = 5.0): DrivableVehicle | null {
    let nearest: DrivableVehicle | null = null;
    let minDist = maxDist;

    for (const v of this.drivableVehicles) {
      const d = v.mesh.position.distanceTo(pos);
      if (d < minDist) {
        minDist = d;
        nearest = v;
      }
    }
    return nearest;
  }

  public getVehicleById(id: string): DrivableVehicle | undefined {
    return this.drivableVehicles.find((v) => v.id === id);
  }

  // =========================================================================
  // 2. PARKED VEHICLES (City Life Realism)
  // =========================================================================
  private spawnParkedVehicles(): void {
    // A. Silver Toyota Corolla parked at Oando Fuel Pump 1
    const { group: oandoCar } = this.createSedan(0xd1d5db); // Silver
    oandoCar.position.set(-16.0, 0, 48.0);
    this.group.add(oandoCar);

    // B. Black Executive Sedan parked in Eko Commercial Bank bay
    // (The car that stood half inside the bank, across its pavement, is gone)

    // C. White Prado SUV parked in Everyday Supermarket bay
    const { group: marketSUV } = this.createSUV(0xf8fafc); // Crisp White
    marketSUV.position.set(-9.8, 0, -56.0);
    marketSUV.rotation.y = -Math.PI / 2;
    this.group.add(marketSUV);

    // D. Broken-down Vintage Sedan on Jack Stands outside God's Grace Auto Works
    const { group: mechCar } = this.createSedan(0x1d4ed8); // Royal Blue
    mechCar.position.set(-12.5, 0, 75.0);
    mechCar.rotation.y = 0.25;
    // Jack stand underneath front left
    const jackStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.2, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0xdc2626 })
    );
    jackStand.position.set(-13.4, 0.22, 76.2);
    this.group.add(jackStand);
    this.group.add(mechCar);

    // E. 2 Dispatch Okadas parked side-by-side near Bet9ja
    const { group: okada1 } = this.createOkada(0xef4444); // Red courier box
    // Against the wall, out of the way of people walking and of the footbridge stairs
    okada1.position.set(12.3, 0, 8);
    okada1.rotation.y = 0;
    okada1.rotation.z = -0.12; // tilted on kickstand
    this.group.add(okada1);

    const { group: okada2 } = this.createOkada(0x10b981); // Emerald courier box
    okada2.position.set(13.1, 0, 8);
    okada2.rotation.y = 0;
    okada2.rotation.z = -0.12;
    this.group.add(okada2);

    // F. Golden Champagne Camry parked outside Palm View Apartments
    const { group: aptSedan } = this.createSedan(0xd97706); // Amber Gold
    aptSedan.position.set(-10.2, 0, -78.0);
    aptSedan.rotation.y = -Math.PI / 2;
    this.group.add(aptSedan);

    this.parkedVehicles = [oandoCar, marketSUV, mechCar, okada1, okada2, aptSedan];
  }

  // =========================================================================
  // 3. TRAFFIC VEHICLE PROTOTYPES (instanced by TrafficSpawner)
  // =========================================================================
  public buildTrafficVehicle(type: string, colorHex?: number): TrafficCar {
    switch (type) {
      case 'danfo': {
        const { group, wheels } = this.createDanfo();
        return { group, wheels, lane: 'north', speed: 13, type };
      }
      case 'keke': {
        const { group, wheels } = this.createKeke();
        return { group, wheels, lane: 'north', speed: 9, type };
      }
      case 'okada': {
        const { group, wheels } = this.createOkada(colorHex ?? 0x3b82f6);
        return { group, wheels, lane: 'north', speed: 14, type };
      }
      case 'suv': {
        const { group, wheels } = this.createSUV(colorHex ?? 0x18181b);
        return { group, wheels, lane: 'north', speed: 13.5, type };
      }
      case 'taxi': {
        const { group, wheels } = this.createLagosTaxi();
        return { group, wheels, lane: 'north', speed: 12, type };
      }
      case 'police': {
        const { group, wheels } = this.createPoliceTruck();
        return { group, wheels, lane: 'north', speed: 15, type };
      }
      case 'sedan':
      default: {
        const { group, wheels } = this.createSedan(colorHex ?? 0xd1d5db);
        return { group, wheels, lane: 'north', speed: 12.5, type };
      }
    }
  }

  // =========================================================================
  // 4. VEHICLE PROCEDURAL MODEL BUILDERS
  // =========================================================================

  private static sharedTireMat: THREE.MeshStandardMaterial | null = null;
  private static sharedRimMat: THREE.MeshStandardMaterial | null = null;

  /** Helper: builds a high-detail automotive wheel assembly */
  private createRealisticWheel(radius: number, width: number, rimRadius: number): { holder: THREE.Group; tire: THREE.Mesh } {
    const holder = new THREE.Group();

    if (!Vehicles.sharedTireMat) {
      Vehicles.sharedTireMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.88,
        metalness: 0.05,
      });
    }
    if (!Vehicles.sharedRimMat) {
      Vehicles.sharedRimMat = new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        metalness: 0.85,
        roughness: 0.25,
      });
    }

    // Main rubber tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 14);
    const tire = new THREE.Mesh(tireGeo, Vehicles.sharedTireMat);
    tire.rotation.z = Math.PI / 2;
    holder.add(tire);

    // Silver alloy rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(rimRadius, rimRadius, width * 1.02, 10), Vehicles.sharedRimMat);
    rim.rotation.z = Math.PI / 2;
    holder.add(rim);

    return { holder, tire };
  }


  // A. Classic Yellow Lagos Danfo Minibus
  private createDanfo(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const signLib = SignageLibrary.getInstance();
    const bus = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const yellowMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.25,
      metalness: 0.45,
      clearcoat: 0.85,
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.08, metalness: 0.92 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    // Lower Chassis Body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.15, 5.3), yellowMat);
    lowerBody.position.y = 1.02;
    lowerBody.castShadow = true;
    bus.add(lowerBody);

    // Upper Cabin Band
    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.95, 5.1), yellowMat);
    upperCabin.position.set(0, 1.95, -0.05);
    upperCabin.castShadow = true;
    bus.add(upperCabin);

    // Curved Roof Crown - Sculpted van roof with ribs
    const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.12, 5.12), yellowMat);
    roofPanel.position.set(0, 2.44, -0.05);
    roofPanel.castShadow = true;
    bus.add(roofPanel);

    for (const rx of [-0.65, -0.22, 0.22, 0.65]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 4.8), yellowMat);
      rib.position.set(rx, 2.51, -0.05);
      bus.add(rib);
    }

    // Twin black side route stripes
    const decalGeo = new THREE.PlaneGeometry(5.28, 0.42);
    const decalR = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalR.position.set(1.18, 1.25, 0);
    decalR.rotation.y = Math.PI / 2;
    bus.add(decalR);

    const decalL = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalL.position.set(-1.18, 1.25, 0);
    decalL.rotation.y = -Math.PI / 2;
    bus.add(decalL);

    // Raked Windshield & Visor
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.82), glassMat);
    windshield.position.set(0, 1.95, 2.56);
    windshield.rotation.x = -0.15;
    bus.add(windshield);

    const visor = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 0.20), signLib.danfoVisorMaterial);
    visor.position.set(0, 2.25, 2.53);
    visor.rotation.x = -0.15;
    bus.add(visor);

    // Front Grille & Headlights
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.08), trimMat);
    grille.position.set(0, 0.95, 2.66);
    bus.add(grille);

    for (const hx of [-0.95, 0.95]) {
      const lightLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.06, 14),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xffedd5, emissiveIntensity: 1.2 })
      );
      lightLens.rotation.x = Math.PI / 2;
      lightLens.position.set(hx, 0.95, 2.68);
      bus.add(lightLens);
    }

    // Front and Rear Bumpers
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.28, 0.22), trimMat);
    fBump.position.set(0, 0.58, 2.75);
    bus.add(fBump);

    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.28, 0.22), trimMat);
    rBump.position.set(0, 0.58, -2.75);
    bus.add(rBump);

    // Wheels (4 realistic wheel assemblies)
    for (const off of [
      { x: -1.18, z: 1.7 },
      { x: 1.18, z: 1.7 },
      { x: -1.18, z: -1.7 },
      { x: 1.18, z: -1.7 },
    ]) {
      const { holder, tire } = this.createRealisticWheel(0.44, 0.28, 0.24);
      holder.position.set(off.x, 0.44, off.z);
      wheels.push(tire);
      bus.add(holder);
    }

    return { group: bus, wheels };
  }

  // B. Keke NAPEP Tricycle
  private createKeke(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const matLib = MaterialLibrary.getInstance();
    const keke = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const yellowPaint = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.15 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.92 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.75 });

    // Chassis & Nose Cowl
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.55, 2.4), yellowPaint);
    chassis.position.y = 0.58;
    chassis.castShadow = true;
    keke.add(chassis);

    const noseCowl = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.95, 16), yellowPaint);
    noseCowl.rotation.x = Math.PI;
    noseCowl.scale.set(1, 1, 0.65);
    noseCowl.position.set(0, 0.95, 1.1);
    keke.add(noseCowl);

    // Roll cage pillars
    for (const px of [-0.70, 0.70]) {
      for (const pz of [-1.05, 0.05, 0.95]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.92, 8), matLib.ironRailingMaterial);
        pillar.position.set(px, 1.42, pz);
        keke.add(pillar);
      }
    }

    // Curved Canvas Canopy
    const roofGeo = new THREE.CylinderGeometry(0.76, 0.76, 2.15, 16);
    roofGeo.scale(1, 0.28, 1);
    const roof = new THREE.Mesh(roofGeo, canopyMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 1.95, -0.1);
    keke.add(roof);

    // Seats
    const passengerBench = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 0.55), cushionMat);
    passengerBench.position.set(0, 0.82, -0.65);
    keke.add(passengerBench);

    // Cyclops Headlight
    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.10, 16),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfffaed, emissiveIntensity: 1.4, roughness: 0.15 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.86, 1.25);
    keke.add(headlight);

    // Realistic Wheels (1 Front, 2 Rear)
    const { holder: fHolder, tire: fTire } = this.createRealisticWheel(0.32, 0.18, 0.18);
    fHolder.position.set(0, 0.32, 1.15);
    wheels.push(fTire);
    keke.add(fHolder);

    for (const rx of [-0.74, 0.74]) {
      const { holder: rHolder, tire: rTire } = this.createRealisticWheel(0.32, 0.18, 0.18);
      rHolder.position.set(rx, 0.32, -0.85);
      wheels.push(rTire);
      keke.add(rHolder);
    }

    return { group: keke, wheels };
  }

  // C. Okada Commercial Motorcycle with Rider & Delivery Box
  private createOkada(boxColorHex: number = 0xef4444): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const okada = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
    const tankMat = new THREE.MeshPhysicalMaterial({ color: 0xdc2626, metalness: 0.65, roughness: 0.2, clearcoat: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 });

    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 1.6), frameMat);
    frame.position.y = 0.62;
    okada.add(frame);

    // Sculpted Teardrop Fuel Tank
    const tankGeo = new THREE.SphereGeometry(0.24, 12, 10);
    tankGeo.scale(0.85, 0.95, 1.6);
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(0, 0.86, 0.18);
    okada.add(tank);

    // Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.68),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.85 })
    );
    seat.position.set(0, 0.82, -0.32);
    okada.add(seat);

    // Courier Delivery Box
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.46, 0.46),
      new THREE.MeshPhysicalMaterial({ color: boxColorHex, roughness: 0.4, clearcoat: 0.6 })
    );
    box.position.set(0, 1.05, -0.76);
    box.castShadow = true;
    okada.add(box);

    // Handlebars & Headlight
    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.04, 0.04), chromeMat);
    handlebar.position.set(0, 1.05, 0.85);
    okada.add(handlebar);

    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.09, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 1.5 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.88, 0.94);
    okada.add(headlight);

    // Rider
    const riderTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a })
    );
    riderTorso.position.set(0, 1.15, -0.05);
    okada.add(riderTorso);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 })
    );
    helmet.position.set(0, 1.55, 0.0);
    okada.add(helmet);

    // Realistic Wheels
    const { holder: fHolder, tire: fTire } = this.createRealisticWheel(0.36, 0.12, 0.26);
    fHolder.position.set(0, 0.35, 0.85);
    wheels.push(fTire);
    okada.add(fHolder);

    const { holder: rHolder, tire: rTire } = this.createRealisticWheel(0.36, 0.12, 0.26);
    rHolder.position.set(0, 0.35, -0.72);
    wheels.push(rTire);
    okada.add(rHolder);

    return { group: okada, wheels };
  }

  // D. Lagos 4-Door Sedan (Toyota Corolla / Camry)
  private createSedan(paintColor: number): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const car = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const paintMat = new THREE.MeshPhysicalMaterial({
      color: paintColor,
      metalness: 0.65,
      roughness: 0.22,
      clearcoat: 0.85,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.92,
      roughness: 0.08,
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    // Lower Chassis
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.68, 4.6), paintMat);
    lowerBody.position.y = 0.60;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    // Sculpted Sloped Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 1.4), paintMat);
    hood.position.set(0, 0.85, 1.5);
    car.add(hood);

    // Aerodynamic Cabin / Roof
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.68, 2.5), paintMat);
    cabin.position.set(0, 1.20, -0.2);
    car.add(cabin);

    // Windshield & Rear glass (Raked angles)
    const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.65), glassMat);
    frontWindshield.rotation.x = -0.38;
    frontWindshield.position.set(0, 1.18, 1.08);
    car.add(frontWindshield);

    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.60), glassMat);
    rearGlass.rotation.x = Math.PI + 0.38;
    rearGlass.position.set(0, 1.18, -1.48);
    car.add(rearGlass);

    // Front Grille & Headlights
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.08), trimMat);
    grille.position.set(0, 0.62, 2.32);
    car.add(grille);

    for (const hx of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.16, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffedd5, emissiveIntensity: 1.3 })
      );
      hl.position.set(hx, 0.66, 2.31);
      car.add(hl);
    }

    // Taillights
    for (const hx of [-0.78, 0.78]) {
      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.16, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 1.0 })
      );
      tl.position.set(hx, 0.66, -2.31);
      car.add(tl);
    }

    // Bumpers
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.24, 0.15), trimMat);
    fBump.position.set(0, 0.40, 2.34);
    car.add(fBump);

    const rBump = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.24, 0.15), trimMat);
    rBump.position.set(0, 0.40, -2.34);
    car.add(rBump);

    // Realistic Alloy Wheels (4 wheels)
    for (const off of [
      { x: -1.05, z: 1.4 },
      { x: 1.05, z: 1.4 },
      { x: -1.05, z: -1.4 },
      { x: 1.05, z: -1.4 },
    ]) {
      const { holder, tire } = this.createRealisticWheel(0.36, 0.22, 0.20);
      holder.position.set(off.x, 0.36, off.z);
      wheels.push(tire);
      car.add(holder);
    }

    return { group: car, wheels };
  }

  // E. Luxury Nigerian SUV (Prado / G-Wagon)
  private createSUV(paintColor: number): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const suv = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const paintMat = new THREE.MeshPhysicalMaterial({
      color: paintColor,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 0.9,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.05,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 });

    // Bulky Lower Body & Hood
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.95, 4.8), paintMat);
    lowerBody.position.y = 0.88;
    lowerBody.castShadow = true;
    suv.add(lowerBody);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.35, 1.7), paintMat);
    hood.position.set(0, 1.35, 1.5);
    suv.add(hood);

    // Boxy High-Roof Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.92, 3.1), paintMat);
    cabin.position.set(0, 1.82, -0.4);
    suv.add(cabin);

    // Tinted Glass
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.82), glassMat);
    windshield.rotation.x = -0.32;
    windshield.position.set(0, 1.82, 1.15);
    suv.add(windshield);

    // Chrome Radiator Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.52, 0.12), chromeMat);
    grille.position.set(0, 1.05, 2.42);
    suv.add(grille);

    // LED Headlights
    for (const hx of [-0.90, 0.90]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.20, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.4 })
      );
      hl.position.set(hx, 1.15, 2.41);
      suv.add(hl);
    }

    // Spare Tire on rear tailgate
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.30, 18), paintMat);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.15, -2.52);
    suv.add(spare);

    // Large All-Terrain Alloy Wheels
    for (const off of [
      { x: -1.18, z: 1.5 },
      { x: 1.18, z: 1.5 },
      { x: -1.18, z: -1.5 },
      { x: 1.18, z: -1.5 },
    ]) {
      const { holder, tire } = this.createRealisticWheel(0.48, 0.30, 0.26);
      holder.position.set(off.x, 0.48, off.z);
      wheels.push(tire);
      suv.add(holder);
    }

    return { group: suv, wheels };
  }

  // F. Yellow Lagos Commercial Taxi (Twin Red Stripes)
  private createLagosTaxi(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const { group: car, wheels } = this.createSedan(0xfacc15);

    // Twin Red Stripes on flanks
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
    for (const sx of [-1.06, 1.06]) {
      const stripe1 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.12), redMat);
      stripe1.position.set(sx, 0.68, 0);
      stripe1.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.add(stripe1);

      const stripe2 = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.12), redMat);
      stripe2.position.set(sx, 0.48, 0);
      stripe2.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.add(stripe2);
    }

    // TAXI Roof Light
    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.18, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffedd5, emissiveIntensity: 0.6 })
    );
    taxiSign.position.set(0, 1.58, -0.2);
    car.add(taxiSign);

    return { group: car, wheels };
  }

  // G. Nigerian Police Patrol Pickup (Black/Blue with Emergency Lightbar)
  private createPoliceTruck(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const truck = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9 });

    // Cab & Open Truck Bed
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 2.6), bodyMat);
    cab.position.set(0, 1.1, 0.6);
    truck.add(cab);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 2.4), bodyMat);
    bed.position.set(0, 0.85, -1.8);
    truck.add(bed);

    // Steel Rollbar in truck bed
    const rollbar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), chromeMat);
    rollbar.rotation.z = Math.PI / 2;
    rollbar.position.set(0, 1.6, -0.8);
    truck.add(rollbar);

    // Front Windshield
    const windshield = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 })
    );
    windshield.rotation.x = -0.35;
    windshield.position.set(0, 1.35, 1.95);
    truck.add(windshield);

    // Rooftop Red & Blue Police Lightbar
    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 2.2 })
    );
    redLight.position.set(-0.35, 1.82, 0.6);
    truck.add(redLight);

    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 2.2 })
    );
    blueLight.position.set(0.35, 1.82, 0.6);
    truck.add(blueLight);

    // Realistic Wheels (4 All-Terrain Truck Wheels)
    for (const off of [
      { x: -1.18, z: 1.4 },
      { x: 1.18, z: 1.4 },
      { x: -1.18, z: -1.7 },
      { x: 1.18, z: -1.7 },
    ]) {
      const { holder, tire } = this.createRealisticWheel(0.44, 0.28, 0.24);
      holder.position.set(off.x, 0.44, off.z);
      wheels.push(tire);
      truck.add(holder);
    }

    return { group: truck, wheels };
  }

  // =========================================================================
  // 5. UPDATE LOOP
  // =========================================================================
  public update(delta: number, keys: Record<string, boolean> = {}, playerPos?: THREE.Vector3, city: string = 'lagos'): void {
    this.updateDrivables(delta, keys, playerPos, city);
    this.updateTraffic(delta, playerPos);
  }

  /** The vehicles that can be driven, in the city on show: moved, and drawn when near. Those elsewhere wait where they are. */
  public updateDrivables(delta: number, keys: Record<string, boolean>, playerPos: THREE.Vector3 | undefined, city: string): void {
    for (const v of this.drivableVehicles) {
      if (v.city !== city) continue;
      if (playerPos) {
        const dSq = (v.mesh.position.x - playerPos.x) ** 2 + (v.mesh.position.z - playerPos.z) ** 2;
        const visible = dSq < 48 * 48;
        v.mesh.visible = visible;
        if (!visible) continue;
      } else {
        v.mesh.visible = true;
      }
      v.update(delta, keys);
    }
  }

  private updateTraffic(delta: number, playerPos?: THREE.Vector3): void {
    // 2. Distance culling on static parked vehicles
    if (playerPos) {
      for (const car of this.parkedVehicles) {
        const dSq = (car.position.x - playerPos.x) ** 2 + (car.position.z - playerPos.z) ** 2;
        car.visible = dSq < 45 * 45;
      }
    }

    // 3. Update Dynamic Continuous Ambient Traffic Stream
    for (const car of this.trafficCars) {
      if (car.lane === 'north') {
        car.group.position.z += car.speed * delta;
        for (const w of car.wheels) {
          w.rotation.x += car.speed * delta * 2.2;
        }
        // Despawn & recycle when passing North edge
        if (car.group.position.z > 115) {
          car.group.position.z = -115 - Math.random() * 12;
          car.speed = 10.5 + Math.random() * 4.5;
        }
      } else {
        car.group.position.z -= car.speed * delta;
        for (const w of car.wheels) {
          w.rotation.x -= car.speed * delta * 2.2;
        }
        // Despawn & recycle when passing South edge
        if (car.group.position.z < -115) {
          car.group.position.z = 115 + Math.random() * 12;
          car.speed = 10.0 + Math.random() * 4.5;
        }
      }
    }
  }

  private bodyPool: CarBody[] = [];

  /**
   * The vehicles standing in `city` within `range` of a point, as boxes on the ground (added to
   * `out`): the parked ones and those that can be driven, except one with a driver in it.
   */
  public cars(x: number, z: number, range: number, out: CarBody[], city: string): void {
    let used = 0;
    const add = (object: THREE.Object3D) => {
      const p = object.position;
      if (Math.abs(p.x - x) > range || Math.abs(p.z - z) > range) return;
      const body = this.bodyPool[used] ?? (this.bodyPool[used] = { x: 0, z: 0, yaw: 0, halfWidth: 0, halfLength: 0 });
      used += 1;
      out.push(bodyOf(object, body));
      body.parked = true;
    };
    for (const v of this.drivableVehicles) {
      if (v.city !== city || v.driver) continue;
      add(v.mesh);
    }
    if (city === 'lagos') for (const car of this.parkedVehicles) add(car);
  }
}
