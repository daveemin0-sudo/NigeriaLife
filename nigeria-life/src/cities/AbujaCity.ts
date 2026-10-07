import * as THREE from 'three';
import type { CityInstance } from './CityTypes';
import type { InteractiveObject } from '../world/World';

export class AbujaCity implements CityInstance {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public groundMesh: THREE.Mesh;

  private flagMeshes: THREE.Mesh[] = [];
  private animTime: number = 0;

  constructor() {
    this.group = new THREE.Group();

    // 1. Manicured Capital Ground Terrain (Highland Savanna green)
    const groundGeo = new THREE.PlaneGeometry(320, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f, // Well-watered lush capital lawn
      roughness: 0.85,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    // 2. Shehu Shagari Way (6-Lane Capital Boulevard with Green Median)
    this.buildCapitalBoulevard();

    // 3. Aso Rock Monolith (Iconic geological mountain in backdrop)
    this.buildAsoRock();

    // 4. Abuja National Mosque (Golden Dome & 4 Minarets)
    this.buildNationalMosque();

    // 5. National Christian Centre (Spire & Arches)
    this.buildChristianCentre();

    // 6. Federal Secretariat & Ministry Complex
    this.buildFederalSecretariat();

    // 7. Abuja Green & White Cabs
    this.buildAbujaGreenCabs();

    // 8. Inter-State Travel Terminal to Lagos
    this.buildAbujaTransitHub();
  }

  // =========================================================================
  // 1. CAPITAL BOULEVARD (Shehu Shagari Way)
  // =========================================================================
  private buildCapitalBoulevard(): void {
    const roadGroup = new THREE.Group();

    // Dual carriage asphalt lanes
    const roadWidth = 20;
    const roadLen = 260;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLen);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    roadGroup.add(road);

    // Center median grass island
    const medianGeo = new THREE.BoxGeometry(2.2, 0.35, roadLen);
    const medianMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
    const median = new THREE.Mesh(medianGeo, medianMat);
    median.position.set(0, 0.18, 0);
    roadGroup.add(median);

    // White lane dividers
    for (let laneX of [-5.5, 5.5]) {
      for (let z = -roadLen / 2 + 5; z < roadLen / 2 - 5; z += 8) {
        const lineGeo = new THREE.PlaneGeometry(0.25, 4.0);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(laneX, 0.02, z);
        roadGroup.add(line);
      }
    }

    // Modern Capital Streetlamps with double arched arms
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7 });
    for (let z = -100; z <= 100; z += 30) {
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 10, 12);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(0, 5, z);
      roadGroup.add(pole);

      // Light heads
      for (let armX of [-2.2, 2.2]) {
        const headGeo = new THREE.BoxGeometry(0.8, 0.2, 0.4);
        const head = new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xfffbeb }));
        head.position.set(armX, 9.8, z);
        roadGroup.add(head);
      }
    }

    this.group.add(roadGroup);
  }

  // =========================================================================
  // 2. ASO ROCK MONOLITH (North Geological Monolith: Z -110 to -160)
  // =========================================================================
  private buildAsoRock(): void {
    const rockGroup = new THREE.Group();
    rockGroup.position.set(0, 0, -125);

    // Majestic Granite Main Massif
    const rockGeo = new THREE.DodecahedronGeometry(36, 2);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x785a44, // Ancient ochre-tinted Precambrian granite
      roughness: 0.95,
      flatShading: true,
    });
    const mainRock = new THREE.Mesh(rockGeo, rockMat);
    mainRock.scale.set(3.2, 1.4, 1.6);
    mainRock.position.y = 20;
    mainRock.castShadow = true;
    rockGroup.add(mainRock);

    // Second geological peak
    const peak2 = new THREE.Mesh(rockGeo, rockMat);
    peak2.scale.set(2.2, 1.2, 1.4);
    peak2.position.set(45, 16, 8);
    rockGroup.add(peak2);

    // Third geological peak
    const peak3 = new THREE.Mesh(rockGeo, rockMat);
    peak3.scale.set(2.4, 1.1, 1.3);
    peak3.position.set(-45, 14, 5);
    rockGroup.add(peak3);

    // Aso Rock Lookout Platform in foreground
    const platformGeo = new THREE.BoxGeometry(16, 1.2, 8);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, 0.6, 32);
    rockGroup.add(platform);

    // Plaque & flagpole
    const plaqueGeo = new THREE.BoxGeometry(4, 1.8, 0.3);
    const plaqueMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0, 1.8, 32);
    rockGroup.add(plaque);

    this.group.add(rockGroup);

    this.interactiveList.push({
      mesh: rockGroup,
      id: 'aso-rock-lookout',
      name: 'Aso Rock Monolith & Presidential Valley Lookout',
      category: 'Geological Monument',
      description: 'Iconic 400-meter geological inselberg overlooking the Aso Villa Presidential Complex, National Assembly, and Supreme Court.',
      interactionPoint: new THREE.Vector3(0, 0, -90),
    });
  }

  // =========================================================================
  // 3. ABUJA NATIONAL MOSQUE (Central Golden Dome & 4 Minarets)
  // =========================================================================
  private buildNationalMosque(): void {
    const mosqueGroup = new THREE.Group();
    mosqueGroup.position.set(-28, 0, -25);

    // Main prayer hall cube
    const hallGeo = new THREE.BoxGeometry(18, 12, 18);
    const hallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 });
    const hall = new THREE.Mesh(hallGeo, hallMat);
    hall.position.y = 6;
    hall.castShadow = true;
    mosqueGroup.add(hall);

    // Gleaming central gilded gold dome
    const domeGeo = new THREE.SphereGeometry(7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.85,
      roughness: 0.15,
    });
    const dome = new THREE.Mesh(domeGeo, goldMat);
    dome.position.y = 12;
    mosqueGroup.add(dome);

    // Crescent finial on dome apex
    const finialGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8);
    const finial = new THREE.Mesh(finialGeo, goldMat);
    finial.position.y = 19.8;
    mosqueGroup.add(finial);

    // 4 Soaring Minarets (42 meters high)
    const minaretOffsets = [
      { x: -11, z: -11 },
      { x: 11, z: -11 },
      { x: -11, z: 11 },
      { x: 11, z: 11 },
    ];

    for (let off of minaretOffsets) {
      const minaretTower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.1, 38, 16),
        hallMat
      );
      minaretTower.position.set(off.x, 19, off.z);
      mosqueGroup.add(minaretTower);

      // Gold conical cap
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 4.5, 16),
        goldMat
      );
      cap.position.set(off.x, 40, off.z);
      mosqueGroup.add(cap);
    }

    this.group.add(mosqueGroup);

    this.interactiveList.push({
      mesh: mosqueGroup,
      id: 'abuja-mosque',
      name: 'Abuja National Mosque',
      category: 'National Architectural Landmark',
      description: 'One of the largest religious monuments in Africa. 4 soaring 120-foot minarets and 50-foot gilded gold dome.',
      interactionPoint: new THREE.Vector3(-16, 0, -25),
    });
  }

  // =========================================================================
  // 4. NATIONAL CHRISTIAN CENTRE (Ecumenical Centre)
  // =========================================================================
  private buildChristianCentre(): void {
    const centreGroup = new THREE.Group();
    centreGroup.position.set(28, 0, -25);

    // Main nave basilica block
    const naveGeo = new THREE.BoxGeometry(16, 14, 22);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
    const nave = new THREE.Mesh(naveGeo, stoneMat);
    nave.position.y = 7;
    nave.castShadow = true;
    centreGroup.add(nave);

    // Neo-Gothic Central Spire
    const spireGeo = new THREE.ConeGeometry(4.5, 26, 4);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.3 });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = 27;
    spire.rotation.y = Math.PI / 4;
    centreGroup.add(spire);

    // Stained glass rose window
    const windowGeo = new THREE.CircleGeometry(3.2, 24);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const roseWindow = new THREE.Mesh(windowGeo, windowMat);
    roseWindow.position.set(-8.05, 11, 0);
    roseWindow.rotation.y = -Math.PI / 2;
    centreGroup.add(roseWindow);

    this.group.add(centreGroup);

    this.interactiveList.push({
      mesh: centreGroup,
      id: 'abuja-christian-centre',
      name: 'National Christian Centre (Ecumenical Centre)',
      category: 'National Architectural Landmark',
      description: 'Cathedral of national unity designed with neo-gothic granite arches, soaring spire, and grand pipe organ.',
      interactionPoint: new THREE.Vector3(16, 0, -25),
    });
  }

  // =========================================================================
  // 5. FEDERAL SECRETARIAT & MINISTRIES COMPLEX
  // =========================================================================
  private buildFederalSecretariat(): void {
    const secGroup = new THREE.Group();
    secGroup.position.set(-28, 0, 32);

    // Central government administrative block
    const blockGeo = new THREE.BoxGeometry(22, 10, 16);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.position.y = 5;
    block.castShadow = true;
    secGroup.add(block);

    // Tinted green glass office bands
    for (let floorY of [3.5, 6.5]) {
      const glassGeo = new THREE.BoxGeometry(22.2, 1.4, 16.2);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x065f46,
        roughness: 0.1,
        metalness: 0.8,
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = floorY;
      secGroup.add(glass);
    }

    // Flagpole with Nigerian Green-White-Green flag
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8 })
    );
    pole.position.set(13, 4.5, 0);
    secGroup.add(pole);

    const flagGeo = new THREE.PlaneGeometry(2.4, 1.5, 8, 4);
    const flagMat = new THREE.MeshBasicMaterial({ color: 0x008751, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(14.2, 8.2, 0);
    this.flagMeshes.push(flag);
    secGroup.add(flag);

    this.group.add(secGroup);

    this.interactiveList.push({
      mesh: secGroup,
      id: 'abuja-secretariat',
      name: 'Federal Secretariat Complex (Three Arms Zone)',
      category: 'Federal Government Seat',
      description: 'Headquarters of Federal Ministries, Civil Service Commission, and federal procurement & contract offices.',
      interactionPoint: new THREE.Vector3(-14, 0, 32),
    });
  }

  // =========================================================================
  // 6. ABUJA GREEN & WHITE CAPITAL TAXIS
  // =========================================================================
  private buildAbujaGreenCabs(): void {
    const cabGroup = new THREE.Group();
    cabGroup.position.set(14, 0, 8);
    cabGroup.rotation.y = -Math.PI / 2;

    // Green cab body
    const bodyGeo = new THREE.BoxGeometry(2.1, 1.2, 4.5);
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.35 });
    const body = new THREE.Mesh(bodyGeo, greenMat);
    body.position.y = 0.85;
    cabGroup.add(body);

    // Twin white horizontal belt stripes
    const stripeGeo = new THREE.BoxGeometry(2.12, 0.28, 4.52);
    const stripe = new THREE.Mesh(stripeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.85;
    cabGroup.add(stripe);

    // Roof taxi box
    const signGeo = new THREE.BoxGeometry(0.7, 0.22, 0.35);
    const sign = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    sign.position.set(0, 1.55, 0);
    cabGroup.add(sign);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
    for (let wx of [-1.08, 1.08]) {
      for (let wz of [-1.4, 1.4]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.38, wz);
        cabGroup.add(wheel);
      }
    }

    this.group.add(cabGroup);

    this.interactiveList.push({
      mesh: cabGroup,
      id: 'abuja-cab',
      name: 'Abuja Federal Green Cab',
      category: 'Capital Transportation',
      description: 'Official Federal Capital Territory green & white taxi. Smooth express cruising through Wuse 2, Garki, and Maitama.',
      interactionPoint: new THREE.Vector3(14, 0, 12),
    });
  }

  // =========================================================================
  // 7. ABUJA INTERSTATE TRANSIT TERMINAL (Airport & Coach to Lagos)
  // =========================================================================
  private buildAbujaTransitHub(): void {
    const hubGroup = new THREE.Group();
    hubGroup.position.set(28, 0, 36);

    const terminalGeo = new THREE.BoxGeometry(16, 5, 12);
    const terminalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const terminal = new THREE.Mesh(terminalGeo, terminalMat);
    terminal.position.y = 2.5;
    hubGroup.add(terminal);

    // Flight & Bus indicator canopy
    const canopyGeo = new THREE.BoxGeometry(16.4, 0.6, 12.4);
    const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshBasicMaterial({ color: 0x0284c7 }));
    canopy.position.y = 5.2;
    hubGroup.add(canopy);

    this.group.add(hubGroup);

    this.interactiveList.push({
      mesh: hubGroup,
      id: 'abuja-interstate-hub',
      name: 'Nnamdi Azikiwe Airport & Utako Transit Lounge',
      category: 'Inter-State Travel',
      description: 'Direct flight connections and luxury interstate express buses to Lagos Island and Nigerian states.',
      interactionPoint: new THREE.Vector3(18, 0, 36),
    });
  }

  public update(delta: number): void {
    this.animTime += delta;

    // Flutter Nigerian flags in capital breeze
    for (let flag of this.flagMeshes) {
      flag.rotation.y = Math.sin(this.animTime * 4.5) * 0.15;
    }
  }

  public dispose(): void {
    // Clear references
    this.flagMeshes = [];
    this.interactiveList = [];
  }
}
