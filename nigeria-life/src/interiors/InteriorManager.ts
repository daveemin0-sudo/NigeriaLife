import * as THREE from 'three';
import { 
  type InteriorDefinition, 
  type InteriorType, 
  type GameLocationMode, 
  RENDER_LAYERS 
} from './InteriorTypes';
import { HospitalInterior } from './templates/HospitalInterior';
import { BankInterior } from './templates/BankInterior';
import { RestaurantInterior } from './templates/RestaurantInterior';
import { PoliceInterior } from './templates/PoliceInterior';
import { ResidentialInterior } from './templates/ResidentialInterior';
import type { InteractiveObject, World } from '../world/World';
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
  public locationMode: GameLocationMode = 'street';
  public currentInterior: InteriorDefinition | null = null;
  private streetReturnPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 5);
  private streetReturnRotation: number = 0;
  private isTransitioning: boolean = false;
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

    // All interiors are hidden by default until specifically entered
    this.hospital.group.visible = false;
    this.bank.group.visible = false;
    this.restaurant.group.visible = false;
    this.police.group.visible = false;
    this.residence.group.visible = false;

    this.group.add(this.hospital.group);
    this.group.add(this.bank.group);
    this.group.add(this.restaurant.group);
    this.group.add(this.police.group);
    this.group.add(this.residence.group);

    // Tag entire interior group with INTERIOR layer
    this.group.traverse((child) => {
      child.layers.set(RENDER_LAYERS.INTERIOR);
    });
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
   * Get interactive objects for only the currently active interior.
   */
  public getActiveInteractiveObjects(): InteractiveObject[] {
    if (!this.currentInterior) return [];
    switch (this.currentInterior.type) {
      case 'hospital': return this.hospital.interactiveList;
      case 'bank': return this.bank.interactiveList;
      case 'restaurant': return this.restaurant.interactiveList;
      case 'police': return this.police.interactiveList;
      case 'residence': return this.residence.interactiveList;
      default: return [];
    }
  }

  /**
   * Get the active interior Three.js Group.
   */
  public getActiveInteriorGroup(): THREE.Group | null {
    if (!this.currentInterior) return null;
    switch (this.currentInterior.type) {
      case 'hospital': return this.hospital.group;
      case 'bank': return this.bank.group;
      case 'restaurant': return this.restaurant.group;
      case 'police': return this.police.group;
      case 'residence': return this.residence.group;
      default: return null;
    }
  }

  /**
   * Retrieve the active floor mesh for input raycasting.
   */
  public getActiveFloorMesh(): THREE.Mesh | null {
    const activeGroup = this.getActiveInteriorGroup();
    if (!activeGroup) return null;
    const floor = activeGroup.getObjectByName('interior_floor_mesh');
    return (floor as THREE.Mesh) || null;
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
      ((id === 'villa-compound' || id === 'palm-view-flats' || id === 'residential-compound' || id === 'home') && item.type === 'residence')
    );

    return match || null;
  }

  /**
   * Enter a simulated interior destination with a cinematic transition.
   */
  public async enterInterior(
    typeOrId: InteriorType | string,
    player: Player,
    cameraManager: GameCamera,
    hud: HUD,
    world: World
  ): Promise<boolean> {
    if (this.isTransitioning) return false;
    const target = this.getInteriorByBuildingId(typeOrId);
    if (!target) return false;

    this.isTransitioning = true;

    // 1. Save street return position and rotation right outside the door
    this.streetReturnPosition.copy(player.position);
    this.streetReturnRotation = player.mesh.rotation.y;

    // 2. Start cinematic fade to black
    await this.setFadeOverlay(1);

    // 3. Update game location state
    this.locationMode = 'interior';
    this.currentInterior = target;

    // 4. HIDE the entire outdoor street world
    world.setStreetModeVisibility(false);
    world.apartment.group.visible = false;

    // 5. Isolate interior rendering: show ONLY target interior group
    this.hospital.group.visible = target.type === 'hospital';
    this.bank.group.visible = target.type === 'bank';
    this.restaurant.group.visible = target.type === 'restaurant';
    this.police.group.visible = target.type === 'police';
    this.residence.group.visible = target.type === 'residence';

    // 6. Teleport player character mesh into interior coordinates
    const spawnPos = target.interiorOrigin.clone().add(target.playerSpawnOffset);
    player.mesh.position.copy(spawnPos);
    player.position.copy(spawnPos);
    player.mesh.rotation.y = 0; // Face forward into the room
    player.stopMoving();

    // 7. Activate dedicated interior camera and layer filter
    cameraManager.setMode('interior');
    cameraManager.setLayerMode('interior');
    cameraManager.snapToPlayer(player, 'interior');

    // 8. Update HUD location badge and banner
    hud.updateLocation(target.name, `Interior • ${target.districtName}`);
    this.showInteriorBanner(
      target.name,
      `Entered ${target.name}. Explore rooms, talk to staff, and interact with stations.`
    );

    // 9. Fade back in
    await this.setFadeOverlay(0);
    this.isTransitioning = false;

    return true;
  }

  /**
   * Exit the current interior and return to street mode right outside the building door.
   */
  public async exitCurrentInterior(
    player: Player,
    cameraManager: GameCamera,
    hud: HUD,
    world: World
  ): Promise<void> {
    if (this.isTransitioning || !this.currentInterior) return;
    this.isTransitioning = true;

    const exitedName = this.currentInterior.name;

    // 1. Start cinematic fade to black
    await this.setFadeOverlay(1);

    // 2. Hide all interior groups
    this.hospital.group.visible = false;
    this.bank.group.visible = false;
    this.restaurant.group.visible = false;
    this.police.group.visible = false;
    this.residence.group.visible = false;

    // 3. RESTORE outdoor street world visibility
    world.setStreetModeVisibility(true);

    // 4. Return player character to exact outside entry coordinate and rotation
    player.mesh.position.copy(this.streetReturnPosition);
    player.position.copy(this.streetReturnPosition);
    player.mesh.rotation.y = this.streetReturnRotation;
    player.stopMoving();

    // 5. Restore street camera and layers
    cameraManager.setMode('street');
    cameraManager.setLayerMode('street');
    cameraManager.snapToPlayer(player, 'street');

    // 6. Update state
    this.currentInterior = null;
    this.locationMode = 'street';

    // 7. Restore district name in HUD
    const district = world.getDistrictAtPosition(player.position);
    hud.updateLocation(district.name, district.sub);
    this.showInteriorBanner('Lagos Street Mode', `Exited ${exitedName}. Returned to the street.`);

    // 8. Fade back in
    await this.setFadeOverlay(0);
    this.isTransitioning = false;
  }

  public isPlayerInside(): boolean {
    return this.locationMode === 'interior' && this.currentInterior !== null;
  }

  public update(delta: number, player?: Player): void {
    if (!this.isPlayerInside() || !this.currentInterior) return;

    this.animTime += delta;

    // Only update animations and NPCs of the active interior
    switch (this.currentInterior.type) {
      case 'hospital':
        this.hospital.update(delta, this.animTime);
        break;
      case 'bank':
        this.bank.update(delta, this.animTime);
        break;
      case 'restaurant':
        this.restaurant.update(delta, this.animTime);
        break;
      case 'police':
        this.police.update(delta, this.animTime);
        break;
      case 'residence':
        this.residence.update(delta, this.animTime);
        break;
    }

    // Keep player inside interior room boundaries
    if (player && this.currentInterior.rooms.length > 0) {
      const origin = this.currentInterior.interiorOrigin;
      const room = this.currentInterior.rooms[0];
      const halfW = room.size.width / 2 - 0.8;
      const halfL = room.size.length / 2 - 0.8;
      const minX = origin.x - halfW;
      const maxX = origin.x + halfW;
      const minZ = origin.z - halfL;
      const maxZ = origin.z + halfL;

      player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, minX, maxX);
      player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, minZ, maxZ);
      player.position.copy(player.mesh.position);
    }
  }

  private setFadeOverlay(opacity: number): Promise<void> {
    return new Promise((resolve) => {
      let overlay = document.getElementById('interior-fade-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'interior-fade-overlay';
        document.body.appendChild(overlay);
      }
      overlay.style.opacity = opacity.toString();
      setTimeout(resolve, 280);
    });
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
