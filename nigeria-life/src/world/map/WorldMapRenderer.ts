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
  private dataManager: WorldDataManager;

  // Animated elements
  private oceanMesh!: THREE.Mesh;
  private lagoonMesh!: THREE.Mesh;
  private creekMesh!: THREE.Mesh;
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
    this.dataManager = WorldDataManager.getInstance();

    this.buildGeographyAndWater();
    this.buildDistrictTerritories();
    this.buildRoadNetworkAndBridges();
    this.buildLandmarksAndBuildings();
    this.buildPropertyMarkers();
    this.buildMiniatureTraffic();
    this.buildPlayerPin();
  }

  // =========================================================================
  // 1. GEOGRAPHY, TERRAIN & WATER BODIES
  // =========================================================================
  private buildGeographyAndWater(): void {
    // Base Continental Shelf / Ocean Floor
    const seaFloorGeo = new THREE.PlaneGeometry(420, 380);
    const seaFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0f2d4a,
      roughness: 0.8,
    });
    const seaFloor = new THREE.Mesh(seaFloorGeo, seaFloorMat);
    seaFloor.rotation.x = -Math.PI / 2;
    seaFloor.position.y = -0.8;
    this.group.add(seaFloor);

    // Atlantic Ocean (South: Z > 60)
    const oceanGeo = new THREE.PlaneGeometry(400, 140, 24, 16);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.88,
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.rotation.x = -Math.PI / 2;
    this.oceanMesh.position.set(0, -0.05, 130);
    this.group.add(this.oceanMesh);

    // Lagos Lagoon (Central / East: X: 10 to 90, Z: -80 to 10)
    const lagoonGeo = new THREE.PlaneGeometry(160, 100);
    const lagoonMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
    });
    this.lagoonMesh = new THREE.Mesh(lagoonGeo, lagoonMat);
    this.lagoonMesh.rotation.x = -Math.PI / 2;
    this.lagoonMesh.position.set(30, -0.04, -40);
    this.group.add(this.lagoonMesh);

    // Five Cowries Creek (Separating Lagos Island / Ikoyi from Victoria Island)
    const creekGeo = new THREE.PlaneGeometry(130, 22);
    const creekMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.82,
    });
    this.creekMesh = new THREE.Mesh(creekGeo, creekMat);
    this.creekMesh.rotation.x = -Math.PI / 2;
    this.creekMesh.position.set(20, -0.03, 38);
    this.group.add(this.creekMesh);
  }

  // =========================================================================
  // 2. DISTRICT TERRITORIES & COASTLINE TERRAIN PADS
  // =========================================================================
  private buildDistrictTerritories(): void {
    const districts = this.dataManager.getDistricts();

    // Stylized low-poly district terrain plates
    for (const d of districts) {
      const w = d.bounds.maxX - d.bounds.minX;
      const h = d.bounds.maxZ - d.bounds.minZ;
      const cx = (d.bounds.minX + d.bounds.maxX) / 2;
      const cz = (d.bounds.minZ + d.bounds.maxZ) / 2;

      // Base terrain plate with beveled rounded aesthetic
      const padGeo = new THREE.BoxGeometry(w * 0.94, 0.45, h * 0.94);
      const padMat = new THREE.MeshStandardMaterial({
        color: d.zone === 'Mainland' ? 0xe2d6c1 : d.zone === 'Island' ? 0xdfe9d6 : 0xd8e6c8,
        roughness: 0.85,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(cx, 0.2, cz);
      pad.receiveShadow = true;
      this.group.add(pad);

      // District outline boundary ring
      const borderGeo = new THREE.BoxGeometry(w * 0.95, 0.1, h * 0.95);
      const borderMat = new THREE.MeshBasicMaterial({
        color: d.color,
        wireframe: true,
      });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.position.set(cx, 0.48, cz);
      this.group.add(border);

      // Interactive Clickable / Hoverable zone trigger
      const hitBoxGeo = new THREE.BoxGeometry(w, 2.5, h);
      const hitBoxMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.0,
      });
      const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      hitBox.position.set(cx, 1.25, cz);
      this.group.add(hitBox);

      this.interactiveMapObjects.push({
        mesh: hitBox,
        type: 'district',
        data: d,
      });

      // Highlight overlay mesh
      const hlGeo = new THREE.PlaneGeometry(w * 0.93, h * 0.93);
      const hlMat = new THREE.MeshBasicMaterial({
        color: d.color,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      });
      const hlMesh = new THREE.Mesh(hlGeo, hlMat);
      hlMesh.rotation.x = -Math.PI / 2;
      hlMesh.position.set(cx, 0.44, cz);
      this.group.add(hlMesh);
      this.districtHighlightMeshes.set(d.id, hlMesh);

      // 3D District Floating Label Banner
      const labelSprite = this.createDistrictLabelSprite(d.name, d.subtitle, d.color);
      labelSprite.position.set(cx, 8.5, cz);
      this.group.add(labelSprite);
    }
  }

  // =========================================================================
  // 3. ROAD NETWORK & BRIDGES (Third Mainland, Lekki-Ikoyi, Arterials)
  // =========================================================================
  private buildRoadNetworkAndBridges(): void {
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
    });

    // A. Ikorodu Road / Mainland Expressway (North to South: Z: -140 to -20, X = -15)
    const ikoroduRoad = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.12, 120), asphaltMat);
    ikoroduRoad.position.set(-15, 0.48, -80);
    this.group.add(ikoroduRoad);

    // B. Broad Street & Marina Arterial (Lagos Island: X = 0, Z = 0)
    const broadSt = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 50), asphaltMat);
    broadSt.position.set(0, 0.48, 0);
    this.group.add(broadSt);

    // C. Lekki-Epe Expressway (Eastbound corridor: X: 15 to 150, Z: 25)
    const lekkiExp = new THREE.Mesh(new THREE.BoxGeometry(140, 0.12, 4.2), asphaltMat);
    lekkiExp.position.set(80, 0.48, 25);
    this.group.add(lekkiExp);

    // D. Ahmadu Bello Way (Victoria Island: Z: 50 to 95, X = 15)
    const ahmaduBello = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 45), asphaltMat);
    ahmaduBello.position.set(15, 0.48, 72);
    this.group.add(ahmaduBello);

    // E. Airport Access Highway (West: X: -20 to -80, Z = -115)
    const airportHwy = new THREE.Mesh(new THREE.BoxGeometry(65, 0.12, 3.8), asphaltMat);
    airportHwy.position.set(-50, 0.48, -115);
    this.group.add(airportHwy);

    // F. BRIDGES SPANNING WATER
    // 1. Third Mainland Bridge (Connecting Mainland to Lagos Island over Lagoon)
    const tmb = WorldMapPrefabs.createBridge(
      new THREE.Vector3(-10, 0.5, -60),
      new THREE.Vector3(5, 0.5, -15),
      3.8,
      false
    );
    this.group.add(tmb);

    // 2. Lekki-Ikoyi Cable Link Bridge
    const lib = WorldMapPrefabs.createBridge(
      new THREE.Vector3(20, 0.5, 45),
      new THREE.Vector3(50, 0.5, 20),
      3.5,
      true
    );
    this.group.add(lib);

    // 3. Eko Bridge (Connecting Surulere/Mainland to Marina)
    const eb = WorldMapPrefabs.createBridge(
      new THREE.Vector3(-30, 0.5, 15),
      new THREE.Vector3(-8, 0.5, 2),
      3.6,
      false
    );
    this.group.add(eb);
  }

  // =========================================================================
  // 4. LANDMARKS & PROCEDURAL DISTRICT BUILDINGS
  // =========================================================================
  private buildLandmarksAndBuildings(): void {
    const districts = this.dataManager.getDistricts();
    const landmarks = this.dataManager.getLandmarks();

    // A. Place Key Major Landmarks
    for (const lm of landmarks) {
      const lmGroup = new THREE.Group();
      lmGroup.position.copy(lm.position);

      if (lm.type === 'airport') {
        lmGroup.add(WorldMapPrefabs.createAirport(0.85));
      } else if (lm.type === 'port') {
        lmGroup.add(WorldMapPrefabs.createPort(0.85));
      } else if (lm.type === 'stadium') {
        lmGroup.add(WorldMapPrefabs.createStadium(0.9));
      } else if (lm.id === 'eko_atlantic_tower') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(24, 0x0284c7, 0.95));
      } else if (lm.id === 'quilox_vi') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(12, 0xa855f7, 0.85));
      } else if (lm.id === 'computer_village') {
        lmGroup.add(WorldMapPrefabs.createShopPlaza(0xfacc15, 1.1));
      } else if (lm.id === 'cchub_yaba') {
        lmGroup.add(WorldMapPrefabs.createGlassTower(10, 0x8b5cf6, 0.8));
      } else if (lm.id === 'nike_art_gallery') {
        lmGroup.add(WorldMapPrefabs.createHouse(0xfffbeb, 0xb45309, 1.2));
      } else {
        lmGroup.add(WorldMapPrefabs.createGlassTower(14, 0x059669, 0.8));
      }

      // Marker Icon Badge above landmark
      const badge = this.createLandmarkBadgeSprite(lm.icon, lm.name);
      badge.position.y = 8.0;
      lmGroup.add(badge);

      // Hitbox for raycasting
      const hit = new THREE.Mesh(
        new THREE.BoxGeometry(6.0, 7.0, 6.0),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
      );
      hit.position.y = 3.5;
      lmGroup.add(hit);

      this.interactiveMapObjects.push({
        mesh: hit,
        type: 'landmark',
        data: lm,
      });

      this.group.add(lmGroup);
    }

    // B. Place Dense Stylized Low-Poly City Blocks in each District
    for (const d of districts) {
      this.populateDistrictVisuals(d);
    }
  }

  // Populate procedural low-poly assets based on district character
  private populateDistrictVisuals(d: DistrictData): void {
    const { minX, maxX, minZ, maxZ } = d.bounds;

    // Fixed seeded pseudo-random distribution
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

        // Skip if close to district center (keep landmark clearing)
        if (new THREE.Vector2(posX - d.center.x, posZ - d.center.z).length() < 7) continue;

        if (d.id === 'airport' || d.id === 'port_apapa') {
          // Warehouses & fuel tanks
          if (r > 0.5) {
            const wh = WorldMapPrefabs.createShopPlaza(0x475569, 0.9);
            wh.position.set(posX, 0.45, posZ);
            this.group.add(wh);
          }
          continue;
        }

        if (d.zone === 'Island') {
          // Modern towers & luxury offices
          if (r > 0.4) {
            const h = 8 + Math.floor(rng(itemIdx + 20) * 14);
            const color = r > 0.7 ? 0x0284c7 : r > 0.5 ? 0x0f172a : 0x059669;
            const tower = WorldMapPrefabs.createGlassTower(h, color, 0.7);
            tower.position.set(posX, 0.45, posZ);
            this.group.add(tower);
          } else {
            const apt = WorldMapPrefabs.createApartmentBlock(4, 0xf8fafc, 0.75);
            apt.position.set(posX, 0.45, posZ);
            this.group.add(apt);
          }
        } else if (d.zone === 'Peninsula') {
          // Gated luxury duplexes, palm trees, shopping plazas
          if (r > 0.6) {
            const house = WorldMapPrefabs.createHouse(0xfffbeb, 0xb91c1c, 0.85);
            house.position.set(posX, 0.45, posZ);
            this.group.add(house);
          } else if (r > 0.3) {
            const shop = WorldMapPrefabs.createShopPlaza(0x15803d, 0.8);
            shop.position.set(posX, 0.45, posZ);
            this.group.add(shop);
          } else {
            const palm = WorldMapPrefabs.createTree(true, 1.1);
            palm.position.set(posX, 0.45, posZ);
            this.group.add(palm);
          }
        } else {
          // Mainland dense residential blocks, market plazas, filling stations
          if (r > 0.65) {
            const apt = WorldMapPrefabs.createApartmentBlock(3, 0xd97706, 0.75);
            apt.position.set(posX, 0.45, posZ);
            this.group.add(apt);
          } else if (r > 0.35) {
            const house = WorldMapPrefabs.createHouse(0xfef08a, 0x15803d, 0.8);
            house.position.set(posX, 0.45, posZ);
            this.group.add(house);
          } else if (r > 0.2) {
            const shop = WorldMapPrefabs.createShopPlaza(0xdc2626, 0.75);
            shop.position.set(posX, 0.45, posZ);
            this.group.add(shop);
          } else {
            const tree = WorldMapPrefabs.createTree(false, 0.9);
            tree.position.set(posX, 0.45, posZ);
            this.group.add(tree);
          }
        }
      }
    }

    // Add billboards along roads
    if (d.bounds.maxX - d.bounds.minX > 30) {
      const bb = WorldMapPrefabs.createBillboard('AIR PEACE', 0x1e3a8a, 0.9);
      bb.position.set(d.center.x + 8, 0.45, d.center.z);
      this.group.add(bb);
    }
  }

  // =========================================================================
  // 4B. PROPERTY SYSTEM - VISUAL REAL ESTATE MARKERS ON WORLD MAP
  // =========================================================================
  private propertyGroup: THREE.Group = new THREE.Group();

  private buildPropertyMarkers(): void {
    this.group.add(this.propertyGroup);
    this.refreshPropertyMarkers();
  }

  public refreshPropertyMarkers(): void {
    // Clear previous property objects
    while (this.propertyGroup.children.length > 0) {
      const obj = this.propertyGroup.children[0];
      this.propertyGroup.remove(obj);
    }

    // Remove old property entries from interactiveMapObjects
    this.interactiveMapObjects = this.interactiveMapObjects.filter(
      (o) => o.type !== 'property'
    );

    const properties = this.dataManager.getProperties();

    for (const prop of properties) {
      const propGroup = new THREE.Group();
      propGroup.position.copy(prop.position);

      // Base Plinth / Plot indicator
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

      // Ground indicator ring
      const ringGeo = new THREE.RingGeometry(2.6, 3.0, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: plinthColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.28;
      propGroup.add(ring);

      // 3D Property Model based on type
      let model: THREE.Object3D;
      switch (prop.type) {
        case 'land':
          model = new THREE.Group();
          const tree = WorldMapPrefabs.createTree(true, 0.9);
          tree.position.set(0.6, 0.2, 0);
          model.add(tree);
          // Boundary peg posts
          const pegGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
          const pegMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
            const peg = new THREE.Mesh(pegGeo, pegMat);
            peg.position.set(Math.cos(angle) * 1.5, 0.4, Math.sin(angle) * 1.5);
            model.add(peg);
          }
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
        case 'room':
        case 'self-contained':
        case 'apartment':
        default:
          model = WorldMapPrefabs.createApartmentBlock(2, 0xfde68a, 0.6);
          break;
      }
      propGroup.add(model);

      // Floating Badge Sprite above property
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

  private createPropertyBadgeSprite(prop: MapProperty): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 84;
    const ctx = canvas.getContext('2d')!;

    const isOwned = prop.status === 'owned';
    const isRented = prop.status === 'rented';

    // Dark Card Base
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = isOwned ? '#22c55e' : isRented ? '#38bdf8' : '#f59e0b';
    ctx.lineWidth = 3;
    this.drawRoundedRect(ctx, 4, 4, 272, 76, 16);
    ctx.fill();
    ctx.stroke();

    // Icon
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(prop.icon || '🏠', 16, 52);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    const cleanName = prop.name.length > 17 ? prop.name.substring(0, 16) + '…' : prop.name;
    ctx.fillText(cleanName, 58, 38);

    // Subtitle
    ctx.font = 'bold 14px sans-serif';
    if (isOwned) {
      ctx.fillStyle = '#4ade80';
      ctx.fillText('🔑 OWNED BY YOU', 58, 62);
    } else if (isRented) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('LEASED RESIDENCE', 58, 62);
    } else {
      ctx.fillStyle = '#fbbf24';
      const formattedPrice = prop.price >= 1_000_000
        ? `₦${(prop.price / 1_000_000).toFixed(prop.price % 1_000_000 === 0 ? 0 : 1)}M`
        : `₦${(prop.price / 1000).toFixed(0)}K`;
      ctx.fillText(`${formattedPrice} • ${prop.type.toUpperCase()}`, 58, 62);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(10.5, 3.15, 1);
    return sprite;
  }

  // =========================================================================
  // 5. MINIATURE TRAFFIC ON MAP HIGHWAYS
  // =========================================================================
  private buildMiniatureTraffic(): void {
    const highwayPaths = [
      // Third Mainland Bridge line
      new THREE.LineCurve3(new THREE.Vector3(-10, 0.7, -60), new THREE.Vector3(5, 0.7, -15)),
      // Lekki-Ikoyi Bridge line
      new THREE.LineCurve3(new THREE.Vector3(20, 0.7, 45), new THREE.Vector3(50, 0.7, 20)),
      // Ikorodu Road Mainland line
      new THREE.LineCurve3(new THREE.Vector3(-15, 0.6, -135), new THREE.Vector3(-15, 0.6, -25)),
      // Lekki Expressway line
      new THREE.LineCurve3(new THREE.Vector3(35, 0.6, 25), new THREE.Vector3(145, 0.6, 25)),
    ];

    for (let p = 0; p < highwayPaths.length; p++) {
      const path = highwayPaths[p];
      for (let i = 0; i < 3; i++) {
        const type = i === 0 ? 'danfo' : i === 1 ? 'keke' : 'car';
        const color = i === 2 ? 0x2563eb : 0xfacc15;
        const car = WorldMapPrefabs.createMiniVehicle(type, color);
        this.group.add(car);

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
  // 6. LIVE PLAYER LOCATION PIN
  // =========================================================================
  private buildPlayerPin(): void {
    this.playerPin = new THREE.Group();

    // Pulsing Glowing Gold / Green Ring
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

    // Upright Floating Pointer Pin
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

    // "YOU ARE HERE" Text Sprite
    const labelSprite = this.createPlayerPinLabel();
    labelSprite.position.y = 6.2;
    this.playerPin.add(labelSprite);

    this.group.add(this.playerPin);
  }

  // =========================================================================
  // 7. CANVAS SPRITE GENERATORS
  // =========================================================================
  private createDistrictLabelSprite(name: string, subtitle: string, colorHex: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Background rounded pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 4;
    this.drawRoundedRect(ctx, 12, 12, 360, 104, 24);
    ctx.fill();
    ctx.stroke();

    // District Name
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase(), 192, 58);

    // Subtitle
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Segoe UI", sans-serif';
    ctx.fillText(subtitle, 192, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16, 5.3, 1);
    return sprite;
  }

  private createLandmarkBadgeSprite(icon: string, name: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    this.drawRoundedRect(ctx, 8, 8, 304, 80, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = '32px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(icon, 24, 56);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    const cleanName = name.length > 18 ? name.substring(0, 17) + '…' : name;
    ctx.fillText(cleanName, 72, 54);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(12, 3.6, 1);
    return sprite;
  }

  private createPlayerPinLabel(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#22c55e';
    this.drawRoundedRect(ctx, 4, 4, 248, 64, 16);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
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
  // 8. INTERACTION & HIGHLIGHT API
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
  // 9. UPDATE LOOP
  // =========================================================================
  public update(delta: number): void {
    this.animTime += delta;

    // Ocean water ripple animation
    if (this.oceanMesh) {
      this.oceanMesh.position.y = -0.05 + Math.sin(this.animTime * 1.5) * 0.06;
    }

    // Live update player location pin from shared WorldDataManager
    const playerPos = this.dataManager.getPlayerPosition();
    this.playerPin.position.set(playerPos.x, 0, playerPos.z);
    this.playerPin.position.y = Math.sin(this.animTime * 3.5) * 0.25;

    // Mini vehicles flowing along Lagos highways
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
