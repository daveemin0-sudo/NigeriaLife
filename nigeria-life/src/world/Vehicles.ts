import * as THREE from 'three';
import { DrivableVehicle } from './DrivableVehicle';
import type { InteractiveObject } from './World';
import { SignageLibrary } from '../materials/SignageLibrary';
import { MaterialLibrary } from '../materials/MaterialLibrary';

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

  constructor() {
    this.group = new THREE.Group();

    // 1. Drivable Vehicles (Ready on Broad Street)
    this.spawnDrivableVehicles();

    // 2. Realistic Parked Vehicles across key city locations
    this.spawnParkedVehicles();

    // 3. Moving traffic is owned by TrafficSpawner, which instances these same vehicle models
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
      new THREE.Vector3(9.2, 0, 4),
      Math.PI / 2
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

    this.drivableVehicles = [danfo, keke, suv, okada];

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
    const { group: bankCar } = this.createSedan(0x0f172a); // Deep Navy/Black
    bankCar.position.set(9.6, 0, -25.0);
    bankCar.rotation.y = Math.PI / 2;
    this.group.add(bankCar);

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
    okada1.position.set(9.5, 0, 14.5);
    okada1.rotation.y = Math.PI / 2;
    okada1.rotation.z = -0.12; // tilted on kickstand
    this.group.add(okada1);

    const { group: okada2 } = this.createOkada(0x10b981); // Emerald courier box
    okada2.position.set(9.5, 0, 16.5);
    okada2.rotation.y = Math.PI / 2;
    okada2.rotation.z = -0.12;
    this.group.add(okada2);

    // F. Golden Champagne Camry parked outside Palm View Apartments
    const { group: aptSedan } = this.createSedan(0xd97706); // Amber Gold
    aptSedan.position.set(-10.2, 0, -78.0);
    aptSedan.rotation.y = -Math.PI / 2;
    this.group.add(aptSedan);
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

  // A. Classic Yellow Lagos Danfo Minibus
  private createDanfo(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const signLib = SignageLibrary.getInstance();
    const bus = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const bodyGeo = new THREE.BoxGeometry(2.3, 2.0, 5.2);
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.position.y = 1.4;
    body.castShadow = true;
    bus.add(body);

    // Twin black stripes decal on sides
    const decalGeo = new THREE.PlaneGeometry(5.18, 0.42);
    const decalR = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalR.position.set(1.16, 1.35, 0);
    decalR.rotation.y = Math.PI / 2;
    bus.add(decalR);

    const decalL = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalL.position.set(-1.16, 1.35, 0);
    decalL.rotation.y = -Math.PI / 2;
    bus.add(decalL);

    // Windshield & visor
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.9 });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), glassMat);
    windshield.position.set(0, 1.8, 2.61);
    bus.add(windshield);

    const visor = new THREE.Mesh(new THREE.PlaneGeometry(1.98, 0.2), signLib.danfoVisorMaterial);
    visor.position.set(0, 2.1, 2.615);
    bus.add(visor);

    // Headlights
    for (const hx of [-0.85, 0.85]) {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xffedd5, emissiveIntensity: 1.2 })
      );
      light.position.set(hx, 0.88, 2.61);
      bus.add(light);
    }

    // Taillights
    for (const hx of [-0.85, 0.85]) {
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.2, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.9 })
      );
      tail.position.set(hx, 0.88, -2.61);
      bus.add(tail);
    }

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    for (const off of [
      { x: -1.15, z: 1.6 },
      { x: 1.15, z: 1.6 },
      { x: -1.15, z: -1.6 },
      { x: 1.15, z: -1.6 },
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(off.x, 0.42, off.z);
      wheels.push(wheel);
      bus.add(wheel);
    }

    return { group: bus, wheels };
  }

  // B. Keke NAPEP Tricycle
  private createKeke(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const matLib = MaterialLibrary.getInstance();
    const keke = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const baseGeo = new THREE.BoxGeometry(1.5, 0.9, 2.4);
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeo, yellowMat);
    base.position.y = 0.8;
    base.castShadow = true;
    keke.add(base);

    // Roll cage pillars
    for (const px of [-0.72, 0.72]) {
      for (const pz of [-1.0, 0.1, 1.0]) {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8),
          matLib.ironRailingMaterial
        );
        pillar.position.set(px, 1.3, pz);
        keke.add(pillar);
      }
    }

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 0.85, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 })
    );
    roof.position.y = 1.75;
    keke.add(roof);

    // Cyclops Headlight
    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfffaed, emissiveIntensity: 1.3 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.82, 1.21);
    keke.add(headlight);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    const fWheel = new THREE.Mesh(wheelGeo, wheelMat);
    fWheel.rotation.z = Math.PI / 2;
    fWheel.position.set(0, 0.3, 1.1);
    wheels.push(fWheel);
    keke.add(fWheel);

    for (const rx of [-0.78, 0.78]) {
      const rWheel = new THREE.Mesh(wheelGeo, wheelMat);
      rWheel.rotation.z = Math.PI / 2;
      rWheel.position.set(rx, 0.3, -0.9);
      wheels.push(rWheel);
      keke.add(rWheel);
    }

    return { group: keke, wheels };
  }

  // C. Okada Commercial Motorcycle with Rider & Delivery Box
  private createOkada(boxColorHex: number = 0xef4444): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const okada = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    // Bike Frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 1.6), frameMat);
    frame.position.y = 0.65;
    okada.add(frame);

    // Fuel Tank (Red or Blue)
    const tank = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.4, roughness: 0.2 })
    );
    tank.position.set(0, 0.82, 0.2);
    okada.add(tank);

    // Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 })
    );
    seat.position.set(0, 0.8, -0.3);
    okada.add(seat);

    // Dispatch Courier Box on back rack
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.45, 0.45),
      new THREE.MeshStandardMaterial({ color: boxColorHex, roughness: 0.5 })
    );
    box.position.set(0, 1.05, -0.75);
    box.castShadow = true;
    okada.add(box);

    // Handlebars
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), frameMat);
    bar.position.set(0, 1.05, 0.55);
    okada.add(bar);

    // Rider (Abstract torso + helmet)
    const riderTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a }) // Blue jacket
    );
    riderTorso.position.set(0, 1.15, -0.05);
    okada.add(riderTorso);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 }) // Yellow safety helmet
    );
    helmet.position.set(0, 1.55, 0.0);
    okada.add(helmet);

    // Headlight
    const light = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 1.4 })
    );
    light.rotation.x = Math.PI / 2;
    light.position.set(0, 0.85, 0.86);
    okada.add(light);

    // 2 Thin Motorcycle Wheels
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);

    const fWheel = new THREE.Mesh(wheelGeo, tireMat);
    fWheel.rotation.z = Math.PI / 2;
    fWheel.position.set(0, 0.35, 0.8);
    wheels.push(fWheel);
    okada.add(fWheel);

    const rWheel = new THREE.Mesh(wheelGeo, tireMat);
    rWheel.rotation.z = Math.PI / 2;
    rWheel.position.set(0, 0.35, -0.7);
    wheels.push(rWheel);
    okada.add(rWheel);

    return { group: okada, wheels };
  }

  // D. Lagos 4-Door Sedan (Toyota Corolla / Camry)
  private createSedan(paintColor: number): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const car = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const paintMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      metalness: 0.5,
      roughness: 0.25,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.1,
    });

    // Lower Chassis
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 4.5), paintMat);
    lowerBody.position.y = 0.58;
    lowerBody.castShadow = true;
    car.add(lowerBody);

    // Cabin / Roof
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.65, 2.5), paintMat);
    cabin.position.set(0, 1.15, -0.2);
    car.add(cabin);

    // Windshield & Rear glass
    const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), glassMat);
    frontWindshield.rotation.x = -0.4;
    frontWindshield.position.set(0, 1.15, 1.08);
    car.add(frontWindshield);

    const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.55), glassMat);
    rearGlass.rotation.x = Math.PI + 0.4;
    rearGlass.position.set(0, 1.15, -1.48);
    car.add(rearGlass);

    // Headlights
    for (const hx of [-0.75, 0.75]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffedd5, emissiveIntensity: 1.2 })
      );
      hl.position.set(hx, 0.62, 2.26);
      car.add(hl);
    }

    // Taillights
    for (const hx of [-0.75, 0.75]) {
      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.15, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 1.0 })
      );
      tl.position.set(hx, 0.62, -2.26);
      car.add(tl);
    }

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.8 });
    for (const off of [
      { x: -1.05, z: 1.35 },
      { x: 1.05, z: 1.35 },
      { x: -1.05, z: -1.35 },
      { x: 1.05, z: -1.35 },
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(off.x, 0.34, off.z);
      wheels.push(wheel);
      car.add(wheel);
    }

    return { group: car, wheels };
  }

  // E. Luxury Nigerian SUV (Prado / G-Wagon)
  private createSUV(paintColor: number): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const suv = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const paintMat = new THREE.MeshStandardMaterial({
      color: paintColor,
      metalness: 0.6,
      roughness: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.05,
    });

    // Bulky Lower Body
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.95, 4.8), paintMat);
    lowerBody.position.y = 0.85;
    lowerBody.castShadow = true;
    suv.add(lowerBody);

    // Boxy High-Roof Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.9, 3.2), paintMat);
    cabin.position.set(0, 1.7, -0.4);
    suv.add(cabin);

    // Tinted Glass
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.8), glassMat);
    windshield.rotation.x = -0.3;
    windshield.position.set(0, 1.7, 1.25);
    suv.add(windshield);

    // Spare Tire mounted on rear tailgate
    const spare = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
    );
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.25, -2.48);
    suv.add(spare);

    // Front Bumper Bull-bar
    const bullBar = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.25, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 })
    );
    bullBar.position.set(0, 0.65, 2.45);
    suv.add(bullBar);

    // Headlights
    for (const hx of [-0.85, 0.85]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.22, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffedd5, emissiveIntensity: 1.3 })
      );
      hl.position.set(hx, 0.95, 2.41);
      suv.add(hl);
    }

    // Large All-Terrain Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    for (const off of [
      { x: -1.2, z: 1.45 },
      { x: 1.2, z: 1.45 },
      { x: -1.2, z: -1.45 },
      { x: 1.2, z: -1.45 },
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(off.x, 0.44, off.z);
      wheels.push(wheel);
      suv.add(wheel);
    }

    return { group: suv, wheels };
  }

  // F. Yellow Lagos Commercial Taxi (Twin Red Stripes)
  private createLagosTaxi(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const { group: car, wheels } = this.createSedan(0xfacc15); // Taxi yellow

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
    taxiSign.position.set(0, 1.55, -0.2);
    car.add(taxiSign);

    return { group: car, wheels };
  }

  // G. Nigerian Police Patrol Pickup (Black/Blue with Emergency Lightbar)
  private createPoliceTruck(): { group: THREE.Group; wheels: THREE.Mesh[] } {
    const truck = new THREE.Group();
    const wheels: THREE.Mesh[] = [];

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 }); // Dark Police Spec

    // Lower Frame & Open Truck Bed
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.3, 2.6), bodyMat);
    cab.position.set(0, 1.1, 0.6);
    truck.add(cab);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 2.4), bodyMat);
    bed.position.set(0, 0.85, -1.8);
    truck.add(bed);

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

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
    for (const off of [
      { x: -1.18, z: 1.4 },
      { x: 1.18, z: 1.4 },
      { x: -1.18, z: -1.7 },
      { x: 1.18, z: -1.7 },
    ]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(off.x, 0.42, off.z);
      wheels.push(wheel);
      truck.add(wheel);
    }

    return { group: truck, wheels };
  }

  // =========================================================================
  // 5. UPDATE LOOP
  // =========================================================================
  public update(delta: number, keys: Record<string, boolean> = {}): void {
    // 1. Update Drivable Vehicles
    for (const v of this.drivableVehicles) {
      v.update(delta, keys);
    }

    // 2. Update Dynamic Continuous Ambient Traffic Stream
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
}
