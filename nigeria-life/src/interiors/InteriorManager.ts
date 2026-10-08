import * as THREE from 'three';
import type { InteriorDefinition, InteriorType } from './InteriorTypes';
import { HospitalInterior } from './templates/HospitalInterior';
import { BankInterior } from './templates/BankInterior';
import { RestaurantInterior } from './templates/RestaurantInterior';
import { PoliceInterior } from './templates/PoliceInterior';
import { ResidentialInterior } from './templates/ResidentialInterior';
import type { InteractiveObject } from '../world/World';
import type { Player } from '../player/Player';
import type { GameCamera } from '../game/Camera';
import type { HUD } from '../ui/HUD';

export class InteriorManager {
  private static instance: InteriorManager | null = null;
  public group: THREE.Group;

  // Interior Template Instances
  public hospital: HospitalInterior;
  public bank: BankInterior;
  public restaurant: RestaurantInterior;
  public police: PoliceInterior;
  public residence: ResidentialInterior;

  // Active state
  public currentInterior: InteriorDefinition | null = null;
  private streetReturnPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private streetReturnRotation: number = 0;
  private animTime: number = 0;

  public static getInstance(): InteriorManager {
    if (!InteriorManager.instance) {
      InteriorManager.instance = new InteriorManager();
    }
    return InteriorManager.instance;
  }

  constructor() {
    InteriorManager.instance = this;
    this.group = new THREE.Group();
    this.group.name = 'interior_world_layer';

    // Instantiate all simulated destinations
    this.hospital = new HospitalInterior();
    this.bank = new BankInterior();
    this.restaurant = new RestaurantInterior();
    this.police = new PoliceInterior();
    this.residence = new ResidentialInterior();

    this.group.add(this.hospital.group);
    this.group.add(this.bank.group);
    this.group.add(this.restaurant.group);
    this.group.add(this.police.group);
    this.group.add(this.residence.group);
  }

  /**
   * Get all interactive objects across all active interiors.
   */
  public getAllInteractiveObjects(): InteractiveObject[] {
    return [
      ...this.hospital.interactiveList,
      ...this.bank.interactiveList,
      ...this.restaurant.interactiveList,
      ...this.police.interactiveList,
      ...this.residence.interactiveList,
    ];
  }

  /**
   * Find interior definition matching a street building ID or interior ID.
   */
  public getInteriorByBuildingId(id: string): InteriorDefinition | null {
    const list = [
      this.hospital.def,
      this.bank.def,
      this.restaurant.def,
      this.police.def,
      this.residence.def,
    ];

    const match = list.find((item) => 
      item.streetBuildingId === id ||
      item.id === id ||
      (id === 'lagos-bank' && item.type === 'bank') ||
      (id === 'mama-put' && item.type === 'restaurant') ||
      (id === 'lagos-hospital' && item.type === 'hospital') ||
      (id === 'police-station' && item.type === 'police') ||
      ((id === 'villa-compound' || id === 'palm-view-flats' || id === 'residential-compound') && item.type === 'residence')
    );

    return match || null;
  }

  /**
   * Enter a simulated interior destination.
   */
  public enterInterior(
    typeOrId: InteriorType | string,
    player: Player,
    cameraManager: GameCamera,
    hud: HUD
  ): boolean {
    const target = this.getInteriorByBuildingId(typeOrId);
    if (!target) return false;

    // Save street return location outside
    this.streetReturnPosition.copy(player.position);
    this.streetReturnRotation = player.mesh.rotation.y;

    // Teleport player inside past the front door
    const spawnPos = target.interiorOrigin.clone().add(target.playerSpawnOffset);
    player.mesh.position.copy(spawnPos);
    player.position.copy(spawnPos);
    player.mesh.rotation.y = 0; // Face forward into the room

    this.currentInterior = target;

    // Adjust camera to interior perspective
    cameraManager.setMode('home');

    // Notify player in HUD
    hud.updateLocation(target.name, target.districtName);
    this.showInteriorBanner(target.name, `Entered ${target.type.toUpperCase()} destination. Explore rooms, talk to staff, and interact with stations.`);

    return true;
  }

  /**
   * Exit the current interior and return to street mode right outside the building door.
   */
  public exitCurrentInterior(
    player: Player,
    cameraManager: GameCamera,
    hud: HUD
  ): void {
    if (!this.currentInterior) return;

    // Teleport player back to street door outside
    player.mesh.position.copy(this.streetReturnPosition);
    player.position.copy(this.streetReturnPosition);
    player.mesh.rotation.y = this.streetReturnRotation;

    const exitedName = this.currentInterior.name;
    this.currentInterior = null;

    // Restore standard third-person street camera
    cameraManager.setMode('street');

    // Restore district name in HUD
    hud.updateLocation('Broad Street', 'Lagos Commercial Core');
    this.showInteriorBanner('Lagos Streets', `Exited ${exitedName}. Back in street mode.`);
  }

  public isPlayerInside(): boolean {
    return this.currentInterior !== null;
  }

  public update(delta: number): void {
    this.animTime += delta;

    this.hospital.update(delta, this.animTime);
    this.bank.update(delta, this.animTime);
    this.restaurant.update(delta, this.animTime);
    this.police.update(delta, this.animTime);
    this.residence.update(delta, this.animTime);
  }

  private showInteriorBanner(title: string, subtitle: string): void {
    let banner = document.getElementById('interior-transition-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'interior-transition-banner';
      banner.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid #38bdf8;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 15px rgba(56, 189, 248, 0.4);
        padding: 12px 24px;
        border-radius: 12px;
        color: #ffffff;
        font-family: 'Inter', sans-serif;
        text-align: center;
        z-index: 9999;
        pointer-events: none;
        transition: opacity 0.5s ease;
      `;
      document.body.appendChild(banner);
    }

    banner.innerHTML = `
      <div style="font-size: 16px; font-weight: 800; color: #38bdf8; letter-spacing: 0.5px;">📍 ${title}</div>
      <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${subtitle}</div>
    `;
    banner.style.opacity = '1';

    setTimeout(() => {
      if (banner) banner.style.opacity = '0';
    }, 3500);
  }
}
