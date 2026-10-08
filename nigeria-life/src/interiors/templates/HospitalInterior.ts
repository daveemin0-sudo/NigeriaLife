import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class HospitalInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for the hospital interior
    const origin = new THREE.Vector3(260, 0, 40);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_hospital',
      name: 'St. Nicholas Lagos General Hospital',
      type: 'hospital',
      tier: 'tier3_simulated',
      districtName: 'Lagos Island Medical District',
      streetBuildingId: 'lagos-hospital',
      streetEntrance: new THREE.Vector3(12, 0, 75), // Door outside in district
      streetExitRotation: Math.PI,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 9),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xe0f2fe,
      ambientLightIntensity: 1.2,
      rooms: [
        {
          id: 'hospital_main_hall',
          name: 'General Medical Ward & Clinic',
          size: { width: 24, length: 22, height: 4.5 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xe2e8f0, // Clean clinical grey-white tile
          wallColor: 0x334155,  // Deep navy medical cutaway
        },
      ],
      stations: [
        {
          id: 'hosp_reception',
          name: 'Patient Triage & Reception Desk',
          category: 'Medical Services',
          description: 'Front registration desk. Check vitals, record symptoms, and receive your clinic token.',
          relativePosition: new THREE.Vector3(-4, 0, 4),
          actions: [
            {
              id: 'hosp_register',
              label: '📋 Register & Vital Signs Check (₦500)',
              description: 'Register patient card and check blood pressure, temperature, and pulse.',
              cost: 500,
              rewardHealth: 20,
              dialogueResponse: '🩺 Nurse Chidinma: "Registration complete! Blood pressure is 120/80. Doctor Adeleke is waiting in Consultation Room 1."',
            },
          ],
        },
        {
          id: 'hosp_doctor_desk',
          name: 'Dr. Adeleke - Physician Consultation Desk',
          category: 'Medical Consultation',
          description: 'Executive doctor consultation suite. Diagnosis, prescriptions, and health clearance certificates.',
          relativePosition: new THREE.Vector3(6, 0, -5),
          actions: [
            {
              id: 'hosp_full_checkup',
              label: '🩺 Full Medical Diagnosis & Treatment (₦2,500)',
              description: 'Doctor conducts comprehensive checkup, administers multivitamins, and cures ailments.',
              cost: 2500,
              rewardHealth: 100,
              rewardEnergy: 50,
              rewardCred: 10,
              dialogueResponse: '👨‍⚕️ Dr. Adeleke: "Your diagnosis is looking good! Heart rate normal. I have administered a high-potency vitamin injection. Health fully restored to 100%!"',
            },
            {
              id: 'hosp_medical_certificate',
              label: '📜 Obtain Fitness & Medical Certificate (₦3,500)',
              description: 'Official Lagos State Ministry of Health certificate required for commercial driver & corporate work.',
              cost: 3500,
              rewardCred: 15,
              itemReward: {
                id: 'medical_clearance_cert',
                name: 'Lagos State Medical Fitness Certificate',
                category: 'document',
                icon: '📜',
                description: 'Stamped official fitness certificate confirming 100% peak physical and mental health.',
                price: 3500,
                usable: false,
              },
              dialogueResponse: '📜 Dr. Adeleke: "Here is your stamped Lagos State Medical Clearance certificate. You are certified 100% fit for all high-earning contracts!"',
            },
          ],
        },
        {
          id: 'hosp_ward_bed',
          name: 'Intensive Recovery Bed & IV Drip',
          category: 'Patient Recovery',
          description: 'Clinical hospital recovery bed with continuous saline IV drip.',
          relativePosition: new THREE.Vector3(-6, 0, -5),
          actions: [
            {
              id: 'hosp_rest_bed',
              label: '🛏️ Rest on Clinical Ward Bed (Full Recovery)',
              description: 'Lie down, hook up saline drip, and rest under clinical supervision.',
              rewardHealth: 100,
              rewardEnergy: 100,
              dialogueResponse: '💧 You rest peacefully on the medical bed. The saline drip cleanses your system. 100% Health & Energy restored!',
            },
          ],
        },
        {
          id: 'hosp_pharmacy',
          name: 'St. Nicholas Central Pharmacy',
          category: 'Pharmaceuticals',
          description: 'Licensed dispensary stocking WHO-certified malaria treatments, painkillers, and energy supplements.',
          relativePosition: new THREE.Vector3(7, 0, 4),
          actions: [
            {
              id: 'buy_coartem',
              label: '💊 Purchase Coartem Malaria Treatment (₦1,800)',
              description: 'Artemether-lumefantrine blister pack to cure and prevent Lagos tropical malaria.',
              cost: 1800,
              itemReward: {
                id: 'coartem_malaria',
                name: 'Coartem Malaria Pack',
                category: 'medicine',
                icon: '💊',
                description: 'Gold standard fast-acting anti-malarial tablets.',
                price: 1800,
                usable: true,
                energyRestore: 40,
              },
              dialogueResponse: '💊 Pharmacist Kemi: "Here is your Coartem dose. Take two tablets twice daily with food. Stay hydrated!"',
            },
            {
              id: 'buy_firstaid',
              label: '🩹 Purchase Emergency First Aid & Bandages (₦1,200)',
              description: 'Antiseptic methylated spirit, cotton wool, and adhesive bandages.',
              cost: 1200,
              rewardHealth: 40,
              itemReward: {
                id: 'first_aid_kit',
                name: 'Lagos Red Cross First Aid Kit',
                category: 'medicine',
                icon: '🩹',
                description: 'Compact emergency trauma & wound dressing kit.',
                price: 1200,
                usable: true,
                energyRestore: 25,
              },
              dialogueResponse: '🩹 Pharmacist Kemi: "Emergency first aid kit packed and ready! Health boosted +40%."',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_nurse_chidinma',
          name: 'Nurse Chidinma',
          role: 'Nurse',
          title: 'Senior Triage Nurse',
          relativePosition: new THREE.Vector3(-4, 0, 2.8),
          rotationY: 0,
          outfitColor: 0x0284c7, // Medical Cyan scrubs
          dialogueGreeting: 'Hello there! Welcome to St. Nicholas Hospital. Are you here for a routine checkup or emergency care?',
          actions: [],
        },
        {
          id: 'npc_dr_adeleke',
          name: 'Dr. Adeleke',
          role: 'Doctor',
          title: 'Chief Medical Consultant',
          relativePosition: new THREE.Vector3(6, 0, -6.2),
          rotationY: 0,
          outfitColor: 0xf8fafc, // Pure white doctor lab coat
          hasStethoscope: true,
          hasTie: true,
          dialogueGreeting: 'Good day! Take a seat please. How can I help restore your vitals today?',
          actions: [],
        },
        {
          id: 'npc_pharmacist_kemi',
          name: 'Pharm. Kemi',
          role: 'Pharmacist',
          title: 'Dispensary Lead',
          relativePosition: new THREE.Vector3(7, 0, 2.8),
          rotationY: 0,
          outfitColor: 0x059669, // Emerald pharmacy coat
          dialogueGreeting: 'Welcome to the pharmacy! We have genuine medicines directly from national distribution.',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Modular Room structure (24 x 22)
    const room = InteriorPrefabs.createRoom(24, 22, 4.5, 0xe2e8f0, 0x1e293b);
    this.group.add(room);

    // 2. Fluorescent Ceiling Lights
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.2, -4), 0xe0f2fe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(6, 4.2, -4), 0xe0f2fe));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(0, 4.2, 5), 0xe0f2fe));

    // 3. Exit Door leading back outside
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 11), 0);
    this.group.add(exitDoor);

    // Register exit door interactive object
    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Hospital Main Exit Doors',
      category: 'Exit to Street',
      description: 'Automatic double sliding glass doors. Step outside onto the Lagos streets.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10),
    });

    // 4. Furniture & Stations
    // Doctor consultation desk
    const docDesk = InteriorPrefabs.createDoctorDesk(new THREE.Vector3(6, 0, -5), 0);
    this.group.add(docDesk);

    // Hospital Bed 1
    const bed1 = InteriorPrefabs.createHospitalBed(new THREE.Vector3(-6, 0, -5), 0);
    this.group.add(bed1);

    // Hospital Bed 2
    const bed2 = InteriorPrefabs.createHospitalBed(new THREE.Vector3(-1.5, 0, -5), 0);
    this.group.add(bed2);

    // Waiting Area Chairs
    const chairs = InteriorPrefabs.createWaitingChairs(new THREE.Vector3(-1, 0, 3.5), 5);
    this.group.add(chairs);

    // Pharmacy Shelving
    const pharmShelf = InteriorPrefabs.createPharmacyShelf(new THREE.Vector3(7, 0, 5), 0);
    this.group.add(pharmShelf);

    // Reception Triage counter
    const triageCounter = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 })
    );
    triageCounter.position.set(-4, 0.55, 4);
    this.group.add(triageCounter);

    // Red Cross Hospital Emblem on back wall
    const crossGroup = new THREE.Group();
    crossGroup.position.set(0, 3.2, -10.8);
    const crossBarV = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const crossBarH = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    crossGroup.add(crossBarV);
    crossGroup.add(crossBarH);
    this.group.add(crossGroup);

    // 5. Build NPCs
    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      // Register each NPC as an interactive object
      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: 'Hospital Staff',
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
