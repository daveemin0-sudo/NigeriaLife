import * as THREE from 'three';
import { MaterialLibrary } from '../../materials/MaterialLibrary';

export class CityDensityManager {
  public group: THREE.Group;
  private matLib: MaterialLibrary;

  constructor() {
    this.group = new THREE.Group();
    this.matLib = MaterialLibrary.getInstance();

    this.buildBackgroundSkylines();
    this.buildDenseStreetBlocks();
    this.buildStreetDetailsAndProps();
  }

  // =========================================================================
  // 1. BACKGROUND SKYLINES (Lagos Island & Coastal Monoliths - 80-90% visual)
  // =========================================================================
  private buildBackgroundSkylines(): void {
    const skylineMat1 = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
    const skylineMat2 = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.15, metalness: 0.9 });

    // West Background Skyline (X = -45 to -60)
    for (let z = -140; z <= 140; z += 28) {
      const h = 24 + ((Math.abs(z) * 17) % 36);
      const w = 14 + (z % 6);
      const d = 14 + (z % 8);

      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        z % 2 === 0 ? skylineMat1 : glassMat
      );
      tower.position.set(-48, h / 2, z);
      tower.castShadow = true;
      this.group.add(tower);

      // Vertical LED accent lights on towers
      const led = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, h * 0.9, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
      );
      led.position.set(-40, h / 2, z);
      this.group.add(led);
    }

    // East Background Skyline (X = +45 to +60)
    for (let z = -135; z <= 135; z += 30) {
      const h = 22 + ((Math.abs(z) * 19) % 38);
      const w = 16;
      const d = 16;

      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        z % 3 === 0 ? glassMat : skylineMat2
      );
      tower.position.set(50, h / 2, z);
      tower.castShadow = true;
      this.group.add(tower);
    }
  }

  // =========================================================================
  // 2. DENSE STREET BLOCKS (2-4 Storey Tenements & Commercial Rows)
  // =========================================================================
  private buildDenseStreetBlocks(): void {
    const wallColors = [0xfef08a, 0xe2e8f0, 0xd97706, 0xca8a04, 0xf1f5f9, 0x0284c7];

    // West Side Non-Interactive Background Facades (X = -28)
    for (let z = -130; z <= 130; z += 22) {
      // Skip spots where core interactive buildings are
      if (Math.abs(z - (-10)) < 12 || Math.abs(z - 24) < 14 || Math.abs(z - 75) < 12 || Math.abs(z - 105) < 12) {
        continue;
      }

      const blockGroup = new THREE.Group();
      blockGroup.position.set(-27, 0, z);

      const floors = 2 + (Math.abs(z) % 3);
      const h = floors * 3.4;
      const w = 12;
      const d = 18;

      const bodyMat = new THREE.MeshStandardMaterial({
        color: wallColors[Math.abs(z) % wallColors.length],
        roughness: 0.85,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
      body.position.y = h / 2;
      body.castShadow = true;
      blockGroup.add(body);

      // Corrugated roof overhang
      const roofMat = this.matLib.corrugatedRoofRusty;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.2, d + 0.8), roofMat);
      roof.position.y = h + 0.1;
      blockGroup.add(roof);

      // Balcony railings and louvered windows
      for (let f = 1; f <= floors; f++) {
        const fy = f * 3.2;
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.9, d * 0.8),
          this.matLib.ironRailingMaterial
        );
        rail.position.set(w / 2 + 0.1, fy - 0.4, 0);
        blockGroup.add(rail);

        // Outdoor AC compressor unit
        const ac = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.6, 0.4),
          this.matLib.acUnitMaterial
        );
        ac.position.set(w / 2 + 0.2, fy + 0.4, -2.5);
        blockGroup.add(ac);
      }

      // Rooftop GeePee Water Tank
      const tankMat = this.matLib.waterTankBlackMaterial;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.8, 12), tankMat);
      tank.position.set(0, h + 1.0, 0);
      blockGroup.add(tank);

      // Satellite TV Dish (DStv)
      const dish = this.createSatelliteDish();
      dish.position.set(w / 2 + 0.15, h - 1.2, 3.5);
      blockGroup.add(dish);

      this.group.add(blockGroup);
    }

    // East Side Non-Interactive Background Facades (X = +28)
    for (let z = -130; z <= 130; z += 24) {
      if (Math.abs(z - (-22)) < 12 || Math.abs(z - (-4)) < 12 || Math.abs(z - 12) < 12 || Math.abs(z - 27) < 12) {
        continue;
      }

      const blockGroup = new THREE.Group();
      blockGroup.position.set(27, 0, z);

      const floors = 3;
      const h = floors * 3.4;
      const w = 12;
      const d = 18;

      const bodyMat = new THREE.MeshStandardMaterial({
        color: wallColors[(Math.abs(z) + 2) % wallColors.length],
        roughness: 0.85,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
      body.position.y = h / 2;
      body.castShadow = true;
      blockGroup.add(body);

      // Ground floor commercial awning
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.1, d * 0.9),
        this.matLib.concreteTrimMaterial
      );
      awning.position.set(-w / 2 - 0.8, 3.2, 0);
      blockGroup.add(awning);

      // Rooftop tanks
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 1.8, 12),
        this.matLib.waterTankBlackMaterial
      );
      tank.position.set(0, h + 1.0, 2.0);
      blockGroup.add(tank);

      this.group.add(blockGroup);
    }
  }

  // =========================================================================
  // 3. STREET PROPS & DETAILS (Drainage, Generators, Signs, Cones, Tanks)
  // =========================================================================
  private buildStreetDetailsAndProps(): void {
    // A. Security Booths at key compound entries
    this.createSecurityBooth(-14.5, 0, 16);
    this.createSecurityBooth(14.5, 0, -32);

    // B. Soundproof Generator Metal Cages (Yellow & Black caution stripes)
    this.createGenCage(-14.5, 0, 32);
    this.createGenCage(14.5, 0, -8);
    this.createGenCage(-14.5, 0, -65);

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
  private createSatelliteDish(): THREE.Group {
    const group = new THREE.Group();
    const dishMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.05, 0.15, 12), dishMat);
    dish.rotation.x = Math.PI / 3;
    group.add(dish);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), dishMat);
    arm.position.set(0, 0, 0.25);
    group.add(arm);
    return group;
  }

  // Security Guard Booth
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
