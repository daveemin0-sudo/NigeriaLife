import * as THREE from 'three';
import type { InteriorDefinition, InteriorNPCDef } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import type { NavGrid } from '../../interactions/NavGrid';
import { BukaService, COUNTER_FRONT, WAITER_POST, COOK_POST } from '../buka/BukaService';
import { Builder } from '../../world/kit/ArchKit';

const ROOM = { width: 24, length: 22, height: 4.5 };

/** Dressing around BukaService anchors — counter (−4,−5), stove (−4,−8.5), tables, door at +z. */
function dressMamaPutBroadStreet(b: Builder): void {
  const wall = 0xfef3c7;
  const wood = 0x78350f;
  const accent = 0x15803d;

  for (let x = -9; x <= 9; x += 3.2) {
    for (let z = -9; z <= 9; z += 3.2) {
      b.box(0xd6d3d1, 2.9, 0.05, 2.9, x, 4.05, z, { solid: false });
      b.cylinder(0x57534e, 0.04, 0.55, x, 3.55, z, { solid: false });
      b.box(0xfde68a, 0.12, 0.14, 0.12, x, 3.15, z, { glow: true, solid: false });
    }
  }
  for (const wx of [-7, -3, 1, 5, 9]) {
    b.box(0xbae6fd, 1.8, 1.2, 0.06, wx, 1.6, -10.92, { solid: false });
    b.box(0x1e3a8a, 1.9, 1.3, 0.1, wx, 1.55, -10.95, { solid: false });
  }
  for (const wz of [-6, -2, 2, 6]) {
    b.box(0xbae6fd, 1.4, 1.05, 0.06, -11.92, 1.5, wz, { solid: false });
    b.box(0x1e3a8a, 1.5, 1.15, 0.1, -11.95, 1.45, wz, { solid: false });
    b.box(0xbae6fd, 1.4, 1.05, 0.06, 11.92, 1.5, wz, { solid: false });
  }
  b.box(accent, 5.2, 0.65, 0.08, 0, 2.5, -10.88, { solid: false });
  b.box(0xf8fafc, 4.8, 0.48, 0.04, 0, 2.5, -10.84, { solid: false });

  b.box(wall, 0.12, 2.45, 7, -8.5, 0, -2.5, { solid: false });
  b.box(wood, 0.08, 2.5, 3.2, -1.2, 0, -5.5, { solid: false });
  b.occupy(-1.35, -1.05, -5.65, -5.35, 2.5);

  for (let i = 0; i < 4; i++) {
    b.cylinder(0x94a3b8, 0.03, 0.85, -3 + i * 2, 0, 8.5, { solid: false });
    b.box(0xdc2626, 0.4, 0.3, 0.3, -3 + i * 2, 0.86, 8.5, { solid: false });
  }
  for (const [x, z] of [[-8, 7.5], [8, 7.5], [-8, -8.5], [8, 4]] as const) {
    b.box(wood, 2.2, 0.08, 0.4, x, 0.45, z, { solid: false });
    b.box(wood, 0.08, 0.45, 0.35, x - 1.0, 0, z, { solid: false });
    b.box(wood, 0.08, 0.45, 0.35, x + 1.0, 0, z, { solid: false });
    b.occupy(x - 1.1, x + 1.1, z - 0.22, z + 0.22, 0.55);
  }

  b.box(0xfacc15, 3.6, 0.55, 0.45, -10, 0, -8.5);
  b.box(0x1c1917, 1.2, 0.08, 0.9, -10, 0.01, -7.5, { solid: false });
  for (let i = 0; i < 5; i++) b.box(wood, 0.35, 0.22, 0.55, -10.5, i * 0.24, -7.2 + (i % 2) * 0.4, { yaw: 0.15, solid: false });
  b.box(0x1e3a8a, 1.5, 1.55, 0.75, 9, 0, -5.2, { solid: false });
  b.box(0x7dd3fc, 1.25, 1.15, 0.05, 9, 0.28, -4.82, { glow: true, solid: false });

  b.box(0x57534e, 2.0, 0.9, 0.7, 8, 0, 3.5, { solid: false });
  for (let i = 0; i < 4; i++) b.box([0xfacc15, 0x16a34a, 0xdc2626][i % 3], 0.26, 0.24, 0.26, 7.2 + i * 0.32, 0.92, 3.4, { solid: false });

  for (const [x, z] of [[2, 8], [6, 6], [-2, 7], [0, -1]] as const) {
    b.box(0xfacc15, 0.3, 0.2, 0.26, x, 0.9, z, { solid: false });
    b.box(0xf8fafc, 0.26, 0.08, 0.22, x, 0.82, z, { solid: false });
  }
  b.cylinder(0x15803d, 0.25, 0.95, -10, 0, 4, { sides: 12 });
  b.cylinder(0x38bdf8, 0.1, 0.14, -10, 0.95, 4, { glow: true, solid: false });
}

/** Regulars who are already at their tables. `seat` counts four per table, clockwise from the east chair. */
const DINERS: Array<{ def: Omit<InteriorNPCDef, 'relativePosition' | 'rotationY'>; seat: number; dish: string; eaten: number }> = [
  {
    seat: 4 + 3,
    dish: 'amala',
    eaten: 0.3,
    def: {
      id: 'npc_baba_tunde',
      name: 'Baba Tunde',
      role: 'Customer',
      title: 'Regular',
      outfitColor: 0x1d4ed8,
      dialogueGreeting: 'Ah, you don come! The amala here no get part two. Sit down, order, make you chop.',
      actions: [],
    },
  },
  {
    seat: 4 + 0,
    dish: 'fried_rice',
    eaten: 0.5,
    def: {
      id: 'npc_aunty_bisi',
      name: 'Aunty Bisi',
      role: 'Customer',
      title: 'Regular',
      outfitColor: 0xbe185d,
      dialogueGreeting: 'My dear, how far? Tell Segun to give you extra dodo, say na Aunty Bisi send you.',
      actions: [],
    },
  },
  {
    seat: 8 + 3,
    dish: 'jollof_rice',
    eaten: 0.15,
    def: {
      id: 'npc_kunle',
      name: 'Kunle',
      role: 'Customer',
      title: 'Lunch break',
      outfitColor: 0x0f766e,
      dialogueGreeting: 'Boss, I get thirty minutes break and I dey use am well. This jollof na firewood, I swear.',
      actions: [],
    },
  },
];

export class RestaurantInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  /** Table service: orders, seats, the cook and the waiter */
  public service: BukaService;
  private smokeParticles: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for the restaurant interior
    const origin = new THREE.Vector3(260, 0, 240);
    this.group.position.copy(origin);
    this.service = new BukaService(this.group, origin, ROOM.width, ROOM.length);

    this.def = {
      id: 'interior_restaurant',
      name: 'Mama Put Buka',
      type: 'restaurant',
      tier: 'tier3_simulated',
      districtName: 'Broad Street, Lagos Island',
      streetBuildingId: 'mama-put',
      streetEntrance: new THREE.Vector3(-9.5, 0, -10), // Replaced by the street door's position when it registers
      streetExitRotation: -Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 8.6),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xffedd5,
      ambientLightIntensity: 1.25,
      rooms: [
        {
          id: 'buka_dining_hall',
          name: 'Dining room & open kitchen',
          size: ROOM,
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xfef3c7, // Warm terracotta tile
          wallColor: 0x78350f,  // Warm wooden and amber rustic walls
        },
      ],
      // What is on offer and what it costs lives in buka/BukaMenu.ts; ordering is the same at either spot
      stations: [
        {
          id: 'buka_food_counter',
          name: 'Serving counter',
          category: 'Order food',
          description: 'Jollof, fried rice, amala, eba and suya. Order here, take a seat, and Segun brings it to your table.',
          relativePosition: COUNTER_FRONT.clone(),
          actions: [],
        },
        {
          id: 'buka_table_vip',
          name: 'Free table',
          category: 'Dining table',
          description: 'Sit down and order from your seat. You pay when the food reaches the table.',
          relativePosition: new THREE.Vector3(4, 0, 4.23),
          actions: [],
        },
      ],
      npcs: [
        {
          id: 'npc_mama_nkechi',
          name: 'Mama Nkechi',
          role: 'Chef',
          title: 'Owner & cook',
          relativePosition: COOK_POST.clone(),
          rotationY: 0,
          outfitColor: 0xd97706, // Golden amber chef dress
          hasChefHat: true,
          dialogueGreeting: 'Welcome my child! Nobody leaves Mama Put hungry! The firewood jollof is hot and sweet today!',
          actions: [],
        },
        {
          id: 'npc_waiter_segun',
          name: 'Segun',
          role: 'Waiter',
          title: 'Head server',
          relativePosition: WAITER_POST.clone(),
          rotationY: 0,
          outfitColor: 0x15803d, // Green server apron
          dialogueGreeting: 'Good day! Pick anything from the menu and take a seat. I will bring it to your table.',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  /** Floor map used to walk characters around the tables and the counter. */
  public get nav(): NavGrid {
    return this.service.nav;
  }

  public onPlayerEntered(): void {
    this.service.playerEntered();
  }

  public onPlayerLeft(): void {
    this.service.playerLeft();
  }

  private build3DInterior(): void {
    const origin = this.group.position;
    const worldPoint = (x: number, z: number) => new THREE.Vector3(origin.x + x, 0, origin.z + z);

    // 1. Room structure
    const room = InteriorPrefabs.createRoom(ROOM.width, ROOM.length, ROOM.height, 0xfef3c7, 0x78350f);
    this.group.add(room);

    // 2. Warm ambient lanterns & ceiling lights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-4, 4.2, -4), 0xfbbf24));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(4, 4.2, 2), 0xfbbf24));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-4, 4.2, 5), 0xfbbf24));

    // 3. Exit Door
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 11), Math.PI);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Door to Broad Street',
      category: 'Exit to Street',
      description: 'Step back out onto Broad Street.',
      interactionPoint: worldPoint(0, 9.7),
    });

    const dress = new Builder().around(0, 0);
    dressMamaPutBroadStreet(dress);
    this.group.add(dress.build('mama put dressing', { roughness: 0.62 }));

    // 4. Kitchen: food warmer counter, stove, steam. Tables, chairs and the pass come from the service.
    const foodWarmer = InteriorPrefabs.createFoodWarmer(new THREE.Vector3(-4, 0, -5), 0);
    this.group.add(foodWarmer);

    const stove = InteriorPrefabs.createKitchenStove(new THREE.Vector3(-4, 0, -8.5), 0);
    this.group.add(stove);

    for (let p = 0; p < 5; p++) {
      const smokeGeo = new THREE.DodecahedronGeometry(0.18 + p * 0.08);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.5 - p * 0.08,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(-4 + (p % 2 ? 0.9 : -0.9), 1.6 + p * 0.35, -8.5);
      this.smokeParticles.push(smoke);
      this.group.add(smoke);
    }

    // 5. Staff
    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      const isCook = npcDef.id === 'npc_mama_nkechi';
      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: 'Restaurant Staff',
        description: npcDef.dialogueGreeting,
        // The cook is spoken to across the counter; the waiter face to face
        interactionPoint: isCook
          ? worldPoint(COUNTER_FRONT.x, COUNTER_FRONT.z)
          : worldPoint(npcDef.relativePosition.x, npcDef.relativePosition.z + 1.3),
      });
    }
    const waiter = this.npcs.find((npc) => npc.def.id === 'npc_waiter_segun')!;
    const cook = this.npcs.find((npc) => npc.def.id === 'npc_mama_nkechi')!;
    this.service.setStaff(waiter.actor, cook.actor);

    // 6. Regular customers already eating
    for (const diner of DINERS) {
      const npcMesh = this.service.addDiner(
        { ...diner.def, relativePosition: new THREE.Vector3(), rotationY: 0 },
        diner.seat,
        diner.dish,
        diner.eaten
      );
      this.npcs.push(npcMesh);
      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${diner.def.id}`,
        name: `${diner.def.name} (${diner.def.title})`,
        category: 'Customer',
        description: diner.def.dialogueGreeting,
        interactionPoint: this.service.seatApproach(diner.seat),
      });
    }

    // 7. Stations: the counter and a free table. Both open the same menu.
    for (const station of this.def.stations) {
      this.interactiveList.push({
        mesh: station.id === 'buka_food_counter' ? foodWarmer : this.service.tableMesh(0),
        id: station.id,
        name: station.name,
        category: station.category,
        description: station.description,
        interactionPoint: worldPoint(station.relativePosition.x, station.relativePosition.z),
      });
    }
  }

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) {
      npc.update(delta, time);
    }
    this.service.update(delta);

    // Smoke particle upward drift animation
    for (let i = 0; i < this.smokeParticles.length; i++) {
      const p = this.smokeParticles[i];
      p.position.y += delta * 0.5;
      if (p.position.y > 3.8) {
        p.position.y = 1.6;
      }
    }
  }
}
