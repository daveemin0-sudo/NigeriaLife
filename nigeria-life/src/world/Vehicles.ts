import * as THREE from 'three';

export class Vehicles {
  public group: THREE.Group;
  private danfoBus: THREE.Group;
  private kekeNapep: THREE.Group;
  private danfoWheels: THREE.Mesh[] = [];
  private kekeWheels: THREE.Mesh[] = [];

  private danfoSpeed: number = 14;
  private kekeSpeed: number = 9;

  constructor() {
    this.group = new THREE.Group();
    this.danfoBus = this.createDanfoBus();
    this.kekeNapep = this.createKekeNapep();

    // Position them on different lanes
    this.danfoBus.position.set(-3.2, 0, -80); // Lane going North -> South
    this.kekeNapep.position.set(3.2, 0, 70);  // Lane going South -> North
    this.kekeNapep.rotation.y = Math.PI;      // Face opposite direction

    this.group.add(this.danfoBus);
    this.group.add(this.kekeNapep);
  }

  // 1. Classic Yellow Lagos Danfo Minibus
  private createDanfoBus(): THREE.Group {
    const bus = new THREE.Group();

    // Yellow bus body
    const bodyGeo = new THREE.BoxGeometry(2.3, 2.0, 5.2);
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, yellowMat);
    body.position.y = 1.4;
    body.castShadow = true;
    bus.add(body);

    // Iconic twin horizontal black stripes (The unmistakable Lagos Danfo trademark)
    const stripeGeo = new THREE.BoxGeometry(2.32, 0.28, 5.22);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.y = 1.35;
    bus.add(stripe);

    // Front windshield & side windows
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.9,
    });

    // Windshield
    const windshieldGeo = new THREE.PlaneGeometry(2.0, 0.9);
    const windshield = new THREE.Mesh(windshieldGeo, windowMat);
    windshield.position.set(0, 1.8, 2.61);
    bus.add(windshield);

    // Headlights
    for (let hx of [-0.85, 0.85]) {
      const lightGeo = new THREE.BoxGeometry(0.35, 0.22, 0.1);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(hx, 0.85, 2.61);
      bus.add(light);
    }

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    const wheelOffsets = [
      { x: -1.15, z: 1.6 },
      { x: 1.15, z: 1.6 },
      { x: -1.15, z: -1.6 },
      { x: 1.15, z: -1.6 },
    ];

    for (let off of wheelOffsets) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(off.x, 0.42, off.z);
      this.danfoWheels.push(wheel);
      bus.add(wheel);
    }

    return bus;
  }

  // 2. Yellow Keke Napep (3-Wheeled Tricycle)
  private createKekeNapep(): THREE.Group {
    const keke = new THREE.Group();

    // Main lower body
    const baseGeo = new THREE.BoxGeometry(1.5, 1.0, 2.4);
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const base = new THREE.Mesh(baseGeo, yellowMat);
    base.position.y = 0.85;
    keke.add(base);

    // Black canvas curved canopy / roof
    const roofGeo = new THREE.BoxGeometry(1.55, 0.9, 2.2);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = 1.75;
    keke.add(roof);

    // Windshield
    const shieldGeo = new THREE.PlaneGeometry(1.3, 0.7);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1 });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 1.45, 1.21);
    keke.add(shield);

    // 3 Wheels (1 front, 2 rear)
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });

    // Front single wheel
    const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, 0.3, 1.1);
    this.kekeWheels.push(frontWheel);
    keke.add(frontWheel);

    // Rear twin wheels
    for (let rx of [-0.78, 0.78]) {
      const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
      rearWheel.rotation.z = Math.PI / 2;
      rearWheel.position.set(rx, 0.3, -0.9);
      this.kekeWheels.push(rearWheel);
      keke.add(rearWheel);
    }

    return keke;
  }

  public update(delta: number): void {
    // 1. Move Danfo Bus forward (+Z direction)
    this.danfoBus.position.z += this.danfoSpeed * delta;
    for (let w of this.danfoWheels) {
      w.rotation.x += this.danfoSpeed * delta * 2.2;
    }
    // Loop back when passing end of street
    if (this.danfoBus.position.z > 110) {
      this.danfoBus.position.z = -110;
    }

    // 2. Move Keke Napep forward (-Z direction in world space, facing opposite)
    this.kekeNapep.position.z -= this.kekeSpeed * delta;
    for (let w of this.kekeWheels) {
      w.rotation.x -= this.kekeSpeed * delta * 2.8;
    }
    if (this.kekeNapep.position.z < -110) {
      this.kekeNapep.position.z = 110;
    }
  }
}
