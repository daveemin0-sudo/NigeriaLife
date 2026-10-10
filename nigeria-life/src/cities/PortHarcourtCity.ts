import * as THREE from 'three';
import type { CityInstance } from './CityTypes';
import type { InteractiveObject } from '../world/World';
import { WorldMapPrefabs } from '../world/map/WorldMapPrefabs';

export class PortHarcourtCity implements CityInstance {
  public group: THREE.Group;
  public interactiveList: InteractiveObject[] = [];
  public groundMesh: THREE.Mesh;

  private animTime: number = 0;
  private flareFlame!: THREE.Mesh;

  constructor() {
    this.group = new THREE.Group();

    // 1. Niger Delta Tropical Ground
    const groundGeo = new THREE.PlaneGeometry(320, 320);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Lush Niger Delta greenery
      roughness: 0.85,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.group.add(this.groundMesh);

    // 2. Aba Road Primary Commercial Street
    this.buildAbaRoad();

    // 3. Port Harcourt Creek Canal with Mangroves
    this.buildCreekCanal();

    // 4. Trans-Amadi Petrochemical Refinery & Flare Stack
    this.buildRefineryHub();

    // 5. Authentic Port Harcourt Bole King & Roasted Fish Stall
    this.buildBoleKingSpot();

    // 6. Uniport Academic Colonnade Arch
    this.buildUniportArch();

    // 7. Port Harcourt Blue & White Taxis
    this.buildPortHarcourtCabs();

    // 8. Inter-State Transit Hub to Lagos & Abuja
    this.buildTransitHub();
  }

  // =========================================================================
  // 1. ABA ROAD CORRIDOR
  // =========================================================================
  private buildAbaRoad(): void {
    const roadWidth = 18;
    const roadLen = 260;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLen);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.05;
    road.receiveShadow = true;
    this.group.add(road);

    // Yellow Dashed Centerlines
    const stripeGeo = new THREE.PlaneGeometry(0.3, 3.0);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (let z = -120; z <= 120; z += 6) {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0, 0.06, z);
      this.group.add(stripe);
    }

    // Concrete Sidewalks
    const walkGeo = new THREE.BoxGeometry(3.5, 0.3, roadLen);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });

    const walkL = new THREE.Mesh(walkGeo, walkMat);
    walkL.position.set(-10.75, 0.15, 0);
    walkL.receiveShadow = true;
    this.group.add(walkL);

    const walkR = new THREE.Mesh(walkGeo, walkMat);
    walkR.position.set(10.75, 0.15, 0);
    walkR.receiveShadow = true;
    this.group.add(walkR);

    // Street Lamps along curb
    for (let z = -100; z <= 100; z += 25) {
      const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5.5, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 });
      const lampL = new THREE.Mesh(poleGeo, poleMat);
      lampL.position.set(-11.5, 2.75, z);
      this.group.add(lampL);

      const lampR = new THREE.Mesh(poleGeo, poleMat);
      lampR.position.set(11.5, 2.75, z);
      this.group.add(lampR);
    }
  }

  // =========================================================================
  // 2. PORT HARCOURT CREEK CANAL
  // =========================================================================
  private buildCreekCanal(): void {
    const canalGeo = new THREE.PlaneGeometry(28, 280);
    const canalMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Tropical delta sparkling blue
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9,
    });
    const canal = new THREE.Mesh(canalGeo, canalMat);
    canal.rotation.x = -Math.PI / 2;
    canal.position.set(65, 0.02, 0);
    this.group.add(canal);

    // Mangrove Palms along banks
    for (let z = -120; z <= 120; z += 22) {
      const palm = WorldMapPrefabs.createTree(true, 1.2);
      palm.position.set(48, 0.1, z);
      this.group.add(palm);
    }
  }

  // =========================================================================
  // 3. TRANS-AMADI REFINERY BACKDROP
  // =========================================================================
  private buildRefineryHub(): void {
    const refGroup = WorldMapPrefabs.createPetrochemicalRefinery(1.4);
    refGroup.position.set(38, 0, -50);
    this.group.add(refGroup);

    // Flare stack flame reference for animation
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    this.flareFlame = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.2, 8), flameMat);
    this.flareFlame.position.set(45, 18, -54);
    this.group.add(this.flareFlame);

    // Refinery Gatehouse Interaction
    const gateBox = new THREE.Mesh(
      new THREE.BoxGeometry(4.0, 3.0, 4.0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
    );
    gateBox.position.set(30, 1.5, -35);
    this.group.add(gateBox);

    this.interactiveList.push({
      mesh: gateBox,
      id: 'ph-refinery-complex',
      name: 'Trans-Amadi Petrochemical Complex',
      category: 'Petrochemical Industry',
      description: 'Major oil and gas refining center, storage tanks, and engineering operations.',
      interactionPoint: new THREE.Vector3(30, 0, -35),
    });
  }

  // =========================================================================
  // 4. PORT HARCOURT BOLE KING & ROASTED FISH STALL
  // =========================================================================
  private buildBoleKingSpot(): void {
    const bole = WorldMapPrefabs.createBoleSpot(1.4);
    bole.position.set(-16, 0, 15);
    this.group.add(bole);

    // Interactive Trigger Box
    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(5.0, 3.0, 5.0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
    );
    trigger.position.set(-16, 1.5, 15);
    this.group.add(trigger);

    this.interactiveList.push({
      mesh: trigger,
      id: 'ph-bole-king',
      name: 'Port Harcourt Bole King & Roasted Fish',
      category: 'Street Food',
      description: 'Legendary charcoal-grilled plantain with spicy pepper sauce and smoked mackerel fish.',
      interactionPoint: new THREE.Vector3(-16, 0, 15),
    });
  }

  // =========================================================================
  // 5. UNIPORT ACADEMIC ARCH
  // =========================================================================
  private buildUniportArch(): void {
    const gate = WorldMapPrefabs.createUniportGate(1.3);
    gate.position.set(-35, 0, -40);
    this.group.add(gate);

    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 4.0, 6.0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
    );
    trigger.position.set(-35, 2.0, -40);
    this.group.add(trigger);

    this.interactiveList.push({
      mesh: trigger,
      id: 'ph-uniport',
      name: 'University of Port Harcourt (Uniport)',
      category: 'Education',
      description: 'Prestigious federal university, lecture halls, faculties, and student halls.',
      interactionPoint: new THREE.Vector3(-35, 0, -40),
    });
  }

  // =========================================================================
  // 6. PORT HARCOURT BLUE & WHITE CABS
  // =========================================================================
  private buildPortHarcourtCabs(): void {
    for (const z of [-30, 0, 35]) {
      const cab = WorldMapPrefabs.createMiniVehicle('car', 0x0284c7);
      cab.scale.set(1.4, 1.4, 1.4);
      cab.position.set(7.5, 0.25, z);
      this.group.add(cab);
    }
  }

  // =========================================================================
  // 7. TRANSIT HUB TO LAGOS & ABUJA
  // =========================================================================
  private buildTransitHub(): void {
    const terminal = WorldMapPrefabs.createShopPlaza(0x1e3a8a, 1.3);
    terminal.position.set(18, 0, 45);
    this.group.add(terminal);

    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 4.0, 7.0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0 })
    );
    trigger.position.set(18, 2.0, 45);
    this.group.add(trigger);

    this.interactiveList.push({
      mesh: trigger,
      id: 'ph-transit-hub',
      name: 'Port Harcourt Interstate Transit Terminal',
      category: 'Inter-State Travel',
      description: 'Direct flight connections and luxury interstate express buses to Lagos and Abuja.',
      // On the forecourt between the pavement and the terminal, not in the middle of the building
      interactionPoint: new THREE.Vector3(13.6, 0, 45),
    });
  }

  // Update Animation
  public update(delta: number): void {
    this.animTime += delta;
    if (this.flareFlame) {
      this.flareFlame.scale.y = 1.0 + Math.sin(this.animTime * 12.0) * 0.25;
      this.flareFlame.scale.x = 1.0 + Math.cos(this.animTime * 10.0) * 0.15;
    }
  }
}
