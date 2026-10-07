import * as THREE from 'three';
import { MaterialLibrary } from '../materials/MaterialLibrary';

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
    for (let offset of [-0.2, 0.2]) {
      for (let z = -this.roadLength / 2 + 5; z < this.roadLength / 2 - 5; z += 6) {
        const lineGeo = new THREE.PlaneGeometry(0.2, 3.8);
        const line = new THREE.Mesh(lineGeo, mats.roadLineMaterial);
        line.rotation.x = -Math.PI / 2;
        line.position.set(offset, 0.02, z);
        this.group.add(line);
      }
    }

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
    const walkGeo = new THREE.BoxGeometry(walkWidth, 0.28, this.roadLength);

    const leftWalkway = new THREE.Mesh(walkGeo, mats.sidewalkMaterial);
    leftWalkway.position.set(-(this.roadWidth / 2 + walkWidth / 2), 0.14, 0);
    leftWalkway.receiveShadow = true;
    this.group.add(leftWalkway);

    const rightWalkway = new THREE.Mesh(walkGeo, mats.sidewalkMaterial);
    rightWalkway.position.set(this.roadWidth / 2 + walkWidth / 2, 0.14, 0);
    rightWalkway.receiveShadow = true;
    this.group.add(rightWalkway);

    // 5. Classic Nigerian Yellow & Black Kerb Stones (Cached PBR materials)
    const curbHeight = 0.32;
    const curbWidth = 0.28;
    const segmentLen = 2.0;

    for (let z = -this.roadLength / 2; z < this.roadLength / 2; z += segmentLen) {
      const isYellow = Math.floor(z / segmentLen) % 2 === 0;
      const curbMat = isYellow ? mats.curbYellowMaterial : mats.curbBlackMaterial;

      const curbL = new THREE.Mesh(
        new THREE.BoxGeometry(curbWidth, curbHeight, segmentLen - 0.05),
        curbMat
      );
      curbL.position.set(-this.roadWidth / 2, curbHeight / 2, z + segmentLen / 2);
      this.group.add(curbL);

      const curbR = new THREE.Mesh(
        new THREE.BoxGeometry(curbWidth, curbHeight, segmentLen - 0.05),
        curbMat
      );
      curbR.position.set(this.roadWidth / 2, curbHeight / 2, z + segmentLen / 2);
      this.group.add(curbR);
    }
  }

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

      // Warm LED Luminaire Diffuser Lens with glow
      const bulbGeo = new THREE.BoxGeometry(0.55, 0.04, 0.22);
      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfffaed,
        emissive: 0xffedd5,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-poleSide * 1.55, 6.28, 0);
      lampGroup.add(bulb);

      this.group.add(lampGroup);
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
      const troughGeo = new THREE.BoxGeometry(0.7, 0.45, this.roadLength);
      const trough = new THREE.Mesh(troughGeo, gutterMat);
      trough.position.set(gx, -0.08, 0);
      trough.receiveShadow = true;
      this.group.add(trough);

      // Concrete Culvert Bridges (Planks across gutters for pedestrians to enter shops)
      for (let z = -90; z <= 90; z += 15) {
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

    // C. Roadside Vendor Umbrellas & Display Tables (Recharge cards, snacks, fruits)
    const umbrellaColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6];
    const stallZPositions = [-72, -48, -18, 16, 42, 68, 96];

    stallZPositions.forEach((sz, idx) => {
      const side = idx % 2 === 0 ? -1 : 1;
      const sx = side * (this.roadWidth / 2 + 3.2);

      const stallGroup = new THREE.Group();
      stallGroup.position.set(sx, 0.28, sz);

      // Multicolored parasol umbrella
      const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 1.25;
      pole.castShadow = true;
      stallGroup.add(pole);

      const canopyGeo = new THREE.ConeGeometry(1.6, 0.6, 12);
      const canopyColor = umbrellaColors[idx % umbrellaColors.length];
      const canopyMat = new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 0.7 });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.y = 2.4;
      canopy.castShadow = true;
      stallGroup.add(canopy);

      // Wooden market display table
      const tableGeo = new THREE.BoxGeometry(1.4, 0.8, 0.9);
      const tableMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
      const table = new THREE.Mesh(tableGeo, tableMat);
      table.position.set(0, 0.4, 0.3);
      table.castShadow = true;
      table.receiveShadow = true;
      stallGroup.add(table);

      // Glass showcase box on table (displaying drinks / recharge cards)
      const glassGeo = new THREE.BoxGeometry(1.1, 0.35, 0.6);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.5,
        roughness: 0.2,
      });
      const glassBox = new THREE.Mesh(glassGeo, glassMat);
      glassBox.position.set(0, 0.95, 0.3);
      stallGroup.add(glassBox);

      // Plastic garden chair
      const chairGeo = new THREE.BoxGeometry(0.5, 0.75, 0.5);
      const chairMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 });
      const chair = new THREE.Mesh(chairGeo, chairMat);
      chair.position.set(0, 0.38, -0.6);
      chair.castShadow = true;
      stallGroup.add(chair);

      this.group.add(stallGroup);
    });
  }
}
