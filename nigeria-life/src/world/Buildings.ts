import * as THREE from 'three';
import type { InteractiveObject } from './World';

export class Buildings {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public compoundGateMesh: THREE.Mesh | null = null;
  public isGateOpen: boolean = false;
  private gateTargetZ: number = 0;

  constructor() {
    this.group = new THREE.Group();
    this.buildBank();
    this.buildMamaPutBuka();
    this.buildBetShopAndPos();
    this.buildResidentialCompound();
    this.buildDanfoTerminus();
    this.buildPalmTrees();
  }

  // 1. Commercial Bank with ATM Gallery (Broad Street Branch)
  private buildBank(): void {
    const bankGroup = new THREE.Group();
    bankGroup.position.set(16, 0, -22);

    // Multi-tier building base
    const baseGeo = new THREE.BoxGeometry(11, 7.5, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 3.75;
    bankGroup.add(base);

    // Reflective Tinted Glass Windows
    const glassGeo = new THREE.BoxGeometry(0.2, 5.5, 9);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.1,
      metalness: 0.9,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(-5.55, 3.8, 0);
    bankGroup.add(glass);

    // Red Brand Header (Zenith/GTCO style)
    const headerGeo = new THREE.BoxGeometry(0.4, 1.2, 11);
    const headerMat = new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.4 });
    const header = new THREE.Mesh(headerGeo, headerMat);
    header.position.set(-5.6, 6.8, 0);
    bankGroup.add(header);

    // ATM Gallery Kiosk outside
    const atmKioskGeo = new THREE.BoxGeometry(2.5, 3.2, 4);
    const atmKioskMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const atmKiosk = new THREE.Mesh(atmKioskGeo, atmKioskMat);
    atmKiosk.position.set(-4.5, 1.6, 7.5);
    bankGroup.add(atmKiosk);

    // Glowing ATM Screens
    for (let offset of [-0.9, 0.9]) {
      const screenGeo = new THREE.PlaneGeometry(0.6, 0.7);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.rotation.y = -Math.PI / 2;
      screen.position.set(-5.76, 1.8, 7.5 + offset);
      bankGroup.add(screen);
    }

    this.group.add(bankGroup);

    this.interactiveList.push({
      mesh: bankGroup,
      id: 'lagos-bank',
      name: 'Eko Commercial Bank & ATM',
      category: 'Banking & Finance',
      description: '24/7 ATM Gallery. Check balance, withdraw cash, or apply for business loan.',
      interactionPoint: new THREE.Vector3(8.5, 0, -22),
    });
  }

  // 2. Mama Put Buka (Bukateria)
  private buildMamaPutBuka(): void {
    const bukaGroup = new THREE.Group();
    bukaGroup.position.set(-17, 0, -10);

    // Main restaurant block
    const mainGeo = new THREE.BoxGeometry(8, 4.2, 9);
    const mainMat = new THREE.MeshStandardMaterial({ color: 0xd97736, roughness: 0.7 });
    const mainBuilding = new THREE.Mesh(mainGeo, mainMat);
    mainBuilding.position.y = 2.1;
    bukaGroup.add(mainBuilding);

    // Corrugated iron sheet roof
    const roofGeo = new THREE.ConeGeometry(7, 2, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.4, roughness: 0.6 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 5.2;
    roof.rotation.y = Math.PI / 4;
    bukaGroup.add(roof);

    // Outdoor dining veranda with green/white awning
    const awningGeo = new THREE.BoxGeometry(3.5, 0.25, 8.5);
    const awningMat = new THREE.MeshStandardMaterial({ color: 0x008751 });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.position.set(4.5, 3.2, 0);
    awning.rotation.z = -0.15;
    bukaGroup.add(awning);

    // Wooden veranda support poles
    for (let z of [-3.8, 0, 3.8]) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(6.0, 1.5, z);
      bukaGroup.add(pole);
    }

    // Outdoor cooking stove with large aluminium pots
    const stoveGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.7, 16);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
    const pot = new THREE.Mesh(stoveGeo, potMat);
    pot.position.set(5.2, 0.7, 3.2);
    bukaGroup.add(pot);

    // Plastic chairs (Classic red & blue party chairs)
    const chairMatRed = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
    const chairMatBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb });
    const chairGeo = new THREE.BoxGeometry(0.5, 0.75, 0.5);

    const chair1 = new THREE.Mesh(chairGeo, chairMatRed);
    chair1.position.set(4.8, 0.4, -1.8);
    bukaGroup.add(chair1);

    const chair2 = new THREE.Mesh(chairGeo, chairMatBlue);
    chair2.position.set(4.8, 0.4, 0.8);
    bukaGroup.add(chair2);

    this.group.add(bukaGroup);

    this.interactiveList.push({
      mesh: bukaGroup,
      id: 'mama-put',
      name: 'Mama Put - Special Bukateria',
      category: 'Food & Health',
      description: 'Hot smoky Party Jollof, spicy Asun, and Pounded Yam. Eat to restore 100% energy!',
      interactionPoint: new THREE.Vector3(-9.5, 0, -10),
    });
  }

  // 3. Bet9ja Sports Center & POS Kiosk
  private buildBetShopAndPos(): void {
    const betGroup = new THREE.Group();
    betGroup.position.set(16, 0, 12);

    // Main shop structure
    const shopGeo = new THREE.BoxGeometry(8, 4.0, 7.5);
    const shopMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.5 }); // Bet9ja green
    const shop = new THREE.Mesh(shopGeo, shopMat);
    shop.position.y = 2.0;
    betGroup.add(shop);

    // Red accent banner
    const bannerGeo = new THREE.BoxGeometry(0.3, 0.9, 6.5);
    const bannerMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(-4.1, 3.4, 0);
    betGroup.add(banner);

    // Famous yellow "I Pass My Neighbor" Tiger Generator humming on sidewalk
    const genGeo = new THREE.BoxGeometry(0.7, 0.55, 0.8);
    const genMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.6 });
    const generator = new THREE.Mesh(genGeo, genMat);
    generator.position.set(-4.8, 0.3, 3.2);
    betGroup.add(generator);

    // Exhaust pipe
    const exhaustGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(-4.8, 0.65, 3.5);
    betGroup.add(exhaust);

    this.group.add(betGroup);

    this.interactiveList.push({
      mesh: betGroup,
      id: 'bet-shop',
      name: 'Bet9ja & POS Cash Point',
      category: 'Entertainment & Gaming',
      description: 'Place match tickets, virtual games, or fast cash out via Moniepoint POS.',
      interactionPoint: new THREE.Vector3(9.5, 0, 12),
    });
  }

  // 4. Typical Lagos High-Wall Residential Compound + GP Water Tank
  private buildResidentialCompound(): void {
    const compoundGroup = new THREE.Group();
    compoundGroup.position.set(-20, 0, 24);

    // High perimeter concrete security fence
    const wallGeo = new THREE.BoxGeometry(16, 2.8, 18);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 1.4;
    compoundGroup.add(wall);

    // Black rolling gate with gold spikes
    const gateGeo = new THREE.BoxGeometry(0.3, 2.6, 5);
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });
    this.compoundGateMesh = new THREE.Mesh(gateGeo, gateMat);
    this.compoundGateMesh.position.set(8.1, 1.3, 0);
    compoundGroup.add(this.compoundGateMesh);

    // Modern 2-storey Lagos duplex behind the wall
    const houseGeo = new THREE.BoxGeometry(11, 7.5, 11);
    const houseMat = new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.set(0, 3.75, 0);
    compoundGroup.add(house);

    // Hip Roof (Clay tiles style)
    const roofGeo = new THREE.ConeGeometry(9.5, 2.5, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 8.7;
    roof.rotation.y = Math.PI / 4;
    compoundGroup.add(roof);

    // Iconic GP Water Tank on Metal Scaffold Tower (Essential Lagos detail!)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(6, 0, 7);

    // 4 metal stilt legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.5, 6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
    for (let lx of [-0.7, 0.7]) {
      for (let lz of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 3.25, lz);
        towerGroup.add(leg);
      }
    }

    // Top scaffold platform
    const platGeo = new THREE.BoxGeometry(1.8, 0.2, 1.8);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = 6.6;
    towerGroup.add(platform);

    // Black cylindrical GP Tank
    const tankGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.8, 16);
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 7.6;
    towerGroup.add(tank);

    compoundGroup.add(towerGroup);
    this.group.add(compoundGroup);

    this.interactiveList.push({
      mesh: compoundGroup,
      id: 'villa-compound',
      name: 'Victoria Residence Estate',
      category: 'Real Estate & Living',
      description: 'Luxury 4-bedroom duplex with 24/7 borehole water & standby soundproof diesel gen.',
      interactionPoint: new THREE.Vector3(-10.0, 0, 24),
    });
  }

  // 5. Danfo Bus Terminus & Newspaper Stand
  private buildDanfoTerminus(): void {
    const terminusGroup = new THREE.Group();
    terminusGroup.position.set(-11, 0, 6);

    // Yellow corrugated shelter canopy
    const canopyGeo = new THREE.BoxGeometry(4.2, 0.2, 6.0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 3.2, 0);
    canopy.rotation.z = -0.05;
    terminusGroup.add(canopy);

    // Support pipes
    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (let px of [-1.8, 1.8]) {
      for (let pz of [-2.6, 2.6]) {
        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.set(px, 1.6, pz);
        terminusGroup.add(pipe);
      }
    }

    // Terminus Sign: "BRT & DANFO PARK - OSHODI / LEKKI / AJAH"
    const signGeo = new THREE.BoxGeometry(0.2, 0.8, 4.0);
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(2.1, 3.2, 0);
    terminusGroup.add(sign);

    this.group.add(terminusGroup);

    this.interactiveList.push({
      mesh: terminusGroup,
      id: 'danfo-stop',
      name: 'Broad St. Danfo Terminus',
      category: 'Transit & Travel',
      description: 'Yellow buses heading to Ikeja Along, Oshodi, Lekki Phase 1, and Victoria Island.',
      interactionPoint: new THREE.Vector3(-7.2, 0, 6),
    });
  }

  // 6. Tropical Palm Trees
  private buildPalmTrees(): void {
    const treePositions = [
      { x: 18, z: -3 },
      { x: 18, z: 28 },
      { x: -18, z: -26 },
      { x: -18, z: 38 },
      { x: 19, z: -40 },
    ];

    for (let pos of treePositions) {
      const palmGroup = new THREE.Group();
      palmGroup.position.set(pos.x, 0, pos.z);

      // Curved segmented trunk
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 7.5, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78563a, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.75;
      palmGroup.add(trunk);

      // Palm fronds canopy
      const frondGeo = new THREE.ConeGeometry(2.4, 1.6, 6);
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(Math.cos(angle) * 1.2, 7.4, Math.sin(angle) * 1.2);
        frond.rotation.z = Math.cos(angle) * 0.45;
        frond.rotation.x = Math.sin(angle) * 0.45;
        palmGroup.add(frond);
      }

      this.group.add(palmGroup);
    }
  }

  public toggleCompoundGate(open?: boolean): boolean {
    this.isGateOpen = open !== undefined ? open : !this.isGateOpen;
    this.gateTargetZ = this.isGateOpen ? 4.6 : 0;
    return this.isGateOpen;
  }

  public update(delta: number): void {
    if (this.compoundGateMesh) {
      this.compoundGateMesh.position.z = THREE.MathUtils.lerp(
        this.compoundGateMesh.position.z,
        this.gateTargetZ,
        Math.min(1, delta * 3.5)
      );
    }
  }
}
