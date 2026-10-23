import * as THREE from 'three';
import type { Player } from '../player/Player';
import type { Solids } from './plan/Solids';
import { SignageLibrary } from '../materials/SignageLibrary';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { AssetManager } from '../assets/AssetManager';
import { SoundEngine } from '../audio/SoundEngine';
import { showGameToast } from '../ui/GameToast';
import { BackendService } from '../backend/BackendService';
import { LagosStreetLifeSystem } from './LagosStreetLifeSystem';

export type VehicleType =
  | 'danfo'
  | 'keke'
  | 'suv'
  | 'okada'
  | 'sedan'
  | 'luxury_sedan'
  | 'gwagon'
  | 'sports_car'
  | 'electric_car'
  | 'ambulance';

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

  // Vehicle Handling, Steering Physics & Lane Centering
  public static steeringSensitivity: number = 1.0;
  public static laneAssistStrength: number = 0.85;
  public static cameraSmoothing: number = 1.0;

  public steerInput: number = 0;
  public isCenteringActive: boolean = false;
  private velocityDirection: THREE.Vector2 = new THREE.Vector2(0, 1);

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

    this.isCommercialTransit = this.type === 'danfo' || this.type === 'keke' || this.type === 'ambulance';
    this.maxPassengers =
      this.type === 'danfo' ? 8 :
      this.type === 'keke' ? 3 :
      this.type === 'suv' || this.type === 'gwagon' ? 5 :
      this.type === 'sedan' || this.type === 'luxury_sedan' || this.type === 'electric_car' ? 4 :
      this.type === 'ambulance' ? 2 : 1;
    this.fareRate =
      this.type === 'danfo' ? 350 :
      this.type === 'keke' ? 250 :
      this.type === 'ambulance' ? 1200 : 500;

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
    } else if (this.type === 'sedan') {
      this.buildSedan();
    } else if (this.type === 'luxury_sedan') {
      this.buildLuxurySedan();
    } else if (this.type === 'gwagon') {
      this.buildGwagon();
    } else if (this.type === 'sports_car') {
      this.buildSportsCar();
    } else if (this.type === 'electric_car') {
      this.buildElectricCar();
    } else if (this.type === 'ambulance') {
      this.buildAmbulance();
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
    const glbMap: Partial<Record<VehicleType, string>> = {
      danfo: '/models/vehicles/danfo_minibus.glb',
      keke: '/models/vehicles/keke_napep.glb',
      suv: '/models/vehicles/suv_luxury.glb',
      okada: '/models/vehicles/okada_bike.glb',
      sedan: '/models/vehicles/sedan_corolla.glb',
      luxury_sedan: '/models/vehicles/sedan_maybach.glb',
      gwagon: '/models/vehicles/suv_gwagon.glb',
      sports_car: '/models/vehicles/supercar_gt.glb',
      electric_car: '/models/vehicles/electric_sedan.glb',
      ambulance: '/models/vehicles/ambulance_van.glb',
    };
    const glbPath = glbMap[this.type];
    if (glbPath) {
      AssetManager.getInstance().instantiate(glbPath).then((glbScene) => {
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
    const rimAlloyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.90,
      roughness: 0.20,
    });
    const rimBarrelMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.85,
      roughness: 0.35,
    });
    const brakeRotorMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      metalness: 0.92,
      roughness: 0.30,
    });
    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Crimson Brembo-style brake caliper
      roughness: 0.35,
    });

    // 1. High-fidelity circular rubber tire (32 radial segments)
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 32);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    holder.add(tire);

    // Tread rings (circumferential rubber ridges)
    for (const t of [-width * 0.28, width * 0.28]) {
      const tread = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.97, 0.016, 8, 32),
        tireMat
      );
      tread.position.set(t, 0, 0);
      tread.rotation.y = Math.PI / 2;
      holder.add(tread);
    }

    // 2. Recessed dark alloy rim barrel (cavity behind spokes)
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.95, rimRadius * 0.95, width * 0.96, 32),
      rimBarrelMat
    );
    barrel.rotation.z = Math.PI / 2;
    holder.add(barrel);

    // 3. Ventilated Steel Brake Rotor & Caliper (inside barrel)
    const brakeRotor = new THREE.Mesh(
      new THREE.CylinderGeometry(rimRadius * 0.72, rimRadius * 0.72, 0.024, 24),
      brakeRotorMat
    );
    brakeRotor.rotation.z = Math.PI / 2;
    holder.add(brakeRotor);

    const caliper = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, rimRadius * 0.36, rimRadius * 0.26),
      caliperMat
    );
    caliper.position.set(0, rimRadius * 0.36, 0);
    holder.add(caliper);

    // 4. Polished Outer Rim Lip, 5-Spoke Face & Hubcap (mirrored on both faces)
    for (const fx of [-width * 0.49, width * 0.49]) {
      // Chrome polished outer rim lip ring
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(rimRadius * 0.98, 0.018, 8, 32),
        rimAlloyMat
      );
      lip.position.set(fx, 0, 0);
      lip.rotation.y = Math.PI / 2;
      holder.add(lip);

      // 5 Sculpted Alloy Spokes radiating outwards to the lip
      for (let s = 0; s < 5; s++) {
        const angle = (s * Math.PI * 2) / 5;
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, rimRadius * 0.85, 0.036),
          rimAlloyMat
        );
        spoke.position.set(
          fx,
          Math.cos(angle) * (rimRadius * 0.46),
          Math.sin(angle) * (rimRadius * 0.46)
        );
        spoke.rotation.x = angle;
        holder.add(spoke);
      }

      // Central Chrome Hubcap
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(rimRadius * 0.28, rimRadius * 0.28, 0.024, 16),
        rimAlloyMat
      );
      hub.position.set(fx + (fx > 0 ? 0.01 : -0.01), 0, 0);
      hub.rotation.z = Math.PI / 2;
      holder.add(hub);

      // 5 Chrome Lug Nuts
      for (let n = 0; n < 5; n++) {
        const nutAngle = (n * Math.PI * 2) / 5 + Math.PI / 5;
        const lug = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.018, 6),
          rimAlloyMat
        );
        lug.position.set(
          fx + (fx > 0 ? 0.015 : -0.015),
          Math.cos(nutAngle) * (rimRadius * 0.16),
          Math.sin(nutAngle) * (rimRadius * 0.16)
        );
        lug.rotation.z = Math.PI / 2;
        holder.add(lug);
      }
    }

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

    // 3. Sleek Sculpted Van Roof Panel with Authentic Longitudinal Ribs
    const roofPanel = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.12, 5.12), yellowPaint);
    roofPanel.position.set(0, 2.44, -0.05);
    roofPanel.castShadow = true;
    this.mesh.add(roofPanel);

    // Longitudinal strengthening ribs (authentic Toyota HiAce / Danfo roof structure)
    for (const rx of [-0.65, -0.22, 0.22, 0.65]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 4.8), yellowPaint);
      rib.position.set(rx, 2.51, -0.05);
      this.mesh.add(rib);
    }

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

      // Curved flared wheel arch / fender flare hugging tire opening
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.045, 8, 24, Math.PI),
        yellowPaint
      );
      arch.position.set(off.x > 0 ? 1.185 : -1.185, 0.44, off.z);
      arch.rotation.y = off.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.mesh.add(arch);
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

    // 2. Aerodynamic Curved Front Fairing & Mudguard Apron
    const cowlGeo = new THREE.CylinderGeometry(0.70, 0.58, 0.90, 20, 1, false, 0, Math.PI);
    cowlGeo.scale(1.05, 1, 0.65);
    const noseCowl = new THREE.Mesh(cowlGeo, yellowPaint);
    noseCowl.position.set(0, 0.92, 0.92);
    this.mesh.add(noseCowl);

    // Front mudguard arch over front wheel
    const frontFender = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16, 1, false, 0, Math.PI),
      yellowPaint
    );
    frontFender.rotation.z = Math.PI / 2;
    frontFender.position.set(0, 0.42, 1.15);
    this.mesh.add(frontFender);

    // Front Windshield with black rubber border
    const windshield = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.08, metalness: 0.9 })
    );
    windshield.position.set(0, 1.48, 1.05);
    windshield.rotation.x = -0.15;
    this.mesh.add(windshield);

    // 3. Iconic Canvas Canopy Roof (Clean rectangular canopy slab with side valance flaps)
    const canopyTop = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.08, 2.2), canopyMat);
    canopyTop.position.set(0, 1.95, -0.05);
    canopyTop.castShadow = true;
    this.mesh.add(canopyTop);

    // Weatherproof vinyl side valances
    for (const sx of [-0.74, 0.74]) {
      const valance = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 2.18), canopyMat);
      valance.position.set(sx, 1.85, -0.05);
      this.mesh.add(valance);
    }
    // Front sun visor flap
    const frontFlap = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.14, 0.04), canopyMat);
    frontFlap.position.set(0, 1.86, 1.04);
    this.mesh.add(frontFlap);

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

    // 2. Sculpted Aerodynamic Hood with Dual Power Bulges
    const hoodGeo = new THREE.BoxGeometry(2.26, 0.32, 1.85);
    const hood = new THREE.Mesh(hoodGeo, blackPaint);
    hood.position.set(0, 1.34, 1.62);
    hood.rotation.x = 0.035; // Aerodynamic forward rake
    this.mesh.add(hood);

    for (const bx of [-0.55, 0.55]) {
      const powerBulge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 1.6), blackPaint);
      powerBulge.position.set(bx, 1.52, 1.6);
      powerBulge.rotation.x = 0.035;
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

    // 4. Chrome Radiator Grille (Multi-Slat Prado Spec with dark honeycomb backdrop)
    const grilleBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(1.70, 0.56),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 })
    );
    grilleBackdrop.position.set(0, 1.08, 2.58);
    this.mesh.add(grilleBackdrop);

    const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.58, 0.08), chromeMat);
    grilleFrame.position.set(0, 1.08, 2.59);
    this.mesh.add(grilleFrame);

    for (let s = -2; s <= 2; s++) {
      const verticalSlat = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.52, 0.05), chromeMat);
      verticalSlat.position.set(s * 0.32, 1.08, 2.64);
      this.mesh.add(verticalSlat);
    }

    // Central VIP Emblem
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16), chromeMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 1.12, 2.66);
    this.mesh.add(emblem);

    // 5. LED Matrix Projector Headlights with Dynamic DRL Eyebrow
    const ledGlowMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    const headlightHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });

    for (const hx of [-0.98, 0.98]) {
      // Angular headlight housing
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.22, 0.10), headlightHousingMat);
      housing.position.set(hx, 1.18, 2.58);
      this.mesh.add(housing);

      // Dual Projector Lenses
      for (const lx of [-0.08, 0.08]) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), ledGlowMat);
        lens.scale.set(1, 1, 0.6);
        lens.position.set(hx + lx, 1.17, 2.64);
        this.mesh.add(lens);
      }

      // LED DRL Eyebrow strip
      const drl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.024, 0.04), ledGlowMat);
      drl.position.set(hx, 1.27, 2.63);
      this.mesh.add(drl);
    }

    // 6. Sculpted Lower Front Bumper, Skid Plate & LED Fog Lights
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.36, 0.35), blackPaint);
    frontBumper.position.set(0, 0.62, 2.66);
    this.mesh.add(frontBumper);

    // Brushed Aluminum Skid Plate
    const skidPlate = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 0.08, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.3 })
    );
    skidPlate.position.set(0, 0.48, 2.76);
    this.mesh.add(skidPlate);

    // Round Fog Lamps in lower bumper vents
    for (const fx of [-0.92, 0.92]) {
      const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), ledGlowMat);
      fog.rotation.x = Math.PI / 2;
      fog.position.set(fx, 0.62, 2.82);
      this.mesh.add(fog);
    }

    // 7. Tubular Side-Step Running Boards
    for (const rx of [-1.22, 1.22]) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 2.6), chromeMat);
      step.position.set(rx, 0.45, -0.2);
      this.mesh.add(step);
    }

    // 8. Roof Rails & Dual Chrome Exhaust Tips
    for (const rx of [-0.95, 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 2.8), chromeMat);
      rail.position.set(rx, 2.45, -0.35);
      this.mesh.add(rail);

      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.25, 12), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(rx * 0.75, 0.42, -2.58);
      this.mesh.add(exhaust);
    }

    // 9. Rear Tailgate Mounted Spare Wheel Cover
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.32, 20), blackPaint);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.15, -2.62);
    this.mesh.add(spare);

    const spareChromeRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.035, 8, 24), chromeMat);
    spareChromeRing.position.set(0, 1.15, -2.62);
    this.mesh.add(spareChromeRing);

    // 10. Realistic Wheel Assemblies (Large SUV Alloy Wheels) with Flared Fender Arches
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

      // Curved flared wheel arch / fender flare hugging tire opening
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.54, 0.055, 8, 24, Math.PI),
        blackPaint
      );
      arch.position.set(off.x > 0 ? 1.185 : -1.185, 0.50, off.z);
      arch.rotation.y = off.x > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.mesh.add(arch);
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

  // === 5. BUILD TOYOTA COROLLA TOKUNBO SEDAN ===
  private buildSedan(): void {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x64748b, // Classic Slate Silver Metallic
      metalness: 0.75,
      roughness: 0.25,
      clearcoat: 0.8,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      transmission: 0.7,
      opacity: 1,
      transparent: true,
      roughness: 0.1,
    });
    const blackTrim = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.15 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe2e8f0, emissiveIntensity: 1.4 });
    const redLightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 1.2 });

    // Lower Chassis & Floor
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.24, 4.4), blackTrim);
    chassis.position.y = 0.32;
    this.mesh.add(chassis);

    // Main Lower Body Shell (fenders, doors, lower beltline)
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.52, 4.38), bodyMat);
    lowerBody.position.y = 0.58;
    this.mesh.add(lowerBody);

    // Front Hood & Engine Bay
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 1.3), bodyMat);
    hood.position.set(0, 0.82, 1.35);
    hood.rotation.x = -0.06;
    this.mesh.add(hood);

    // Rear Trunk Decklid
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.18, 0.9), bodyMat);
    trunk.position.set(0, 0.84, -1.6);
    this.mesh.add(trunk);

    // Cabin Greenhouse Roof & Pillars
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.58, 2.1), bodyMat);
    cabin.position.set(0, 1.14, -0.15);
    this.mesh.add(cabin);

    // Windshield (slanted front)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.54, 0.08), glassMat);
    windshield.position.set(0, 1.12, 0.85);
    windshield.rotation.x = 0.52;
    this.mesh.add(windshield);

    // Rear Window (slanted rear)
    const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.52, 0.08), glassMat);
    rearWindow.position.set(0, 1.12, -1.15);
    rearWindow.rotation.x = -0.50;
    this.mesh.add(rearWindow);

    // Side Windows
    for (const sx of [-0.82, 0.82]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 1.85), glassMat);
      sideGlass.position.set(sx, 1.14, -0.15);
      this.mesh.add(sideGlass);

      // Side Mirrors
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.14), bodyMat);
      mirror.position.set(sx > 0 ? sx + 0.12 : sx - 0.12, 0.98, 0.72);
      this.mesh.add(mirror);
    }

    // Front Chrome Grille with Toyota emblem
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.12), chromeMat);
    grille.position.set(0, 0.62, 2.2);
    this.mesh.add(grille);

    // Headlights
    for (const hx of [-0.68, 0.68]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.15), ledMat);
      hl.position.set(hx, 0.64, 2.18);
      this.mesh.add(hl);
    }

    // Taillights
    for (const tx of [-0.68, 0.68]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.15), redLightMat);
      tl.position.set(tx, 0.68, -2.18);
      this.mesh.add(tl);
    }

    // Front & Rear Bumpers
    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.32, 0.26), bodyMat);
    fBumper.position.set(0, 0.42, 2.22);
    this.mesh.add(fBumper);

    const rBumper = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.32, 0.26), bodyMat);
    rBumper.position.set(0, 0.42, -2.22);
    this.mesh.add(rBumper);

    // 4 Wheels
    const wheelOffsets = [
      { x: -0.92, z: 1.35, isFront: true },
      { x: 0.92, z: 1.35, isFront: true },
      { x: -0.92, z: -1.35, isFront: false },
      { x: 0.92, z: -1.35, isFront: false },
    ];
    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.38, 0.22, 0.22);
      holder.position.set(off.x, 0.38, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) this.steerWheels.push(holder as any);
    }
  }

  // === 6. BUILD MERCEDES-MAYBACH LUXURY EXECUTIVE SEDAN ===
  private buildLuxurySedan(): void {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x09090b, // Obsidian Deep Black VIP
      metalness: 0.88,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      transmission: 0.6,
      opacity: 1,
      transparent: true,
      roughness: 0.05,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.98, roughness: 0.08 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xeff6ff, emissive: 0x93c5fd, emissiveIntensity: 1.8 });
    const redLightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.6 });

    // Long Wheelbase VIP Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.24, 5.1), new THREE.MeshStandardMaterial({ color: 0x18181b }));
    chassis.position.y = 0.34;
    this.mesh.add(chassis);

    // Main Sculpted Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.54, 5.05), bodyMat);
    body.position.y = 0.62;
    this.mesh.add(body);

    // Sweeping Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.18, 1.6), bodyMat);
    hood.position.set(0, 0.88, 1.6);
    hood.rotation.x = -0.05;
    this.mesh.add(hood);

    // Maybach Chrome Hood Ornament
    const ornament = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), chromeMat);
    ornament.position.set(0, 1.04, 2.38);
    this.mesh.add(ornament);

    // Rear Executive Decklid
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.18, 1.1), bodyMat);
    deck.position.set(0, 0.90, -1.85);
    this.mesh.add(deck);

    // Extended Executive Cabin with Panoramic Glass Roof
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.58, 2.45), bodyMat);
    cabin.position.set(0, 1.18, -0.1);
    this.mesh.add(cabin);

    const panoRoof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 2.0), glassMat);
    panoRoof.position.set(0, 1.48, -0.1);
    this.mesh.add(panoRoof);

    // Glass Windshields
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.56, 0.08), glassMat);
    windshield.position.set(0, 1.16, 1.08);
    windshield.rotation.x = 0.56;
    this.mesh.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.54, 0.08), glassMat);
    rearGlass.position.set(0, 1.16, -1.3);
    rearGlass.rotation.x = -0.54;
    this.mesh.add(rearGlass);

    // Chrome Window Frames & Side Glass
    for (const sx of [-0.90, 0.90]) {
      const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.46, 2.2), glassMat);
      sideGlass.position.set(sx, 1.18, -0.1);
      this.mesh.add(sideGlass);

      const chromeBelt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 4.8), chromeMat);
      chromeBelt.position.set(sx > 0 ? sx + 0.12 : sx - 0.12, 0.88, 0);
      this.mesh.add(chromeBelt);
    }

    // Vertical Waterfall Chrome Grille
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.38, 0.15), chromeMat);
    grille.position.set(0, 0.68, 2.52);
    this.mesh.add(grille);

    // Headlights (Sleek Digital Light LED Projectors)
    for (const hx of [-0.76, 0.76]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.18), ledMat);
      hl.position.set(hx, 0.72, 2.48);
      this.mesh.add(hl);
    }

    // Full-Width Rear OLED Taillight Strip
    const taillightBar = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.12, 0.15), redLightMat);
    taillightBar.position.set(0, 0.74, -2.52);
    this.mesh.add(taillightBar);

    // Quad Chrome Exhaust Finishers
    for (const ex of [-0.65, -0.45, 0.45, 0.65]) {
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 12), chromeMat);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(ex, 0.38, -2.52);
      this.mesh.add(exhaust);
    }

    // Multi-Spoke VIP Alloy Wheels
    const wheelOffsets = [
      { x: -1.02, z: 1.65, isFront: true },
      { x: 1.02, z: 1.65, isFront: true },
      { x: -1.02, z: -1.65, isFront: false },
      { x: 1.02, z: -1.65, isFront: false },
    ];
    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.42, 0.26, 0.25);
      holder.position.set(off.x, 0.42, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) this.steerWheels.push(holder as any);
    }
  }

  // === 7. BUILD MERCEDES-AMG G63 G-WAGON ===
  private buildGwagon(): void {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0x18181b, // Matte Graphite Black
      metalness: 0.6,
      roughness: 0.4,
      clearcoat: 0.3,
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.15 });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.0 });
    const redLightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.4 });

    // Rugged Boxy Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 4.6), blackMat);
    frame.position.y = 0.46;
    this.mesh.add(frame);

    // Lower Upright Body Block
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.5), bodyMat);
    lowerBody.position.y = 0.94;
    this.mesh.add(lowerBody);

    // Squared Upright Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.88, 2.7), bodyMat);
    cabin.position.set(0, 1.72, -0.2);
    this.mesh.add(cabin);

    // Upright Windshield
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.82, 0.72, 0.06),
      new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transmission: 0.6, transparent: true, roughness: 0.1 })
    );
    windshield.position.set(0, 1.68, 1.12);
    windshield.rotation.x = 0.18; // Nearly vertical classic G-Class windshield
    this.mesh.add(windshield);

    // Squared Side Windows & Tinted Glass
    for (const sx of [-1.0, 1.0]) {
      const sideGlass = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.65, 2.4),
        new THREE.MeshPhysicalMaterial({ color: 0x020617, transmission: 0.4, transparent: true, roughness: 0.1 })
      );
      sideGlass.position.set(sx, 1.72, -0.2);
      this.mesh.add(sideGlass);

      // Flared Boxy Wheel Arches
      for (const az of [-1.45, 1.45]) {
        const arch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.44, 0.95), blackMat);
        arch.position.set(sx > 0 ? sx + 0.08 : sx - 0.08, 0.72, az);
        this.mesh.add(arch);
      }

      // Tubular Side Steps / Running Boards
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 2.2), chromeMat);
      step.position.set(sx > 0 ? sx + 0.1 : sx - 0.1, 0.52, -0.1);
      this.mesh.add(step);

      // Dual Side-Exit Chrome Exhaust Tips under running boards (Signature G63 AMG feature)
      for (const exz of [-0.35, -0.15]) {
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 12), chromeMat);
        tip.rotation.z = Math.PI / 2;
        tip.position.set(sx > 0 ? sx + 0.14 : sx - 0.14, 0.46, exz);
        this.mesh.add(tip);
      }
    }

    // Panamericana Grille with AMG Logo
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.45, 0.14), blackMat);
    grille.position.set(0, 0.98, 2.28);
    this.mesh.add(grille);

    // Prominent Chrome Bull Bar / Push Bumper
    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.55, 0.12), chromeMat);
    bullBar.position.set(0, 0.92, 2.42);
    this.mesh.add(bullBar);

    // Twin Round Headlight Halos
    for (const hx of [-0.85, 0.85]) {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 20), ledMat);
      halo.position.set(hx, 1.05, 2.26);
      this.mesh.add(halo);

      // Fender Turn Signal Indicators (top of front fenders)
      const ind = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.08, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.2 })
      );
      ind.position.set(hx, 1.34, 1.95);
      this.mesh.add(ind);
    }

    // Rear Mounted Spare Wheel Cover with Chrome Ring
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.28, 24), bodyMat);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.22, -2.35);
    this.mesh.add(spare);

    const spareRing = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.04, 8, 24), chromeMat);
    spareRing.position.set(0, 1.22, -2.35);
    this.mesh.add(spareRing);

    // Rear Low-Bumper Horizontal Taillights (Characteristic G-Wagon low-mount taillights)
    for (const rx of [-0.75, 0.75]) {
      const rl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.08), redLightMat);
      rl.position.set(rx, 0.62, -2.28);
      this.mesh.add(rl);
    }

    // Roof LED Lightbar Pod
    const roofPod = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.18), blackMat);
    roofPod.position.set(0, 2.22, 1.05);
    this.mesh.add(roofPod);

    const roofLight = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.08), ledMat);
    roofLight.position.set(0, 2.22, 1.15);
    this.mesh.add(roofLight);

    // Large AMG 22" Matte Black Wheels
    const wheelOffsets = [
      { x: -1.14, z: 1.45, isFront: true },
      { x: 1.14, z: 1.45, isFront: true },
      { x: -1.14, z: -1.45, isFront: false },
      { x: 1.14, z: -1.45, isFront: false },
    ];
    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.52, 0.34, 0.32);
      holder.position.set(off.x, 0.52, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) this.steerWheels.push(holder as any);
    }
  }

  // === 8. BUILD PORSCHE / FERRARI SUPERCAR ===
  private buildSportsCar(): void {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xdc2626, // Rosso Corsa Crimson
      metalness: 0.85,
      roughness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6, metalness: 0.4 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x020617,
      transmission: 0.5,
      transparent: true,
      roughness: 0.08,
    });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x60a5fa, emissiveIntensity: 2.2 });
    const redLightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 2.0 });

    // Low-slung Aerodynamic Monocoque Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 4.5), carbonMat);
    chassis.position.y = 0.22;
    this.mesh.add(chassis);

    // Sculpted Widebody Shell
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.42, 4.45), bodyMat);
    body.position.y = 0.44;
    this.mesh.add(body);

    // Front Carbon Fiber Aerodynamic Splitter
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 0.45), carbonMat);
    splitter.position.set(0, 0.16, 2.3);
    this.mesh.add(splitter);

    // Sloping Front Hood with Dual Radiator Vents
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.16, 1.4), bodyMat);
    hood.position.set(0, 0.62, 1.45);
    hood.rotation.x = -0.16;
    this.mesh.add(hood);

    // Aerodynamic Cockpit Teardrop Canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.46, 1.95), bodyMat);
    canopy.position.set(0, 0.88, -0.05);
    this.mesh.add(canopy);

    // Windshield (Extreme aerodynamic rake)
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.58, 0.06), glassMat);
    windshield.position.set(0, 0.84, 0.82);
    windshield.rotation.x = 0.78;
    this.mesh.add(windshield);

    // Rear Mid-Engine Slotted Glass Hatch
    const engineGlass = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.62, 0.06), glassMat);
    engineGlass.position.set(0, 0.82, -0.92);
    engineGlass.rotation.x = -0.68;
    this.mesh.add(engineGlass);

    // Prominent Carbon Fiber GT Wing Spoiler on Dual Stanchions
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 0.38), carbonMat);
    wing.position.set(0, 1.25, -2.15);
    this.mesh.add(wing);

    for (const sx of [-0.55, 0.55]) {
      const stanchion = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.36, 0.14), carbonMat);
      stanchion.position.set(sx, 1.05, -2.12);
      this.mesh.add(stanchion);
    }

    // Swept Aggressive LED Headlights
    for (const hx of [-0.75, 0.75]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.28), ledMat);
      hl.position.set(hx, 0.62, 2.05);
      hl.rotation.y = hx > 0 ? -0.2 : 0.2;
      this.mesh.add(hl);
    }

    // Thin Sculpted LED Taillights
    for (const tx of [-0.72, 0.72]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.12), redLightMat);
      tl.position.set(tx, 0.68, -2.22);
      this.mesh.add(tl);
    }

    // Rear Aerodynamic Diffuser & Quad Titanium Exhaust Pipes
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.35), carbonMat);
    diffuser.position.set(0, 0.28, -2.25);
    this.mesh.add(diffuser);

    for (const ex of [-0.32, -0.12, 0.12, 0.32]) {
      const exhaust = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.95, roughness: 0.1 })
      );
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(ex, 0.36, -2.32);
      this.mesh.add(exhaust);
    }

    // Staggered Low-Profile Racing Wheels (Brembo Red Calipers)
    const wheelOffsets = [
      { x: -1.04, z: 1.45, isFront: true, r: 0.38, w: 0.26 },
      { x: 1.04, z: 1.45, isFront: true, r: 0.38, w: 0.26 },
      { x: -1.06, z: -1.45, isFront: false, r: 0.42, w: 0.34 },
      { x: 1.06, z: -1.45, isFront: false, r: 0.42, w: 0.34 },
    ];
    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(off.r, off.w, off.r * 0.72);
      holder.position.set(off.x, off.r, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) this.steerWheels.push(holder as any);
    }
  }

  // === 9. BUILD TESLA MODEL S ELECTRIC SEDAN ===
  private buildElectricCar(): void {
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc, // Pearl White Metallic
      metalness: 0.65,
      roughness: 0.18,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
    });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x09090b,
      transmission: 0.6,
      transparent: true,
      roughness: 0.04,
    });
    const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbae6fd, emissiveIntensity: 2.0 });
    const redLightMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.8 });

    // Battery Skateboard Floor Base
    const skateboard = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.22, 4.7),
      new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.4 })
    );
    skateboard.position.y = 0.28;
    this.mesh.add(skateboard);

    // Streamlined Minimalist Aerodynamic Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.52, 4.65), bodyMat);
    body.position.y = 0.56;
    this.mesh.add(body);

    // Flush Aerodynamic Nose Cone (No internal combustion grille)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.38, 0.35), bodyMat);
    nose.position.set(0, 0.52, 2.38);
    this.mesh.add(nose);

    // Continuous Front LED Horizon Lightbar
    const frontLightbar = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.05, 0.08), ledMat);
    frontLightbar.position.set(0, 0.68, 2.45);
    this.mesh.add(frontLightbar);

    // Seamless Full-Length Glass Canopy Roof (Windshield to Rear)
    const glassCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.58, 2.85), glassMat);
    glassCanopy.position.set(0, 1.14, -0.15);
    this.mesh.add(glassCanopy);

    // Carbon Fiber Decklid Lip Spoiler
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.05, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
    );
    lip.position.set(0, 0.88, -2.25);
    this.mesh.add(lip);

    // Full-Width Rear Continuous OLED Lightbar
    const rearLightbar = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.05, 0.08), redLightMat);
    rearLightbar.position.set(0, 0.72, -2.36);
    this.mesh.add(rearLightbar);

    // Aero Turbine Disc Wheels
    const wheelOffsets = [
      { x: -0.98, z: 1.5, isFront: true },
      { x: 0.98, z: 1.5, isFront: true },
      { x: -0.98, z: -1.5, isFront: false },
      { x: 0.98, z: -1.5, isFront: false },
    ];
    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.40, 0.25, 0.26);
      holder.position.set(off.x, 0.40, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) this.steerWheels.push(holder as any);
    }
  }

  // === 10. BUILD LASAMBUS LAGOS EMERGENCY RESCUE AMBULANCE ===
  private buildAmbulance(): void {
    const whitePaint = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const blackTrim = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      transmission: 0.5,
      transparent: true,
      roughness: 0.1,
    });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }); // LASAMBUS Hi-Vis Yellow
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 }); // Lagos Green
    const redBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 2.5,
    });
    const blueBeaconMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 2.5,
    });

    // Heavy-Duty Van Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.18, 0.3, 5.2), blackTrim);
    chassis.position.y = 0.4;
    this.mesh.add(chassis);

    // High-Roof Medical Emergency Box Van
    const vanBox = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.65, 5.1), whitePaint);
    vanBox.position.set(0, 1.35, -0.15);
    this.mesh.add(vanBox);

    // Front Slanted Cab & Windshield
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 1.4), whitePaint);
    cab.position.set(0, 1.1, 2.0);
    this.mesh.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 0.08), glassMat);
    windshield.position.set(0, 1.35, 2.15);
    windshield.rotation.x = 0.42;
    this.mesh.add(windshield);

    // Authentic Lagos State Emergency (LASAMBUS) Reflective Stripes
    for (const sx of [-1.085, 1.085]) {
      // Yellow High-Vis Stripe
      const yStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 4.8), yellowMat);
      yStripe.position.set(sx, 1.15, -0.15);
      this.mesh.add(yStripe);

      // Lagos Green Stripe
      const gStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 4.8), greenMat);
      gStripe.position.set(sx, 0.92, -0.15);
      this.mesh.add(gStripe);

      // Red Cross / Medical Badge
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.15), redBeaconMat);
      crossV.position.set(sx > 0 ? sx + 0.01 : sx - 0.01, 1.75, -0.2);
      this.mesh.add(crossV);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.45), redBeaconMat);
      crossH.position.set(sx > 0 ? sx + 0.01 : sx - 0.01, 1.75, -0.2);
      this.mesh.add(crossH);
    }

    // Rooftop Emergency Beacon Lightbar (Dual Red & Blue strobe pods)
    const lightbarBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.32), blackTrim);
    lightbarBase.position.set(0, 2.25, 1.3);
    this.mesh.add(lightbarBase);

    // Red Flashing Strobe (Left)
    const redStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.28), redBeaconMat);
    redStrobe.position.set(-0.38, 2.36, 1.3);
    this.mesh.add(redStrobe);

    // Blue Flashing Strobe (Right)
    const blueStrobe = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.14, 0.28), blueBeaconMat);
    blueStrobe.position.set(0.38, 2.36, 1.3);
    this.mesh.add(blueStrobe);

    // Front Grille & Headlights
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.15), blackTrim);
    grille.position.set(0, 0.72, 2.68);
    this.mesh.add(grille);

    for (const hx of [-0.85, 0.85]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.22, 0.15),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.8 })
      );
      hl.position.set(hx, 0.78, 2.65);
      this.mesh.add(hl);
    }

    // Heavy-Duty Commercial Wheels
    const wheelOffsets = [
      { x: -1.08, z: 1.65, isFront: true },
      { x: 1.08, z: 1.65, isFront: true },
      { x: -1.08, z: -1.65, isFront: false },
      { x: 1.08, z: -1.65, isFront: false },
    ];
    for (const off of wheelOffsets) {
      const { holder, tire } = this.createRealisticWheel(0.46, 0.30, 0.26);
      holder.position.set(off.x, 0.46, off.z);
      this.mesh.add(holder);
      this.wheels.push(tire);
      if (off.isFront) this.steerWheels.push(holder as any);
    }
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
    let gas = !!(keys['w'] || keys['KeyW'] || keys['arrowup'] || keys['ArrowUp']);
    const brake = !!(keys['s'] || keys['KeyS'] || keys['arrowdown'] || keys['ArrowDown']);
    const left = !!(keys['a'] || keys['KeyA'] || keys['arrowleft'] || keys['ArrowLeft']);
    const right = !!(keys['d'] || keys['KeyD'] || keys['arrowright'] || keys['ArrowRight']);

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

    // In-Traffic Street Hawker System (Chidi approaching window in go-slow)
    const streetLife = LagosStreetLifeSystem.getInstance();
    streetLife.updateTrafficHawker(delta, this.currentSpeed, !!this.driver);
    if (streetLife.isHawkerAtWindow) {
      if (keys['h'] || keys['KeyH']) {
        keys['h'] = false;
        keys['KeyH'] = false;
        streetLife.buyFromWindowHawker('water');
      } else if (keys['g'] || keys['KeyG']) {
        keys['g'] = false;
        keys['KeyG'] = false;
        streetLife.buyFromWindowHawker('gala');
      }
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
          if (this.type === 'danfo') {
            streetLife.triggerConductorShout();
          } else {
            showGameToast(`👥 Passenger boarded! +₦${this.fareRate.toLocaleString()} fare collected (${this.passengers}/${this.maxPassengers} seats filled)`, 'success');
          }
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

    // Progressive steering model with S-curve response and fast neutral centering
    let rawSteer = 0;
    if (left && !right) rawSteer = 1;
    else if (right && !left) rawSteer = -1;

    if (rawSteer !== 0) {
      // Progressive build-up: small taps produce gentle inputs (~0.25) for fine lane adjustments,
      // while sustained holds smoothly ramp up to 1.0 for full turning lock.
      const steerAttackRate = 3.6;
      this.steerInput = THREE.MathUtils.clamp(
        this.steerInput + rawSteer * steerAttackRate * delta,
        -1,
        1
      );
      // Instant direction switch if player presses opposite key
      if ((rawSteer > 0 && this.steerInput < 0) || (rawSteer < 0 && this.steerInput > 0)) {
        this.steerInput = 0;
      }
    } else {
      // Critically damped return to neutral when steering keys are released
      this.steerInput = THREE.MathUtils.lerp(this.steerInput, 0, Math.min(1, delta * 11.0));
      if (Math.abs(this.steerInput) < 0.005) this.steerInput = 0;
    }

    // Progressive non-linear steering response curve (forgiving near center, sharp at full lock)
    const sign = Math.sign(this.steerInput);
    const absInput = Math.abs(this.steerInput);
    const curvedSteer = sign * Math.pow(absInput, 1.35) * DrivableVehicle.steeringSensitivity;
    this.turnAngle = curvedSteer;

    // Speed-dependent steering sensitivity scaling:
    // High speeds require smaller steering angles to maintain stability and prevent zigzagging,
    // while low speeds retain full turning angle for U-turns and parking.
    const absSpeed = Math.abs(this.currentSpeed);
    const speedSensitivity = 1.0 / (1.0 + Math.pow(absSpeed / 8.5, 0.85));
    const effectiveTurnSpeed = this.config.turnSpeed * speedSensitivity;

    // Automatic Lane Centering & Directional Stability
    let laneAssistTorque = 0;
    const isPlayerSteering = Math.abs(this.steerInput) > 0.12;
    const isDrivingForward = this.currentSpeed > 2.0;
    this.isCenteringActive = false;

    if (isDrivingForward && !isPlayerSteering && DrivableVehicle.laneAssistStrength > 0) {
      const pos = this.mesh.position;
      const rotY = this.mesh.rotation.y;

      // Check Broad Street corridor (|x| <= 6.8, |z| <= 122)
      if (Math.abs(pos.x) <= 6.8 && Math.abs(pos.z) <= 122) {
        // Forward vector along Z axis is cos(rotY)
        const fwdZ = Math.cos(rotY);
        // Driving south (+Z, rotY ~ 0) or north (-Z, rotY ~ PI)
        if (fwdZ > 0.40) {
          // Driving South (+Z) on West side (Nigeria drives on the right: x < 0)
          // Lanes at x = -4.9 (outer/slow) and x = -1.8 (inner/fast)
          const targetLaneX = pos.x < -3.35 ? -4.9 : -1.8;
          const latOffset = pos.x - targetLaneX; // positive = drifted right of lane center
          // Heading error towards 0 radians (South)
          const headingErr = THREE.MathUtils.euclideanModulo(rotY + Math.PI, Math.PI * 2) - Math.PI;

          // Proportional-derivative damping: align with road direction and nudge to lane center
          const headingTorque = -headingErr * 2.2;
          const latTorque = -latOffset * 0.42;
          laneAssistTorque = THREE.MathUtils.clamp(headingTorque + latTorque, -0.40, 0.40);
          this.isCenteringActive = true;
        } else if (fwdZ < -0.40) {
          // Driving North (-Z) on East side (Nigeria drives on the right: x > 0)
          // Lanes at x = +1.8 (inner/fast) and x = +4.9 (outer/slow)
          const targetLaneX = pos.x > 3.35 ? 4.9 : 1.8;
          const latOffset = pos.x - targetLaneX;
          // Heading error towards PI radians (North)
          const headingErr = THREE.MathUtils.euclideanModulo(rotY, Math.PI * 2) - Math.PI;

          const headingTorque = -headingErr * 2.2;
          const latTorque = latOffset * 0.42;
          laneAssistTorque = THREE.MathUtils.clamp(headingTorque + latTorque, -0.40, 0.40);
          this.isCenteringActive = true;
        }
      }
    }

    // Apply steering and lane assistance to vehicle yaw
    if (absSpeed > 0.15) {
      const dirSign = this.currentSpeed >= 0 ? 1 : -1;
      const playerTurnRate = this.turnAngle * effectiveTurnSpeed * dirSign;
      const assistFade = THREE.MathUtils.clamp(1.0 - Math.abs(this.steerInput) / 0.12, 0, 1);
      const totalTurnRate = playerTurnRate + laneAssistTorque * DrivableVehicle.laneAssistStrength * assistFade;
      this.mesh.rotation.y += totalTurnRate * delta;
    }

    // Steer visual front wheels
    for (const w of this.steerWheels) {
      w.rotation.y = this.turnAngle * 0.42;
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
    const forwardX = Math.sin(this.mesh.rotation.y);
    const forwardZ = Math.cos(this.mesh.rotation.y);

    // Lateral grip inertia: lerp travel velocity vector towards car heading
    if (!this.velocityDirection) {
      this.velocityDirection = new THREE.Vector2(forwardX, forwardZ);
    }
    const gripFactor = Math.min(1.0, delta * 12.0);
    this.velocityDirection.x = THREE.MathUtils.lerp(this.velocityDirection.x, forwardX, gripFactor);
    this.velocityDirection.y = THREE.MathUtils.lerp(this.velocityDirection.y, forwardZ, gripFactor);
    this.velocityDirection.normalize();

    const nextPos = this.mesh.position.clone();
    nextPos.x += this.velocityDirection.x * moveDist;
    nextPos.z += this.velocityDirection.y * moveDist;

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
