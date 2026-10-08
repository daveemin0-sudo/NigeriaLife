import * as THREE from 'three';
import { MaterialLibrary } from '../../materials/MaterialLibrary';
import { CityFabric } from './CityFabric';

export class CityDensityManager {
  public group: THREE.Group;
  public fabric: CityFabric;
  private matLib: MaterialLibrary;

  /**
   * @param obstacles hand-built world groups the generated city fabric must build around
   */
  constructor(obstacles: THREE.Object3D[] = []) {
    this.group = new THREE.Group();
    this.matLib = MaterialLibrary.getInstance();

    // Instanced side streets, tenements, plazas and towers filling the whole of Lagos Island
    this.fabric = new CityFabric(obstacles);
    this.group.add(this.fabric.group);

    this.buildStreetDetailsAndProps();
  }

  // =========================================================================
  // STREET PROPS & DETAILS (Drainage, Generators, Signs, Cones, Tanks)
  // =========================================================================
  private buildStreetDetailsAndProps(): void {
    // A. Security Booths at key compound entries
    this.createSecurityBooth(-14.5, 0, 16);
    this.createSecurityBooth(14.5, 0, -32);

    // B. Soundproof Generator Metal Cages (Yellow & Black caution stripes)
    this.createGenCage(-14.5, 0, 32);
    this.createGenCage(14.5, 0, -8);
    this.createGenCage(-14.5, 0, -74);

    // C. LAWMA Lagos Trash Wheelie Bins along sidewalks
    for (let z of [-80, -40, 2, 40, 80]) {
      this.createTrashBin(-8.2, 0, z);
      this.createTrashBin(8.2, 0, z + 12);
    }

    // D. Traffic Warning Signs & Speed Limit 40 km/h
    this.createTrafficSign(-7.6, 0, -90, 'SPEED 40');
    this.createTrafficSign(7.6, 0, -10, 'ZEBRA CROSSING');
    this.createTrafficSign(-7.6, 0, 60, 'BUS STOP');

    // E. Traffic Safety Cones & Construction Barriers
    this.createTrafficCone(-4.5, 0, 52);
    this.createTrafficCone(-4.5, 0, 54);
    this.createTrafficCone(-4.5, 0, 56);

    // F. Asphalt Pothole Patches
    for (let pz of [-55, 18, 65]) {
      this.createPotholePatch(pz % 2 === 0 ? -1.8 : 1.8, pz);
    }
  }

  // Satellite Dish Model
  private createSecurityBooth(x: number, y: number, z: number): void {
    const booth = new THREE.Group();
    booth.position.set(x, y, z);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 2.6, 2.0),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
    );
    body.position.y = 1.3;
    body.castShadow = true;
    booth.add(body);

    // Glass windows
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.9, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.6 })
    );
    glass.position.y = 1.6;
    booth.add(glass);

    // Roof
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.2, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    roof.position.y = 2.7;
    booth.add(roof);

    this.group.add(booth);
  }

  // Soundproof Generator Cage
  private createGenCage(x: number, y: number, z: number): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Green soundproof diesel gen
    const gen = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.3 })
    );
    gen.position.y = 0.7;
    gen.castShadow = true;
    group.add(gen);

    // Exhaust flue
    const flue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    flue.position.set(0.8, 1.8, 0);
    group.add(flue);

    this.group.add(group);
  }

  // LAWMA Green Trash Bin
  private createTrashBin(x: number, y: number, z: number): void {
    const bin = new THREE.Group();
    bin.position.set(x, y, z);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.95, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
    );
    body.position.y = 0.48;
    bin.add(body);

    // Lid
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x14532d })
    );
    lid.position.y = 1.0;
    bin.add(lid);

    this.group.add(bin);
  }

  // Street Traffic Sign
  private createTrafficSign(x: number, y: number, z: number, label: string): void {
    const sign = new THREE.Group();
    sign.position.set(x, y, z);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.2, 8),
      this.matLib.ironRailingMaterial
    );
    pole.position.y = 1.6;
    sign.add(pole);

    const board = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 16),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    board.position.set(0, 3.0, 0.06);
    sign.add(board);
    sign.name = `TrafficSign_${label}`;

    this.group.add(sign);
  }

  // Striped Orange Traffic Cone
  private createTrafficCone(x: number, y: number, z: number): void {
    const coneGroup = new THREE.Group();
    coneGroup.position.set(x, y, z);

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.75, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 })
    );
    cone.position.y = 0.38;
    coneGroup.add(cone);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.06, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    base.position.y = 0.03;
    coneGroup.add(base);

    this.group.add(coneGroup);
  }

  // Pothole Asphalt Repair Patch
  private createPotholePatch(x: number, z: number): void {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, 0.015, z);
    this.group.add(patch);
  }
}
