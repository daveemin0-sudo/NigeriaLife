import * as THREE from 'three';
import { HumanMeshBuilder, type HumanRig } from '../../graphics/HumanMeshBuilder';

export type NPCType =
  | 'office_worker'
  | 'student'
  | 'market_seller'
  | 'food_seller'
  | 'mechanic'
  | 'security_guard'
  | 'police'
  | 'driver'
  | 'shopper'
  | 'construction_worker'
  | 'pedestrian'
  | 'elderly_person';

export type NPCBehavior = 'walk' | 'stand' | 'wait' | 'talk' | 'gather';

export interface PopulatedNPC {
  group: THREE.Group;
  rig: HumanRig;
  type: NPCType;
  behavior: NPCBehavior;
  walkDir: number;
  speed: number;
  animTime: number;
  baseX: number;
  baseZ: number;
  minZ: number;
  maxZ: number;
}

const NAIJA_USERNAMES = [
  'GpOfGoodLife',
  'VICTOR0326',
  'softboySoma',
  'ka_y_la',
  'simplysammie001',
  'ininmore',
  'nuranabdulbasit',
  'grenny007',
  'BigS_am',
  'zay_ne',
  'chichi_glow',
  'tunde_lagos',
  'amara_vibes',
  'kunle_tech',
  'funke_owambe',
  'emeka_invest',
  'ijeoma_style',
  'fola_sound',
  'kemi_blossom',
  'segun_odds',
];

export class CityPopulation {
  public group: THREE.Group;
  private crowd: PopulatedNPC[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.spawnPopulation();
  }

  private spawnPopulation(): void {
    const archetypes: NPCType[] = [
      'office_worker',
      'student',
      'market_seller',
      'food_seller',
      'mechanic',
      'security_guard',
      'police',
      'driver',
      'shopper',
      'construction_worker',
      'pedestrian',
      'elderly_person',
    ];

    // Spawn 70 distinct anatomical pedestrians
    for (let i = 0; i < 70; i++) {
      const type = archetypes[i % archetypes.length];
      const isWest = i % 2 === 0;

      let x: number;
      let z: number;
      let behavior: NPCBehavior = 'walk';

      if (i % 6 === 0) {
        // Market shoppers standing under roadside umbrellas
        x = isWest ? -10.2 : 10.2;
        z = -75 + (i / 70) * 160 + (Math.random() - 0.5) * 4;
        behavior = 'stand';
      } else if (i % 7 === 0) {
        // Chatting pairs on sidewalk
        x = isWest ? -8.6 : 8.6;
        z = -100 + (i / 70) * 200;
        behavior = 'talk';
      } else {
        // Normal sidewalk pedestrians - grounded perfectly on sidewalks
        x = isWest ? -8.4 - Math.random() * 2.0 : 8.4 + Math.random() * 2.0;
        z = -115 + (i / 70) * 230 + (Math.random() - 0.5) * 6;
        behavior = 'walk';
      }

      const npc = this.createNPC(type, behavior, x, z, i);
      npc.group.position.y = 0;
      this.crowd.push(npc);
      this.group.add(npc.group);
    }
  }

  private createNPC(type: NPCType, behavior: NPCBehavior, x: number, z: number, index: number): PopulatedNPC {
    const isFemale = index % 2 === 1; // Alternating 50/50 female and male
    const username = NAIJA_USERNAMES[index % NAIJA_USERNAMES.length];

    let outfit: 'engineer_vest' | 'senator' | 'blue_dress' | 'peplum_skirt' | 'casual_tee' | 'casual_blouse' = 'casual_tee';
    let hairstyle: any = isFemale ? 'bob_wig' : 'fade';
    let outfitColor = 0x2563eb;

    if (isFemale) {
      if (index % 4 === 1) {
        outfit = 'blue_dress';
        hairstyle = 'bob_wig';
        outfitColor = 0x2563eb; // Royal blue gown (Image 3)
      } else if (index % 4 === 3) {
        outfit = 'peplum_skirt';
        hairstyle = 'braids';
        outfitColor = 0xdc2626; // Chic crimson peplum
      } else {
        outfit = 'casual_blouse';
        hairstyle = 'gele';
        outfitColor = 0xd97706; // Golden ankara
      }
    } else {
      if (type === 'construction_worker' || index % 3 === 0) {
        outfit = 'engineer_vest';
        hairstyle = 'hardhat';
        outfitColor = 0xf97316; // Orange safety vest & blue hardhat (Image 3)
      } else if (type === 'office_worker') {
        outfit = 'senator';
        hairstyle = 'fila';
        outfitColor = 0x1e3a8a; // Navy senator suit
      } else {
        outfit = 'casual_tee';
        hairstyle = 'short_crop';
        outfitColor = 0x10b981; // Green casual tee
      }
    }

    const rig = HumanMeshBuilder.createHuman({
      gender: isFemale ? 'female' : 'male',
      username,
      outfit,
      hairstyle,
      outfitColor,
    });

    rig.group.position.set(x, 0, z);

    return {
      group: rig.group,
      rig,
      type,
      behavior,
      walkDir: Math.random() > 0.5 ? 1 : -1,
      speed: 1.1 + Math.random() * 0.7,
      animTime: Math.random() * 10,
      baseX: x,
      baseZ: z,
      minZ: z - 25,
      maxZ: z + 25,
    };
  }

  public update(delta: number, playerZ: number = 0): void {
    for (const npc of this.crowd) {
      // Proximity check: only update if near player (within 90 meters)
      const distZ = Math.abs(npc.group.position.z - playerZ);
      if (distZ > 90) {
        npc.group.visible = false;
        continue;
      }
      npc.group.visible = true;

      npc.animTime += delta;

      if (npc.behavior === 'walk') {
        npc.group.position.z += npc.walkDir * npc.speed * delta;
        npc.group.position.y = 0; // Grounded on street sidewalk
        npc.rig.updateAnimation(npc.animTime, true);

        // Turn around at path bounds
        if (npc.group.position.z > npc.maxZ) {
          npc.walkDir = -1;
          npc.group.rotation.y = Math.PI;
        } else if (npc.group.position.z < npc.minZ) {
          npc.walkDir = 1;
          npc.group.rotation.y = 0;
        }
      } else if (npc.behavior === 'talk') {
        npc.group.rotation.y = Math.sin(npc.animTime * 1.5) * 0.15;
        npc.rig.updateAnimation(npc.animTime, false);
      } else {
        npc.rig.updateAnimation(npc.animTime, false);
      }
    }
  }
}
