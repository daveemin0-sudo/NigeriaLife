import * as THREE from 'three';

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
  legL: THREE.Mesh;
  legR: THREE.Mesh;
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

export class CityPopulation {
  public group: THREE.Group;
  private crowd: PopulatedNPC[] = [];
  private static mats: Record<string, THREE.MeshStandardMaterial> = {};

  constructor() {
    this.group = new THREE.Group();
    this.spawnPopulation();
  }

  private static getMat(key: string, colorHex: number): THREE.MeshStandardMaterial {
    if (!this.mats[key]) {
      this.mats[key] = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.7,
      });
    }
    return this.mats[key];
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

    // Spawn 85 lightweight pedestrians along sidewalks, bridge and market stalls
    for (let i = 0; i < 85; i++) {
      const type = archetypes[i % archetypes.length];
      const isWest = i % 2 === 0;

      let x: number;
      let y = 0;
      let z: number;
      let behavior: NPCBehavior = 'walk';

      // Special cluster: Pedestrians walking across the overhead bridge!
      if (i >= 78) {
        x = -8.0 + (i - 78) * 2.3;
        y = 5.4; // Bridge deck height!
        z = 28.0 + (Math.random() - 0.5) * 1.5;
        behavior = i % 2 === 0 ? 'walk' : 'stand';
      } else if (i % 6 === 0) {
        // Market shoppers standing under roadside umbrellas
        x = isWest ? -10.2 : 10.2;
        z = -75 + (i / 85) * 160 + (Math.random() - 0.5) * 4;
        behavior = 'stand';
      } else if (i % 7 === 0) {
        // Chatting pairs on sidewalk
        x = isWest ? -8.6 : 8.6;
        z = -100 + (i / 85) * 200;
        behavior = 'talk';
      } else {
        // Normal sidewalk pedestrians
        x = isWest ? -8.2 - Math.random() * 2.2 : 8.2 + Math.random() * 2.2;
        z = -115 + (i / 85) * 230 + (Math.random() - 0.5) * 6;
        behavior = 'walk';
      }

      const npc = this.createNPC(type, behavior, x, z);
      npc.group.position.y = y;
      this.crowd.push(npc);
      this.group.add(npc.group);
    }
  }

  private createNPC(type: NPCType, behavior: NPCBehavior, x: number, z: number): PopulatedNPC {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let shirtColor = 0x3b82f6;
    let pantsColor = 0x1e293b;
    let skinColor = 0x3d2314;
    let scale = 1.0;

    switch (type) {
      case 'student':
        shirtColor = 0xffffff;
        pantsColor = 0x166534;
        scale = 0.88;
        break;
      case 'office_worker':
        shirtColor = 0xbae6fd;
        pantsColor = 0x0f172a;
        break;
      case 'police':
        shirtColor = 0xfacc15;
        pantsColor = 0x09090b;
        break;
      case 'security_guard':
        shirtColor = 0x1e293b;
        pantsColor = 0x09090b;
        break;
      case 'mechanic':
        shirtColor = 0x334155;
        pantsColor = 0x1e293b;
        break;
      case 'construction_worker':
        shirtColor = 0xf97316;
        pantsColor = 0x374151;
        break;
      case 'food_seller':
      case 'market_seller':
        shirtColor = 0xd97706;
        pantsColor = 0xb45309;
        break;
      case 'elderly_person':
        shirtColor = 0xfef3c7;
        pantsColor = 0x78350f;
        break;
      default:
        shirtColor = 0x10b981;
        pantsColor = 0x1e293b;
        break;
    }

    // Torso
    const torsoMat = CityPopulation.getMat(`torso_${shirtColor.toString(16)}`, shirtColor);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52 * scale, 0.72 * scale, 0.32 * scale), torsoMat);
    torso.position.y = 0.95 * scale;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headMat = CityPopulation.getMat(`head_${skinColor.toString(16)}`, skinColor);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.34 * scale, 0.34 * scale), headMat);
    head.position.y = 1.45 * scale;
    group.add(head);

    // Legs
    const legMat = CityPopulation.getMat(`legs_${pantsColor.toString(16)}`, pantsColor);
    const legGeo = new THREE.BoxGeometry(0.18 * scale, 0.6 * scale, 0.18 * scale);

    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.15 * scale, 0.32 * scale, 0);
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.15 * scale, 0.32 * scale, 0);
    group.add(legR);

    return {
      group,
      legL,
      legR,
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
      // Proximity check: only animate if near player (within 90 meters)
      const distZ = Math.abs(npc.group.position.z - playerZ);
      if (distZ > 90) {
        npc.group.visible = false;
        continue;
      }
      npc.group.visible = true;

      npc.animTime += delta;

      if (npc.behavior === 'walk') {
        npc.group.position.z += npc.walkDir * npc.speed * delta;
        const swing = Math.sin(npc.animTime * npc.speed * 4.5) * 0.45;
        npc.legL.rotation.x = swing;
        npc.legR.rotation.x = -swing;

        // Turn around at path bounds
        if (npc.group.position.z > npc.maxZ) {
          npc.walkDir = -1;
          npc.group.rotation.y = Math.PI;
        } else if (npc.group.position.z < npc.minZ) {
          npc.walkDir = 1;
          npc.group.rotation.y = 0;
        }
      } else if (npc.behavior === 'talk') {
        // Subtle nodding / gesturing animation
        npc.group.rotation.y = Math.sin(npc.animTime * 1.5) * 0.15;
      }
    }
  }
}
