import * as THREE from 'three';
import type { RideDetails, RideCameraView } from './TransitTypes';
import { WorldMapPrefabs } from '../world/map/WorldMapPrefabs';
import { Builder } from '../world/kit/ArchKit';
import { showGameToast } from '../ui/GameToast';

export class RoadRideExperience {
  public group: THREE.Group;
  public isActive: boolean = false;
  public currentCameraView: RideCameraView = 'inside';

  // Dedicated Camera
  public rideCamera: THREE.PerspectiveCamera;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Subgroups
  private vehicleGroup: THREE.Group = new THREE.Group();
  /** The inside of a coach, for a journey that is ridden and not driven */
  private coachGroup: THREE.Group = new THREE.Group();
  private byCoach = false;
  private trafficGroup: THREE.Group = new THREE.Group();
  private sceneryGroup: THREE.Group = new THREE.Group();
  /** Authentic Nigerian Expressway and Inter-State Highway Rest Stop */
  private highwaySceneryGroup: THREE.Group = new THREE.Group();
  private restStopAnnounced: boolean = false;
  private restDepartureAnnounced: boolean = false;
  private steeringWheel!: THREE.Group;

  // Active Ride Metadata
  public currentRide: RideDetails | null = null;
  private elapsedTime: number = 0;
  private totalDuration: number = 24; // seconds for demo ride
  private animTime: number = 0;

  // Traffic vehicles
  private trafficCars: Array<{ mesh: THREE.Group; baseZ: number; speed: number }> = [];

  // Callbacks
  public onRideCompleted?: (ride: RideDetails) => void;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.rideCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.group.add(this.sceneryGroup);
    this.group.add(this.highwaySceneryGroup);
    this.group.add(this.vehicleGroup);
    this.group.add(this.trafficGroup);

    // Warm Sun and Ambient
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    sunLight.position.set(40, 80, 50);
    this.group.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    this.group.add(ambientLight);

    this.buildStreetScenery();
    this.buildHighwayAndRestStop();
    this.buildPlayerVehicleCockpit();
    this.buildCoachCabin();
    this.buildDenseTraffic();
  }

  // =========================================================================
  // A coach, from a passenger's seat: rows of seats ahead, the aisle, windows down both sides,
  // racks overhead, the driver at the front. Seen from outside it is the coach on the road.
  // =========================================================================
  private buildCoachCabin(): void {
    const LIVERY = 0x0f5132;
    const CREAM = 0xf5f0e6;
    const SEAT = 0x1e3a5f;
    const FLOOR = 0.9;
    const HALF = 1.28;
    const BACK = -6;
    const FRONT = 5.6;
    const LENGTH = FRONT - BACK;
    const MIDDLE = (FRONT + BACK) / 2;
    const b = new Builder().around(0, 0);

    // The floor, the wheels under it, the roof
    b.box(0x334155, HALF * 2, 0.12, LENGTH, 0, FLOOR - 0.12, MIDDLE);
    b.box(0x27272a, HALF * 2 - 0.1, 0.4, LENGTH - 0.6, 0, 0.4, MIDDLE);
    for (const z of [BACK + 2, FRONT - 2.2]) b.box(0x18181b, HALF * 2 + 0.1, 1.0, 1.05, 0, 0, z);
    b.box(0xf8fafc, HALF * 2 + 0.04, 0.1, LENGTH, 0, FLOOR + 2.15, MIDDLE);
    // Each side: the panel below the windows (the livery outside, a liner inside), the pillars between them, the rail above
    for (const side of [-1, 1]) {
      b.box(LIVERY, 0.06, 0.95, LENGTH, side * HALF, FLOOR - 0.35, MIDDLE);
      b.box(CREAM, 0.03, 0.6, LENGTH, side * (HALF - 0.05), FLOOR, MIDDLE);
      b.box(0xf8fafc, 0.06, 0.4, LENGTH, side * HALF, FLOOR + 1.75, MIDDLE);
      for (let z = BACK; z <= FRONT + 0.01; z += 1.45) b.box(0xe2e8f0, 0.07, 1.2, 0.12, side * HALF, FLOOR + 0.58, z);
      // The rack over the seats, with a bag or two on it
      b.box(0xcbd5e1, 0.5, 0.05, LENGTH - 1.6, side * (HALF - 0.3), FLOOR + 1.62, MIDDLE - 0.4);
      b.box(side > 0 ? 0x7c2d12 : 0x1e3a8a, 0.4, 0.26, 0.7, side * (HALF - 0.3), FLOOR + 1.67, 1.5 * side);
    }
    // The back wall, and the front: the screen pillars and the board over the screen
    b.box(LIVERY, HALF * 2, 2.2, 0.06, 0, FLOOR - 0.35, BACK);
    for (const side of [-1, 1]) b.box(0xe2e8f0, 0.1, 1.5, 0.1, side * (HALF - 0.05), FLOOR + 0.6, FRONT);
    b.box(LIVERY, HALF * 2, 0.6, 0.08, 0, FLOOR - 0.05, FRONT);
    b.box(0x0f172a, HALF * 2, 0.32, 0.08, 0, FLOOR + 1.83, FRONT);
    // Seats: two each side of the aisle, row behind row, each with a white cloth over its head
    for (let z = BACK + 0.7; z < FRONT - 2.4; z += 0.92) {
      for (const x of [-0.98, -0.52, 0.52, 0.98]) {
        b.box(SEAT, 0.42, 0.14, 0.46, x, FLOOR + 0.38, z);
        b.box(SEAT, 0.42, 0.78, 0.12, x, FLOOR + 0.42, z - 0.26);
        b.box(0xf8fafc, 0.36, 0.2, 0.13, x, FLOOR + 1.02, z - 0.26);
      }
    }
    // Passengers ahead: the backs of a few heads over the seats
    for (const [x, z, hair] of [[-0.98, 1.3, 0x1c1917], [0.52, 0.38, 0x292524], [-0.52, -0.54, 0x1c1917], [0.98, 2.22, 0x44403c]] as Array<[number, number, number]>) {
      b.box(0x6b4226, 0.24, 0.26, 0.24, x, FLOOR + 1.2, z - 0.12);
      b.box(hair, 0.26, 0.1, 0.26, x, FLOOR + 1.44, z - 0.12);
    }
    // The driver, the wheel in front of him, the dashboard
    b.box(0x111827, 0.5, 0.9, 0.14, -0.72, FLOOR + 0.4, FRONT - 1.9);
    b.box(0x0f5132, 0.46, 0.5, 0.26, -0.72, FLOOR + 0.75, FRONT - 1.7);
    b.box(0x6b4226, 0.26, 0.28, 0.26, -0.72, FLOOR + 1.27, FRONT - 1.7);
    b.box(0x18181b, 0.5, 0.06, 0.5, -0.72, FLOOR + 0.95, FRONT - 1.05);
    b.box(0x1f2937, HALF * 2 - 0.1, 0.3, 0.6, 0, FLOOR + 0.5, FRONT - 0.4);
    // The clock over the screen
    b.box(0xfde68a, 0.5, 0.14, 0.03, 0.4, FLOOR + 1.92, FRONT - 0.06, { glow: true });

    this.coachGroup = b.build('coach cabin');
    this.coachGroup.visible = false;
    this.group.add(this.coachGroup);
  }

  // =========================================================================
  // 1. STREET SCENERY & SURROUNDING BUILDINGS
  // =========================================================================
  private buildStreetScenery(): void {
    const roadWidth = 16;
    const roadLen = 300;

    // Asphalt Road
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLen);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.05;
    this.sceneryGroup.add(road);

    // Yellow Dashed Centerlines
    const stripeGeo = new THREE.PlaneGeometry(0.3, 3.5);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let z = -140; z <= 140; z += 7) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.06, z);
      this.sceneryGroup.add(stripe);
    }

    // Sidewalks
    const walkGeo = new THREE.BoxGeometry(4.0, 0.25, roadLen);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

    const walkL = new THREE.Mesh(walkGeo, walkMat);
    walkL.position.set(-10, 0.12, 0);
    this.sceneryGroup.add(walkL);

    const walkR = new THREE.Mesh(walkGeo, walkMat);
    walkR.position.set(10, 0.12, 0);
    this.sceneryGroup.add(walkR);

    // Street Stalls with colorful awnings along sidewalk
    const canopyColors = [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b, 0x9333ea];
    for (let z = -120; z <= 120; z += 18) {
      // Left stall
      const cColor = canopyColors[Math.abs(z) % canopyColors.length];
      const stallL = WorldMapPrefabs.createShopPlaza(cColor, 0.75);
      stallL.position.set(-14, 0.25, z);
      this.sceneryGroup.add(stallL);

      // Right stall
      const stallR = WorldMapPrefabs.createShopPlaza(canopyColors[(Math.abs(z) + 1) % canopyColors.length], 0.75);
      stallR.position.set(14, 0.25, z + 8);
      this.sceneryGroup.add(stallR);
    }
  }

  // =========================================================================
  // 1b. INTER-STATE HIGHWAY & ROADSIDE REST STOP (Ore / Lokoja / Benin Oasis)
  // =========================================================================
  private buildHighwayAndRestStop(): void {
    const highwayLen = 360;

    // 1. Lush Green Savanna Ground
    const groundGeo = new THREE.PlaneGeometry(360, highwayLen);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x2e5628, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    this.highwaySceneryGroup.add(ground);

    // 2. Red Laterite Soil Shoulders (Nigeria's signature highway earth verges)
    const lateriteMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9 });
    for (const side of [-14, 14]) {
      const shoulderGeo = new THREE.PlaneGeometry(6.0, highwayLen);
      const shoulder = new THREE.Mesh(shoulderGeo, lateriteMat);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(side, 0.03, 0);
      this.highwaySceneryGroup.add(shoulder);
    }

    // 3. 4-Lane Dual-Carriageway Asphalt Expressway
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.82 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(22, highwayLen), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.04, 0);
    this.highwaySceneryGroup.add(road);

    // Concrete New Jersey Median Crash Barrier
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, highwayLen), barrierMat);
    barrier.position.set(0, 0.4, 0);
    this.highwaySceneryGroup.add(barrier);

    // Road Markings: Solid white outer lines, solid yellow median lines, dashed white lane dividers
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    for (const x of [-10.5, 10.5]) {
      const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.25, highwayLen), lineMat);
      edgeLine.rotation.x = -Math.PI / 2;
      edgeLine.position.set(x, 0.05, 0);
      this.highwaySceneryGroup.add(edgeLine);
    }

    for (const x of [-0.6, 0.6]) {
      const medianLine = new THREE.Mesh(new THREE.PlaneGeometry(0.2, highwayLen), yellowMat);
      medianLine.rotation.x = -Math.PI / 2;
      medianLine.position.set(x, 0.05, 0);
      this.highwaySceneryGroup.add(medianLine);
    }

    // Dashed lane stripes along lanes
    for (let z = -170; z <= 170; z += 9) {
      for (const x of [-5.5, 5.5]) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 4.2), lineMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 0.05, z);
        this.highwaySceneryGroup.add(stripe);
      }
    }

    // 4. Overhead Highway Directional Gantry Sign
    const gantry = new THREE.Group();
    gantry.position.set(0, 0, -85);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    for (const gx of [-12.5, 12.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.5, 0.4), steelMat);
      leg.position.set(gx, 3.25, 0);
      gantry.add(leg);
    }

    const beam = new THREE.Mesh(new THREE.BoxGeometry(25.4, 0.45, 0.45), steelMat);
    beam.position.set(0, 6.2, 0);
    gantry.add(beam);

    // Green highway signboard
    const signBoardMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4 });
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 0.15), signBoardMat);
    signBoard.position.set(0, 5.2, 0);
    gantry.add(signBoard);

    // Reflective white gantry border
    const signBorder = new THREE.Mesh(new THREE.BoxGeometry(16.2, 2.5, 0.05), lineMat);
    signBorder.position.set(0, 5.2, -0.06);
    gantry.add(signBorder);

    this.highwaySceneryGroup.add(gantry);

    // 5. Roadside Palm Trees & Umbrella Acacia Trees along left & right banks
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const palmFrondMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });

    for (let z = -160; z <= 160; z += 35) {
      // Left verge tree
      const palmL = this.createPalmTree(trunkMat, palmFrondMat);
      palmL.position.set(-18 - Math.random() * 4, 0, z + (Math.random() - 0.5) * 10);
      this.highwaySceneryGroup.add(palmL);

      // Right verge tree (beyond rest stop)
      if (z < -50 || z > 60) {
        const palmR = this.createPalmTree(trunkMat, palmFrondMat);
        palmR.position.set(18 + Math.random() * 4, 0, z + (Math.random() - 0.5) * 10);
        this.highwaySceneryGroup.add(palmR);
      }
    }

    // 6. THE ORE / LOKOJA INTER-STATE HIGHWAY REST STOP (Right side: x = 14 to 38, z = -45 to +55)
    this.buildRestStopComplex();
  }

  private buildRestStopComplex(): void {
    const restGroup = new THREE.Group();
    restGroup.position.set(24, 0, 5);

    // A. Concrete Rest Stop Apron / Parking Yard
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(24, 110), apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, 0.05, 0);
    restGroup.add(apron);

    // Curb edge between highway laterite and apron
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 110), curbMat);
    curb.position.set(-12, 0.1, 0);
    restGroup.add(curb);

    // B. Filling Station Canopy & Fuel Dispensers (Ore Fuel Oasis)
    const stationGroup = new THREE.Group();
    stationGroup.position.set(2, 0, -30);

    // 4 Support Pillars
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 });
    for (const px of [-5, 5]) {
      for (const pz of [-3, 3]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 5.0, 10), steelMat);
        pillar.position.set(px, 2.5, pz);
        stationGroup.add(pillar);
      }
    }

    // Large Elevated Canopy
    const canopyRoofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.8, 10), canopyRoofMat);
    canopyRoof.position.set(0, 5.2, 0);
    stationGroup.add(canopyRoof);

    // Green and Red brand fascia stripes (NNPC / Conoil styling)
    const greenFascia = new THREE.Mesh(new THREE.BoxGeometry(15.1, 0.3, 10.1), new THREE.MeshBasicMaterial({ color: 0x15803d }));
    greenFascia.position.set(0, 5.3, 0);
    stationGroup.add(greenFascia);

    const redFascia = new THREE.Mesh(new THREE.BoxGeometry(15.1, 0.15, 10.1), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    redFascia.position.set(0, 5.05, 0);
    stationGroup.add(redFascia);

    // 2 Fuel Pump Islands
    const islandMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    for (const ix of [-4, 4]) {
      const island = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 5.5), islandMat);
      island.position.set(ix, 0.125, 0);
      stationGroup.add(island);

      // Pumps on island
      for (const pz of [-1.5, 1.5]) {
        const pump = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8, 0.7), pumpMat);
        pump.position.set(ix, 1.1, pz);
        stationGroup.add(pump);

        // Digital screen
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
        screen.position.set(ix, 1.5, pz + 0.36);
        stationGroup.add(screen);
      }
    }

    // Totem Price Board by entrance
    const totem = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    totem.position.set(-10, 2.4, -48);
    stationGroup.add(totem);

    const totemDisplay = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.05), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    totemDisplay.position.set(-10, 3.4, -47.78);
    stationGroup.add(totemDisplay);

    restGroup.add(stationGroup);

    // C. Ore Travellers Food Canteen & Roadside Pavilions
    const canteenGroup = new THREE.Group();
    canteenGroup.position.set(4, 0, 15);

    // Pavilion Concrete Floor
    const pavFloor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.2, 9), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 }));
    pavFloor.position.set(0, 0.1, 0);
    canteenGroup.add(pavFloor);

    // Timber Roof Pillars
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x573a1e, roughness: 0.85 });
    for (const px of [-6.5, 0, 6.5]) {
      for (const pz of [-4, 4]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), woodMat);
        pillar.position.set(px, 1.6, pz);
        canteenGroup.add(pillar);
      }
    }

    // Corrugated Pitched Roof
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7, metalness: 0.3 }); // Weathered zinc
    const roofL = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 5), roofMat);
    roofL.position.set(0, 3.6, -2.2);
    roofL.rotation.x = 0.25;
    canteenGroup.add(roofL);

    const roofR = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 5), roofMat);
    roofR.position.set(0, 3.6, 2.2);
    roofR.rotation.x = -0.25;
    canteenGroup.add(roofR);

    // Picnic Tables & Wooden Benches
    for (const tx of [-4, 4]) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.2), woodMat);
      table.position.set(tx, 0.85, 0);
      canteenGroup.add(table);

      for (const bz of [-0.9, 0.9]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.08, 0.4), woodMat);
        bench.position.set(tx, 0.5, bz);
        canteenGroup.add(bench);
      }
    }

    // Warm Hanging Bulbs under Canteen
    const bulbLight = new THREE.PointLight(0xfef08a, 1.6, 12);
    bulbLight.position.set(0, 3.0, 0);
    canteenGroup.add(bulbLight);

    // Suya Barbecue Grill Station (Sizzling street suya)
    const grillMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.6 });
    const grill = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 0.8), grillMat);
    grill.position.set(-7.5, 0.5, -2.5);
    canteenGroup.add(grill);

    // Glowing Charcoal Embers
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const embers = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.65), emberMat);
    embers.position.set(-7.5, 0.9, -2.5);
    canteenGroup.add(embers);

    // Roadside Roasted Plantain (Boli) Stand
    const boliStandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
    const boliStand = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.85, 12), woodMat);
    boliStand.position.set(-7.5, 0.42, 2.2);
    canteenGroup.add(boliStand);

    // Yellow roasted plantains on tray
    const boliTray = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.05, 12), boliStandMat);
    boliTray.position.set(-7.5, 0.88, 2.2);
    canteenGroup.add(boliTray);

    // Market Umbrella over Boli Stand
    const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
    const umbrellaCone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 10), umbrellaMat);
    umbrellaCone.position.set(-7.5, 2.4, 2.2);
    canteenGroup.add(umbrellaCone);

    const umbrellaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), steelMat);
    umbrellaPole.position.set(-7.5, 1.2, 2.2);
    canteenGroup.add(umbrellaPole);

    // Ice Chests & Cold Drink Coolers
    const coolerRed = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.55), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
    coolerRed.position.set(0, 0.35, -3.2);
    canteenGroup.add(coolerRed);

    const coolerBlue = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.55), new THREE.MeshStandardMaterial({ color: 0x2563eb }));
    coolerBlue.position.set(1.0, 0.35, -3.2);
    canteenGroup.add(coolerBlue);

    restGroup.add(canteenGroup);

    // D. Parked Inter-State Commercial Vehicles (Wazobia Express bus & Commuter van)
    const parkedBus = this.createParkedCoach();
    parkedBus.position.set(0, 0, 38);
    restGroup.add(parkedBus);

    const hiaceVan = WorldMapPrefabs.createMiniVehicle('danfo', 0xffffff);
    hiaceVan.scale.set(1.4, 1.4, 1.4);
    hiaceVan.position.set(-5, 0.3, -8);
    restGroup.add(hiaceVan);

    // E. 3D Resting Travellers & Vendors Stretching Legs
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.8 });
    const attireColors = [0x0284c7, 0xd97706, 0x16a34a, 0x9333ea, 0xdc2626];

    // 4 Travellers in different stances
    const travellerOffsets = [
      { x: -3.5, z: 12, rot: 0.3, color: attireColors[0] }, // Stretching beside table
      { x: -2.5, z: 13.5, rot: -1.2, color: attireColors[1] }, // Holding drink chatting
      { x: 3.5, z: 12, rot: 2.1, color: attireColors[2] }, // Seated enjoying snack
      { x: -4.5, z: 28, rot: 0.8, color: attireColors[3] }, // Standing beside parked coach
    ];

    travellerOffsets.forEach((t) => {
      const traveller = new THREE.Group();
      traveller.position.set(t.x, 0, t.z);
      traveller.rotation.y = t.rot;

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.8, 0.28), new THREE.MeshStandardMaterial({ color: t.color }));
      body.position.y = 1.0;
      traveller.add(body);

      const pants = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.26), new THREE.MeshStandardMaterial({ color: 0x1e293b }));
      pants.position.y = 0.38;
      traveller.add(pants);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), skinMat);
      head.position.y = 1.6;
      traveller.add(head);

      restGroup.add(traveller);
    });

    this.highwaySceneryGroup.add(restGroup);
  }

  private createPalmTree(trunkMat: THREE.Material, frondMat: THREE.Material): THREE.Group {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 5.5, 8), trunkMat);
    trunk.position.y = 2.75;
    trunk.rotation.z = (Math.random() - 0.5) * 0.12;
    tree.add(trunk);

    // Palm Crown
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.5), frondMat);
      frond.position.set(Math.cos(angle) * 1.0, 5.4, Math.sin(angle) * 1.0);
      frond.rotation.y = angle;
      frond.rotation.z = -0.35;
      tree.add(frond);
    }
    return tree;
  }

  private createParkedCoach(): THREE.Group {
    const coach = new THREE.Group();
    const liveryMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 }); // Blue luxury coach
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 9.5), liveryMat);
    body.position.y = 1.6;
    coach.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.3, 9.6), whiteMat);
    roof.position.y = 2.8;
    coach.add(roof);

    // Wheels
    for (const wx of [-1.35, 1.35]) {
      for (const wz of [-2.8, 2.8]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 10), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.5, wz);
        coach.add(wheel);
      }
    }
    return coach;
  }

  // =========================================================================
  // 2. 3D FIRST-PERSON COCKPIT (Mercedes G-Wagon Dashboard & Steering Wheel)
  // =========================================================================
  private buildPlayerVehicleCockpit(): void {
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.25,
    });

    // A. Main Dashboard Deck
    const dashGeo = new THREE.BoxGeometry(2.3, 0.45, 1.1);
    const dashboard = new THREE.Mesh(dashGeo, dashMat);
    dashboard.position.set(0, 1.15, 0.55);
    this.vehicleGroup.add(dashboard);

    // Instrument Cluster Visor
    const binnacleGeo = new THREE.BoxGeometry(0.75, 0.25, 0.5);
    const binnacle = new THREE.Mesh(binnacleGeo, dashMat);
    binnacle.position.set(-0.45, 1.45, 0.35);
    this.vehicleGroup.add(binnacle);

    // Central Infotainment Screen
    const screenGeo = new THREE.BoxGeometry(0.55, 0.3, 0.08);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0.1, 1.48, 0.5);
    this.vehicleGroup.add(screen);

    // B. 3D Steering Wheel (matching Screenshot 1)
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(-0.45, 1.25, 0.22);
    this.steeringWheel.rotation.x = -0.38;

    // Torus rim
    const rimGeo = new THREE.TorusGeometry(0.32, 0.045, 12, 28);
    const rim = new THREE.Mesh(rimGeo, leatherMat);
    this.steeringWheel.add(rim);

    // Center Horn Boss
    const bossGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16);
    const boss = new THREE.Mesh(bossGeo, leatherMat);
    boss.rotation.x = Math.PI / 2;
    this.steeringWheel.add(boss);

    // Spokes
    const spokeGeo = new THREE.BoxGeometry(0.56, 0.05, 0.03);
    const spoke = new THREE.Mesh(spokeGeo, chromeMat);
    this.steeringWheel.add(spoke);

    this.vehicleGroup.add(this.steeringWheel);

    // C. Windshield & A-Pillars Frame
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Left A-Pillar
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), pillarMat);
    pillarL.position.set(-1.15, 1.7, 0.7);
    pillarL.rotation.z = -0.22;
    pillarL.rotation.x = 0.35;
    this.vehicleGroup.add(pillarL);

    // Right A-Pillar
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), pillarMat);
    pillarR.position.set(1.15, 1.7, 0.7);
    pillarR.rotation.z = 0.22;
    pillarR.rotation.x = 0.35;
    this.vehicleGroup.add(pillarR);

    // Windshield Glass
    const glassGeo = new THREE.PlaneGeometry(2.2, 1.0);
    const windshield = new THREE.Mesh(glassGeo, glassMat);
    windshield.position.set(0, 1.72, 0.75);
    windshield.rotation.x = -0.35;
    this.vehicleGroup.add(windshield);

    // Rearview Mirror
    const mirrorGeo = new THREE.BoxGeometry(0.35, 0.12, 0.08);
    const mirror = new THREE.Mesh(mirrorGeo, dashMat);
    mirror.position.set(0, 2.15, 0.65);
    this.vehicleGroup.add(mirror);

    // Hood / Bonnet extending outward
    const hoodGeo = new THREE.BoxGeometry(2.1, 0.15, 1.6);
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, 1.05, 1.8);
    this.vehicleGroup.add(hood);
  }

  // =========================================================================
  // 3. DENSE TRAFFIC STREAM (Go-Slow: Danfos, Sedans, Blue Taxis, SUVs)
  // =========================================================================
  private buildDenseTraffic(): void {
    const trafficConfigs = [
      // Right ahead in player lane
      { type: 'car', color: 0xfef08a, offset: new THREE.Vector3(-0.45, 0, 7.5) },
      { type: 'car', color: 0xdc2626, offset: new THREE.Vector3(-0.45, 0, 14.5) },
      { type: 'danfo', color: 0xfacc15, offset: new THREE.Vector3(-0.45, 0, 22.0) },
      // Adjacent left lane
      { type: 'car', color: 0x0284c7, offset: new THREE.Vector3(-4.2, 0, 5.0) }, // Blue PH taxi
      { type: 'car', color: 0x475569, offset: new THREE.Vector3(-4.2, 0, 12.0) },
      { type: 'danfo', color: 0xfacc15, offset: new THREE.Vector3(-4.2, 0, 19.5) },
      // Opposite northbound lanes
      { type: 'car', color: 0x0284c7, offset: new THREE.Vector3(3.8, 0, 8.0) },
      { type: 'car', color: 0x16a34a, offset: new THREE.Vector3(3.8, 0, 16.0) },
      { type: 'danfo', color: 0xfacc15, offset: new THREE.Vector3(3.8, 0, 25.0) },
    ];

    for (const conf of trafficConfigs) {
      const car = WorldMapPrefabs.createMiniVehicle(conf.type as any, conf.color);
      car.scale.set(1.5, 1.5, 1.5);
      car.position.copy(conf.offset);
      car.position.y = 0.35;
      this.trafficGroup.add(car);

      this.trafficCars.push({
        mesh: car,
        baseZ: conf.offset.z,
        speed: 3.5 + Math.random() * 1.5,
      });
    }
  }

  // =========================================================================
  // RIDE LIFECYCLE & CAMERAS
  // =========================================================================
  public startRide(ride: RideDetails): void {
    this.currentRide = ride;
    this.isActive = true;
    this.group.visible = true;
    this.elapsedTime = 0;
    this.totalDuration = ride.durationSeconds || 24;

    // A coach is ridden from a passenger's seat, on an open road; anything else is driven in traffic
    this.byCoach = ride.vehicleType === 'coach';
    this.vehicleGroup.visible = !this.byCoach;
    this.trafficGroup.visible = !this.byCoach;
    this.coachGroup.visible = this.byCoach;

    this.sceneryGroup.visible = !this.byCoach;
    this.highwaySceneryGroup.visible = this.byCoach;
    this.restStopAnnounced = false;
    this.restDepartureAnnounced = false;

    this.setCameraView('inside');
  }

  public setCameraView(view: RideCameraView): void {
    this.currentCameraView = view;
    this.updateCameraTransform();
  }

  public skipRide(): void {
    this.completeRide();
  }

  private completeRide(): void {
    this.isActive = false;
    this.group.visible = false;
    if (this.currentRide) {
      this.onRideCompleted?.(this.currentRide);
    }
  }

  private updateCameraTransform(): void {
    if (this.byCoach) {
      if (this.currentCameraView === 'inside') {
        // A seat by the window on the right, a few rows back: the aisle and the screen ahead, the road going by beside
        this.rideCamera.position.set(0.86, 2.12, -1.9);
        this.cameraTarget.set(-0.1, 1.95, 9);
      } else if (this.currentCameraView === 'chase') {
        this.rideCamera.position.set(0, 5.6, -15);
        this.cameraTarget.set(0, 2, 4);
      } else {
        this.rideCamera.position.set(11, 3.2, 1);
        this.cameraTarget.set(0, 1.8, 0.5);
      }
      this.rideCamera.lookAt(this.cameraTarget);
      return;
    }
    if (this.currentCameraView === 'inside') {
      // First-person cockpit view behind steering wheel
      this.rideCamera.position.set(-0.45, 1.52, -0.05);
      this.cameraTarget.set(-0.45, 1.48, 12);
      this.rideCamera.lookAt(this.cameraTarget);
    } else if (this.currentCameraView === 'chase') {
      // Third-person chase cam behind vehicle
      this.rideCamera.position.set(0, 3.8, -7.5);
      this.cameraTarget.set(0, 1.6, 6);
      this.rideCamera.lookAt(this.cameraTarget);
    } else {
      // Side tracking profile shot
      this.rideCamera.position.set(6.5, 2.2, 1.5);
      this.cameraTarget.set(0, 1.5, 2.5);
      this.rideCamera.lookAt(this.cameraTarget);
    }
  }

  // =========================================================================
  // UPDATE LOOP (Steering micro-movement, Go-slow stop & go, scenery scroll)
  // =========================================================================
  public update(delta: number): void {
    if (!this.isActive) return;

    this.animTime += delta;
    this.elapsedTime += delta;

    if (!this.byCoach) {
      // Gentle micro-steer oscillation on steering wheel
      if (this.steeringWheel) {
        this.steeringWheel.rotation.z = Math.sin(this.animTime * 1.8) * 0.08;
      }

      // Go-slow traffic bumper movement
      for (const car of this.trafficCars) {
        car.mesh.position.z += Math.sin(this.animTime * 2.2) * 0.02;
      }

      // Scenery backward scrolling to simulate forward motion in city go-slow
      const speed = 6.0;
      this.sceneryGroup.position.z -= speed * delta;
      if (this.sceneryGroup.position.z < -60) {
        this.sceneryGroup.position.z += 60;
      }
    } else {
      // Express Coach travel along inter-state highway with roadside rest stop oasis
      const progress = Math.min(1.0, this.elapsedTime / this.totalDuration);
      let coachSpeed = 16.0; // Cruise speed (m/s)

      // Coasting near the rest stop oasis halfway through journey
      if (progress >= 0.28 && progress < 0.68) {
        coachSpeed = 5.0; // Slow down as coach coasts through rest stop oasis
        if (!this.restStopAnnounced) {
          this.restStopAnnounced = true;
          showGameToast('🚌 Ore Junction Rest Stop: Travellers stretch legs, fresh suya & cold drinks.', 'info', 4500);
        }
      } else if (progress >= 0.68) {
        coachSpeed = 17.5; // Back up to highway speed
        if (!this.restDepartureAnnounced) {
          this.restDepartureAnnounced = true;
          showGameToast('🚌 Conductor: "All aboard! Back on the express highway, motor park ahead."', 'info', 4000);
        }
      }

      // Scroll highway scenery backwards to simulate forward movement
      this.highwaySceneryGroup.position.z -= coachSpeed * delta;
      if (this.highwaySceneryGroup.position.z < -110) {
        this.highwaySceneryGroup.position.z += 110;
      }
    }

    // Auto complete ride at end of duration
    if (this.elapsedTime >= this.totalDuration) {
      this.completeRide();
    }
  }

  public handleResize(): void {
    this.rideCamera.aspect = window.innerWidth / window.innerHeight;
    this.rideCamera.updateProjectionMatrix();
  }
}
