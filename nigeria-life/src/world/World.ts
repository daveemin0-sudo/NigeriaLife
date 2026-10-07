import * as THREE from 'three';
import { Roads } from './Roads';
import { Buildings } from './Buildings';
import { Vehicles } from './Vehicles';
import { NPCs } from './NPCs';
import { Districts } from './Districts';
import { WeatherSystem } from './WeatherSystem';
import { CityManager } from '../cities/CityManager';
import { ApartmentInterior } from './ApartmentInterior';

export interface InteractiveObject {
  mesh: THREE.Object3D;
  id: string;
  name: string;
  category: string;
  description: string;
  interactionPoint: THREE.Vector3;
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
  public weather: WeatherSystem;
  public cityManager: CityManager;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.createEnvironment();
    this.createGround();

    // 1. Weather & Atmosphere System
    this.weather = new WeatherSystem(this.scene);
    this.weather.registerLights(this.sunLight, this.hemiLight);

    // 2. Roads Network & Street Furniture
    this.roads = new Roads();
    this.scene.add(this.roads.group);
    this.weather.registerRoadMaterial(this.roads.asphaltMat);

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

    // 7. Cutaway 3D Apartment Interior (Home Mode)
    this.apartment = new ApartmentInterior();
    this.scene.add(this.apartment.group);

    // Combine all clickable interactive objects across starter zone, districts, and apartment
    this.interactiveObjects = [
      ...this.buildings.interactiveList,
      ...this.npcs.interactiveList,
      ...this.vehicles.interactiveList,
      ...this.districts.interactiveList,
      ...this.apartment.interactiveList,
    ];

    // 8. Multi-City Nigerian Architecture Manager (Lagos, Abuja FCT, etc.)
    this.cityManager = new CityManager(this.scene);
    this.cityManager.registerSunLight(this.sunLight);
    this.cityManager.registerLagosInteractive(this.interactiveObjects);
    this.cityManager.registerLagosGroups([
      this.roads.group,
      this.buildings.group,
      this.vehicles.group,
      this.npcs.group,
      this.districts.group,
      this.apartment.group,
      this.groundMesh,
    ]);
  }

  private createEnvironment(): void {
    // Lagos tropical sky color with warm daylight atmospheric fog
    this.scene.background = new THREE.Color(0x6eb7f2);
    this.scene.fog = new THREE.FogExp2(0xa9d6f8, 0.012);

    // Tropical Skylight
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.3);
    this.scene.add(this.hemiLight);

    // Direct Lagos Sun
    this.sunLight = new THREE.DirectionalLight(0xfff5db, 2.2);
    this.sunLight.position.set(35, 60, 30);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 150;
    const d = 50;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
  }

  private createGround(): void {
    // Large terrain base covering broad st and all expanded districts
    const groundGeo = new THREE.PlaneGeometry(320, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d7038, // Tropical Nigerian grass green
      roughness: 0.9,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = 0;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);
  }

  public getDistrictAtPosition(pos: THREE.Vector3): { name: string; sub: string } {
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
    // Lekki Phase 1 (East)
    if (pos.x > 35) {
      return { name: 'Lekki Phase 1', sub: 'Admiralty Way & Link Bridge' };
    }
    // Victoria Island / Eko Atlantic (South)
    if (pos.z > 50) {
      return { name: 'Victoria Island', sub: 'Eko Atlantic Waterfront' };
    }
    // Computer Village / Mainland (North)
    if (pos.z < -50) {
      return { name: 'Mainland Ikeja', sub: 'Otigba St • Computer Village' };
    }
    // Lagos Island starter zone
    return { name: 'Lagos Island', sub: 'Broad Street' };
  }

  public update(delta: number, keys: Record<string, boolean> = {}, playerPos?: THREE.Vector3): void {
    if (this.cityManager.currentCityId === 'abuja') {
      this.cityManager.update(delta);
      this.weather.update(delta, playerPos);
      return;
    }

    // Update vehicle movements & drivable controls
    this.vehicles.update(delta, keys);

    // Update ambient NPC walking & animations
    this.npcs.update(delta);

    // Update building animations (e.g. compound gate)
    this.buildings.update(delta);

    // Update expanded districts (ocean waves, smoke particles)
    this.districts.update(delta);

    // Update apartment interior (standing fan rotation, TV glow, pet)
    this.apartment.update(delta);

    // Update weather effects (rain particles, lighting, thunder)
    this.weather.update(delta, playerPos);

    // Update city manager
    this.cityManager.update(delta);
  }
}
