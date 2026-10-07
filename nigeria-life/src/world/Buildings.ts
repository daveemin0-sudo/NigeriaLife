import * as THREE from 'three';
import type { InteractiveObject } from './World';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { SignageLibrary } from '../materials/SignageLibrary';

export class Buildings {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public compoundGateMesh: THREE.Mesh | null = null;
  public isGateOpen: boolean = false;
  private gateTargetZ: number = 0;
  private matLib: MaterialLibrary;
  private signLib: SignageLibrary;

  constructor() {
    this.group = new THREE.Group();
    this.matLib = MaterialLibrary.getInstance();
    this.signLib = SignageLibrary.getInstance();

    this.buildBank();
    this.buildMamaPutBuka();
    this.buildUniqueBeautySalon();
    this.buildBetShopAndPos();
    this.buildSaboTextiles();
    this.buildResidentialCompound();
    this.buildDanfoTerminus();
    this.buildPalmTrees();
  }

  // =========================================================================
  // HELPER: Outdoor Split AC Compressor Unit (Classic Nigerian Building Prop)
  // =========================================================================
  private createACUnit(x: number, y: number, z: number, rotY: number = 0): THREE.Group {
    const acGroup = new THREE.Group();
    acGroup.position.set(x, y, z);
    acGroup.rotation.y = rotY;

    // Main compressor housing body
    const bodyGeo = new THREE.BoxGeometry(0.85, 0.65, 0.4);
    const body = new THREE.Mesh(bodyGeo, this.matLib.acUnitMaterial);
    body.castShadow = true;
    body.receiveShadow = true;
    acGroup.add(body);

    // Front fan vent grill
    const grillGeo = new THREE.PlaneGeometry(0.55, 0.55);
    const grill = new THREE.Mesh(grillGeo, this.matLib.acGrillMaterial);
    grill.position.set(0.08, 0, 0.205);
    acGroup.add(grill);

    // Wall mounting brackets (two metal L-brackets)
    const bracketGeo = new THREE.BoxGeometry(0.05, 0.15, 0.35);
    for (let bx of [-0.3, 0.3]) {
      const bracket = new THREE.Mesh(bracketGeo, this.matLib.ironRailingMaterial);
      bracket.position.set(bx, -0.35, -0.05);
      acGroup.add(bracket);
    }

    // Copper piping conduit sleeve into wall
    const pipeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(-0.35, -0.15, -0.15);
    acGroup.add(pipe);

    return acGroup;
  }

  // =========================================================================
  // HELPER: Louvered Slatted Window with Concrete Lintel and Sill
  // =========================================================================
  private createWindow(w: number, h: number): THREE.Group {
    const winGroup = new THREE.Group();

    // Concrete sill (bottom ledge)
    const sillGeo = new THREE.BoxGeometry(w + 0.2, 0.08, 0.2);
    const sill = new THREE.Mesh(sillGeo, this.matLib.concreteTrimMaterial);
    sill.position.y = -h / 2 - 0.04;
    sill.castShadow = true;
    sill.receiveShadow = true;
    winGroup.add(sill);

    // Concrete lintel (top beam)
    const lintelGeo = new THREE.BoxGeometry(w + 0.2, 0.1, 0.18);
    const lintel = new THREE.Mesh(lintelGeo, this.matLib.concreteTrimMaterial);
    lintel.position.y = h / 2 + 0.05;
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    winGroup.add(lintel);

    // Louvered glass pane
    const paneGeo = new THREE.PlaneGeometry(w, h);
    const pane = new THREE.Mesh(paneGeo, this.matLib.louveredWindowMaterial);
    pane.castShadow = true;
    winGroup.add(pane);

    return winGroup;
  }

  // =========================================================================
  // 1. Commercial Bank with ATM Gallery (Broad Street Branch)
  // =========================================================================
  private buildBank(): void {
    const bankGroup = new THREE.Group();
    bankGroup.position.set(16, 0, -22);

    // Multi-tier building base with distressed commercial plaster
    const baseGeo = new THREE.BoxGeometry(11, 7.5, 12);
    const base = new THREE.Mesh(baseGeo, this.matLib.wallPlasterDistressedWhite);
    base.position.y = 3.75;
    base.castShadow = true;
    base.receiveShadow = true;
    bankGroup.add(base);

    // Foundation concrete plinth
    const plinthGeo = new THREE.BoxGeometry(11.4, 0.5, 12.4);
    const plinth = new THREE.Mesh(plinthGeo, this.matLib.concreteTrimMaterial);
    plinth.position.y = 0.25;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    bankGroup.add(plinth);

    // Roof parapet coping (concrete capping stone)
    const parapetGeo = new THREE.BoxGeometry(11.3, 0.35, 12.3);
    const parapet = new THREE.Mesh(parapetGeo, this.matLib.concreteTrimMaterial);
    parapet.position.y = 7.6;
    parapet.castShadow = true;
    parapet.receiveShadow = true;
    bankGroup.add(parapet);

    // High-spec reflective tinted glass facade
    const glassGeo = new THREE.BoxGeometry(0.2, 5.5, 9);
    const glass = new THREE.Mesh(glassGeo, this.matLib.glassReflectiveMaterial);
    glass.position.set(-5.55, 3.8, 0);
    glass.castShadow = true;
    glass.receiveShadow = true;
    bankGroup.add(glass);

    // Dark architectural mullions dividing the bank glass
    for (let mz of [-3, -1, 1, 3]) {
      const mullionGeo = new THREE.BoxGeometry(0.25, 5.5, 0.08);
      const mullion = new THREE.Mesh(mullionGeo, this.matLib.ironRailingMaterial);
      mullion.position.set(-5.56, 3.8, mz);
      bankGroup.add(mullion);
    }

    // Red Brand Header (Zenith/GTCO corporate banking style)
    const headerGeo = new THREE.BoxGeometry(0.4, 1.2, 11);
    const headerMat = new THREE.MeshStandardMaterial({
      color: 0xbe123c,
      roughness: 0.35,
      metalness: 0.15,
    });
    const header = new THREE.Mesh(headerGeo, headerMat);
    header.position.set(-5.6, 6.8, 0);
    header.castShadow = true;
    header.receiveShadow = true;
    bankGroup.add(header);

    // White brand trim border on header
    const trimGeo = new THREE.BoxGeometry(0.42, 0.08, 11.05);
    const trim = new THREE.Mesh(trimGeo, this.matLib.concreteTrimMaterial);
    trim.position.set(-5.6, 6.18, 0);
    bankGroup.add(trim);

    // Rooftop AC compressor units
    const ac1 = this.createACUnit(-2, 7.85, -2, Math.PI / 4);
    const ac2 = this.createACUnit(2, 7.85, 2, -Math.PI / 6);
    bankGroup.add(ac1);
    bankGroup.add(ac2);

    // ATM Gallery Kiosk outside
    const atmKioskGeo = new THREE.BoxGeometry(2.5, 3.2, 4);
    const atmKiosk = new THREE.Mesh(atmKioskGeo, this.matLib.concreteTrimMaterial);
    atmKiosk.position.set(-4.5, 1.6, 7.5);
    atmKiosk.castShadow = true;
    atmKiosk.receiveShadow = true;
    bankGroup.add(atmKiosk);

    // ATM Canopy Overhang
    const atmCanopyGeo = new THREE.BoxGeometry(0.8, 0.15, 4.2);
    const atmCanopy = new THREE.Mesh(atmCanopyGeo, headerMat);
    atmCanopy.position.set(-5.8, 3.25, 7.5);
    atmCanopy.castShadow = true;
    bankGroup.add(atmCanopy);

    // Glowing ATM Screens with interactive keypad fascia
    for (const offset of [-0.9, 0.9]) {
      // Screen
      const screenGeo = new THREE.PlaneGeometry(0.6, 0.7);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.rotation.y = -Math.PI / 2;
      screen.position.set(-5.76, 1.8, 7.5 + offset);
      bankGroup.add(screen);

      // Keypad & cash slot panel below screen
      const panelGeo = new THREE.PlaneGeometry(0.6, 0.45);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.3,
      });
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.rotation.y = -Math.PI / 2;
      panel.position.set(-5.76, 1.25, 7.5 + offset);
      bankGroup.add(panel);
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

  // =========================================================================
  // 2. Mama Put Buka (Bukateria)
  // =========================================================================
  private buildMamaPutBuka(): void {
    const bukaGroup = new THREE.Group();
    bukaGroup.position.set(-17, 0, -10);

    // Main restaurant block with warm ochre / terracotta plaster
    const mainGeo = new THREE.BoxGeometry(8, 4.2, 9);
    const mainBuilding = new THREE.Mesh(mainGeo, this.matLib.wallPlasterOchre);
    mainBuilding.position.y = 2.1;
    mainBuilding.castShadow = true;
    mainBuilding.receiveShadow = true;
    bukaGroup.add(mainBuilding);

    // Concrete foundation plinth
    const plinthGeo = new THREE.BoxGeometry(8.3, 0.4, 9.3);
    const plinth = new THREE.Mesh(plinthGeo, this.matLib.concreteTrimMaterial);
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    bukaGroup.add(plinth);

    // Weathered Corrugated rusty zinc metal roof
    const roofGeo = new THREE.ConeGeometry(7, 2, 4);
    const roof = new THREE.Mesh(roofGeo, this.matLib.corrugatedRoofRusty);
    roof.position.y = 5.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    bukaGroup.add(roof);

    // Louvered windows on Buka back & side walls
    const win1 = this.createWindow(1.8, 1.2);
    win1.position.set(-4.02, 2.4, -1.5);
    win1.rotation.y = -Math.PI / 2;
    bukaGroup.add(win1);

    const win2 = this.createWindow(1.8, 1.2);
    win2.position.set(-4.02, 2.4, 2.0);
    win2.rotation.y = -Math.PI / 2;
    bukaGroup.add(win2);

    // Outdoor dining veranda with authentic green & white striped awning
    const awningGeo = new THREE.BoxGeometry(3.5, 0.15, 8.5);
    const awning = new THREE.Mesh(awningGeo, this.signLib.greenStripedAwningMaterial);
    awning.position.set(4.5, 3.2, 0);
    awning.rotation.z = -0.15;
    awning.castShadow = true;
    awning.receiveShadow = true;
    bukaGroup.add(awning);

    // Green & white decorative fabric valance fringe underneath awning
    const fringeGeo = new THREE.BoxGeometry(0.1, 0.35, 8.5);
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0x008751, roughness: 0.6 });
    const fringe = new THREE.Mesh(fringeGeo, fringeMat);
    fringe.position.set(6.0, 2.9, 0);
    bukaGroup.add(fringe);

    // Hand-painted "Chop Life Restaurant" Artisan Signboard facing Broad Street
    const signGeo = new THREE.BoxGeometry(0.12, 1.4, 5.2);
    const sign = new THREE.Mesh(signGeo, this.signLib.chopLifeSignMaterial);
    sign.position.set(6.15, 3.85, 0);
    sign.rotation.y = Math.PI / 2; // Facing the street
    sign.castShadow = true;
    bukaGroup.add(sign);

    // Wooden veranda support poles with rough timber finish
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.85,
    });
    for (const z of [-3.8, 0, 3.8]) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 8);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(6.0, 1.5, z);
      pole.castShadow = true;
      pole.receiveShadow = true;
      bukaGroup.add(pole);
    }

    // Outdoor cooking stove with large aluminium pots (Classic Mama Put giant cauldron)
    const stoveGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.7, 16);
    const potMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25,
    });
    const pot = new THREE.Mesh(stoveGeo, potMat);
    pot.position.set(5.2, 0.7, 3.2);
    pot.castShadow = true;
    pot.receiveShadow = true;
    bukaGroup.add(pot);

    // Pot handles
    const handleGeo = new THREE.TorusGeometry(0.08, 0.02, 6, 12);
    const handleL = new THREE.Mesh(handleGeo, potMat);
    handleL.position.set(5.2, 0.85, 2.76);
    bukaGroup.add(handleL);
    const handleR = new THREE.Mesh(handleGeo, potMat);
    handleR.position.set(5.2, 0.85, 3.64);
    bukaGroup.add(handleR);

    // Plastic party chairs (Classic Nigerian red & blue armless party chairs)
    const chairMatRed = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.4,
      metalness: 0.05,
    });
    const chairMatBlue = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.4,
      metalness: 0.05,
    });
    const chairGeo = new THREE.BoxGeometry(0.5, 0.75, 0.5);

    const chair1 = new THREE.Mesh(chairGeo, chairMatRed);
    chair1.position.set(4.8, 0.4, -1.8);
    chair1.castShadow = true;
    chair1.receiveShadow = true;
    bukaGroup.add(chair1);

    const chair2 = new THREE.Mesh(chairGeo, chairMatBlue);
    chair2.position.set(4.8, 0.4, 0.8);
    chair2.castShadow = true;
    chair2.receiveShadow = true;
    bukaGroup.add(chair2);

    // Dining table
    const tableGeo = new THREE.BoxGeometry(0.9, 0.7, 1.2);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(4.8, 0.35, -0.5);
    table.castShadow = true;
    table.receiveShadow = true;
    bukaGroup.add(table);

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

  // =========================================================================
  // 3. Bet9ja Sports Center & POS Kiosk
  // =========================================================================
  private buildBetShopAndPos(): void {
    const betGroup = new THREE.Group();
    betGroup.position.set(16, 0, 12);

    // Main shop structure with coastal teal plaster
    const shopGeo = new THREE.BoxGeometry(8, 4.0, 7.5);
    const shop = new THREE.Mesh(shopGeo, this.matLib.wallPlasterTeal);
    shop.position.y = 2.0;
    shop.castShadow = true;
    shop.receiveShadow = true;
    betGroup.add(shop);

    // Foundation concrete plinth & roof coping
    const plinthGeo = new THREE.BoxGeometry(8.3, 0.4, 7.8);
    const plinth = new THREE.Mesh(plinthGeo, this.matLib.concreteTrimMaterial);
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    betGroup.add(plinth);

    const roofCopingGeo = new THREE.BoxGeometry(8.2, 0.3, 7.7);
    const roofCoping = new THREE.Mesh(roofCopingGeo, this.matLib.concreteTrimMaterial);
    roofCoping.position.y = 4.1;
    roofCoping.castShadow = true;
    betGroup.add(roofCoping);

    // Corrugated entrance canopy
    const canopyGeo = new THREE.BoxGeometry(1.2, 0.1, 4.0);
    const canopy = new THREE.Mesh(canopyGeo, this.matLib.corrugatedRoofSilver);
    canopy.position.set(-4.5, 3.1, 0);
    canopy.rotation.z = -0.1;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    betGroup.add(canopy);

    // Louvered windows on side
    const win = this.createWindow(1.6, 1.2);
    win.position.set(0, 2.3, 3.77);
    betGroup.add(win);

    // Wall-mounted split AC unit
    const ac = this.createACUnit(-4.1, 2.8, -2.0, -Math.PI / 2);
    betGroup.add(ac);

    // Red brand banner
    const bannerGeo = new THREE.BoxGeometry(0.3, 0.9, 6.5);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.4,
      metalness: 0.1,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(-4.1, 3.4, 0);
    banner.castShadow = true;
    betGroup.add(banner);

    // White trim border around banner
    const bannerTrimGeo = new THREE.BoxGeometry(0.32, 0.06, 6.6);
    const bannerTrim = new THREE.Mesh(bannerTrimGeo, this.matLib.concreteTrimMaterial);
    bannerTrim.position.set(-4.1, 2.92, 0);
    betGroup.add(bannerTrim);

    // Famous yellow "I Pass My Neighbor" Tiger Generator humming on sidewalk
    const genGroup = new THREE.Group();
    genGroup.position.set(-4.8, 0.3, 3.2);

    const genBodyGeo = new THREE.BoxGeometry(0.7, 0.5, 0.8);
    const genBodyMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.7,
      roughness: 0.35,
    });
    const generator = new THREE.Mesh(genBodyGeo, genBodyMat);
    generator.castShadow = true;
    generator.receiveShadow = true;
    genGroup.add(generator);

    // Black metal tubular roll-cage around generator
    const cageGeo = new THREE.BoxGeometry(0.76, 0.56, 0.86);
    const cageMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.9,
      roughness: 0.3,
      wireframe: true,
    });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    genGroup.add(cage);

    // Exhaust pipe
    const exhaustGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35);
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.8,
      roughness: 0.5,
    });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(0, 0.35, 0.3);
    exhaust.castShadow = true;
    genGroup.add(exhaust);

    betGroup.add(genGroup);
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

  // =========================================================================
  // 4. Typical Lagos High-Wall Residential Compound + GP Water Tank
  // =========================================================================
  private buildResidentialCompound(): void {
    const compoundGroup = new THREE.Group();
    compoundGroup.position.set(-20, 0, 24);

    // High perimeter concrete security fence with cream plaster
    const wallGeo = new THREE.BoxGeometry(16, 2.8, 18);
    const wall = new THREE.Mesh(wallGeo, this.matLib.wallPlasterCream);
    wall.position.y = 1.4;
    wall.castShadow = true;
    wall.receiveShadow = true;
    compoundGroup.add(wall);

    // Concrete perimeter wall coping (Capping trim)
    const wallCopingGeo = new THREE.BoxGeometry(16.3, 0.25, 18.3);
    const wallCoping = new THREE.Mesh(wallCopingGeo, this.matLib.concreteTrimMaterial);
    wallCoping.position.y = 2.85;
    wallCoping.castShadow = true;
    compoundGroup.add(wallCoping);

    // Black rolling iron security gate with spearhead finials
    const gateGeo = new THREE.BoxGeometry(0.3, 2.6, 5);
    this.compoundGateMesh = new THREE.Mesh(gateGeo, this.matLib.ironRailingMaterial);
    this.compoundGateMesh.position.set(8.1, 1.3, 0);
    this.compoundGateMesh.castShadow = true;
    this.compoundGateMesh.receiveShadow = true;

    // Gold decorative spearheads along the gate top
    const finialMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let fz = -2.2; fz <= 2.2; fz += 0.5) {
      const finialGeo = new THREE.ConeGeometry(0.06, 0.25, 6);
      const finial = new THREE.Mesh(finialGeo, finialMat);
      finial.position.set(0, 1.4, fz);
      this.compoundGateMesh.add(finial);
    }
    compoundGroup.add(this.compoundGateMesh);

    // Modern 2-storey Lagos duplex behind the wall
    const houseGeo = new THREE.BoxGeometry(11, 7.5, 11);
    const house = new THREE.Mesh(houseGeo, this.matLib.wallPlasterCream);
    house.position.set(0, 3.75, 0);
    house.castShadow = true;
    house.receiveShadow = true;
    compoundGroup.add(house);

    // Floor separation concrete moulding trim band
    const bandGeo = new THREE.BoxGeometry(11.3, 0.35, 11.3);
    const band = new THREE.Mesh(bandGeo, this.matLib.concreteTrimMaterial);
    band.position.set(0, 4.0, 0);
    band.castShadow = true;
    compoundGroup.add(band);

    // Louvered windows on duplex front facade (1st & 2nd floors)
    for (const wy of [2.0, 5.5]) {
      for (const wz of [-3.0, 3.0]) {
        const win = this.createWindow(1.8, 1.4);
        win.position.set(5.52, wy, wz);
        win.rotation.y = Math.PI / 2;
        compoundGroup.add(win);
      }
    }

    // 2nd floor cantilevered balcony with iron railing
    const balconyFloorGeo = new THREE.BoxGeometry(1.6, 0.2, 3.5);
    const balconyFloor = new THREE.Mesh(balconyFloorGeo, this.matLib.concreteTrimMaterial);
    balconyFloor.position.set(6.2, 4.0, 0);
    balconyFloor.castShadow = true;
    balconyFloor.receiveShadow = true;
    compoundGroup.add(balconyFloor);

    const railGeo = new THREE.BoxGeometry(1.6, 0.9, 3.5);
    const railing = new THREE.Mesh(railGeo, this.matLib.ironRailingMaterial);
    railing.position.set(6.2, 4.55, 0);
    compoundGroup.add(railing);

    // Weathered corrugated roof
    const roofGeo = new THREE.ConeGeometry(9.5, 2.5, 4);
    const roof = new THREE.Mesh(roofGeo, this.matLib.corrugatedRoofRusty);
    roof.position.y = 8.7;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    roof.receiveShadow = true;
    compoundGroup.add(roof);

    // Iconic GP Water Tank on Metal Scaffold Tower (Essential Lagos compound feature!)
    const towerGroup = new THREE.Group();
    towerGroup.position.set(6, 0, 7);

    // 4 metal stilt legs
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.5, 8);
    for (const lx of [-0.7, 0.7]) {
      for (const lz of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(legGeo, this.matLib.ironRailingMaterial);
        leg.position.set(lx, 3.25, lz);
        leg.castShadow = true;
        leg.receiveShadow = true;
        towerGroup.add(leg);
      }
    }

    // Metal diagonal cross-bracing
    const braceGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6);
    for (const by of [2.0, 4.5]) {
      const brace1 = new THREE.Mesh(braceGeo, this.matLib.ironRailingMaterial);
      brace1.position.set(0, by, 0.7);
      brace1.rotation.z = Math.PI / 4;
      towerGroup.add(brace1);

      const brace2 = new THREE.Mesh(braceGeo, this.matLib.ironRailingMaterial);
      brace2.position.set(0, by, -0.7);
      brace2.rotation.z = -Math.PI / 4;
      towerGroup.add(brace2);
    }

    // Top scaffold platform
    const platGeo = new THREE.BoxGeometry(1.9, 0.2, 1.9);
    const platform = new THREE.Mesh(platGeo, this.matLib.ironRailingMaterial);
    platform.position.y = 6.6;
    platform.castShadow = true;
    platform.receiveShadow = true;
    towerGroup.add(platform);

    // Heavy-duty black cylindrical GeePee poly water tank
    const tankGeo = new THREE.CylinderGeometry(0.75, 0.75, 1.8, 24);
    const tank = new THREE.Mesh(tankGeo, this.matLib.waterTankBlackMaterial);
    tank.position.y = 7.6;
    tank.castShadow = true;
    tank.receiveShadow = true;
    towerGroup.add(tank);

    // Yellow brand ring bands (Authentic Nigerian GeePee Tank markings)
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
    });
    for (const ry of [7.2, 7.6, 8.0]) {
      const ringGeo = new THREE.TorusGeometry(0.76, 0.025, 8, 24);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ry;
      towerGroup.add(ring);
    }

    // Blue PVC borehole delivery pipe running down to ground
    const pvcGeo = new THREE.CylinderGeometry(0.03, 0.03, 7.8, 8);
    const pvcMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 });
    const pvcPipe = new THREE.Mesh(pvcGeo, pvcMat);
    pvcPipe.position.set(0.75, 3.9, 0.75);
    pvcPipe.castShadow = true;
    towerGroup.add(pvcPipe);

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

  // =========================================================================
  // 5. Danfo Bus Terminus & Newspaper Stand
  // =========================================================================
  private buildDanfoTerminus(): void {
    const terminusGroup = new THREE.Group();
    terminusGroup.position.set(-11, 0, 6);

    // Concrete passenger waiting curb island
    const curbIslandGeo = new THREE.BoxGeometry(4.6, 0.25, 6.6);
    const curbIsland = new THREE.Mesh(curbIslandGeo, this.matLib.sidewalkMaterial);
    curbIsland.position.set(0, 0.125, 0);
    curbIsland.castShadow = true;
    curbIsland.receiveShadow = true;
    terminusGroup.add(curbIsland);

    // Striped yellow/black curbs framing the bus platform
    const curbBorderGeo = new THREE.BoxGeometry(4.8, 0.28, 6.8);
    const curbBorder = new THREE.Mesh(curbBorderGeo, this.matLib.curbStripedMaterial);
    curbBorder.position.set(0, 0.12, 0);
    terminusGroup.add(curbBorder);

    // Corrugated iron shelter canopy
    const canopyGeo = new THREE.BoxGeometry(4.2, 0.12, 6.0);
    const canopy = new THREE.Mesh(canopyGeo, this.matLib.corrugatedRoofRusty);
    canopy.position.set(0, 3.2, 0);
    canopy.rotation.z = -0.05;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    terminusGroup.add(canopy);

    // Danfo Yellow frame around canopy
    const frameGeo = new THREE.BoxGeometry(4.3, 0.18, 6.1);
    const frame = new THREE.Mesh(frameGeo, this.matLib.curbYellowMaterial);
    frame.position.set(0, 3.16, 0);
    terminusGroup.add(frame);

    // Metal support pipes
    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8);
    for (const px of [-1.8, 1.8]) {
      for (const pz of [-2.6, 2.6]) {
        const pipe = new THREE.Mesh(pipeGeo, this.matLib.ironRailingMaterial);
        pipe.position.set(px, 1.6, pz);
        pipe.castShadow = true;
        pipe.receiveShadow = true;
        terminusGroup.add(pipe);
      }
    }

    // Terminus Municipal Signboard: "BROAD ST. DANFO & BRT MOTOR PARK"
    const signGeo = new THREE.BoxGeometry(0.12, 1.1, 4.6);
    const sign = new THREE.Mesh(signGeo, this.signLib.danfoTerminusSignMaterial);
    sign.position.set(2.15, 3.25, 0);
    sign.rotation.y = -Math.PI / 2;
    sign.castShadow = true;
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

  // =========================================================================
  // 6. Unique Beauty Salon & Spa (Broad Street Branch)
  // =========================================================================
  private buildUniqueBeautySalon(): void {
    const salonGroup = new THREE.Group();
    salonGroup.position.set(16, 0, -4);

    // Main shop structure with cream plaster
    const shopGeo = new THREE.BoxGeometry(8, 4.2, 7.5);
    const shop = new THREE.Mesh(shopGeo, this.matLib.wallPlasterCream);
    shop.position.y = 2.1;
    shop.castShadow = true;
    shop.receiveShadow = true;
    salonGroup.add(shop);

    // Concrete plinth & roof coping
    const plinthGeo = new THREE.BoxGeometry(8.3, 0.4, 7.8);
    const plinth = new THREE.Mesh(plinthGeo, this.matLib.concreteTrimMaterial);
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    salonGroup.add(plinth);

    const roofCopingGeo = new THREE.BoxGeometry(8.2, 0.35, 7.7);
    const roofCoping = new THREE.Mesh(roofCopingGeo, this.matLib.concreteTrimMaterial);
    roofCoping.position.y = 4.3;
    roofCoping.castShadow = true;
    salonGroup.add(roofCoping);

    // Cantilevered Pink & White Striped Awning extending over sidewalk
    const awningGeo = new THREE.BoxGeometry(1.8, 0.12, 6.2);
    const awning = new THREE.Mesh(awningGeo, this.signLib.pinkStripedAwningMaterial);
    awning.position.set(-4.8, 3.2, 0);
    awning.rotation.z = -0.12;
    awning.castShadow = true;
    awning.receiveShadow = true;
    salonGroup.add(awning);

    // Decorative valance fringe
    const fringeGeo = new THREE.BoxGeometry(0.08, 0.3, 6.2);
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0xdb2777, roughness: 0.5 });
    const fringe = new THREE.Mesh(fringeGeo, fringeMat);
    fringe.position.set(-5.6, 2.95, 0);
    salonGroup.add(fringe);

    // Hand-painted "Unique Beauty Salon & Spa" Signboard
    const signGeo = new THREE.BoxGeometry(0.12, 1.4, 5.6);
    const sign = new THREE.Mesh(signGeo, this.signLib.beautySalonSignMaterial);
    sign.position.set(-4.1, 3.8, 0);
    sign.rotation.y = -Math.PI / 2;
    sign.castShadow = true;
    salonGroup.add(sign);

    // Large Front Display Window
    const winGeo = new THREE.BoxGeometry(0.2, 2.2, 3.2);
    const win = new THREE.Mesh(winGeo, this.matLib.glassReflectiveMaterial);
    win.position.set(-4.02, 1.8, 1.2);
    win.castShadow = true;
    salonGroup.add(win);

    // Window frame
    const frameGeo = new THREE.BoxGeometry(0.24, 2.3, 3.3);
    const frame = new THREE.Mesh(frameGeo, this.matLib.concreteTrimMaterial);
    frame.position.set(-4.02, 1.8, 1.2);
    salonGroup.add(frame);

    // Glass Entrance Door with brass handle
    const doorGeo = new THREE.BoxGeometry(0.18, 2.6, 1.4);
    const door = new THREE.Mesh(doorGeo, this.matLib.glassReflectiveMaterial);
    door.position.set(-4.02, 1.4, -1.8);
    door.castShadow = true;
    salonGroup.add(door);

    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(-4.14, 1.4, -1.3);
    salonGroup.add(handle);

    // Outdoor Wall-mounted Split AC unit
    const ac = this.createACUnit(-4.15, 2.8, 2.6, -Math.PI / 2);
    salonGroup.add(ac);

    this.group.add(salonGroup);

    this.interactiveList.push({
      mesh: salonGroup,
      id: 'beauty-salon',
      name: 'Unique Beauty Salon & Spa',
      category: 'Fashion & Grooming',
      description: 'Executive unisex salon. Knotless braids, Ghana weaving, dreadlocks, nails, and wig care.',
      interactionPoint: new THREE.Vector3(10.5, 0, -4),
    });
  }

  // =========================================================================
  // 7. Sabo Textiles & Fabrics Emporium
  // =========================================================================
  private buildSaboTextiles(): void {
    const textilesGroup = new THREE.Group();
    textilesGroup.position.set(16, 0, 27);

    // Main shop structure with warm ochre plaster
    const shopGeo = new THREE.BoxGeometry(8.5, 4.2, 8.0);
    const shop = new THREE.Mesh(shopGeo, this.matLib.wallPlasterOchre);
    shop.position.y = 2.1;
    shop.castShadow = true;
    shop.receiveShadow = true;
    textilesGroup.add(shop);

    // Foundation plinth & roof coping
    const plinthGeo = new THREE.BoxGeometry(8.8, 0.4, 8.3);
    const plinth = new THREE.Mesh(plinthGeo, this.matLib.concreteTrimMaterial);
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    textilesGroup.add(plinth);

    const roofCopingGeo = new THREE.BoxGeometry(8.7, 0.35, 8.2);
    const roofCoping = new THREE.Mesh(roofCopingGeo, this.matLib.concreteTrimMaterial);
    roofCoping.position.y = 4.3;
    roofCoping.castShadow = true;
    textilesGroup.add(roofCoping);

    // Cantilevered Yellow & White Striped Awning extending over sidewalk
    const awningGeo = new THREE.BoxGeometry(2.0, 0.12, 6.8);
    const awning = new THREE.Mesh(awningGeo, this.signLib.yellowStripedAwningMaterial);
    awning.position.set(-5.0, 3.25, 0);
    awning.rotation.z = -0.12;
    awning.castShadow = true;
    awning.receiveShadow = true;
    textilesGroup.add(awning);

    // Valance fringe
    const fringeGeo = new THREE.BoxGeometry(0.08, 0.32, 6.8);
    const fringeMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.5 });
    const fringe = new THREE.Mesh(fringeGeo, fringeMat);
    fringe.position.set(-5.9, 3.0, 0);
    textilesGroup.add(fringe);

    // Hand-painted "Sabo Textiles & Fabrics" Signboard
    const signGeo = new THREE.BoxGeometry(0.12, 1.4, 6.2);
    const sign = new THREE.Mesh(signGeo, this.signLib.saboTextilesSignMaterial);
    sign.position.set(-4.35, 3.8, 0);
    sign.rotation.y = -Math.PI / 2;
    sign.castShadow = true;
    textilesGroup.add(sign);

    // Outdoor Tiered Wooden Display Stall for Ankara Fabric Rolls
    const stallGroup = new THREE.Group();
    stallGroup.position.set(-4.8, 0, 0);

    // 3-Tier Wooden Shelving Rack
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c2b0c, roughness: 0.8 });
    const tierWidth = 3.6;

    // Side A-frame supports
    for (const sz of [-1.7, 1.7]) {
      const legGeo = new THREE.BoxGeometry(0.1, 1.4, 0.1);
      const leg1 = new THREE.Mesh(legGeo, woodMat);
      leg1.position.set(-0.35, 0.7, sz);
      leg1.rotation.z = 0.2;
      stallGroup.add(leg1);

      const leg2 = new THREE.Mesh(legGeo, woodMat);
      leg2.position.set(0.35, 0.7, sz);
      leg2.rotation.z = -0.2;
      stallGroup.add(leg2);
    }

    // Shelf planks
    const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, tierWidth), woodMat);
    shelf1.position.set(0, 0.35, 0);
    shelf1.castShadow = true;
    stallGroup.add(shelf1);

    const shelf2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, tierWidth), woodMat);
    shelf2.position.set(0, 0.75, 0);
    shelf2.castShadow = true;
    stallGroup.add(shelf2);

    const shelf3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, tierWidth), woodMat);
    shelf3.position.set(0, 1.15, 0);
    shelf3.castShadow = true;
    stallGroup.add(shelf3);

    // Stacked Ankara Fabric Rolls (cylinders wrapped in authentic procedural African wax prints)
    const rollGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.95, 16);
    const ankaraMats = this.signLib.ankaraFabrics;

    // Bottom tier rolls
    const zOffsetsBottom = [-1.1, 0, 1.1];
    for (let r = 0; r < zOffsetsBottom.length; r++) {
      const rollMat = ankaraMats[r % ankaraMats.length];
      const roll = new THREE.Mesh(rollGeo, rollMat);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(-0.15, 0.5, zOffsetsBottom[r]);
      roll.castShadow = true;
      stallGroup.add(roll);

      const rollBack = new THREE.Mesh(rollGeo, ankaraMats[(r + 1) % ankaraMats.length]);
      rollBack.rotation.x = Math.PI / 2;
      rollBack.position.set(0.15, 0.5, zOffsetsBottom[r]);
      rollBack.castShadow = true;
      stallGroup.add(rollBack);
    }

    // Middle tier rolls
    const zOffsetsMid = [-0.9, 0, 0.9];
    for (let r = 0; r < zOffsetsMid.length; r++) {
      const rollMat = ankaraMats[(r + 2) % ankaraMats.length];
      const roll = new THREE.Mesh(rollGeo, rollMat);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(0, 0.9, zOffsetsMid[r]);
      roll.castShadow = true;
      stallGroup.add(roll);
    }

    // Top tier rolls (Pyramid peak)
    for (const tz of [-0.6, 0.6]) {
      const rollMat = ankaraMats[tz > 0 ? 0 : 3];
      const roll = new THREE.Mesh(rollGeo, rollMat);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(0, 1.3, tz);
      roll.castShadow = true;
      stallGroup.add(roll);
    }

    // Upright Standing Fabric Bolts leaning on stall sides
    const tallRollGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.5, 16);
    const standL = new THREE.Mesh(tallRollGeo, ankaraMats[1]);
    standL.position.set(0.3, 0.75, -2.1);
    standL.rotation.z = -0.15;
    standL.castShadow = true;
    stallGroup.add(standL);

    const standR = new THREE.Mesh(tallRollGeo, ankaraMats[2]);
    standR.position.set(0.3, 0.75, 2.1);
    standR.rotation.z = -0.15;
    standR.castShadow = true;
    stallGroup.add(standR);

    textilesGroup.add(stallGroup);

    // Wall-mounted AC unit
    const ac = this.createACUnit(-4.4, 2.8, -2.8, -Math.PI / 2);
    textilesGroup.add(ac);

    this.group.add(textilesGroup);

    this.interactiveList.push({
      mesh: textilesGroup,
      id: 'sabo-textiles',
      name: 'Sabo Textiles & Fabrics Emporium',
      category: 'Commerce & Retail',
      description: 'Wholesale & retail Ankara wax prints, Swiss lace, and luxury Guinea brocade.',
      interactionPoint: new THREE.Vector3(10.5, 0, 27),
    });
  }

  // =========================================================================
  // 8. Tropical Palm Trees
  // =========================================================================
  private buildPalmTrees(): void {
    const treePositions = [
      { x: 18, z: -14 },
      { x: 18, z: 38 },
      { x: -18, z: -26 },
      { x: -18, z: 38 },
      { x: 19, z: -40 },
    ];

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x78563a,
      roughness: 0.88,
      metalness: 0.05,
    });

    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.55,
      metalness: 0.05,
    });

    for (const pos of treePositions) {
      const palmGroup = new THREE.Group();
      palmGroup.position.set(pos.x, 0, pos.z);

      // Curved segmented trunk
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.35, 7.5, 8);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.75;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      palmGroup.add(trunk);

      // Palm fronds canopy
      const frondGeo = new THREE.ConeGeometry(2.4, 1.6, 6);
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(Math.cos(angle) * 1.2, 7.4, Math.sin(angle) * 1.2);
        frond.rotation.z = Math.cos(angle) * 0.45;
        frond.rotation.x = Math.sin(angle) * 0.45;
        frond.castShadow = true;
        frond.receiveShadow = true;
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
