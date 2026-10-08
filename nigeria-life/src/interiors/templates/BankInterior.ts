import * as THREE from 'three';
import type { InteriorDefinition } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';

export class BankInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;

  constructor() {
    this.group = new THREE.Group();
    // Isolated coordinate area for the bank interior
    const origin = new THREE.Vector3(260, 0, 140);
    this.group.position.copy(origin);

    this.def = {
      id: 'interior_bank',
      name: 'Eko Commercial Bank & Wealth Hub',
      type: 'bank',
      tier: 'tier3_simulated',
      districtName: 'Broad Street Commercial Core',
      streetBuildingId: 'lagos-bank',
      streetEntrance: new THREE.Vector3(8.5, 0, -22), // Outside door coordinate
      streetExitRotation: 0,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, 9),
      exitDoorOffset: new THREE.Vector3(0, 0, 11),
      cameraOffset: new THREE.Vector3(0, 14, 18),
      ambientLightColor: 0xfef3c7,
      ambientLightIntensity: 1.15,
      rooms: [
        {
          id: 'bank_banking_hall',
          name: 'Main Banking Hall & Wealth Management',
          size: { width: 24, length: 22, height: 4.5 },
          centerOffset: new THREE.Vector3(0, 0, 0),
          floorColor: 0xf1f5f9, // Polished granite flooring
          wallColor: 0x0f172a,  // Corporate obsidian & gold trim
        },
      ],
      stations: [
        {
          id: 'bank_atm_station',
          name: '24/7 Fast ATM Terminal',
          category: 'ATM Banking',
          description: 'Instant cash dispenser and automated note validator.',
          relativePosition: new THREE.Vector3(-7, 0, 2),
          actions: [
            {
              id: 'bank_atm_quick_withdraw',
              label: '🏧 Withdraw ₦10,000 Cash from Bank Balance',
              description: 'Dispenses pristine crisp polymer notes directly into your wallet.',
              rewardCash: 10000,
              dialogueResponse: '🏧 *Whirring sound of cash dispenser* ₦10,000 dispensed! Thank you for banking with Eko Commercial Bank.',
            },
            {
              id: 'bank_atm_deposit',
              label: '💵 Deposit ₦5,000 Cash into Savings Balance',
              description: 'Insert cash into envelope slot to credit your bank account.',
              cost: 5000,
              dialogueResponse: '💵 Note validator accepted ₦5,000 deposit. Bank account balance credited successfully!',
            },
          ],
        },
        {
          id: 'bank_teller_station',
          name: 'Teller Counter #1 - Cash Services',
          category: 'Teller Desk',
          description: 'Dedicated cashier window for bulk cash processing and foreign currency exchange.',
          relativePosition: new THREE.Vector3(0, 0, -6),
          actions: [
            {
              id: 'bank_teller_exchange',
              label: '💱 Foreign Remittance & Diaspora Wire Pickup (₦25,000)',
              description: 'Claim incoming western union / wire transfer from abroad.',
              rewardCash: 25000,
              rewardCred: 15,
              dialogueResponse: '💱 Teller Ngozi: "Wire verification confirmed! ₦25,000 cash paid over the counter. Have a wonderful day!"',
            },
          ],
        },
        {
          id: 'bank_manager_desk',
          name: 'Branch Manager - Executive Loan & SME Suite',
          category: 'Commercial Loans',
          description: 'Consultation with the branch manager for capital financing and investment assets.',
          relativePosition: new THREE.Vector3(7, 0, -5),
          actions: [
            {
              id: 'bank_apply_sme_loan',
              label: '💼 Apply for Lagos SME Business Loan (+₦50,000 Capital)',
              description: 'Approved commercial credit facility for purchasing inventory, tools, or real estate.',
              rewardCash: 50000,
              rewardCred: 30,
              dialogueResponse: '💼 Manager Bankole: "Congratulations! Your business proposal and street credit check out. ₦50,000 business loan disbursed into your account!"',
            },
            {
              id: 'bank_open_premium_account',
              label: '📈 Open High-Yield Platinum Savings Account (₦10,000)',
              description: 'Upgrades bank standing and unlocks exclusive financial services.',
              cost: 10000,
              rewardCred: 25,
              itemReward: {
                id: 'platinum_debit_card',
                name: 'Eko Platinum Mastercard',
                category: 'luxury',
                icon: '💳',
                description: 'Prestige black obsidian bank card with zero ATM fees across Nigeria.',
                price: 10000,
                usable: false,
              },
              dialogueResponse: '💳 Manager Bankole: "Welcome to Eko Platinum Wealth! Here is your Black Titanium card. Your daily transaction limits have been quadrupled!"',
            },
          ],
        },
      ],
      npcs: [
        {
          id: 'npc_bank_security',
          name: 'Officer Musa',
          role: 'Security',
          title: 'Head of Bank Security',
          relativePosition: new THREE.Vector3(-2, 0, 7),
          rotationY: Math.PI,
          outfitColor: 0x1e293b, // Dark security uniform
          dialogueGreeting: 'Welcome to Eko Bank Sah! Please walk through the metal detector. Keep all mobile phones on silent.',
          actions: [],
        },
        {
          id: 'npc_bank_teller',
          name: 'Ngozi',
          role: 'Teller',
          title: 'Senior Cashier & Teller',
          relativePosition: new THREE.Vector3(0, 0, -7.2),
          rotationY: 0,
          outfitColor: 0x0284c7, // Corporate bank blue blazer
          dialogueGreeting: 'Good day! How may I assist your deposits or withdrawals today?',
          actions: [],
        },
        {
          id: 'npc_bank_manager',
          name: 'Mr. Bankole',
          role: 'Bank_Manager',
          title: 'Branch Director',
          relativePosition: new THREE.Vector3(7, 0, -6.2),
          rotationY: 0,
          outfitColor: 0x09090b, // Tailored 3-piece business suit
          hasTie: true,
          dialogueGreeting: 'Good day esteemed client! Looking to expand your businesses or secure enterprise loans?',
          actions: [],
        },
      ],
    };

    this.build3DInterior();
  }

  private build3DInterior(): void {
    // 1. Room structure
    const room = InteriorPrefabs.createRoom(24, 22, 4.5, 0xf1f5f9, 0x1e293b);
    this.group.add(room);

    // 2. Golden Ceiling Lights & Chandeliers
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(0, 4.2, -4), 0xfef08a));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(-6, 4.2, 4), 0xfef08a));
    this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(6, 4.2, 4), 0xfef08a));

    // 3. Exit Door
    const exitDoor = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, 11), 0);
    this.group.add(exitDoor);

    this.interactiveList.push({
      mesh: exitDoor,
      id: 'interior_exit_door',
      name: 'Bank Main Exit Door',
      category: 'Exit to Street',
      description: 'Bulletproof security revolving doors leading to Broad Street.',
      interactionPoint: new THREE.Vector3(this.group.position.x, 0, this.group.position.z + 10),
    });

    // 4. Bank Stations & Props
    // Security Walk-Through Detector
    const security = InteriorPrefabs.createSecurityBarrier(new THREE.Vector3(0, 0, 7.5));
    this.group.add(security);

    // Teller Counter
    const tellerCounter = InteriorPrefabs.createBankTellerCounter(new THREE.Vector3(0, 0, -6), 0);
    this.group.add(tellerCounter);

    // Dual ATM Kiosks
    const atm1 = InteriorPrefabs.createATMKiosk(new THREE.Vector3(-8, 0, 2), Math.PI / 2);
    const atm2 = InteriorPrefabs.createATMKiosk(new THREE.Vector3(-8, 0, -1), Math.PI / 2);
    this.group.add(atm1);
    this.group.add(atm2);

    // Manager Desk & Luxury Chairs
    const managerDesk = InteriorPrefabs.createDoctorDesk(new THREE.Vector3(7, 0, -5), 0);
    this.group.add(managerDesk);

    // Waiting queue chairs
    const queueChairs = InteriorPrefabs.createWaitingChairs(new THREE.Vector3(0, 0, 1.5), 6, 0.9);
    this.group.add(queueChairs);

    // Gold Vault Steel Door on back wall
    const vaultDoor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 })
    );
    vaultDoor.rotation.x = Math.PI / 2;
    vaultDoor.position.set(-8, 2.2, -10.8);
    this.group.add(vaultDoor);

    // 5. Build NPCs
    for (const npcDef of this.def.npcs) {
      const npcMesh = new InteriorNPCMesh(npcDef);
      this.npcs.push(npcMesh);
      this.group.add(npcMesh.group);

      this.interactiveList.push({
        mesh: npcMesh.group,
        id: `interior_npc_${npcDef.id}`,
        name: `${npcDef.name} (${npcDef.title})`,
        category: 'Bank Staff',
        description: npcDef.dialogueGreeting,
        interactionPoint: new THREE.Vector3(
          this.group.position.x + npcDef.relativePosition.x,
          0,
          this.group.position.z + npcDef.relativePosition.z + (npcDef.rotationY === 0 ? 1.2 : -1.2)
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
