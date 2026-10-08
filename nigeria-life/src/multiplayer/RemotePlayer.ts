import * as THREE from 'three';
import type { PlayerNetState } from './types';
import { ATTIRE_PRESETS } from '../player/CharacterCustomization';
import { createColorCanvasTexture } from '../utils/TextureUtils';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';

export class RemotePlayer {
  public id: string;
  public mesh: THREE.Group;
  public targetPosition: THREE.Vector3;
  public targetRotationY: number = 0;
  public isMoving: boolean = false;
  public currentEmote: string = 'idle';

  private walkTime: number = 0;
  private bodyMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private headwearGroup!: THREE.Group;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private leftLeg!: THREE.Mesh;
  private rightLeg!: THREE.Mesh;

  private skinMat!: THREE.MeshStandardMaterial;
  private attireMat!: THREE.MeshStandardMaterial;
  private trousersMat!: THREE.MeshStandardMaterial;

  // Nameplate & Chat Bubble
  private nameplateSprite!: THREE.Sprite;
  private chatBubbleSprite!: THREE.Sprite;
  private chatBubbleTimer: number = 0;

  constructor(initialState: PlayerNetState) {
    this.id = initialState.id;
    this.mesh = new THREE.Group();
    this.targetPosition = new THREE.Vector3(
      initialState.position.x,
      initialState.position.y,
      initialState.position.z
    );
    this.mesh.position.copy(this.targetPosition);
    this.targetRotationY = initialState.rotationY;
    this.mesh.rotation.y = this.targetRotationY;

    this.createCharacterMesh(initialState);
    this.createNameplate(initialState.name);
    this.createChatBubble();
    this.applyState(initialState);

    // Tag remote players with STREET layer so they never show inside an interior
    this.mesh.traverse((child) => {
      child.layers.set(RENDER_LAYERS.STREET);
    });
  }

  private createCharacterMesh(state: PlayerNetState): void {
    // 1. Shadow
    const shadowGeo = new THREE.CircleGeometry(0.55, 16);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.mesh.add(shadow);

    // 2. Base Materials
    this.skinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(state.config.skinTone || '#4a2e1d'),
      roughness: 0.7,
    });

    const preset = ATTIRE_PRESETS[state.config.attire] || ATTIRE_PRESETS.agbada_green;
    this.attireMat = new THREE.MeshStandardMaterial({
      color: preset.color,
      roughness: 0.6,
    });

    this.trousersMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(state.config.trousersColor || '#ffffff'),
      roughness: 0.8,
    });

    // 3. Torso
    const bodyGeo = new THREE.BoxGeometry(0.72, 0.92, 0.46);
    this.bodyMesh = new THREE.Mesh(bodyGeo, this.attireMat);
    this.bodyMesh.position.y = 1.05;
    this.mesh.add(this.bodyMesh);

    // 4. Head
    const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
    this.headMesh = new THREE.Mesh(headGeo, this.skinMat);
    this.headMesh.position.y = 1.7;
    this.mesh.add(this.headMesh);

    // 5. Headwear Group
    this.headwearGroup = new THREE.Group();
    this.headwearGroup.position.y = 1.7;
    this.mesh.add(this.headwearGroup);
    this.rebuildHeadwear(state.config.headwear);

    // 6. Arms
    const armGeo = new THREE.BoxGeometry(0.2, 0.65, 0.2);
    this.leftArm = new THREE.Mesh(armGeo, this.attireMat);
    this.leftArm.position.set(-0.48, 1.0, 0);
    this.mesh.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.attireMat);
    this.rightArm.position.set(0.48, 1.0, 0);
    this.mesh.add(this.rightArm);

    // 7. Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.7, 0.24);
    this.leftLeg = new THREE.Mesh(legGeo, this.trousersMat);
    this.leftLeg.position.set(-0.2, 0.4, 0);
    this.mesh.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, this.trousersMat);
    this.rightLeg.position.set(0.2, 0.4, 0);
    this.mesh.add(this.rightLeg);
  }

  private rebuildHeadwear(headwearType: string): void {
    while (this.headwearGroup.children.length > 0) {
      this.headwearGroup.remove(this.headwearGroup.children[0]);
    }

    if (headwearType === 'fila_cream') {
      const filaGeo = new THREE.BoxGeometry(0.44, 0.24, 0.44);
      const filaMat = new THREE.MeshStandardMaterial({ color: 0xfaf5ef, roughness: 0.5 });
      const fila = new THREE.Mesh(filaGeo, filaMat);
      fila.position.y = 0.26;
      this.headwearGroup.add(fila);
    } else if (headwearType === 'igbo_red_cap') {
      const capGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16);
      const capMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 0.26;
      this.headwearGroup.add(cap);

      const featherGeo = new THREE.BoxGeometry(0.04, 0.35, 0.08);
      const featherMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const feather = new THREE.Mesh(featherGeo, featherMat);
      feather.position.set(0.22, 0.38, 0.05);
      feather.rotation.z = -0.3;
      this.headwearGroup.add(feather);
    } else if (headwearType === 'afro_hair') {
      const hairGeo = new THREE.BoxGeometry(0.46, 0.25, 0.46);
      const hairMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const hair = new THREE.Mesh(hairGeo, hairMat);
      hair.position.y = 0.25;
      this.headwearGroup.add(hair);
    }
  }

  private createNameplate(name: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(18, 20, 26, 0.85)';
    ctx.roundRect(16, 12, 224, 40, 20);
    ctx.fill();

    ctx.strokeStyle = '#00d26a';
    ctx.lineWidth = 3;
    ctx.roundRect(16, 12, 224, 40, 20);
    ctx.stroke();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🇳🇬 ${name}`, 128, 32);

    const texture = createColorCanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.nameplateSprite = new THREE.Sprite(spriteMat);
    this.nameplateSprite.position.set(0, 2.45, 0);
    this.nameplateSprite.scale.set(1.8, 0.45, 1);
    this.mesh.add(this.nameplateSprite);
  }

  private createChatBubble(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const texture = createColorCanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    this.chatBubbleSprite = new THREE.Sprite(spriteMat);
    this.chatBubbleSprite.position.set(0, 3.1, 0);
    this.chatBubbleSprite.scale.set(2.8, 0.7, 1);
    this.chatBubbleSprite.visible = false;
    this.mesh.add(this.chatBubbleSprite);
  }

  public showSpeechBubble(text: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.roundRect(16, 16, 480, 80, 20);
    ctx.fill();

    ctx.strokeStyle = '#008751';
    ctx.lineWidth = 4;
    ctx.roundRect(16, 16, 480, 80, 20);
    ctx.stroke();

    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.length > 30 ? text.substring(0, 28) + '...' : text, 256, 56);

    this.chatBubbleSprite.material.map = createColorCanvasTexture(canvas);
    this.chatBubbleSprite.material.map.needsUpdate = true;
    this.chatBubbleSprite.visible = true;
    this.chatBubbleTimer = 5.0; // Show for 5 seconds
  }

  public applyState(state: PlayerNetState): void {
    this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    this.targetRotationY = state.rotationY;
    this.isMoving = state.isMoving;
    this.currentEmote = state.currentEmote;

    // Update visuals if customized
    this.skinMat.color.set(state.config.skinTone || '#4a2e1d');
    const preset = ATTIRE_PRESETS[state.config.attire] || ATTIRE_PRESETS.agbada_green;
    this.attireMat.color.setHex(preset.color);
    this.trousersMat.color.set(state.config.trousersColor || '#ffffff');
    this.rebuildHeadwear(state.config.headwear);

    if (state.chatBubble && Date.now() - state.chatBubble.timestamp < 5000) {
      this.showSpeechBubble(state.chatBubble.text);
    }
  }

  public update(delta: number): void {
    // Smooth position interpolation
    this.mesh.position.lerp(this.targetPosition, Math.min(delta * 12, 1));

    // Smooth rotation interpolation
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.targetRotationY, 0.2);

    // Chat bubble timer
    if (this.chatBubbleTimer > 0) {
      this.chatBubbleTimer -= delta;
      if (this.chatBubbleTimer <= 0) {
        this.chatBubbleSprite.visible = false;
      }
    }

    // Walking animation cycle
    if (this.isMoving) {
      this.walkTime += delta * 14;
      const legAngle = Math.sin(this.walkTime) * 0.55;
      const armAngle = -legAngle * 0.55;

      this.leftLeg.rotation.x = legAngle;
      this.rightLeg.rotation.x = -legAngle;
      this.leftArm.rotation.x = armAngle;
      this.rightArm.rotation.x = -armAngle;

      this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(this.walkTime * 2)) * 0.08;
      this.headMesh.position.y = 1.7 + Math.abs(Math.sin(this.walkTime * 2)) * 0.06;
      this.headwearGroup.position.y = 1.7 + Math.abs(Math.sin(this.walkTime * 2)) * 0.06;
    } else if (this.currentEmote === 'zanku') {
      this.walkTime += delta * 8;
      const kick = Math.sin(this.walkTime * 2.2);
      this.leftLeg.rotation.x = kick * 0.8;
      this.rightLeg.rotation.x = -kick * 0.8;
      this.leftArm.rotation.x = -kick * 0.9;
      this.rightArm.rotation.x = kick * 0.9;
      this.bodyMesh.position.y = 1.05 + Math.abs(Math.sin(this.walkTime * 2)) * 0.15;
    } else if (this.currentEmote === 'groove') {
      this.walkTime += delta * 8;
      const sway = Math.sin(this.walkTime * 1.5) * 0.25;
      this.bodyMesh.rotation.z = sway;
      this.leftArm.rotation.z = -0.3 + sway;
      this.rightArm.rotation.z = 0.3 + sway;
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
    } else {
      // Idle
      this.leftArm.rotation.set(0, 0, 0);
      this.rightArm.rotation.set(0, 0, 0);
      this.leftLeg.rotation.set(0, 0, 0);
      this.rightLeg.rotation.set(0, 0, 0);
      this.bodyMesh.position.y = 1.05 + Math.sin(Date.now() * 0.003) * 0.02;
      this.headMesh.position.y = 1.7;
      this.headwearGroup.position.y = 1.7;
    }
  }
}
