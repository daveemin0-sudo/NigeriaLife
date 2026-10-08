import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import { AssetManager } from '../../assets/AssetManager';

export class AirportInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  // Animated elements
  private departureBoardPulse: number = 0;
  private turbineFans: THREE.Mesh[] = [];
  private tarmacLights: THREE.Mesh[] = [];

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
          name: 'Wazobia Air Flight Check-In Desk',
          category: 'Aviation Check-In',
          description: 'Terminal ticket verification, luggage tagging, and boarding pass issuance.',
          relativePosition: new THREE.Vector3(-7, 0, 2),
          actions: [
            {
              id: 'airport_issue_boarding_pass',
              label: '🎫 Flight Check-In & Boarding Pass',
              description: 'Check in baggage and receive verified Wazobia Air boarding pass.',
              cost: 0,
              rewardSocial: 10,
              itemReward: {
                id: 'boarding_pass_ticket',
                name: 'Wazobia Air Digital Boarding Pass',
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
              description: 'Board Wazobia Air express jet flight directly to Abuja.',
              cost: 35000,
              rewardCred: 25,
              dialogueResponse: '✈️ "Captain Ibrahim: Welcome aboard Flight WZ-7120 to Abuja FCT. Fasten your seatbelts for takeoff!"',
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
              description: 'Board EagleWings flight directly to Port Harcourt Garden City.',
              cost: 38000,
              rewardCred: 25,
              dialogueResponse: '✈️ "Welcome aboard flight EW-0402 to Port Harcourt. Preparing for runway departure!"',
            },
          ],
        },
        {
          id: 'airport_vip_lounge',
          name: 'EagleWings VIP Executive Lounge',
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
      name: 'Wazobia Air Flight Check-In Desk',
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

    // 9. EagleWings VIP Executive Lounge (Back Left)
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
      name: 'EagleWings VIP Executive Lounge',
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

    // 11. Apron Tarmac & Wazobia Air Commercial Jet View
    this.buildTarmacAndAirliner();
  }

  // =========================================================================
  // 11. APRON TARMAC & WAZOBIA AIR JET 737 REALISM
  // =========================================================================
  private buildTarmacAndAirliner(): void {
    const tarmacGroup = new THREE.Group();
    tarmacGroup.position.set(0, 0, -22);

    // 1. Apron Asphalt Ground Plane
    const asphaltGeo = new THREE.PlaneGeometry(36, 20);
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
      metalness: 0.1,
    });
    const tarmacGround = new THREE.Mesh(asphaltGeo, asphaltMat);
    tarmacGround.rotation.x = -Math.PI / 2;
    tarmacGround.position.y = -0.05;
    tarmacGround.receiveShadow = true;
    tarmacGroup.add(tarmacGround);

    // 2. Yellow Taxiway Centerline & Stop Markings
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const taxiLine = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 18), lineMat);
    taxiLine.rotation.x = -Math.PI / 2;
    taxiLine.position.set(0, 0.01, 0);
    tarmacGroup.add(taxiLine);

    const stopLine = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.position.set(0, 0.02, 3.5);
    tarmacGroup.add(stopLine);

    // 3. Runway Edge / Taxiway Guidance Blue & Green LED Beacons
    for (const lx of [-16, 16]) {
      for (let lz = -8; lz <= 8; lz += 4) {
        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x0284c7,
            emissiveIntensity: 2.0,
          })
        );
        beacon.position.set(lx, 0.18, lz);
        tarmacGroup.add(beacon);
        this.tarmacLights.push(beacon);
      }
    }

    // 4. Panoramic Glass Concourse Wall (between gates and tarmac)
    const glassWallGroup = new THREE.Group();
    glassWallGroup.position.set(0, 2.5, -13.0);

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      roughness: 0.05,
      transmission: 0.85,
      ior: 1.5,
      transparent: true,
      opacity: 0.7,
    });
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(28, 5.0), glassMat);
    glassWallGroup.add(glassPane);

    // Brushed metal window mullions
    const mullionMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.2 });
    for (let mx = -14; mx <= 14; mx += 3.5) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 5.0, 0.15), mullionMat);
      mullion.position.set(mx, 0, 0.02);
      glassWallGroup.add(mullion);
    }
    this.group.add(glassWallGroup);

    // 5. Wazobia Air Boeing 737 Commercial Twin-Jet
    const planeGroup = new THREE.Group();
    planeGroup.position.set(3.5, 0, -2);
    planeGroup.rotation.y = -Math.PI * 0.45; // Angled parked at gate

    // A. Fuselage (Aerodynamic Main Tube)
    const fuselageGeo = new THREE.CylinderGeometry(1.5, 1.5, 18, 20);
    const planeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.2,
      metalness: 0.25,
      clearcoat: 0.85,
      clearcoatRoughness: 0.1,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, planeMat);
    fuselage.rotation.x = Math.PI / 2;
    fuselage.position.y = 2.4;
    fuselage.castShadow = true;
    planeGroup.add(fuselage);

    // B. Nose Cone
    const noseGeo = new THREE.ConeGeometry(1.5, 3.2, 20);
    const nose = new THREE.Mesh(noseGeo, planeMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 2.4, 10.5);
    planeGroup.add(nose);

    // C. Wazobia Air Iconic Blue & Red Cheatline Ribbon
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 }); // Sky blue
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 14, 20, 1, true), ribbonMat);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.set(0, 2.4, 1.0);
    planeGroup.add(ribbon);

    // D. Cockpit Windshield Glass
    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.1, metalness: 0.9 })
    );
    cockpit.position.set(0, 3.1, 9.8);
    cockpit.rotation.x = -0.3;
    planeGroup.add(cockpit);

    // E. Swept Main Wings & Winglets
    const wingMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.3 });
    const wingGeo = new THREE.BoxGeometry(16, 0.25, 3.2);
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 1.8, 0.5);
    wings.castShadow = true;
    planeGroup.add(wings);

    // Blue Wingtip Winglets
    for (const wx of [-8.0, 8.0]) {
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 1.4), ribbonMat);
      winglet.position.set(wx, 2.3, 0.5);
      planeGroup.add(winglet);
    }

    // F. Twin Turbofan Jet Engines with Animated Turbine Fan Blades
    const engineMat = new THREE.MeshPhysicalMaterial({ color: 0xf1f5f9, roughness: 0.25, metalness: 0.5 });
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });

    for (const ex of [-4.2, 4.2]) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.88, 3.6, 16), engineMat);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(ex, 1.25, 1.0);
      nacelle.castShadow = true;
      planeGroup.add(nacelle);

      // Spinning Intake Turbine Fan
      const fanHub = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 12), fanMat);
      fanHub.rotation.x = -Math.PI / 2;
      fanHub.position.set(ex, 1.25, 2.6);

      // 12 Angled Turbine Blades
      for (let b = 0; b < 12; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.02), fanMat);
        blade.rotation.z = (b * Math.PI) / 6;
        blade.position.set(Math.cos(blade.rotation.z) * 0.35, Math.sin(blade.rotation.z) * 0.35, 0);
        fanHub.add(blade);
      }

      planeGroup.add(fanHub);
      this.turbineFans.push(fanHub);
    }

    // G. Vertical Tail Fin (Wazobia Air Livery)
    const tailFinGeo = new THREE.BoxGeometry(0.2, 4.2, 3.5);
    const tailFin = new THREE.Mesh(tailFinGeo, ribbonMat);
    tailFin.position.set(0, 4.8, -7.5);
    tailFin.rotation.x = -0.35;
    planeGroup.add(tailFin);

    // H. Horizontal Stabilizers
    const hStabGeo = new THREE.BoxGeometry(6.2, 0.18, 1.8);
    const hStab = new THREE.Mesh(hStabGeo, wingMat);
    hStab.position.set(0, 3.2, -8.2);
    planeGroup.add(hStab);

    // I. Tricycle Landing Gear (Nose + Main Wheels)
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.2 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.85 });

    // Nose Gear
    const noseStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), strutMat);
    noseStrut.position.set(0, 0.7, 8.5);
    planeGroup.add(noseStrut);

    for (const nx of [-0.18, 0.18]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(nx, 0.3, 8.5);
      planeGroup.add(tire);
    }

    // Main Gear (Left & Right)
    for (const mx of [-2.4, 2.4]) {
      const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), strutMat);
      mainStrut.position.set(mx, 0.8, -0.2);
      planeGroup.add(mainStrut);

      for (const tx of [-0.22, 0.22]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 16), tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(mx + tx, 0.42, -0.2);
        planeGroup.add(tire);
      }
    }

    // 6. Ground Support: Mobile Passenger Boarding Stairs Truck
    const stairsGroup = new THREE.Group();
    stairsGroup.position.set(1.8, 0, 7.8);
    stairsGroup.rotation.y = Math.PI * 0.45;

    const truckBed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 4.0), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
    truckBed.position.y = 0.4;
    stairsGroup.add(truckBed);

    // Angled staircase steps
    const stairRamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.15, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 })
    );
    stairRamp.rotation.x = -0.55;
    stairRamp.position.set(0, 1.6, 0.2);
    stairsGroup.add(stairRamp);
    planeGroup.add(stairsGroup);

    // 7. Ground Support: Baggage Tug & Luggage Trailer
    const tugGroup = new THREE.Group();
    tugGroup.position.set(-6.5, 0, 4.5);
    const tug = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 2.4), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    tug.position.y = 0.55;
    tugGroup.add(tug);

    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2.6), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    cart.position.set(0, 0.45, -3.2);
    tugGroup.add(cart);
    planeGroup.add(tugGroup);

    tarmacGroup.add(planeGroup);
    this.group.add(tarmacGroup);

    // 8. Asynchronously swap in external GLB model if supplied
    AssetManager.getInstance().instantiate('/models/aircraft/wazobia_jet737.glb').then((glbScene) => {
      if (glbScene) {
        tarmacGroup.remove(planeGroup);
        glbScene.position.copy(planeGroup.position);
        glbScene.rotation.copy(planeGroup.rotation);
        tarmacGroup.add(glbScene);
      }
    });
  }

  public update(delta: number, animTime: number): void {
    this.departureBoardPulse += delta;
    this.npcs.forEach((npc) => npc.update(delta, animTime));

    // Spin jet engine intake turbine fan blades
    for (const fan of this.turbineFans) {
      fan.rotation.x -= delta * 20.0;
    }

    // Gentle pulse on apron taxiway guidance lights
    const lightPulse = 1.6 + Math.sin(this.departureBoardPulse * 3) * 0.4;
    for (const beacon of this.tarmacLights) {
      if (beacon.material && (beacon.material as any).emissiveIntensity !== undefined) {
        (beacon.material as any).emissiveIntensity = lightPulse;
      }
    }
  }
}
