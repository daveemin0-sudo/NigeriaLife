import * as THREE from 'three';
import {
  createSoftCircleTexture,
  createSmokeParticleTexture,
  createPuddleTexture,
} from '../utils/TextureUtils';
import { SoundEngine } from '../audio/SoundEngine';

/**
 * AtmosphereManager
 * Handles atmospheric environmental effects for NigeriaLife:
 * 1. Harmattan Golden Dust / Mote Particles drifting in sunlight
 * 2. Wet-look reflective asphalt puddles with sky & sun reflections
 * 3. Tiger generator exhaust smoke & Mama Put Suya charcoal grill haze
 * 4. Heat-haze asphalt mirage shimmer
 */
export class AtmosphereManager {
  public group: THREE.Group;
  private scene: THREE.Scene;

  // 1. Harmattan Dust Particles
  private dustPoints!: THREE.Points;
  private dustGeometry!: THREE.BufferGeometry;
  private dustPositions!: Float32Array;
  private dustVelocities!: Float32Array;
  private dustCount: number = 1200;
  private dustBoxSize = { x: 70, y: 18, z: 70 };

  // 2. Reflective Puddles
  public puddlesGroup: THREE.Group;
  private puddleMaterials: THREE.MeshStandardMaterial[] = [];

  // 3. Smoke Particles (Tiger Generator & Suya Grill)
  private smokePoints!: THREE.Points;
  private smokeGeometry!: THREE.BufferGeometry;
  private smokePositions!: Float32Array;
  private smokeVelocities!: Float32Array;
  private smokeLifetimes!: Float32Array;
  private smokeCount: number = 80;

  // Prop references
  private generatorMesh: THREE.Group | null = null;
  private genVibrationTimer: number = 0;

  // Elapsed time for animations
  private elapsedTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.puddlesGroup = new THREE.Group();
    this.group.add(this.puddlesGroup);

    this.createHarmattanDust();
    this.createPuddles();
    this.createGeneratorAndSuyaProps();
    this.createSmokeSystem();

    this.scene.add(this.group);
  }

  // =========================================================================
  // 1. HARMATTAN GOLDEN DUST & SUNBEAM PARTICLES
  // =========================================================================
  private createHarmattanDust(): void {
    this.dustGeometry = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.dustCount * 3);
    this.dustVelocities = new Float32Array(this.dustCount * 3);

    for (let i = 0; i < this.dustCount; i++) {
      this.dustPositions[i * 3] = (Math.random() - 0.5) * this.dustBoxSize.x;
      this.dustPositions[i * 3 + 1] = 0.5 + Math.random() * this.dustBoxSize.y;
      this.dustPositions[i * 3 + 2] = (Math.random() - 0.5) * this.dustBoxSize.z;

      // Gentle Lagos street breeze drifting diagonally along the boulevard
      this.dustVelocities[i * 3] = 0.2 + (Math.random() - 0.5) * 0.3; // X drift
      this.dustVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.12; // Y slow float
      this.dustVelocities[i * 3 + 2] = 0.5 + Math.random() * 0.4; // Z forward breeze
    }

    this.dustGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.dustPositions, 3)
    );

    const dustTexture = createSoftCircleTexture(64);

    const dustMaterial = new THREE.PointsMaterial({
      color: 0xfef08a, // Warm golden-amber Harmattan dust tone
      size: 0.35,
      map: dustTexture,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dustPoints = new THREE.Points(this.dustGeometry, dustMaterial);
    this.group.add(this.dustPoints);
  }

  // =========================================================================
  // 2. WET-LOOK REFLECTIVE PUDDLES
  // =========================================================================
  private createPuddles(): void {
    const puddleTexture = createPuddleTexture(256);

    // Locations along Broad Street gutters, road edges, and junction depressions
    const puddleLocations = [
      { x: -5.4, z: 12.0, sx: 3.2, sz: 2.4, rot: 0.3 },   // Near Mama Put Bukateria
      { x: 5.6, z: 22.0, sx: 2.8, sz: 3.5, rot: -0.5 },  // Outside Bet9ja shop gutter
      { x: 0.8, z: -18.0, sx: 2.5, sz: 2.0, rot: 1.1 },  // Junction asphalt pothole
      { x: 5.4, z: -8.0, sx: 3.6, sz: 2.6, rot: 0.8 },   // Danfo terminus curb
      { x: -5.2, z: -32.0, sx: 2.4, sz: 3.0, rot: -0.2 }, // Sabo Textiles corner
      { x: -3.8, z: 46.0, sx: 3.0, sz: 2.2, rot: 0.6 },  // South residential curb
    ];

    const puddleGeo = new THREE.PlaneGeometry(1, 1, 8, 8);

    puddleLocations.forEach((loc) => {
      // Highly reflective PBR water surface
      const puddleMat = new THREE.MeshStandardMaterial({
        color: 0x141c22,
        roughness: 0.04,     // Glass-smooth mirror reflections
        metalness: 0.12,
        map: puddleTexture,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });

      this.puddleMaterials.push(puddleMat);

      const puddleMesh = new THREE.Mesh(puddleGeo, puddleMat);
      puddleMesh.rotation.x = -Math.PI / 2;
      puddleMesh.rotation.z = loc.rot;
      puddleMesh.position.set(loc.x, 0.022, loc.z); // Raised just above asphalt plane
      puddleMesh.scale.set(loc.sx, loc.sz, 1);
      puddleMesh.receiveShadow = true;

      this.puddlesGroup.add(puddleMesh);
    });
  }

  // =========================================================================
  // 3. TIGER GENERATOR & SUYA GRILL PROPS
  // =========================================================================
  private createGeneratorAndSuyaProps(): void {
    // A. "I Pass My Neighbor" Tiger Generator outside Bet9ja shop
    this.generatorMesh = new THREE.Group();
    this.generatorMesh.position.set(8.5, 0.28, 24.0);

    // Tubular roll-cage frame (black steel)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.6,
      metalness: 0.7,
    });
    const frameGeo = new THREE.BoxGeometry(0.82, 0.62, 0.62);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 0.31;
    frame.castShadow = true;
    this.generatorMesh.add(frame);

    // Motor block & fuel tank (classic red/yellow tank with black motor core)
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Classic Tiger generator red tank
      roughness: 0.35,
      metalness: 0.2,
    });
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.52), tankMat);
    tank.position.y = 0.52;
    this.generatorMesh.add(tank);

    // Motor engine crankcase
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.45,
      metalness: 0.8,
    });
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.45), engineMat);
    engine.position.y = 0.24;
    this.generatorMesh.add(engine);

    // Recoil pull starter wheel
    const starter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12),
      frameMat
    );
    starter.rotation.z = Math.PI / 2;
    starter.position.set(-0.35, 0.25, 0);
    this.generatorMesh.add(starter);

    // Small chrome exhaust pipe
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.3,
      metalness: 0.85,
    });
    const exhaust = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8),
      exhaustMat
    );
    exhaust.position.set(0.28, 0.42, 0.22);
    exhaust.rotation.x = 0.2;
    this.generatorMesh.add(exhaust);

    this.group.add(this.generatorMesh);

    // B. Mama Put Outdoor Suya Charcoal Barbecue Drum Grill
    const suyaGroup = new THREE.Group();
    suyaGroup.position.set(-8.8, 0.28, 16.5);

    // Half oil-drum barbecue grill (black scorched steel)
    const drumGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 16, 1, false, 0, Math.PI);
    const drumMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.75,
      metalness: 0.4,
    });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.rotation.z = Math.PI / 2;
    drum.rotation.x = Math.PI;
    drum.position.y = 0.75;
    drum.castShadow = true;
    suyaGroup.add(drum);

    // 4 metal angle-iron legs
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6);
    for (let lx of [-0.45, 0.45]) {
      for (let lz of [-0.28, 0.28]) {
        const leg = new THREE.Mesh(legGeo, frameMat);
        leg.position.set(lx, 0.375, lz);
        leg.castShadow = true;
        suyaGroup.add(leg);
      }
    }

    // Glowing hot charcoal ember bed
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xff3b00,
      emissiveIntensity: 0.85,
      roughness: 0.9,
    });
    const embers = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.65), emberMat);
    embers.position.set(0, 0.74, 0);
    suyaGroup.add(embers);

    // Wire grill grate
    const grateMat = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.35,
      metalness: 0.85,
      wireframe: true,
    });
    const grate = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75, 12, 8), grateMat);
    grate.rotation.x = -Math.PI / 2;
    grate.position.set(0, 0.82, 0);
    suyaGroup.add(grate);

    this.group.add(suyaGroup);
  }

  // =========================================================================
  // 4. SMOKE & EXHAUST PARTICLES SYSTEM
  // =========================================================================
  private createSmokeSystem(): void {
    this.smokeGeometry = new THREE.BufferGeometry();
    this.smokePositions = new Float32Array(this.smokeCount * 3);
    this.smokeVelocities = new Float32Array(this.smokeCount * 3);
    this.smokeLifetimes = new Float32Array(this.smokeCount * 2); // [currentAge, maxAge]

    // Generator exhaust point: (8.78, 0.70, 24.22)
    // Suya grill point: (-8.8, 1.10, 16.5)
    for (let i = 0; i < this.smokeCount; i++) {
      const isGenerator = i < this.smokeCount / 2;
      const originX = isGenerator ? 8.78 : -8.8;
      const originY = isGenerator ? 0.70 : 1.12;
      const originZ = isGenerator ? 24.22 : 16.5;

      this.smokePositions[i * 3] = originX + (Math.random() - 0.5) * 0.15;
      this.smokePositions[i * 3 + 1] = originY + Math.random() * 0.8;
      this.smokePositions[i * 3 + 2] = originZ + (Math.random() - 0.5) * 0.15;

      this.smokeVelocities[i * 3] = 0.15 + (Math.random() - 0.5) * 0.15; // Drift with wind
      this.smokeVelocities[i * 3 + 1] = 0.55 + Math.random() * 0.35;      // Rise upward
      this.smokeVelocities[i * 3 + 2] = 0.25 + (Math.random() - 0.5) * 0.2;

      this.smokeLifetimes[i * 2] = Math.random() * 2.5; // Initial progress
      this.smokeLifetimes[i * 2 + 1] = 2.5 + Math.random() * 1.5; // Max lifespan
    }

    this.smokeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.smokePositions, 3)
    );

    const smokeTexture = createSmokeParticleTexture(64);

    const smokeMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.95,
      map: smokeTexture,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    this.smokePoints = new THREE.Points(this.smokeGeometry, smokeMaterial);
    this.group.add(this.smokePoints);
  }

  // =========================================================================
  // UPDATE LOOP (Delta Time & Dynamic Player Centering)
  // =========================================================================
  public update(delta: number, playerPos?: THREE.Vector3): void {
    this.elapsedTime += delta;
    const center = playerPos || new THREE.Vector3(0, 0, 0);

    // 1. Update Harmattan Dust Motes
    const halfX = this.dustBoxSize.x / 2;
    const halfZ = this.dustBoxSize.z / 2;
    const dPos = this.dustPositions;
    const dVel = this.dustVelocities;

    for (let i = 0; i < this.dustCount; i++) {
      const idx = i * 3;
      // Gentle wind drift + subtle sine sway
      const sway = Math.sin(this.elapsedTime * 1.5 + i) * 0.1;
      dPos[idx] += (dVel[idx] + sway) * delta;
      dPos[idx + 1] += dVel[idx + 1] * delta;
      dPos[idx + 2] += dVel[idx + 2] * delta;

      // Wrap around relative to player bounding volume
      if (dPos[idx] > center.x + halfX) dPos[idx] = center.x - halfX;
      else if (dPos[idx] < center.x - halfX) dPos[idx] = center.x + halfX;

      if (dPos[idx + 1] > this.dustBoxSize.y) dPos[idx + 1] = 0.5;
      else if (dPos[idx + 1] < 0.5) dPos[idx + 1] = this.dustBoxSize.y;

      if (dPos[idx + 2] > center.z + halfZ) dPos[idx + 2] = center.z - halfZ;
      else if (dPos[idx + 2] < center.z - halfZ) dPos[idx + 2] = center.z + halfZ;
    }
    this.dustGeometry.attributes.position.needsUpdate = true;

    // 2. Generator subtle running vibration
    if (this.generatorMesh) {
      this.genVibrationTimer += delta * 45;
      this.generatorMesh.position.y = 0.28 + Math.sin(this.genVibrationTimer) * 0.003;
      this.generatorMesh.rotation.z = Math.cos(this.genVibrationTimer * 0.8) * 0.004;
    }

    // 3. Smoke Particles Update
    const sPos = this.smokePositions;
    const sVel = this.smokeVelocities;

    for (let i = 0; i < this.smokeCount; i++) {
      const isGenerator = i < this.smokeCount / 2;
      const originX = isGenerator ? 8.78 : -8.8;
      const originY = isGenerator ? 0.70 : 1.12;
      const originZ = isGenerator ? 24.22 : 16.5;

      this.smokeLifetimes[i * 2] += delta;

      // Respawn when exceeding max lifespan
      if (this.smokeLifetimes[i * 2] >= this.smokeLifetimes[i * 2 + 1]) {
        this.smokeLifetimes[i * 2] = 0;
        sPos[i * 3] = originX + (Math.random() - 0.5) * 0.12;
        sPos[i * 3 + 1] = originY;
        sPos[i * 3 + 2] = originZ + (Math.random() - 0.5) * 0.12;
      } else {
        // Rise and disperse
        sPos[i * 3] += sVel[i * 3] * delta;
        sPos[i * 3 + 1] += sVel[i * 3 + 1] * delta;
        sPos[i * 3 + 2] += sVel[i * 3 + 2] * delta;
      }
    }
    this.smokeGeometry.attributes.position.needsUpdate = true;

    // 4. Subtle water puddle surface tension / ripple oscillation
    const ripple = 0.04 + Math.sin(this.elapsedTime * 2.0) * 0.015;
    for (const mat of this.puddleMaterials) {
      mat.roughness = ripple;
    }

    // 5. Ambient Tiger Generator Sound Attenuation
    if (playerPos) {
      const dist = Math.hypot(playerPos.x - 8.5, playerPos.z - 24.0);
      SoundEngine.getInstance().updateAmbientGenerator(dist);
    }
  }

  public setDustIntensity(opacity: number): void {
    if (this.dustPoints && this.dustPoints.material) {
      (this.dustPoints.material as THREE.PointsMaterial).opacity = opacity;
    }
  }

  public setPuddlesVisible(visible: boolean): void {
    this.puddlesGroup.visible = visible;
  }
}
