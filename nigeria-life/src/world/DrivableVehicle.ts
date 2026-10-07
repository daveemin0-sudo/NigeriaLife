import * as THREE from 'three';
import type { Player } from '../player/Player';

export type VehicleType = 'danfo' | 'keke' | 'suv';

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
    } else {
      this.buildLuxurySUV();
    }

    // Horn bubble billboard above roof
    this.hornDisplayGroup = new THREE.Group();
    this.hornDisplayGroup.position.set(0, 3.2, 0);
    this.hornDisplayGroup.visible = false;
    this.mesh.add(this.hornDisplayGroup);
    this.createHornSprite();
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

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    this.hornTextMesh = new THREE.Sprite(spriteMat);
    this.hornTextMesh.scale.set(3.2, 1.6, 1);
    this.hornDisplayGroup.add(this.hornTextMesh);
  }

  // === 1. BUILD DANFO MINIBUS ===
  private buildDanfo(): void {
    // Body chassis
    const bodyGeo = new THREE.BoxGeometry(2.4, 2.0, 5.4);
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.position.y = 1.45;
    body.castShadow = true;
    this.mesh.add(body);

    // Twin black racing stripes
    const stripeGeo = new THREE.BoxGeometry(2.42, 0.3, 5.42);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 1.35;
    this.mesh.add(stripe);

    // Windshield & side windows
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
    });
    const windshieldGeo = new THREE.PlaneGeometry(2.1, 0.9);
    const windshield = new THREE.Mesh(windshieldGeo, glassMat);
    windshield.position.set(0, 1.85, 2.71);
    this.mesh.add(windshield);

    // Headlights
    for (let hx of [-0.9, 0.9]) {
      const lightGeo = new THREE.BoxGeometry(0.35, 0.22, 0.1);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(hx, 0.9, 2.71);
      this.mesh.add(light);
    }

    // Taillights
    for (let hx of [-0.9, 0.9]) {
      const tailGeo = new THREE.BoxGeometry(0.35, 0.22, 0.1);
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      tail.position.set(hx, 0.9, -2.71);
      this.mesh.add(tail);
    }

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.35, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    const wheelOffsets = [
      { x: -1.2, z: 1.7, isFront: true },
      { x: 1.2, z: 1.7, isFront: true },
      { x: -1.2, z: -1.7, isFront: false },
      { x: 1.2, z: -1.7, isFront: false },
    ];

    for (let off of wheelOffsets) {
      const wheelHolder = new THREE.Group();
      wheelHolder.position.set(off.x, 0.44, off.z);

      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelHolder.add(wheelMesh);

      this.mesh.add(wheelHolder);
      this.wheels.push(wheelMesh);
      if (off.isFront) {
        this.steerWheels.push(wheelHolder as any);
      }
    }
  }

  // === 2. BUILD KEKE NAPEP ===
  private buildKeke(): void {
    const baseGeo = new THREE.BoxGeometry(1.5, 1.0, 2.4);
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const base = new THREE.Mesh(baseGeo, yellowMat);
    base.position.y = 0.85;
    this.mesh.add(base);

    // Black curved canopy
    const roofGeo = new THREE.BoxGeometry(1.55, 0.9, 2.2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 1.75;
    this.mesh.add(roof);

    // Windshield
    const shieldGeo = new THREE.PlaneGeometry(1.3, 0.7);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1 });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 1.45, 1.21);
    this.mesh.add(shield);

    // Wheels (1 front, 2 rear)
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    // Front wheel
    const frontHolder = new THREE.Group();
    frontHolder.position.set(0, 0.32, 1.1);
    const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontHolder.add(frontWheel);
    this.mesh.add(frontHolder);
    this.wheels.push(frontWheel);
    this.steerWheels.push(frontHolder as any);

    // Rear wheels
    for (let rx of [-0.8, 0.8]) {
      const rearHolder = new THREE.Group();
      rearHolder.position.set(rx, 0.32, -0.9);
      const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
      rearWheel.rotation.z = Math.PI / 2;
      rearHolder.add(rearWheel);
      this.mesh.add(rearHolder);
      this.wheels.push(rearWheel);
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
