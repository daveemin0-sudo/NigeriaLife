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
import { UNILAGInterior } from './templates/UNILAGInterior';
import { AirportInterior } from './templates/AirportInterior';
import { ShopInterior } from './templates/ShopInterior';
import type { InteractiveObject, World } from '../world/World';
import type { Player } from '../player/Player';
import type { GameCamera } from '../game/Camera';
import type { HUD } from '../ui/HUD';
import { UIStateManager } from '../ui/UIStateManager';
import { DestinationRegistry } from '../destinations/DestinationRegistry';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { Sequence, steps } from '../interactions/Sequence';
import type { HingedDoor } from '../interactions/Door';
import type { NavGrid } from '../interactions/NavGrid';
import type { StreetDoor } from '../world/Buildings';
import { RoomCutaway } from './RoomCutaway';

/** What an interior can optionally provide beyond its room and stations. */
interface InteriorTemplate {
  group: THREE.Group;
  def: InteriorDefinition;
  interactiveList: InteractiveObject[];
  update: (delta: number, time: number) => void;
  /** Floor map for routing characters around the furniture */
  nav?: NavGrid;
  /** Called once the player is inside, and when they have left */
  onPlayerEntered?: () => void;
  onPlayerLeft?: () => void;
}

export interface EnterOptions {
  /** Where on the street the player returns to on leaving (default: where they stood on entering) */
  returnTo?: THREE.Vector3;
  returnYaw?: number;
  /** Where inside the player first appears (default: the interior's spawn point) */
  spawnAt?: THREE.Vector3;
  spawnYaw?: number;
  /** Runs once the player is standing inside, before the view fades back in */
  onPlaced?: () => void;
}

export interface ExitOptions {
  /** Where on the street the player first appears (default: the saved return position) */
  emergeAt?: THREE.Vector3;
  emergeYaw?: number;
  /** Runs once the player is standing on the street, before the view fades back in */
  onPlaced?: () => void;
}

export class InteriorManager {
  private static instance: InteriorManager | null = null;
  public group: THREE.Group;

  // Interior Template Instances
  public hospital: HospitalInterior;
  public bank: BankInterior;
  public restaurant: RestaurantInterior;
  public police: PoliceInterior;
  public residence: ResidentialInterior;
  public unilag: UNILAGInterior;
  public airport: AirportInterior;
  public shop: ShopInterior;
  /** Every interior, in one list: adding a place means adding it here */
  private templates: InteriorTemplate[];

  // Active state
  public locationMode: GameLocationMode = 'street';
  public currentInterior: InteriorDefinition | null = null;
  private streetReturnPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 5);
  private streetReturnRotation: number = 0;
  private isTransitioning: boolean = false;
  private animTime: number = 0;
  /** Street doors that lead into an interior, by interior type */
  private streetDoors = new Map<InteriorType, StreetDoor>();
  /** True from the moment the player commits to a doorway until they are through it */
  private usingDoor: boolean = false;
  /** Keeps the player in view indoors: lowers outer walls and fades whatever else is in the way */
  public readonly cutaway = new RoomCutaway();
  /** The last clear floor the player stood on indoors, to put them back when they walk into furniture */
  private lastClearSpot: THREE.Vector3 | null = null;

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
    this.unilag = new UNILAGInterior();
    this.airport = new AirportInterior();
    this.shop = new ShopInterior();
    this.templates = [
      this.hospital, this.bank, this.restaurant, this.police,
      this.residence, this.unilag, this.airport, this.shop,
    ];

    // All interiors are hidden by default until specifically entered
    for (const template of this.templates) {
      template.group.visible = false;
      this.group.add(template.group);
    }

    // Each room stands on its own plot of ground, which is all the camera sees around it
    for (const child of this.group.children) {
      child.add(this.createGroundPlot());
    }

    // Tag entire interior group with INTERIOR layer
    this.group.traverse((child) => {
      child.layers.set(RENDER_LAYERS.INTERIOR);
    });
  }

  /**
   * Get all interactive objects across all active interiors.
   */
  public getAllInteractiveObjects(): InteractiveObject[] {
    return this.templates.flatMap((template) => template.interactiveList);
  }

  /**
   * Get interactive objects for only the currently active interior.
   */
  public getActiveInteractiveObjects(): InteractiveObject[] {
    return this.getActiveTemplate()?.interactiveList ?? [];
  }

  /**
   * Get the active interior Three.js Group.
   */
  public getActiveInteriorGroup(): THREE.Group | null {
    return this.getActiveTemplate()?.group ?? null;
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
    const list = this.templates.map((template) => template.def);

    const cleanId = id.toLowerCase();
    const match = list.find((item) => 
      item.streetBuildingId === id ||
      item.id === id ||
      item.type === cleanId ||
      (id === 'hospital' && item.type === 'hospital') ||
      (id === 'st_nicholas_hospital' && item.type === 'hospital') ||
      (id === 'lagos-hospital' && item.type === 'hospital') ||
      (id === 'bank' && item.type === 'bank') ||
      (id === 'lagos-bank' && item.type === 'bank') ||
      (id === 'restaurant' && item.type === 'restaurant') ||
      (id === 'buka' && item.type === 'restaurant') ||
      (id === 'mama-put' && item.type === 'restaurant') ||
      (id === 'mama_put_buka' && item.type === 'restaurant') ||
      (id === 'chop-life' && item.type === 'restaurant') ||
      ((id === 'supermarket' || id === 'everyday_supermarket' || id === 'dest_lagos_supermarket') && item.type === 'shop') ||
      (id === 'police' && item.type === 'police') ||
      (id === 'police-station' && item.type === 'police') ||
      (id === 'residence' && item.type === 'residence') ||
      (id === 'home' && item.type === 'residence') ||
      ((id === 'villa-compound' || id === 'palm-view-flats' || id === 'residential-compound') && item.type === 'residence') ||
      ((cleanId.includes('unilag') || cleanId.includes('university') || id === 'unilag-campus' || id === 'dest_lagos_unilag') && item.type === 'university') ||
      ((cleanId.includes('airport') || cleanId.includes('mma') || id === 'mma-airport' || id === 'airport_los' || id === 'dest_lagos_airport') && item.type === 'airport')
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
    world: World,
    options: EnterOptions = {}
  ): Promise<boolean> {
    if (this.isTransitioning) return false;
    const target = this.getInteriorByBuildingId(typeOrId);
    if (!target) return false;

    this.isTransitioning = true;

    // Whatever the player was in the middle of ends here
    if (this.currentInterior) this.getActiveTemplate()?.onPlayerLeft?.();
    InteractionDirector.get().forceFree(player.actor);

    // 1. Save street return position and rotation right outside the door
    this.streetReturnPosition.copy(options.returnTo ?? player.position);
    this.streetReturnRotation = options.returnYaw ?? player.mesh.rotation.y;

    // 2. Start cinematic fade to black
    await this.setFadeOverlay(1);

    // 3. Update game location state
    this.locationMode = 'interior';
    this.currentInterior = target;
    UIStateManager.getInstance().setMode('interior');
    console.log(`[Interior] entered: ${target.id}`);

    // 4. HIDE the entire outdoor street world
    world.setStreetModeVisibility(false);
    world.apartment.group.visible = false;

    // 5. Isolate interior rendering: show ONLY target interior group
    for (const template of this.templates) {
      template.group.visible = template.def === target;
    }

    // 6. Teleport player character mesh into interior coordinates
    const spawnPos = options.spawnAt ?? target.interiorOrigin.clone().add(target.playerSpawnOffset);
    player.mesh.position.copy(spawnPos);
    player.position.copy(spawnPos);
    player.mesh.rotation.y = options.spawnYaw ?? 0; // Face forward into the room
    player.stopMoving();
    this.lastClearSpot = null;
    this.getActiveTemplate()?.onPlayerEntered?.();

    // 7. Activate dedicated interior camera and layer filter, framed on this room
    const shellSize = this.getActiveShell()?.userData.size as { width: number; length: number } | undefined;
    const room = target.rooms[0];
    cameraManager.frameRoom(
      target.interiorOrigin,
      shellSize?.width ?? room.size.width,
      shellSize?.length ?? room.size.length
    );
    cameraManager.setMode('interior');
    cameraManager.setLayerMode('interior');
    cameraManager.snapToPlayer(player, 'interior');
    const activeGroup = this.getActiveInteriorGroup();
    if (activeGroup) this.cutaway.attach(activeGroup, target.interiorOrigin);
    this.cutaway.update(0, cameraManager.camera, player.position, true);

    // 8. Update HUD location badge and banner
    hud.updateLocation(target.name, `Interior • ${target.districtName}`);
    this.showInteriorBanner(
      target.name,
      `Entered ${target.name}. Explore rooms, talk to staff, and interact with stations.`
    );

    // 9. Fade back in
    options.onPlaced?.();
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
    world: World,
    options: ExitOptions = {}
  ): Promise<void> {
    if (this.isTransitioning || !this.currentInterior) return;
    this.isTransitioning = true;

    // Leaving ends whatever the player was doing inside (a meal, a seat, an order)
    this.getActiveTemplate()?.onPlayerLeft?.();
    InteractionDirector.get().forceFree(player.actor);
    this.getActiveDoor()?.set(false);

    const exitedName = this.currentInterior.name;
    const exitedId = this.currentInterior.id;
    console.log(`[Interior] exited: ${exitedId}`);

    // 1. Start cinematic fade to black
    await this.setFadeOverlay(1);

    // 2. Hide all interior groups, with every wall and fitting back as it was
    this.cutaway.detach();
    for (const template of this.templates) {
      template.group.visible = false;
    }

    // 3. RESTORE outdoor street world visibility
    world.setStreetModeVisibility(true);

    // 4. Return player character to exact outside entry coordinate and rotation
    player.mesh.position.copy(options.emergeAt ?? this.streetReturnPosition);
    player.position.copy(player.mesh.position);
    player.mesh.rotation.y = options.emergeYaw ?? this.streetReturnRotation;
    player.stopMoving();

    // 5. Restore street camera and layers
    cameraManager.setMode('street');
    cameraManager.setLayerMode('street');
    cameraManager.snapToPlayer(player, 'street');

    // 6. Update state
    this.currentInterior = null;
    this.locationMode = 'street';
    UIStateManager.getInstance().setMode('street');

    // 7. Restore district name in HUD
    const district = world.getDistrictAtPosition(player.position);
    hud.updateLocation(district.name, district.sub);
    this.showInteriorBanner('Lagos Street Mode', `Exited ${exitedName}. Returned to the street.`);

    // 8. Fade back in
    options.onPlaced?.();
    await this.setFadeOverlay(0);
    this.isTransitioning = false;
  }

  // =========================================================================
  // DOORS: the same walk-in / walk-out for every place that has one
  // =========================================================================

  private getActiveTemplate(): InteriorTemplate | null {
    if (!this.currentInterior) return null;
    return this.templateFor(this.currentInterior.type);
  }

  private templateFor(type: InteriorType): InteriorTemplate | null {
    return this.templates.find((template) => template.def.type === type) ?? null;
  }

  /** Floor map of the current room, if it has one, for walking around the furniture. */
  public getActiveNav(): NavGrid | null {
    return this.getActiveTemplate()?.nav ?? null;
  }

  private doorOf(template: InteriorTemplate | null): { door: HingedDoor; position: THREE.Vector3; outward: THREE.Vector3 } | null {
    const doorGroup = template?.group.getObjectByName('interior_exit_door');
    const door = doorGroup?.userData.door as HingedDoor | undefined;
    if (!template || !doorGroup || !door) return null;
    const yaw = doorGroup.rotation.y;
    return {
      door,
      position: template.def.interiorOrigin.clone().add(doorGroup.position).setY(0),
      // The door faces the room, so "out" is behind it
      outward: new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)),
    };
  }

  private getActiveDoor(): HingedDoor | null {
    return this.doorOf(this.getActiveTemplate())?.door ?? null;
  }

  /** Links a door on the street to the interior behind it. */
  public registerStreetDoor(streetDoor: StreetDoor): void {
    const target = this.getInteriorByBuildingId(streetDoor.buildingId);
    if (!target) return;
    this.streetDoors.set(target.type, streetDoor);
    // The door is the one place this building is entered from: the interior's street entrance
    // and the map's arrival point both follow it
    target.streetEntrance.copy(streetDoor.outside);
    const destination = DestinationRegistry.getInstance().getById(streetDoor.buildingId);
    if (destination) {
      destination.streetPosition.copy(streetDoor.outside);
      destination.entrance.position.copy(streetDoor.outside);
    }
  }

  /**
   * Enter a place the way a person does: walk up to its door, open it, and walk through.
   * Places whose street building has no modelled door yet fall back to the plain transition.
   */
  public async enterThroughDoor(
    typeOrId: InteriorType | string,
    player: Player,
    cameraManager: GameCamera,
    hud: HUD,
    world: World
  ): Promise<boolean> {
    if (this.isTransitioning || this.usingDoor) return false;
    const target = this.getInteriorByBuildingId(typeOrId);
    if (!target) return false;

    const street = this.streetDoors.get(target.type);
    if (!street || this.isPlayerInside() || player.isDriving) {
      return this.enterInterior(typeOrId, player, cameraManager, hud, world);
    }

    const director = InteractionDirector.get();
    const actor = player.actor;
    if (director.interrupt(actor) === 'locked') return false;
    this.usingDoor = true;

    try {
      // Arriving from across town (a map trip) starts on the pavement in front of the door
      if (player.position.distanceTo(street.outside) > 30) {
        player.mesh.position.set(street.outside.x, 0, street.outside.z);
      }
      player.stopMoving();

      const walkIn = new Sequence('enter by street door', [actor]).locked().add(
        steps.walk(actor, street.outside, { ifStuck: 'snap' }),
        steps.face(actor, street.inside),
        steps.animate(actor, { arms: 'reach' }, 0.5, [{ at: 0.45, run: () => street.door.open() }]),
        steps.until('door open', () => street.door.isOpen, 2, 'continue'),
        steps.slide(actor, street.inside, 0.9, { legs: 'walk', arms: 'swing' })
      );
      if (!director.run(walkIn) || (await walkIn.finished) !== 'done') {
        street.door.close();
        return false;
      }

      const template = this.templateFor(target.type);
      const inner = this.doorOf(template);
      const doorway = inner ? inner.position.clone().addScaledVector(inner.outward, -0.4) : undefined;
      const facingIn = inner ? Math.atan2(-inner.outward.x, -inner.outward.z) : undefined;
      inner?.door.set(true);

      // Step into the room as the view fades in, and let the door close behind
      const spawn = target.interiorOrigin.clone().add(target.playerSpawnOffset);
      const stepIn = new Sequence('step inside', [actor]).locked().add(
        steps.slide(actor, spawn, 0.9, { legs: 'walk', arms: 'swing' }),
        steps.call('close door', () => inner?.door.close())
      );
      let steppingIn = false;

      const entered = await this.enterInterior(typeOrId, player, cameraManager, hud, world, {
        returnTo: street.outside,
        returnYaw: Math.atan2(street.outside.x - street.inside.x, street.outside.z - street.inside.z),
        spawnAt: doorway,
        spawnYaw: facingIn,
        onPlaced: () => { steppingIn = director.run(stepIn); },
      });
      street.door.set(false);
      if (!entered) {
        inner?.door.set(false);
        player.mesh.position.set(street.outside.x, 0, street.outside.z);
        return false;
      }
      if (steppingIn) await stepIn.finished;
      inner?.door.close();
      return true;
    } finally {
      this.usingDoor = false;
    }
  }

  /**
   * Leave the current place through its door: walk to it, open it, walk out, and come out
   * of the same door on the street that the player went in by.
   */
  public async leaveThroughDoor(
    player: Player,
    cameraManager: GameCamera,
    hud: HUD,
    world: World
  ): Promise<void> {
    if (this.isTransitioning || this.usingDoor || !this.currentInterior) return;
    const interior = this.currentInterior;
    const template = this.getActiveTemplate();
    const inner = this.doorOf(template);
    const director = InteractionDirector.get();
    const actor = player.actor;

    if (!inner) {
      await this.exitCurrentInterior(player, cameraManager, hud, world);
      return;
    }

    // Finish getting up from a seat (or whatever was going on) before heading for the door
    if (director.interrupt(actor) === 'locked') {
      await actor.sequence?.finished;
      if (this.currentInterior !== interior || this.isTransitioning || this.usingDoor) return;
    }
    player.stopMoving();

    // The walk across the room can be abandoned; the doorway itself cannot
    const insideSpot = inner.position.clone().addScaledVector(inner.outward, -1.3);
    const approach = new Sequence('walk to exit door', [actor]).add(
      steps.walk(actor, insideSpot, { nav: template?.nav, ifStuck: 'snap' })
    );
    if (!director.run(approach) || (await approach.finished) !== 'done') return;
    if (this.currentInterior !== interior || this.isTransitioning || this.usingDoor) return;

    this.usingDoor = true;
    try {
      const outsideSpot = inner.position.clone().addScaledVector(inner.outward, 1.1);
      const walkOut = new Sequence('leave by door', [actor]).locked().add(
        steps.face(actor, outsideSpot),
        steps.animate(actor, { arms: 'reach' }, 0.5, [{ at: 0.45, run: () => inner.door.open() }]),
        steps.until('door open', () => inner.door.isOpen, 2, 'continue'),
        steps.slide(actor, outsideSpot, 0.9, { legs: 'walk', arms: 'swing' })
      );
      if (!director.run(walkOut) || (await walkOut.finished) !== 'done') {
        inner.door.close();
        return;
      }

      const street = this.streetDoors.get(interior.type);
      if (!street) {
        await this.exitCurrentInterior(player, cameraManager, hud, world);
        inner.door.set(false);
        return;
      }

      // Come out of the street door as the view fades in, and let it close behind
      street.door.set(true);
      const stepOut = new Sequence('step out to street', [actor]).locked().add(
        steps.slide(actor, this.streetReturnPosition.clone(), 0.9, { legs: 'walk', arms: 'swing' }),
        steps.call('close door', () => street.door.close())
      );
      let steppingOut = false;
      await this.exitCurrentInterior(player, cameraManager, hud, world, {
        emergeAt: street.inside,
        emergeYaw: this.streetReturnRotation,
        onPlaced: () => { steppingOut = director.run(stepOut); },
      });
      inner.door.set(false);
      if (steppingOut) await stepOut.finished;
      street.door.close();
    } finally {
      this.usingDoor = false;
    }
  }

  /** Part-way through a door or a fade: wait for it before starting another transition. */
  public get busy(): boolean {
    return this.isTransitioning || this.usingDoor;
  }

  public isPlayerInside(): boolean {
    return this.locationMode === 'interior' && this.currentInterior !== null;
  }

  private createGroundPlot(): THREE.Group {
    const plot = new THREE.Group();
    plot.name = 'interior_ground_plot';

    // Wide enough to fill the view at the lowest camera angle
    const lawn = new THREE.Mesh(
      new THREE.CircleGeometry(220, 48),
      new THREE.MeshBasicMaterial({ color: 0xa9c4a1 })
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = -0.45;
    plot.add(lawn);

    // A paved apron so the building does not look like it floats on the grass
    const apron = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshBasicMaterial({ color: 0xc9d6c2 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.43;
    plot.add(apron);

    return plot;
  }

  private getActiveShell(): THREE.Object3D | null {
    return this.getActiveInteriorGroup()?.getObjectByName('interior_room_shell') ?? null;
  }

  /**
   * Keeps the view into the room clear however the player turns the camera: outer walls on
   * the camera's side are lowered, and anything tall between the camera and the player fades.
   */
  public updateCutaway(delta: number, camera: THREE.Camera, player: Player): void {
    if (!this.currentInterior) return;
    this.cutaway.update(delta, camera, player.position);
  }

  /** Where the player returns to on the street when they leave the current interior. */
  public getStreetReturnPosition(): THREE.Vector3 {
    return this.streetReturnPosition;
  }

  public update(delta: number, player?: Player): void {
    if (!this.isPlayerInside() || !this.currentInterior) return;

    this.animTime += delta;

    // Only update animations and NPCs of the active interior
    this.getActiveTemplate()?.update(delta, this.animTime);

    // Keep player inside interior room boundaries (not while a doorway sequence walks them out)
    if (player && !this.usingDoor && this.currentInterior.rooms.length > 0) {
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

    if (player && !this.usingDoor) this.keepOffFurniture(player);
  }

  /**
   * Walking about freely in a room with a floor map, the player cannot pass through its
   * furniture: a step into something solid slides along it, or is not taken.
   * Scripted actions (sitting on a chair, lying on a bed) go where they need to.
   */
  private keepOffFurniture(player: Player): void {
    const nav = this.getActiveNav();
    if (!nav) return;
    const spot = player.mesh.position;
    if (player.actor.scripted || nav.isFree(spot.x, spot.z)) {
      if (nav.isFree(spot.x, spot.z)) (this.lastClearSpot ??= new THREE.Vector3()).set(spot.x, 0, spot.z);
      return;
    }
    const last = this.lastClearSpot;
    if (!last || Math.hypot(spot.x - last.x, spot.z - last.z) > 1.5) {
      // Put down somewhere solid (stood up from a seat, or moved here by something else): step to the nearest floor
      const clear = nav.closestFree(spot);
      spot.x = clear.x;
      spot.z = clear.z;
    } else if (nav.isFree(spot.x, last.z)) {
      spot.z = last.z;
    } else if (nav.isFree(last.x, spot.z)) {
      spot.x = last.x;
    } else {
      spot.x = last.x;
      spot.z = last.z;
    }
    if (nav.isFree(spot.x, spot.z)) (this.lastClearSpot ??= new THREE.Vector3()).set(spot.x, 0, spot.z);
    player.position.copy(spot);
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
