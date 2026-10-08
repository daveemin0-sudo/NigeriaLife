import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class AirportInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  // Animated elements
  private departureBoardPulse: number = 0;

  constructor() {
    this.group = new THREE.Group();
    // Isolated world coordinates for MMA2 Airport interior
    const origin = new THREE.Vector3(260, 0, 240);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_airport',
      name: 'Murtala Muhammed International Airport (LOS)',
      type: 'airport',
      tier: 'tier3_simulated',
      districtName: 'Ikeja Aviation Corridor',
      streetBuildingId: 'mma-airport',
      streetEntrance: new THREE.Vector3(-80, 0, -105),
      streetExitRotation: 0,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 10),
      exitDoorOffset: new THREE.Vector3(0, 0, 12),
      cameraOffset: new THREE.Vector3(0, 16, 20),
      ambientLightColor: 0xe0f2fe, // Crisp modern aviation white-blue lighting
      ambientLightIntensity: 1.35,
      rooms: [
        {
          id: 'airport_main_terminal',
          name: 'MMA2 Departure Concourse & Flight Gates',
          size: { width: 30, length: 26, height: 6.0 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xf1f5f9, // Reflective bright polished airport terminal terrazzo
          wallColor: 0x0f172a,  // Midnight blue executive aviation terminal wall
        },
      ],
      stations: [
        {
          id: 'airport_checkin_desk',
          name: 'Air Peace Flight Check-In Desk',
          category: 'Aviation Check-In',
          description: 'Terminal ticket verification, luggage tagging, and boarding pass issuance.',
          relativePosition: new THREE.Vector3(-7, 0, 2),
          actions: [
            {
              id: 'airport_issue_boarding_pass',
              label: '🎫 Flight Check-In & Boarding Pass',
              description: 'Check in baggage and receive verified Air Peace boarding pass.',
              cost: 0,
              rewardSocial: 10,
              itemReward: {
                id: 'boarding_pass_ticket',
                name: 'Air Peace Digital Boarding Pass',
                category: 'document',
                price: 0,
                usable: true,
                icon: '🎫',
                description: 'Verified boarding pass for Gate 2 Interstate Departures.',
              },
              dialogueResponse: '🎫 Check-In Officer: "Baggage checked! Here is your verified boarding pass. Please proceed through Security Screening."',
            },
          ],
        },
        {
          id: 'airport_security_gate',
          name: 'FAAN Security & Metal Detector Checkpoint',
          category: 'Aviation Security',
          description: 'High-security passenger screening arch and luggage X-ray conveyer belt.',
          relativePosition: new THREE.Vector3(0, 0, 0),
          actions: [
            {
              id: 'airport_pass_security',
              label: '🛡️ Clear Aviation Security & Customs',
              description: 'Step through the metal detector and scan your carry-on luggage.',
              cost: 0,
              rewardKnowledge: 10,
              dialogueResponse: '🛡️ Officer Ngozi: "Beep! You are clear to proceed into the Departure Concourse. Safe travels!"',
            },
          ],
        },
        {
          id: 'airport_flight_abuja',
          name: 'Gate 1: Abuja Federal Capital Departure',
          category: 'Interstate Flight',
          description: 'Direct 55-minute scheduled jet flight to Nnamdi Azikiwe International Airport, Abuja FCT.',
          relativePosition: new THREE.Vector3(8, 0, -8),
          actions: [
            {
              id: 'airport_fly_abuja_action',
              label: '✈️ Board Flight to Abuja FCT (₦35,000)',
              description: 'Board Air Peace Boeing 737 express flight directly to Abuja.',
              cost: 35000,
              rewardCred: 25,
              dialogueResponse: '✈️ "Captain Ibrahim: Welcome aboard Flight P4-7120 to Abuja FCT. Fasten your seatbelts for takeoff!"',
            },
          ],
        },
        {
          id: 'airport_flight_ph',
          name: 'Gate 2: Port Harcourt Departure',
          category: 'Interstate Flight',
          description: 'Direct coastal hopper flight to Port Harcourt International Airport (Omagwa), Rivers State.',
          relativePosition: new THREE.Vector3(12, 0, -8),
          actions: [
            {
              id: 'airport_fly_ph_action',
              label: '✈️ Board Flight to Port Harcourt (₦38,000)',
              description: 'Board Ibom Air flight directly to Port Harcourt Garden City.',
              cost: 38000,
              rewardCred: 25,
              dialogueResponse: '✈️ "Welcome aboard flight QI-0402 to Port Harcourt. Preparing for runway departure!"',
            },
          ],
        },
        {
          id: 'airport_vip_lounge',
          name: 'Arik VIP Executive Lounge',
          category: 'Airport Lounge',
          description: 'First-class waiting lounge with buffet delicacies, chilled malt, private Wi-Fi, and plush sofas.',
          relativePosition: new THREE.Vector3(-9, 0, -7),
          actions: [
            {
              id: 'airport_enter_vip_lounge',
              label: '🥂 Relax in Executive VIP Lounge (₦5,000)',
              description: 'Recharge completely with luxury hospitality before your flight departure.',
              cost: 5000,
              rewardHealth: 100,
              rewardEnergy: 100,
              dialogueResponse: '🥂 "Welcome to the VIP Lounge. Enjoy chilled Chapman and gourmet small chops. 100% Health & Energy restored!"',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_captain_ibrahim',
          name: 'Capt. Ibrahim Lawal',
          role: 'Flight Captain',
          title: 'Senior Fleet Commander',
          relativePosition: new THREE.Vector3(6, 0, -6),
          rotationY: Math.PI,
          outfitColor: 0x0284c7, // Crisp airline pilot uniform with gold trim
          hasTie: true,
          dialogueGreeting: 'Good day! Weather en-route to Abuja is crystal clear. We expect smooth cruising at 32,000 feet.',
          actions: [],
        },
        {
          id: 'npc_officer_ngozi',
          name: 'Officer Ngozi Adeleke',
          role: 'Security Commander',
          title: 'FAAN Aviation Officer',
          relativePosition: new THREE.Vector3(-2.5, 0, 0),
          rotationY: Math.PI / 2,
          outfitColor: 0x1e293b, // Tactical midnight uniform
          dialogueGreeting: 'Welcome to MMA2. Please keep your personal baggage attended at all times.',
          actions: [],
        },
        {
          id: 'npc_traveler_chuka',
          name: 'Chuka Emeka',
          role: 'Traveler',
          title: 'International Business Executive',
          relativePosition: new THREE.Vector3(4, 0, 3),
          rotationY: -Math.PI / 3,
          outfitColor: 0xb45309, // Smart casual blazer
          dialogueGreeting: 'Just checking in for the morning business meeting in Abuja. The terminal is buzzing today!',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Room shell (30m wide x 26m deep x 6m high)
    const room = InteriorPrefabs.createRoom(30, 26, 6.0, 0xf1f5f9, 0x0f172a);
    this.group.add(room);

    // 2. High ceiling terminal floodlights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-8, 5.8, -6), 0xe0f2fe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(8, 5.8, -6), 0xe0f2fe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-8, 5.8, 6), 0xe0f2fe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(8, 5.8, 6), 0xe0f2fe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(0, 5.8, 0), 0xffffff));

    // 3. Exit Door leading outside to Ikeja Airport Road
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 12), Math.PI);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Airport Terminal Curbside Doors',
      category: 'Exit',
      description: 'Exit departures terminal and return outside to airport street.',
      interactionPoint: new THREE.Vector3(0, 0, 10.8),
    });

    // 4. Large Digital Flight Departure Board on the central back wall
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 3.8, -12.6);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(16, 3.6, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.1, metalness: 0.8 }) // Gloss black digital display
    );
    boardGroup.add(board);

    // Digital text rows simulation (amber LEDs)
    for (let row = -1.2; row <= 1.2; row += 0.6) {
      const ledRow = new THREE.Mesh(
        new THREE.BoxGeometry(15.2, 0.35, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b }) // Amber departure flight info
      );
      ledRow.position.set(0, row, 0.11);
      boardGroup.add(ledRow);
    }
    this.group.add(boardGroup);

    // 5. Check-In Desks (Left Concourse)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-7, 0, 2);

    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(6.5, 1.15, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5, roughness: 0.3 }) // Air Peace Cyan Desk
    );
    desk.position.y = 0.575;
    deskGroup.add(desk);

    // Computer screens on check-in desk
    for (let sx of [-1.8, 0, 1.8]) {
      const mon = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.5, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 })
      );
      mon.position.set(sx, 1.35, 0.2);
      deskGroup.add(mon);

      // Luggage weight scale
      const scale = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.08, 1.0),
        new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 })
      );
      scale.position.set(sx, 0.04, -1.4);
      deskGroup.add(scale);
    }

    this.group.add(deskGroup);

    this.interactiveList.push({
      mesh: deskGroup,
      id: 'airport_checkin_desk',
      name: 'Air Peace Flight Check-In Desk',
      category: 'Aviation Check-In',
      description: 'Terminal ticket verification, luggage tagging, and boarding pass issuance.',
      interactionPoint: new THREE.Vector3(-7, 0, 0.8),
    });

    // 6. Security Screening Arch & Conveyer (Center Concourse)
    const secGroup = new THREE.Group();
    secGroup.position.set(0, 0, 0);

    // Walk-through metal detector arch
    const archLeft = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 2.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    archLeft.position.set(-0.9, 1.4, 0);
    secGroup.add(archLeft);

    const archRight = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 2.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    archRight.position.set(0.9, 1.4, 0);
    secGroup.add(archRight);

    const archTop = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 0.35, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x22c55e }) // Green indicator
    );
    archTop.position.set(0, 2.65, 0);
    secGroup.add(archTop);

    // X-Ray conveyer belt scanner on side
    const xray = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.3, 3.2),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6 })
    );
    xray.position.set(2.4, 0.65, 0);
    secGroup.add(xray);

    this.group.add(secGroup);

    this.interactiveList.push({
      mesh: secGroup,
      id: 'airport_security_gate',
      name: 'FAAN Security & Metal Detector Checkpoint',
      category: 'Aviation Security',
      description: 'High-security passenger screening arch and luggage X-ray conveyer belt.',
      interactionPoint: new THREE.Vector3(0, 0, 1.5),
    });

    // 7. Gate 1: Abuja Departure Boarding Gate (Back Right)
    const gateAbuja = new THREE.Group();
    gateAbuja.position.set(8, 0, -8);

    const gate1Portal = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 3.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 })
    );
    gate1Portal.position.y = 1.6;
    gateAbuja.add(gate1Portal);

    const gate1Sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.6, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    gate1Sign.position.set(0, 2.8, 0.45);
    gateAbuja.add(gate1Sign);

    this.group.add(gateAbuja);

    this.interactiveList.push({
      mesh: gateAbuja,
      id: 'airport_flight_abuja',
      name: 'Gate 1: Abuja Federal Capital Departure',
      category: 'Interstate Flight',
      description: 'Direct 55-minute scheduled jet flight to Nnamdi Azikiwe International Airport, Abuja FCT.',
      interactionPoint: new THREE.Vector3(8, 0, -6.5),
    });

    // 8. Gate 2: Port Harcourt Departure Boarding Gate (Far Right)
    const gatePH = new THREE.Group();
    gatePH.position.set(12, 0, -8);

    const gate2Portal = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 3.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.3 })
    );
    gate2Portal.position.y = 1.6;
    gatePH.add(gate2Portal);

    const gate2Sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.6, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x34d399 })
    );
    gate2Sign.position.set(0, 2.8, 0.45);
    gatePH.add(gate2Sign);

    this.group.add(gatePH);

    this.interactiveList.push({
      mesh: gatePH,
      id: 'airport_flight_ph',
      name: 'Gate 2: Port Harcourt Departure',
      category: 'Interstate Flight',
      description: 'Direct coastal hopper flight to Port Harcourt International Airport (Omagwa), Rivers State.',
      interactionPoint: new THREE.Vector3(12, 0, -6.5),
    });

    // 9. Arik VIP Executive Lounge (Back Left)
    const vipGroup = new THREE.Group();
    vipGroup.position.set(-9, 0, -7);

    // Luxury leather sofa
    const sofa = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.9, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.4 }) // Regal burgundy leather sofa
    );
    sofa.position.y = 0.45;
    vipGroup.add(sofa);

    // Coffee / Refreshment Bar Table
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 1.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3 })
    );
    bar.position.set(0, 0.55, 2.2);
    vipGroup.add(bar);

    this.group.add(vipGroup);

    this.interactiveList.push({
      mesh: vipGroup,
      id: 'airport_vip_lounge',
      name: 'Arik VIP Executive Lounge',
      category: 'Airport Lounge',
      description: 'First-class waiting lounge with buffet delicacies, chilled malt, private Wi-Fi, and plush sofas.',
      interactionPoint: new THREE.Vector3(-9, 0, -5.2),
    });

    // 10. Instantiate Character 2.0 NPCs
    this.def.npcs.forEach((npcDef) => {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: npcDef.name,
        category: `Airport • ${npcDef.role}`,
        description: npcDef.dialogueGreeting,
        interactionPoint: npcDef.relativePosition.clone().add(new THREE.Vector3(0, 0, 1.2)),
      });
    });
  }

  public update(delta: number, animTime: number): void {
    this.departureBoardPulse += delta;
    this.npcs.forEach((npc) => npc.update(delta, animTime));
  }
}
