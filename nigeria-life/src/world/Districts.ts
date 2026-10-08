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

  // Airport radar scanner animation
  private airportRadarMesh?: THREE.Mesh;

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

    // 5. Build Yaba Tech Corridor & CcHub Innovation Hub (Central)
    this.buildYabaTechStrip();

    // 5b. Build University of Lagos (UNILAG) Akoka Campus & Senate Gates
    this.buildUnilagCampus();

    // 6. Build Surulere Sports Hub & Teslim Balogun Stadium (West)
    this.buildSurulereStadium();

    // 7. Build Murtala Muhammed Airport Terminal & Flight Deck (North-West)
    this.buildAirportTerminal();

    // 8. Build Ajah Peninsula Developing Residential Estate (Far East)
    this.buildAjahDevelopingEstate();

    // 9. Build Lagos Island CMS Marina & Balogun Fabric Market (Central South)
    this.buildMarinaBalogunMarket();

    // 10. Build General Hospital & Police Station Destinations
    this.buildGeneralHospital();
    this.buildPoliceStation();

    // 11. District Connecting Roads & Billboards
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
  // 5. YABA TECH STRIP & CCHUB INNOVATION INCUBATOR (Central: X -15, Z -25)
  // =========================================================================
  private buildYabaTechStrip(): void {
    const yabaGroup = new THREE.Group();
    yabaGroup.position.set(-15, 0, -25);

    // Modern 3-story CcHub Glass Incubator
    const hubGroup = new THREE.Group();
    hubGroup.position.set(0, 0, 0);

    const hubGeo = new THREE.BoxGeometry(15, 11, 14);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.2,
      metalness: 0.8,
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.y = 5.5;
    hub.castShadow = true;
    hubGroup.add(hub);

    // Vibrant Tech Stripes (Orange & Purple)
    const orangeStripe = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.8, 14.2),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    orangeStripe.position.y = 4.0;
    hubGroup.add(orangeStripe);

    const purpleStripe = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.8, 14.2),
      new THREE.MeshBasicMaterial({ color: 0xa855f7 })
    );
    purpleStripe.position.y = 7.5;
    hubGroup.add(purpleStripe);

    // Rooftop Solar Photovoltaic Panels
    for (let rx of [-4, 0, 4]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 0.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.9, roughness: 0.1 })
      );
      panel.position.set(rx, 11.2, 0);
      panel.rotation.x = 0.15;
      hubGroup.add(panel);
    }

    // Street developer hackathon workbench with outdoor chairs
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.9, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    desk.position.set(0, 0.45, 8.5);
    hubGroup.add(desk);

    // Laptop mockups
    for (let lx of [-0.8, 0.8]) {
      const laptop = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
      );
      laptop.position.set(lx, 0.94, 8.5);
      hubGroup.add(laptop);
    }

    yabaGroup.add(hubGroup);

    this.interactiveList.push({
      mesh: hubGroup,
      id: 'yaba-cchub',
      name: 'Co-Creation Hub (CcHub) & Tech Incubator',
      category: 'Yaba Tech Corridor',
      description: 'The Silicon Valley of West Africa. Silicon Valley venture funds, hackathons, and high-paying remote tech engineering sprints.',
      interactionPoint: new THREE.Vector3(-15, 0, -20),
    });

    this.group.add(yabaGroup);
  }

  // =========================================================================
  // 5b. UNIVERSITY OF LAGOS (UNILAG) AKOKA MAIN GATE & CAMPUS (Central: X -15, Z -32)
  // =========================================================================
  private buildUnilagCampus(): void {
    const campusGroup = new THREE.Group();
    campusGroup.position.set(-15, 0, -32);

    // 1. Senate Monolith in Background
    const senateGeo = new THREE.BoxGeometry(16, 22, 10);
    const senateMat = new THREE.MeshStandardMaterial({
      color: 0x064e3b, // Deep collegiate UNILAG emerald green
      roughness: 0.35,
      metalness: 0.25,
    });
    const senate = new THREE.Mesh(senateGeo, senateMat);
    senate.position.set(0, 11, -14);
    senate.castShadow = true;
    campusGroup.add(senate);

    // Senate Roof Gold Cap & Finial
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(16.5, 1.2, 10.5),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 })
    );
    cap.position.set(0, 22.6, -14);
    campusGroup.add(cap);

    // 2. Iconic Arched Campus Entrance Gate
    const gateGroup = new THREE.Group();
    gateGroup.position.set(0, 0, 0);

    // Dual Ochre Pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    for (const px of [-6, 6]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7.5, 1.6), pillarMat);
      pillar.position.set(px, 3.75, 0);
      pillar.castShadow = true;
      gateGroup.add(pillar);

      // Gold Pyramid Cap on Pillars
      const pCap = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 1.2, 4),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6 })
      );
      pCap.position.set(px, 8.1, 0);
      pCap.rotation.y = Math.PI / 4;
      gateGroup.add(pCap);
    }

    // Curved Overhead Arch Span
    const archMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.4 });
    const arch = new THREE.Mesh(new THREE.BoxGeometry(13.6, 1.4, 2.0), archMat);
    arch.position.set(0, 7.2, 0);
    gateGroup.add(arch);

    // Signboard across the Arch
    const sign = this.createNamedSignMesh(
      'UNIVERSITY OF LAGOS (UNILAG)',
      'AKOKA CAMPUS GATE • UNIVERSITY OF FIRST CHOICE',
      '#064e3b',
      '#ffffff',
      12.8,
      1.2
    );
    sign.position.set(0, 7.2, 1.1);
    gateGroup.add(sign);

    // Security Gatehouse Guard Booth
    const booth = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 3.0, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    booth.position.set(4.2, 1.5, 2.2);
    gateGroup.add(booth);

    // Security Boom Barrier
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.15, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    barrier.position.set(0, 1.0, 1.2);
    gateGroup.add(barrier);

    // Campus Boulevard Palm Trees
    for (const tx of [-8, 8]) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, 6, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f })
      );
      trunk.position.set(tx, 3, -4);
      gateGroup.add(trunk);

      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(1.8, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 })
      );
      crown.position.set(tx, 6.2, -4);
      gateGroup.add(crown);
    }

    campusGroup.add(gateGroup);
    this.group.add(campusGroup);

    // Register interactive destination object
    this.interactiveList.push({
      mesh: gateGroup,
      id: 'dest_lagos_unilag',
      name: 'University of Lagos (UNILAG)',
      category: 'University & Research Hub',
      description: 'Premier Nigerian federal research university. Enter for faculty lectures, library research, course registration, and campus life.',
      interactionPoint: new THREE.Vector3(-15, 0, -30),
    });

    // Also register alias
    this.interactiveList.push({
      mesh: gateGroup,
      id: 'unilag-campus',
      name: 'University of Lagos (UNILAG)',
      category: 'University & Research Hub',
      description: 'Premier Nigerian federal research university. Enter for faculty lectures, library research, course registration, and campus life.',
      interactionPoint: new THREE.Vector3(-15, 0, -30),
    });
  }

  // =========================================================================
  // 6. SURULERE SPORTS HUB & TESLIM BALOGUN STADIUM (West: X -55, Z +10)
  // =========================================================================
  private buildSurulereStadium(): void {
    const surulereGroup = new THREE.Group();
    surulereGroup.position.set(-55, 0, 10);

    // Stadium Grandstand Canopy
    const standGroup = new THREE.Group();

    const bowlGeo = new THREE.BoxGeometry(24, 7, 16);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4 });
    const bowl = new THREE.Mesh(bowlGeo, bowlMat);
    bowl.position.y = 3.5;
    standGroup.add(bowl);

    // Green and white Nigerian sports canopy
    const canopyGeo = new THREE.BoxGeometry(25, 0.6, 17);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 7.3;
    standGroup.add(canopy);

    // Stadium floodlight pylon towers (4 corners)
    for (const [fx, fz] of [[-13, -9], [13, -9], [-13, 9], [13, 9]]) {
      const pylon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, 16, 8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7 })
      );
      pylon.position.set(fx, 8, fz);
      standGroup.add(pylon);

      const lightGrid = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 1.2, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xfef08a })
      );
      lightGrid.position.set(fx, 16, fz);
      standGroup.add(lightGrid);
    }

    // Red Tartan Running Track Curve
    const trackGeo = new THREE.PlaneGeometry(28, 6);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.set(0, 0.02, 11);
    standGroup.add(track);

    surulereGroup.add(standGroup);

    this.interactiveList.push({
      mesh: standGroup,
      id: 'surulere-stadium',
      name: 'Teslim Balogun Stadium & Sports Arena',
      category: 'Surulere Sports Hub',
      description: 'Iconic sports arena celebrating Lagos sporting legends, AFCON qualifiers, tartan track workouts, and athletics training.',
      interactionPoint: new THREE.Vector3(-55, 0, 15),
    });

    this.group.add(surulereGroup);
  }

  // =========================================================================
  // 7. MURTALA MUHAMMED AIRPORT TERMINAL (North-West: X -80, Z -110)
  // =========================================================================
  private buildAirportTerminal(): void {
    const airportGroup = new THREE.Group();
    airportGroup.position.set(-80, 0, -110);

    const terminalGroup = new THREE.Group();

    // Curved Modern Departure Terminal
    const termGeo = new THREE.BoxGeometry(22, 6.5, 14);
    const termMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.7,
    });
    const term = new THREE.Mesh(termGeo, termMat);
    term.position.y = 3.25;
    terminalGroup.add(term);

    // Blue glass atrium curtain wall
    const glassGeo = new THREE.BoxGeometry(22.2, 4.5, 2.0);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.9,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 3.5, 6.5);
    terminalGroup.add(glass);

    // Control Tower with Rotating Radar
    const towerPole = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.8, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    towerPole.position.set(-14, 7, 0);
    terminalGroup.add(towerPole);

    const towerCab = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 1.8, 2.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.1, metalness: 0.8 })
    );
    towerCab.position.set(-14, 15, 0);
    terminalGroup.add(towerCab);

    // Radar dish
    const radarGeo = new THREE.BoxGeometry(3.2, 0.4, 0.2);
    const radarMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    this.airportRadarMesh = new THREE.Mesh(radarGeo, radarMat);
    this.airportRadarMesh.position.set(-14, 16.6, 0);
    terminalGroup.add(this.airportRadarMesh);

    // High-contrast Airport Departures Signboard
    const airportSign = this.createNamedSignMesh(
      'MURTALA MUHAMMED INTL AIRPORT (LOS)',
      'MMA2 DEPARTURES TERMINAL • DOMESTIC & INTERNATIONAL FLIGHTS',
      '#0f172a',
      '#ffffff',
      18.0,
      1.4
    );
    airportSign.position.set(0, 6.2, 7.6);
    terminalGroup.add(airportSign);

    airportGroup.add(terminalGroup);

    // Register canonical destination and aliases
    this.interactiveList.push({
      mesh: terminalGroup,
      id: 'dest_lagos_airport',
      name: 'Murtala Muhammed International Airport (LOS)',
      category: 'Aviation & Airport',
      description: 'Nigeria’s premier aviation hub. Check in for flights, pass security screening, and fly to Abuja and Port Harcourt.',
      interactionPoint: new THREE.Vector3(-80, 0, -105),
    });

    this.interactiveList.push({
      mesh: terminalGroup,
      id: 'mma-airport',
      name: 'Murtala Muhammed International Airport (LOS)',
      category: 'Aviation & Airport',
      description: 'Nigeria’s premier aviation hub. Check in for flights, pass security screening, and fly to Abuja and Port Harcourt.',
      interactionPoint: new THREE.Vector3(-80, 0, -105),
    });

    this.group.add(airportGroup);
  }

  // =========================================================================
  // 8. AJAH PENINSULA DEVELOPING RESIDENTIAL ESTATE (East: X +90, Z +25)
  // =========================================================================
  private buildAjahDevelopingEstate(): void {
    const ajahGroup = new THREE.Group();
    ajahGroup.position.set(90, 0, 25);

    const estateGroup = new THREE.Group();

    // Developing modern duplex structure with timber rafters
    const houseGeo = new THREE.BoxGeometry(12, 7.5, 12);
    const houseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
    const house = new THREE.Mesh(houseGeo, houseMat);
    house.position.y = 3.75;
    estateGroup.add(house);

    // Exposed red timber trusses on roof
    for (let z = -5; z <= 5; z += 2.5) {
      const truss = new THREE.Mesh(
        new THREE.BoxGeometry(12.4, 0.25, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x92400e })
      );
      truss.position.set(0, 8.2, z);
      estateGroup.add(truss);
    }

    // Concrete Hollow Block stacks
    for (let bx of [-8, -8]) {
      const blockStack = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.8, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95 })
      );
      blockStack.position.set(bx, 0.9, 7);
      estateGroup.add(blockStack);
    }

    // Dangote Cement Bags on pallet
    const cementStack = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.2, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 })
    );
    cementStack.position.set(-5, 0.6, 7.5);
    estateGroup.add(cementStack);

    // Red Construction Sand Mound
    const sandMound = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 1.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 })
    );
    sandMound.position.set(7, 0.8, 7.5);
    estateGroup.add(sandMound);

    ajahGroup.add(estateGroup);

    this.interactiveList.push({
      mesh: estateGroup,
      id: 'ajah-estate',
      name: 'Crown Luxury Estate Construction Site',
      category: 'Ajah Peninsula Developments',
      description: 'Fast-developing luxury duplexes on the Lekki-Epe expressway. Lucrative building artisan gigs and off-plan real estate investment.',
      interactionPoint: new THREE.Vector3(90, 0, 20),
    });

    this.group.add(ajahGroup);
  }

  // =========================================================================
  // 9. MARINA CMS & BALOGUN WHOLESALE FABRIC MARKET (South-Central: X +15, Z +45)
  // =========================================================================
  private buildMarinaBalogunMarket(): void {
    const marinaGroup = new THREE.Group();
    marinaGroup.position.set(15, 0, 45);

    const marketGroup = new THREE.Group();

    // Historic CMS Stone Tower
    const towerGeo = new THREE.BoxGeometry(6, 18, 6);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-10, 9, 0);
    marketGroup.add(tower);

    const steepleGeo = new THREE.ConeGeometry(3.5, 6, 4);
    const steepleMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5 });
    const steeple = new THREE.Mesh(steepleGeo, steepleMat);
    steeple.position.set(-10, 21, 0);
    steeple.rotation.y = Math.PI / 4;
    marketGroup.add(steeple);

    // Vibrant Balogun Market Umbrellas & Fabric Stalls
    const umbrellaColors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6];
    for (let i = 0; i < 4; i++) {
      const px = 2 + (i % 2) * 5;
      const pz = -3 + Math.floor(i / 2) * 6;

      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: umbrellaColors[i], roughness: 0.6 })
      );
      umbrella.position.set(px, 3.2, pz);
      marketGroup.add(umbrella);

      const stallTable = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.2, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
      );
      stallTable.position.set(px, 0.6, pz);
      marketGroup.add(stallTable);

      // Colorful Ankara fabric rolls on table
      const fabric = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.5, 1.2),
        new THREE.MeshStandardMaterial({ color: umbrellaColors[(i + 1) % 4] })
      );
      fabric.position.set(px, 1.45, pz);
      marketGroup.add(fabric);
    }

    marinaGroup.add(marketGroup);

    this.interactiveList.push({
      mesh: marketGroup,
      id: 'balogun-market',
      name: 'CMS Marina & Balogun Wholesale Market',
      category: 'Lagos Island Heritage Trading',
      description: 'Lagos Island’s legendary commercial powerhouse. Wholesale lace, vibrant Dutch Wax Ankara, and high-frequency commerce.',
      interactionPoint: new THREE.Vector3(15, 0, 40),
    });

    this.group.add(marinaGroup);
  }

  // =========================================================================
  // 10. GENERAL HOSPITAL & EMERGENCY CLINIC (East South: X 18, Z 75)
  // =========================================================================
  private buildGeneralHospital(): void {
    const hospGroup = new THREE.Group();
    hospGroup.position.set(18, 0, 75);

    // Multi-story hospital modern medical complex
    const mainGeo = new THREE.BoxGeometry(16, 12, 14);
    const mainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const mainBuilding = new THREE.Mesh(mainGeo, mainMat);
    mainBuilding.position.y = 6;
    mainBuilding.castShadow = true;
    hospGroup.add(mainBuilding);

    // Blue glass clinical windows
    const windowBand = new THREE.Mesh(
      new THREE.BoxGeometry(16.2, 1.8, 14.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.1 })
    );
    windowBand.position.y = 7.5;
    hospGroup.add(windowBand);

    // Red Cross Hospital Emblem on front facade
    const crossGroup = new THREE.Group();
    crossGroup.position.set(-8.15, 8.5, 0);
    crossGroup.rotation.y = -Math.PI / 2;
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    const barH = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 0.1), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    crossGroup.add(barV);
    crossGroup.add(barH);
    hospGroup.add(crossGroup);

    // Entrance Canopy & Red Emergency Driveway
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 })
    );
    canopy.position.set(-6, 3.6, 0);
    hospGroup.add(canopy);

    // High-contrast Hospital Emergency Signboard
    const hospSign = this.createNamedSignMesh(
      'ST. NICHOLAS GENERAL HOSPITAL',
      'ACCIDENT, EMERGENCY & CLINICAL WARDS • 24/7 PHARMACY',
      '#0284c7',
      '#ffffff',
      7.5,
      1.2
    );
    hospSign.position.set(-6, 4.3, 3.1);
    hospGroup.add(hospSign);

    this.group.add(hospGroup);

    this.interactiveList.push({
      mesh: hospGroup,
      id: 'dest_lagos_hospital',
      name: 'St. Nicholas Lagos General Hospital',
      category: 'Healthcare & Emergency',
      description: 'Lagos Island premier medical centre. Enter for doctor consultation, treatments, medical checkups, and pharmacy.',
      interactionPoint: new THREE.Vector3(12, 0, 75),
    });

    this.interactiveList.push({
      mesh: hospGroup,
      id: 'lagos-hospital',
      name: 'St. Nicholas Lagos General Hospital',
      category: 'Healthcare & Emergency',
      description: 'Lagos Island premier medical centre. Enter for doctor consultation, treatments, medical checkups, and pharmacy.',
      interactionPoint: new THREE.Vector3(12, 0, 75),
    });
  }

  // =========================================================================
  // 11. AREA COMMAND POLICE HEADQUARTERS (West South: X -25, Z 65)
  // =========================================================================
  private buildPoliceStation(): void {
    const policeGroup = new THREE.Group();
    policeGroup.position.set(-25, 0, 65);

    // Fortress-style tactical police headquarters
    const stationGeo = new THREE.BoxGeometry(15, 9, 14);
    const stationMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const station = new THREE.Mesh(stationGeo, stationMat);
    station.position.y = 4.5;
    station.castShadow = true;
    policeGroup.add(station);

    // Navy & gold police facade stripes
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 1.2, 14.2),
      new THREE.MeshBasicMaterial({ color: 0x1e3a8a })
    );
    stripe.position.y = 6.2;
    policeGroup.add(stripe);

    // Communication antenna tower on roof
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.15, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
    );
    antenna.position.set(4, 14, -4);
    policeGroup.add(antenna);

    // Blinking red beacon on antenna top
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    beacon.position.set(4, 19, -4);
    policeGroup.add(beacon);

    // Nigeria Police Crest Board
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.2, 3.8),
      new THREE.MeshStandardMaterial({ color: 0x09090b })
    );
    crest.position.set(7.6, 5.5, 0);
    policeGroup.add(crest);

    this.group.add(policeGroup);

    this.interactiveList.push({
      mesh: policeGroup,
      id: 'police-station',
      name: 'Lagos State Area Command Police Station',
      category: 'Law Enforcement & Security',
      description: 'Lagos Command Headquarters. Enter for desk sergeant reports, bail bonds, citizen clearances, and holding cell.',
      interactionPoint: new THREE.Vector3(-18, 0, 65),
    });
  }

  // =========================================================================
  // 12. CONNECTING ROADS & NAIJA LED BILLBOARDS
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

  private createNamedSignMesh(
    title: string,
    sub: string,
    bgColor: string,
    textColor: string,
    width: number,
    height: number
  ): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1024, 256);

    // Decorative contrast border
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 1012, 244);

    // Main Title
    ctx.fillStyle = textColor;
    ctx.font = 'bold 50px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, 512, 108);

    // Subtitle
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = textColor === '#ffffff' ? '#cbd5e1' : '#334155';
    ctx.fillText(sub, 512, 182);

    const texture = createColorCanvasTexture(canvas);
    const boardGeo = new THREE.BoxGeometry(width, height, 0.2);
    const boardMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 });
    return new THREE.Mesh(boardGeo, boardMat);
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

    // Airport radar scanner rotation
    if (this.airportRadarMesh) {
      this.airportRadarMesh.rotation.y += delta * 2.5;
    }
  }
}
