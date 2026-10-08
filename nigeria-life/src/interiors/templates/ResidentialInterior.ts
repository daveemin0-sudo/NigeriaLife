import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class ResidentialInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  // Animated elements
  private fanBlades: THREE.Mesh[] = [];
  private fanHeads: THREE.Group[] = [];
  private tvScreen: THREE.Mesh | null = null;
  private animTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for residential interior (Z = 180 is the established apartment coordinate)
    const origin = new THREE.Vector3(0, 0, 180);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_residence',
      name: 'Victoria Luxury Apartment & Residence',
      type: 'residence',
      tier: 'tier3_simulated',
      districtName: 'Victoria Island Residential Compound',
      streetBuildingId: 'villa-compound',
      streetEntrance: new THREE.Vector3(-14, 0, -45), // Outside residential compound gate
      streetExitRotation: Math.PI / 2,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 9),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xffedd5,
      ambientLightIntensity: 1.2,
      rooms: [
        {
          id: 'residence_main',
          name: 'Executive Duplex Apartment',
          size: { width: 26, length: 22, height: 4.2 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xf1f5f9,
          wallColor: 0x334155,
        },
      ],
      stations: [
        {
          id: 'flat-tv',
          name: '75-Inch Smart TV & Soundbar',
          category: 'Home Entertainment',
          description: 'Live Super Eagles vs Rivals match streaming in 4K. Tap to cheer & dance!',
          relativePosition: new THREE.Vector3(-10, 0, 3),
          actions: [
            {
              id: 'watch_super_eagles',
              label: '📺 Watch Super Eagles AFCON Match (Cheer & Dance)',
              description: 'Watch live football broadcast with stadium roar.',
              rewardEnergy: 30,
              rewardCred: 5,
              dialogueResponse: '⚽ GOOOAAAL! Super Eagles score a screamer! You dance with joy! Energy boosted +30%!',
            },
          ],
        },
        {
          id: 'flat-bed',
          name: 'King-Size Royal Master Bed',
          category: 'Rest & Recovery',
          description: 'Memory foam mattress with air conditioning blowing. Restores 100% full energy!',
          relativePosition: new THREE.Vector3(7.5, 0, -5.5),
          actions: [
            {
              id: 'sleep_luxury_bed',
              label: '🛏️ Sleep on Luxury Bed (100% Full Energy Recharge)',
              description: 'Fall into deep restorative sleep under luxury duvet.',
              rewardEnergy: 100,
              rewardHealth: 100,
              dialogueResponse: '💤 You rest peacefully with the AC blowing. 100% Full Energy and Health restored!',
            },
          ],
        },
        {
          id: 'flat-drum',
          name: 'Nigerian Blue Plastic Water Drum & Red Bucket',
          category: 'Home Essentials',
          description: 'The undefeated symbol of Nigerian domestic resilience! Filled with chilled borehole water.',
          relativePosition: new THREE.Vector3(8.5, 0, 5.5),
          actions: [
            {
              id: 'fetch_water_bath',
              label: '🪣 Fetch Chilled Water & Bath with Red Bowl (Hygiene +100%)',
              description: 'Fetch chilled water with the red plastic bucket and take a refreshing bath.',
              rewardEnergy: 40,
              rewardHealth: 40,
              dialogueResponse: '💧 Refreshing bath taken with the red bowl! Cool chilled borehole water clears your head. Energy +40%!',
            },
          ],
        },
        {
          id: 'flat-workstation',
          name: 'Home Office Tech Workstation',
          category: 'Remote Work',
          description: 'Ergonomic dual-monitor setup with high-speed fiber internet for remote freelancing gigs.',
          relativePosition: new THREE.Vector3(-6.5, 0, -5.5),
          actions: [
            {
              id: 'work_remote_sprint',
              label: '💻 Complete Remote Tech Engineering Sprint (+₦12,000 Cash)',
              description: 'Ship code review and backend API endpoint for international client.',
              rewardCash: 12000,
              rewardCred: 20,
              dialogueResponse: '💻 Pull request approved and merged into production! ₦12,000 remote salary credited to your wallet! Street Cred +20!',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_aunty_funke',
          name: 'Aunty Funke',
          role: 'Resident',
          title: 'Family / Host',
          relativePosition: new THREE.Vector3(-2, 0, 4),
          rotationY: Math.PI / 2,
          outfitColor: 0xd97706, // Traditional golden Ankara
          dialogueGreeting: 'Welcome back home my dear! Have you eaten? The jollof is inside the warmer, and the fan is on for you!',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Room structure
    const room = InteriorPrefabs.createRoom(26, 22, 4.2, 0xf1f5f9, 0x334155);
    this.group.add(room);

    // 2. Ceiling Lights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.0, 3), 0xffedd5));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(7, 4.0, -5), 0xffedd5));

    // 3. Exit Door
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 11), 0);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Apartment Front Door',
      category: 'Exit to Street',
      description: 'Step outside through the compound gate back to the street.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10),
    });

    // 4. Living Room
    // Emerald Green Velvet Sofa
    const sofaGeo = new THREE.BoxGeometry(4.8, 1.2, 1.8);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.7 });
    const sofa = new THREE.Mesh(sofaGeo, sofaMat);
    sofa.position.set(-2, 0.6, 6);
    this.group.add(sofa);

    // 75-inch TV Unit
    const tvUnit = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.2, 6.5),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
    );
    tvUnit.position.set(-12.8, 2.4, 3);
    this.group.add(tvUnit);

    const screenGeo = new THREE.PlaneGeometry(6.2, 2.8);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    this.tvScreen = new THREE.Mesh(screenGeo, screenMat);
    this.tvScreen.rotation.y = Math.PI / 2;
    this.tvScreen.position.set(-12.65, 2.4, 3);
    this.group.add(this.tvScreen);

    // Oscillating standing fan
    const fan = this.createStandingFan(-1, 0, 2);
    this.group.add(fan);

    // 5. Master Bedroom
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.8, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    bedFrame.position.set(7.5, 0.4, -5.5);
    this.group.add(bedFrame);

    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.5, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 }) // Royal purple duvet
    );
    mattress.position.set(7.5, 0.9, -5.5);
    this.group.add(mattress);

    // 6. Iconic Blue Water Drum & Red Bucket
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
    );
    drum.position.set(8.5, 0.9, 5.5);
    this.group.add(drum);

    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    bucket.position.set(9.7, 0.4, 5.7);
    this.group.add(bucket);

    // 7. Home Workstation Desk
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    desk.position.set(-6.5, 0.55, -5.5);
    this.group.add(desk);

    // Laptop
    const laptop = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
    );
    laptop.position.set(-6.5, 1.15, -5.5);
    this.group.add(laptop);

    // 8. Build NPCs
    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: 'House Resident',
        description: npcDef.dialogueGreeting,
        interactionPoint: new THREE.Vector3(
          this.group.position.x + npcDef.relativePosition.x,
          0,
          this.group.position.z + npcDef.relativePosition.z + 1.2
        ),
      });
    }

    // 9. Register Station Interactive Objects
    for (const station of this.def.stations) {
      this.interactiveList.push({
        mesh: this.group,
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

  private createStandingFan(x: number, y: number, z: number): THREE.Group {
    const fanGroup = new THREE.Group();
    fanGroup.position.set(x, y, z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0x18181b }));
    fanGroup.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.8 }));
    pole.position.y = 1.1;
    fanGroup.add(pole);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.2, 0);

    const blades = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
    headGroup.add(blades);

    this.fanBlades.push(blades);
    this.fanHeads.push(headGroup);
    fanGroup.add(headGroup);

    return fanGroup;
  }

  public update(delta: number, time: number): void {
    this.animTime += delta;

    for (const npc of this.npcs) {
      npc.update(delta, time);
    }

    for (const blade of this.fanBlades) {
      blade.rotation.z += delta * 24;
    }

    for (const head of this.fanHeads) {
      head.rotation.y = Math.sin(this.animTime * 1.5) * 0.7;
    }

    if (this.tvScreen) {
      const g = 0.5 + Math.sin(this.animTime * 6) * 0.15;
      (this.tvScreen.material as THREE.MeshBasicMaterial).color.setRGB(0.1, g, 0.2);
    }
  }
}
