import * as THREE from 'three';
import { DrivableVehicle } from './DrivableVehicle';
import type { InteractiveObject } from './World';
import { SignageLibrary } from '../materials/SignageLibrary';
import { MaterialLibrary } from '../materials/MaterialLibrary';

export class Vehicles {
  public group: THREE.Group;
  public drivableVehicles: DrivableVehicle[] = [];
  public interactiveList: InteractiveObject[] = [];

  // Ambient traffic
  private ambientDanfo: THREE.Group;
  private ambientKeke: THREE.Group;
  private ambientDanfoWheels: THREE.Mesh[] = [];
  private ambientKekeWheels: THREE.Mesh[] = [];
  private ambientDanfoSpeed: number = 13;
  private ambientKekeSpeed: number = 9;

  constructor() {
    this.group = new THREE.Group();

    // 1. Drivable Vehicles (Ready on Broad Street)
    this.spawnDrivableVehicles();

    // 2. Ambient traffic cruisers
    this.ambientDanfo = this.createAmbientDanfo();
    this.ambientKeke = this.createAmbientKeke();

    this.ambientDanfo.position.set(-3.2, 0, -85);
    this.ambientKeke.position.set(3.2, 0, 75);
    this.ambientKeke.rotation.y = Math.PI;

    this.group.add(this.ambientDanfo);
    this.group.add(this.ambientKeke);
  }

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
      new THREE.Vector3(-9.2, 0, 24),
      -Math.PI / 2
    );

    this.drivableVehicles = [danfo, keke, suv];

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

  // === AMBIENT TRAFFIC MODELS ===
  private createAmbientDanfo(): THREE.Group {
    const signLib = SignageLibrary.getInstance();
    const bus = new THREE.Group();

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

    // Twin black side route decals along left and right flanks
    const decalGeo = new THREE.PlaneGeometry(5.18, 0.42);
    const decalR = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalR.position.set(1.16, 1.35, 0);
    decalR.rotation.y = Math.PI / 2;
    bus.add(decalR);

    const decalL = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalL.position.set(-1.16, 1.35, 0);
    decalL.rotation.y = -Math.PI / 2;
    bus.add(decalL);

    // Windshield & sun visor
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.9 });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.8), glassMat);
    windshield.position.set(0, 1.8, 2.61);
    bus.add(windshield);

    const visor = new THREE.Mesh(new THREE.PlaneGeometry(1.98, 0.2), signLib.danfoVisorMaterial);
    visor.position.set(0, 2.1, 2.615);
    bus.add(visor);

    // Headlights
    for (const hx of [-0.85, 0.85]) {
      const lightGeo = new THREE.BoxGeometry(0.32, 0.2, 0.08);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        emissive: 0xffedd5,
        emissiveIntensity: 1.2,
      });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(hx, 0.88, 2.61);
      bus.add(light);
    }

    // Taillights
    for (const hx of [-0.85, 0.85]) {
      const tailGeo = new THREE.BoxGeometry(0.32, 0.2, 0.08);
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
      });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(hx, 0.88, -2.61);
      bus.add(tail);
    }

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
      this.ambientDanfoWheels.push(wheel);
      bus.add(wheel);
    }
    return bus;
  }

  private createAmbientKeke(): THREE.Group {
    const matLib = MaterialLibrary.getInstance();
    const keke = new THREE.Group();

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
        const pillarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8);
        const pillar = new THREE.Mesh(pillarGeo, matLib.ironRailingMaterial);
        pillar.position.set(px, 1.3, pz);
        keke.add(pillar);
      }
    }

    const roofGeo = new THREE.BoxGeometry(1.55, 0.85, 2.2);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 }));
    roof.position.y = 1.75;
    keke.add(roof);

    // Front Cyclops Headlight
    const headGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfffaed,
      emissiveIntensity: 1.3,
    });
    const headlight = new THREE.Mesh(headGeo, headMat);
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.82, 1.21);
    keke.add(headlight);

    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    const fWheel = new THREE.Mesh(wheelGeo, wheelMat);
    fWheel.rotation.z = Math.PI / 2;
    fWheel.position.set(0, 0.3, 1.1);
    this.ambientKekeWheels.push(fWheel);
    keke.add(fWheel);

    for (const rx of [-0.78, 0.78]) {
      const rWheel = new THREE.Mesh(wheelGeo, wheelMat);
      rWheel.rotation.z = Math.PI / 2;
      rWheel.position.set(rx, 0.3, -0.9);
      this.ambientKekeWheels.push(rWheel);
      keke.add(rWheel);
    }
    return keke;
  }

  public update(delta: number, keys: Record<string, boolean> = {}): void {
    // 1. Update Drivable Vehicles
    for (const v of this.drivableVehicles) {
      v.update(delta, keys);
    }

    // 2. Update Ambient Traffic
    this.ambientDanfo.position.z += this.ambientDanfoSpeed * delta;
    for (let w of this.ambientDanfoWheels) {
      w.rotation.x += this.ambientDanfoSpeed * delta * 2.2;
    }
    if (this.ambientDanfo.position.z > 110) {
      this.ambientDanfo.position.z = -110;
    }

    this.ambientKeke.position.z -= this.ambientKekeSpeed * delta;
    for (let w of this.ambientKekeWheels) {
      w.rotation.x -= this.ambientKekeSpeed * delta * 2.8;
    }
    if (this.ambientKeke.position.z < -110) {
      this.ambientKeke.position.z = 110;
    }
  }
}
