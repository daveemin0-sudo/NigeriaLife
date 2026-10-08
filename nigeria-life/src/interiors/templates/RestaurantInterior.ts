import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class RestaurantInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  private smokeParticles: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for the restaurant interior
    const origin = new THREE.Vector3(260, 0, 240);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_restaurant',
      name: 'Mama Put Special Bukateria & Grill',
      type: 'restaurant',
      tier: 'tier3_simulated',
      districtName: 'Broad Street Food & Culture Strip',
      streetBuildingId: 'mama-put',
      streetEntrance: new THREE.Vector3(-9.5, 0, -10), // Outside buka door
      streetExitRotation: -Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 9),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xffedd5,
      ambientLightIntensity: 1.25,
      rooms: [
        {
          id: 'buka_dining_hall',
          name: 'Main Buka Dining Room & Open Kitchen',
          size: { width: 24, length: 22, height: 4.5 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xfef3c7, // Warm terracotta tile
          wallColor: 0x78350f,  // Warm wooden and amber rustic walls
        },
      ],
      stations: [
        {
          id: 'buka_food_counter',
          name: 'Mama Put Serving Counter & Food Warmer',
          category: 'Food Order Station',
          description: 'Hot steel trays filled with spicy Asun, steaming Party Jollof, Fried Rice, and Egusi.',
          relativePosition: new THREE.Vector3(-4, 0, -5),
          actions: [
            {
              id: 'order_party_jollof',
              label: '🍲 Order Firewood Party Jollof & Fried Chicken (₦1,800)',
              description: 'Authentic smoky Nigerian party jollof with sweet fried plantain and crispy chicken.',
              cost: 1800,
              rewardEnergy: 100,
              rewardHealth: 30,
              itemReward: {
                id: 'takeaway_party_jollof',
                name: 'Takeaway Firewood Jollof Pack',
                category: 'food',
                icon: '🍲',
                description: 'Insulated foil takeaway pack with spicy firewood party jollof and fried chicken.',
                price: 1800,
                usable: true,
                energyRestore: 60,
              },
              dialogueResponse: '🍲 Mama Nkechi: "Oya chop life! Smoky firewood Jollof dished fresh for you! Energy restored to 100%, and extra takeaway packed in your bag!"',
            },
            {
              id: 'order_amala_special',
              label: '🍲 Order Hot Amala Dudu + Abula & Goat Meat (₦2,200)',
              description: 'Steaming hot yam flour amala with ewedu, gbegiri, and spicy tender goat meat.',
              cost: 2200,
              rewardEnergy: 100,
              rewardHealth: 45,
              rewardCred: 15,
              dialogueResponse: '🍲 Mama Nkechi: "Hot Amala and Abula served with tender goat meat! Eat and be strong! 100% Energy restored, Street Cred +15!"',
            },
          ],
        },
        {
          id: 'buka_table_vip',
          name: 'Central Dining Table & Pepper Soup Section',
          category: 'Dining Table',
          description: 'Comfortable dining table with fresh chilled Chapman, cold Malt, and pepper soup.',
          relativePosition: new THREE.Vector3(4, 0, 2),
          actions: [
            {
              id: 'sit_and_dine',
              label: '🍽️ Sit Down & Enjoy Chilled Chapman & Pepper Soup (₦2,500)',
              description: 'Take a seat, sip ice-cold Chapman mocktail, and enjoy hot catfish pepper soup.',
              cost: 2500,
              rewardEnergy: 100,
              rewardHealth: 50,
              rewardCred: 20,
              dialogueResponse: '🍹 Waiter Segun: "Chilled Chapman with angostura bitters and catfish pepper soup served! Total relaxation achieved!"',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_mama_nkechi',
          name: 'Mama Nkechi',
          role: 'Chef',
          title: 'Owner & Executive Cook',
          relativePosition: new THREE.Vector3(-4, 0, -6.5),
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
          title: 'Head Server',
          relativePosition: new THREE.Vector3(4, 0, 0.5),
          rotationY: Math.PI,
          outfitColor: 0x15803d, // Green server apron
          dialogueGreeting: 'Good day Sah! Table is ready for you. Can I get you chilled Malt, palm wine, or fresh Chapman?',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Room structure
    const room = InteriorPrefabs.createRoom(24, 22, 4.5, 0xfef3c7, 0x78350f);
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
      name: 'Mama Put Exit Door',
      category: 'Exit to Street',
      description: 'Step outside back to the bustling Broad Street market.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10),
    });

    // 4. Food Stations
    // Food warmer buffet counter
    const foodWarmer = InteriorPrefabs.createFoodWarmer(new THREE.Vector3(-4, 0, -5), 0);
    this.group.add(foodWarmer);

    // Kitchen industrial stove behind counter
    const stove = InteriorPrefabs.createKitchenStove(new THREE.Vector3(-4, 0, -8.5), 0);
    this.group.add(stove);

    // Dynamic Steam / Smoke rising from the pots
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

    // Dining Tables
    const table1 = InteriorPrefabs.createDiningTable(new THREE.Vector3(4, 0, 2));
    const table2 = InteriorPrefabs.createDiningTable(new THREE.Vector3(4, 0, -4));
    const table3 = InteriorPrefabs.createDiningTable(new THREE.Vector3(-4, 0, 4));
    this.group.add(table1);
    this.group.add(table2);
    this.group.add(table3);

    // 5. Build NPCs
    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: 'Restaurant Staff',
        description: npcDef.dialogueGreeting,
        interactionPoint: new THREE.Vector3(
          this.group.position.x + npcDef.relativePosition.x,
          0,
          this.group.position.z + npcDef.relativePosition.z + 1.2
        ),
      });
    }

    // 6. Register Station Interactive Objects with their actual furniture meshes
    for (const station of this.def.stations) {
      const stationMesh = station.id === 'buka_food_counter' ? foodWarmer : table1;
      this.interactiveList.push({
        mesh: stationMesh,
        id: station.id,
        name: station.name,
        category: station.category,
        description: station.description,
        interactionPoint: new THREE.Vector3(
          this.group.position.x + station.relativePosition.x,
          0,
          this.group.position.z + station.relativePosition.z
        ),
      });
    }
  }

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) {
      npc.update(delta, time);
    }

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
