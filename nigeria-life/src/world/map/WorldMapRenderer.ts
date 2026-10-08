import * as THREE from 'three';
import { WorldDataManager } from '../data/WorldDataManager';
import { WorldMapPrefabs } from './WorldMapPrefabs';
import type { DistrictData, MapLandmark, MapProperty, MapBusiness } from '../data/WorldDataTypes';

export interface MapSelectionEvent {
  type: 'district' | 'landmark' | 'property' | 'business';
  item: DistrictData | MapLandmark | MapProperty | MapBusiness;
  screenPosition: { x: number; y: number };
}

export class WorldMapRenderer {
  public group: THREE.Group;
  public cityContentGroup: THREE.Group;
  private propertyGroup: THREE.Group;
  private dataManager: WorldDataManager;

  private currentCityId: 'lagos' | 'abuja' | 'port_harcourt' = 'lagos';

  // Animated elements
  private waterMeshes: THREE.Mesh[] = [];
  private playerPin!: THREE.Group;
  private miniTraffic: Array<{ mesh: THREE.Group; path: THREE.LineCurve3; t: number; speed: number }> = [];
  private animTime: number = 0;

  // Clickable interactive map objects
  public interactiveMapObjects: Array<{
    mesh: THREE.Object3D;
    type: 'district' | 'landmark' | 'property' | 'business';
    data: DistrictData | MapLandmark | MapProperty | MapBusiness;
  }> = [];

  // District highlight meshes
  private districtHighlightMeshes: Map<string, THREE.Mesh> = new Map();

  constructor() {
    this.group = new THREE.Group();
    this.cityContentGroup = new THREE.Group();
    this.propertyGroup = new THREE.Group();
    this.group.add(this.cityContentGroup);
    this.group.add(this.propertyGroup);

    this.dataManager = WorldDataManager.getInstance();

    // Dedicated Ultra-Vibrant Map Lighting (Zero haze, rich contrast, crystal-clear readability)
    const mapSun = new THREE.DirectionalLight(0xffffff, 2.6);
    mapSun.position.set(60, 220, 80);
    this.group.add(mapSun);

    const mapFill = new THREE.DirectionalLight(0xe0f2fe, 1.3);
    mapFill.position.set(-60, 160, -60);
    this.group.add(mapFill);

    const mapAmbient = new THREE.AmbientLight(0xffffff, 1.7);
    this.group.add(mapAmbient);

    // Initial load defaults to current city in WorldDataManager
    const initialCity = this.dataManager.getCurrentCityId();
    this.loadCity(initialCity);
  }

  // =========================================================================
  // DYNAMIC CITY LOADER (Supports Lagos, Abuja FCT, and Port Harcourt)
  // =========================================================================
  public loadCity(cityId: string): void {
    const cleanId = cityId.toLowerCase().replace(/[\s-]/g, '_');
    if (cleanId.includes('abuja')) {
      this.currentCityId = 'abuja';
    } else if (cleanId.includes('port') || cleanId.includes('ph') || cleanId.includes('harcourt')) {
      this.currentCityId = 'port_harcourt';
    } else {
      this.currentCityId = 'lagos';
    }

    // Update data manager active dataset
    this.dataManager.switchCity(this.currentCityId);

    // Clear previous city visual meshes & interactions
    this.cityContentGroup.clear();
    this.propertyGroup.clear();
    this.interactiveMapObjects = [];
    this.districtHighlightMeshes.clear();
    this.miniTraffic = [];
    this.waterMeshes = [];

    // Build city-specific geography, infrastructure & landmarks
    if (this.currentCityId === 'abuja') {
      this.buildAbujaGeography();
      this.buildAbujaRoads();
      this.buildAbujaLandmarks();
      this.buildAbujaProceduralBlocks();
      this.buildAbujaTraffic();
    } else if (this.currentCityId === 'port_harcourt') {
      this.buildPortHarcourtGeography();
      this.buildPortHarcourtRoads();
      this.buildPortHarcourtLandmarks();
      this.buildPortHarcourtProceduralBlocks();
      this.buildPortHarcourtTraffic();
    } else {
      this.buildLagosGeography();
      this.buildLagosRoadsAndBridges();
      this.buildLagosLandmarks();
      this.buildLagosProceduralBlocks();
      this.buildLagosTraffic();
    }

    // Shared: build district territories, property markers, and player pin
    this.buildDistrictTerritories();
    this.refreshPropertyMarkers();
    this.buildPlayerPin();
  }

  // =========================================================================
  // ABUJA: GEOGRAPHY, TERRAIN & WATER (Highland Savanna, Aso Rock, Jabi Lake)
  // =========================================================================
  private buildAbujaGeography(): void {
    // 1. Manicured Capital Savanna Floor
    const groundGeo = new THREE.PlaneGeometry(360, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f, // Lush highland savanna green
      roughness: 0.85,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.cityContentGroup.add(ground);

    // 2. Rolling Highland Mountain Ridges (North & East backdrop)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.95 });
    const hillPositions = [
      [-100, -85, 22], [-40, -95, 26], [20, -100, 30], [80, -90, 28],
      [115, -40, 25], [125, 20, 24], [110, 80, 22], [-110, -30, 20]
    ];
    for (const [hx, hz, hScale] of hillPositions) {
      const hill = new THREE.Mesh(new THREE.DodecahedronGeometry(hScale, 1), hillMat);
      hill.scale.set(1.4, 0.8, 1.2);
      hill.position.set(hx, hScale * 0.4, hz);
      this.cityContentGroup.add(hill);
    }

    // 3. ASO ROCK MONOLITH (Dominating East / Asokoro / Three Arms Zone)
    const asoRockGroup = WorldMapPrefabs.createAsoRock(1.35);
    asoRockGroup.position.set(75, 0, 15);
    this.cityContentGroup.add(asoRockGroup);
    this.addWaterLabel('ASO ROCK', 75, 18, 15, 34, 9, '#fef08a');

    // 4. ZUMA ROCK BACKDROP (North-West)
    const zumaRockGroup = WorldMapPrefabs.createAsoRock(1.1);
    zumaRockGroup.position.set(-85, 0, -65);
    this.cityContentGroup.add(zumaRockGroup);
    this.addWaterLabel('ZUMA ROCK', -85, 15, -65, 32, 8, '#fef08a');

    // 5. JABI LAKE (Vibrant Sparkling Blue with "JABI LAKE" Surface Label)
    const jabiGeo = new THREE.CylinderGeometry(24, 28, 0.2, 32);
    const jabiMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.92,
    });
    const jabiLake = new THREE.Mesh(jabiGeo, jabiMat);
    jabiLake.scale.set(1.4, 1.0, 0.85);
    jabiLake.position.set(-85, 0.05, 45);
    this.cityContentGroup.add(jabiLake);
    this.waterMeshes.push(jabiLake);

    // Lake edge promenade
    const ringGeo = new THREE.RingGeometry(24.5, 26.5, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const promenade = new THREE.Mesh(ringGeo, ringMat);
    promenade.scale.set(1.4, 0.85, 1.0);
    promenade.rotation.x = -Math.PI / 2;
    promenade.position.set(-85, 0.1, 45);
    this.cityContentGroup.add(promenade);

    // Jabi Lake Water Label
    this.addWaterLabel('JABI LAKE', -85, 0.25, 45, 28, 8, '#ffffff');

    // Geographic Zone Banners
    this.addWaterLabel('THREE ARMS ZONE', 45, 0.3, 0, 32, 7, '#ffffff');
    this.addWaterLabel('CENTRAL AREA', 0, 0.3, 0, 26, 6, '#ffffff');
    this.addWaterLabel('MAITAMA HILLS', 0, 0.3, -45, 28, 7, '#ffffff');
    this.addWaterLabel('GARKI DISTRICT', 0, 0.3, 55, 28, 7, '#ffffff');
  }

  // Abuja Planned Boulevards & Roundabouts
  private buildAbujaRoads(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const lawnMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });

    // A. Constitution Avenue (East-West spine: X: -75 to 65, Z = 0)
    const constAve = new THREE.Mesh(new THREE.BoxGeometry(140, 0.16, 4.6), asphaltMat);
    constAve.position.set(-5, 0.08, 0);
    this.cityContentGroup.add(constAve);

    // B. Independence Avenue (East-West parallel: X: -60 to 60, Z = 25)
    const indepAve = new THREE.Mesh(new THREE.BoxGeometry(120, 0.16, 4.4), asphaltMat);
    indepAve.position.set(0, 0.08, 25);
    this.cityContentGroup.add(indepAve);

    // C. Shehu Shagari Way (North-South spine: Z: -65 to 65, X = 15)
    const shagariWay = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 130), asphaltMat);
    shagariWay.position.set(15, 0.08, 0);
    this.cityContentGroup.add(shagariWay);

    // D. Ahmadu Bello Way Abuja (North-South: Z: -65 to 65, X = -20)
    const belloWay = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 130), asphaltMat);
    belloWay.position.set(-20, 0.08, 0);
    this.cityContentGroup.add(belloWay);

    // E. Airport Expressway Corridor (Connecting Southwest to Nnamdi Azikiwe Airport: X: -30 to -10, Z: 65 to 135)
    const airportExp = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 75), asphaltMat);
    airportExp.position.set(-15, 0.08, 100);
    this.cityContentGroup.add(airportExp);

    // F. Iconic Abuja Green Roundabouts with Circular Fountains
    const roundaboutCenters = [
      [15, 0], [-20, 0], [15, 25], [-20, 25], [15, -35], [-20, -35]
    ];
    for (const [rx, rz] of roundaboutCenters) {
      // Outer asphalt ring
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.18, 24), asphaltMat);
      ring.position.set(rx, 0.09, rz);
      this.cityContentGroup.add(ring);

      // Inner green island
      const island = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.3, 24), lawnMat);
      island.position.set(rx, 0.22, rz);
      this.cityContentGroup.add(island);

      // White curb border
      const curb = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.22, 24), curbMat);
      curb.position.set(rx, 0.18, rz);
      this.cityContentGroup.add(curb);
    }
  }

  // Abuja Key Major Landmarks
  private buildAbujaLandmarks(): void {
    const landmarks = this.dataManager.getLandmarks();

    for (const lm of landmarks) {
      const lmGroup = new THREE.Group();
      lmGroup.position.copy(lm.position);

      if (lm.id === 'national_mosque') {
        lmGroup.add(WorldMapPrefabs.createNationalMosque(1.2));
      } else if (lm.id === 'national_christian_centre') {
        lmGroup.add(WorldMapPrefabs.createEcumenicalCentre(1.2));
      } else if (lm.id === 'national_assembly') {
        lmGroup.add(WorldMapPrefabs.createNationalAssembly(1.15));
      } else if (lm.id === 'transcorp_hilton') {
        lmGroup.add(WorldMapPrefabs.createTranscorp(1.15));
      } else if (lm.id === 'abuja_airport') {
        lmGroup.add(WorldMapPrefabs.createAirport(1.05));
        // Add Runway "27" Surface Label
        this.addWaterLabel('27', lm.position.x + 22, 0.45, lm.position.z, 8, 5, '#ffffff');
        this.addWaterLabel('RUNWAY', lm.position.x, 0.45, lm.position.z, 22, 5, '#ffffff');
      } else if (lm.id === 'cbn_headquarters') {
        lmGroup.add(WorldMapPrefabs.createBank(1.2));
      } else if (lm.id === 'national_hospital_abuja') {
        lmGroup.add(WorldMapPrefabs.createHospital(1.2));
      } else if (lm.id === 'jabi_lake_mall') {
        lmGroup.add(WorldMapPrefabs.createShopPlaza(0x0284c7, 1.25));
      } else if (lm.id === 'novare_gateway_mall') {
        lmGroup.add(WorldMapPrefabs.createShopPlaza(0x9333ea, 1.2));
      } else if (lm.id === 'aso_rock') {
        // Built in terrain, add marker hitbox
      } else {
        lmGroup.add(WorldMapPrefabs.createGlassTower(12, 0x10b981, 0.85));
      }

      // Circular Pin Marker Badge
      const badge = this.createLandmarkBadgeSprite(lm.icon, lm.name);
      badge.position.y = 8.5;
      lmGroup.add(badge);

      // Generous Hitbox for raycasting click & hover
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(9.0, 12.0, 9.0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
      );
      hit.position.y = 5.0;
      lmGroup.add(hit);

      this.interactiveMapObjects.push({
        mesh: hit,
        type: 'landmark',
        data: lm,
      });

      this.cityContentGroup.add(lmGroup);
    }
  }

  // Abuja Procedural City Blocks (Maitama villas, CBD glass monoliths, Gwarinpa estates)
  private buildAbujaProceduralBlocks(): void {
    const districts = this.dataManager.getDistricts();
    for (const d of districts) {
      const { minX, maxX, minZ, maxZ } = d.bounds;
      const stepX = (maxX - minX - 8) / 3;
      const stepZ = (maxZ - minZ - 8) / 3;

      let idx = 0;
      for (let gx = minX + 5; gx <= maxX - 5; gx += stepX) {
        for (let gz = minZ + 5; gz <= maxZ - 5; gz += stepZ) {
          idx++;
          const posX = gx + ((idx % 3) - 1) * 2;
          const posZ = gz + ((idx % 2) - 0.5) * 2;

          // Clear area near district center for landmarks
          if (new THREE.Vector2(posX - d.center.x, posZ - d.center.z).length() < 9) continue;
          if (d.id === 'airport_abuja') continue;

          if (d.id === 'maitama' || d.id === 'asokoro') {
            // High-end diplomatic mansions with palm trees & pools
            const villa = WorldMapPrefabs.createHouse(0xfffbeb, 0x1e3a8a, 0.9);
            villa.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(villa);
          } else if (d.id === 'cbd_abuja') {
            // Modern institutional & federal towers
            const tower = WorldMapPrefabs.createGlassTower(10 + (idx % 6) * 2, 0x0f172a, 0.75);
            tower.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(tower);
          } else if (d.id === 'wuse') {
            // Commercial plazas and shopping complexes
            const plaza = WorldMapPrefabs.createShopPlaza(0xf59e0b, 0.85);
            plaza.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(plaza);
          } else {
            // Gwarinpa / Garki residential housing blocks
            const house = WorldMapPrefabs.createHouse(0xfef08a, 0xb91c1c, 0.8);
            house.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(house);
          }
        }
      }
    }
  }

  // Abuja Traffic: Green & White Capital Cabs and Executive Cars
  private buildAbujaTraffic(): void {
    const paths = [
      new THREE.LineCurve3(new THREE.Vector3(-60, 0.25, 0), new THREE.Vector3(60, 0.25, 0)),
      new THREE.LineCurve3(new THREE.Vector3(15, 0.25, -60), new THREE.Vector3(15, 0.25, 60)),
      new THREE.LineCurve3(new THREE.Vector3(-20, 0.25, 60), new THREE.Vector3(-20, 0.25, -60)),
      new THREE.LineCurve3(new THREE.Vector3(-15, 0.25, 65), new THREE.Vector3(-15, 0.25, 130)),
    ];

    for (const path of paths) {
      for (let i = 0; i < 3; i++) {
        // Green and White Abuja livery or corporate black/silver sedans
        const carColor = i === 0 ? 0x15803d : i === 1 ? 0xffffff : 0x1e293b;
        const car = WorldMapPrefabs.createMiniVehicle('car', carColor);
        this.cityContentGroup.add(car);

        this.miniTraffic.push({
          mesh: car,
          path,
          t: (i / 3) + Math.random() * 0.2,
          speed: 0.14 + Math.random() * 0.06,
        });
      }
    }
  }

  // =========================================================================
  // PORT HARCOURT: GEOGRAPHY, CREEKS, REFINERY & GASTRONOMY
  // =========================================================================
  private buildPortHarcourtGeography(): void {
    // 1. Niger Delta Lush Green Terrain Floor
    const groundGeo = new THREE.PlaneGeometry(360, 360);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Rich Niger Delta tropical green
      roughness: 0.85,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.cityContentGroup.add(ground);

    // 2. PORT HARCOURT CREEK CANAL (Cutting across city with "Creek" badge & boats)
    const creekGeo = new THREE.PlaneGeometry(24, 280);
    const creekMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Tropical delta sparkling blue
      roughness: 0.15,
      metalness: 0.25,
      transparent: true,
      opacity: 0.9,
    });
    const creek = new THREE.Mesh(creekGeo, creekMat);
    creek.rotation.x = -Math.PI / 2;
    creek.position.set(65, 0.02, -20);
    this.cityContentGroup.add(creek);
    this.waterMeshes.push(creek);

    // Creek surface label
    this.addWaterLabel('CREEK CANAL', 65, 0.2, -20, 32, 8, '#ffffff');

    // Mangrove Palm Trees along the creek shoreline
    for (let z = -130; z <= 90; z += 18) {
      const palm1 = WorldMapPrefabs.createTree(true, 1.1);
      palm1.position.set(51, 0.1, z);
      this.cityContentGroup.add(palm1);

      const palm2 = WorldMapPrefabs.createTree(true, 1.15);
      palm2.position.set(79, 0.1, z + 9);
      this.cityContentGroup.add(palm2);
    }

    // Territorial Text Banners
    this.addWaterLabel('TRANS-AMADI INDUSTRIAL', 30, 0.3, -25, 36, 7, '#ffffff');
    this.addWaterLabel('OLD GRA GARDENS', -10, 0.3, 40, 30, 7, '#ffffff');
    this.addWaterLabel('D-LINE COMMERCIAL', -15, 0.3, -20, 32, 7, '#ffffff');
    this.addWaterLabel('CHOBA / UNIPORT', -80, 0.3, -65, 32, 7, '#ffffff');
  }

  // Port Harcourt Arterial Roads
  private buildPortHarcourtRoads(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });

    // A. Aba Road (Primary North-South artery: Z: -120 to 60, X = 0)
    const abaRoad = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.15, 180), asphaltMat);
    abaRoad.position.set(0, 0.08, -30);
    this.cityContentGroup.add(abaRoad);

    // B. Ikwerre Road (Western artery: Z: -120 to 50, X = -45)
    const ikwerreRoad = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.15, 170), asphaltMat);
    ikwerreRoad.position.set(-45, 0.08, -35);
    this.cityContentGroup.add(ikwerreRoad);

    // C. Trans-Amadi Industrial Road (East-West link to refinery: X: -10 to 60, Z = -20)
    const transAmadiRd = new THREE.Mesh(new THREE.BoxGeometry(70, 0.15, 4.4), asphaltMat);
    transAmadiRd.position.set(25, 0.08, -20);
    this.cityContentGroup.add(transAmadiRd);

    // D. East-West Road (Northern link across Choba: X: -95 to 45, Z = -85)
    const eastWestRd = new THREE.Mesh(new THREE.BoxGeometry(140, 0.15, 4.6), asphaltMat);
    eastWestRd.position.set(-25, 0.08, -85);
    this.cityContentGroup.add(eastWestRd);

    // E. Creek Bridge Crossing
    const bridge = WorldMapPrefabs.createBridge(
      new THREE.Vector3(50, 0.35, -20),
      new THREE.Vector3(80, 0.35, -20),
      4.4,
      false
    );
    this.cityContentGroup.add(bridge);
  }

  // Port Harcourt Major Landmarks
  private buildPortHarcourtLandmarks(): void {
    const landmarks = this.dataManager.getLandmarks();

    for (const lm of landmarks) {
      const lmGroup = new THREE.Group();
      lmGroup.position.copy(lm.position);

      if (lm.id === 'trans_amadi_refinery') {
        lmGroup.add(WorldMapPrefabs.createPetrochemicalRefinery(1.2));
      } else if (lm.id === 'bole_king_dline') {
        lmGroup.add(WorldMapPrefabs.createBoleSpot(1.4));
      } else if (lm.id === 'uniport_choba') {
        lmGroup.add(WorldMapPrefabs.createUniportGate(1.3));
      } else if (lm.id === 'ph_airport_omagwa') {
        lmGroup.add(WorldMapPrefabs.createAirport(0.95));
      } else if (lm.id === 'sharks_stadium') {
        lmGroup.add(WorldMapPrefabs.createStadium(1.0));
      } else if (lm.id === 'old_gra_mansion') {
        lmGroup.add(WorldMapPrefabs.createResidentialEstate(1.15));
      } else if (lm.id === 'braithwaite_memorial_hospital') {
        lmGroup.add(WorldMapPrefabs.createHospital(1.15));
      } else if (lm.id === 'trans_amadi_bank') {
        lmGroup.add(WorldMapPrefabs.createBank(1.1));
      } else if (lm.id === 'rsu_diobu') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(10, 0x1e3a8a, 0.9));
      } else if (lm.id === 'ph_zoo') {
        lmGroup.add(WorldMapPrefabs.createShopPlaza(0x15803d, 1.1));
      } else {
        lmGroup.add(WorldMapPrefabs.createGlassTower(11, 0x0284c7, 0.8));
      }

      // Circular Pin Marker Badge
      const badge = this.createLandmarkBadgeSprite(lm.icon, lm.name);
      badge.position.y = 8.5;
      lmGroup.add(badge);

      // Hitbox for raycasting click & hover
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(9.0, 12.0, 9.0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
      );
      hit.position.y = 5.0;
      lmGroup.add(hit);

      this.interactiveMapObjects.push({
        mesh: hit,
        type: 'landmark',
        data: lm,
      });

      this.cityContentGroup.add(lmGroup);
    }
  }

  // Port Harcourt Procedural Blocks
  private buildPortHarcourtProceduralBlocks(): void {
    const districts = this.dataManager.getDistricts();

    for (const d of districts) {
      const { minX, maxX, minZ, maxZ } = d.bounds;
      const stepX = (maxX - minX - 8) / 3;
      const stepZ = (maxZ - minZ - 8) / 3;

      let idx = 0;
      for (let gx = minX + 5; gx <= maxX - 5; gx += stepX) {
        for (let gz = minZ + 5; gz <= maxZ - 5; gz += stepZ) {
          idx++;
          const posX = gx + ((idx % 3) - 1) * 2;
          const posZ = gz + ((idx % 2) - 0.5) * 2;

          if (new THREE.Vector2(posX - d.center.x, posZ - d.center.z).length() < 9) continue;
          if (d.id === 'airport_ph') continue;

          if (d.id === 'trans_amadi') {
            // Industrial sheds & storage tanks
            const tanks = WorldMapPrefabs.createRefineryTanks(0.85);
            tanks.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(tanks);
          } else if (d.id === 'old_gra') {
            // Luxury garden city villas with palm trees
            const villa = WorldMapPrefabs.createHouse(0xfffbeb, 0xb91c1c, 0.85);
            villa.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(villa);
          } else {
            // D-Line and Township lively zinc-roof residential blocks
            const house = WorldMapPrefabs.createHouse(0xfef08a, 0x991b1b, 0.75);
            house.position.set(posX, 0.1, posZ);
            this.cityContentGroup.add(house);
          }
        }
      }
    }
  }

  // Port Harcourt Traffic: Blue & White PH Taxis, Tankers, Delivery Vans
  private buildPortHarcourtTraffic(): void {
    const paths = [
      new THREE.LineCurve3(new THREE.Vector3(0, 0.25, -115), new THREE.Vector3(0, 0.25, 55)),
      new THREE.LineCurve3(new THREE.Vector3(-45, 0.25, 45), new THREE.Vector3(-45, 0.25, -115)),
      new THREE.LineCurve3(new THREE.Vector3(-5, 0.25, -20), new THREE.Vector3(55, 0.25, -20)),
      new THREE.LineCurve3(new THREE.Vector3(-90, 0.25, -85), new THREE.Vector3(40, 0.25, -85)),
    ];

    for (const path of paths) {
      for (let i = 0; i < 3; i++) {
        // Port Harcourt blue & white livery
        const carColor = i === 0 ? 0x0284c7 : i === 1 ? 0xffffff : 0xeab308;
        const car = WorldMapPrefabs.createMiniVehicle('car', carColor);
        this.cityContentGroup.add(car);

        this.miniTraffic.push({
          mesh: car,
          path,
          t: (i / 3) + Math.random() * 0.2,
          speed: 0.13 + Math.random() * 0.07,
        });
      }
    }
  }

  // =========================================================================
  // LAGOS: GEOGRAPHY, WATER, BRIDGES & LANDMARKS (Default)
  // =========================================================================
  private buildLagosGeography(): void {
    // Continental Shelf / Ocean Floor
    const seaFloorGeo = new THREE.PlaneGeometry(480, 420);
    const seaFloorMat = new THREE.MeshStandardMaterial({ color: 0x075985, roughness: 0.6 });
    const seaFloor = new THREE.Mesh(seaFloorGeo, seaFloorMat);
    seaFloor.rotation.x = -Math.PI / 2;
    seaFloor.position.y = -0.8;
    this.cityContentGroup.add(seaFloor);

    // Atlantic Ocean
    const oceanGeo = new THREE.PlaneGeometry(440, 160);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.25,
      transparent: true,
      opacity: 0.92,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.05, 125);
    this.cityContentGroup.add(ocean);
    this.waterMeshes.push(ocean);

    // Lagos Lagoon
    const lagoonGeo = new THREE.PlaneGeometry(180, 110);
    const lagoonMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.12,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
    });
    const lagoon = new THREE.Mesh(lagoonGeo, lagoonMat);
    lagoon.rotation.x = -Math.PI / 2;
    lagoon.position.set(30, -0.04, -40);
    this.cityContentGroup.add(lagoon);
    this.waterMeshes.push(lagoon);

    // Five Cowries Creek
    const creekGeo = new THREE.PlaneGeometry(140, 24);
    const creekMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    const creek = new THREE.Mesh(creekGeo, creekMat);
    creek.rotation.x = -Math.PI / 2;
    creek.position.set(20, -0.03, 38);
    this.cityContentGroup.add(creek);
    this.waterMeshes.push(creek);

    // Water labels
    this.addWaterLabel('ATLANTIC OCEAN', 0, 0.08, 140, 48, 12, '#ffffff');
    this.addWaterLabel('LAGOS LAGOON', 45, 0.08, -55, 42, 10, '#ffffff');
    this.addWaterLabel('FIVE COWRIES CREEK', 25, 0.08, 38, 34, 8, '#ffffff');
    this.addWaterLabel('MAINLAND', -35, 0.6, -45, 30, 8, '#14532d');
    this.addWaterLabel('ISLAND', 0, 0.6, -2, 26, 7, '#14532d');
    this.addWaterLabel('IKOYI', 35, 0.6, 12, 24, 6, '#14532d');
    this.addWaterLabel('EKO ATLANTIC', -25, 0.6, 125, 30, 8, '#0369a1');
    this.addWaterLabel('LEKKI ESTATE', 85, 0.6, 25, 30, 8, '#14532d');
  }

  private buildLagosRoadsAndBridges(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

    const ikoroduRoad = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 120), asphaltMat);
    ikoroduRoad.position.set(-15, 0.48, -80);
    this.cityContentGroup.add(ikoroduRoad);

    const broadSt = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 50), asphaltMat);
    broadSt.position.set(0, 0.48, 0);
    this.cityContentGroup.add(broadSt);

    const lekkiExp = new THREE.Mesh(new THREE.BoxGeometry(140, 0.12, 4.2), asphaltMat);
    lekkiExp.position.set(80, 0.48, 25);
    this.cityContentGroup.add(lekkiExp);

    const ahmaduBello = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 45), asphaltMat);
    ahmaduBello.position.set(15, 0.48, 72);
    this.cityContentGroup.add(ahmaduBello);

    const airportHwy = new THREE.Mesh(new THREE.BoxGeometry(65, 0.12, 3.8), asphaltMat);
    airportHwy.position.set(-50, 0.48, -115);
    this.cityContentGroup.add(airportHwy);

    // Bridges
    const tmb = WorldMapPrefabs.createBridge(new THREE.Vector3(-10, 0.5, -60), new THREE.Vector3(5, 0.5, -15), 3.8, false);
    this.cityContentGroup.add(tmb);

    const lib = WorldMapPrefabs.createBridge(new THREE.Vector3(20, 0.5, 45), new THREE.Vector3(50, 0.5, 20), 3.5, true);
    this.cityContentGroup.add(lib);

    const eb = WorldMapPrefabs.createBridge(new THREE.Vector3(-30, 0.5, 15), new THREE.Vector3(-8, 0.5, 2), 3.6, false);
    this.cityContentGroup.add(eb);
  }

  private buildLagosLandmarks(): void {
    const landmarks = this.dataManager.getLandmarks();

    for (const lm of landmarks) {
      const lmGroup = new THREE.Group();
      lmGroup.position.copy(lm.position);

      if (lm.type === 'airport') {
        lmGroup.add(WorldMapPrefabs.createAirport(0.95));
      } else if (lm.type === 'port') {
        lmGroup.add(WorldMapPrefabs.createPort(0.9));
        const refTanks = WorldMapPrefabs.createRefineryTanks(0.85);
        refTanks.position.set(-9, 0, -6);
        lmGroup.add(refTanks);
      } else if (lm.type === 'stadium') {
        lmGroup.add(WorldMapPrefabs.createStadium(0.95));
      } else if (lm.id === 'st_nicholas_hospital') {
        lmGroup.add(WorldMapPrefabs.createHospital(1.1));
      } else if (lm.id === 'broad_street_banks') {
        lmGroup.add(WorldMapPrefabs.createBank(1.05));
      } else if (lm.id === 'lagos_area_command_police') {
        lmGroup.add(WorldMapPrefabs.createPoliceStation(1.1));
      } else if (lm.id === 'mama_put_buka') {
        lmGroup.add(WorldMapPrefabs.createShopPlaza(0xef4444, 1.25));
      } else if (lm.id === 'eko_atlantic_tower') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(24, 0x0284c7, 0.95));
      } else if (lm.id === 'quilox_vi') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(12, 0xa855f7, 0.85));
      } else if (lm.id === 'computer_village') {
        lmGroup.add(WorldMapPrefabs.createShopPlaza(0xfacc15, 1.15));
      } else if (lm.id === 'cchub_yaba') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(11, 0x8b5cf6, 0.85));
      } else if (lm.id === 'nike_art_gallery') {
        lmGroup.add(WorldMapPrefabs.createHouse(0xfffbeb, 0xb45309, 1.25));
      } else {
        lmGroup.add(WorldMapPrefabs.createGlassTower(14, 0x059669, 0.8));
      }

      // Marker badge
      const badge = this.createLandmarkBadgeSprite(lm.icon, lm.name);
      badge.position.y = 8.5;
      lmGroup.add(badge);

      // Hitbox
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(8.0, 11.0, 8.0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
      );
      hit.position.y = 4.5;
      lmGroup.add(hit);

      this.interactiveMapObjects.push({
        mesh: hit,
        type: 'landmark',
        data: lm,
      });

      this.cityContentGroup.add(lmGroup);
    }
  }

  private buildLagosProceduralBlocks(): void {
    const districts = this.dataManager.getDistricts();
    for (const d of districts) {
      this.populateDistrictVisuals(d);
    }
  }

  private buildLagosTraffic(): void {
    const highwayPaths = [
      new THREE.LineCurve3(new THREE.Vector3(-10, 0.7, -60), new THREE.Vector3(5, 0.7, -15)),
      new THREE.LineCurve3(new THREE.Vector3(20, 0.7, 45), new THREE.Vector3(50, 0.7, 20)),
      new THREE.LineCurve3(new THREE.Vector3(-15, 0.6, -135), new THREE.Vector3(-15, 0.6, -25)),
      new THREE.LineCurve3(new THREE.Vector3(35, 0.6, 25), new THREE.Vector3(145, 0.6, 25)),
    ];

    for (let p = 0; p < highwayPaths.length; p++) {
      const path = highwayPaths[p];
      for (let i = 0; i < 3; i++) {
        const type = i === 0 ? 'danfo' : i === 1 ? 'keke' : 'car';
        const color = i === 2 ? 0x2563eb : 0xfacc15;
        const car = WorldMapPrefabs.createMiniVehicle(type, color);
        this.cityContentGroup.add(car);

        this.miniTraffic.push({
          mesh: car,
          path,
          t: (i / 3) + Math.random() * 0.2,
          speed: 0.12 + Math.random() * 0.08,
        });
      }
    }
  }

  // =========================================================================
  // SHARED: DISTRICT TERRITORIES & COLORFUL PADS
  // =========================================================================
  private buildDistrictTerritories(): void {
    const districts = this.dataManager.getDistricts();

    for (const d of districts) {
      const w = d.bounds.maxX - d.bounds.minX;
      const h = d.bounds.maxZ - d.bounds.minZ;
      const cx = (d.bounds.minX + d.bounds.maxX) / 2;
      const cz = (d.bounds.minZ + d.bounds.maxZ) / 2;

      let padColor = 0x22c55e;
      if (d.id.includes('airport')) padColor = 0x1e293b;
      else if (d.id.includes('port') || d.id.includes('trans_amadi')) padColor = 0x64748b;
      else if (d.zone === 'Mainland' || d.zone === 'High-Density') padColor = 0xd97706;
      else if (d.zone === 'Island' || d.zone === 'Special') padColor = 0x10b981;
      else if (d.zone === 'Diplomatic') padColor = 0x059669;
      else if (d.zone === 'Peninsula' || d.zone === 'Garden') padColor = 0x15803d;

      // Base District Land Pad
      const padGeo = new THREE.BoxGeometry(w, 0.45, h);
      const padMat = new THREE.MeshStandardMaterial({
        color: padColor,
        roughness: 0.75,
        metalness: 0.05,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(cx, 0.22, cz);
      pad.receiveShadow = true;
      this.cityContentGroup.add(pad);

      // District Border Outline
      const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.48, h));
      const borderMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
      });
      const borderLine = new THREE.LineSegments(borderGeo, borderMat);
      borderLine.position.set(cx, 0.24, cz);
      this.cityContentGroup.add(borderLine);

      // Highlight Mesh
      const hlGeo = new THREE.PlaneGeometry(w, h);
      const hlMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0,
      });
      const hlMesh = new THREE.Mesh(hlGeo, hlMat);
      hlMesh.rotation.x = -Math.PI / 2;
      hlMesh.position.set(cx, 0.46, cz);
      this.cityContentGroup.add(hlMesh);

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.3, h),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
      );
      hitBox.position.set(cx, 0.15, cz);
      this.cityContentGroup.add(hitBox);

      this.interactiveMapObjects.push({
        mesh: hitBox,
        type: 'district',
        data: d,
      });

      this.districtHighlightMeshes.set(d.id, hlMesh);

      // 3D District Floating Label Banner
      const labelSprite = this.createDistrictLabelSprite(d.name, d.subtitle, d.color);
      labelSprite.position.set(cx, 10.5, cz);
      this.cityContentGroup.add(labelSprite);
    }
  }

  // Populate procedural low-poly assets based on district character
  private populateDistrictVisuals(d: DistrictData): void {
    const { minX, maxX, minZ, maxZ } = d.bounds;
    const seed = (Math.abs(minX) * 73 + Math.abs(minZ) * 31) % 1000;
    const rng = (i: number) => Math.sin(seed + i * 14.3) * 0.5 + 0.5;

    const stepX = (maxX - minX - 10) / 4;
    const stepZ = (maxZ - minZ - 10) / 4;

    let itemIdx = 0;
    for (let gx = minX + 5; gx <= maxX - 5; gx += stepX) {
      for (let gz = minZ + 5; gz <= maxZ - 5; gz += stepZ) {
        itemIdx++;
        const r = rng(itemIdx);
        const posX = gx + (r - 0.5) * 4;
        const posZ = gz + (rng(itemIdx + 50) - 0.5) * 4;

        if (new THREE.Vector2(posX - d.center.x, posZ - d.center.z).length() < 7) continue;

        if (d.id === 'airport' || d.id === 'port_apapa') {
          if (r > 0.5) {
            const wh = WorldMapPrefabs.createShopPlaza(0x475569, 0.9);
            wh.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(wh);
          }
          continue;
        }

        if (d.zone === 'Island') {
          if (r > 0.4) {
            const h = 8 + Math.floor(rng(itemIdx + 20) * 14);
            const color = r > 0.7 ? 0x0284c7 : r > 0.5 ? 0x0f172a : 0x059669;
            const tower = WorldMapPrefabs.createGlassTower(h, color, 0.7);
            tower.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(tower);
          } else {
            const apt = WorldMapPrefabs.createApartmentBlock(4, 0xf8fafc, 0.75);
            apt.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(apt);
          }
        } else if (d.zone === 'Peninsula') {
          if (r > 0.6) {
            const house = WorldMapPrefabs.createHouse(0xfffbeb, 0xb91c1c, 0.85);
            house.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(house);
          } else if (r > 0.3) {
            const shop = WorldMapPrefabs.createShopPlaza(0x15803d, 0.8);
            shop.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(shop);
          } else {
            const palm = WorldMapPrefabs.createTree(true, 1.1);
            palm.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(palm);
          }
        } else {
          if (r > 0.65) {
            const apt = WorldMapPrefabs.createApartmentBlock(3, 0xd97706, 0.75);
            apt.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(apt);
          } else if (r > 0.35) {
            const house = WorldMapPrefabs.createHouse(0xfef08a, 0x15803d, 0.8);
            house.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(house);
          } else if (r > 0.2) {
            const shop = WorldMapPrefabs.createShopPlaza(0xdc2626, 0.75);
            shop.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(shop);
          } else {
            const tree = WorldMapPrefabs.createTree(false, 0.9);
            tree.position.set(posX, 0.45, posZ);
            this.cityContentGroup.add(tree);
          }
        }
      }
    }
  }

  // =========================================================================
  // PROPERTY SYSTEM - VISUAL REAL ESTATE MARKERS ON WORLD MAP
  // =========================================================================
  public refreshPropertyMarkers(): void {
    this.propertyGroup.clear();
    this.interactiveMapObjects = this.interactiveMapObjects.filter((o) => o.type !== 'property');

    const properties = this.dataManager.getProperties();

    for (const prop of properties) {
      const propGroup = new THREE.Group();
      propGroup.position.copy(prop.position);

      const plinthGeo = new THREE.CylinderGeometry(2.4, 2.7, 0.25, 16);
      const isOwned = prop.status === 'owned';
      const isRented = prop.status === 'rented';
      const plinthColor = isOwned ? 0x22c55e : isRented ? 0x0284c7 : 0xf59e0b;
      const plinthMat = new THREE.MeshStandardMaterial({
        color: plinthColor,
        roughness: 0.5,
        metalness: 0.2,
      });
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.y = 0.15;
      plinth.receiveShadow = true;
      propGroup.add(plinth);

      // 3D Property Model based on type
      let model: THREE.Object3D;
      switch (prop.type) {
        case 'land':
          model = new THREE.Group();
          const tree = WorldMapPrefabs.createTree(true, 0.9);
          tree.position.set(0.6, 0.2, 0);
          model.add(tree);
          break;
        case 'office':
          model = WorldMapPrefabs.createGlassTower(12, 0x0284c7, 0.6);
          break;
        case 'shop':
          model = WorldMapPrefabs.createShopPlaza(0x10b981, 0.7);
          break;
        case 'warehouse':
          model = WorldMapPrefabs.createShopPlaza(0x64748b, 0.8);
          break;
        case 'duplex':
        case 'house':
          model = WorldMapPrefabs.createHouse(0xfffbeb, isOwned ? 0x16a34a : 0xb91c1c, 0.75);
          break;
        case 'luxury apartment':
          model = WorldMapPrefabs.createGlassTower(14, 0x38bdf8, 0.65);
          break;
        default:
          model = WorldMapPrefabs.createApartmentBlock(2, 0xfde68a, 0.6);
          break;
      }
      propGroup.add(model);

      // Floating Badge Sprite
      const badge = this.createPropertyBadgeSprite(prop);
      badge.position.y = 6.2;
      propGroup.add(badge);

      // Raycasting Hitbox
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(5.0, 7.5, 5.0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
      );
      hitBox.position.y = 3.2;
      propGroup.add(hitBox);

      this.interactiveMapObjects.push({
        mesh: hitBox,
        type: 'property',
        data: prop,
      });

      this.propertyGroup.add(propGroup);
    }
  }

  // =========================================================================
  // LIVE PLAYER PIN
  // =========================================================================
  private buildPlayerPin(): void {
    if (this.playerPin) {
      this.cityContentGroup.remove(this.playerPin);
    }

    this.playerPin = new THREE.Group();

    const ringGeo = new THREE.RingGeometry(1.2, 1.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.55;
    this.playerPin.add(ring);

    const pinMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 12), pinMat);
    cone.rotation.x = Math.PI;
    cone.position.y = 3.2;
    this.playerPin.add(cone);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), pinMat);
    sphere.position.y = 4.3;
    this.playerPin.add(sphere);

    const labelSprite = this.createPlayerPinLabel();
    labelSprite.position.y = 6.2;
    this.playerPin.add(labelSprite);

    this.cityContentGroup.add(this.playerPin);
  }

  // =========================================================================
  // CANVAS SPRITE GENERATORS
  // =========================================================================
  private addWaterLabel(text: string, x: number, y: number, z: number, w: number, h: number, color = '#ffffff'): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = color;
    ctx.font = 'bold 44px "Arial Black", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '4px';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.cityContentGroup.add(mesh);
  }

  private createDistrictLabelSprite(name: string, subtitle: string, colorHex: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    const hexStr = `#${colorHex.toString(16).padStart(6, '0')}`;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    this.drawRoundedRect(ctx, 16, 16, 480, 128, 24);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.strokeStyle = hexStr;
    ctx.stroke();

    this.drawRoundedRect(ctx, 24, 24, 12, 112, 6);
    ctx.fillStyle = hexStr;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(name.toUpperCase(), 54, 72);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(subtitle, 54, 110);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16, 5.0, 1);
    return sprite;
  }

  private createLandmarkBadgeSprite(icon: string, name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 140;
    const ctx = canvas.getContext('2d')!;

    // 1. Draw circular white badge pin
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;

    ctx.beginPath();
    ctx.arc(128, 52, 44, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0284c7';
    ctx.stroke();

    ctx.font = '46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon || '📍', 128, 54);

    // 2. Name pill below circle
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    this.drawRoundedRect(ctx, 16, 102, 224, 32, 10);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(name.length > 20 ? name.slice(0, 18) + '...' : name, 128, 123);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(8.5, 4.6, 1);
    return sprite;
  }

  private createPropertyBadgeSprite(prop: MapProperty): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    const isOwned = prop.status === 'owned';
    const isRented = prop.status === 'rented';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.arc(80, 80, 66, 0, Math.PI * 2);
    ctx.fillStyle = isOwned ? '#f0fdf4' : isRented ? '#f0f9ff' : '#ffffff';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 6;
    ctx.strokeStyle = isOwned ? '#22c55e' : isRented ? '#0284c7' : '#f59e0b';
    ctx.stroke();

    ctx.font = '58px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prop.icon || '🏠', 80, 84);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(5.5, 5.5, 1);
    return sprite;
  }

  private createPlayerPinLabel(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    this.drawRoundedRect(ctx, 4, 4, 248, 64, 18);
    ctx.fillStyle = 'rgba(22, 101, 52, 0.95)';
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4ade80';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📍 YOU ARE HERE', 128, 44);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(9, 2.5, 1);
    return sprite;
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // =========================================================================
  // INTERACTION & HIGHLIGHT API
  // =========================================================================
  public highlightDistrict(districtId: string | null): void {
    this.districtHighlightMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (id === districtId) {
        mat.opacity = 0.28;
      } else {
        mat.opacity = 0.0;
      }
    });
  }

  // =========================================================================
  // UPDATE LOOP
  // =========================================================================
  public update(delta: number): void {
    this.animTime += delta;

    // Water ripple animation
    for (const w of this.waterMeshes) {
      w.position.y += Math.sin(this.animTime * 2.0) * 0.002;
    }

    // Live update player location pin
    if (this.playerPin) {
      const playerPos = this.dataManager.getPlayerPosition();
      this.playerPin.position.set(playerPos.x, 0, playerPos.z);
      this.playerPin.position.y = Math.sin(this.animTime * 3.5) * 0.25;
    }

    // Mini vehicles flowing along highways
    for (const v of this.miniTraffic) {
      v.t += v.speed * delta;
      if (v.t > 1.0) v.t = 0;
      const pt = v.path.getPoint(v.t);
      v.mesh.position.copy(pt);
      const tangent = v.path.getTangent(v.t);
      v.mesh.lookAt(pt.clone().add(tangent));
    }
  }
}
