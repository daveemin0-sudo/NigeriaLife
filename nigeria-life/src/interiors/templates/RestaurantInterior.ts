import * as THREE from 'three';
import type { InteriorDefinition, InteriorNPCDef } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import type { NavGrid } from '../../interactions/NavGrid';
import { BukaService, COUNTER_FRONT, WAITER_POST, COOK_POST } from '../buka/BukaService';

const ROOM = { width: 24, length: 22, height: 4.5 };

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
