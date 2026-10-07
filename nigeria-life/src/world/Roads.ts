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
    for (let z = -80; z <= 80; z += 24) {
      const poleSide = (z / 24) % 2 === 0 ? 1 : -1;
      const lampGroup = new THREE.Group();
      lampGroup.position.set(poleSide * lampX, 0, z);

      // Steel pole
      const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 3.25;
      lampGroup.add(pole);

      // Overhanging arm
      const armGeo = new THREE.BoxGeometry(1.6, 0.08, 0.08);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(-poleSide * 0.7, 6.4, 0);
      lampGroup.add(arm);

      // Lamp fixture bulb
      const bulbGeo = new THREE.BoxGeometry(0.5, 0.15, 0.25);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffaed });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(-poleSide * 1.3, 6.3, 0);
      lampGroup.add(bulb);

      this.group.add(lampGroup);
    }
  }

  private buildPowerPoles(): void {
    // Classic wooden/concrete PHCN electric poles with cross-arms
    const poleX = -13.0;
    const poleZPositions = [-70, -35, 0, 35, 70];

    for (let i = 0; i < poleZPositions.length; i++) {
      const z = poleZPositions[i];
      const poleGroup = new THREE.Group();
      poleGroup.position.set(poleX, 0, z);

      // Concrete utility pole
      const poleGeo = new THREE.CylinderGeometry(0.18, 0.24, 9, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.5;
      poleGroup.add(pole);

      // Horizontal Cross-bar
      const barGeo = new THREE.BoxGeometry(2.8, 0.18, 0.12);
      const bar = new THREE.Mesh(barGeo, poleMat);
      bar.position.set(0, 8.2, 0);
      poleGroup.add(bar);

      // Insulator ceramic cups
      for (let offset of [-1.1, 0, 1.1]) {
        const insGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8);
        const insMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        const ins = new THREE.Mesh(insGeo, insMat);
        ins.position.set(offset, 8.4, 0);
        poleGroup.add(ins);
      }

      this.group.add(poleGroup);
    }

    // Overhead high tension electric wires spanning between poles
    for (let i = 0; i < poleZPositions.length - 1; i++) {
      const z1 = poleZPositions[i];
      const z2 = poleZPositions[i + 1];
      const span = z2 - z1;

      for (let offset of [-1.1, 0, 1.1]) {
        const wireGeo = new THREE.CylinderGeometry(0.015, 0.015, span, 4);
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const wire = new THREE.Mesh(wireGeo, wireMat);
        wire.rotation.x = Math.PI / 2;
        wire.position.set(poleX + offset, 8.4, z1 + span / 2);
        this.group.add(wire);
      }
    }
  }
}
