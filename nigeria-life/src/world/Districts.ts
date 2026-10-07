import * as THREE from 'three';
import type { InteractiveObject } from './World';
import { createColorCanvasTexture } from '../utils/TextureUtils';
import { MaterialLibrary } from '../materials/MaterialLibrary';

export class Districts {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];

  // Ocean water animation
  private oceanMesh!: THREE.Mesh;
  private animTime: number = 0;

  // Generator smoke
  private smokeParticles: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();

    // 1. Build Victoria Island & Eko Atlantic Waterfront (South)
    this.buildVictoriaIsland();

    // 2. Build Computer Village & Otigba Street (North)
    this.buildComputerVillage();

    // 3. Build Amala Shitta & Abula Bukateria (Mainland)
    this.buildAmalaShitta();

    // 4. Build Lekki Phase 1 & Lekki-Ikoyi Link Bridge (East)
    this.buildLekkiPhaseOne();

    // 5. District Connecting Roads & Billboards
    this.buildDistrictRoadsAndBillboards();
  }

  // =========================================================================
  // 1. VICTORIA ISLAND & EKO ATLANTIC WATERFRONT (South: Z +60 to +140)
  // =========================================================================
  private buildVictoriaIsland(): void {
    const viGroup = new THREE.Group();
    viGroup.position.set(0, 0, 95);

    // Atlantic Ocean Water Surface
    const oceanGeo = new THREE.PlaneGeometry(160, 60, 32, 16);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.rotation.x = -Math.PI / 2;
    this.oceanMesh.position.set(0, -0.15, 35);
    viGroup.add(this.oceanMesh);

    // Eko Atlantic High-Rise Glass Skyscraper
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-25, 0, 0);

    const towerGeo = new THREE.BoxGeometry(16, 38, 16);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.9,
    });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.y = 19;
    tower.castShadow = true;
    towerGroup.add(tower);

    // Vertical Blue LED strip accents
    for (let x of [-8.1, 8.1]) {
      const ledGeo = new THREE.BoxGeometry(0.25, 36, 0.4);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.set(x, 19, 0);
      towerGroup.add(led);
    }

    // Helipad on rooftop
    const helipadGeo = new THREE.CylinderGeometry(5.5, 5.5, 0.4, 24);
    const helipadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const helipad = new THREE.Mesh(helipadGeo, helipadMat);
    helipad.position.y = 38.2;
    towerGroup.add(helipad);

    // Helipad "H" letter mark
    const hGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const hMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
    const hMesh = new THREE.Mesh(hGeo, hMat);
    hMesh.rotation.x = -Math.PI / 2;
    hMesh.position.y = 38.45;
    towerGroup.add(hMesh);

    viGroup.add(towerGroup);

    this.interactiveList.push({
      mesh: towerGroup,
      id: 'vi-tower',
      name: 'Eko Atlantic Corporate Tower',
      category: 'Victoria Island Landmark',
      description: 'Ultra-modern 30-floor glass monolith housing venture funds, crypto desks, and multinational oil firms.',
      interactionPoint: new THREE.Vector3(-14, 0, 95),
    });

    // Eko Beachside Lounge & Nightclub
    const loungeGroup = new THREE.Group();
    loungeGroup.position.set(24, 0, 8);

    const loungeGeo = new THREE.BoxGeometry(14, 6.5, 12);
    const loungeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
    const lounge = new THREE.Mesh(loungeGeo, loungeMat);
    lounge.position.y = 3.25;
    loungeGroup.add(lounge);

    // Neon Rooftop Bar Canopy (Magenta & Violet Glow)
    const roofBarGeo = new THREE.BoxGeometry(14.4, 0.5, 12.4);
    const roofBarMat = new THREE.MeshStandardMaterial({ color: 0xa855f7 });
    const roofBar = new THREE.Mesh(roofBarGeo, roofBarMat);
    roofBar.position.y = 6.6;
    loungeGroup.add(roofBar);

    // Neon signage
    const signGeo = new THREE.BoxGeometry(10, 1.2, 0.3);
    const signMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 5.2, -6.2);
    loungeGroup.add(sign);

    // Beach palm trees lining the ocean promenade
    for (let pz of [-10, 0, 10, 20]) {
      const palmTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.35, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      );
      palmTrunk.position.set(13, 3, pz);
      palmTrunk.rotation.z = -0.08;
      loungeGroup.add(palmTrunk);

      const palmFronds = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, 1.6, 8),
        new THREE.MeshStandardMaterial({ color: 0x15803d })
      );
      palmFronds.position.set(13.2, 6.3, pz);
      loungeGroup.add(palmFronds);
    }

    viGroup.add(loungeGroup);

    this.interactiveList.push({
      mesh: loungeGroup,
      id: 'quilox-club',
      name: 'Quilox VIP Nightclub & Waterfront Lounge',
      category: 'Ultra-Luxury Nightlife',
      description: 'World-famous Victoria Island VIP club. Dom Pérignon champagne with sparklers, celebrity tables, and Afrobeats anthems.',
      interactionPoint: new THREE.Vector3(14, 0, 103),
    });

    this.group.add(viGroup);
  }

  // =========================================================================
  // 2. COMPUTER VILLAGE & OTIGBA STREET (North: Z -60 to -140)
  // =========================================================================
  private buildComputerVillage(): void {
    const cvGroup = new THREE.Group();
    cvGroup.position.set(0, 0, -95);

    // Otigba Electronics Plaza
    const plazaGroup = new THREE.Group();
    plazaGroup.position.set(22, 0, 0);

    const plazaGeo = new THREE.BoxGeometry(15, 9, 18);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.y = 4.5;
    plazaGroup.add(plaza);

    // Colorful Tech Storefront signs (Yellow MTN, Red Airtel, Green Glo)
    const brandColors = [0xfacc15, 0xdc2626, 0x16a34a, 0x2563eb];
    for (let i = 0; i < 4; i++) {
      const bannerGeo = new THREE.BoxGeometry(0.3, 1.4, 3.6);
      const bannerMat = new THREE.MeshBasicMaterial({ color: brandColors[i] });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(-7.6, 6.8, -6 + i * 4);
      plazaGroup.add(banner);
    }

    // Street Gadget Repair Kiosks & Umbrellas
    for (let k of [-5, 4]) {
      const umbrellaGeo = new THREE.ConeGeometry(2.2, 0.9, 8);
      const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xf97316 });
      const umbrella = new THREE.Mesh(umbrellaGeo, umbrellaMat);
      umbrella.position.set(-11, 2.9, k);
      plazaGroup.add(umbrella);

      const tableGeo = new THREE.BoxGeometry(1.8, 1.1, 1.4);
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
      const table = new THREE.Mesh(tableGeo, tableMat);
      table.position.set(-11, 0.55, k);
      plazaGroup.add(table);
    }

    // Soundproof Generator Set outside with exhaust pipe
    const genGeo = new THREE.BoxGeometry(2.4, 1.6, 1.8);
    const genMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    const gen = new THREE.Mesh(genGeo, genMat);
    gen.position.set(-9.5, 0.8, -10);
    plazaGroup.add(gen);

    // Exhaust pipe with smoke particle spawn
    const pipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8);
    const pipe = new THREE.Mesh(pipeGeo, new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
    pipe.position.set(-8.8, 1.8, -10);
    plazaGroup.add(pipe);

    // Visual smoke particles
    for (let s = 0; s < 3; s++) {
      const smokeGeo = new THREE.DodecahedronGeometry(0.18 + s * 0.08);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x64748b,
        transparent: true,
        opacity: 0.45 - s * 0.1,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.set(-8.8, 2.3 + s * 0.35, -10);
      this.smokeParticles.push(smoke);
      plazaGroup.add(smoke);
    }

    cvGroup.add(plazaGroup);

    this.interactiveList.push({
      mesh: plazaGroup,
      id: 'cv-plaza',
      name: 'Otigba Tech Plaza & Computer Village Hub',
      category: 'Electronics & Repairs',
      description: 'Lagos largest ICT market. Smartphone repairs, high-capacity power banks, laptop parts, and hacker gear.',
      interactionPoint: new THREE.Vector3(12, 0, -95),
    });

    this.interactiveList.push({
      mesh: gen,
      id: 'nepa-generator',
      name: 'Tiger "I Pass My Neighbor" Generator & Fuel Keg',
      category: 'Essential Power & Backup',
      description: 'When NEPA strikes in Computer Village, pull the starter cord and pour ₦1,200 fuel to keep the hustle glowing!',
      interactionPoint: new THREE.Vector3(12.5, 0, -105),
    });

    this.group.add(cvGroup);
  }

  // =========================================================================
  // 3. AMALA SHITTA & ABUJA BUGA BUKATERIA (Mainland: Z -85)
  // =========================================================================
  private buildAmalaShitta(): void {
    const amalaGroup = new THREE.Group();
    amalaGroup.position.set(-24, 0, -85);

    // Rustic ochre yellow buka building
    const bukaGeo = new THREE.BoxGeometry(14, 5.5, 12);
    const bukaMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
    const buka = new THREE.Mesh(bukaGeo, bukaMat);
    buka.position.y = 2.75;
    buka.castShadow = true;
    amalaGroup.add(buka);

    // Green corrugated roof
    const roofGeo = new THREE.ConeGeometry(11, 2.8, 4);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 6.8;
    roof.rotation.y = Math.PI / 4;
    amalaGroup.add(roof);

    // Amala Shitta signboard
    const signGeo = new THREE.BoxGeometry(9.5, 1.4, 0.3);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x166534 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 4.4, 6.15);
    amalaGroup.add(sign);

    // Steaming black earthenware pot for hot Amala & Abula
    const potGeo = new THREE.CylinderGeometry(0.8, 0.6, 1.2, 16);
    const potMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(4, 0.6, 7);
    amalaGroup.add(pot);

    // Steam particles rising from the hot buka pot
    for (let p = 0; p < 4; p++) {
      const steamGeo = new THREE.DodecahedronGeometry(0.15 + p * 0.06);
      const steamMat = new THREE.MeshBasicMaterial({
        color: 0xf1f5f9,
        transparent: true,
        opacity: 0.5 - p * 0.1,
      });
      const steam = new THREE.Mesh(steamGeo, steamMat);
      steam.position.set(4, 1.3 + p * 0.3, 7);
      this.smokeParticles.push(steam);
      amalaGroup.add(steam);
    }

    // Traditional wooden dining benches
    for (let bz of [-2, 2]) {
      const benchGeo = new THREE.BoxGeometry(4.5, 0.45, 0.8);
      const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      const bench = new THREE.Mesh(benchGeo, benchMat);
      bench.position.set(-2, 0.25, 7 + bz);
      amalaGroup.add(bench);
    }

    this.group.add(amalaGroup);

    this.interactiveList.push({
      mesh: amalaGroup,
      id: 'amala-shitta',
      name: 'Amala Shitta & Abula Joint',
      category: 'Authentic Nigerian Buka',
      description: 'Legendary steaming hot Amala dudu, rich Gbegiri, fresh Ewedu, tender goat meat, and assorted beef (Orisirisi).',
      interactionPoint: new THREE.Vector3(-16, 0, -85),
    });
  }

  // =========================================================================
  // 3. LEKKI PHASE 1 & LEKKI-IKOYI LINK BRIDGE (East: X +45 to +110)
  // =========================================================================
  private buildLekkiPhaseOne(): void {
    const lekkiGroup = new THREE.Group();
    lekkiGroup.position.set(65, 0, 0);

    // Lekki-Ikoyi Link Bridge Iconic Suspension Pylon
    const pylonGroup = new THREE.Group();
    pylonGroup.position.set(0, 0, 0);

    // Twin concrete A-frame pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const pylonLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 28, 1.6), pillarMat);
    pylonLeft.position.set(0, 14, -6.5);
    pylonLeft.rotation.x = -0.06;
    pylonGroup.add(pylonLeft);

    const pylonRight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 28, 1.6), pillarMat);
    pylonRight.position.set(0, 14, 6.5);
    pylonRight.rotation.x = 0.06;
    pylonGroup.add(pylonRight);

    // Cross beam joining the pylons near the apex
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 12.5), pillarMat);
    crossBeam.position.set(0, 24, 0);
    pylonGroup.add(crossBeam);

    // Steel stay-cables stretching down to bridge deck
    const cableMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    for (let z of [-18, -12, -6, 6, 12, 18]) {
      const cablePoints = [
        new THREE.Vector3(0, 24, 0),
        new THREE.Vector3(0, 0.4, z * 1.5),
      ];
      const cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
      const cable = new THREE.Line(cableGeo, cableMat);
      pylonGroup.add(cable);
    }

    // Lekki Toll Plaza Canopy
    const tollCanopyGeo = new THREE.BoxGeometry(6, 1.2, 14);
    const tollCanopyMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
    const tollCanopy = new THREE.Mesh(tollCanopyGeo, tollCanopyMat);
    tollCanopy.position.set(-18, 4.2, 0);
    pylonGroup.add(tollCanopy);

    // Toll booths with green LED clearance lights
    for (let tz of [-4, 0, 4]) {
      const boothGeo = new THREE.BoxGeometry(1.6, 2.4, 1.4);
      const boothMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const booth = new THREE.Mesh(boothGeo, boothMat);
      booth.position.set(-18, 1.2, tz);
      pylonGroup.add(booth);

      const lightGeo = new THREE.SphereGeometry(0.2, 12, 12);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(-18, 2.6, tz);
      pylonGroup.add(light);
    }

    lekkiGroup.add(pylonGroup);

    this.interactiveList.push({
      mesh: pylonGroup,
      id: 'lekki-bridge',
      name: 'Lekki-Ikoyi Cable-Stayed Link Bridge & Toll Plaza',
      category: 'Infrastructure Landmark',
      description: 'Iconic suspension bridge connecting Ikoyi to Admiralty Way, Lekki Phase 1. Scenic coastal expressway.',
      interactionPoint: new THREE.Vector3(45, 0, 0),
    });

    // Nike Art Gallery & Luxury Studio (Admiralty Way)
    const galleryGroup = new THREE.Group();
    galleryGroup.position.set(22, 0, -18);

    const galleryGeo = new THREE.BoxGeometry(14, 7, 14);
    const galleryMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.6 });
    const gallery = new THREE.Mesh(galleryGeo, galleryMat);
    gallery.position.y = 3.5;
    galleryGroup.add(gallery);

    // Traditional Yoruba sculptured mosaic facade panels
    const mosaicGeo = new THREE.BoxGeometry(14.2, 3.2, 0.3);
    const mosaicMat = new THREE.MeshStandardMaterial({ color: 0xb45309 });
    const mosaic = new THREE.Mesh(mosaicGeo, mosaicMat);
    mosaic.position.set(0, 4.5, 7.15);
    galleryGroup.add(mosaic);

    // Bronze Sculpture in courtyard
    const sculptureGeo = new THREE.CylinderGeometry(0.6, 0.9, 3.2, 8);
    const sculptureMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
    const sculpture = new THREE.Mesh(sculptureGeo, sculptureMat);
    sculpture.position.set(0, 1.6, 10.5);
    galleryGroup.add(sculpture);

    lekkiGroup.add(galleryGroup);

    this.interactiveList.push({
      mesh: galleryGroup,
      id: 'nike-art-gallery',
      name: 'Nike Art & Contemporary African Studio',
      category: 'Arts & Culture',
      description: 'Legendary 5-story cultural gallery showcasing handmade Adire batiks, beadwork, and bronze masterpieces.',
      interactionPoint: new THREE.Vector3(72, 0, -8),
    });

    this.group.add(lekkiGroup);
  }

  // =========================================================================
  // 4. CONNECTING ROADS & NAIJA LED BILLBOARDS
  // =========================================================================
  private buildDistrictRoadsAndBillboards(): void {
    // East-West Arterial Road to Lekki (X: 10 to 80, Z: 0)
    const lekkiRoadGeo = new THREE.PlaneGeometry(80, 12);
    const asphaltMat = MaterialLibrary.getInstance().asphaltMaterial;
    const lekkiRoad = new THREE.Mesh(lekkiRoadGeo, asphaltMat);
    lekkiRoad.rotation.x = -Math.PI / 2;
    lekkiRoad.position.set(48, 0.015, 0);
    this.group.add(lekkiRoad);

    // Giant Lagos LED Digital Billboards
    this.createBillboard(new THREE.Vector3(12, 0, 50), 0, 'AIR PEACE', 'Fly Eko to the World', 0x1e3a8a);
    this.createBillboard(new THREE.Vector3(-12, 0, -50), Math.PI, 'DANGOTE CEMENT', 'Building the Giant of Africa', 0xb91c1c);
    this.createBillboard(new THREE.Vector3(38, 0, 12), -Math.PI / 2, 'MTN 5G NAIJA', 'What are we doing today?', 0xfacc15);
  }

  private createBillboard(pos: THREE.Vector3, rotY: number, brand: string, tag: string, colorHex: number): void {
    const bbGroup = new THREE.Group();
    bbGroup.position.copy(pos);
    bbGroup.rotation.y = rotY;

    // Pillar
    const poleGeo = new THREE.CylinderGeometry(0.4, 0.45, 9, 12);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 4.5;
    bbGroup.add(pole);

    // Board canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 512, 256);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(brand, 256, 110);

    ctx.font = '24px sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(tag, 256, 170);

    const texture = createColorCanvasTexture(canvas);
    const boardGeo = new THREE.BoxGeometry(8, 4, 0.4);
    const boardMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.y = 10.5;
    bbGroup.add(board);

    this.group.add(bbGroup);
  }

  public update(delta: number): void {
    this.animTime += delta;

    // Ocean ripple effect
    if (this.oceanMesh) {
      this.oceanMesh.position.y = -0.15 + Math.sin(this.animTime * 1.8) * 0.08;
    }

    // Generator smoke pulse
    for (let i = 0; i < this.smokeParticles.length; i++) {
      const sp = this.smokeParticles[i];
      sp.position.y += delta * 0.4;
      if (sp.position.y > 3.8) {
        sp.position.y = 2.2;
      }
    }
  }
}
