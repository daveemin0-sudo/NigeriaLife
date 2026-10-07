import * as THREE from 'three';
import {
  type CharacterConfig,
  CharacterStorage,
  ATTIRE_PRESETS,
  type EmoteType,
} from './CharacterCustomization';
import { SignageLibrary } from '../materials/SignageLibrary';

export class Player {
  public mesh: THREE.Group;
  public targetPosition: THREE.Vector3 | null = null;
  public speed: number = 7.5;
  public isMoving: boolean = false;
  public currentEmote: EmoteType = 'idle';
  public emoteTimer: number = 0;
  public isDriving: boolean = false;
  public currentVehicle: any = null;

  // Configuration
  public config: CharacterConfig;

  // Animation state
  private animTime: number = 0;

  // Meshes & Materials for live customization
  private bodyMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private headwearGroup!: THREE.Group;
  private shadesMesh!: THREE.Mesh;
  private goldChainMesh!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;

  private skinMaterial!: THREE.MeshStandardMaterial;
  private attireMaterial!: THREE.MeshStandardMaterial;
  private trousersMaterial!: THREE.MeshStandardMaterial;

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 5); // Start on Broad Street

    // Load saved or default character configuration
    this.config = CharacterStorage.load();

    this.createCharacterMesh();
    this.applyCustomization(this.config);
  }

  public get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  private createCharacterMesh(): void {
    // 1. Shadow disc underneath
    const shadowGeo = new THREE.CircleGeometry(0.55, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.mesh.add(shadow);

    // 2. Base Materials
    this.skinMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.skinTone),
      roughness: 0.7,
    });

    const attirePreset = ATTIRE_PRESETS[this.config.attire];
    this.attireMaterial = new THREE.MeshStandardMaterial({
      color: attirePreset.color,
      roughness: 0.6,
    });

    this.trousersMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(this.config.trousersColor),
      roughness: 0.8,
    });

    // 3. Torso / Shirt / Agbada
    const bodyGeo = new THREE.BoxGeometry(0.72, 0.92, 0.46);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.attireMaterial);
    this.bodyMesh.position.y = 1.05;
    this.bodyMesh.castShadow = true;
    this.mesh.add(this.bodyMesh);

    // 4. Cuban Gold Chain Necklace
    const chainGeo = new THREE.TorusGeometry(0.24, 0.035, 8, 24);
    const chainMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });
    this.goldChainMesh = new THREE.Mesh(chainGeo, chainMat);
    this.goldChainMesh.rotation.x = Math.PI / 2.8;
    this.goldChainMesh.position.set(0, 1.45, 0.14);
    this.mesh.add(this.goldChainMesh);

    // 5. Head
    const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMaterial);
    this.headMesh.position.y = 1.7;
    this.headMesh.castShadow = true;
    this.mesh.add(this.headMesh);

    // 6. Headwear Group (Fila, Igbo Red Cap, Afro, etc.)
    this.headwearGroup = new THREE.Group();
    this.headwearGroup.position.y = 1.7;
    this.mesh.add(this.headwearGroup);
    this.rebuildHeadwear();

    // 7. Dark Sunglasses
    const shadesGeo = new THREE.BoxGeometry(0.38, 0.1, 0.1);
    const shadesMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.9,
      roughness: 0.1,
    });
    this.shadesMesh = new THREE.Mesh(shadesGeo, shadesMat);
    this.shadesMesh.position.set(0, 1.72, 0.22);
    this.mesh.add(this.shadesMesh);

    // 8. Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    this.leftArm = new THREE.Mesh(armGeo, this.attireMaterial);
    this.leftArm.position.set(-0.48, 1.0, 0);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.attireMaterial);
    this.rightArm.position.set(0.48, 1.0, 0);
    this.mesh.add(this.rightArm);

    // 9. Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    this.leftLeg = new THREE.Mesh(legGeo, this.trousersMaterial);
    this.leftLeg.position.set(-0.2, 0.4, 0);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, this.trousersMaterial);
    this.rightLeg.position.set(0.2, 0.4, 0);
    this.mesh.add(this.rightLeg);
  }

  private rebuildHeadwear(): void {
    // Clear previous headwear meshes
    while (this.headwearGroup.children.length > 0) {
      this.headwearGroup.remove(this.headwearGroup.children[0]);
    }

    if (this.config.headwear === 'fila_cream') {
      // Cream Fila (Yoruba folded cap)
      const filaGeo = new THREE.BoxGeometry(0.44, 0.24, 0.44);
      const filaMat = new THREE.MeshStandardMaterial({ color: 0xfaf5ef, roughness: 0.5 });
      const fila = new THREE.Mesh(filaGeo, filaMat);
      fila.position.y = 0.26;
      this.headwearGroup.add(fila);
    } else if (this.config.headwear === 'igbo_red_cap') {
      // Igbo Red Chief (Ozo) Cap with white eagle feather
      const capGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.26;
      this.headwearGroup.add(cap);

      // White feather stuck to side of cap
      const featherGeo = new THREE.BoxGeometry(0.04, 0.35, 0.08);
      const featherMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const feather = new THREE.Mesh(featherGeo, featherMat);
      feather.position.set(0.22, 0.38, 0.05);
      feather.rotation.z = -0.3;
      this.headwearGroup.add(feather);
    } else if (this.config.headwear === 'afro_hair') {
      // Clean Fade / Textured Afro Hair
      const hairGeo = new THREE.BoxGeometry(0.46, 0.25, 0.46);
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.y = 0.25;
      this.headwearGroup.add(hair);
    }
  }

  public applyCustomization(newConfig: CharacterConfig): void {
    this.config = { ...newConfig };
    CharacterStorage.save(this.config);

    // Update Skin Tone
    this.skinMaterial.color.set(this.config.skinTone);

    // Update Attire
    const preset = ATTIRE_PRESETS[this.config.attire];
    if (preset) {
      if (this.config.attire === 'ankara_gold') {
        const signLib = SignageLibrary.getInstance();
        this.attireMaterial.map = signLib.ankaraFabrics[0]?.map ?? null;
        this.attireMaterial.color.setHex(0xffffff);
      } else {
        this.attireMaterial.map = null;
        this.attireMaterial.color.setHex(preset.color);
      }
      this.attireMaterial.needsUpdate = true;
      this.trousersMaterial.color.set(preset.trousers);
    }

    // Update Headwear
    this.rebuildHeadwear();

    // Update Shades & Gold Chain
    this.shadesMesh.visible = this.config.hasShades;
    this.goldChainMesh.visible = this.config.hasGoldChain;
  }

  public playEmote(emote: EmoteType, durationSeconds: number = 3.5): void {
    this.currentEmote = emote;
    this.emoteTimer = durationSeconds;
    this.animTime = 0;
  }

  public setDestination(target: THREE.Vector3): void {
    this.targetPosition = new THREE.Vector3(target.x, 0, target.z);
    this.isMoving = true;
    this.currentEmote = 'walk';
  }

  public stopMoving(): void {
    this.targetPosition = null;
    this.isMoving = false;
    this.currentEmote = 'idle';
  }

  public update(delta: number, keys?: Record<string, boolean>): void {
    if (this.isDriving && this.currentVehicle) {
      this.mesh.position.copy(this.currentVehicle.mesh.position);
      this.mesh.rotation.y = this.currentVehicle.mesh.rotation.y;
      return;
    }

    // 0. Keyboard Walking Controls (WASD / Arrow Keys)
    const hasMoveKey =
      keys &&
      (keys['w'] ||
        keys['s'] ||
        keys['a'] ||
        keys['d'] ||
        keys['arrowup'] ||
        keys['arrowdown'] ||
        keys['arrowleft'] ||
        keys['arrowright']);

    if (hasMoveKey && !this.isDriving) {
      this.targetPosition = null;
      let moveX = 0;
      let moveZ = 0;
      if (keys['w'] || keys['arrowup']) moveZ -= 1;
      if (keys['s'] || keys['arrowdown']) moveZ += 1;
      if (keys['a'] || keys['arrowleft']) moveX -= 1;
      if (keys['d'] || keys['arrowright']) moveX += 1;

      if (moveX !== 0 || moveZ !== 0) {
        const moveDir = new THREE.Vector3(moveX, 0, moveZ).normalize();
        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 0.25);
        this.mesh.position.addScaledVector(moveDir, this.speed * delta);
        this.isMoving = true;
        this.currentEmote = 'walk';

        // Walk cycle animation
        this.animTime += delta * 14;
        const legAngle = Math.sin(this.animTime) * 0.55;
        const armAngle = -legAngle * 0.55;

        this.leftLeg.rotation.x = legAngle;
        this.rightLeg.rotation.x = -legAngle;
        this.leftArm.rotation.x = armAngle;
        this.rightArm.rotation.x = -armAngle;

        this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(this.animTime * 2)) * 0.08;
        this.headMesh.position.y = 1.7 + Math.abs(Math.sin(this.animTime * 2)) * 0.06;
        this.headwearGroup.position.y = 1.7 + Math.abs(Math.sin(this.animTime * 2)) * 0.06;
        return;
      }
    }

    // 1. Moving state (Point and Click)
    if (this.targetPosition && this.isMoving) {
      const currentPos = this.mesh.position;
      const direction = new THREE.Vector3().subVectors(this.targetPosition, currentPos);
      direction.y = 0;
      const distance = direction.length();

      const arriveTolerance = 0.15;
      if (distance <= arriveTolerance) {
        this.mesh.position.x = this.targetPosition.x;
        this.mesh.position.z = this.targetPosition.z;
        this.isMoving = false;
        this.targetPosition = null;
        this.currentEmote = 'idle';
      } else {
        // Rotate smoothly
        const targetAngle = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 0.2);

        // Move forward
        direction.normalize();
        const moveDist = Math.min(distance, this.speed * delta);
        this.mesh.position.addScaledVector(direction, moveDist);

        // Walk cycle animation
        this.animTime += delta * 14;
        const legAngle = Math.sin(this.animTime) * 0.55;
        const armAngle = -legAngle * 0.55;

        this.leftLeg.rotation.x = legAngle;
        this.rightLeg.rotation.x = -legAngle;
        this.leftArm.rotation.x = armAngle;
        this.rightArm.rotation.x = -armAngle;

        this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(this.animTime * 2)) * 0.08;
        this.headMesh.position.y = 1.7 + Math.abs(Math.sin(this.animTime * 2)) * 0.06;
        this.headwearGroup.position.y = 1.7 + Math.abs(Math.sin(this.animTime * 2)) * 0.06;
        return;
      }
    }

    // 2. Emote Timer handling
    if (this.emoteTimer > 0) {
      this.emoteTimer -= delta;
      if (this.emoteTimer <= 0) {
        this.currentEmote = 'idle';
      }
    }

    // 3. Emotes / Idle Animations
    this.animTime += delta * 8;

    if (this.currentEmote === 'zanku') {
      // Lively Naija Zanku / Legwork dance: kicking legs and pumping arms
      const kick = Math.sin(this.animTime * 2.2);
      this.leftLeg.rotation.x = kick * 0.8;
      this.rightLeg.rotation.x = -kick * 0.8;
      this.leftArm.rotation.x = -kick * 0.9;
      this.rightArm.rotation.x = kick * 0.9;
      this.mesh.rotation.y += Math.sin(this.animTime) * 0.03;
      this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(this.animTime * 2)) * 0.15;
    } else if (this.currentEmote === 'groove') {
      // Smooth Afrobeats shoulder sway & bounce
      const sway = Math.sin(this.animTime * 1.5) * 0.25;
      this.bodyMesh.rotation.z = sway;
      this.leftArm.rotation.z = -0.3 + sway;
      this.rightArm.rotation.z = 0.3 + sway;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(this.animTime * 1.5)) * 0.06;
    } else if (this.currentEmote === 'salute') {
      // Respectful Oga Salute / Bow
      this.rightArm.rotation.x = -2.1; // Hand raised to forehead
      this.rightArm.rotation.z = -0.4;
      this.leftArm.rotation.x = 0;
      this.leftArm.rotation.z = 0;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.bodyMesh.rotation.x = 0.12; // Slight bow
      this.bodyMesh.position.y = 1.05;
    } else {
      // Idle breathing
      this.leftArm.rotation.set(0, 0, 0);
      this.rightArm.rotation.set(0, 0, 0);
      this.leftLeg.rotation.set(0, 0, 0);
      this.rightLeg.rotation.set(0, 0, 0);
      this.bodyMesh.rotation.set(0, 0, 0);
      this.bodyMesh.position.y = 1.05 + Math.sin(Date.now() * 0.003) * 0.02;
      this.headMesh.position.y = 1.7;
      this.headwearGroup.position.y = 1.7;
    }
  }
}
