import * as THREE from 'three';
import type { RideDetails, RideCameraView } from './TransitTypes';
import { WorldMapPrefabs } from '../world/map/WorldMapPrefabs';
import { Builder } from '../world/kit/ArchKit';

export class RoadRideExperience {
  public group: THREE.Group;
  public isActive: boolean = false;
  public currentCameraView: RideCameraView = 'inside';

  // Dedicated Camera
  public rideCamera: THREE.PerspectiveCamera;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Subgroups
  private vehicleGroup: THREE.Group = new THREE.Group();
  /** The inside of a coach, for a journey that is ridden and not driven */
  private coachGroup: THREE.Group = new THREE.Group();
  private byCoach = false;
  private trafficGroup: THREE.Group = new THREE.Group();
  private sceneryGroup: THREE.Group = new THREE.Group();
  private steeringWheel!: THREE.Group;

  // Active Ride Metadata
  public currentRide: RideDetails | null = null;
  private elapsedTime: number = 0;
  private totalDuration: number = 24; // seconds for demo ride
  private animTime: number = 0;

  // Traffic vehicles
  private trafficCars: Array<{ mesh: THREE.Group; baseZ: number; speed: number }> = [];

  // Callbacks
  public onRideCompleted?: (ride: RideDetails) => void;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.rideCamera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    this.group.add(this.sceneryGroup);
    this.group.add(this.vehicleGroup);
    this.group.add(this.trafficGroup);

    // Warm Sun and Ambient
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.5);
    sunLight.position.set(40, 80, 50);
    this.group.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.6);
    this.group.add(ambientLight);

    this.buildStreetScenery();
    this.buildPlayerVehicleCockpit();
    this.buildCoachCabin();
    this.buildDenseTraffic();
  }

  // =========================================================================
  // A coach, from a passenger's seat: rows of seats ahead, the aisle, windows down both sides,
  // racks overhead, the driver at the front. Seen from outside it is the coach on the road.
  // =========================================================================
  private buildCoachCabin(): void {
    const LIVERY = 0x0f5132;
    const CREAM = 0xf5f0e6;
    const SEAT = 0x1e3a5f;
    const FLOOR = 0.9;
    const HALF = 1.28;
    const BACK = -6;
    const FRONT = 5.6;
    const LENGTH = FRONT - BACK;
    const MIDDLE = (FRONT + BACK) / 2;
    const b = new Builder().around(0, 0);

    // The floor, the wheels under it, the roof
    b.box(0x334155, HALF * 2, 0.12, LENGTH, 0, FLOOR - 0.12, MIDDLE);
    b.box(0x27272a, HALF * 2 - 0.1, 0.4, LENGTH - 0.6, 0, 0.4, MIDDLE);
    for (const z of [BACK + 2, FRONT - 2.2]) b.box(0x18181b, HALF * 2 + 0.1, 1.0, 1.05, 0, 0, z);
    b.box(0xf8fafc, HALF * 2 + 0.04, 0.1, LENGTH, 0, FLOOR + 2.15, MIDDLE);
    // Each side: the panel below the windows (the livery outside, a liner inside), the pillars between them, the rail above
    for (const side of [-1, 1]) {
      b.box(LIVERY, 0.06, 0.95, LENGTH, side * HALF, FLOOR - 0.35, MIDDLE);
      b.box(CREAM, 0.03, 0.6, LENGTH, side * (HALF - 0.05), FLOOR, MIDDLE);
      b.box(0xf8fafc, 0.06, 0.4, LENGTH, side * HALF, FLOOR + 1.75, MIDDLE);
      for (let z = BACK; z <= FRONT + 0.01; z += 1.45) b.box(0xe2e8f0, 0.07, 1.2, 0.12, side * HALF, FLOOR + 0.58, z);
      // The rack over the seats, with a bag or two on it
      b.box(0xcbd5e1, 0.5, 0.05, LENGTH - 1.6, side * (HALF - 0.3), FLOOR + 1.62, MIDDLE - 0.4);
      b.box(side > 0 ? 0x7c2d12 : 0x1e3a8a, 0.4, 0.26, 0.7, side * (HALF - 0.3), FLOOR + 1.67, 1.5 * side);
    }
    // The back wall, and the front: the screen pillars and the board over the screen
    b.box(LIVERY, HALF * 2, 2.2, 0.06, 0, FLOOR - 0.35, BACK);
    for (const side of [-1, 1]) b.box(0xe2e8f0, 0.1, 1.5, 0.1, side * (HALF - 0.05), FLOOR + 0.6, FRONT);
    b.box(LIVERY, HALF * 2, 0.6, 0.08, 0, FLOOR - 0.05, FRONT);
    b.box(0x0f172a, HALF * 2, 0.32, 0.08, 0, FLOOR + 1.83, FRONT);
    // Seats: two each side of the aisle, row behind row, each with a white cloth over its head
    for (let z = BACK + 0.7; z < FRONT - 2.4; z += 0.92) {
      for (const x of [-0.98, -0.52, 0.52, 0.98]) {
        b.box(SEAT, 0.42, 0.14, 0.46, x, FLOOR + 0.38, z);
        b.box(SEAT, 0.42, 0.78, 0.12, x, FLOOR + 0.42, z - 0.26);
        b.box(0xf8fafc, 0.36, 0.2, 0.13, x, FLOOR + 1.02, z - 0.26);
      }
    }
    // Passengers ahead: the backs of a few heads over the seats
    for (const [x, z, hair] of [[-0.98, 1.3, 0x1c1917], [0.52, 0.38, 0x292524], [-0.52, -0.54, 0x1c1917], [0.98, 2.22, 0x44403c]] as Array<[number, number, number]>) {
      b.box(0x6b4226, 0.24, 0.26, 0.24, x, FLOOR + 1.2, z - 0.12);
      b.box(hair, 0.26, 0.1, 0.26, x, FLOOR + 1.44, z - 0.12);
    }
    // The driver, the wheel in front of him, the dashboard
    b.box(0x111827, 0.5, 0.9, 0.14, -0.72, FLOOR + 0.4, FRONT - 1.9);
    b.box(0x0f5132, 0.46, 0.5, 0.26, -0.72, FLOOR + 0.75, FRONT - 1.7);
    b.box(0x6b4226, 0.26, 0.28, 0.26, -0.72, FLOOR + 1.27, FRONT - 1.7);
    b.box(0x18181b, 0.5, 0.06, 0.5, -0.72, FLOOR + 0.95, FRONT - 1.05);
    b.box(0x1f2937, HALF * 2 - 0.1, 0.3, 0.6, 0, FLOOR + 0.5, FRONT - 0.4);
    // The clock over the screen
    b.box(0xfde68a, 0.5, 0.14, 0.03, 0.4, FLOOR + 1.92, FRONT - 0.06, { glow: true });

    this.coachGroup = b.build('coach cabin');
    this.coachGroup.visible = false;
    this.group.add(this.coachGroup);
  }

  // =========================================================================
  // 1. STREET SCENERY & SURROUNDING BUILDINGS
  // =========================================================================
  private buildStreetScenery(): void {
    const roadWidth = 16;
    const roadLen = 300;

    // Asphalt Road
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLen);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.05;
    this.sceneryGroup.add(road);

    // Yellow Dashed Centerlines
    const stripeGeo = new THREE.PlaneGeometry(0.3, 3.5);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let z = -140; z <= 140; z += 7) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.06, z);
      this.sceneryGroup.add(stripe);
    }

    // Sidewalks
    const walkGeo = new THREE.BoxGeometry(4.0, 0.25, roadLen);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

    const walkL = new THREE.Mesh(walkGeo, walkMat);
    walkL.position.set(-10, 0.12, 0);
    this.sceneryGroup.add(walkL);

    const walkR = new THREE.Mesh(walkGeo, walkMat);
    walkR.position.set(10, 0.12, 0);
    this.sceneryGroup.add(walkR);

    // Street Stalls with colorful awnings along sidewalk
    const canopyColors = [0xdc2626, 0x2563eb, 0x16a34a, 0xf59e0b, 0x9333ea];
    for (let z = -120; z <= 120; z += 18) {
      // Left stall
      const cColor = canopyColors[Math.abs(z) % canopyColors.length];
      const stallL = WorldMapPrefabs.createShopPlaza(cColor, 0.75);
      stallL.position.set(-14, 0.25, z);
      this.sceneryGroup.add(stallL);

      // Right stall
      const stallR = WorldMapPrefabs.createShopPlaza(canopyColors[(Math.abs(z) + 1) % canopyColors.length], 0.75);
      stallR.position.set(14, 0.25, z + 8);
      this.sceneryGroup.add(stallR);
    }
  }

  // =========================================================================
  // 2. 3D FIRST-PERSON COCKPIT (Mercedes G-Wagon Dashboard & Steering Wheel)
  // =========================================================================
  private buildPlayerVehicleCockpit(): void {
    const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.25,
    });

    // A. Main Dashboard Deck
    const dashGeo = new THREE.BoxGeometry(2.3, 0.45, 1.1);
    const dashboard = new THREE.Mesh(dashGeo, dashMat);
    dashboard.position.set(0, 1.15, 0.55);
    this.vehicleGroup.add(dashboard);

    // Instrument Cluster Visor
    const binnacleGeo = new THREE.BoxGeometry(0.75, 0.25, 0.5);
    const binnacle = new THREE.Mesh(binnacleGeo, dashMat);
    binnacle.position.set(-0.45, 1.45, 0.35);
    this.vehicleGroup.add(binnacle);

    // Central Infotainment Screen
    const screenGeo = new THREE.BoxGeometry(0.55, 0.3, 0.08);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0.1, 1.48, 0.5);
    this.vehicleGroup.add(screen);

    // B. 3D Steering Wheel (matching Screenshot 1)
    this.steeringWheel = new THREE.Group();
    this.steeringWheel.position.set(-0.45, 1.25, 0.22);
    this.steeringWheel.rotation.x = -0.38;

    // Torus rim
    const rimGeo = new THREE.TorusGeometry(0.32, 0.045, 12, 28);
    const rim = new THREE.Mesh(rimGeo, leatherMat);
    this.steeringWheel.add(rim);

    // Center Horn Boss
    const bossGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16);
    const boss = new THREE.Mesh(bossGeo, leatherMat);
    boss.rotation.x = Math.PI / 2;
    this.steeringWheel.add(boss);

    // Spokes
    const spokeGeo = new THREE.BoxGeometry(0.56, 0.05, 0.03);
    const spoke = new THREE.Mesh(spokeGeo, chromeMat);
    this.steeringWheel.add(spoke);

    this.vehicleGroup.add(this.steeringWheel);

    // C. Windshield & A-Pillars Frame
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });

    // Left A-Pillar
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), pillarMat);
    pillarL.position.set(-1.15, 1.7, 0.7);
    pillarL.rotation.z = -0.22;
    pillarL.rotation.x = 0.35;
    this.vehicleGroup.add(pillarL);

    // Right A-Pillar
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), pillarMat);
    pillarR.position.set(1.15, 1.7, 0.7);
    pillarR.rotation.z = 0.22;
    pillarR.rotation.x = 0.35;
    this.vehicleGroup.add(pillarR);

    // Windshield Glass
    const glassGeo = new THREE.PlaneGeometry(2.2, 1.0);
    const windshield = new THREE.Mesh(glassGeo, glassMat);
    windshield.position.set(0, 1.72, 0.75);
    windshield.rotation.x = -0.35;
    this.vehicleGroup.add(windshield);

    // Rearview Mirror
    const mirrorGeo = new THREE.BoxGeometry(0.35, 0.12, 0.08);
    const mirror = new THREE.Mesh(mirrorGeo, dashMat);
    mirror.position.set(0, 2.15, 0.65);
    this.vehicleGroup.add(mirror);

    // Hood / Bonnet extending outward
    const hoodGeo = new THREE.BoxGeometry(2.1, 0.15, 1.6);
    const hoodMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4 });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(0, 1.05, 1.8);
    this.vehicleGroup.add(hood);
  }

  // =========================================================================
  // 3. DENSE TRAFFIC STREAM (Go-Slow: Danfos, Sedans, Blue Taxis, SUVs)
  // =========================================================================
  private buildDenseTraffic(): void {
    const trafficConfigs = [
      // Right ahead in player lane
      { type: 'car', color: 0xfef08a, offset: new THREE.Vector3(-0.45, 0, 7.5) },
      { type: 'car', color: 0xdc2626, offset: new THREE.Vector3(-0.45, 0, 14.5) },
      { type: 'danfo', color: 0xfacc15, offset: new THREE.Vector3(-0.45, 0, 22.0) },
      // Adjacent left lane
      { type: 'car', color: 0x0284c7, offset: new THREE.Vector3(-4.2, 0, 5.0) }, // Blue PH taxi
      { type: 'car', color: 0x475569, offset: new THREE.Vector3(-4.2, 0, 12.0) },
      { type: 'danfo', color: 0xfacc15, offset: new THREE.Vector3(-4.2, 0, 19.5) },
      // Opposite northbound lanes
      { type: 'car', color: 0x0284c7, offset: new THREE.Vector3(3.8, 0, 8.0) },
      { type: 'car', color: 0x16a34a, offset: new THREE.Vector3(3.8, 0, 16.0) },
      { type: 'danfo', color: 0xfacc15, offset: new THREE.Vector3(3.8, 0, 25.0) },
    ];

    for (const conf of trafficConfigs) {
      const car = WorldMapPrefabs.createMiniVehicle(conf.type as any, conf.color);
      car.scale.set(1.5, 1.5, 1.5);
      car.position.copy(conf.offset);
      car.position.y = 0.35;
      this.trafficGroup.add(car);

      this.trafficCars.push({
        mesh: car,
        baseZ: conf.offset.z,
        speed: 3.5 + Math.random() * 1.5,
      });
    }
  }

  // =========================================================================
  // RIDE LIFECYCLE & CAMERAS
  // =========================================================================
  public startRide(ride: RideDetails): void {
    this.currentRide = ride;
    this.isActive = true;
    this.group.visible = true;
    this.elapsedTime = 0;
    this.totalDuration = ride.durationSeconds || 24;

    // A coach is ridden from a passenger's seat, on an open road; anything else is driven in traffic
    this.byCoach = ride.vehicleType === 'coach';
    this.vehicleGroup.visible = !this.byCoach;
    this.trafficGroup.visible = !this.byCoach;
    this.coachGroup.visible = this.byCoach;

    this.setCameraView('inside');
  }

  public setCameraView(view: RideCameraView): void {
    this.currentCameraView = view;
    this.updateCameraTransform();
  }

  public skipRide(): void {
    this.completeRide();
  }

  private completeRide(): void {
    this.isActive = false;
    this.group.visible = false;
    if (this.currentRide) {
      this.onRideCompleted?.(this.currentRide);
    }
  }

  private updateCameraTransform(): void {
    if (this.byCoach) {
      if (this.currentCameraView === 'inside') {
        // A seat by the window on the right, a few rows back: the aisle and the screen ahead, the road going by beside
        this.rideCamera.position.set(0.86, 2.12, -1.9);
        this.cameraTarget.set(-0.1, 1.95, 9);
      } else if (this.currentCameraView === 'chase') {
        this.rideCamera.position.set(0, 5.6, -15);
        this.cameraTarget.set(0, 2, 4);
      } else {
        this.rideCamera.position.set(11, 3.2, 1);
        this.cameraTarget.set(0, 1.8, 0.5);
      }
      this.rideCamera.lookAt(this.cameraTarget);
      return;
    }
    if (this.currentCameraView === 'inside') {
      // First-person cockpit view behind steering wheel
      this.rideCamera.position.set(-0.45, 1.52, -0.05);
      this.cameraTarget.set(-0.45, 1.48, 12);
      this.rideCamera.lookAt(this.cameraTarget);
    } else if (this.currentCameraView === 'chase') {
      // Third-person chase cam behind vehicle
      this.rideCamera.position.set(0, 3.8, -7.5);
      this.cameraTarget.set(0, 1.6, 6);
      this.rideCamera.lookAt(this.cameraTarget);
    } else {
      // Side tracking profile shot
      this.rideCamera.position.set(6.5, 2.2, 1.5);
      this.cameraTarget.set(0, 1.5, 2.5);
      this.rideCamera.lookAt(this.cameraTarget);
    }
  }

  // =========================================================================
  // UPDATE LOOP (Steering micro-movement, Go-slow stop & go, scenery scroll)
  // =========================================================================
  public update(delta: number): void {
    if (!this.isActive) return;

    this.animTime += delta;
    this.elapsedTime += delta;

    // Gentle micro-steer oscillation on steering wheel
    if (this.steeringWheel) {
      this.steeringWheel.rotation.z = Math.sin(this.animTime * 1.8) * 0.08;
    }

    // Go-slow traffic bumper movement
    for (const car of this.trafficCars) {
      car.mesh.position.z += Math.sin(this.animTime * 2.2) * 0.02;
    }

    // Scenery backward scrolling to simulate forward motion
    const speed = this.byCoach ? 15.0 : 6.0;
    this.sceneryGroup.position.z -= speed * delta;
    if (this.sceneryGroup.position.z < -60) {
      this.sceneryGroup.position.z += 60;
    }

    // Auto complete ride at end of duration
    if (this.elapsedTime >= this.totalDuration) {
      this.completeRide();
    }
  }

  public handleResize(): void {
    this.rideCamera.aspect = window.innerWidth / window.innerHeight;
    this.rideCamera.updateProjectionMatrix();
  }
}
