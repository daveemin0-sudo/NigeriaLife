import * as THREE from 'three';
import type { InteractiveObject } from './World';
import { HumanMeshBuilder, type HumanRig, type Gender } from '../graphics/HumanMeshBuilder';
import { Actor } from '../interactions/Actor';
import { InteractionDirector } from '../interactions/InteractionDirector';

interface AmbientPedestrian {
  group: THREE.Group;
  rig: HumanRig;
  isWalking: boolean;
  dir: number; // 1 or -1 along Z
  speed: number;
  walkTime: number;
  minZ: number;
  maxZ: number;
  idleAction?: string;
}

/**
 * NPCs (Character 2.0 Living Street Population)
 * Fully replaces legacy box geometry with anatomically accurate, stylized Nigerian humans:
 * - Proper anatomical proportions with masculine vs feminine silhouettes
 * - Authentic Nigerian skin tones, hairstyles (afro, braids, bob wig, gele, fila, caps)
 * - Occupation-specific clothing (traffic warden high-vis, chef aprons, mechanic overalls, agbada)
 * - Real articulated walking and idle breathing animations
 */
export class NPCs {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];

  // Walking & animated crowd
  private pedestrians: AmbientPedestrian[] = [];

  // Animated story character rigs
  private storyRigs: { rig: HumanRig; animState: string; actor?: Actor }[] = [];
  private hawkerActor: Actor | null = null;
  /** The hawker's clickable entry: where to stand to reach him moves as he walks */
  private hawkerSpot: THREE.Vector3 | null = null;
  private storyAnimTime: number = 0;

  // Key interactive Hawker
  private hawkerGroup!: THREE.Group;
  private hawkerRig!: HumanRig;
  private hawkerDir: number = 1;
  private hawkerSpeed: number = 2.0;
  private hawkerWalkTime: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // 1. Core Interactive Story NPCs (10 rich characters)
    this.createInteractiveNPCs();

    // 2. Ambient Lagos Sidewalk Crowd (diverse anatomical citizens)
    this.createSidewalkCrowd();

    // 3. The named characters can be directed by scripted interactions (waving back, for a start)
    this.registerActors();
  }

  private registerActors(): void {
    const director = InteractionDirector.get();
    for (const entry of this.interactiveList) {
      const root = entry.mesh;
      if (root === this.hawkerGroup) {
        this.hawkerActor = director.register(
          new Actor({ id: `npc:${entry.id}`, name: entry.name, root, getRig: () => this.hawkerRig }),
          entry.id
        );
        continue;
      }
      const story = this.storyRigs.find((item) => item.rig.group.parent === root);
      if (!story) continue;
      story.actor = director.register(
        new Actor({ id: `npc:${entry.id}`, name: entry.name, root, getRig: () => story.rig }),
        entry.id
      );
    }
  }

  // =========================================================================
  // 1. CORE INTERACTIVE STORY NPCS
  // =========================================================================
  private createInteractiveNPCs(): void {
    // 1. Street Drinks & Snacks Hawker (Patrolling Chidi)
    this.createHawker();

    // 2. Danfo Conductor at Bus Stop
    this.createDanfoConductor();

    // 3. Citizen outside Bet9ja (Segun)
    this.createBetCustomer();

    // 4. Elegant Market Trader Aunty outside Sabo Textiles (Mama Nkechi)
    this.createAuntyAnkara();

    // 5. Corporate Banker outside Eko Commercial Bank (Tunde)
    this.createCorporateBanker();

    // 6. Suya Master & Griller outside Chop Life Bukateria (Mallam Bisi)
    this.createSuyaMaster();

    // 7. Phone Specialist outside Slot Gadgets (Emeka)
    this.createPhoneTechnician();

    // 8. Auto Mechanic outside God's Grace Auto Works (Master Tayo)
    this.createLeadMechanic();

    // 9. Traffic Warden / Police Officer directing traffic at zebra crossing (Sgt. Bello)
    this.createTrafficWarden();

    // 10. Respected Community Elder outside Palm View Apartments (Chief Alabi)
    this.createCommunityElder();
  }

  // A. Street Drinks Hawker (Chidi)
  private createHawker(): void {
    this.hawkerGroup = new THREE.Group();
    this.hawkerGroup.position.set(-8.5, 0, -15);

    this.hawkerRig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Chidi (Drinks & Gala)',
      skinTone: '#4a2c1d',
      outfit: 'casual_tee',
      outfitColor: 0xeab308, // Iconic Lagos street yellow shirt
      hairstyle: 'short_crop',
      hasTray: true, // Plastic red basin with sachet pure water & gala on head
    });

    this.hawkerGroup.add(this.hawkerRig.group);
    this.group.add(this.hawkerGroup);

    this.hawkerSpot = new THREE.Vector3(-8.5, 0, -15);
    this.interactiveList.push({
      mesh: this.hawkerGroup,
      id: 'npc-hawker',
      name: 'Chidi (Street Drinks & Gala)',
      category: 'Street Vendor',
      description: 'Chilled pure water (₦100) and hot beef Gala sausage (₦250), carried on his head through the go-slow.',
      interactionPoint: this.hawkerSpot,
      moving: true,
    });
  }

  // B. Danfo Conductor
  private createDanfoConductor(): void {
    const conductorGroup = new THREE.Group();
    conductorGroup.position.set(7.5, 0, 5);
    conductorGroup.rotation.y = -Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Danfo Conductor',
      skinTone: '#3f2518',
      outfit: 'casual_tee',
      outfitColor: 0xd97706, // Amber street tee
      hairstyle: 'afro',
    });

    conductorGroup.add(rig.group);
    this.group.add(conductorGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: conductorGroup,
      id: 'conductor-danfo',
      name: 'Danfo Conductor (Obalende / CMS)',
      category: 'Transit Worker',
      description: '"Obalende direct! CMS one thousand naira! Enter with your exact change, no fifty naira change here!"',
      interactionPoint: new THREE.Vector3(7.5, 0, 5),
    });
  }

  // C. Bet Customer (Segun)
  private createBetCustomer(): void {
    const betGroup = new THREE.Group();
    betGroup.position.set(-13, 0, 4.5);
    betGroup.rotation.y = Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Segun (Odds Guru)',
      skinTone: '#543321',
      outfit: 'casual_tee',
      outfitColor: 0x16a34a, // Green sports jersey
      hairstyle: 'fade',
    });

    betGroup.add(rig.group);
    this.group.add(betGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: betGroup,
      id: 'bet-customer',
      name: 'Segun (Odds Expert)',
      category: 'Citizen',
      description: '"Guy, Arsenal and Real Madrid straight win go deliver this weekend! My slip cut by one game yesterday, but today na my turn!"',
      interactionPoint: new THREE.Vector3(-13, 0, 4.5),
    });
  }

  // D. Elegant Market Trader Aunty (Mama Nkechi)
  private createAuntyAnkara(): void {
    const auntyGroup = new THREE.Group();
    auntyGroup.position.set(13, 0, -28);
    auntyGroup.rotation.y = -Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'female',
      username: 'Mama Nkechi (Textiles)',
      skinTone: '#5c3722',
      outfit: 'peplum_skirt',
      outfitColor: 0xe11d48, // Rich Nigerian lace/ankara magenta
      secondaryColor: 0xfacc15,
      hairstyle: 'gele', // Grand Gele headwrap
    });

    auntyGroup.add(rig.group);
    this.group.add(auntyGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: auntyGroup,
      id: 'aunty-ankara',
      name: 'Mama Nkechi (Fabric Trader)',
      category: 'Market Merchant',
      description: '"Nne, look at this Hollandis wax! Pure grade one quality for wedding owambe. I will give you good customer discount!"',
      interactionPoint: new THREE.Vector3(13, 0, -28),
    });
  }

  // E. Corporate Banker (Tunde)
  private createCorporateBanker(): void {
    const bankerGroup = new THREE.Group();
    bankerGroup.position.set(12, 0, -11);
    bankerGroup.rotation.y = -Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Tunde (Wealth Advisor)',
      skinTone: '#452718',
      outfit: 'senator',
      outfitColor: 0x0f172a, // Deep midnight navy Senator suit
      hairstyle: 'short_crop',
      hasTie: true,
    });

    bankerGroup.add(rig.group);
    this.group.add(bankerGroup);
    this.storyRigs.push({ rig, animState: 'phone_call' });

    this.interactiveList.push({
      mesh: bankerGroup,
      id: 'banker-tunde',
      name: 'Tunde (Wealth Advisor)',
      category: 'Finance Professional',
      description: '"Our dollar card limits and treasury bill yields are among the highest in Lagos. Speak to our account officers inside for SME expansion capital."',
      interactionPoint: new THREE.Vector3(12, 0, -11),
    });
  }

  // F. Suya Master (Mallam Bisi)
  private createSuyaMaster(): void {
    const suyaGroup = new THREE.Group();
    suyaGroup.position.set(-13, 0, 16.5);
    suyaGroup.rotation.y = Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Mallam Bisi (Suya Master)',
      skinTone: '#4a2c1d',
      outfit: 'chef_attire',
      outfitColor: 0x7c2d12,
      hairstyle: 'fila',
    });

    suyaGroup.add(rig.group);
    this.group.add(suyaGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: suyaGroup,
      id: 'suya-master',
      name: 'Mallam Bisi (Master Suya Griller)',
      category: 'Street Chef',
      description: '"Spicy beef fillet, kidney, and chicken suya seasoned with genuine Yaji pepper and sliced sweet red onions. Hot from the glowing firewood grill!"',
      interactionPoint: new THREE.Vector3(-13, 0, 16.5),
    });
  }

  // G. Phone Specialist (Emeka)
  private createPhoneTechnician(): void {
    const phoneGroup = new THREE.Group();
    phoneGroup.position.set(13, 0, -5);
    phoneGroup.rotation.y = -Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Emeka (Slot Phone Guru)',
      skinTone: '#4e2f1f',
      outfit: 'casual_tee',
      outfitColor: 0x0284c7,
      hairstyle: 'fade',
    });

    phoneGroup.add(rig.group);
    this.group.add(phoneGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: phoneGroup,
      id: 'phone-tech',
      name: 'Emeka (Device Technician)',
      category: 'Gadget Specialist',
      description: '"Original iPhone, Samsung screens, replacement charging ICs, and high-speed Starlink kits. 100% genuine warranty guaranteed!"',
      interactionPoint: new THREE.Vector3(13, 0, -5),
    });
  }

  // H. Lead Mechanic (Master Tayo)
  private createLeadMechanic(): void {
    const mechGroup = new THREE.Group();
    mechGroup.position.set(-13, 0, -25);
    mechGroup.rotation.y = Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Master Tayo (Lead Mechanic)',
      skinTone: '#3d2417',
      outfit: 'mechanic_overalls',
      outfitColor: 0x1e3a8a,
      hairstyle: 'short_crop',
    });

    mechGroup.add(rig.group);
    this.group.add(mechGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: mechGroup,
      id: 'lead-mechanic',
      name: "Master Tayo (God's Grace Auto)",
      category: 'Auto Specialist',
      description: '"Toyota and Lexus suspension, gearbox overhaul, and computer brainbox diagnostics. No car fault can defeat God\'s Grace Auto Works!"',
      interactionPoint: new THREE.Vector3(-13, 0, -25),
    });
  }

  // I. Traffic Warden (Sgt. Bello)
  private createTrafficWarden(): void {
    const wardenGroup = new THREE.Group();
    wardenGroup.position.set(0, 0, 1.5);
    wardenGroup.rotation.y = 0;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Sgt. Bello (LASTMA Warden)',
      skinTone: '#452718',
      outfit: 'traffic_warden',
      outfitColor: 0xfacc15,
      hairstyle: 'hardhat',
    });

    wardenGroup.add(rig.group);
    this.group.add(wardenGroup);
    this.storyRigs.push({ rig, animState: 'talk' });

    this.interactiveList.push({
      mesh: wardenGroup,
      id: 'traffic-warden',
      name: 'Sgt. Bello (LASTMA Warden)',
      category: 'Traffic Authority',
      description: '"Hold on pedestrians! Let the Danfo clear the intersection first! Cross safely at the zebra markings and obey the traffic lights!"',
      interactionPoint: new THREE.Vector3(0, 0, 1.5),
    });
  }

  // J. Community Elder (Chief Alabi)
  private createCommunityElder(): void {
    const elderGroup = new THREE.Group();
    elderGroup.position.set(12.5, 0, 20);
    elderGroup.rotation.y = -Math.PI / 2;

    const rig = HumanMeshBuilder.createHuman({
      gender: 'male',
      username: 'Chief Alabi (Community Elder)',
      skinTone: '#4a2c1d',
      outfit: 'agbada',
      outfitColor: 0x047857, // Deep green royal Agbada
      hairstyle: 'fila',
    });

    elderGroup.add(rig.group);
    this.group.add(elderGroup);
    this.storyRigs.push({ rig, animState: 'idle' });

    this.interactiveList.push({
      mesh: elderGroup,
      id: 'community-elder',
      name: 'Chief Alabi (Community Elder)',
      category: 'Respected Elder',
      description: '"Welcome my child. Broad Street has seen many generations come and go. Maintain your peace of mind and integrity as you hustle in this vibrant city."',
      interactionPoint: new THREE.Vector3(12.5, 0, 20),
    });
  }

  // =========================================================================
  // 2. DIVERSE ANATOMICAL SIDEWALK CROWD
  // =========================================================================
  private createSidewalkCrowd(): void {
    const roster: Array<{
      x: number;
      z: number;
      gender: Gender;
      username: string;
      outfit: any;
      outfitColor: number;
      hairstyle: any;
      isWalking: boolean;
      minZ: number;
      maxZ: number;
      speed: number;
      idleAction?: string;
    }> = [
      // West Sidewalk
      { x: -9.5, z: -32, gender: 'female', username: 'Amara', outfit: 'blue_dress', outfitColor: 0x2563eb, hairstyle: 'bob_wig', isWalking: true, minZ: -45, maxZ: -18, speed: 1.8 },
      { x: -9.2, z: -20, gender: 'male', username: 'Kelechi', outfit: 'casual_tee', outfitColor: 0xd97706, hairstyle: 'fade', isWalking: true, minZ: -30, maxZ: -10, speed: 2.1 },
      { x: -9.0, z: -8, gender: 'female', username: 'Blessing', outfit: 'peplum_skirt', outfitColor: 0xdc2626, hairstyle: 'braids', isWalking: false, minZ: -8, maxZ: -8, speed: 0, idleAction: 'talk' },
      { x: -9.5, z: 2, gender: 'male', username: 'Tobi', outfit: 'student_casual', outfitColor: 0x1d4ed8, hairstyle: 'afro', isWalking: true, minZ: -10, maxZ: 15, speed: 2.2 },
      { x: -9.2, z: 12, gender: 'female', username: 'Ngozi', outfit: 'casual_blouse', outfitColor: 0x7c3aed, hairstyle: 'ponytail', isWalking: true, minZ: 0, maxZ: 25, speed: 1.9 },
      { x: -9.0, z: 22, gender: 'male', username: 'Babajide', outfit: 'senator', outfitColor: 0x1e293b, hairstyle: 'short_crop', isWalking: false, minZ: 22, maxZ: 22, speed: 0, idleAction: 'phone_call' },

      // East Sidewalk
      { x: 9.5, z: -30, gender: 'male', username: 'Femi', outfit: 'casual_tee', outfitColor: 0x16a34a, hairstyle: 'fade', isWalking: true, minZ: -42, maxZ: -15, speed: 2.0 },
      { x: 9.2, z: -18, gender: 'female', username: 'Zainab', outfit: 'blue_dress', outfitColor: 0x0284c7, hairstyle: 'braids', isWalking: true, minZ: -28, maxZ: -6, speed: 1.7 },
      { x: 9.0, z: -2, gender: 'female', username: 'Funke', outfit: 'peplum_skirt', outfitColor: 0xf59e0b, hairstyle: 'gele', isWalking: false, minZ: -2, maxZ: -2, speed: 0, idleAction: 'dance' },
      { x: 9.5, z: 8, gender: 'male', username: 'Chinedu', outfit: 'engineer_vest', outfitColor: 0xf97316, hairstyle: 'hardhat', isWalking: true, minZ: -5, maxZ: 20, speed: 2.3 },
      { x: 9.2, z: 18, gender: 'female', username: 'Halima', outfit: 'casual_blouse', outfitColor: 0xec4899, hairstyle: 'bob_wig', isWalking: true, minZ: 6, maxZ: 28, speed: 1.8 },
      { x: 9.0, z: 26, gender: 'male', username: 'Alhaji Musa', outfit: 'agbada', outfitColor: 0x065f46, hairstyle: 'fila', isWalking: false, minZ: 26, maxZ: 26, speed: 0, idleAction: 'idle' },
    ];

    for (const item of roster) {
      const pedGroup = new THREE.Group();
      pedGroup.position.set(item.x, 0, item.z);

      const rig = HumanMeshBuilder.createHuman({
        gender: item.gender,
        username: item.username,
        outfit: item.outfit,
        outfitColor: item.outfitColor,
        hairstyle: item.hairstyle,
      });

      pedGroup.add(rig.group);
      this.group.add(pedGroup);

      this.pedestrians.push({
        group: pedGroup,
        rig,
        isWalking: item.isWalking,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: item.speed,
        walkTime: Math.random() * 10,
        minZ: item.minZ,
        maxZ: item.maxZ,
        idleAction: item.idleAction,
      });
    }
  }

  // =========================================================================
  // UPDATE TICK
  // =========================================================================
  public update(delta: number, playerPos?: THREE.Vector3): void {
    this.storyAnimTime += delta;

    // 1. Animate Drinks Hawker patrolling the street
    if (this.hawkerGroup && this.hawkerRig && !this.hawkerActor?.scripted) {
      // Head back along the patrol line after stopping to greet someone
      this.hawkerGroup.rotation.y = this.hawkerDir > 0 ? 0 : Math.PI;
      this.hawkerGroup.position.z += this.hawkerDir * this.hawkerSpeed * delta;
      this.hawkerWalkTime += delta * 6.5;
      this.hawkerRig.updateAnimation(this.hawkerWalkTime, 'walk');

      if (this.hawkerGroup.position.z > 25) {
        this.hawkerDir = -1;
        this.hawkerGroup.rotation.y = Math.PI;
      } else if (this.hawkerGroup.position.z < -35) {
        this.hawkerDir = 1;
        this.hawkerGroup.rotation.y = 0;
      }
    }

    // He is reached wherever he has walked to, not where he set out from
    if (this.hawkerGroup && this.hawkerSpot) {
      this.hawkerSpot.set(this.hawkerGroup.position.x, 0, this.hawkerGroup.position.z);
    }

    // 2. Animate Story Character Rigs
    for (const story of this.storyRigs) {
      if (story.actor?.scripted) continue;
      story.rig.updateAnimation(this.storyAnimTime, story.animState);
    }

    // 3. Animate Sidewalk Pedestrians with distance LOD culling
    for (const ped of this.pedestrians) {
      if (playerPos) {
        const distSq = (ped.group.position.x - playerPos.x) ** 2 + (ped.group.position.z - playerPos.z) ** 2;
        if (distSq > 70 * 70) continue; // Skip bone kinematic calculations for NPCs farther than 70m
      }

      if (ped.isWalking) {
        ped.group.position.z += ped.dir * ped.speed * delta;
        ped.walkTime += delta * 6.5;
        ped.rig.updateAnimation(ped.walkTime, 'walk');

        // Turnaround at patrol bounds
        if (ped.group.position.z >= ped.maxZ) {
          ped.dir = -1;
          ped.group.rotation.y = Math.PI;
        } else if (ped.group.position.z <= ped.minZ) {
          ped.dir = 1;
          ped.group.rotation.y = 0;
        }
      } else {
        // Expressive idle animation (talking, dancing, on phone, or breathing)
        ped.walkTime += delta * 1.5;
        ped.rig.updateAnimation(ped.walkTime, ped.idleAction || 'idle');
      }
    }
  }
}
