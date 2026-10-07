import * as THREE from 'three';
import type { InteractiveObject } from './World';

export class ApartmentInterior {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];

  // Animated elements
  private fanBlades: THREE.Mesh[] = [];
  private fanHeads: THREE.Group[] = [];
  private petMesh: THREE.Group | null = null;
  private tvScreen: THREE.Mesh | null = null;
  private animTime: number = 0;

  constructor() {
    this.group = new THREE.Group();
    // Position the apartment in a secluded coordinate area
    this.group.position.set(0, 0, 180);

    // 1. Apartment Floor Base & Rooms
    this.buildFloorsAndWalls();

    // 2. Living Room Furniture (Sofas, Table, TV, Fan)
    this.buildLivingRoom();

    // 3. Master Bedroom (Purple Bed, Curtains, Fan)
    this.buildMasterBedroom();

    // 4. Second Bedroom (Blue Bed, Study Desk)
    this.buildSecondBedroom();

    // 5. Bathroom (Tub, Glass Shower, Blue Water Drum & Red Bucket!)
    this.buildBathroom();

    // 6. Cute Pet Dog / Cat
    this.buildPet();
  }

  // =========================================================================
  // 1. APARTMENT BASE, TILE FLOORS & CUTAWAY WALLS
  // =========================================================================
  private buildFloorsAndWalls(): void {
    // Large cutaway floor (tiled ceramic)
    const floorGeo = new THREE.BoxGeometry(26, 0.4, 22);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Dark grey apartment boundary walls (low cutaway height so camera can see inside)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    const wallHeight = 4.2;
    const wallThick = 0.4;

    // Back wall (Z -11)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(26, wallHeight, wallThick), wallMat);
    backWall.position.set(0, wallHeight / 2, -11);
    this.group.add(backWall);

    // Left wall (X -13)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 22), wallMat);
    leftWall.position.set(-13, wallHeight / 2, 0);
    this.group.add(leftWall);

    // Right wall (X 13)
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 22), wallMat);
    rightWall.position.set(13, wallHeight / 2, 0);
    this.group.add(rightWall);

    // Interior dividing walls
    // Divider 1: Separates Bedrooms (top) from Living Room (bottom)
    const divider1 = new THREE.Mesh(new THREE.BoxGeometry(26, wallHeight, wallThick), wallMat);
    divider1.position.set(0, wallHeight / 2, 0);
    this.group.add(divider1);

    // Divider 2: Separates Master Bedroom (right) from Second Bedroom (left)
    const divider2 = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 11), wallMat);
    divider2.position.set(1, wallHeight / 2, -5.5);
    this.group.add(divider2);

    // Divider 3: Bathroom wall in living area (bottom right)
    const divider3 = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, 11), wallMat);
    divider3.position.set(4, wallHeight / 2, 5.5);
    this.group.add(divider3);
  }

  // =========================================================================
  // 2. LIVING ROOM (Green/Black Sofas, TV Console, Dining Set)
  // =========================================================================
  private buildLivingRoom(): void {
    const livingGroup = new THREE.Group();

    // Emerald Green 3-Seater Sofa
    const sofaGeo = new THREE.BoxGeometry(4.8, 1.2, 1.8);
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.7 });
    const sofa = new THREE.Mesh(sofaGeo, sofaMat);
    sofa.position.set(-2, 0.6, 6);
    livingGroup.add(sofa);

    // Black Leather 2-Seater Sofa
    const sofa2Geo = new THREE.BoxGeometry(1.8, 1.2, 3.2);
    const sofa2Mat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });
    const sofa2 = new THREE.Mesh(sofa2Geo, sofa2Mat);
    sofa2.position.set(-6.5, 0.6, 2.5);
    livingGroup.add(sofa2);

    // Round Wooden Dining Table with Chairs
    const tableGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.15, 20);
    const tableMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(-9.5, 1.2, 7.5);
    livingGroup.add(table);

    const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 8);
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(-9.5, 0.6, 7.5);
    livingGroup.add(leg);

    // Giant Wall-Mounted Flat-Screen TV
    const tvUnitGeo = new THREE.BoxGeometry(0.2, 3.2, 6.5);
    const tvUnitMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const tvUnit = new THREE.Mesh(tvUnitGeo, tvUnitMat);
    tvUnit.position.set(-12.8, 2.4, 3);
    livingGroup.add(tvUnit);

    // Glowing TV Screen showing Super Eagles Match
    const screenGeo = new THREE.PlaneGeometry(6.2, 2.8);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x15803d }); // Green football pitch
    this.tvScreen = new THREE.Mesh(screenGeo, screenMat);
    this.tvScreen.rotation.y = Math.PI / 2;
    this.tvScreen.position.set(-12.65, 2.4, 3);
    livingGroup.add(this.tvScreen);

    // PS5 / Xbox Console on media cabinet
    const consoleGeo = new THREE.BoxGeometry(0.4, 0.15, 0.7);
    const consoleMesh = new THREE.Mesh(consoleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    consoleMesh.position.set(-12.5, 0.7, 1);
    livingGroup.add(consoleMesh);

    // Standing Oscillating Fan (Nigerian Household Essential)
    const fan = this.createStandingFan(-1, 0, 2);
    livingGroup.add(fan);

    this.group.add(livingGroup);

    this.interactiveList.push({
      mesh: tvUnit,
      id: 'flat-tv',
      name: '75-Inch Smart TV & Soundbar',
      category: 'Home Entertainment',
      description: 'Live Super Eagles vs Ghana match streaming in 4K with pulsating stadium roar. Tap to cheer & dance!',
      interactionPoint: new THREE.Vector3(-10, 0, 183),
    });

    this.interactiveList.push({
      mesh: sofa,
      id: 'flat-sofa',
      name: 'Emerald Velvet Sectional Sofa',
      category: 'Home Living',
      description: 'Deep, plush Lagos luxury sofa. Kick back, sip chilled Chapman, and browse social media.',
      interactionPoint: new THREE.Vector3(-2, 0, 186),
    });
  }

  // =========================================================================
  // 3. MASTER BEDROOM (Purple Luxury Bed, Blinds, Wardrobe)
  // =========================================================================
  private buildMasterBedroom(): void {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(7.5, 0, -5.5);

    // King-Size Bed Frame
    const bedFrame = new THREE.Mesh(
      new THREE.BoxGeometry(4.5, 0.8, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    bedFrame.position.y = 0.4;
    bedGroup.add(bedFrame);

    // Purple Royal Duvet (From Screenshot 1)
    const mattress = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.5, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.7 })
    );
    mattress.position.set(0, 0.9, -0.1);
    bedGroup.add(mattress);

    // White Pillows
    for (let px of [-1.2, 1.2]) {
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.25, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
      );
      pillow.position.set(px, 1.2, -1.9);
      bedGroup.add(pillow);
    }

    // Bedroom window with yellow curtains (Screenshot 1)
    const curtainGeo = new THREE.BoxGeometry(0.2, 2.8, 2.2);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(5.3, 2.6, 0);
    bedGroup.add(curtain);

    // Master Bedroom Standing Fan
    const fan = this.createStandingFan(3.5, 0, 3.5);
    bedGroup.add(fan);

    this.group.add(bedGroup);

    this.interactiveList.push({
      mesh: bedGroup,
      id: 'flat-bed',
      name: 'King-Size Royal Master Bed',
      category: 'Rest & Recovery',
      description: 'Rest on memory foam mattress with AC blowing. Restores 100% Energy and sets mood to "Very Happy"!',
      interactionPoint: new THREE.Vector3(7.5, 0, 174.5),
    });
  }

  // =========================================================================
  // 4. SECOND BEDROOM (Blue Bed & Study Desk)
  // =========================================================================
  private buildSecondBedroom(): void {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(-6.5, 0, -5.5);

    // Blue Bed (Screenshot 1)
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.8, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 })
    );
    bed.position.y = 0.4;
    bedGroup.add(bed);

    // Study Desk & Lamp
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
    );
    desk.position.set(-4, 0.6, -1);
    bedGroup.add(desk);

    this.group.add(bedGroup);
  }

  // =========================================================================
  // 5. BATHROOM (Tub, Glass Shower, Iconic Blue Water Drum & Red Bucket)
  // =========================================================================
  private buildBathroom(): void {
    const bathGroup = new THREE.Group();
    bathGroup.position.set(8.5, 0, 5.5);

    // White ceramic bathtub
    const tubGeo = new THREE.BoxGeometry(2.2, 1.1, 4.2);
    const tubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const tub = new THREE.Mesh(tubGeo, tubMat);
    tub.position.set(-2, 0.55, 1.5);
    bathGroup.add(tub);

    // Modern glass shower cubicle
    const showerGeo = new THREE.BoxGeometry(2.4, 3.2, 2.4);
    const showerMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.1,
      transparent: true,
      opacity: 0.45,
    });
    const shower = new THREE.Mesh(showerGeo, showerMat);
    shower.position.set(2.2, 1.6, 2.4);
    bathGroup.add(shower);

    // THE ICONIC NIGERIAN BLUE WATER DRUM (From Screenshot 1!)
    const drumGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.8, 16);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(0.2, 0.9, -2.8);
    drum.castShadow = true;
    bathGroup.add(drum);

    // Red plastic water bucket with handle
    const bucketGeo = new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16);
    const bucketMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 });
    const bucket = new THREE.Mesh(bucketGeo, bucketMat);
    bucket.position.set(1.4, 0.4, -2.6);
    bathGroup.add(bucket);

    // Small yellow plastic dipper
    const dipperGeo = new THREE.CylinderGeometry(0.2, 0.16, 0.3, 12);
    const dipperMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const dipper = new THREE.Mesh(dipperGeo, dipperMat);
    dipper.position.set(0.6, 0.95, -2.2);
    bathGroup.add(dipper);

    this.group.add(bathGroup);

    this.interactiveList.push({
      mesh: drum,
      id: 'flat-drum',
      name: 'Nigerian Blue Plastic Water Drum & Red Bucket',
      category: 'Home Essentials',
      description: 'The undefeated symbol of Nigerian domestic resilience! Filled with chilled borehole water. Fetch water & bath (Restores 100% Hygiene)!',
      interactionPoint: new THREE.Vector3(8.5, 0, 183),
    });
  }

  // =========================================================================
  // 6. STANDING OSCILLATING FAN BUILDER
  // =========================================================================
  private createStandingFan(x: number, y: number, z: number): THREE.Group {
    const fanGroup = new THREE.Group();
    fanGroup.position.set(x, y, z);

    // Base plate
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    fanGroup.add(base);

    // Telescopic pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x71717a, metalness: 0.8 })
    );
    pole.position.y = 1.1;
    fanGroup.add(pole);

    // Motor head & cage
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.2, 0);

    const cage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 0.15, 16),
      new THREE.MeshStandardMaterial({ color: 0x18181b, wireframe: true })
    );
    cage.rotation.x = Math.PI / 2;
    headGroup.add(cage);

    // Rotating 3-Blade Rotor
    const blades = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.1, 0.02),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    headGroup.add(blades);

    this.fanBlades.push(blades);
    this.fanHeads.push(headGroup);
    fanGroup.add(headGroup);

    return fanGroup;
  }

  // =========================================================================
  // 7. PET DOG / CAT
  // =========================================================================
  private buildPet(): void {
    this.petMesh = new THREE.Group();
    this.petMesh.position.set(-4, 0, 4);

    // Dog body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.45, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 })
    );
    body.position.y = 0.45;
    this.petMesh.add(body);

    // Head & Snout
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.35, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46 })
    );
    head.position.set(0, 0.7, 0.5);
    this.petMesh.add(head);

    // Wagging tail
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.3, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x52525b })
    );
    tail.position.set(0, 0.6, -0.45);
    tail.rotation.x = -0.5;
    this.petMesh.add(tail);

    this.group.add(this.petMesh);

    this.interactiveList.push({
      mesh: this.petMesh,
      id: 'flat-pet',
      name: 'Bingo the House Dog',
      category: 'Pet Companion',
      description: 'Faithful Nigerian companion dog. Pet him for an instant happiness boost!',
      interactionPoint: new THREE.Vector3(-4, 0, 184),
    });
  }

  // =========================================================================
  // UPDATE LOOP (Fan oscillation, screen flicker, pet tail wagging)
  // =========================================================================
  public update(delta: number): void {
    this.animTime += delta;

    // Fast blade rotation
    for (const blade of this.fanBlades) {
      blade.rotation.z += delta * 24;
    }

    // Gentle head oscillation
    for (const head of this.fanHeads) {
      head.rotation.y = Math.sin(this.animTime * 1.5) * 0.7;
    }

    // TV Screen subtle dynamic match glow
    if (this.tvScreen) {
      const g = 0.5 + Math.sin(this.animTime * 6) * 0.15;
      (this.tvScreen.material as THREE.MeshBasicMaterial).color.setRGB(0.1, g, 0.2);
    }

    // Pet tail wag
    if (this.petMesh) {
      this.petMesh.rotation.y = Math.sin(this.animTime * 0.8) * 0.3;
    }
  }
}
