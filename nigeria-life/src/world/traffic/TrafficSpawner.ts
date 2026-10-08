import * as THREE from 'three';

export interface TrafficVehicleInstance {
  mesh: THREE.Group;
  wheels: THREE.Mesh[];
  lane: 'north' | 'south';
  speed: number;
  type: string;
}

export class TrafficSpawner {
  public group: THREE.Group;
  private vehicles: TrafficVehicleInstance[] = [];
  private maxActiveVehicles: number = 28;

  constructor() {
    this.group = new THREE.Group();
    this.initTrafficStream();
  }

  private initTrafficStream(): void {
    const vehicleTypes = [
      'danfo', 'keke', 'brt', 'taxi', 'sedan', 'suv',
      'pickup', 'delivery_van', 'truck', 'tanker', 'danfo', 'keke', 'sedan', 'danfo'
    ];

    const colors = [0xfacc15, 0xdc2626, 0x2563eb, 0x16a34a, 0xffffff, 0x18181b, 0xd97706, 0x64748b];

    // 4 Distinct Lanes: Northbound outer/inner (-4.9, -1.8) and Southbound inner/outer (1.8, 4.9)
    const northLanes = [-4.9, -1.8];
    const southLanes = [1.8, 4.9];

    for (let i = 0; i < this.maxActiveVehicles; i++) {
      const type = vehicleTypes[i % vehicleTypes.length];
      const isNorth = i % 2 === 0;
      const laneList = isNorth ? northLanes : southLanes;
      const laneX = laneList[Math.floor(i / 2) % laneList.length];
      const initialZ = -120 + (i / this.maxActiveVehicles) * 240 + (Math.random() - 0.5) * 8;
      const color = colors[i % colors.length];

      const v = this.buildVehicle(type, color);
      v.lane = isNorth ? 'north' : 'south';
      v.mesh.position.set(laneX, 0, initialZ);
      v.mesh.rotation.y = isNorth ? 0 : Math.PI;
      // Faster on inner lane, slightly slower on outer curbside lane
      const baseSpeed = Math.abs(laneX) < 3.0 ? 12 : 9;
      v.speed = baseSpeed + Math.random() * 4.5;

      this.vehicles.push(v);
      this.group.add(v.mesh);
    }
  }

  private buildVehicle(type: string, colorHex: number): TrafficVehicleInstance {
    const wheels: THREE.Mesh[] = [];
    const group = new THREE.Group();

    switch (type) {
      case 'brt': {
        // Large High-Capacity BRT Bus (Red or Blue)
        const busColor = Math.random() > 0.5 ? 0x2563eb : 0xdc2626;
        const busMat = new THREE.MeshStandardMaterial({ color: busColor, roughness: 0.35 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 9.2), busMat);
        body.position.y = 1.5;
        body.castShadow = true;
        group.add(body);

        // Windshield & side passenger windows
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.8 });
        const wind = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), glassMat);
        wind.position.set(0, 1.8, 4.62);
        group.add(wind);

        // White BRT roof cap
        const roof = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.2, 9.25), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        roof.position.y = 2.75;
        group.add(roof);

        this.addWheels(group, wheels, [-1.3, 1.3], [-3.2, 0, 3.2], 0.46);
        return { mesh: group, wheels, lane: 'north', speed: 11, type };
      }

      case 'tanker': {
        // Heavy Fuel Tanker (Dangote / NNPC style)
        const cabMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.6), cabMat);
        cab.position.set(0, 1.4, 3.2);
        group.add(cab);

        // Silver Fuel Tank Cylinder
        const tankMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.25 });
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6.2, 16), tankMat);
        tank.rotation.x = Math.PI / 2;
        tank.position.set(0, 1.6, -1.5);
        group.add(tank);

        this.addWheels(group, wheels, [-1.2, 1.2], [-3.8, -2.4, 3.2], 0.45);
        return { mesh: group, wheels, lane: 'north', speed: 9.5, type };
      }

      case 'truck': {
        // Heavy Open-Bed Commercial Cargo Truck
        const cabMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.4), cabMat);
        cab.position.set(0, 1.4, 2.8);
        group.add(cab);

        // Wooden cargo bed with loaded crates
        const bedMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
        const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 5.2), bedMat);
        bed.position.set(0, 1.1, -1.2);
        group.add(bed);

        this.addWheels(group, wheels, [-1.2, 1.2], [-2.8, -1.2, 2.8], 0.45);
        return { mesh: group, wheels, lane: 'north', speed: 10, type };
      }

      case 'delivery_van': {
        // Commercial White Delivery Van
        const vanMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
        const van = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 4.8), vanMat);
        van.position.y = 1.25;
        van.castShadow = true;
        group.add(van);

        this.addWheels(group, wheels, [-1.1, 1.1], [-1.5, 1.5], 0.4);
        return { mesh: group, wheels, lane: 'north', speed: 12.5, type };
      }

      case 'pickup': {
        // White or Navy Hilux Pickup
        const pickMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.4), pickMat);
        cab.position.set(0, 1.1, 0.8);
        group.add(cab);

        const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.2), pickMat);
        bed.position.set(0, 0.8, -1.5);
        group.add(bed);

        this.addWheels(group, wheels, [-1.1, 1.1], [-1.4, 1.3], 0.4);
        return { mesh: group, wheels, lane: 'north', speed: 13, type };
      }

      case 'keke': {
        // Yellow Keke NAPEP
        const kekeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 2.3), kekeMat);
        body.position.y = 0.8;
        group.add(body);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.85, 2.1), new THREE.MeshStandardMaterial({ color: 0x09090b }));
        roof.position.y = 1.7;
        group.add(roof);

        this.addWheels(group, wheels, [-0.75, 0.75], [-0.8, 0.8], 0.32);
        return { mesh: group, wheels, lane: 'north', speed: 9, type };
      }

      case 'okada': {
        // Motorcycle with Delivery Box
        const bikeMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8 });
        const bike = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 1.6), bikeMat);
        bike.position.y = 0.6;
        group.add(bike);

        const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
        box.position.set(0, 0.95, -0.7);
        group.add(box);

        this.addWheels(group, wheels, [0], [-0.65, 0.7], 0.34);
        return { mesh: group, wheels, lane: 'north', speed: 14, type };
      }

      case 'danfo':
      default: {
        // Classic Yellow Danfo
        const danfoMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 5.0), danfoMat);
        body.position.y = 1.35;
        body.castShadow = true;
        group.add(body);

        // Black stripes
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.14, 4.8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        stripe.position.set(0, 1.35, 0);
        group.add(stripe);

        this.addWheels(group, wheels, [-1.12, 1.12], [-1.5, 1.5], 0.42);
        return { mesh: group, wheels, lane: 'north', speed: 12.5, type };
      }
    }
  }

  private addWheels(group: THREE.Group, wheels: THREE.Mesh[], xOffsets: number[], zOffsets: number[], radius: number): void {
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const wheelGeo = new THREE.CylinderGeometry(radius, radius, 0.28, 12);

    for (const x of xOffsets) {
      for (const z of zOffsets) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, radius, z);
        wheels.push(wheel);
        group.add(wheel);
      }
    }
  }

  // Distance-based update & recycling
  public update(delta: number, playerZ: number = 0): void {
    const minZ = playerZ - 130;
    const maxZ = playerZ + 130;

    for (const v of this.vehicles) {
      if (v.lane === 'north') {
        v.mesh.position.z += v.speed * delta;
        for (const w of v.wheels) w.rotation.x += v.speed * delta * 2.0;

        if (v.mesh.position.z > maxZ) {
          v.mesh.position.z = minZ - Math.random() * 15;
          v.speed = 10 + Math.random() * 5.0;
        }
      } else {
        v.mesh.position.z -= v.speed * delta;
        for (const w of v.wheels) w.rotation.x += v.speed * delta * 2.0;

        if (v.mesh.position.z < minZ) {
          v.mesh.position.z = maxZ + Math.random() * 15;
          v.speed = 10 + Math.random() * 5.0;
        }
      }
    }
  }
}
