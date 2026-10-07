import * as THREE from 'three';
import { Roads } from './Roads';
import { Buildings } from './Buildings';
import { Vehicles } from './Vehicles';
import { NPCs } from './NPCs';

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

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.createEnvironment();
    this.createGround();

    // 1. Roads Network & Street Furniture
    this.roads = new Roads();
    this.scene.add(this.roads.group);

    // 2. Lagos Architectural Buildings
    this.buildings = new Buildings();
    this.scene.add(this.buildings.group);

    // 3. Vehicles (Danfo & Keke Napep)
    this.vehicles = new Vehicles();
    this.scene.add(this.vehicles.group);

    // 4. Pedestrian NPCs & Street Vendors
    this.npcs = new NPCs();
    this.scene.add(this.npcs.group);

    // Combine all clickable interactive objects
    this.interactiveObjects = [
      ...this.buildings.interactiveList,
      ...this.npcs.interactiveList,
    ];
  }

  private createEnvironment(): void {
    // Lagos tropical sky color with warm daylight atmospheric fog
    this.scene.background = new THREE.Color(0x6eb7f2);
    this.scene.fog = new THREE.FogExp2(0xa9d6f8, 0.012);

    // Tropical Skylight
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x475569, 1.3);
    this.scene.add(hemiLight);

    // Direct Lagos Sun
    const sunLight = new THREE.DirectionalLight(0xfff5db, 2.2);
    sunLight.position.set(35, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 50;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    this.scene.add(sunLight);
  }

  private createGround(): void {
    // Large terrain base
    const groundGeo = new THREE.PlaneGeometry(240, 240);
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

  public update(delta: number): void {
    // Update vehicle movements
    this.vehicles.update(delta);

    // Update ambient NPC walking & animations
    this.npcs.update(delta);

    // Update building animations (e.g. compound gate)
    this.buildings.update(delta);
  }
}
