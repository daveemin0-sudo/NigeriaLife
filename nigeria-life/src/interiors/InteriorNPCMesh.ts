import * as THREE from 'three';
import type { InteriorNPCDef } from './InteriorTypes';
import { HumanMeshBuilder, type HumanRig, type Gender } from '../graphics/HumanMeshBuilder';
import { Actor } from '../interactions/Actor';
import { InteractionDirector } from '../interactions/InteractionDirector';

/**
 * InteriorNPCMesh
 * Builds Character 2.0 fully articulated anatomical human figures for NigeriaLife interiors.
 * Replaces legacy box characters with distinct male/female silhouettes, occupation-specific attire,
 * medical coats, pilot uniforms, university lecturer suits, and student outfits.
 */
export class InteriorNPCMesh {
  public group: THREE.Group;
  public def: InteriorNPCDef;
  public humanRig: HumanRig;
  /** Lets scripted interactions (serving, waving back) direct this character */
  public actor: Actor;
  private animOffset: number = Math.random() * Math.PI * 2;

  constructor(def: InteriorNPCDef) {
    this.def = def;
    this.group = new THREE.Group();
    this.group.name = `interior_npc_${def.id}`;
    this.group.position.copy(def.relativePosition);
    this.group.rotation.y = def.rotationY;

    // Determine gender based on role and name
    const lowerRole = (def.role || '').toLowerCase();
    const lowerName = (def.name || '').toLowerCase();
    const isFemale = def.gender ? def.gender === 'female' :
      lowerRole.includes('nurse') ||
      lowerName.includes('chidinma') ||
      lowerName.includes('kemi') ||
      lowerName.includes('ngozi') ||
      lowerName.includes('nkechi') ||
      lowerName.includes('amaka') ||
      lowerName.includes('blessing') ||
      lowerRole.includes('teller') ||
      lowerName.includes('aunty');

    const gender: Gender = isFemale ? 'female' : 'male';

    // Skin tone (rich Nigerian melanin palette)
    const skinHex = def.skinColor
      ? '#' + def.skinColor.toString(16).padStart(6, '0')
      : isFemale ? '#5c3722' : '#4a2c1d';

    // Map role to authentic occupation outfit
    let outfit: any = 'casual_tee';
    let hairstyle: any = isFemale ? 'bob_wig' : 'fade';
    let hasStethoscope = false;
    let hasTie = false;
    let hasBackpack = false;

    if (lowerRole.includes('doctor') || def.hasStethoscope) {
      outfit = 'doctor_coat';
      hairstyle = isFemale ? 'braids' : 'short_crop';
      hasStethoscope = true;
      hasTie = true;
    } else if (lowerRole.includes('nurse')) {
      outfit = 'nurse_scrubs';
      hairstyle = 'bob_wig';
    } else if (lowerRole.includes('pharmacist')) {
      outfit = 'doctor_coat';
      hairstyle = 'gele';
    } else if (lowerRole.includes('pilot') || lowerRole.includes('captain')) {
      outfit = 'pilot_uniform';
      hairstyle = 'pilot_cap';
      hasTie = true;
    } else if (lowerRole.includes('police') || lowerRole.includes('sergeant') || def.hasPoliceCap) {
      outfit = 'security_uniform';
      hairstyle = 'police_cap';
    } else if (lowerRole.includes('security') || lowerRole.includes('faan') || lowerRole.includes('officer')) {
      outfit = 'security_uniform';
      hairstyle = isFemale ? 'braids' : 'fade';
    } else if (lowerRole.includes('lecturer') || lowerRole.includes('professor') || lowerName.includes('prof')) {
      outfit = 'lecturer_suit';
      hairstyle = 'short_crop';
      hasTie = true;
    } else if (lowerRole.includes('student') || lowerName.includes('femi') || lowerName.includes('chidinma')) {
      outfit = 'student_casual';
      hairstyle = isFemale ? 'braids' : 'afro';
      hasBackpack = true;
    } else if (lowerRole.includes('chef') || lowerRole.includes('cook') || def.hasChefHat) {
      outfit = 'chef_attire';
      hairstyle = 'chef_toque';
    } else if (lowerRole.includes('bank_manager') || lowerRole.includes('manager')) {
      outfit = 'senator';
      hairstyle = 'short_crop';
      hasTie = true;
    } else if (lowerRole.includes('teller')) {
      outfit = 'casual_blouse';
      hairstyle = 'bob_wig';
    }

    // Build the anatomical human rig
    this.humanRig = HumanMeshBuilder.createHuman({
      gender,
      username: def.name,
      skinTone: skinHex,
      outfit,
      outfitColor: def.outfitColor,
      hairstyle,
      hasStethoscope: hasStethoscope || def.hasStethoscope,
      hasTie: hasTie || def.hasTie,
      hasBackpack,
    });

    this.group.add(this.humanRig.group);

    // Profession identification badge over head
    const roleIcon = this.getRoleIcon(def.role);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
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
    ctx.fillText(def.title || def.role, 128, 50);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.8, 0.45, 1);
    sprite.position.y = isFemale ? 2.3 : 2.4;
    this.group.add(sprite);

    this.actor = InteractionDirector.get().register(
      new Actor({ id: `npc:${def.id}`, name: def.name, root: this.group, getRig: () => this.humanRig }),
      `interior_npc_${def.id}`
    );
  }

  private getRoleIcon(role: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('doctor')) return '🩺';
    if (r.includes('nurse')) return '💉';
    if (r.includes('pharmacist')) return '💊';
    if (r.includes('pilot') || r.includes('captain')) return '✈️';
    if (r.includes('lecturer') || r.includes('prof')) return '📚';
    if (r.includes('student')) return '🎓';
    if (r.includes('bank_manager') || r.includes('manager')) return '💼';
    if (r.includes('teller')) return '🏧';
    if (r.includes('security') || r.includes('faan')) return '🛡️';
    if (r.includes('chef') || r.includes('cook')) return '🍲';
    if (r.includes('waiter')) return '🍽️';
    if (r.includes('police')) return '👮';
    return '👤';
  }

  public update(_delta: number, time: number): void {
    if (this.actor.scripted) return;
    // Natural idle breathing & postural sway animation
    this.humanRig.updateAnimation(time + this.animOffset, false);
  }
}
