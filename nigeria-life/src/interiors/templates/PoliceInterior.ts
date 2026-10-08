import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class PoliceInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for the police station interior
    const origin = new THREE.Vector3(260, 0, 340);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_police',
      name: 'Lagos State Area Command Headquarters',
      type: 'police',
      tier: 'tier3_simulated',
      districtName: 'Lagos Central Command Zone',
      streetBuildingId: 'police-station',
      streetEntrance: new THREE.Vector3(-18, 0, 65), // Door outside in district
      streetExitRotation: 0,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 9),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xdbeafe,
      ambientLightIntensity: 1.15,
      rooms: [
        {
          id: 'police_charge_room',
          name: 'Main Charge Room & Holding Block',
          size: { width: 24, length: 22, height: 4.5 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0x94a3b8, // Rugged grey police floor
          wallColor: 0x1e293b,  // Dark blue-slate official walls
        },
      ],
      stations: [
        {
          id: 'police_front_desk',
          name: 'Desk Sergeant Incident & Charge Counter',
          category: 'Police Services',
          description: 'Official charge counter. File incident reports, report traffic extortion, or verify warrants.',
          relativePosition: new THREE.Vector3(-4, 0, -4),
          actions: [
            {
              id: 'file_police_report',
              label: '📝 File Official Citizen Incident Report (₦500)',
              description: 'Report street theft, unauthorized extortion, or traffic incidents to the desk sergeant.',
              cost: 500,
              rewardCred: 20,
              dialogueResponse: '👮 Sgt. Danladi: "Report documented in the Lagos Area Command logbook! Reference Number: #NIG-8492. We take street security seriously. +20 Street Cred!"',
            },
            {
              id: 'police_clearance_cert',
              label: '📜 Obtain Official Police Character Clearance (₦3,500)',
              description: 'Official certificate required for high-tier corporate appointments and luxury estate tenancy.',
              cost: 3500,
              rewardCred: 30,
              itemReward: {
                id: 'police_clearance_cert',
                name: 'Nigeria Police Good Conduct Certificate',
                category: 'document',
                icon: '📜',
                description: 'Official stamped certificate of good conduct from the Inspector General CID registry.',
                price: 3500,
                usable: false,
              },
              dialogueResponse: '📜 Sgt. Danladi: "Fingerprint biometric scan passed with zero criminal record! Here is your stamped Certificate of Character Clearance. Doors are open for you across Lagos!"',
            },
          ],
        },
        {
          id: 'police_holding_cell',
          name: 'Detention Holding Cell Block & Bail Desk',
          category: 'Holding Cells',
          description: 'Reinforced steel bars holding detained suspects awaiting court arraignment.',
          relativePosition: new THREE.Vector3(6, 0, -5),
          actions: [
            {
              id: 'pay_bail_bond',
              label: '⚖️ Pay Citizen Bail Bond Release (₦5,000)',
              description: 'Post bail bond to release detained citizen Kazeem from the holding cell.',
              cost: 5000,
              rewardCred: 40,
              dialogueResponse: '⚖️ Sgt. Danladi: "Bail bond processed and signed! Suspect Kazeem has been released on good behavior. You have earned massive respect in the community (+40 Street Cred)!"',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_sgt_danladi',
          name: 'Sgt. Danladi',
          role: 'Police_Sergeant',
          title: 'Desk Sergeant',
          relativePosition: new THREE.Vector3(-4, 0, -5.5),
          rotationY: 0,
          outfitColor: 0x09090b, // Dark police tactical black
          hasPoliceCap: true,
          dialogueGreeting: 'State your business citizen! We maintain law and order 24/7 across Lagos State.',
          actions: [],
        },
        {
          id: 'npc_constable_emeka',
          name: 'Constable Emeka',
          role: 'Police_Officer',
          title: 'Investigating Officer',
          relativePosition: new THREE.Vector3(-4, 0, 2),
          rotationY: 0,
          outfitColor: 0x1e3a8a, // Navy blue uniform
          hasPoliceCap: true,
          dialogueGreeting: 'Good day! All statements and citizen records are safely verified and logged here.',
          actions: [],
        },
        {
          id: 'npc_suspect_kazeem',
          name: 'Kazeem',
          role: 'Inmate',
          title: 'Detained Citizen',
          relativePosition: new THREE.Vector3(6, 0, -5),
          rotationY: 0,
          outfitColor: 0xf97316, // Orange detention uniform
          dialogueGreeting: 'Bros abeg help me pay bail! They held me for driving one-way near Ikeja bus stop! Help a brother out!',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Room structure
    const room = InteriorPrefabs.createRoom(24, 22, 4.5, 0x94a3b8, 0x1e293b);
    this.group.add(room);

    // 2. Ceiling Lights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-4, 4.2, -4), 0xdbeafe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(6, 4.2, -4), 0xdbeafe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(0, 4.2, 5), 0xdbeafe));

    // 3. Exit Door
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 11), 0);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Police Command Exit Door',
      category: 'Exit to Street',
      description: 'Double security doors opening back onto Lagos streets.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10),
    });

    // 4. Stations & Props
    // Desk Sergeant Front Counter
    const frontDesk = InteriorPrefabs.createPoliceFrontDesk(new THREE.Vector3(-4, 0, -4), 0);
    this.group.add(frontDesk);

    // Investigating Officer Desk
    const invDesk = InteriorPrefabs.createDoctorDesk(new THREE.Vector3(-4, 0, 2), 0);
    this.group.add(invDesk);

    // Holding Cell Block with Steel Iron Bars
    const cell = InteriorPrefabs.createHoldingCell(new THREE.Vector3(6, 0, -5), 6.5, 5.5);
    this.group.add(cell);

    // Wanted Posters Board
    const wantedBoard = InteriorPrefabs.createWantedBoard(new THREE.Vector3(-11.5, 0, 0), Math.PI / 2);
    this.group.add(wantedBoard);

    // Waiting Bench for citizens
    const bench = InteriorPrefabs.createWaitingChairs(new THREE.Vector3(0, 0, 5), 4);
    this.group.add(bench);

    // Nigerian Flag & Police Shield on back wall
    const flagGroup = new THREE.Group();
    flagGroup.position.set(0, 3.2, -10.8);
    for (let f = 0; f < 3; f++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 1.6, 0.05),
        new THREE.MeshBasicMaterial({ color: f === 1 ? 0xffffff : 0x16a34a })
      );
      stripe.position.set(-0.8 + f * 0.8, 0, 0);
      flagGroup.add(stripe);
    }
    this.group.add(flagGroup);

    // 5. Build NPCs
    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: 'Police Personnel',
        description: npcDef.dialogueGreeting,
        interactionPoint: new THREE.Vector3(
          this.group.position.x + npcDef.relativePosition.x,
          0,
          this.group.position.z + npcDef.relativePosition.z + 1.2
        ),
      });
    }

    // 6. Register Station Interactive Objects
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

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) {
      npc.update(delta, time);
    }
  }
}
