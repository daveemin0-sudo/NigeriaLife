import * as THREE from 'three';
import type { InteriorNPCDef } from './InteriorTypes';

export class InteriorNPCMesh {
  public group: THREE.Group;
  public def: InteriorNPCDef;
  private headMesh: THREE.Mesh;
  private torsoMesh: THREE.Mesh;
  private animOffset: number = Math.random() * Math.PI * 2;

  constructor(def: InteriorNPCDef) {
    this.def = def;
    this.group = new THREE.Group();
    this.group.name = `interior_npc_${def.id}`;
    this.group.position.copy(def.relativePosition);
    this.group.rotation.y = def.rotationY;

    const skinColor = def.skinColor ?? 0x5a3825; // Rich Nigerian melanated skin tone
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    const outfitMat = new THREE.MeshStandardMaterial({ color: def.outfitColor, roughness: 0.6 });
    const darkPantsMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: def.hairColor ?? 0x09090b, roughness: 0.9 });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.32);
    this.torsoMesh = new THREE.Mesh(torsoGeo, outfitMat);
    this.torsoMesh.position.y = 1.05;
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    // 2. Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.38, 0.35);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.y = 1.58;
    this.headMesh.castShadow = true;
    this.group.add(this.headMesh);

    // Hair cap
    const hairGeo = new THREE.BoxGeometry(0.37, 0.12, 0.37);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.76;
    this.group.add(hair);

    // 3. Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.65, 0.16);
    const armL = new THREE.Mesh(armGeo, outfitMat);
    armL.position.set(-0.36, 1.05, 0);
    this.group.add(armL);

    const armR = new THREE.Mesh(armGeo, outfitMat);
    armR.position.set(0.36, 1.05, 0);
    this.group.add(armR);

    // Hands
    const handGeo = new THREE.BoxGeometry(0.12, 0.14, 0.12);
    const handL = new THREE.Mesh(handGeo, skinMat);
    handL.position.set(-0.36, 0.68, 0);
    this.group.add(handL);

    const handR = new THREE.Mesh(handGeo, skinMat);
    handR.position.set(0.36, 0.68, 0);
    this.group.add(handR);

    // 4. Legs & Shoes
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const legL = new THREE.Mesh(legGeo, darkPantsMat);
    legL.position.set(-0.15, 0.35, 0);
    this.group.add(legL);

    const legR = new THREE.Mesh(legGeo, darkPantsMat);
    legR.position.set(0.15, 0.35, 0);
    this.group.add(legR);

    // 5. Special accessories
    if (def.hasStethoscope) {
      // Doctor's Stethoscope around neck
      const stethMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
      const stethLoop = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 16), stethMat);
      stethLoop.rotation.x = Math.PI / 3;
      stethLoop.position.set(0, 1.35, 0.12);
      this.group.add(stethLoop);

      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 }));
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, 1.15, 0.17);
      this.group.add(disc);
    }

    if (def.hasPoliceCap) {
      // Police Peaked Cap
      const capMat = new THREE.MeshStandardMaterial({ color: 0x09090b });
      const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.18), capMat);
      capVisor.position.set(0, 1.72, 0.22);
      this.group.add(capVisor);

      const badgeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Gold Nigeria Police crest
      const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), badgeMat);
      badge.position.set(0, 1.76, 0.19);
      this.group.add(badge);
    }

    if (def.hasChefHat) {
      // Mama Put White Toque / Chef headwrap
      const hatMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.35, 12), hatMat);
      toque.position.set(0, 1.9, 0);
      this.group.add(toque);
    }

    if (def.hasTie) {
      // Bank Executive Necktie
      const tieMat = new THREE.MeshStandardMaterial({ color: 0x991b1b }); // Deep crimson red tie
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.38, 0.03), tieMat);
      tie.position.set(0, 1.18, 0.17);
      this.group.add(tie);
    }

    // Role Indicator Badge floating over head
    const roleIcon = this.getRoleIcon(def.role);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect(0, 0, 256, 64, 16);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.roundRect(2, 2, 252, 60, 14);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${roleIcon} ${def.name}`, 128, 28);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(def.title, 128, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.y = 2.2;
    this.group.add(sprite);
  }

  private getRoleIcon(role: string): string {
    switch (role.toLowerCase()) {
      case 'doctor': return '🩺';
      case 'nurse': return '💉';
      case 'pharmacist': return '💊';
      case 'bank_manager': return '💼';
      case 'teller': return '🏧';
      case 'security': return '🛡️';
      case 'chef': return '🍲';
      case 'waiter': return '🍽️';
      case 'police_sergeant': return '👮';
      case 'police_officer': return '🚔';
      case 'inmate': return '⛓️';
      default: return '👤';
    }
  }

  public update(_delta: number, time: number): void {
    // Subtle breathing animation
    const breath = Math.sin(time * 2 + this.animOffset) * 0.02;
    this.torsoMesh.position.y = 1.05 + breath;
    this.headMesh.position.y = 1.58 + breath;
  }
}
