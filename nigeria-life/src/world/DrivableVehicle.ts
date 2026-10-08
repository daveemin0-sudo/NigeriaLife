import * as THREE from 'three';
import type { Player } from '../player/Player';
import { createColorCanvasTexture } from '../utils/TextureUtils';
import { SignageLibrary } from '../materials/SignageLibrary';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { AssetManager } from '../assets/AssetManager';
import { SoundEngine } from '../audio/SoundEngine';

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
  public id: string;
  public name: string;
  public type: VehicleType;
  public mesh: THREE.Group;
  public config: VehicleConfig;

  public currentSpeed: number = 0;
  public turnAngle: number = 0;
  public driver: Player | null = null;

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

    this.mesh = new THREE.Group();
    this.mesh.position.copy(initialPos);
    this.mesh.rotation.y = initialRotY;

    // Build the 3D model
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
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📢 PAA-PAA!', 128, 64);

    const texture = createColorCanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    this.hornTextMesh = new THREE.Sprite(spriteMat);
    this.hornTextMesh.scale.set(3.2, 1.6, 1);
    this.hornDisplayGroup.add(this.hornTextMesh);
  }

  // === 1. BUILD DANFO MINIBUS ===
  private buildDanfo(): void {
    const signLib = SignageLibrary.getInstance();
    const matLib = MaterialLibrary.getInstance();

    // Body chassis with signature Lagos yellow gloss paint & PBR clearcoat
    const bodyGeo = new THREE.BoxGeometry(2.4, 2.0, 5.4);
    const yellowMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      roughness: 0.25,
      metalness: 0.55,
      clearcoat: 0.85,
      clearcoatRoughness: 0.15,
    });
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.position.y = 1.45;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);

    // Twin black side route decals along left and right flanks
    const decalGeo = new THREE.PlaneGeometry(5.38, 0.45);
    const decalR = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalR.position.set(1.21, 1.35, 0);
    decalR.rotation.y = Math.PI / 2;
    this.mesh.add(decalR);

    const decalL = new THREE.Mesh(decalGeo, signLib.danfoSideStripeMaterial);
    decalL.position.set(-1.21, 1.35, 0);
    decalL.rotation.y = -Math.PI / 2;
    this.mesh.add(decalL);

    // Windshield with green/white sun visor banner
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
    });
    const windshieldGeo = new THREE.PlaneGeometry(2.1, 0.88);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 1.85, 2.71);
    this.mesh.add(windshield);

    // Sun visor banner sticker
    const visorGeo = new THREE.PlaneGeometry(2.08, 0.22);
    const visor = new THREE.Mesh(visorGeo, signLib.danfoVisorMaterial);
    visor.position.set(0, 2.18, 2.715);
    this.mesh.add(visor);

    // Side windows (Passenger windows)
    for (const sx of [-1.21, 1.21]) {
      const sideGlassGeo = new THREE.PlaneGeometry(4.2, 0.65);
      const sideGlass = new THREE.Mesh(sideGlassGeo, glassMat);
      sideGlass.position.set(sx, 1.95, -0.3);
      sideGlass.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.mesh.add(sideGlass);
    }

    // Rear tailgate with slogan & registration plate
    const rearSloganGeo = new THREE.PlaneGeometry(1.8, 0.45);
    const rearSlogan = new THREE.Mesh(rearSloganGeo, signLib.danfoRearSloganMaterial);
    rearSlogan.position.set(0, 1.15, -2.71);
    rearSlogan.rotation.y = Math.PI;
    this.mesh.add(rearSlogan);

    // Headlights (Chrome reflector housing + warm emissive glow)
    for (const hx of [-0.9, 0.9]) {
      const lightGeo = new THREE.BoxGeometry(0.35, 0.22, 0.1);
      const lightMat = new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        emissive: 0xffedd5,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(hx, 0.9, 2.71);
      light.castShadow = true;
      this.mesh.add(light);
    }

    // Taillights (Red reflector + emissive red glow)
    for (const hx of [-0.9, 0.9]) {
      const tailGeo = new THREE.BoxGeometry(0.35, 0.22, 0.1);
      const tailMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(hx, 0.9, -2.71);
      tail.castShadow = true;
      this.mesh.add(tail);
    }

    // Heavy-duty black rubber front & rear bumpers
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.26, 0.25), bumperMat);
    frontBumper.position.set(0, 0.58, 2.78);
    frontBumper.castShadow = true;
    this.mesh.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.26, 0.25), bumperMat);
    rearBumper.position.set(0, 0.58, -2.78);
    rearBumper.castShadow = true;
    this.mesh.add(rearBumper);

    // Exterior Side Wing Mirrors
    for (const mx of [-1.32, 1.32]) {
      const mirrorGroup = new THREE.Group();
      mirrorGroup.position.set(mx, 1.6, 2.3);

      const stalkGeo = new THREE.BoxGeometry(0.18, 0.05, 0.05);
      const stalk = new THREE.Mesh(stalkGeo, bumperMat);
      mirrorGroup.add(stalk);

      const mirrorGeo = new THREE.BoxGeometry(0.08, 0.26, 0.15);
      const mirror = new THREE.Mesh(mirrorGeo, bumperMat);
      mirror.position.set(mx > 0 ? 0.08 : -0.08, 0, 0);
      mirrorGroup.add(mirror);

      this.mesh.add(mirrorGroup);
    }

    // Welded Tubular Roof Luggage Rack with Cargo Sacks
    const rackGroup = new THREE.Group();
    rackGroup.position.set(0, 2.5, -0.4);

    const rackFrameGeo = new THREE.BoxGeometry(2.1, 0.22, 3.8);
    const rackFrame = new THREE.Mesh(rackFrameGeo, matLib.ironRailingMaterial);
    rackGroup.add(rackFrame);

    // Tied market cargo boxes / sacks on roof
    const cargoMat1 = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85 }); // Burlap sack
    const cargoMat2 = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 }); // Plastic crate
    const cargoMat3 = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }); // Carton

    const sack1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 1.1), cargoMat1);
    sack1.position.set(-0.45, 0.32, -0.6);
    sack1.castShadow = true;
    rackGroup.add(sack1);

    const sack2 = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.4, 0.9), cargoMat2);
    sack2.position.set(0.45, 0.3, -0.5);
    sack2.castShadow = true;
    rackGroup.add(sack2);

    const sack3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.38, 0.8), cargoMat3);
    sack3.position.set(0, 0.3, 0.8);
    sack3.castShadow = true;
    rackGroup.add(sack3);

    this.mesh.add(rackGroup);

    // Wheels with black rubber tire & chrome center hub
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.3 });

    const wheelOffsets = [
      { x: -1.2, z: 1.7, isFront: true },
      { x: 1.2, z: 1.7, isFront: true },
      { x: -1.2, z: -1.7, isFront: false },
      { x: 1.2, z: -1.7, isFront: false },
    ];

    for (const off of wheelOffsets) {
      const wheelHolder = new THREE.Group();
      wheelHolder.position.set(off.x, 0.44, off.z);

      const tireGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.32, 16);
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelHolder.add(tire);

      const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.33, 12);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelHolder.add(rim);

      this.mesh.add(wheelHolder);
      this.wheels.push(tire);
      if (off.isFront) {
        this.steerWheels.push(wheelHolder as any);
      }
    }
  }

  // === 2. BUILD KEKE NAPEP ===
  private buildKeke(): void {
    const matLib = MaterialLibrary.getInstance();

    // Main yellow body chassis
    const baseGeo = new THREE.BoxGeometry(1.5, 0.9, 2.4);
    const yellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.1,
    });
    const base = new THREE.Mesh(baseGeo, yellowMat);
    base.position.y = 0.8;
    base.castShadow = true;
    base.receiveShadow = true;
    this.mesh.add(base);

    // Black curved canvas canopy roof
    const roofGeo = new THREE.BoxGeometry(1.55, 0.85, 2.2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 1.75;
    roof.castShadow = true;
    this.mesh.add(roof);

    // Steel Tubular Roll Cage Pillars supporting canopy
    for (const px of [-0.72, 0.72]) {
      for (const pz of [-1.0, 0.1, 1.0]) {
        const pillarGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8);
        const pillar = new THREE.Mesh(pillarGeo, matLib.ironRailingMaterial);
        pillar.position.set(px, 1.3, pz);
        pillar.castShadow = true;
        this.mesh.add(pillar);
      }
    }

    // Safety passenger handrails at open side door
    for (const hx of [-0.74, 0.74]) {
      const railGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
      const rail = new THREE.Mesh(railGeo, yellowMat);
      rail.position.set(hx, 0.85, -0.3);
      this.mesh.add(rail);
    }

    // Windshield
    const shieldGeo = new THREE.PlaneGeometry(1.3, 0.65);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
    });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 1.5, 1.21);
    this.mesh.add(shield);

    // Cyclops Center Headlight with bright emissive beam
    const headGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfffaed,
      emissiveIntensity: 1.3,
      roughness: 0.2,
    });
    const headlight = new THREE.Mesh(headGeo, headMat);
    headlight.rotation.x = Math.PI / 2;
    headlight.position.set(0, 0.85, 1.22);
    headlight.castShadow = true;
    this.mesh.add(headlight);

    // Amber indicator pods
    for (const ix of [-0.5, 0.5]) {
      const podGeo = new THREE.SphereGeometry(0.07, 8, 8);
      const podMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.7,
      });
      const pod = new THREE.Mesh(podGeo, podMat);
      pod.position.set(ix, 0.85, 1.2);
      this.mesh.add(pod);
    }

    // Handlebar controls inside cabin
    const barGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8);
    const bar = new THREE.Mesh(barGeo, matLib.ironRailingMaterial);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.05, 0.6);
    this.mesh.add(bar);

    // Rear mudflaps and license plate
    const plateGeo = new THREE.BoxGeometry(0.4, 0.2, 0.02);
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set(0, 0.6, -1.21);
    this.mesh.add(plate);

    // Wheels (1 front, 2 rear) with black rubber and steel rims
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.3 });

    // Front wheel
    const frontHolder = new THREE.Group();
    frontHolder.position.set(0, 0.32, 1.1);
    const fTire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), tireMat);
    fTire.rotation.z = Math.PI / 2;
    fTire.castShadow = true;
    frontHolder.add(fTire);

    const fRim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.23, 12), rimMat);
    fRim.rotation.z = Math.PI / 2;
    frontHolder.add(fRim);

    this.mesh.add(frontHolder);
    this.wheels.push(fTire);
    this.steerWheels.push(frontHolder as any);

    // Rear wheels
    for (const rx of [-0.8, 0.8]) {
      const rearHolder = new THREE.Group();
      rearHolder.position.set(rx, 0.32, -0.9);

      const rTire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16), tireMat);
      rTire.rotation.z = Math.PI / 2;
      rTire.castShadow = true;
      rearHolder.add(rTire);

      const rRim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.23, 12), rimMat);
      rRim.rotation.z = Math.PI / 2;
      rearHolder.add(rRim);

      this.mesh.add(rearHolder);
      this.wheels.push(rTire);
    }
  }

  // === 3. BUILD LUXURY SUV (MOPOL / BIG BOY SPEC) ===
  private buildLuxurySUV(): void {
    // Gloss Black Body
    const bodyGeo = new THREE.BoxGeometry(2.3, 1.6, 5.0);
    const blackPaint = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 0.2,
      metalness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeo, blackPaint);
    body.position.y = 1.35;
    body.castShadow = true;
    this.mesh.add(body);

    // Dark Limousine Tinted Cabin
    const cabinGeo = new THREE.BoxGeometry(2.1, 1.1, 3.2);
    const tintGlass = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.1,
      metalness: 0.95,
    });
    const cabin = new THREE.Mesh(cabinGeo, tintGlass);
    cabin.position.set(0, 2.2, -0.3);
    this.mesh.add(cabin);

    // Chrome Front Grille
    const grilleGeo = new THREE.BoxGeometry(1.6, 0.6, 0.15);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95 });
    const grille = new THREE.Mesh(grilleGeo, chromeMat);
    grille.position.set(0, 1.1, 2.52);
    this.mesh.add(grille);

    // Xenon LED Headlights
    for (let hx of [-0.85, 0.85]) {
      const lightGeo = new THREE.BoxGeometry(0.35, 0.18, 0.1);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(hx, 1.35, 2.52);
      this.mesh.add(light);
    }

    // Rear Mounted Luxury Spare Wheel Cover
    const spareGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 20);
    const spare = new THREE.Mesh(spareGeo, blackPaint);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 1.35, -2.65);
    this.mesh.add(spare);

    // Chrome alloy wheels
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.38, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });

    const wheelOffsets = [
      { x: -1.18, z: 1.6, isFront: true },
      { x: 1.18, z: 1.6, isFront: true },
      { x: -1.18, z: -1.6, isFront: false },
      { x: 1.18, z: -1.6, isFront: false },
    ];

    for (let off of wheelOffsets) {
      const wheelHolder = new THREE.Group();
      wheelHolder.position.set(off.x, 0.48, off.z);

      const wheelMesh = new THREE.Mesh(wheelGeo, rimMat);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelHolder.add(wheelMesh);

      this.mesh.add(wheelHolder);
      this.wheels.push(wheelMesh);
      if (off.isFront) {
        this.steerWheels.push(wheelHolder as any);
      }
    }
  }

  // === 4. BUILD OKADA MOTORCYCLE ===
  private buildOkada(): void {
    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.25, clearcoat: 0.5 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 1.6), frameMat);
    frame.position.y = 0.65;
    this.mesh.add(frame);

    const tankMat = new THREE.MeshPhysicalMaterial({ color: 0xdc2626, metalness: 0.65, roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.1 });
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.25, 0.5), tankMat);
    tank.position.set(0, 0.82, 0.2);
    this.mesh.add(tank);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.12, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85 })
    );
    seat.position.set(0, 0.8, -0.3);
    this.mesh.add(seat);

    // Courier Delivery Box (QuickChop Emerald)
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.45, 0.45),
      new THREE.MeshPhysicalMaterial({ color: 0x059669, roughness: 0.4, clearcoat: 0.6 })
    );
    box.position.set(0, 1.05, -0.75);
    this.mesh.add(box);

    // Front Fork & Handlebars (steering group)
    const forkGroup = new THREE.Group();
    forkGroup.position.set(0, 0.35, 0.8);
    this.mesh.add(forkGroup);
    this.steerWheels.push(forkGroup as any);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), frameMat);
    bar.position.set(0, 0.7, 0);
    forkGroup.add(bar);

    const light = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffae0, emissiveIntensity: 1.5 })
    );
    light.rotation.x = Math.PI / 2;
    light.position.set(0, 0.5, 0.08);
    forkGroup.add(light);

    // Front wheel attached to forkGroup
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.85 });
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16);
    const fWheel = new THREE.Mesh(wheelGeo, tireMat);
    fWheel.rotation.z = Math.PI / 2;
    forkGroup.add(fWheel);
    this.wheels.push(fWheel);

    // Rear wheel attached to body
    const rWheel = new THREE.Mesh(wheelGeo, tireMat);
    rWheel.rotation.z = Math.PI / 2;
    rWheel.position.set(0, 0.35, -0.7);
    this.mesh.add(rWheel);
    this.wheels.push(rWheel);
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
    const forward = keys['w'] || keys['arrowup'];
    const backward = keys['s'] || keys['arrowdown'];
    const steerLeft = keys['a'] || keys['arrowleft'];
    const steerRight = keys['d'] || keys['arrowright'];
    const handbrake = keys[' '];

    // Acceleration & Braking
    if (forward) {
      this.currentSpeed = Math.min(
        this.config.maxSpeed,
        this.currentSpeed + this.config.acceleration * delta
      );
      SoundEngine.getInstance().playEngineAccelerate(Math.abs(this.currentSpeed) / this.config.maxSpeed);
    } else if (backward) {
      this.currentSpeed = Math.max(
        -this.config.reverseSpeed,
        this.currentSpeed - this.config.braking * delta
      );
    } else {
      // Coasting friction
      this.currentSpeed = THREE.MathUtils.lerp(
        this.currentSpeed,
        0,
        delta * (handbrake ? 6.0 : this.config.friction)
      );
    }

    if (handbrake) {
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, delta * 7.0);
    }

    // Steering (effective when moving)
    if (Math.abs(this.currentSpeed) > 0.2) {
      const steerDirection = this.currentSpeed >= 0 ? 1 : -1;
      if (steerLeft) {
        this.mesh.rotation.y += this.config.turnSpeed * delta * steerDirection;
      }
      if (steerRight) {
        this.mesh.rotation.y -= this.config.turnSpeed * delta * steerDirection;
      }
    }

    // Visual steer angle for front wheels
    const visualSteer = (steerLeft ? 0.35 : 0) - (steerRight ? 0.35 : 0);
    for (let sw of this.steerWheels) {
      sw.rotation.y = THREE.MathUtils.lerp(sw.rotation.y, visualSteer, delta * 12);
    }

    // Forward motion
    this.moveForward(delta);

    // Keep player synced with vehicle position
    if (this.driver) {
      this.driver.mesh.position.copy(this.mesh.position);
      this.driver.mesh.rotation.y = this.mesh.rotation.y;
    }
  }

  private moveForward(delta: number): void {
    if (Math.abs(this.currentSpeed) < 0.05) return;

    const forwardVector = new THREE.Vector3(0, 0, 1);
    forwardVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);

    this.mesh.position.addScaledVector(forwardVector, this.currentSpeed * delta);

    // Keep within world bounds (-95 to 95)
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -85, 85);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -95, 95);

    // Rotate wheels
    for (let w of this.wheels) {
      w.rotation.x += this.currentSpeed * delta * 2.8;
    }
  }
}
