import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { Solids } from './plan/Solids';
import { SignageLibrary } from '../materials/SignageLibrary';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { AssetManager } from '../assets/AssetManager';
import { SoundEngine } from '../audio/SoundEngine';
import { showGameToast } from '../ui/GameToast';
import { BackendService } from '../backend/BackendService';

export type VehicleType = 'danfo' | 'keke' | 'suv' | 'okada';

export interface VehicleConfig {
  id: string;
  name: string;
  type: VehicleType;
  maxSpeed: number;     // Units/sec
  reverseSpeed: number;
  acceleration: number;
  braking: number;
  turnSpeed: number;
  friction: number;
  hornText: string;
}

export class DrivableVehicle {
  /** What cannot be driven through where the game is now: set once by the game */
  public static solids: (() => Solids | null) | null = null;

  public id: string;
  public name: string;
  public type: VehicleType;
  public mesh: THREE.Group;
  public config: VehicleConfig;

  public currentSpeed: number = 0;
  public turnAngle: number = 0;
  public driver: Player | null = null;

  // Fuel System (Milestone B)
  public fuel: number = 85; // 0 - 100%
  public isLowFuelWarned: boolean = false;

  // Commercial Transit & Fare Collection System (Milestone B)
  public isCommercialTransit: boolean = false;
  public passengers: number = 0;
  public maxPassengers: number = 8;
  public fareRate: number = 350;
  public totalFaresCollected: number = 0;
  public pickupTimer: number = 0;

  private wheels: THREE.Mesh[] = [];
  private steerWheels: THREE.Mesh[] = [];
  private hornDisplayGroup: THREE.Group;
  private hornTimer: number = 0;
  private hornTextMesh?: THREE.Sprite;

  constructor(config: VehicleConfig, initialPos: THREE.Vector3, initialRotY: number = 0) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;

    this.isCommercialTransit = this.type === 'danfo' || this.type === 'keke';
    this.maxPassengers = this.type === 'danfo' ? 8 : this.type === 'keke' ? 3 : this.type === 'suv' ? 4 : 1;
    this.fareRate = this.type === 'danfo' ? 350 : this.type === 'keke' ? 250 : 500;

    this.mesh = new THREE.Group();
    this.mesh.position.copy(initialPos);
    this.mesh.rotation.y = initialRotY;

    // Build the high-detail stylized-realistic 3D vehicle model
    if (this.type === 'danfo') {
      this.buildDanfo();
    } else if (this.type === 'keke') {
      this.buildKeke();
    } else if (this.type === 'okada') {
      this.buildOkada();
    } else {
      this.buildLuxurySUV();
    }

    // Horn bubble billboard above roof
    this.hornDisplayGroup = new THREE.Group();
    this.hornDisplayGroup.position.set(0, 3.2, 0);
    this.hornDisplayGroup.visible = false;
    this.mesh.add(this.hornDisplayGroup);
    this.createHornSprite();

    // Asynchronous GLB model loading if available in public/models/vehicles/
    const glbMap: Record<VehicleType, string> = {
      danfo: '/models/vehicles/danfo_minibus.glb',
      keke: '/models/vehicles/keke_napep.glb',
      suv: '/models/vehicles/suv_luxury.glb',
      okada: '/models/vehicles/okada_bike.glb',
    };
    AssetManager.getInstance().instantiate(glbMap[this.type]).then((glbScene) => {
      if (glbScene) {
        for (let i = this.mesh.children.length - 1; i >= 0; i--) {
          const child = this.mesh.children[i];
          if (child !== this.hornDisplayGroup) {
            this.mesh.remove(child);
          }
        }
        this.wheels = [];
        this.steerWheels = [];
        this.mesh.add(glbScene);

        glbScene.traverse((node: any) => {
          if (node.isMesh && node.name.toLowerCase().includes('wheel')) {
            this.wheels.push(node);
            if (node.name.toLowerCase().includes('front') || node.name.toLowerCase().includes('_f')) {
              this.steerWheels.push(node);
            }
          }
        });
      }
    });
  }

  private createHornSprite(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Bubble background
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 108, 20);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PEEP-PEEP!', 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    this.hornTextMesh = new THREE.Sprite(spriteMat);
    this.hornTextMesh.scale.set(2.4, 1.2, 1);
    this.hornDisplayGroup.add(this.hornTextMesh);
  }

  /**
   * Helper: Builds a realistic automotive wheel assembly
   * Features: Rubber tire with rounded bevel, circumferential tread ridges,
   * 5-spoke silver alloy rim, central hubcap, chrome lug nuts, and brake disc rotor/caliper.
   */
  private createRealisticWheel(radius: number, width: number, rimRadius: number): { holder: THREE.Group; tire: THREE.Mesh } {
    const holder = new THREE.Group();

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.88,
      metalness: 0.05,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.85,
      roughness: 0.25,
    });
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.35,
    });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Red sports caliper
      roughness: 0.4,
    });

    // Main rubber tire body
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    holder.add(tire);

    // Tread rings (raised concentric ridges)
    for (const t of [-width * 0.25, width * 0.25]) {
      const tread = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.96, 0.015, 6, 18),
        tireMat
      );
      tread.position.set(t, 0, 0);
      tread.rotation.y = Math.PI / 2;
      holder.add(tread);
    }

    // Outer recessed alloy rim
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width * 1.02, 16);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    holder.add(rim);

    // 5-Spoke Sculpted Face
    for (let s = 0; s < 5; s++) {
      const angle = (s * Math.PI * 2) / 5;
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, rimRadius * 0.85, width * 1.03),
        rimMat
      );
      spoke.position.set(0, Math.cos(angle) * (rimRadius * 0.45), Math.sin(angle) * (rimRadius * 0.45));
      spoke.rotation.x = angle;
      holder.add(spoke);
    }

    // Central chrome hubcap
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.3, rimRadius * 0.3, width * 1.05, 12),
      rimMat
    );
    hub.rotation.z = Math.PI / 2;
    holder.add(hub);

    // Brake disc rotor & caliper behind rim
    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.72, rimRadius * 0.72, 0.02, 14),
      brakeMat
    );
    brakeDisc.rotation.z = Math.PI / 2;
    brakeDisc.position.set(-width * 0.15, 0, 0);
    holder.add(brakeDisc);

    const caliper = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, rimRadius * 0.35, rimRadius * 0.25),
      caliperMat
    );
    caliper.position.set(-width * 0.15, rimRadius * 0.35, 0);
    holder.add(caliper);

    return { holder, tire };
  }

  // === 1. BUILD SCULPTED DANFO MINIBUS ===
  private buildDanfo(): void {
    const signLib = SignageLibrary.getInstance();
    const matLib = MaterialLibrary.getInstance();

    const yellowPaint = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15, // Lagos Signature Danfo Yellow
      roughness: 0.25,
      metalness: 0.45,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.08,
      metalness: 0.92,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.8,
    });

    // 1. Lower Body Skirt & Wheelhouse Chassis
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.15, 5.3), yellowPaint);
    lowerBody.position.y = 1.02;
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    this.mesh.add(lowerBody);

    // 2. Upper Window Cabin Band
    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.95, 5.1), yellowPaint);
    upperCabin.position.set(0, 1.95, -0.05);
    upperCabin.castShadow = true;
    this.mesh.add(upperCabin);

    // 3. Aerodynamic Curved Roof Crown
    const roofGeo = new THREE.CylinderGeometry(1.14, 1.14, 5.15, 16);
    roofGeo.scale(1, 0.22, 1);
    const roof = new THREE.Mesh(roofGeo, yellowPaint);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 2.45, -0.05);
    this.mesh.add(roof);

    // 4. Characteristic Lagos Twin Black Waist Stripes on left and right flanks
    const decalGeo = new THREE.PlaneGeometry(5.28, 0.42);
    const decalR = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalR.position.set(1.18, 1.25, 0);
    decalR.rotation.y = Math.PI / 2;
    this.mesh.add(decalR);

    const decalL = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalL.position.set(-1.18, 1.25, 0);
    decalL.rotation.y = -Math.PI / 2;
    this.mesh.add(decalL);

    // 5. Raked Front Windshield with Sun Visor Banner
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.82), glassMat);
    windshield.position.set(0, 1.95, 2.56);
    windshield.rotation.x = -0.15; // Realistic raked windshield
    this.mesh.add(windshield);

    const visor = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 0.20), signLib.danfoVisorMaterial);
    visor.position.set(0, 2.25, 2.53);
    visor.rotation.x = -0.15;
    this.mesh.add(visor);

    // 6. Side Passenger Windows & Black Pillars (A, B, C, D)
    for (const sx of [-1.182, 1.182]) {
      const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.68), glassMat);
      sideGlass.position.set(sx, 1.98, -0.25);
      sideGlass.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.mesh.add(sideGlass);

      // Window pillar frames
      for (const pz of [-1.8, -0.7, 0.4, 1.6]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.70, 0.08), trimMat);
        pillar.position.set(sx, 1.98, pz);
        this.mesh.add(pillar);
      }
    }

    // 7. Front Fascia: Radiator Grille & Headlight Clusters
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.08), trimMat);
    grille.position.set(0, 0.95, 2.66);
    this.mesh.add(grille);

    // Chrome horizontal grille slats
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    for (const gy of [-0.08, 0, 0.08]) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.02), chromeMat);
      slat.position.set(0, 0.95 + gy, 2.71);
      this.mesh.add(slat);
    }

    // Twin Circular Headlights with chrome bezels and glass lenses
    for (const hx of [-0.95, 0.95]) {
      const lightHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.08, 16),
        chromeMat
      );
      lightHousing.rotation.x = Math.PI / 2;
      lightHousing.position.set(hx, 0.95, 2.66);
      this.mesh.add(lightHousing);

      const lightLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xffedd5, emissiveIntensity: 1.2, roughness: 0.1 })
      );
      lightLens.rotation.x = Math.PI / 2;
      lightLens.position.set(hx, 0.95, 2.70);
      this.mesh.add(lightLens);

      // Amber turn indicator
      const amberTurn = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.10, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.8 })
      );
      amberTurn.position.set(hx > 0 ? hx + 0.16 : hx - 0.16, 0.95, 2.66);
      this.mesh.add(amberTurn);
    }

    // 8. Heavy-Duty Wraparound Bumpers
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.28, 0.25), trimMat);
    frontBumper.position.set(0, 0.58, 2.75);
    frontBumper.castShadow = true;
    this.mesh.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.28, 0.25), trimMat);
    rearBumper.position.set(0, 0.58, -2.75);
    rearBumper.castShadow = true;
    this.mesh.add(rearBumper);

    // Front & Rear License Plates
    const plateGeo = new THREE.BoxGeometry(0.52, 0.16, 0.02);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const fPlate = new THREE.Mesh(plateGeo, plateMat);
    fPlate.position.set(0, 0.58, 2.88);
    this.mesh.add(fPlate);

    const rPlate = new THREE.Mesh(plateGeo, plateMat);
    rPlate.position.set(0, 0.95, -2.67);
    rPlate.rotation.y = Math.PI;
    this.mesh.add(rPlate);

    // Rear Slogan & Taillights
    const rearSlogan = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), signLib.danfoRearSloganMaterial);
    rearSlogan.position.set(0, 1.35, -2.66);
    rearSlogan.rotation.y = Math.PI;
    this.mesh.add(rearSlogan);

    for (const hx of [-0.95, 0.95]) {
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.42, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.85 })
      );
      tail.position.set(hx, 1.25, -2.66);
      this.mesh.add(tail);
    }

    // 9. Side Wing Mirrors with Glass Inserts
    for (const mx of [-1.30, 1.30]) {
      const mirrorGroup = new THREE.Group();
      mirrorGroup.position.set(mx, 1.70, 2.25);

      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), trimMat);
      stalk.rotation.z = mx > 0 ? Math.PI / 3 : -Math.PI / 3;
      mirrorGroup.add(stalk);

      const mirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.16), trimMat);
      mirrorHousing.position.set(mx > 0 ? 0.06 : -0.06, 0, 0);
      mirrorGroup.add(mirrorHousing);

      const mirrorGlass = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.05 })
      );
      mirrorGlass.position.set(mx > 0 ? 0.09 : -0.09, 0, 0);
      mirrorGlass.rotation.y = mx > 0 ? Math.PI / 2 : -Math.PI / 2;
      mirrorGroup.add(mirrorGlass);

      this.mesh.add(mirrorGroup);
    }

    // 10. Welded Tubular Roof Luggage Rack with Authentic Goods
    const rackGroup = new THREE.Group();
    rackGroup.position.set(0, 2.62, -0.3);

    const rackFrame = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 3.8), matLib.ironRailingMaterial);
    rackGroup.add(rackFrame);

    // Tied Cargo (Burlap grain sacks, plastic crates, carton)
    const sack1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 1.1), new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85 }));
    sack1.position.set(-0.45, 0.28, -0.6);
    rackGroup.add(sack1);

    const sack2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.40, 0.9), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 }));
    sack2.position.set(0.45, 0.26, -0.5);
    rackGroup.add(sack2);

    const sack3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.38, 0.8), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }));
    sack3.position.set(0, 0.25, 0.8);
    rackGroup.add(sack3);

    this.mesh.add(rackGroup);

    // 11. Realistic Wheel Assemblies (4 Wheels)
    const wheelOffsets = [
      { x: -1.18, z: 1.7, isFront: true },
      { x: 1.18, z: 1.7, isFront: true },
      { x: -1.18, z: -1.7, isFront: false },
      { x: 1.18, z: -1.7, isFront: false },
    ];

    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.44, 0.28, 0.24);
      holder.position.set(off.x, 0.44, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) {
        this.steerWheels.push(holder as any);
      }
    }
  }

  // === 2. BUILD SCULPTED KEKE NAPEP TRICYCLE ===
  private buildKeke(): void {
    const matLib = MaterialLibrary.getInstance();

    const yellowPaint = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.15,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.92,
    });
    const cushionMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.75,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.9,
      roughness: 0.2,
    });

    // 1. Lower Chassis Tray & Mudguards
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.55, 2.4), yellowPaint);
    chassis.position.y = 0.58;
    chassis.castShadow = true;
    this.mesh.add(chassis);

    // 2. Aerodynamic Front Fairing / Nose Cowl
    const noseCowl = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.95, 16), yellowPaint);
    noseCowl.rotation.x = Math.PI;
    noseCowl.scale.set(1, 1, 0.65);
    noseCowl.position.set(0, 0.95, 1.1);
    this.mesh.add(noseCowl);

    // Front Windshield with black rubber border
    const windshield = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.08, metalness: 0.9 })
    );
    windshield.position.set(0, 1.48, 1.05);
    windshield.rotation.x = -0.15;
    this.mesh.add(windshield);

    // 3. Curved Canvas Canopy Roof
    const roofGeo = new THREE.CylinderGeometry(0.76, 0.76, 2.15, 16);
    roofGeo.scale(1, 0.28, 1);
    const roof = new THREE.Mesh(roofGeo, canopyMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 1.95, -0.1);
    this.mesh.add(roof);

    // Canopy rear backdrop drape
    const rearCanvas = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.85, 0.04), canopyMat);
    rearCanvas.position.set(0, 1.45, -1.15);
    this.mesh.add(rearCanvas);

    // 4. Tubular Roll Cage Pillars (Iron Railing)
    for (const px of [-0.70, 0.70]) {
      for (const pz of [-1.05, 0.05, 0.95]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.92, 8), matLib.ironRailingMaterial);
        pillar.position.set(px, 1.42, pz);
        this.mesh.add(pillar);
      }
    }

    // 5. Driver Bucket Seat & Rear Passenger Bench
    const driverSeat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.45), cushionMat);
    driverSeat.position.set(0, 0.82, 0.35);
    this.mesh.add(driverSeat);

    const passengerBench = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.35, 0.55), cushionMat);
    passengerBench.position.set(0, 0.82, -0.65);
    this.mesh.add(passengerBench);

    const passengerBackrest = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.45, 0.10), cushionMat);
    passengerBackrest.position.set(0, 1.15, -0.98);
    this.mesh.add(passengerBackrest);

    // 6. Handlebars & Dashboard Pod
    const handlebarGroup = new THREE.Group();
    handlebarGroup.position.set(0, 1.05, 0.65);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 8), chromeMat);
    bar.rotation.z = Math.PI / 2;
    handlebarGroup.add(bar);

    // Grips
    for (const gx of [-0.30, 0.30]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 8), canopyMat);
      grip.rotation.z = Math.PI / 2;
      grip.position.set(gx, 0, 0);
      handlebarGroup.add(grip);
    }
    this.mesh.add(handlebarGroup);

    // 7. Prominent Cyclops Headlight with Chrome Bezel
    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.10, 16),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfffaed, emissiveIntensity: 1.4, roughness: 0.15 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.86, 1.25);
    this.mesh.add(headlight);

    // 8. License Plate & Exhaust Tailpipe
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.02), yellowPaint);
    plate.position.set(0, 0.65, -1.22);
    this.mesh.add(plate);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.48, 0.22, -1.1);
    this.mesh.add(exhaust);

    // 9. Tricycle Wheels (1 Front Steerable, 2 Rear)
    // Front Wheel Assembly
    const frontSteerGroup = new THREE.Group();
    frontSteerGroup.position.set(0, 0.32, 1.15);

    // Front chrome suspension fork
    const forkL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 8), chromeMat);
    forkL.position.set(-0.14, 0.20, 0);
    frontSteerGroup.add(forkL);
    const forkR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 8), chromeMat);
    forkR.position.set(0.14, 0.20, 0);
    frontSteerGroup.add(forkR);

    const { holder: fHolder, tire: fTire } = this.createRealisticWheel(0.32, 0.18, 0.18);
    frontSteerGroup.add(fHolder);
    this.mesh.add(frontSteerGroup);
    this.wheels.push(fTire);
    this.steerWheels.push(frontSteerGroup as any);

    // Rear Wheel Assemblies
    for (const rx of [-0.74, 0.74]) {
      const { holder: rHolder, tire: rTire } = this.createRealisticWheel(0.32, 0.18, 0.18);
      rHolder.position.set(rx, 0.32, -0.85);
      this.mesh.add(rHolder);
      this.wheels.push(rTire);
    }
  }

  // === 3. BUILD EXECUTIVE BLACK LUXURY SUV (V8 BIG BOY SPEC) ===
  private buildLuxurySUV(): void {
    const blackPaint = new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0a, // Deep Ebony Black Clearcoat
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 0.95,
      clearcoatRoughness: 0.1,
    });
    const tintGlass = new THREE.MeshStandardMaterial({
      color: 0x020617, // Limousine Black Privacy Glass
      roughness: 0.05,
      metalness: 0.98,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.95,
      roughness: 0.15,
    });

    // 1. Lower Muscular Chassis with Flared Arches
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.95, 5.1), blackPaint);
    chassis.position.y = 0.98;
    chassis.castShadow = true;
    this.mesh.add(chassis);

    // 2. Sculpted Hood with Dual Power Bulges
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.35, 1.8), blackPaint);
    hood.position.set(0, 1.35, 1.6);
    this.mesh.add(hood);

    for (const bx of [-0.55, 0.55]) {
      const powerBulge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 1.6), blackPaint);
      powerBulge.position.set(bx, 1.54, 1.6);
      this.mesh.add(powerBulge);
    }

    // 3. VIP Privacy Cabin with Sloped Pillars
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.92, 3.1), blackPaint);
    cabin.position.set(0, 1.95, -0.35);
    this.mesh.add(cabin);

    // Windshield (Raked Back)
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.82), tintGlass);
    windshield.rotation.x = -0.32;
    windshield.position.set(0, 1.95, 1.15);
    this.mesh.add(windshield);

    // Privacy Side Glass
    for (const sx of [-1.10, 1.10]) {
      const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.95, 0.65), tintGlass);
      sideGlass.position.set(sx, 1.95, -0.35);
      sideGlass.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.mesh.add(sideGlass);
    }

    // Rear Backlight Window
    const rearWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 0.65), tintGlass);
    rearWindow.rotation.y = Math.PI;
    rearWindow.position.set(0, 1.95, -1.91);
    this.mesh.add(rearWindow);

    // 4. Chrome Radiator Grille (Multi-Slat Prado Spec)
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.55, 0.12), chromeMat);
    grille.position.set(0, 1.05, 2.56);
    this.mesh.add(grille);

    for (let s = -2; s <= 2; s++) {
      const verticalSlat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.04), chromeMat);
      verticalSlat.position.set(s * 0.32, 1.05, 2.62);
      this.mesh.add(verticalSlat);
    }

    // 5. LED Matrix Projector Headlights
    for (const hx of [-0.95, 0.95]) {
      const light = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.18, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x22d3ee, emissiveIntensity: 1.5, roughness: 0.1 })
      );
      light.position.set(hx, 1.18, 2.56);
      this.mesh.add(light);
    }

    // 6. Tubular Side-Step Running Boards
    for (const rx of [-1.22, 1.22]) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 2.6), chromeMat);
      step.position.set(rx, 0.45, -0.2);
      this.mesh.add(step);
    }

    // 7. Roof Rails & Dual Chrome Exhaust Tips
    for (const rx of [-0.95, 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 2.8), chromeMat);
      rail.position.set(rx, 2.45, -0.35);
      this.mesh.add(rail);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.25, 12), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(rx * 0.75, 0.42, -2.58);
      this.mesh.add(exhaust);
    }

    // 8. Rear Tailgate Mounted Spare Wheel Cover
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.32, 20), blackPaint);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.15, -2.62);
    this.mesh.add(spare);

    const spareChromeRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 24), chromeMat);
    spareChromeRing.position.set(0, 1.15, -2.62);
    this.mesh.add(spareChromeRing);

    // 9. Realistic Wheel Assemblies (Large SUV Alloy Wheels)
    const wheelOffsets = [
      { x: -1.18, z: 1.6, isFront: true },
      { x: 1.18, z: 1.6, isFront: true },
      { x: -1.18, z: -1.6, isFront: false },
      { x: 1.18, z: -1.6, isFront: false },
    ];

    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.48, 0.32, 0.28);
      holder.position.set(off.x, 0.48, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) {
        this.steerWheels.push(holder as any);
      }
    }
  }

  // === 4. BUILD SCULPTED OKADA MOTORCYCLE ===
  private buildOkada(): void {
    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25 });
    const tankMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626, // Crimson Red Tank
      metalness: 0.65,
      roughness: 0.2,
      clearcoat: 0.9,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.8, roughness: 0.4 });

    // 1. Tubular Steel Cradle Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 1.6), frameMat);
    frame.position.y = 0.62;
    this.mesh.add(frame);

    // 2. Sculpted Teardrop Fuel Tank
    const tankGeo = new THREE.SphereGeometry(0.24, 12, 10);
    tankGeo.scale(0.85, 0.95, 1.6);
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(0, 0.86, 0.18);
    this.mesh.add(tank);

    // Chrome Gas Cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), chromeMat);
    cap.position.set(0, 1.05, 0.18);
    this.mesh.add(cap);

    // 3. Engine Block with Cooling Fins
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.42), engineMat);
    engine.position.set(0, 0.52, 0.12);
    this.mesh.add(engine);

    // Chrome Exhaust Header & Long Cylindrical Silencer Muffler
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.95, 12), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.14, 0.36, -0.42);
    this.mesh.add(exhaust);

    // 4. Ergonomic Vinyl Saddle Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.68),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.85 })
    );
    seat.position.set(0, 0.82, -0.32);
    this.mesh.add(seat);

    // 5. Courier Delivery Cargo Box (QuickChop Emerald)
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.46, 0.46),
      new THREE.MeshPhysicalMaterial({ color: 0x059669, roughness: 0.4, clearcoat: 0.6 })
    );
    box.position.set(0, 1.05, -0.76);
    this.mesh.add(box);

    // 6. Front Telescopic Fork & Steering Assembly
    const forkGroup = new THREE.Group();
    forkGroup.position.set(0, 0.35, 0.85);
    this.mesh.add(forkGroup);
    this.steerWheels.push(forkGroup as any);

    for (const fx of [-0.08, 0.08]) {
      const forkTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.68, 8), chromeMat);
      forkTube.position.set(fx, 0.35, 0);
      forkGroup.add(forkTube);
    }

    const handlebar = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.04, 0.04), chromeMat);
    handlebar.position.set(0, 0.72, 0);
    forkGroup.add(handlebar);

    const headlight = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.09, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 1.5 })
    );
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.54, 0.09);
    forkGroup.add(headlight);

    // 7. Wire-Spoked Motorcycle Wheels
    const { holder: fHolder, tire: fTire } = this.createRealisticWheel(0.36, 0.12, 0.26);
    forkGroup.add(fHolder);
    this.wheels.push(fTire);

    const { holder: rHolder, tire: rTire } = this.createRealisticWheel(0.36, 0.12, 0.26);
    rHolder.position.set(0, 0.35, -0.72);
    this.mesh.add(rHolder);
    this.wheels.push(rTire);
  }

  // === DRIVING & CONTROLS ===

  public enter(player: Player): void {
    this.driver = player;
    player.mesh.visible = false;
    player.mesh.position.copy(this.mesh.position);
    this.currentSpeed = 0;
  }

  public exit(): THREE.Vector3 {
    this.driver = null;
    this.currentSpeed = 0;

    // Calculate exit location to left of driver door
    const exitOffset = new THREE.Vector3(-2.2, 0, 0);
    exitOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
    const exitPos = new THREE.Vector3().copy(this.mesh.position).add(exitOffset);
    exitPos.y = 0;
    return exitPos;
  }

  public honk(): string {
    this.hornTimer = 1.2;
    this.hornDisplayGroup.visible = true;
    SoundEngine.getInstance().playVehicleHorn(this.type);
    return this.config.hornText;
  }

  public update(delta: number, keys: Record<string, boolean>): void {
    // Update horn display timer
    if (this.hornTimer > 0) {
      this.hornTimer -= delta;
      if (this.hornTimer <= 0) {
        this.hornDisplayGroup.visible = false;
      }
    }

    if (!this.driver) {
      // Natural rolling friction when unoccupied
      if (Math.abs(this.currentSpeed) > 0.1) {
        this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * this.config.friction);
        this.moveForward(delta);
      } else {
        this.currentSpeed = 0;
      }
      return;
    }

    // Driver controls
    let gas = keys['KeyW'] || keys['ArrowUp'];
    const brake = keys['KeyS'] || keys['ArrowDown'];
    const left = keys['KeyA'] || keys['ArrowLeft'];
    const right = keys['KeyD'] || keys['ArrowRight'];

    // Fuel Consumption & Empty Check
    if (Math.abs(this.currentSpeed) > 0.5) {
      this.fuel = Math.max(0, this.fuel - delta * 0.05);
      if (this.fuel < 15 && !this.isLowFuelWarned) {
        this.isLowFuelWarned = true;
        SoundEngine.getInstance().playClickSound();
        showGameToast('⛽ Low Fuel Alert! Pull over and press [R] to refuel.', 'warning');
      }
    }
    if (this.fuel <= 0) {
      gas = false;
      this.currentSpeed = Math.max(0, this.currentSpeed - delta * 4);
    }

    // Commercial Passenger Boarding & Fare Collection (Danfo & Keke)
    if (this.isCommercialTransit) {
      if (Math.abs(this.currentSpeed) < 0.6) {
        this.pickupTimer += delta;
        if (this.pickupTimer >= 2.2 && this.passengers < this.maxPassengers) {
          this.pickupTimer = 0;
          this.passengers += 1;
          this.totalFaresCollected += this.fareRate;
          SoundEngine.getInstance().playTransactionSuccess();
          BackendService.getInstance().addCash(this.fareRate, `Transit Fare: ${this.name}`);
          showGameToast(`👥 Passenger boarded! +₦${this.fareRate.toLocaleString()} fare collected (${this.passengers}/${this.maxPassengers} seats filled)`, 'success');
        }
      } else {
        // While driving along route, occasional passenger disembarking with tip
        if (this.passengers > 0 && Math.random() < delta * 0.015) {
          this.passengers -= 1;
          const tip = 100;
          BackendService.getInstance().addCash(tip, 'Passenger Drop-Off Tip');
          showGameToast(`🚏 Passenger dropped off at bus stop! +₦${tip} tip`, 'info');
        }
      }
    }

    // Acceleration & Braking
    if (gas) {
      this.currentSpeed = Math.min(
        this.config.maxSpeed,
        this.currentSpeed + this.config.acceleration * delta
      );
    } else if (brake) {
      if (this.currentSpeed > 0.5) {
        this.currentSpeed = Math.max(0, this.currentSpeed - this.config.braking * delta);
      } else {
        this.currentSpeed = Math.max(
          -this.config.reverseSpeed,
          this.currentSpeed - this.config.acceleration * 0.7 * delta
        );
      }
    } else {
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * this.config.friction);
    }

    // Steering
    const targetTurn = left ? 1 : right ? -1 : 0;
    this.turnAngle = THREE.MathUtils.lerp(this.turnAngle, targetTurn, delta * 8);

    if (Math.abs(this.currentSpeed) > 0.2) {
      const dirSign = this.currentSpeed >= 0 ? 1 : -1;
      this.mesh.rotation.y += this.turnAngle * this.config.turnSpeed * delta * dirSign;
    }

    // Steer visual front wheels
    for (const w of this.steerWheels) {
      w.rotation.y = this.turnAngle * 0.45;
    }

    // Roll wheels according to ground velocity
    const rollDelta = (this.currentSpeed * delta) / 0.44;
    for (const w of this.wheels) {
      w.rotation.x += rollDelta;
    }

    this.moveForward(delta);

    // Keep driver attached to vehicle
    if (this.driver) {
      this.driver.mesh.position.copy(this.mesh.position);
      this.driver.mesh.rotation.y = this.mesh.rotation.y;
    }
  }

  public refuel(): boolean {
    const cost = Math.max(500, Math.round((100 - this.fuel) * 35));
    if (this.fuel >= 98) {
      showGameToast('⛽ Fuel tank is already full!', 'info');
      return false;
    }
    const backend = BackendService.getInstance();
    if (backend.spendCash(cost, 'Fuel Refill')) {
      this.fuel = 100;
      this.isLowFuelWarned = false;
      SoundEngine.getInstance().playTransactionSuccess();
      showGameToast(`⛽ Fuel tank replenished to 100%! (-₦${cost.toLocaleString()})`, 'success');
      return true;
    } else {
      showGameToast(`⚠️ Insufficient cash to refuel! Need ₦${cost.toLocaleString()}.`, 'error');
      return false;
    }
  }

  private moveForward(delta: number): void {
    const moveDist = this.currentSpeed * delta;
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.mesh.rotation.y
    );
    const nextPos = this.mesh.position.clone().addScaledVector(forward, moveDist);

    // Collision check against city buildings and walls
    const solidsFn = DrivableVehicle.solids;
    if (solidsFn) {
      const solids = solidsFn();
      if (solids && solids.at(nextPos.x, nextPos.z, 1.2)) {
        this.currentSpeed = 0;
        return;
      }
    }

    this.mesh.position.copy(nextPos);
  }
}
