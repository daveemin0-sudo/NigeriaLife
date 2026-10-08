import * as THREE from 'three';
import type { RideDetails, RideCameraView } from './TransitTypes';
import { WorldMapPrefabs } from '../world/map/WorldMapPrefabs';

export class RoadRideExperience {
  public group: THREE.Group;
  public isActive: boolean = false;
  public currentCameraView: RideCameraView = 'inside';

  // Dedicated Camera
  public rideCamera: THREE.PerspectiveCamera;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Subgroups
  private vehicleGroup: THREE.Group = new THREE.Group();
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
    this.buildDenseTraffic();
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
    const speed = 6.0;
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
