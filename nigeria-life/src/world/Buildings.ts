import * as THREE from 'three';
import { HingedDoor, SlidingGate, type Doorway } from '../interactions/Door';
import { InteractionDirector } from '../interactions/InteractionDirector';
import type { InteractiveObject } from './World';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { SignageLibrary } from '../materials/SignageLibrary';

/** A door on the street that leads into a building's interior. */
export interface StreetDoor {
  buildingId: string;
  door: Doorway;
  /** Where to stand on the pavement in front of it */
  outside: THREE.Vector3;
  /** A point just through the doorway */
  inside: THREE.Vector3;
}

export class Buildings {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  /** Street doors the player can walk through, keyed by the building they belong to */
  public placeDoors: StreetDoor[] = [];
  public compoundGateMesh: THREE.Mesh | null = null;
  public isGateOpen: boolean = false;
  private compoundGate: SlidingGate | null = null;
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
    this.buildCommercialPlazasAndShops();
    this.buildApartmentBlocks();
    this.buildFillingStation();
    this.buildMechanicWorkshop();
    this.buildConstructionSite();
    this.buildPoliceCheckpoint();
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
  /** A painted name board: a place's name, readable from the street. */
  private static createNameBoardTexture(name: string, tagline: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 832;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, 0, 832, 200);
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 818, 186);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7f1d1d';
    ctx.font = '900 92px Inter, system-ui, sans-serif';
    ctx.fillText(name, 416, 108, 780);
    ctx.fillStyle = '#15803d';
    ctx.font = '700 40px Inter, system-ui, sans-serif';
    ctx.fillText(tagline, 416, 164, 780);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

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

    // Front door, between the veranda posts, with the name over it
    const doorZ = 1.9;
    const doorway = new THREE.Group();
    doorway.position.set(4.17, 0, doorZ); // on the pavement, in front of the plinth
    doorway.rotation.y = Math.PI / 2; // faces Broad Street
    bukaGroup.add(doorway);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3f1d0b, roughness: 0.8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.2), frameMat);
      post.position.set(side * 0.68, 1.25, 0.06);
      doorway.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.16, 0.2), frameMat);
    lintel.position.set(0, 2.5, 0.06);
    doorway.add(lintel);

    // What shows through the open door: the dim room beyond
    const recess = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 2.42),
      new THREE.MeshBasicMaterial({ color: 0x1c0f07 })
    );
    recess.position.set(0, 1.21, 0.03);
    doorway.add(recess);

    const bukaDoor = new HingedDoor({
      width: 1.2,
      height: 2.4,
      material: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 }),
      swing: -1.9,
    });
    bukaDoor.group.position.z = 0.1;
    doorway.add(bukaDoor.group);
    InteractionDirector.get().addDoor(bukaDoor);

    const nameBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 0.5),
      new THREE.MeshBasicMaterial({ map: Buildings.createNameBoardTexture('MAMA PUT BUKA', 'Hot food · Come in') })
    );
    nameBoard.position.set(0, 2.86, 0.09); // just over the door, under the awning
    doorway.add(nameBoard);

    this.group.add(bukaGroup);

    const doorWorld = new THREE.Vector3(bukaGroup.position.x + 4.17, 0, bukaGroup.position.z + doorZ);
    this.placeDoors.push({
      buildingId: 'mama-put',
      door: bukaDoor,
      outside: new THREE.Vector3(doorWorld.x + 2.4, 0, doorWorld.z),
      inside: new THREE.Vector3(doorWorld.x - 1.5, 0, doorWorld.z),
    });

    this.interactiveList.push({
      mesh: bukaGroup,
      id: 'mama-put',
      name: 'Mama Put Buka',
      category: 'Food & Health',
      description: 'Jollof, fried rice, amala, eba and suya, served at your table. Walk in through the green door.',
      interactionPoint: new THREE.Vector3(doorWorld.x + 2.4, 0, doorWorld.z),
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
      name: 'NaijaBet Mega & POS Cash Point',
      category: 'Entertainment & Gaming',
      description: 'Place match tickets, virtual games, or fast cash out via KudiPoint POS.',
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
    // Towards the far end of the wall, clear of the pedestrian bridge stairs on the pavement
    const gateZ = 6.4;
    this.compoundGateMesh.position.set(8.1, 1.3, gateZ);
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

    // What shows when the gate rolls aside: the shaded driveway into the compound
    const gateway = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.5),
      new THREE.MeshBasicMaterial({ color: 0x1f2937 })
    );
    gateway.rotation.y = Math.PI / 2;
    gateway.position.set(8.02, 1.25, gateZ);
    compoundGroup.add(gateway);

    // The gate is this home's street door: it rolls open and the player walks in through it
    this.compoundGate = InteractionDirector.get().addDoor(new SlidingGate(this.compoundGateMesh, -4.6));
    const gateWorld = new THREE.Vector3(compoundGroup.position.x + 8.1, 0, compoundGroup.position.z + gateZ);
    this.placeDoors.push({
      buildingId: 'villa-compound',
      door: this.compoundGate,
      outside: new THREE.Vector3(gateWorld.x + 2.4, 0, gateWorld.z),
      inside: new THREE.Vector3(gateWorld.x - 1.8, 0, gateWorld.z),
    });

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
      interactionPoint: new THREE.Vector3(-9.5, 0, 30.4), // on the pavement in front of the gate
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

  // =========================================================================
  // 9. DENSE COMMERCIAL PLAZAS & SHOPS (Pharmacy, Supermarket, Gadgets, Barber)
  // =========================================================================
  private buildCommercialPlazasAndShops(): void {
    // A. Yaba Central Pharmacy & Clinic (North-West: x = -18, z = -50)
    const pharmGroup = new THREE.Group();
    pharmGroup.position.set(-18, 0, -50);

    const pharmGeo = new THREE.BoxGeometry(8.5, 6.8, 9.5);
    const pharmMat = this.matLib.wallPlasterDistressedWhite;
    const pharmBuilding = new THREE.Mesh(pharmGeo, pharmMat);
    pharmBuilding.position.y = 3.4;
    pharmBuilding.castShadow = true;
    pharmBuilding.receiveShadow = true;
    pharmGroup.add(pharmBuilding);

    // Green cross pharmacy lightbox header
    const pSignGeo = new THREE.BoxGeometry(0.3, 1.2, 8.5);
    const pSignMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      roughness: 0.3,
    });
    const pSign = new THREE.Mesh(pSignGeo, pSignMat);
    pSign.position.set(4.35, 3.6, 0);
    pharmGroup.add(pSign);

    // Illuminated Green Cross
    const crossGeoH = new THREE.BoxGeometry(0.08, 0.28, 0.85);
    const crossGeoV = new THREE.BoxGeometry(0.08, 0.85, 0.28);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const crossH = new THREE.Mesh(crossGeoH, crossMat);
    const crossV = new THREE.Mesh(crossGeoV, crossMat);
    crossH.position.set(4.55, 3.6, 0);
    crossV.position.set(4.55, 3.6, 0);
    pharmGroup.add(crossH);
    pharmGroup.add(crossV);

    // Windows & AC
    pharmGroup.add(this.createWindow(1.8, 1.2));
    pharmGroup.add(this.createACUnit(4.35, 5.2, -2.5, -Math.PI / 2));
    this.group.add(pharmGroup);

    this.interactiveList.push({
      mesh: pharmGroup,
      id: 'pharmacy',
      name: 'Yaba Central Pharmacy & Wellness',
      category: 'Health & Pharmacy',
      description: 'First aid, vitamins, energy boosts, and malaria medication.',
      interactionPoint: new THREE.Vector3(-10, 0, -50),
    });

    // B. Everyday Supermarket & Cold Drinks (North-East: x = 18, z = -45)
    const martGroup = new THREE.Group();
    martGroup.position.set(18, 0, -45);

    const martGeo = new THREE.BoxGeometry(9.0, 7.5, 11.0);
    const martBuilding = new THREE.Mesh(martGeo, this.matLib.wallPlasterCream);
    martBuilding.position.y = 3.75;
    martBuilding.castShadow = true;
    martBuilding.receiveShadow = true;
    martGroup.add(martBuilding);

    // Brand header
    const martHeaderGeo = new THREE.BoxGeometry(0.3, 1.3, 10.0);
    const martHeaderMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const martHeader = new THREE.Mesh(martHeaderGeo, martHeaderMat);
    martHeader.position.set(-4.6, 4.2, 0);
    martGroup.add(martHeader);

    // Glass entrance front
    const martGlassGeo = new THREE.BoxGeometry(0.2, 3.2, 7.5);
    const martGlass = new THREE.Mesh(martGlassGeo, this.matLib.glassReflectiveMaterial);
    martGlass.position.set(-4.55, 1.8, 0);
    martGroup.add(martGlass);

    martGroup.add(this.createACUnit(-4.6, 5.8, 2.5, Math.PI / 2));

    // Supreme Court Pharmacy Fascia Board
    const pharmSignGeo = new THREE.PlaneGeometry(8.5, 1.8);
    const pharmSign = new THREE.Mesh(pharmSignGeo, this.signLib.supremeCourtPharmacyMaterial);
    pharmSign.position.set(-4.62, 4.2, 0);
    pharmSign.rotation.y = -Math.PI / 2;
    martGroup.add(pharmSign);

    this.group.add(martGroup);

    this.interactiveList.push({
      mesh: martGroup,
      id: 'pharmacy',
      name: 'Supreme Court Pharmacy',
      category: 'Health & Pharmacy',
      description: 'Prescription medicines, vitamin C, first aid, malaria drugs, and energy supplements.',
      interactionPoint: new THREE.Vector3(10, 0, -45),
    });

    // C. Victory Phones & Laptops Hub (South-East: x = 18, z = 35)
    const slotGroup = new THREE.Group();
    slotGroup.position.set(18, 0, 35);

    const slotGeo = new THREE.BoxGeometry(8.5, 6.5, 8.5);
    const slotBuilding = new THREE.Mesh(slotGeo, this.matLib.wallPlasterTeal);
    slotBuilding.position.y = 3.25;
    slotBuilding.castShadow = true;
    slotBuilding.receiveShadow = true;
    slotGroup.add(slotBuilding);

    // Large Victory Phones & Laptops illuminated signboard
    const vicSignGeo = new THREE.PlaneGeometry(8.0, 1.8);
    const vicSign = new THREE.Mesh(vicSignGeo, this.signLib.victoryPhonesSignMaterial);
    vicSign.position.set(-4.36, 4.0, 0);
    vicSign.rotation.y = -Math.PI / 2;
    slotGroup.add(vicSign);

    // Glass storefront display window
    const slotGlassGeo = new THREE.BoxGeometry(0.2, 2.8, 6.5);
    const slotGlass = new THREE.Mesh(slotGlassGeo, this.matLib.glassReflectiveMaterial);
    slotGlass.position.set(-4.32, 1.6, 0);
    slotGroup.add(slotGlass);

    slotGroup.add(this.createACUnit(-4.35, 5.2, -1.8, Math.PI / 2));
    this.group.add(slotGroup);

    this.interactiveList.push({
      mesh: slotGroup,
      id: 'victory-phones',
      name: 'Victory Phones & Laptops',
      category: 'Tech & Electronics',
      description: 'Original iPhones, MacBooks, screen replacement, fast chargers, power banks, and AirPods.',
      interactionPoint: new THREE.Vector3(10, 0, 35),
    });

    // D. Lagos Barbershop & Grooming Lounge (South-West: x = -18, z = 35)
    const barbGroup = new THREE.Group();
    barbGroup.position.set(-18, 0, 35);

    const barbGeo = new THREE.BoxGeometry(8.0, 5.5, 7.5);
    const barbBuilding = new THREE.Mesh(barbGeo, this.matLib.wallPlasterOchre);
    barbBuilding.position.y = 2.75;
    barbBuilding.castShadow = true;
    barbBuilding.receiveShadow = true;
    barbGroup.add(barbBuilding);

    // Lagos Barbershop Signboard
    const barbSignGeo = new THREE.PlaneGeometry(7.5, 1.6);
    const barbSign = new THREE.Mesh(barbSignGeo, this.signLib.lagosBarbershopMaterial);
    barbSign.position.set(4.12, 3.8, 0);
    barbSign.rotation.y = Math.PI / 2;
    barbGroup.add(barbSign);

    // Rotating style barber pole prop
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    const bPole = new THREE.Mesh(poleGeo, poleMat);
    bPole.position.set(4.2, 2.8, 2.8);
    barbGroup.add(bPole);

    this.group.add(barbGroup);

    this.interactiveList.push({
      mesh: barbGroup,
      id: 'barber-shop',
      name: 'Lagos Executive Barbershop',
      category: 'Grooming & Style',
      description: 'Clean fade, waves, beard dye treatment, and hot towel wash.',
      interactionPoint: new THREE.Vector3(-10, 0, 35),
    });
  }

  // =========================================================================
  // 10. MULTI-STOREY RESIDENTIAL APARTMENT BLOCKS (2-4 Storey Lagos Blocks)
  // =========================================================================
  private buildApartmentBlocks(): void {
    const aptConfigs = [
      { x: -19, z: -85, floors: 3, color: 0xf0e4cc, name: 'Palm View Flats' },
      { x: 19, z: -85, floors: 4, color: 0xd9b99a, name: 'Heritage Heights' },
      { x: 19, z: 65, floors: 3, color: 0xe6c9a0, name: 'Tejuosho Mansions' },
    ];

    aptConfigs.forEach((cfg) => {
      const aptGroup = new THREE.Group();
      aptGroup.position.set(cfg.x, 0, cfg.z);

      const W = 11.0;
      const D = 10.0;
      const H = 4.2 + cfg.floors * 3.2;

      // Main structural block
      const bGeo = new THREE.BoxGeometry(W, H, D);
      const bMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.85,
      });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.y = H / 2;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      aptGroup.add(bMesh);

      // Windows and Balconies on each floor
      const facingRoad = cfg.x < 0 ? 1 : -1;
      const frontX = (facingRoad * W) / 2 + facingRoad * 0.05;

      for (let f = 1; f <= cfg.floors; f++) {
        const floorY = 2.0 + f * 3.0;

        // Front Balcony Railing
        const railGeo = new THREE.BoxGeometry(0.1, 0.9, 7.5);
        const rail = new THREE.Mesh(railGeo, this.matLib.ironRailingMaterial);
        rail.position.set(frontX, floorY + 0.45, 0);
        rail.castShadow = true;
        aptGroup.add(rail);

        // Louvered Windows
        for (const oz of [-2.8, 2.8]) {
          const win = this.createWindow(1.6, 1.2);
          win.position.set(frontX, floorY + 0.8, oz);
          win.rotation.y = facingRoad > 0 ? -Math.PI / 2 : Math.PI / 2;
          aptGroup.add(win);
        }

        // Outdoor AC unit
        aptGroup.add(this.createACUnit(frontX, floorY + 1.2, 0, facingRoad > 0 ? -Math.PI / 2 : Math.PI / 2));
      }

      // Rooftop Black GeePee Polyethylene Water Tanks
      for (const rx of [-2.5, 2.5]) {
        const tankGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 16);
        const tank = new THREE.Mesh(tankGeo, this.matLib.waterTankBlackMaterial);
        tank.position.set(rx, H + 0.9, -1.5);
        tank.castShadow = true;
        aptGroup.add(tank);
      }

      this.group.add(aptGroup);
    });
  }

  // =========================================================================
  // 11. FILLING STATION (Oando / Total Style Petrol Forecourt)
  // =========================================================================
  private buildFillingStation(): void {
    const stationGroup = new THREE.Group();
    stationGroup.position.set(-21, 0, 75);

    // Forecourt concrete pad
    const padGeo = new THREE.BoxGeometry(16, 0.18, 18);
    const padMat = this.matLib.concreteTrimMaterial;
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.09;
    pad.receiveShadow = true;
    stationGroup.add(pad);

    // Large high-clearance illuminated canopy
    const canopyGeo = new THREE.BoxGeometry(14, 0.75, 15);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 6.2;
    canopy.castShadow = true;
    stationGroup.add(canopy);

    // Orange/Green corporate brand trim around canopy edge
    const brandTrimGeo = new THREE.BoxGeometry(14.2, 0.4, 15.2);
    const brandTrimMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 });
    const brandTrim = new THREE.Mesh(brandTrimGeo, brandTrimMat);
    brandTrim.position.y = 6.2;
    stationGroup.add(brandTrim);

    // 4 Heavy canopy steel support columns
    const colGeo = new THREE.CylinderGeometry(0.3, 0.3, 6.0, 12);
    const colMat = this.matLib.concreteTrimMaterial;
    for (const cx of [-4.5, 4.5]) {
      for (const cz of [-4.5, 4.5]) {
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(cx, 3.0, cz);
        col.castShadow = true;
        stationGroup.add(col);
      }
    }

    // 4 Dual-Hose Fuel Pump Dispensers (PMS Petrol & AGO Diesel)
    const pumpGeo = new THREE.BoxGeometry(0.7, 1.8, 1.2);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });

    for (const pz of [-3.5, 3.5]) {
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(0, 0.9, pz);
      pump.castShadow = true;
      stationGroup.add(pump);

      // Digital volume & price screen
      const screenGeo = new THREE.PlaneGeometry(0.4, 0.3);
      const screenMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const screenL = new THREE.Mesh(screenGeo, screenMat);
      screenL.rotation.y = -Math.PI / 2;
      screenL.position.set(-0.36, 1.2, pz);
      stationGroup.add(screenL);

      const screenR = new THREE.Mesh(screenGeo, screenMat);
      screenR.rotation.y = Math.PI / 2;
      screenR.position.set(0.36, 1.2, pz);
      stationGroup.add(screenR);
    }

    // Minimart station shop in background
    const shopGeo = new THREE.BoxGeometry(5.5, 4.0, 12.0);
    const shop = new THREE.Mesh(shopGeo, this.matLib.wallPlasterDistressedWhite);
    shop.position.set(-6.5, 2.0, 0);
    shop.castShadow = true;
    shop.receiveShadow = true;
    stationGroup.add(shop);

    this.group.add(stationGroup);

    this.interactiveList.push({
      mesh: stationGroup,
      id: 'fuel-station',
      name: 'NaijaPetro Filling Station & Mart',
      category: 'Fuel & Automotive',
      description: 'Refuel your Danfo/Keke, purchase engine oil, or grab cold bottled water.',
      interactionPoint: new THREE.Vector3(-11, 0, 75),
    });
  }

  // =========================================================================
  // 12. MECHANIC WORKSHOP (God's Grace Auto Works)
  // =========================================================================
  private buildMechanicWorkshop(): void {
    const mechGroup = new THREE.Group();
    mechGroup.position.set(-19, 0, 105);

    // Open corrugated roof shed
    const roofGeo = new THREE.BoxGeometry(10, 0.15, 12);
    const roof = new THREE.Mesh(roofGeo, this.matLib.corrugatedRoofRusty);
    roof.position.set(0, 4.5, 0);
    roof.rotation.z = -0.08;
    roof.castShadow = true;
    mechGroup.add(roof);

    // Timber posts
    const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    for (const px of [-4.5, 4.5]) {
      for (const pz of [-5.5, 5.5]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(px, 2.25, pz);
        post.castShadow = true;
        mechGroup.add(post);
      }
    }

    // Stacked used automobile tires
    const tireGeo = new THREE.TorusGeometry(0.42, 0.16, 8, 16);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    for (let t = 0; t < 4; t++) {
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.position.set(3.5, 0.18 + t * 0.32, -4.0);
      tire.castShadow = true;
      mechGroup.add(tire);
    }

    // 55-Gallon blue engine oil drum
    const drumGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.1, 16);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.6, roughness: 0.4 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(3.5, 0.55, 3.5);
    drum.castShadow = true;
    mechGroup.add(drum);

    this.group.add(mechGroup);

    this.interactiveList.push({
      mesh: mechGroup,
      id: 'mechanic',
      name: "God's Grace Auto Works",
      category: 'Repairs & Upgrades',
      description: 'Tune vehicle speed, change tires, repair broken down engine.',
      interactionPoint: new THREE.Vector3(-10, 0, 105),
    });
  }

  // =========================================================================
  // 13. UNFINISHED ACTIVE CONSTRUCTION SITE (Lagos Multi-Storey Skeleton)
  // =========================================================================
  private buildConstructionSite(): void {
    const conGroup = new THREE.Group();
    // Positioned along the main commercial strip at x = 19, z = 54
    conGroup.position.set(19, 0, 54);

    const conMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
    const rebarMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.6, roughness: 0.7 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.9 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.5 });

    // 1. 4 Concrete floor slabs
    const floors = 4;
    for (let f = 1; f <= floors; f++) {
      const slabGeo = new THREE.BoxGeometry(11, 0.35, 12);
      const slab = new THREE.Mesh(slabGeo, conMat);
      slab.position.y = f * 3.2;
      slab.castShadow = true;
      slab.receiveShadow = true;
      conGroup.add(slab);
    }

    // 2. Concrete Structural Columns with Protruding Rebar Spikes
    const totalHeight = floors * 3.2;
    const colGeo = new THREE.BoxGeometry(0.5, totalHeight, 0.5);
    for (const cx of [-4.8, 0, 4.8]) {
      for (const cz of [-5.2, 0, 5.2]) {
        const col = new THREE.Mesh(colGeo, conMat);
        col.position.set(cx, totalHeight / 2, cz);
        col.castShadow = true;
        conGroup.add(col);

        // Exposed rusty rebar rods protruding into the sky
        for (let r = 0; r < 4; r++) {
          const rodGeo = new THREE.CylinderGeometry(0.016, 0.016, 1.4, 6);
          const rod = new THREE.Mesh(rodGeo, rebarMat);
          rod.position.set(
            cx + (r % 2 ? 0.14 : -0.14),
            totalHeight + 0.7,
            cz + (r > 1 ? 0.14 : -0.14)
          );
          conGroup.add(rod);
        }
      }
    }

    // 3. Steel Scaffolding Frame along the Street Facade
    const scaffoldGeo = new THREE.CylinderGeometry(0.03, 0.03, totalHeight, 6);
    for (const sx of [-4.5, -1.5, 1.5, 4.5]) {
      const sp = new THREE.Mesh(scaffoldGeo, steelMat);
      sp.position.set(-5.6, totalHeight / 2, sx);
      conGroup.add(sp);
    }
    // Horizontal scaffolding tie-bars
    for (let h = 2.0; h <= totalHeight; h += 2.0) {
      const hBarGeo = new THREE.BoxGeometry(0.05, 0.05, 10.0);
      const hBar = new THREE.Mesh(hBarGeo, steelMat);
      hBar.position.set(-5.6, h, 0);
      conGroup.add(hBar);

      // Wooden scaffold walk plank
      const plankGeo = new THREE.BoxGeometry(0.6, 0.08, 9.8);
      const plank = new THREE.Mesh(plankGeo, woodMat);
      plank.position.set(-5.4, h - 0.04, 0);
      conGroup.add(plank);
    }

    // 4. Sharp River Sand Heap (Golden dune cone)
    const sandGeo = new THREE.ConeGeometry(2.6, 1.3, 16);
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 });
    const sandHeap = new THREE.Mesh(sandGeo, sandMat);
    sandHeap.position.set(-6.2, 0.65, -3.2);
    sandHeap.castShadow = true;
    sandHeap.receiveShadow = true;
    conGroup.add(sandHeap);

    // 5. Granite Gravel Aggregate Heap (Grey rocky cone)
    const gravelGeo = new THREE.ConeGeometry(2.2, 1.1, 16);
    const gravelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const gravelHeap = new THREE.Mesh(gravelGeo, gravelMat);
    gravelHeap.position.set(-6.2, 0.55, 3.2);
    gravelHeap.castShadow = true;
    gravelHeap.receiveShadow = true;
    conGroup.add(gravelHeap);

    // 6. Stack of 9-inch Hollow Sandcrete Blocks
    for (let bx = 0; bx < 3; bx++) {
      for (let bz = 0; bz < 3; bz++) {
        const stackGeo = new THREE.BoxGeometry(1.2, 1.4, 0.8);
        const stack = new THREE.Mesh(stackGeo, conMat);
        stack.position.set(2.5 + bx * 1.3, 0.7, -3.5 + bz * 0.9);
        stack.castShadow = true;
        conGroup.add(stack);
      }
    }

    // 7. Concrete Mixer Machine
    const mixerChassis = new THREE.Group();
    mixerChassis.position.set(-4.2, 0, 0);

    const frameGeo = new THREE.BoxGeometry(1.4, 0.8, 1.2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xea580c, metalness: 0.4, roughness: 0.6 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 0.6;
    mixerChassis.add(frame);

    // Tilted mixing drum
    const drumGeo = new THREE.CylinderGeometry(0.55, 0.75, 1.3, 16);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.5 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.rotation.z = Math.PI / 4;
    drum.position.set(0.2, 1.35, 0);
    drum.castShadow = true;
    mixerChassis.add(drum);

    conGroup.add(mixerChassis);

    // 8. Steel Construction Wheelbarrow
    const wbGroup = new THREE.Group();
    wbGroup.position.set(-5.5, 0, 1.0);
    const tubGeo = new THREE.BoxGeometry(0.8, 0.35, 0.6);
    const tubMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.5 });
    const tub = new THREE.Mesh(tubGeo, tubMat);
    tub.position.y = 0.4;
    tub.castShadow = true;
    wbGroup.add(tub);
    // Wheel
    const whGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12);
    const whMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wh = new THREE.Mesh(whGeo, whMat);
    wh.rotation.x = Math.PI / 2;
    wh.position.set(-0.45, 0.18, 0);
    wbGroup.add(wh);
    conGroup.add(wbGroup);

    // 9. Official LASPPPA Development Notice Board
    const signPostGeo = new THREE.BoxGeometry(0.1, 3.2, 0.1);
    for (const pz of [-1.5, 1.5]) {
      const post = new THREE.Mesh(signPostGeo, woodMat);
      post.position.set(-6.8, 1.6, pz);
      conGroup.add(post);
    }
    const lasSignGeo = new THREE.PlaneGeometry(3.2, 2.1);
    const lasSign = new THREE.Mesh(lasSignGeo, this.signLib.laspppaConstructionSignMaterial);
    lasSign.position.set(-6.82, 2.1, 0);
    lasSign.rotation.y = -Math.PI / 2; // Facing the street
    conGroup.add(lasSign);

    this.group.add(conGroup);

    this.interactiveList.push({
      mesh: conGroup,
      id: 'construction-site',
      name: 'Eko Mega Plaza Development Site',
      category: 'Work & Labor',
      description: 'Active 4-storey commercial development approved by LASPPPA. Casual day-labor available.',
      interactionPoint: new THREE.Vector3(10, 0, 54),
    });
  }

  // =========================================================================
  // 14. Street Law Enforcement Checkpoint (Nigeria Police & LASTMA Barrier)
  // =========================================================================
  private buildPoliceCheckpoint(): void {
    const cpGroup = new THREE.Group();
    cpGroup.position.set(5.5, 0, -32);

    // 1. Heavy Steel Oil Drum painted police blue with sandbag base
    const drumGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(-1.8, 0.6, 0);
    drum.castShadow = true;
    cpGroup.add(drum);

    // White stenciled Police crest ring around drum
    const ringGeo = new THREE.CylinderGeometry(0.51, 0.51, 0.25, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(-1.8, 0.6, 0);
    cpGroup.add(ring);

    // 2. Barricade Crossbeam (Black & Yellow hazard striped beam)
    const beamGeo = new THREE.BoxGeometry(3.6, 0.35, 0.12);
    const beam = new THREE.Mesh(beamGeo, this.matLib.curbStripedMaterial);
    beam.position.set(0, 0.9, 0);
    beam.castShadow = true;
    cpGroup.add(beam);

    // Two A-frame support legs for the wooden barricade
    const legGeo = new THREE.BoxGeometry(0.12, 1.0, 0.6);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    for (const lx of [-1.5, 1.5]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, 0.5, 0);
      leg.castShadow = true;
      cpGroup.add(leg);
    }

    // 3. Flashing Emergency Strobe Beacon Box (Red & Blue lights)
    const strobeGeo = new THREE.BoxGeometry(0.35, 0.2, 0.25);
    const strobeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const strobe = new THREE.Mesh(strobeGeo, strobeMat);
    strobe.position.set(0, 1.15, 0);
    cpGroup.add(strobe);

    const redLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redLight.position.set(-0.1, 1.18, 0);
    cpGroup.add(redLight);

    const blueLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
    );
    blueLight.position.set(0.1, 1.18, 0);
    cpGroup.add(blueLight);

    // 4. Traffic Cones with white retroreflective bands
    const coneGeo = new THREE.ConeGeometry(0.24, 0.75, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

    const conePositions = [
      new THREE.Vector3(1.8, 0.375, -1.0),
      new THREE.Vector3(2.4, 0.375, 0.8),
      new THREE.Vector3(-0.8, 0.375, -1.5),
    ];

    conePositions.forEach((pos) => {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(pos);
      cone.castShadow = true;

      const coneBand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.15, 12), bandMat);
      coneBand.position.set(pos.x, pos.y + 0.05, pos.z);
      cpGroup.add(cone);
      cpGroup.add(coneBand);
    });

    // 5. Stenciled High-Vis Caution Sign
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.6, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    signBoard.position.set(0, 1.6, 0);
    signBoard.castShadow = true;
    cpGroup.add(signBoard);

    // 6. Stylized Uniformed Police Officer on Duty
    const officerGroup = new THREE.Group();
    officerGroup.position.set(-0.9, 0, 0.5);

    // Boots & Legs
    const officerLegMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8), officerLegMat);
    legL.position.set(-0.13, 0.4, 0);
    legL.castShadow = true;
    const legR = legL.clone();
    legR.position.set(0.13, 0.4, 0);
    officerGroup.add(legL, legR);

    // Torso with High-Vis Reflective Enforcement Vest
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.25), torsoMat);
    torso.position.set(0, 1.05, 0);
    torso.castShadow = true;
    officerGroup.add(torso);

    const vestMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.5 });
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.45, 0.27), vestMat);
    vest.position.set(0, 1.05, 0);
    officerGroup.add(vest);

    // Reflective Silver Stripe across vest
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const refStripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.28), stripeMat);
    refStripe.position.set(0, 1.05, 0);
    officerGroup.add(refStripe);

    // Head
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x582f1b, roughness: 0.9 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), skinMat);
    head.position.set(0, 1.48, 0);
    head.castShadow = true;
    officerGroup.add(head);

    // Police Peaked Cap
    const capMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.5 });
    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.08, 12), capMat);
    capCrown.position.set(0, 1.58, 0);
    officerGroup.add(capCrown);

    const visorMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 });
    const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.12), visorMat);
    capVisor.position.set(0, 1.55, 0.12);
    officerGroup.add(capVisor);

    // Officer Arms
    const armMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.7 });
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), armMat);
    armL.position.set(-0.27, 1.05, 0);
    armL.castShadow = true;
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), armMat);
    armR.position.set(0.27, 1.05, 0.05);
    armR.rotation.x = -0.3; // holding inspection position
    armR.castShadow = true;
    officerGroup.add(armL, armR);

    // Clipboard
    const clipMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
    const clipBoard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.02), clipMat);
    clipBoard.position.set(0.27, 0.95, 0.22);
    clipBoard.rotation.x = -0.3;
    officerGroup.add(clipBoard);

    cpGroup.add(officerGroup);

    this.group.add(cpGroup);

    this.interactiveList.push({
      mesh: cpGroup,
      id: 'street-checkpoint',
      name: 'Police & LASTMA Checkpoint',
      category: 'Law Enforcement',
      description: 'Official street checkpoint. Vehicle particulars & safety gear verification inspection point.',
      interactionPoint: new THREE.Vector3(5.5, 0, -32),
    });
  }

  public toggleCompoundGate(open?: boolean): boolean {
    this.isGateOpen = open !== undefined ? open : !this.isGateOpen;
    if (this.isGateOpen) this.compoundGate?.open();
    else this.compoundGate?.close();
    return this.isGateOpen;
  }

  public update(_delta: number): void {
    // The compound gate is moved by the interaction system with every other door
  }
}
