import * as THREE from 'three';
import { MaterialLibrary } from '../materials/MaterialLibrary';
import { SignageLibrary } from '../materials/SignageLibrary';
import { isInJunctionGap, splitAroundJunctions } from './density/StreetLayout';

export class Roads {
  public group: THREE.Group;
  public roadLength: number = 240;
  public roadWidth: number = 14;
  public asphaltMat!: THREE.MeshStandardMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.buildRoadNetwork();
    this.buildStreetLights();
    this.buildPowerPoles();
    this.buildGuttersAndStreetProps();
    this.buildPedestrianOverheadBridge();
  }

  private buildRoadNetwork(): void {
    const mats = MaterialLibrary.getInstance();

    // 1. Asphalt Main Highway (Lagos Broad Street - Cracked Aggregate PBR)
    const asphaltGeo = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
    this.asphaltMat = mats.asphaltMaterial;
    const asphalt = new THREE.Mesh(asphaltGeo, this.asphaltMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.y = 0.01;
    asphalt.receiveShadow = true;
    this.group.add(asphalt);

    // 2. Yellow Double Center Dividing Line
    const dashMatrices: THREE.Matrix4[] = [];
    for (let offset of [-0.2, 0.2]) {
      for (let z = -this.roadLength / 2 + 5; z < this.roadLength / 2 - 5; z += 6) {
        dashMatrices.push(new THREE.Matrix4().makeTranslation(offset, 0.02, z));
      }
    }
    this.addInstanced(new THREE.PlaneGeometry(0.2, 3.8).rotateX(-Math.PI / 2), mats.roadLineMaterial, dashMatrices);

    // 3. White Zebra Crosswalk near the main junction
    for (let x = -5.5; x <= 5.5; x += 1.2) {
      const stripeGeo = new THREE.PlaneGeometry(0.7, 4.5);
      const stripe = new THREE.Mesh(stripeGeo, mats.crosswalkMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.02, 10);
      this.group.add(stripe);
    }

    // 4. Sidewalks / Pavements with concrete slab bump map
    const walkWidth = 6.5;
    // Sidewalks open up wherever a side street joins Broad Street
    for (const [zFrom, zTo] of splitAroundJunctions(-this.roadLength / 2, this.roadLength / 2)) {
      const walkGeo = new THREE.BoxGeometry(walkWidth, 0.28, zTo - zFrom);
      for (const side of [-1, 1]) {
        const walkway = new THREE.Mesh(walkGeo, mats.sidewalkMaterial);
        walkway.position.set(side * (this.roadWidth / 2 + walkWidth / 2), 0.14, (zFrom + zTo) / 2);
        walkway.receiveShadow = true;
        this.group.add(walkway);
      }
    }

    // 5. Classic Nigerian Yellow & Black Kerb Stones (Cached PBR materials)
    const curbHeight = 0.32;
    const curbWidth = 0.28;
    const segmentLen = 2.0;

    // Hundreds of kerb stones drawn as two instanced meshes (one per colour)
    const yellowKerbs: THREE.Matrix4[] = [];
    const blackKerbs: THREE.Matrix4[] = [];
    for (let z = -this.roadLength / 2; z < this.roadLength / 2; z += segmentLen) {
      if (isInJunctionGap(z + segmentLen / 2)) continue;
      const isYellow = Math.floor(z / segmentLen) % 2 === 0;
      const list = isYellow ? yellowKerbs : blackKerbs;
      for (const side of [-1, 1]) {
        list.push(new THREE.Matrix4().makeTranslation((side * this.roadWidth) / 2, curbHeight / 2, z + segmentLen / 2));
      }
    }
    const kerbGeo = new THREE.BoxGeometry(curbWidth, curbHeight, segmentLen - 0.05);
    this.addInstanced(kerbGeo, mats.curbYellowMaterial, yellowKerbs);
    this.addInstanced(kerbGeo, mats.curbBlackMaterial, blackKerbs);
  }

  private addInstanced(geo: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[]): void {
    if (matrices.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  public streetBulbMaterials: THREE.MeshStandardMaterial[] = [];
  public streetPointLights: THREE.PointLight[] = [];

  private buildStreetLights(): void {
    // Street lamps on alternating sides every 24 meters
    const lampX = 7.5;
    const mats = MaterialLibrary.getInstance();

    for (let z = -80; z <= 80; z += 24) {
      const poleSide = (z / 24) % 2 === 0 ? 1 : -1;
      const lampGroup = new THREE.Group();
      lampGroup.position.set(poleSide * lampX, 0, z);

      // Steel pole base flange & inspection door
      const baseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.7, 8);
      const baseMesh = new THREE.Mesh(baseGeo, mats.ironRailingMaterial);
      baseMesh.position.y = 0.35;
      baseMesh.castShadow = true;
      lampGroup.add(baseMesh);

      // Tapered Steel pole mast
      const poleGeo = new THREE.CylinderGeometry(0.09, 0.16, 6.2, 8);
      const pole = new THREE.Mesh(poleGeo, mats.ironRailingMaterial);
      pole.position.y = 3.4;
      pole.castShadow = true;
      pole.receiveShadow = true;
      lampGroup.add(pole);

      // Gracefully curved cobra-head mast arm reaching over the road
      const armGeo = new THREE.BoxGeometry(1.8, 0.08, 0.08);
      const arm = new THREE.Mesh(armGeo, mats.ironRailingMaterial);
      arm.position.set(-poleSide * 0.8, 6.45, 0);
      arm.rotation.z = poleSide * 0.08;
      arm.castShadow = true;
      lampGroup.add(arm);

      // Aerodynamic Luminaire Housing
      const headGeo = new THREE.BoxGeometry(0.65, 0.14, 0.3);
      const head = new THREE.Mesh(headGeo, mats.ironRailingMaterial);
      head.position.set(-poleSide * 1.55, 6.35, 0);
      head.castShadow = true;
      lampGroup.add(head);

      // Warm LED Luminaire Diffuser Lens with dynamic glow
      const bulbGeo = new THREE.BoxGeometry(0.55, 0.04, 0.22);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfffaed,
        emissive: 0xffedd5,
        emissiveIntensity: 0.15,
        roughness: 0.2,
      });
      this.streetBulbMaterials.push(bulbMat);

      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-poleSide * 1.55, 6.28, 0);
      lampGroup.add(bulb);

      // Night downward sodium / warm LED street light pool
      const lampLight = new THREE.PointLight(0xffedd5, 0, 16, 1.8);
      lampLight.position.set(-poleSide * 1.55, 6.1, 0);
      this.streetPointLights.push(lampLight);
      lampGroup.add(lampLight);

      this.group.add(lampGroup);
    }
  }

  public setNightLighting(period: string): void {
    const isNight = period === 'night';
    const isGolden = period === 'golden_hour';

    for (const mat of this.streetBulbMaterials) {
      if (isNight) {
        mat.emissive.setHex(0xfff1d6);
        mat.emissiveIntensity = 2.4;
      } else if (isGolden) {
        mat.emissive.setHex(0xffc570);
        mat.emissiveIntensity = 1.1;
      } else {
        mat.emissive.setHex(0xffedd5);
        mat.emissiveIntensity = 0.15;
      }
    }

    for (const light of this.streetPointLights) {
      if (isNight) {
        light.intensity = 1.8;
      } else if (isGolden) {
        light.intensity = 0.7;
      } else {
        light.intensity = 0.0;
      }
      // A switched-off lamp must not stay in the shader's light loop all day
      light.visible = light.intensity > 0;
    }
  }

  private buildPowerPoles(): void {
    const mats = MaterialLibrary.getInstance();
    const poleX = -13.0;
    const poleZPositions = [-70, -35, 0, 35, 70];

    // High tension wire offsets on the crossbar
    const wireOffsets = [-1.15, 0, 1.15];
    const wireY = 8.4;

    for (let i = 0; i < poleZPositions.length; i++) {
      const z = poleZPositions[i];
      const poleGroup = new THREE.Group();
      poleGroup.position.set(poleX, 0, z);

      // Heavy weathered concrete utility pole
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.26, 9.2, 8);
      const pole = new THREE.Mesh(poleGeo, mats.concreteTrimMaterial);
      pole.position.y = 4.6;
      pole.castShadow = true;
      pole.receiveShadow = true;
      poleGroup.add(pole);

      // Heavy horizontal utility cross-bar
      const barGeo = new THREE.BoxGeometry(2.9, 0.2, 0.14);
      const bar = new THREE.Mesh(barGeo, mats.ironRailingMaterial);
      bar.position.set(0, wireY - 0.2, 0);
      bar.castShadow = true;
      poleGroup.add(bar);

      // Ceramic high-voltage insulators
      for (const offset of wireOffsets) {
        const insGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.32, 8);
        const insMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.3,
          metalness: 0.6,
        });
        const ins = new THREE.Mesh(insGeo, insMat);
        ins.position.set(offset, wireY, 0);
        ins.castShadow = true;
        poleGroup.add(ins);
      }

      // Authentic Lagos Step-Down Transformer mounted on the center pole (z = 0)
      if (z === 0) {
        const transGroup = new THREE.Group();
        transGroup.position.set(0, 5.2, 0.5);

        // Heavy steel mounting beam cradle
        const mountGeo = new THREE.BoxGeometry(1.6, 0.18, 0.9);
        const mount = new THREE.Mesh(mountGeo, mats.ironRailingMaterial);
        mount.castShadow = true;
        transGroup.add(mount);

        // Cylindrical transformer canister (industrial olive-grey)
        const canGeo = new THREE.CylinderGeometry(0.45, 0.45, 1.4, 16);
        const canMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.5,
          metalness: 0.7,
        });
        const canister = new THREE.Mesh(canGeo, canMat);
        canister.position.y = 0.8;
        canister.castShadow = true;
        canister.receiveShadow = true;
        transGroup.add(canister);

        // Cooling radiator ribs
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          const finGeo = new THREE.BoxGeometry(0.04, 1.1, 0.2);
          const fin = new THREE.Mesh(finGeo, mats.ironRailingMaterial);
          fin.position.set(Math.cos(a) * 0.48, 0.8, Math.sin(a) * 0.48);
          fin.rotation.y = a;
          transGroup.add(fin);
        }

        // Top high-voltage bushings
        for (let bx of [-0.2, 0, 0.2]) {
          const bushGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.3, 8);
          const bushing = new THREE.Mesh(bushGeo, mats.ironRailingMaterial);
          bushing.position.set(bx, 1.6, 0);
          transGroup.add(bushing);
        }

        // Yellow "DANGER - 11,000 VOLTS" warning plate
        const warnGeo = new THREE.BoxGeometry(0.4, 0.25, 0.02);
        const warnMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          roughness: 0.4,
        });
        const warn = new THREE.Mesh(warnGeo, warnMat);
        warn.position.set(0, 0.8, 0.47);
        transGroup.add(warn);

        poleGroup.add(transGroup);
      }

      this.group.add(poleGroup);
    }

    // Overhead high tension electric wires with realistic SAG (Catenary curve)
    const cableMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.1,
    });

    for (let i = 0; i < poleZPositions.length - 1; i++) {
      const z1 = poleZPositions[i];
      const z2 = poleZPositions[i + 1];
      const midZ = (z1 + z2) / 2;

      for (const offset of wireOffsets) {
        // Natural catenary sag of ~0.65m at midpoint
        const sag = 0.65;
        const p1 = new THREE.Vector3(poleX + offset, wireY + 0.12, z1);
        const pMid = new THREE.Vector3(poleX + offset, wireY + 0.12 - sag, midZ);
        const p2 = new THREE.Vector3(poleX + offset, wireY + 0.12, z2);

        const curve = new THREE.QuadraticBezierCurve3(p1, pMid, p2);
        const cableGeo = new THREE.TubeGeometry(curve, 18, 0.016, 4, false);
        const cableMesh = new THREE.Mesh(cableGeo, cableMat);
        cableMesh.castShadow = true;
        this.group.add(cableMesh);
      }
    }
  }

  // =========================================================================
  // 4. DRAINAGE GUTTERS, SPEED BUMPS & STREET CLUTTER
  // =========================================================================
  private buildGuttersAndStreetProps(): void {
    const mats = MaterialLibrary.getInstance();

    // A. Concrete Drainage Channels (Open Gutters flanking the road)
    const gutterMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
    });
    const culvertMat = mats.concreteTrimMaterial;

    for (const side of [-1, 1]) {
      const gx = side * (this.roadWidth / 2 + 0.4);

      // Deep gutter trough
      for (const [zFrom, zTo] of splitAroundJunctions(-this.roadLength / 2, this.roadLength / 2)) {
        const troughGeo = new THREE.BoxGeometry(0.7, 0.45, zTo - zFrom);
        const trough = new THREE.Mesh(troughGeo, gutterMat);
        trough.position.set(gx, -0.08, (zFrom + zTo) / 2);
        trough.receiveShadow = true;
        this.group.add(trough);
      }

      // Concrete Culvert Bridges (Planks across gutters for pedestrians to enter shops)
      for (let z = -90; z <= 90; z += 15) {
        if (isInJunctionGap(z)) continue;
        const slabGeo = new THREE.BoxGeometry(0.85, 0.1, 2.4);
        const slab = new THREE.Mesh(slabGeo, culvertMat);
        slab.position.set(gx, 0.16, z);
        slab.castShadow = true;
        slab.receiveShadow = true;
        this.group.add(slab);
      }
    }

    // B. Asphalt Speed Bumps (Classic Lagos road bumps with black/yellow caution stripes)
    const bumpZPositions = [-35, 25, 85];
    const bumpMat = new THREE.MeshStandardMaterial({
      color: 0x33373d,
      roughness: 0.88,
    });

    for (const bz of bumpZPositions) {
      const bumpGeo = new THREE.CylinderGeometry(0.65, 0.65, this.roadWidth - 0.4, 16, 1, false, 0, Math.PI);
      const bump = new THREE.Mesh(bumpGeo, bumpMat);
      bump.rotation.z = Math.PI / 2;
      bump.rotation.y = Math.PI / 2;
      bump.position.set(0, 0.08, bz);
      bump.receiveShadow = true;
      this.group.add(bump);

      // Yellow chevron warning stripes on speed bump
      for (let x = -5.5; x <= 5.5; x += 1.8) {
        const stripeGeo = new THREE.PlaneGeometry(0.35, 1.1);
        const stripeMat = mats.roadLineMaterial;
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(x, 0.17, bz);
        this.group.add(stripe);
      }
    }

    // C. Roadside Vendor Umbrellas & Display Tables (Lagos Living Street Culture)
    const umbrellaThemes = [
      { color: 0xdc2626, label: 'NAIJAPAY / KUDIPOINT POS', item: 'pos' },
      { color: 0x0d9488, label: 'COLD DRINKS & MALT', item: 'drinks' },
      { color: 0xf59e0b, label: 'FRESH FRUITS & SNACKS', item: 'fruits' },
      { color: 0x16a34a, label: 'RECHARGE CARDS & DATA', item: 'cards' },
      { color: 0x2563eb, label: 'MAMA SHADE COLD WATER', item: 'water' },
      { color: 0x9333ea, label: 'SUNGLASSES & ACCESSORIES', item: 'shades' },
    ];

    const stallZPositions = [-78, -52, -22, 12, 44, 72, 98];

    stallZPositions.forEach((sz, idx) => {
      const side = idx % 2 === 0 ? -1 : 1;
      const sx = side * (this.roadWidth / 2 + 3.2);
      const theme = umbrellaThemes[idx % umbrellaThemes.length];

      const stallGroup = new THREE.Group();
      stallGroup.position.set(sx, 0.28, sz);

      // 1. Umbrella pole (powder-coated metallic tube)
      const poleGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.7, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.35;
      pole.castShadow = true;
      stallGroup.add(pole);

      // 2. Wide octagonal parasol umbrella canopy
      const canopyGeo = new THREE.ConeGeometry(1.9, 0.75, 8);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: theme.color,
        roughness: 0.65,
        flatShading: true,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.y = 2.6;
      canopy.castShadow = true;
      stallGroup.add(canopy);

      // Scalloped valance trim around umbrella rim
      const rimGeo = new THREE.CylinderGeometry(1.92, 1.92, 0.14, 8, 1, true);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = 2.22;
      stallGroup.add(rim);

      // 3. Wooden market display table
      const tableGeo = new THREE.BoxGeometry(1.6, 0.8, 1.0);
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const table = new THREE.Mesh(tableGeo, tableMat);
      table.position.set(0, 0.4, 0.35);
      table.castShadow = true;
      table.receiveShadow = true;
      stallGroup.add(table);

      // 4. Foam icebox / drinks cooler (Coleman red or blue)
      const coolerGeo = new THREE.BoxGeometry(0.65, 0.45, 0.45);
      const coolerColor = idx % 2 === 0 ? 0xdc2626 : 0x0284c7;
      const coolerMat = new THREE.MeshStandardMaterial({ color: coolerColor, roughness: 0.4 });
      const cooler = new THREE.Mesh(coolerGeo, coolerMat);
      cooler.position.set(-0.35, 0.95, 0.35);
      cooler.castShadow = true;
      stallGroup.add(cooler);

      // White cooler lid
      const lidGeo = new THREE.BoxGeometry(0.67, 0.08, 0.47);
      const lid = new THREE.Mesh(lidGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc }));
      lid.position.set(-0.35, 1.2, 0.35);
      stallGroup.add(lid);

      // 5. Plastic retail stool
      const stoolGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.55, 12);
      const stoolMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
      const stool = new THREE.Mesh(stoolGeo, stoolMat);
      stool.position.set(0.1, 0.28, -0.65);
      stool.castShadow = true;
      stallGroup.add(stool);

      this.group.add(stallGroup);
    });
  }

  /**
   * Builds the iconic Lagos Pedestrian Overhead Bridge (Flyover)
   * Spanning across all 4 highway lanes with concrete stairs, blue safety canopy,
   * and dual highway advertising & LASTMA warning billboards.
   */
  private buildPedestrianOverheadBridge(): void {
    const bridgeGroup = new THREE.Group();
    const bridgeZ = 28.0;
    bridgeGroup.position.set(0, 0, bridgeZ);

    const signs = SignageLibrary.getInstance();
    const concMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
    const blueSteelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.4, roughness: 0.5 });
    const deckY = 5.4; // 5.4m overhead vehicle clearance
    const totalSpan = 21.0; // Across both sidewalks (x: -10.5 to +10.5)

    // 1. Heavy Concrete Support Pillars (at curb edges)
    for (const px of [-7.2, 7.2]) {
      const colGeo = new THREE.BoxGeometry(1.0, deckY, 1.0);
      const col = new THREE.Mesh(colGeo, concMat);
      col.position.set(px, deckY / 2, 0);
      col.castShadow = true;
      col.receiveShadow = true;
      bridgeGroup.add(col);

      // Yellow & black hazard base footing
      const baseGeo = new THREE.BoxGeometry(1.3, 0.9, 1.3);
      const base = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }));
      base.position.set(px, 0.45, 0);
      base.castShadow = true;
      bridgeGroup.add(base);
    }

    // 2. Main Reinforced Walkway Deck
    const deckGeo = new THREE.BoxGeometry(totalSpan, 0.5, 3.2);
    const deck = new THREE.Mesh(deckGeo, concMat);
    deck.position.set(0, deckY, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);

    // Steel support I-beams running underneath deck
    for (const bz of [-1.3, 1.3]) {
      const beamGeo = new THREE.BoxGeometry(totalSpan + 0.4, 0.4, 0.3);
      const beam = new THREE.Mesh(beamGeo, blueSteelMat);
      beam.position.set(0, deckY - 0.35, bz);
      beam.castShadow = true;
      bridgeGroup.add(beam);
    }

    // 3. Overhead Blue Steel Canopy / Arch Roof
    const roofGeo = new THREE.BoxGeometry(totalSpan + 0.6, 0.18, 3.6);
    const roof = new THREE.Mesh(roofGeo, blueSteelMat);
    roof.position.set(0, deckY + 2.7, 0);
    roof.castShadow = true;
    bridgeGroup.add(roof);

    // Blue vertical structural columns supporting the roof
    for (let x = -9.5; x <= 9.5; x += 2.8) {
      for (const bz of [-1.55, 1.55]) {
        const postGeo = new THREE.BoxGeometry(0.12, 2.7, 0.12);
        const post = new THREE.Mesh(postGeo, blueSteelMat);
        post.position.set(x, deckY + 1.35, bz);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
    }

    // Safety mesh side railings along walkway
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.75,
      roughness: 0.3,
    });
    for (const bz of [-1.55, 1.55]) {
      const railGeo = new THREE.BoxGeometry(totalSpan, 1.3, 0.05);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, deckY + 0.85, bz);
      bridgeGroup.add(rail);
    }

    // 4. Concrete Staircases on West & East Sidewalks
    // Descends southward from bridge deck towards sidewalk level
    const numSteps = 14;
    const stepRise = (deckY - 0.28) / numSteps;
    const stepRun = 0.85;

    for (const sx of [-10.5, 10.5]) {
      const stairGroup = new THREE.Group();
      stairGroup.position.set(sx, 0, 0);

      for (let s = 0; s < numSteps; s++) {
        const stepH = (s + 1) * stepRise;
        const stepZ = -(s * stepRun) - 1.6;
        const stepGeo = new THREE.BoxGeometry(2.4, stepRise + 0.02, stepRun);
        const step = new THREE.Mesh(stepGeo, concMat);
        step.position.set(0, stepH - stepRise / 2, stepZ);
        step.castShadow = true;
        step.receiveShadow = true;
        stairGroup.add(step);
      }

      // Blue steel handrail running along the stairs
      const railLen = Math.hypot(numSteps * stepRun, deckY);
      const railAngle = Math.atan2(deckY, numSteps * stepRun);
      const stairRailGeo = new THREE.BoxGeometry(0.08, 0.08, railLen);
      const stairRail = new THREE.Mesh(stairRailGeo, blueSteelMat);
      stairRail.rotation.x = railAngle;
      stairRail.position.set(sx > 0 ? -1.15 : 1.15, deckY / 2 + 0.9, -((numSteps * stepRun) / 2) - 1.6);
      stairGroup.add(stairRail);

      bridgeGroup.add(stairGroup);
    }

    // 5. Giant Double-Sided Billboard Overhead
    const bbW = 14.0;
    const bbH = 2.8;

    // North Face: NLGTV / LLTV Entertainment Board (facing southbound cars)
    const northGeo = new THREE.PlaneGeometry(bbW, bbH);
    const northBoard = new THREE.Mesh(northGeo, signs.pedestrianBridgeBillboardMaterial);
    northBoard.position.set(0, deckY + 1.45, -1.65);
    northBoard.rotation.y = Math.PI; // Faces toward negative Z (facing oncoming traffic)
    bridgeGroup.add(northBoard);

    // South Face: LASTMA Safety Caution Billboard (facing northbound cars)
    const southGeo = new THREE.PlaneGeometry(bbW, bbH);
    const southBoard = new THREE.Mesh(southGeo, signs.pedestrianBridgeWarningMaterial);
    southBoard.position.set(0, deckY + 1.45, 1.65);
    bridgeGroup.add(southBoard);

    // Billboard backing structure
    const backGeo = new THREE.BoxGeometry(bbW + 0.2, bbH + 0.2, 0.2);
    const backMesh = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }));
    backMesh.position.set(0, deckY + 1.45, 0);
    bridgeGroup.add(backMesh);

    // 6. Yellow & Black Vehicle Height Hazard Striping along bottom beam
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const hazardStripGeo = new THREE.BoxGeometry(this.roadWidth + 1.0, 0.22, 3.25);
    const hazardStrip = new THREE.Mesh(hazardStripGeo, hazardMat);
    hazardStrip.position.set(0, deckY - 0.22, 0);
    bridgeGroup.add(hazardStrip);

    this.group.add(bridgeGroup);
  }
}
