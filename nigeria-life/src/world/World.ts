import * as THREE from 'three';
import { Roads } from './Roads';
import { Buildings } from './Buildings';
import { Vehicles } from './Vehicles';
import { NPCs } from './NPCs';
import { Districts } from './Districts';
import { WeatherSystem } from './WeatherSystem';
import { CityManager } from '../cities/CityManager';
import { ApartmentInterior } from './ApartmentInterior';
import { SkyEnvironmentManager } from './SkyEnvironmentManager';
import { AtmosphereManager } from './AtmosphereManager';
import { CityDensityManager } from './density/CityDensityManager';
import { TrafficSpawner } from './traffic/TrafficSpawner';
import { CityPopulation } from './population/CityPopulation';
import { WorldMap } from './map/WorldMap';
import { WorldDataManager } from './data/WorldDataManager';
import { InteriorManager } from '../interiors/InteriorManager';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';

export interface InteractiveObject {
  mesh: THREE.Object3D;
  id: string;
  name: string;
  category: string;
  description: string;
  interactionPoint: THREE.Vector3;
}

export interface InteractionTarget {
  id: string;
  name: string;
  category: string;
  label: string;
  action: 'enter-interior' | 'exit-interior' | 'enter-vehicle' | 'interact' | 'inspect' | 'trade' | 'talk' | 'use';
  distance: number;
  interactionPoint: THREE.Vector3;
  interactiveObject: InteractiveObject;
  interiorId?: string;
  type?: string;
}

export class World {
  public scene: THREE.Scene;
  public groundMesh!: THREE.Mesh;
  public interactiveObjects: InteractiveObject[] = [];

  public roads: Roads;
  public buildings: Buildings;
  public vehicles: Vehicles;
  public npcs: NPCs;
  public districts: Districts;
  public apartment: ApartmentInterior;
  public interiorManager: InteriorManager;
  public weather: WeatherSystem;
  public atmosphere: AtmosphereManager;
  public cityManager: CityManager;
  public skyEnvironment: SkyEnvironmentManager;

  // Visual Scale, Density, and Population extensions
  public cityDensity: CityDensityManager;
  public trafficSpawner: TrafficSpawner;
  public cityPopulation: CityPopulation;
  public worldMap: WorldMap;
  public dataManager: WorldDataManager;

  /** Gameplay camera, used to cull the instanced crowd and traffic to what is on screen */
  public viewCamera?: THREE.Camera;
  private viewFrustum = new THREE.Frustum();
  private viewMatrix = new THREE.Matrix4();

  public sunLight!: THREE.DirectionalLight;
  public hemiLight!: THREE.HemisphereLight;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.dataManager = WorldDataManager.getInstance();

    // 0. Procedural Sky Shader, PMREM Reflections, Sun & Fog
    this.skyEnvironment = new SkyEnvironmentManager(this.scene, renderer);
    this.sunLight = this.skyEnvironment.sunLight;
    this.hemiLight = this.skyEnvironment.hemiLight;

    this.createGround();

    // 1. Atmosphere & Weather Systems
    this.atmosphere = new AtmosphereManager(this.scene);
    this.weather = new WeatherSystem(this.scene);
    this.weather.registerLights(this.sunLight, this.hemiLight);
    this.weather.registerAtmosphere(this.atmosphere);

    // 2. Roads Network & Street Furniture
    this.roads = new Roads();
    this.scene.add(this.roads.group);
    this.weather.registerRoadMaterial(this.roads.asphaltMat);
    this.roads.setNightLighting(this.skyEnvironment.currentPeriod);
    this.skyEnvironment.onPeriodChange = (period) => {
      this.roads.setNightLighting(period);
    };

    // 3. Lagos Architectural Buildings
    this.buildings = new Buildings();
    this.scene.add(this.buildings.group);

    // 4. Vehicles (Drivable Danfo, Keke, SUV + Traffic)
    this.vehicles = new Vehicles();
    this.scene.add(this.vehicles.group);

    // 5. Pedestrian NPCs & Street Vendors
    this.npcs = new NPCs();
    this.scene.add(this.npcs.group);

    // 6. Lagos Expansion Multi-Districts (VI, Computer Village, Lekki Bridge)
    this.districts = new Districts();
    this.scene.add(this.districts.group);

    // 6b. Dense Lagos Island city fabric: side streets, instanced tenements, plazas and towers.
    // Built after the hand-made buildings and districts so it can fill in around them.
    this.cityDensity = new CityDensityManager([this.buildings.group, this.districts.group]);
    this.scene.add(this.cityDensity.group);

    // 6c. Instanced go-slow traffic on Broad Street & Martins Street, parked cars on back streets
    this.trafficSpawner = new TrafficSpawner(this.vehicles, this.cityDensity.fabric.parkingSpots);
    this.scene.add(this.trafficSpawner.group);

    // 6d. Instanced street crowd (walkers, bus-stop queues, stall traders)
    this.cityPopulation = new CityPopulation(this.cityDensity.fabric.walkRuns, this.cityDensity.fabric.stallSpots);
    this.scene.add(this.cityPopulation.group);

    // 7. Cutaway 3D Apartment Interior (Home Mode)
    this.apartment = new ApartmentInterior();
    this.scene.add(this.apartment.group);

    // 8. 3-Tier Interior & Activity Destination Engine (Hospital, Bank, Buka, Police, Residence)
    this.interiorManager = InteriorManager.getInstance();
    this.scene.add(this.interiorManager.group);

    // 9. Dedicated Isometric World Map Presentation Layer
    this.worldMap = new WorldMap(this.scene);

    // Combine all clickable interactive objects across starter zone, districts, apartment, and simulated interiors
    this.interactiveObjects = [
      ...this.buildings.interactiveList,
      ...this.npcs.interactiveList,
      ...this.vehicles.interactiveList,
      ...this.districts.interactiveList,
      ...this.apartment.interactiveList,
      ...this.interiorManager.getAllInteractiveObjects(),
    ];

    // 10. Multi-City Nigerian Architecture Manager (Lagos, Abuja FCT, etc.)
    this.cityManager = new CityManager(this.scene);
    this.cityManager.registerSunLight(this.sunLight);
    this.cityManager.registerLagosInteractive(this.interactiveObjects);
    this.cityManager.registerLagosGroups([
      this.roads.group,
      this.buildings.group,
      this.cityDensity.group,
      this.vehicles.group,
      this.trafficSpawner.group,
      this.npcs.group,
      this.cityPopulation.group,
      this.districts.group,
      this.apartment.group,
      this.interiorManager.group,
      this.atmosphere.group,
      this.groundMesh,
    ]);

    // Layer separation: Tag street objects to STREET layer
    const streetObjects = [
      this.roads.group,
      this.buildings.group,
      this.cityDensity.group,
      this.vehicles.group,
      this.trafficSpawner.group,
      this.npcs.group,
      this.cityPopulation.group,
      this.districts.group,
      this.apartment.group,
      this.atmosphere.group,
      this.groundMesh,
    ];
    for (const obj of streetObjects) {
      obj.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
    }

    // Tag Interior objects to INTERIOR layer
    this.interiorManager.group.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  }

  private createGround(): void {
    // Large terrain base covering broad st and all expanded districts
    const groundGeo = new THREE.PlaneGeometry(320, 320);
    const groundMat = this.createUrbanGroundMaterial();
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = 0;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  /**
   * Lagos Island is built-up edge to edge: the terrain between plots is worn concrete
   * and packed laterite, not lawn.
   */
  private createUrbanGroundMaterial(): THREE.MeshStandardMaterial {
    const S = 256;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#9b8f80';
    ctx.fillRect(0, 0, S, S);

    // Deterministic speckle: laterite dust, oil stains and patched concrete
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const tones = ['#a8876a', '#8a8177', '#b09a82', '#7d766c', '#a39582'];
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.globalAlpha = 0.12 + rand() * 0.2;
      const r = 2 + rand() * 14;
      ctx.fillRect(rand() * S, rand() * S, r, r * (0.5 + rand()));
    }
    ctx.globalAlpha = 1;

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(36, 36);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;

    return new THREE.MeshStandardMaterial({ map, roughness: 0.97, metalness: 0 });
  }

  public setStreetModeVisibility(visible: boolean): void {
    const lagosGroups = [
      this.roads.group,
      this.buildings.group,
      this.cityDensity.group,
      this.vehicles.group,
      this.trafficSpawner.group,
      this.npcs.group,
      this.cityPopulation.group,
      this.districts.group,
      this.apartment.group,
      this.atmosphere.group,
      this.groundMesh,
    ];
    for (const g of lagosGroups) {
      g.visible = visible;
    }
  }

  public getDistrictAtPosition(pos: THREE.Vector3): { name: string; sub: string } {
    // If player is inside a simulated 3-Tier Interior, display that interior's name
    if (this.interiorManager.isPlayerInside() && this.interiorManager.currentInterior) {
      return {
        name: this.interiorManager.currentInterior.name,
        sub: `Interior • ${this.interiorManager.currentInterior.districtName}`,
      };
    }

    if (this.cityManager.currentCityId === 'abuja') {
      if (pos.z < -60) {
        return { name: 'Abuja FCT', sub: 'Aso Rock Monolith & Presidential Lookout' };
      }
      if (pos.x < -15) {
        return { name: 'Abuja FCT', sub: 'National Mosque & Diplomatic Zone' };
      }
      if (pos.x > 15) {
        return { name: 'Abuja FCT', sub: 'National Christian Centre & Central Area' };
      }
      return { name: 'Abuja FCT', sub: 'Shehu Shagari Way • Three Arms Zone' };
    }

    // Player Apartment Flat (Home Interior)
    if (pos.z > 165) {
      return { name: 'Lekki Luxury Flat', sub: 'Apartment Interior • Banana Island View' };
    }

    // Dynamically retrieve from unified WorldDataManager
    const district = this.dataManager.getDistrictAt(pos);
    if (district) {
      return { name: district.name, sub: district.subtitle };
    }

    return { name: 'Lagos Island', sub: 'Broad Street' };
  }

  public update(delta: number, keys: Record<string, boolean> = {}, playerPos?: THREE.Vector3, player?: any): void {
    // Update Atmospheric Sky, Sun shadow camera follow & Time-of-Day
    this.skyEnvironment.update(delta, playerPos);

    // Keep live player coordinate synced in WorldDataManager
    if (playerPos) {
      this.dataManager.updatePlayerPosition(playerPos);
    }

    // If player is inside an interior, only update the active interior simulation
    if (this.interiorManager.isPlayerInside()) {
      this.interiorManager.update(delta, player);
      return;
    }

    // If World Map mode is currently active, update dedicated WorldMap presentations
    if (this.worldMap.isActive) {
      this.worldMap.update(delta);
      return;
    }

    if (this.cityManager.currentCityId === 'abuja') {
      this.cityManager.update(delta);
      this.weather.update(delta, playerPos);
      return;
    }

    // Update vehicle movements & drivable controls
    this.vehicles.update(delta, keys);

    let frustum: THREE.Frustum | undefined;
    if (this.viewCamera) {
      this.viewMatrix.multiplyMatrices(this.viewCamera.projectionMatrix, this.viewCamera.matrixWorldInverse);
      frustum = this.viewFrustum.setFromProjectionMatrix(this.viewMatrix);
    }

    // Update instanced go-slow traffic
    this.trafficSpawner.update(delta, playerPos, frustum);

    // Update ambient NPC walking & animations
    this.npcs.update(delta, playerPos);

    // Update high-density proximity population
    this.cityPopulation.update(delta, playerPos, frustum);

    // Update building animations (e.g. compound gate)
    this.buildings.update(delta);

    // Update expanded districts (ocean waves, smoke particles)
    this.districts.update(delta);

    // Update apartment interior (standing fan rotation, TV glow, pet)
    this.apartment.update(delta);

    // Update weather effects (rain particles, lighting, thunder)
    this.weather.update(delta, playerPos);

    // Update atmosphere effects (Harmattan dust, smoke, puddles)
    this.atmosphere.update(delta, playerPos);

    // Animate and fade out street property beacon
    if (this.propertyBeacon && this.propertyBeaconTimer > 0) {
      this.propertyBeaconTimer -= delta;
      const ring = this.propertyBeacon.children[1] as THREE.Mesh;
      if (ring) {
        ring.rotation.z += delta * 2;
        const scale = 1 + Math.sin(this.propertyBeaconTimer * 4) * 0.2;
        ring.scale.set(scale, scale, 1);
      }
      if (this.propertyBeaconTimer <= 0) {
        this.scene.remove(this.propertyBeacon);
        this.propertyBeacon = null;
      }
    }

    // Update city manager
    this.cityManager.update(delta);

    // Update 3D simulated interiors (fans, smoke, NPCs)
    this.interiorManager.update(delta);
  }

  // Temporary Street Highlight Beacon for Property Navigation
  private propertyBeacon: THREE.Group | null = null;
  private propertyBeaconTimer: number = 0;

  public highlightStreetProperty(pos: { x: number; y: number; z: number } | THREE.Vector3, name: string): void {
    if (this.propertyBeacon) {
      this.scene.remove(this.propertyBeacon);
      this.propertyBeacon = null;
    }

    const beacon = new THREE.Group();
    beacon.position.set(pos.x, 0, pos.z);

    // Glowing column
    const cylinderGeo = new THREE.CylinderGeometry(0.8, 1.2, 14, 16);
    const cylinderMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
    cylinder.position.y = 7;
    beacon.add(cylinder);

    // Expanding ground ring
    const ringGeo = new THREE.RingGeometry(2.0, 2.6, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    beacon.add(ring);

    // Floating text sprite banner
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.rect(6, 6, 288, 68);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 ${name.length > 18 ? name.slice(0, 17) + '…' : name}`, 150, 46);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(8, 2.2, 1);
    sprite.position.y = 14.5;
    beacon.add(sprite);

    this.scene.add(beacon);
    this.propertyBeacon = beacon;
    this.propertyBeaconTimer = 8.0; // Show for 8 seconds
  }
}

