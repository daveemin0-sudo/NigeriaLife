import * as THREE from 'three';
import type { InteractiveObject } from './World';
import { SignageLibrary } from '../materials/SignageLibrary';

interface AmbientPedestrian {
  group: THREE.Group;
  legL?: THREE.Mesh;
  legR?: THREE.Mesh;
  armL?: THREE.Mesh;
  armR?: THREE.Mesh;
  isWalking: boolean;
  dir: number; // 1 or -1 along Z
  speed: number;
  walkTime: number;
  minZ: number;
  maxZ: number;
}

export class NPCs {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];

  // Walking & animated crowd
  private pedestrians: AmbientPedestrian[] = [];

  // Key interactive Hawker
  private hawker!: THREE.Group;
  private hawkerDir: number = 1;
  private hawkerSpeed: number = 2.2;
  private hawkerWalkTime: number = 0;
  private hawkerLegL!: THREE.Mesh;
  private hawkerLegR!: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();

    // 1. Core Interactive Story NPCs (10 rich characters)
    this.createInteractiveNPCs();

    // 2. Ambient Lagos Sidewalk Crowd (35–45 diverse pedestrians)
    this.createSidewalkCrowd();
  }

  // =========================================================================
  // 1. CORE INTERACTIVE STORY NPCS
  // =========================================================================
  private createInteractiveNPCs(): void {
    // 1. Street Drinks & Snacks Hawker (Patrolling Chidi)
    this.hawker = this.createHawker();

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
  private createHawker(): THREE.Group {
    const hawkerGroup = new THREE.Group();
    hawkerGroup.position.set(-8.5, 0, -15);

    const shadow = this.createShadow();
    hawkerGroup.add(shadow);

    // Torso (Yellow t-shirt)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.75, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.7 })
    );
    body.position.y = 0.95;
    hawkerGroup.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 })
    );
    head.position.y = 1.5;
    hawkerGroup.add(head);

    // Tray on head with bottled drinks & snacks
    const tray = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.45, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    tray.position.y = 1.82;
    hawkerGroup.add(tray);

    // Snack bottles
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      bottle.position.set(Math.cos(angle) * 0.25, 2.0, Math.sin(angle) * 0.25);
      hawkerGroup.add(bottle);
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

    this.hawkerLegL = new THREE.Mesh(legGeo, legMat);
    this.hawkerLegL.position.set(-0.16, 0.35, 0);
    hawkerGroup.add(this.hawkerLegL);

    this.hawkerLegR = new THREE.Mesh(legGeo, legMat);
    this.hawkerLegR.position.set(0.16, 0.35, 0);
    hawkerGroup.add(this.hawkerLegR);

    this.group.add(hawkerGroup);

    this.interactiveList.push({
      mesh: hawkerGroup,
      id: 'npc-hawker',
      name: 'Chidi - Street Drinks Hawker',
      category: 'Street Vendor',
      description: '"Cold pure water, chilled Coke, Gala, and fresh plantain chips! Only ₦200!"',
      interactionPoint: new THREE.Vector3(-7.5, 0, -15),
    });

    return hawkerGroup;
  }

  // B. Danfo Conductor at Bus Stop
  private createDanfoConductor(): void {
    const conductor = new THREE.Group();
    conductor.position.set(-7.5, 0, 8.5);

    conductor.add(this.createShadow());

    // Torso (Sleeveless singlet)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })
    );
    body.position.y = 0.95;
    conductor.add(body);

    // Head with red baseball cap
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.38, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1d, roughness: 0.7 })
    );
    head.position.y = 1.55;
    conductor.add(head);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.15, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xdc2626 })
    );
    cap.position.set(0, 1.75, 0.05);
    conductor.add(cap);

    // Blue denim jeans
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), legMat);
    legL.position.set(-0.16, 0.35, 0);
    conductor.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), legMat);
    legR.position.set(0.16, 0.35, 0);
    conductor.add(legR);

    // Gesture arm waving passengers into bus
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.55, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1d })
    );
    arm.position.set(0.42, 1.25, 0.2);
    arm.rotation.z = -0.6;
    conductor.add(arm);

    this.group.add(conductor);

    this.interactiveList.push({
      mesh: conductor,
      id: 'npc-conductor',
      name: 'Agbero / Danfo Conductor',
      category: 'Transport NPC',
      description: '"Oshodi straight! Tejuosho! Enter with your ₦300 exact change, no ₦1,000 note!"',
      interactionPoint: new THREE.Vector3(-6.2, 0, 8.5),
    });
  }

  // C. Citizen outside Bet9ja (Segun)
  private createBetCustomer(): void {
    const signLib = SignageLibrary.getInstance();
    const guy = new THREE.Group();
    guy.position.set(8.5, 0, 10.5);

    guy.add(this.createShadow());

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.75, 0.35),
      new THREE.MeshStandardMaterial({
        map: signLib.ankaraFabrics[2]?.map ?? null,
        color: 0xffffff,
        roughness: 0.65,
      })
    );
    body.position.y = 0.95;
    body.castShadow = true;
    guy.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.7 })
    );
    head.position.y = 1.5;
    head.castShadow = true;
    guy.add(head);

    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), legMat);
    legL.position.set(-0.15, 0.35, 0);
    guy.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), legMat);
    legR.position.set(0.15, 0.35, 0);
    guy.add(legR);

    // Glowing smartphone checking football scores
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.22, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    phone.position.set(-0.35, 1.1, 0.25);
    guy.add(phone);

    this.group.add(guy);

    this.interactiveList.push({
      mesh: guy,
      id: 'npc-punter',
      name: 'Segun - Street Punter',
      category: 'Citizen NPC',
      description: '"Bro, Chelsea cut my ₦500,000 ticket in 93rd minute yesterday! Serious heartbreak!"',
      interactionPoint: new THREE.Vector3(7.2, 0, 10.5),
    });
  }

  // D. Elegant Market Trader Aunty outside Sabo Textiles (Mama Nkechi)
  private createAuntyAnkara(): void {
    const signLib = SignageLibrary.getInstance();
    const aunty = new THREE.Group();
    aunty.position.set(10.5, 0, 24);

    aunty.add(this.createShadow());

    const ankaraMat = new THREE.MeshStandardMaterial({
      map: signLib.ankaraFabrics[1]?.map ?? null,
      color: 0xffffff,
      roughness: 0.7,
    });

    const blouse = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.36), ankaraMat);
    blouse.position.y = 1.0;
    aunty.add(blouse);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.7, 16), ankaraMat);
    skirt.position.y = 0.45;
    aunty.add(skirt);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1d, roughness: 0.7 })
    );
    head.position.y = 1.55;
    aunty.add(head);

    // Gele head-tie
    const gele = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.32, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5, metalness: 0.15 })
    );
    gele.position.set(0, 1.82, 0);
    gele.rotation.z = -0.08;
    aunty.add(gele);

    // Handbag
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.26, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 })
    );
    bag.position.set(0.42, 0.75, 0.1);
    aunty.add(bag);

    this.group.add(aunty);

    this.interactiveList.push({
      mesh: aunty,
      id: 'npc-aunty',
      name: 'Mama Nkechi - Fabric Merchant',
      category: 'Citizen NPC',
      description: '"Ah-ah! My fine customer! Enter Sabo Textiles and touch our new Hollandais arrival!"',
      interactionPoint: new THREE.Vector3(9.2, 0, 24),
    });
  }

  // E. Corporate Banker outside Eko Commercial Bank (Tunde)
  private createCorporateBanker(): void {
    const banker = new THREE.Group();
    banker.position.set(10.5, 0, -18);

    banker.add(this.createShadow());

    const shirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.78, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.6 })
    );
    shirt.position.y = 0.98;
    banker.add(shirt);

    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.52, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3 })
    );
    tie.position.set(0, 1.05, 0.18);
    banker.add(tie);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x311d11, roughness: 0.7 })
    );
    head.position.y = 1.55;
    banker.add(head);

    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.62, 0.19), pantsMat);
    legL.position.set(-0.15, 0.35, 0);
    banker.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.62, 0.19), pantsMat);
    legR.position.set(0.15, 0.35, 0);
    banker.add(legR);

    // Business briefcase
    const briefcase = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.32, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x271911, roughness: 0.3, metalness: 0.1 })
    );
    briefcase.position.set(-0.38, 0.68, 0);
    banker.add(briefcase);

    this.group.add(banker);

    this.interactiveList.push({
      mesh: banker,
      id: 'npc-banker',
      name: 'Tunde - Investment Banker',
      category: 'Citizen NPC',
      description: '"Central Bank MPC rates just adjusted. Preparing treasury bond yield projections for our Lagos clients."',
      interactionPoint: new THREE.Vector3(9.2, 0, -18),
    });
  }

  // F. Suya Master & Griller (Mallam Bisi)
  private createSuyaMaster(): void {
    const suya = new THREE.Group();
    suya.position.set(-10.2, 0, -4.0);

    suya.add(this.createShadow());

    // Apron & shirt
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.76, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c }) // Red apron
    );
    body.position.y = 0.98;
    suya.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x3d2314 })
    );
    head.position.y = 1.55;
    suya.add(head);

    // Chef cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.22, 0.25, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    cap.position.set(0, 1.82, 0);
    suya.add(cap);

    // Tongs in hand
    const tongs = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.42, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 })
    );
    tongs.position.set(0.38, 1.1, 0.2);
    tongs.rotation.x = -0.5;
    suya.add(tongs);

    this.group.add(suya);

    this.interactiveList.push({
      mesh: suya,
      id: 'npc-suya',
      name: 'Mallam Bisi - Suya Master',
      category: 'Street Vendor',
      description: '"Fresh hot beef and chicken suya seasoned with original yaji spice and sliced onions! ₦1,500 per wrap!"',
      interactionPoint: new THREE.Vector3(-9.0, 0, -4.0),
    });
  }

  // G. Phone Technician (Emeka) outside Slot Gadgets
  private createPhoneTechnician(): void {
    const emeka = new THREE.Group();
    emeka.position.set(10.2, 0, -60.0);

    emeka.add(this.createShadow());

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.74, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 }) // Blue Slot tech shirt
    );
    body.position.y = 0.96;
    emeka.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x3d2314 })
    );
    head.position.y = 1.52;
    emeka.add(head);

    // Holding dismantled iPhone motherboard with small screwdriver
    const phone = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.24, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    phone.position.set(0.25, 1.05, 0.22);
    emeka.add(phone);

    this.group.add(emeka);

    this.interactiveList.push({
      mesh: emeka,
      id: 'npc-emeka',
      name: 'Emeka - Slot Gadget Technician',
      category: 'Specialist NPC',
      description: '"Screen replacement, charging port flashing, and original UK-used laptops available with 1-year warranty!"',
      interactionPoint: new THREE.Vector3(8.8, 0, -60.0),
    });
  }

  // H. Lead Mechanic (Master Tayo) outside Auto Works
  private createLeadMechanic(): void {
    const tayo = new THREE.Group();
    tayo.position.set(-10.5, 0, 72.0);

    tayo.add(this.createShadow());

    // Grease-stained dark navy mechanic coverall
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.8, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 })
    );
    body.position.y = 0.98;
    tayo.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1d })
    );
    head.position.y = 1.55;
    tayo.add(head);

    // Spanner wrench in hand
    const spanner = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.38, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85 })
    );
    spanner.position.set(0.38, 0.9, 0.1);
    tayo.add(spanner);

    this.group.add(tayo);

    this.interactiveList.push({
      mesh: tayo,
      id: 'npc-mechanic',
      name: 'Master Tayo - Chief Auto Mechanic',
      category: 'Specialist NPC',
      description: '"God\'s Grace Auto Works! Japanese, German, American engine overhaul and computer scanning guaranteed."',
      interactionPoint: new THREE.Vector3(-9.2, 0, 72.0),
    });
  }

  // I. Traffic Warden (Sgt. Bello) at Zebra Crossing
  private createTrafficWarden(): void {
    const warden = new THREE.Group();
    warden.position.set(-4.5, 0, 0); // Next to zebra crossing

    warden.add(this.createShadow());

    // Yellow high-visibility police vest over black uniform
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.78, 0.36),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    body.position.y = 0.98;
    warden.add(body);

    // Reflective white armbands
    const armL = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.55, 0.14),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    armL.position.set(-0.38, 1.25, 0.25);
    armL.rotation.x = -1.2; // outstretched hand stopping traffic
    warden.add(armL);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x3d2314 })
    );
    head.position.y = 1.55;
    warden.add(head);

    // Peaked police cap
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.22, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: 0x09090b })
    );
    cap.position.set(0, 1.78, 0);
    warden.add(cap);

    this.group.add(warden);

    this.interactiveList.push({
      mesh: warden,
      id: 'npc-warden',
      name: 'Sgt. Bello - Traffic Police Warden',
      category: 'Public Service NPC',
      description: '"Hold on pedestrians! Let the Danfo clear the intersection first! Cross safely at the zebra marking!"',
      interactionPoint: new THREE.Vector3(-3.5, 0, 0),
    });
  }

  // J. Respected Community Elder (Chief Alabi)
  private createCommunityElder(): void {
    const chief = new THREE.Group();
    chief.position.set(-10.2, 0, -82.0); // Outside Palm View Apartments

    chief.add(this.createShadow());

    // Grand flowing cream embroidered Agbada
    const agbada = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 1.1, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
    );
    agbada.position.y = 0.9;
    chief.add(agbada);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.36, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x4a2e1d })
    );
    head.position.y = 1.55;
    chief.add(head);

    // Embroidered royal Fila cap
    const fila = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.2, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
    );
    fila.position.set(0, 1.76, 0);
    fila.rotation.z = 0.1;
    chief.add(fila);

    // Carved wooden walking cane
    const cane = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.3 })
    );
    cane.position.set(0.45, 0.55, 0.15);
    chief.add(cane);

    this.group.add(chief);

    this.interactiveList.push({
      mesh: chief,
      id: 'npc-chief',
      name: 'Chief Alabi - Landlord & Community Elder',
      category: 'Citizen NPC',
      description: '"Welcome to Broad Street, my child. Lagos is a city where courage, grit, and honest work make kings."',
      interactionPoint: new THREE.Vector3(-9.0, 0, -82.0),
    });
  }

  // =========================================================================
  // 2. AMBIENT SIDEWALK CROWD (35–45 Diverse Citizens)
  // =========================================================================
  private createSidewalkCrowd(): void {
    // Pedestrian spawn roster: (x, z, type, isWalking, minZ, maxZ, speed)
    const roster: Array<{
      x: number;
      z: number;
      type: 'student' | 'hawker_bread' | 'hawker_water' | 'office' | 'market_woman' | 'security' | 'mechanic_boy' | 'phone_user' | 'casual' | 'shopper';
      isWalking: boolean;
      minZ: number;
      maxZ: number;
      speed?: number;
    }> = [
      // === WEST SIDEWALK (X ≈ -8.5 to -10.5) ===
      // Students walking from school
      { x: -8.8, z: -88, type: 'student', isWalking: true, minZ: -92, maxZ: -65, speed: 1.5 },
      { x: -9.5, z: -85, type: 'student', isWalking: true, minZ: -90, maxZ: -65, speed: 1.45 },
      // Bread hawker walking with glass crate on head
      { x: -8.6, z: -68, type: 'hawker_bread', isWalking: true, minZ: -72, maxZ: -45, speed: 1.8 },
      // Shoppers outside Everyday Supermarket
      { x: -10.2, z: -52, type: 'shopper', isWalking: false, minZ: -55, maxZ: -50 },
      { x: -9.8, z: -48, type: 'market_woman', isWalking: true, minZ: -55, maxZ: -30, speed: 1.4 },
      // Security guard at Pharmacy
      { x: -10.4, z: -38, type: 'security', isWalking: false, minZ: -40, maxZ: -36 },
      // Casual pedestrian browsing phone
      { x: -8.7, z: -32, type: 'phone_user', isWalking: true, minZ: -35, maxZ: -10, speed: 1.2 },
      // Pure water hawker
      { x: -8.5, z: -22, type: 'hawker_water', isWalking: true, minZ: -30, maxZ: 5, speed: 1.9 },
      // Commuter waiting at bus stop
      { x: -9.2, z: 6, type: 'casual', isWalking: false, minZ: 4, maxZ: 8 },
      { x: -9.6, z: 12, type: 'casual', isWalking: false, minZ: 10, maxZ: 14 },
      // Office worker walking to filling station
      { x: -8.8, z: 28, type: 'office', isWalking: true, minZ: 20, maxZ: 45, speed: 1.6 },
      // Fuel station customer at Oando Mart
      { x: -14.2, z: 52, type: 'shopper', isWalking: false, minZ: 50, maxZ: 54 },
      // Apprentice mechanic near workshop
      { x: -11.0, z: 68, type: 'mechanic_boy', isWalking: true, minZ: 65, maxZ: 82, speed: 1.3 },
      { x: -12.5, z: 76, type: 'mechanic_boy', isWalking: false, minZ: 74, maxZ: 78 },
      // Construction worker near site
      { x: -9.5, z: 92, type: 'casual', isWalking: true, minZ: 85, maxZ: 105, speed: 1.5 },

      // === EAST SIDEWALK (X ≈ +8.5 to +10.5) ===
      // Students walking near Slot Gadgets
      { x: 8.8, z: -92, type: 'student', isWalking: true, minZ: -95, maxZ: -70, speed: 1.55 },
      { x: 9.4, z: -78, type: 'casual', isWalking: true, minZ: -85, maxZ: -60, speed: 1.4 },
      // Shoppers outside Fresh Cut Barbershop
      { x: 10.2, z: -66, type: 'phone_user', isWalking: false, minZ: -68, maxZ: -64 },
      // Market trader walking to Tejuosho Plaza
      { x: 8.6, z: -55, type: 'market_woman', isWalking: true, minZ: -60, maxZ: -35, speed: 1.35 },
      // Bank customers queuing outside ATM
      { x: 10.4, z: -35, type: 'casual', isWalking: false, minZ: -36, maxZ: -34 },
      { x: 10.4, z: -32, type: 'office', isWalking: false, minZ: -33, maxZ: -31 },
      // Security guard standing at bank entrance
      { x: 9.8, z: -28, type: 'security', isWalking: false, minZ: -30, maxZ: -26 },
      // Office worker on phone
      { x: 8.8, z: -12, type: 'office', isWalking: true, minZ: -20, maxZ: 10, speed: 1.5 },
      // Hawkers near central junction
      { x: 8.5, z: 0, type: 'hawker_bread', isWalking: true, minZ: -10, maxZ: 25, speed: 1.7 },
      // Punters chatting outside Bet9ja
      { x: 9.8, z: 12, type: 'casual', isWalking: false, minZ: 10, maxZ: 14 },
      // Aunty shopping fabric
      { x: 9.2, z: 20, type: 'market_woman', isWalking: true, minZ: 15, maxZ: 38, speed: 1.3 },
      // Mama Put food customers sitting under umbrella
      { x: 9.8, z: 36, type: 'casual', isWalking: false, minZ: 34, maxZ: 38 },
      { x: 9.8, z: 40, type: 'phone_user', isWalking: false, minZ: 38, maxZ: 42 },
      // Pedestrian walking south
      { x: 8.7, z: 52, type: 'office', isWalking: true, minZ: 45, maxZ: 75, speed: 1.6 },
      { x: 9.4, z: 66, type: 'casual', isWalking: true, minZ: 60, maxZ: 85, speed: 1.4 },
      // Shoppers near residential flats
      { x: 10.2, z: 82, type: 'market_woman', isWalking: false, minZ: 80, maxZ: 84 },
      { x: 8.8, z: 95, type: 'student', isWalking: true, minZ: 85, maxZ: 108, speed: 1.5 },
    ];

    for (const item of roster) {
      const ped = this.buildPedestrianMesh(item.type);
      ped.group.position.set(item.x, 0, item.z);
      this.group.add(ped.group);

      this.pedestrians.push({
        group: ped.group,
        legL: ped.legL,
        legR: ped.legR,
        armL: ped.armL,
        armR: ped.armR,
        isWalking: item.isWalking,
        dir: Math.random() > 0.5 ? 1 : -1,
        speed: item.speed ?? 1.4,
        walkTime: Math.random() * 10,
        minZ: item.minZ,
        maxZ: item.maxZ,
      });
    }
  }

  private buildPedestrianMesh(type: string): {
    group: THREE.Group;
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
  } {
    const ped = new THREE.Group();
    ped.add(this.createShadow());

    // Color choices depending on archetype
    let shirtColor = 0x3b82f6;
    let pantsColor = 0x1e293b;
    let skinColor = 0x3d2314;
    let isStudent = false;

    switch (type) {
      case 'student':
        shirtColor = 0xffffff; // White school shirt
        pantsColor = 0x166534; // Forest green school uniform shorts/skirt
        isStudent = true;
        break;
      case 'office':
        shirtColor = 0xbae6fd; // Sky blue formal shirt
        pantsColor = 0x0f172a; // Black trousers
        break;
      case 'security':
        shirtColor = 0x1e293b; // Deep navy security uniform
        pantsColor = 0x09090b;
        break;
      case 'mechanic_boy':
        shirtColor = 0x334155; // Blue-grey jumpsuit
        pantsColor = 0x1e293b;
        break;
      case 'market_woman':
        shirtColor = 0xd97706; // Bright amber / Ankara
        pantsColor = 0xb45309;
        break;
      case 'hawker_bread':
      case 'hawker_water':
        shirtColor = 0xf59e0b; // Bright tee
        pantsColor = 0x1d4ed8;
        break;
      case 'phone_user':
        shirtColor = 0xec4899; // Pink streetwear
        pantsColor = 0x374151;
        break;
      case 'casual':
      default:
        shirtColor = 0x10b981; // Green tee
        pantsColor = 0x1e293b;
        break;
    }

    const scaleY = isStudent ? 0.88 : 1.0;

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.52, 0.72 * scaleY, 0.32);
    const torsoMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 0.95 * scaleY;
    ped.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const headMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = (1.45 + (isStudent ? -0.1 : 0)) * scaleY;
    ped.add(head);

    // Accessories by archetype
    if (type === 'student') {
      // School backpack on back
      const pack = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.45, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a })
      );
      pack.position.set(0, 0.95 * scaleY, -0.22);
      ped.add(pack);
    } else if (type === 'security') {
      // Security Beret
      const beret = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0x991b1b }) // Crimson beret
      );
      beret.position.set(0, 1.66, 0);
      beret.rotation.z = -0.1;
      ped.add(beret);
    } else if (type === 'hawker_bread') {
      // Glass crate on head with Agege bread
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.35, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 })
      );
      crate.position.set(0, 1.78, 0);
      ped.add(crate);
    } else if (type === 'hawker_water') {
      // Metal basin with blue water sachets
      const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.35, 0.18, 12),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
      );
      basin.position.set(0, 1.74, 0);
      ped.add(basin);
    } else if (type === 'phone_user') {
      // Phone in hand
      const phone = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.18, 0.03),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9 })
      );
      phone.position.set(0.25, 1.05 * scaleY, 0.22);
      ped.add(phone);
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.6 * scaleY, 0.18);
    const legMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });

    const legL = new THREE.Mesh(legGeo, legMat);
    legL.position.set(-0.14, 0.35 * scaleY, 0);
    ped.add(legL);

    const legR = new THREE.Mesh(legGeo, legMat);
    legR.position.set(0.14, 0.35 * scaleY, 0);
    ped.add(legR);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.13, 0.58 * scaleY, 0.13);
    const armMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 });

    const armL = new THREE.Mesh(armGeo, armMat);
    armL.position.set(-0.35, 0.95 * scaleY, 0);
    ped.add(armL);

    const armR = new THREE.Mesh(armGeo, armMat);
    armR.position.set(0.35, 0.95 * scaleY, 0);
    ped.add(armR);

    return { group: ped, legL, legR, armL, armR };
  }

  private createShadow(): THREE.Mesh {
    const shadowGeo = new THREE.CircleGeometry(0.42, 12);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    return shadow;
  }

  // =========================================================================
  // 3. UPDATE LOOP
  // =========================================================================
  public update(delta: number): void {
    // 1. Animate Main Story Hawker
    this.hawker.position.z += this.hawkerDir * this.hawkerSpeed * delta;
    this.hawkerWalkTime += delta * 7;

    this.hawkerLegL.rotation.x = Math.sin(this.hawkerWalkTime) * 0.45;
    this.hawkerLegR.rotation.x = -Math.sin(this.hawkerWalkTime) * 0.45;

    if (this.hawker.position.z > 25) {
      this.hawkerDir = -1;
      this.hawker.rotation.y = Math.PI;
    } else if (this.hawker.position.z < -35) {
      this.hawkerDir = 1;
      this.hawker.rotation.y = 0;
    }

    // 2. Animate Ambient Sidewalk Crowd
    for (const ped of this.pedestrians) {
      if (ped.isWalking) {
        ped.group.position.z += ped.dir * ped.speed * delta;
        ped.walkTime += delta * 6.5;

        if (ped.legL && ped.legR) {
          ped.legL.rotation.x = Math.sin(ped.walkTime) * 0.42;
          ped.legR.rotation.x = -Math.sin(ped.walkTime) * 0.42;
        }
        if (ped.armL && ped.armR) {
          ped.armL.rotation.x = -Math.sin(ped.walkTime) * 0.35;
          ped.armR.rotation.x = Math.sin(ped.walkTime) * 0.35;
        }

        // Boundary bounce / patrol turnaround
        if (ped.group.position.z >= ped.maxZ) {
          ped.dir = -1;
          ped.group.rotation.y = Math.PI;
        } else if (ped.group.position.z <= ped.minZ) {
          ped.dir = 1;
          ped.group.rotation.y = 0;
        }
      } else {
        // Subtle ambient idle breathing sway for standing pedestrians
        ped.walkTime += delta * 1.5;
        ped.group.position.y = Math.sin(ped.walkTime) * 0.015;
      }
    }
  }
}
