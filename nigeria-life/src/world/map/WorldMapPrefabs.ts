import * as THREE from 'three';

export class WorldMapPrefabs {
  // Shared materials for optimal batching & performance
  private static mats: Record<string, THREE.Material> = {};

  private static getMaterial(key: string, colorHex: number, roughness = 0.5, metalness = 0.1): THREE.MeshStandardMaterial {
    if (!this.mats[key]) {
      this.mats[key] = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness,
        metalness,
        flatShading: true,
      });
    }
    return this.mats[key] as THREE.MeshStandardMaterial;
  }

  // =========================================================================
  // 1. RESIDENTIAL BUNGALOW / DUPLEX
  // =========================================================================
  public static createHouse(color = 0xfef08a, roofColor = 0xb91c1c, scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Compound Wall
    const compoundMat = this.getMaterial('compound_wall', 0xe2e8f0, 0.8);
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6 * scale, 0.5 * scale, 3.6 * scale), compoundMat);
    wallMesh.position.y = 0.25 * scale;
    group.add(wallMesh);

    // Main house box
    const houseMat = this.getMaterial(`house_${color.toString(16)}`, color, 0.7);
    const house = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 1.4 * scale, 2.4 * scale), houseMat);
    house.position.y = 0.7 * scale;
    house.castShadow = true;
    group.add(house);

    // Hip roof (pyramid / cone)
    const roofMat = this.getMaterial(`roof_${roofColor.toString(16)}`, roofColor, 0.6);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0 * scale, 0.9 * scale, 4), roofMat);
    roof.position.y = 1.85 * scale;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Tiny black GeePee water tank on roof or scaffold
    const tankMat = this.getMaterial('gep_tank_map', 0x18181b, 0.4);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.25 * scale, 0.4 * scale, 8), tankMat);
    tank.position.set(1.1 * scale, 1.4 * scale, 1.1 * scale);
    group.add(tank);

    return group;
  }

  // =========================================================================
  // 2. APARTMENT TOWER / ESTATE BLOCK
  // =========================================================================
  public static createApartmentBlock(floors = 4, color = 0xd97706, scale = 1.0): THREE.Group {
    const group = new THREE.Group();
    const height = (1.2 + floors * 0.9) * scale;
    const width = 3.2 * scale;
    const depth = 2.8 * scale;

    const bodyMat = this.getMaterial(`apt_${color.toString(16)}`, color, 0.75);
    const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    group.add(body);

    // Balcony bands on each floor
    const bandMat = this.getMaterial('apt_trim', 0xf1f5f9, 0.5);
    for (let f = 1; f <= floors; f++) {
      const bandY = f * 0.9 * scale;
      const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.15 * scale, 0.12 * scale, depth + 0.15 * scale), bandMat);
      band.position.y = bandY;
      group.add(band);
    }

    // Rooftop tanks
    const tankMat = this.getMaterial('gep_tank_map', 0x18181b, 0.4);
    for (let tx of [-0.6 * scale, 0.6 * scale]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.5 * scale, 8), tankMat);
      tank.position.set(tx, height + 0.25 * scale, 0);
      group.add(tank);
    }

    return group;
  }

  // =========================================================================
  // 3. MODERN GLASS SKYSCRAPER / COMMERCIAL TOWER (VI & Eko Atlantic style)
  // =========================================================================
  public static createGlassTower(height = 14, glassColor = 0x0284c7, scale = 1.0): THREE.Group {
    const group = new THREE.Group();
    const actualH = height * scale;

    const glassMat = this.getMaterial(`glass_${glassColor.toString(16)}`, glassColor, 0.15, 0.85);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.0 * scale, actualH, 4.0 * scale), glassMat);
    tower.position.y = actualH / 2;
    tower.castShadow = true;
    group.add(tower);

    // Glowing Neon Vertical Accent Trims
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const lx of [-2.05 * scale, 2.05 * scale]) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, actualH * 0.9, 0.2 * scale), ledMat);
      led.position.set(lx, actualH / 2, 0);
      group.add(led);
    }

    // Rooftop Helipad
    const heliMat = this.getMaterial('helipad_map', 0x334155, 0.5);
    const heli = new THREE.Mesh(new THREE.CylinderGeometry(1.4 * scale, 1.4 * scale, 0.2 * scale, 12), heliMat);
    heli.position.y = actualH + 0.1 * scale;
    group.add(heli);

    return group;
  }

  // =========================================================================
  // 4. COMMERCIAL SHOP PLAZA / MARKET BUKA
  // =========================================================================
  public static createShopPlaza(brandColor = 0x059669, scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    const shopMat = this.getMaterial(`shop_${brandColor.toString(16)}`, 0xf8fafc, 0.7);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(3.5 * scale, 1.8 * scale, 2.4 * scale), shopMat);
    shop.position.y = 0.9 * scale;
    shop.castShadow = true;
    group.add(shop);

    // Brand marquee awning
    const awningMat = this.getMaterial(`awning_${brandColor.toString(16)}`, brandColor, 0.4);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(3.6 * scale, 0.3 * scale, 0.8 * scale), awningMat);
    awning.position.set(0, 1.6 * scale, 1.4 * scale);
    group.add(awning);

    // Yellow or Red market umbrella out front
    const umbMat = this.getMaterial('market_umb', 0xfacc15, 0.6);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(0.8 * scale, 0.4 * scale, 8), umbMat);
    umb.position.set(1.4 * scale, 1.1 * scale, 1.8 * scale);
    group.add(umb);

    return group;
  }

  // =========================================================================
  // 5. FILLING STATION
  // =========================================================================
  public static createFillingStation(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Canopy
    const canopyMat = this.getMaterial('fuel_canopy', 0xea580c, 0.4);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.5 * scale, 0.3 * scale, 3.5 * scale), canopyMat);
    canopy.position.y = 2.2 * scale;
    canopy.castShadow = true;
    group.add(canopy);

    // Canopy pillars
    const pillarMat = this.getMaterial('fuel_pillar', 0xe2e8f0, 0.5);
    for (const px of [-1.5 * scale, 1.5 * scale]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 2.2 * scale, 8), pillarMat);
      p.position.set(px, 1.1 * scale, 0);
      group.add(p);
    }

    // Gas pump dispensers
    const pumpMat = this.getMaterial('fuel_pump', 0x1e293b, 0.3);
    for (const pz of [-0.8 * scale, 0.8 * scale]) {
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.8 * scale, 0.6 * scale), pumpMat);
      pump.position.set(0, 0.4 * scale, pz);
      group.add(pump);
    }

    // Mart shop behind
    const martMat = this.getMaterial('fuel_mart', 0xffffff, 0.7);
    const mart = new THREE.Mesh(new THREE.BoxGeometry(2.8 * scale, 1.4 * scale, 1.6 * scale), martMat);
    mart.position.set(0, 0.7 * scale, -2.2 * scale);
    group.add(mart);

    return group;
  }

  // =========================================================================
  // 6. NATIONAL STADIUM (Surulere)
  // =========================================================================
  public static createStadium(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Outer bowl ring
    const bowlMat = this.getMaterial('stadium_bowl', 0x94a3b8, 0.6);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(4.8 * scale, 4.0 * scale, 1.8 * scale, 24), bowlMat);
    bowl.position.y = 0.9 * scale;
    bowl.castShadow = true;
    group.add(bowl);

    // Green pitch inside
    const pitchMat = this.getMaterial('stadium_pitch', 0x16a34a, 0.9);
    const pitch = new THREE.Mesh(new THREE.CylinderGeometry(3.6 * scale, 3.6 * scale, 0.1 * scale, 24), pitchMat);
    pitch.position.y = 1.2 * scale;
    group.add(pitch);

    // Floodlight pylons
    const poleMat = this.getMaterial('stadium_pylon', 0x475569, 0.4);
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.12 * scale, 3.8 * scale, 6), poleMat);
      pylon.position.set(Math.cos(angle) * 5.2 * scale, 1.9 * scale, Math.sin(angle) * 5.2 * scale);
      group.add(pylon);
    }

    return group;
  }

  // =========================================================================
  // 7. AIRPORT AREA (Murtala Muhammed LOS)
  // =========================================================================
  public static createAirport(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Terminal Building
    const termMat = this.getMaterial('airport_term', 0x0284c7, 0.2, 0.7);
    const term = new THREE.Mesh(new THREE.BoxGeometry(8.0 * scale, 1.6 * scale, 3.2 * scale), termMat);
    term.position.y = 0.8 * scale;
    term.castShadow = true;
    group.add(term);

    // Control Tower
    const towerMat = this.getMaterial('airport_tower', 0xf1f5f9, 0.4);
    const towerMast = new THREE.Mesh(new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, 4.5 * scale, 12), towerMat);
    towerMast.position.set(-3.2 * scale, 2.25 * scale, -1.8 * scale);
    group.add(towerMast);

    const cabMat = this.getMaterial('tower_cab', 0x38bdf8, 0.1, 0.9);
    const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * scale, 0.7 * scale, 0.7 * scale, 12), cabMat);
    towerCab.position.set(-3.2 * scale, 4.7 * scale, -1.8 * scale);
    group.add(towerCab);

    // Runway Strip
    const runwayMat = this.getMaterial('runway_asphalt', 0x1e293b, 0.9);
    const runway = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 0.05 * scale, 16.0 * scale), runwayMat);
    runway.position.set(4.0 * scale, 0.02 * scale, 0);
    group.add(runway);

    // Runway white center dashed markings
    const lineMat = this.getMaterial('runway_line', 0xffffff, 0.5);
    for (let rz = -7.0 * scale; rz <= 7.0 * scale; rz += 2.0 * scale) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.2 * scale, 1.2 * scale), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(4.0 * scale, 0.06 * scale, rz);
      group.add(dash);
    }

    // Mini Airplane parked on tarmac
    const plane = this.createMiniAirplane(0x1d4ed8, scale);
    plane.position.set(1.5 * scale, 0.2 * scale, -1.0 * scale);
    plane.rotation.y = -Math.PI / 3;
    group.add(plane);

    return group;
  }

  // Mini Airplane
  public static createMiniAirplane(airlineColor = 0x1d4ed8, scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Fuselage
    const fuseMat = this.getMaterial('plane_body', 0xffffff, 0.3);
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.22 * scale, 2.2 * scale, 10), fuseMat);
    fuse.rotation.x = Math.PI / 2;
    fuse.position.y = 0.35 * scale;
    group.add(fuse);

    // Wings
    const wingMat = this.getMaterial(`plane_wing_${airlineColor.toString(16)}`, airlineColor, 0.4);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 0.04 * scale, 0.6 * scale), wingMat);
    wings.position.set(0, 0.35 * scale, 0.2 * scale);
    group.add(wings);

    // Tail fin
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 0.5 * scale, 0.4 * scale), wingMat);
    tail.position.set(0, 0.65 * scale, -0.9 * scale);
    group.add(tail);

    return group;
  }

  // =========================================================================
  // 8. APAPA MARINE PORT & CONTAINER DOCKS
  // =========================================================================
  public static createPort(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Concrete Wharf Quay
    const quayMat = this.getMaterial('port_quay', 0x475569, 0.85);
    const quay = new THREE.Mesh(new THREE.BoxGeometry(10.0 * scale, 0.4 * scale, 6.0 * scale), quayMat);
    quay.position.set(0, 0.2 * scale, 0);
    group.add(quay);

    // Stacked Multicolored Shipping Containers (Dangote, Maersk, MSC)
    const containerColors = [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b, 0x0f172a];
    for (let i = 0; i < 9; i++) {
      const cx = (-3.0 + (i % 3) * 1.5) * scale;
      const cz = (-1.5 + Math.floor(i / 3) * 1.2) * scale;
      const cMat = this.getMaterial(`container_${i}`, containerColors[i % containerColors.length], 0.6);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 0.6 * scale, 2.2 * scale), cMat);
      box.position.set(cx, 0.7 * scale, cz);
      box.castShadow = true;
      group.add(box);

      // 2nd tier container on top
      if (i % 2 === 0) {
        const topBox = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 0.6 * scale, 2.2 * scale), cMat);
        topBox.position.set(cx, 1.3 * scale, cz);
        topBox.castShadow = true;
        group.add(topBox);
      }
    }

    // High Gantry Cargo Crane
    const craneMat = this.getMaterial('port_crane', 0xfacc15, 0.4);
    const craneLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 3.8 * scale, 6), craneMat);
    craneLegL.position.set(3.2 * scale, 1.9 * scale, -1.5 * scale);
    group.add(craneLegL);

    const craneLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 3.8 * scale, 6), craneMat);
    craneLegR.position.set(3.2 * scale, 1.9 * scale, 1.5 * scale);
    group.add(craneLegR);

    const craneArm = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.3 * scale, 4.2 * scale), craneMat);
    craneArm.position.set(3.2 * scale, 3.8 * scale, 0.5 * scale);
    group.add(craneArm);

    // Cargo Freighter Ship in water beside dock
    const ship = this.createCargoShip(scale);
    ship.position.set(6.2 * scale, 0.1 * scale, 0);
    group.add(ship);

    return group;
  }

  // Cargo Freighter Ship
  public static createCargoShip(scale = 1.0): THREE.Group {
    const group = new THREE.Group();
    const hullMat = this.getMaterial('ship_hull', 0x1e293b, 0.7);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2 * scale, 0.8 * scale, 7.5 * scale), hullMat);
    hull.position.y = 0.4 * scale;
    group.add(hull);

    // Bridge cabin
    const cabinMat = this.getMaterial('ship_cabin', 0xffffff, 0.5);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8 * scale, 1.2 * scale, 1.6 * scale), cabinMat);
    cabin.position.set(0, 1.2 * scale, -2.4 * scale);
    group.add(cabin);

    // Containers on deck
    const cMat1 = this.getMaterial('deck_cont_1', 0xdc2626, 0.6);
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(1.2 * scale, 0.5 * scale, 3.6 * scale), cMat1);
    c1.position.set(0, 0.95 * scale, 0.8 * scale);
    group.add(c1);

    return group;
  }

  // =========================================================================
  // 9. ICONIC BRIDGES (Third Mainland / Lekki-Ikoyi Link)
  // =========================================================================
  public static createBridge(start: THREE.Vector3, end: THREE.Vector3, width = 3.5, isSuspension = false): THREE.Group {
    const group = new THREE.Group();

    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // Bridge road deck
    const deckMat = this.getMaterial('bridge_deck', 0x334155, 0.7);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.25, length), deckMat);
    deck.position.copy(mid);
    deck.lookAt(end);
    group.add(deck);

    // Concrete pier pillars into water
    const pierMat = this.getMaterial('bridge_pier', 0x64748b, 0.9);
    const numPiers = Math.max(2, Math.floor(length / 18));
    for (let i = 1; i <= numPiers; i++) {
      const alpha = i / (numPiers + 1);
      const pierPos = new THREE.Vector3().lerpVectors(start, end, alpha);
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.8, 10), pierMat);
      pier.position.set(pierPos.x, pierPos.y - 0.9, pierPos.z);
      group.add(pier);
    }

    // Suspension Pylon for Lekki-Ikoyi Link Bridge
    if (isSuspension) {
      const pylonMat = this.getMaterial('bridge_pylon', 0xf1f5f9, 0.3);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8.5, 0.8), pylonMat);
      pylon.position.set(mid.x, mid.y + 4.0, mid.z);
      group.add(pylon);
    }

    return group;
  }

  // =========================================================================
  // 10. MINIATURE VEHICLE PREFAB (Danfo, Keke, Car)
  // =========================================================================
  public static createMiniVehicle(type: 'danfo' | 'keke' | 'car' | 'truck', colorHex = 0xfacc15): THREE.Group {
    const group = new THREE.Group();

    if (type === 'danfo') {
      const bodyMat = this.getMaterial('mini_danfo', 0xfacc15, 0.35);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.6), bodyMat);
      body.position.y = 0.35;
      group.add(body);
      // Stripe
      const stripeMat = this.getMaterial('mini_danfo_stripe', 0x111111, 0.5);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.1, 1.5), stripeMat);
      stripe.position.y = 0.35;
      group.add(stripe);
    } else if (type === 'keke') {
      const bodyMat = this.getMaterial('mini_keke', 0xfacc15, 0.35);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.8), bodyMat);
      body.position.y = 0.28;
      group.add(body);
    } else {
      const bodyMat = this.getMaterial(`mini_car_${colorHex.toString(16)}`, colorHex, 0.3);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 1.4), bodyMat);
      body.position.y = 0.22;
      group.add(body);
    }

    return group;
  }

  // =========================================================================
  // 11. TREE & TROPICAL VEGETATION
  // =========================================================================
  public static createTree(isPalm = false, scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    if (isPalm) {
      const trunkMat = this.getMaterial('palm_trunk', 0x78350f, 0.9);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.14 * scale, 2.2 * scale, 6), trunkMat);
      trunk.position.y = 1.1 * scale;
      trunk.rotation.z = -0.06;
      group.add(trunk);

      const leafMat = this.getMaterial('palm_leaf', 0x15803d, 0.6);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.1 * scale, 0.7 * scale, 6), leafMat);
      leaves.position.y = 2.2 * scale;
      group.add(leaves);
    } else {
      const trunkMat = this.getMaterial('tree_trunk', 0x451a03, 0.9);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.16 * scale, 1.2 * scale, 6), trunkMat);
      trunk.position.y = 0.6 * scale;
      group.add(trunk);

      const foliageMat = this.getMaterial('tree_foliage', 0x16a34a, 0.75);
      const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 * scale), foliageMat);
      leaves.position.y = 1.6 * scale;
      leaves.castShadow = true;
      group.add(leaves);
    }

    return group;
  }

  // =========================================================================
  // 12. NAIJA HIGHWAY BILLBOARD
  // =========================================================================
  public static createBillboard(brand: string, colorHex: number, scale = 1.0): THREE.Group {
    const group = new THREE.Group();
    group.name = `Billboard_${brand}`;

    const poleMat = this.getMaterial('bb_pole', 0x64748b, 0.5);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 2.8 * scale, 8), poleMat);
    pole.position.y = 1.4 * scale;
    group.add(pole);

    const canvasMat = this.getMaterial(`bb_canvas_${colorHex.toString(16)}`, colorHex, 0.4);
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 1.2 * scale, 0.15 * scale), canvasMat);
    board.position.y = 3.2 * scale;
    board.castShadow = true;
    group.add(board);

    return group;
  }

  // =========================================================================
  // 13. HOSPITAL PREFAB (St. Nicholas General Hospital)
  // =========================================================================
  public static createHospital(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Main Hospital Ward Wing
    const wallMat = this.getMaterial('hosp_wall', 0xf8fafc, 0.4);
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(5.0 * scale, 3.2 * scale, 3.8 * scale), wallMat);
    mainBody.position.y = 1.6 * scale;
    mainBody.castShadow = true;
    group.add(mainBody);

    // Blue tinted medical windows band
    const winMat = this.getMaterial('hosp_win', 0x38bdf8, 0.2, 0.8);
    for (const wy of [1.2 * scale, 2.3 * scale]) {
      const winStrip = new THREE.Mesh(new THREE.BoxGeometry(5.1 * scale, 0.4 * scale, 3.9 * scale), winMat);
      winStrip.position.y = wy;
      group.add(winStrip);
    }

    // Emergency Entrance Canopy
    const emergMat = this.getMaterial('hosp_emerg', 0xef4444, 0.5);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 0.2 * scale, 1.2 * scale), emergMat);
    canopy.position.set(0, 1.1 * scale, 2.4 * scale);
    group.add(canopy);

    // Rooftop Red Cross
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 1.2 * scale, 0.1 * scale), crossMat);
    crossV.position.set(0, 3.8 * scale, 1.91 * scale);
    group.add(crossV);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.0 * scale, 0.35 * scale, 0.1 * scale), crossMat);
    crossH.position.set(0, 3.8 * scale, 1.91 * scale);
    group.add(crossH);

    return group;
  }

  // =========================================================================
  // 14. COMMERCIAL BANK PREFAB (Broad Street Banks)
  // =========================================================================
  public static createBank(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Tower Body
    const bankMat = this.getMaterial('bank_stone', 0x1e293b, 0.3, 0.5);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4.4 * scale, 6.0 * scale, 4.4 * scale), bankMat);
    tower.position.y = 3.0 * scale;
    tower.castShadow = true;
    group.add(tower);

    // Gold Top Crown
    const goldMat = this.getMaterial('bank_gold', 0xf59e0b, 0.2, 0.9);
    const crown = new THREE.Mesh(new THREE.BoxGeometry(4.6 * scale, 0.6 * scale, 4.6 * scale), goldMat);
    crown.position.y = 6.2 * scale;
    group.add(crown);

    // Modern Glass Ribs
    const glassMat = this.getMaterial('bank_glass', 0x10b981, 0.1, 0.85);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 5.2 * scale, 4.5 * scale), glassMat);
    rib.position.y = 3.0 * scale;
    group.add(rib);

    return group;
  }

  // =========================================================================
  // 15. POLICE STATION PREFAB (Area Command)
  // =========================================================================
  public static createPoliceStation(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Station House
    const wallMat = this.getMaterial('police_wall', 0x1e3a8a, 0.5);
    const station = new THREE.Mesh(new THREE.BoxGeometry(4.2 * scale, 2.4 * scale, 3.6 * scale), wallMat);
    station.position.y = 1.2 * scale;
    station.castShadow = true;
    group.add(station);

    // White trim band
    const trimMat = this.getMaterial('police_trim', 0xffffff, 0.5);
    const band = new THREE.Mesh(new THREE.BoxGeometry(4.3 * scale, 0.3 * scale, 3.7 * scale), trimMat);
    band.position.y = 1.8 * scale;
    group.add(band);

    // Radio Antenna Mast
    const mastMat = this.getMaterial('police_mast', 0x94a3b8, 0.3);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.08 * scale, 4.0 * scale, 6), mastMat);
    mast.position.set(1.5 * scale, 4.2 * scale, -1.2 * scale);
    group.add(mast);

    // Beacon Light on roof
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.25 * scale, 8, 8), beaconMat);
    beacon.position.set(0, 2.65 * scale, 0);
    group.add(beacon);

    return group;
  }

  // =========================================================================
  // 16. PETROLEUM REFINERY & TANK FARM (Apapa & Lekki Free Zone)
  // =========================================================================
  public static createRefineryTanks(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Concrete Base Apron
    const apronMat = this.getMaterial('refinery_apron', 0xcb9a4c, 0.7);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(9.0 * scale, 0.2 * scale, 7.5 * scale), apronMat);
    apron.position.y = 0.1 * scale;
    group.add(apron);

    // 4 Cylindrical Oil Storage Tanks
    const tankMat = this.getMaterial('refinery_tank', 0xe2e8f0, 0.3, 0.2);
    const coneMat = this.getMaterial('refinery_roof', 0x94a3b8, 0.5);
    const coords = [
      [-2.4, -1.8],
      [2.4, -1.8],
      [-2.4, 1.8],
      [2.4, 1.8],
    ];

    for (const [tx, tz] of coords) {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6 * scale, 1.6 * scale, 1.8 * scale, 18),
        tankMat
      );
      tank.position.set(tx * scale, 1.0 * scale, tz * scale);
      tank.castShadow = true;
      group.add(tank);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(1.62 * scale, 0.4 * scale, 18),
        coneMat
      );
      cap.position.set(tx * scale, 2.05 * scale, tz * scale);
      group.add(cap);
    }

    // Yellow pipeline grid
    const pipeMat = this.getMaterial('refinery_pipe', 0xeab308, 0.4);
    const pipe1 = new THREE.Mesh(new THREE.BoxGeometry(7.0 * scale, 0.15 * scale, 0.15 * scale), pipeMat);
    pipe1.position.set(0, 0.5 * scale, 0);
    group.add(pipe1);

    return group;
  }

  // =========================================================================
  // 17. LUXURY RESIDENTIAL ESTATE WITH SWIMMING POOL (Lekki / Ikoyi)
  // =========================================================================
  public static createResidentialEstate(scale = 1.0): THREE.Group {
    const group = new THREE.Group();

    // Manicured Green Lawn Compound
    const turfMat = this.getMaterial('estate_turf', 0x22c55e, 0.85);
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(10.0 * scale, 0.2 * scale, 8.0 * scale), turfMat);
    lawn.position.y = 0.1 * scale;
    group.add(lawn);

    // Neat White Fenced Plots
    const fenceMat = this.getMaterial('estate_fence', 0xffffff, 0.5);
    const fence = new THREE.Mesh(new THREE.BoxGeometry(9.6 * scale, 0.3 * scale, 7.6 * scale), fenceMat);
    fence.position.y = 0.25 * scale;
    group.add(fence);

    // 6 Mini Duplexes
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const dx = (-2.8 + c * 2.8) * scale;
        const dz = (-2.2 + r * 2.8) * scale;
        const duplex = WorldMapPrefabs.createHouse(0xfffbeb, 0xb91c1c, 0.55 * scale);
        duplex.position.set(dx, 0.2 * scale, dz);
        group.add(duplex);
      }
    }

    // Swimming Pool
    const poolWaterMat = this.getMaterial('estate_pool', 0x0ea5e9, 0.1, 0.7);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(2.4 * scale, 0.08 * scale, 1.4 * scale), poolWaterMat);
    pool.position.set(0, 0.22 * scale, 2.6 * scale);
    group.add(pool);

    // Palm Trees along border
    for (const px of [-4.2 * scale, 4.2 * scale]) {
      const palm = WorldMapPrefabs.createTree(true, 0.85 * scale);
      palm.position.set(px, 0.2 * scale, 0);
      group.add(palm);
    }

    return group;
  }
}
