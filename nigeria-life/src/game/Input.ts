import * as THREE from 'three';
import { Player } from '../player/Player';
import { World, type InteractiveObject, type InteractionTarget } from '../world/World';
import { HUD } from '../ui/HUD';
import type { GameCamera } from './Camera';
import { DestinationRegistry } from '../destinations/DestinationRegistry';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { NetworkManager } from '../multiplayer/NetworkManager';
import { InteractionDirector } from '../interactions/InteractionDirector';
import { Sequence, steps } from '../interactions/Sequence';

export class InputManager {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private player: Player;
  private world: World;
  private hud: HUD;
  public cameraManager?: GameCamera;

  // Camera Orbit Drag State
  private isRotatingCamera: boolean = false;
  private isPointerDown: boolean = false;
  private hasDragged: boolean = false;
  private pointerDownPos = new THREE.Vector2();
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  private raycaster: THREE.Raycaster;
  private mouseCoords: THREE.Vector2;

  // Visual Click Target Marker (Ripple ring on ground)
  private targetMarker: THREE.Mesh;
  private hoverReticle: THREE.Mesh;
  private markerAnimTime: number = 0;
  private hoverGroundPoint = new THREE.Vector3();
  private cursorState: 'default' | 'walk' | 'interact' = 'default';
  public hoveredObject: InteractiveObject | null = null;
  private pendingInteraction: InteractiveObject | null = null;
  private lastLoggedTargetId: string | null = null;

  public keys: Record<string, boolean> = {};
  public virtualJoystick: VirtualJoystick;
  public onToggleVehicle?: () => void;
  public onHonkVehicle?: () => void;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    player: Player,
    world: World,
    hud: HUD,
    cameraManager?: GameCamera
  ) {
    this.camera = camera;
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.hud = hud;
    this.cameraManager = cameraManager;

    // Mobile Virtual Joystick & Touch cluster
    this.virtualJoystick = new VirtualJoystick();
    this.virtualJoystick.onToggleVehicle = () => this.onToggleVehicle?.();
    this.virtualJoystick.onHonk = () => this.onHonkVehicle?.();
    this.virtualJoystick.onInteract = () => {
      if (this.hud.currentInteractionTarget) {
        this.hud.executeCurrentInteraction();
      } else if (this.hud.currentActiveObject) {
        const actionBtn = document.getElementById('card-action-btn') as HTMLButtonElement;
        actionBtn?.click();
      } else {
        const closest = this.findClosestInteractive(4.5);
        if (closest) {
          this.hud.showInteractionCard(closest);
        }
      }
    };

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll();
    this.mouseCoords = new THREE.Vector2();

    // 1. Click Ripple Ring
    const ringGeo = new THREE.RingGeometry(0.35, 0.65, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88, // Neon green / vibrant gold
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.targetMarker = new THREE.Mesh(ringGeo, ringMat);
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.position.y = 0.04;
    this.scene.add(this.targetMarker);

    // 2. Subtle Ground Hover Reticle
    const hoverGeo = new THREE.RingGeometry(0.2, 0.35, 24);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    this.hoverReticle = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverReticle.rotation.x = -Math.PI / 2;
    this.hoverReticle.position.y = 0.03;
    this.scene.add(this.hoverReticle);

    // Setup Event Listeners
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));

    // Touch support for screen drag rotation
    window.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const targetEl = e.target as HTMLElement;
        if (targetEl.closest('canvas')) {
          this.isPointerDown = true;
          this.hasDragged = false;
          this.pointerDownPos.set(t.clientX, t.clientY);
          this.lastMouseX = t.clientX;
          this.lastMouseY = t.clientY;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 1 && this.isPointerDown && this.cameraManager) {
        const t = e.touches[0];
        const dist = Math.hypot(t.clientX - this.pointerDownPos.x, t.clientY - this.pointerDownPos.y);
        if (dist > 5) {
          this.hasDragged = true;
          this.isRotatingCamera = true;
          const deltaX = t.clientX - this.lastMouseX;
          const deltaY = t.clientY - this.lastMouseY;
          this.lastMouseX = t.clientX;
          this.lastMouseY = t.clientY;
          this.cameraManager.rotate(-deltaX * 0.006, -deltaY * 0.004);
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', (e: TouchEvent) => {
      const wasDragging = this.hasDragged;
      this.isPointerDown = false;
      this.isRotatingCamera = false;
      if (!wasDragging && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        this.handleCanvasClick(t.clientX, t.clientY);
      }
    }, { passive: true });

    // Prevent context menu on right click so player can freely rotate camera
    window.addEventListener('contextmenu', (e) => {
      const targetEl = e.target as HTMLElement;
      if (targetEl.closest('canvas')) {
        e.preventDefault();
      }
    });

    // Mouse Wheel Zoom
    window.addEventListener('wheel', (e: WheelEvent) => {
      if (this.hud.currentNavMode === 'map') return;
      if (this.cameraManager) {
        this.cameraManager.zoom(e.deltaY * 0.005);
      }
    }, { passive: true });

    // Keyboard driving controls
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const k = e.key.toLowerCase();
      this.keys[k] = true;

      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.pendingInteraction = null;
      }

      if (k === 'f') {
        this.onToggleVehicle?.();
      } else if (k === 'h') {
        this.onHonkVehicle?.();
      } else if (k === 'v') {
        // Toggle camera preset (Third-Person -> Street -> Isometric -> Aerial)
        if (this.cameraManager) {
          const next = this.cameraManager.cyclePreset();
          const names: Record<string, string> = {
            close: 'Third-Person Close',
            street: 'Street Normal',
            isometric: 'High Isometric',
            aerial: 'Aerial Overview',
          };
          this.hud.showNotification(`📷 Camera View: ${names[next] || next}`);
        }
      } else if (k === 'e') {
        if (e.defaultPrevented) {
          // The HUD's own E handler already acted on this key press
        } else if (this.hud.currentInteractionTarget) {
          e.preventDefault();
          this.hud.executeCurrentInteraction();
        } else if (this.hud.currentActiveObject) {
          const actionBtn = document.getElementById('card-action-btn') as HTMLButtonElement;
          actionBtn?.click();
        } else {
          const closest = this.findClosestInteractive(4.0);
          if (closest) {
            this.hud.showInteractionCard(closest);
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
    });
  }

  private onPointerMove(event: MouseEvent): void {
    if (this.hud.currentNavMode === 'map') {
      this.hoverReticle.visible = false;
      return;
    }

    // Camera rotation orbit drag (with left-drag, right-drag, or middle-drag)
    if (this.isPointerDown && this.cameraManager) {
      const dist = Math.hypot(event.clientX - this.pointerDownPos.x, event.clientY - this.pointerDownPos.y);
      if (dist > 4) {
        this.hasDragged = true;
        this.isRotatingCamera = true;
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        const rotSpeed = 0.0055;
        this.cameraManager.rotate(-deltaX * rotSpeed, -deltaY * rotSpeed * 0.7);
        this.hoverReticle.visible = false;
        this.setCursor('default');
        return;
      }
    }

    if (this.isRotatingCamera) {
      return;
    }

    // Convert to normalized device coordinates (-1 to +1)
    this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseCoords, this.camera);
    this.raycaster.layers.enableAll();

    const isInside = this.world.interiorManager.isPlayerInside();
    const activeObjects = isInside
      ? this.world.interiorManager.getActiveInteractiveObjects()
      : this.world.interactiveObjects;

    // Check walkable terrain / interior floor
    const floorMesh = isInside
      ? this.world.interiorManager.getActiveFloorMesh()
      : this.world.groundMesh;
    const floorHits = floorMesh ? this.raycaster.intersectObject(floorMesh, false) : [];

    // Interactive object hover
    const interactiveMeshes = activeObjects.map((obj) => obj.mesh);
    const interactiveHits = this.raycaster.intersectObjects(interactiveMeshes, true);

    if (interactiveHits.length > 0) {
      const closestHit = interactiveHits[0];
      const floorHit = floorHits.length > 0 ? floorHits[0] : null;
      const isDirectInteractiveHit = !floorHit || (closestHit.distance < floorHit.distance - 0.05);

      if (isDirectInteractiveHit) {
        const hitRoot = this.findInteractiveParent(closestHit.object);
        if (hitRoot) {
          this.hoveredObject = hitRoot;
          this.setCursor('interact');
          this.hoverReticle.position.copy(hitRoot.interactionPoint);
          this.hoverReticle.position.y = isInside ? 0.04 : 0.03;
          this.hoverReticle.visible = true;
          (this.hoverReticle.material as THREE.MeshBasicMaterial).opacity = 0.55;
          return;
        }
      }
    }

    this.hoveredObject = null;

    if (floorHits.length > 0) {
      this.hoverGroundPoint.copy(floorHits[0].point);
      this.hoverReticle.position.copy(this.hoverGroundPoint);
      this.hoverReticle.position.y = isInside ? 0.04 : 0.03;
      this.hoverReticle.visible = true;
      (this.hoverReticle.material as THREE.MeshBasicMaterial).opacity = 0.4;
      this.setCursor('walk');
      return;
    }

    this.hoverReticle.visible = false;
    this.setCursor('default');
  }

  private onPointerDown(event: MouseEvent): void {
    if (this.hud.currentNavMode === 'map') return;
    const targetEl = event.target as HTMLElement;
    if (!targetEl.closest('canvas')) return;

    this.isPointerDown = true;
    this.hasDragged = false;
    this.pointerDownPos.set(event.clientX, event.clientY);
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;

    if (event.button === 2 || event.button === 1) {
      this.isRotatingCamera = true;
    }
  }

  private onPointerUp(event: MouseEvent): void {
    const wasDragging = this.hasDragged || this.isRotatingCamera;
    this.isPointerDown = false;
    this.isRotatingCamera = false;

    if (this.hud.currentNavMode === 'map') return;
    const targetEl = event.target as HTMLElement;
    if (!targetEl.closest('canvas')) return;

    // If the user dragged to rotate the view, do not trigger walk or interaction!
    if (wasDragging) {
      return;
    }

    // Only respond to primary left click
    if (event.button !== 0) return;
    if (this.player.isDriving) return;

    this.handleCanvasClick(event.clientX, event.clientY);
  }

  private handleCanvasClick(clientX: number, clientY: number): void {
    const actor = this.player.actor;
    // Walking through a doorway cannot be interrupted
    if (actor.sequence && !actor.sequence.interruptible) return;

    this.mouseCoords.x = (clientX / window.innerWidth) * 2 - 1;
    this.mouseCoords.y = -(clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseCoords, this.camera);
    this.raycaster.layers.enableAll();

    const isInside = this.world.interiorManager.isPlayerInside();
    const activeObjects = isInside
      ? this.world.interiorManager.getActiveInteractiveObjects()
      : this.world.interactiveObjects;

    // 1. Raycast walkable terrain / interior floor FIRST
    const floorMesh = isInside
      ? this.world.interiorManager.getActiveFloorMesh()
      : this.world.groundMesh;
    const floorHits = floorMesh ? this.raycaster.intersectObject(floorMesh, false) : [];

    // 2. Raycast interactive buildings & objects
    const buildingMeshes = activeObjects.map((obj) => obj.mesh);
    const buildingHits = this.raycaster.intersectObjects(buildingMeshes, true);

    if (buildingHits.length > 0) {
      const closestBuildingHit = buildingHits[0];
      const floorHit = floorHits.length > 0 ? floorHits[0] : null;

      // An interactive object is only directly clicked if:
      // - There is no floor hit behind it, OR
      // - The interactive object is physically closer to the camera than the floor
      const isDirectInteractiveClick = !floorHit || (closestBuildingHit.distance < floorHit.distance - 0.05);

      if (isDirectInteractiveClick) {
        const hitObj = this.findInteractiveParent(closestBuildingHit.object);
        if (hitObj) {
          if (actor.hold) {
            // Seated: look at who or what was clicked without getting up (to wave across the room, say)
            this.hud.showInteractionCard(hitObj);
            return;
          }
          this.approachAndInteract(hitObj);
          return;
        }
      }
    }

    // 3. Click on ground / interior floor -> walk directly there!
    if (floorHits.length > 0) {
      const clickPoint = floorHits[0].point;
      this.pendingInteraction = null;
      // A click on a table or bed means "go over there", not "walk into it"
      const nav = isInside ? this.world.interiorManager.getActiveNav() : null;
      this.walkPlayerTo(nav ? nav.closestFree(clickPoint) : clickPoint);
      this.spawnClickMarker(clickPoint, 0x00ff88); // Emerald target
      this.hud.hideInteractionCard();
    }
  }

  /**
   * Walk the player up to an object and open its card on arrival (or at once if already beside it).
   * Used by clicks in the 3D view and by on-screen shortcuts, so nothing needs the keyboard.
   */
  public approachAndInteract(obj: InteractiveObject): void {
    const dist = this.player.position.distanceTo(obj.interactionPoint);
    const threshold = obj.id.startsWith('veh-') ? 3.5 : 2.8;

    if (dist <= threshold) {
      // Already within close proximity: face object and open immediately
      const lookDir = new THREE.Vector3().subVectors(obj.interactionPoint, this.player.position);
      if (lookDir.lengthSq() > 0.01) {
        this.player.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
      }
      this.pendingInteraction = null;
      this.hud.showInteractionCard(obj);
    } else {
      // Player is at a distance: approach the object first, then interact on arrival
      this.spawnClickMarker(obj.interactionPoint, 0xfacc15); // Golden approach target
      this.hud.hideInteractionCard();
      const routed = this.walkPlayerTo(obj.interactionPoint, () => {
        const lookDir = new THREE.Vector3().subVectors(obj.interactionPoint, this.player.position);
        if (lookDir.lengthSq() > 0.01) this.player.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
        this.hud.showInteractionCard(obj);
      });
      this.pendingInteraction = routed ? null : obj;
    }
  }

  /**
   * Sends the player to a point. In a room with a floor map they walk around the furniture
   * (and `onArrive` runs when they get there); elsewhere they walk straight, as before.
   * Returns true if the routed walk was used.
   */
  private walkPlayerTo(point: THREE.Vector3, onArrive?: () => void, retried = false): boolean {
    const interiors = this.world.interiorManager;
    const nav = interiors.isPlayerInside() ? interiors.getActiveNav() : null;
    const actor = this.player.actor;
    if (!nav) {
      if (actor.scripted && InteractionDirector.get().interrupt(actor) === 'locked') return false;
      this.player.setDestination(point);
      return false;
    }
    if (InteractionDirector.get().interrupt(actor) === 'locked') {
      // Getting up from a chair comes first; set off as soon as that is done
      const current = actor.sequence;
      if (current && !retried) current.finished.then(() => this.walkPlayerTo(point, onArrive, true));
      return true;
    }
    const walk = new Sequence('walk', [actor]).add(steps.walk(actor, point, { nav, speed: 5.5 }));
    walk.onEnd((reason) => {
      if (reason === 'done') onArrive?.();
    });
    InteractionDirector.get().run(walk);
    return true;
  }

  private setCursor(state: 'default' | 'walk' | 'interact'): void {
    if (this.cursorState === state) return;
    this.cursorState = state;

    document.body.style.cursor =
      state === 'interact' ? 'pointer' :
      state === 'walk' ? 'crosshair' :
      'default';
  }

  private findInteractiveParent(obj: THREE.Object3D): InteractiveObject | null {
    // Ground, terrain, interior floor and room root should NEVER be matched as interactive!
    if (
      obj.name === 'interior_floor_mesh' ||
      obj.name === 'ground' ||
      obj === this.world.groundMesh ||
      obj === this.world.interiorManager.getActiveFloorMesh() ||
      obj === this.world.interiorManager.getActiveInteriorGroup()
    ) {
      return null;
    }

    let curr: THREE.Object3D | null = obj;
    const isInside = this.world.interiorManager.isPlayerInside();
    const list = isInside
      ? this.world.interiorManager.getActiveInteractiveObjects()
      : this.world.interactiveObjects;
    const activeGroup = this.world.interiorManager.getActiveInteriorGroup();

    while (curr) {
      if (isInside && curr === activeGroup) break;
      const match = list.find((item) => item.mesh === curr);
      if (match) return match;
      curr = curr.parent;
    }
    return null;
  }

  private spawnClickMarker(position: THREE.Vector3, colorHex: number): void {
    this.targetMarker.position.x = position.x;
    this.targetMarker.position.z = position.z;
    (this.targetMarker.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    (this.targetMarker.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.targetMarker.scale.set(0.6, 0.6, 0.6);
    this.markerAnimTime = 0.45; // Seconds duration
  }

  private getInteractionRadius(id: string): number {
    const dest = DestinationRegistry.getInstance().getById(id);
    if (dest) {
      return dest.entrance.triggerRadius || 6.5;
    }
    if (['lagos-hospital', 'hospital', 'lagos-bank', 'bank', 'mama-put', 'buka', 'police-station', 'police', 'villa-compound', 'palm-view-flats', 'unilag-campus', 'mma-airport'].includes(id)) {
      return 6.5;
    }
    if (id === 'interior_exit_door') return 3.5;
    if (id.startsWith('veh-')) return 4.5;
    if (id.startsWith('interior_npc_')) return 3.2;
    if (id.startsWith('remote_player_')) return 3.8;
    return 3.8;
  }

  private createInteractionTarget(obj: InteractiveObject, dist: number): InteractionTarget {
    const id = obj.id;

    // 1. Canonical Destination Registry Match (Single source of truth)
    const dest = DestinationRegistry.getInstance().getById(id);
    if (dest && dest.isEnterable) {
      return {
        id: dest.id,
        name: dest.name,
        category: dest.category,
        label: dest.entrance.promptLabel,
        action: 'enter-interior',
        interiorId: dest.interiorId,
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }

    if (id === 'lagos-hospital' || id === 'hospital') {
      return {
        id: 'st_nicholas_hospital',
        name: 'St. Nicholas General Hospital',
        category: obj.category,
        label: 'Enter St. Nicholas General Hospital',
        action: 'enter-interior',
        interiorId: 'hospital',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }
    if (id === 'lagos-bank' || id === 'bank') {
      return {
        id: 'lagos_bank',
        name: 'Eko Commercial Bank',
        category: obj.category,
        label: 'Enter Eko Commercial Bank',
        action: 'enter-interior',
        interiorId: 'bank',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }
    if (id === 'mama-put' || id === 'buka') {
      return {
        id: 'mama_put_buka',
        name: 'Mama Put Buka',
        category: obj.category,
        label: 'Enter Mama Put Buka',
        action: 'enter-interior',
        interiorId: 'restaurant',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }
    if (id === 'police-station' || id === 'police') {
      return {
        id: 'area_command_police',
        name: 'Area Command Police Station',
        category: obj.category,
        label: 'Enter Area Command Police Station',
        action: 'enter-interior',
        interiorId: 'police',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }
    if (id === 'villa-compound') {
      return {
        id: 'villa-compound',
        name: 'Victoria Residence Estate',
        category: obj.category,
        label: 'Enter Victoria Residence Apartment',
        action: 'enter-interior',
        interiorId: 'residence',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }
    if (id === 'palm-view-flats') {
      return {
        id: 'palm-view-flats',
        name: 'Palm View Residence',
        category: obj.category,
        label: 'Enter Palm View Residence',
        action: 'enter-interior',
        interiorId: 'residence',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'building',
      };
    }
    if (id === 'interior_exit_door') {
      return {
        id: 'interior_exit_door',
        name: 'Exit to Street',
        category: obj.category,
        label: 'Exit to Street',
        action: 'exit-interior',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'door',
      };
    }
    if (id.startsWith('veh-')) {
      return {
        id: obj.id,
        name: obj.name,
        category: obj.category,
        label: `Board & Drive ${obj.name}`,
        action: 'enter-vehicle',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'vehicle',
      };
    }
    if (id.startsWith('interior_npc_')) {
      return {
        id: obj.id,
        name: obj.name,
        category: obj.category,
        label: `Talk to ${obj.name}`,
        action: 'interact',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'npc',
      };
    }
    if (id.startsWith('remote_player_')) {
      return {
        id: obj.id,
        name: obj.name,
        category: 'Online Citizen',
        label: `Interact with ${obj.name} [E]`,
        action: 'interact',
        distance: dist,
        interactionPoint: obj.interactionPoint,
        interactiveObject: obj,
        type: 'npc',
      };
    }

    // Specific Stations inside interiors
    const stationLabels: Record<string, string> = {
      hosp_reception: '📋 Register & Vital Signs Check',
      hosp_doctor_desk: '🩺 Full Medical Diagnosis & Treatment',
      hosp_ward_bed: '🛏️ Rest on Clinical Ward Bed',
      hosp_pharmacy: '💊 Purchase Coartem Malaria Medicine',
      bank_atm_station: '🏧 Instant ATM Cash Withdrawal',
      bank_teller_station: '💱 Foreign Remittance Wire Pickup',
      bank_manager_desk: '💼 Apply for Lagos SME Loan',
      buka_food_counter: '🍲 Order Firewood Party Jollof',
      buka_table_vip: '🍽️ Sit Down & Chop Life',
      police_front_desk: '📝 File Citizen Incident Report',
      police_holding_cell: '⚖️ Pay Citizen Bail Bond',
      unilag_lecture_podium: '🎓 Attend Faculty Lecture',
      unilag_library_desk: '📚 Deep Academic Research',
      unilag_admin_portal: '📝 Register Semester Courses',
      unilag_quad_gist: '💬 Socialize at Student Quad',
      airport_checkin_desk: '🎫 Flight Check-In & Boarding Pass',
      airport_security_gate: '🛡️ Aviation Security Screening',
      airport_flight_abuja: '✈️ Board Flight to Abuja FCT',
      airport_flight_ph: '✈️ Board Flight to Port Harcourt',
      airport_vip_lounge: '🥂 Relax in Executive VIP Lounge',
      'flat-workstation': '💻 Complete Remote Tech Sprint',
    };

    const label = stationLabels[id] || `Interact with ${obj.name}`;

    return {
      id: obj.id,
      name: obj.name,
      category: obj.category,
      label,
      action: 'interact',
      distance: dist,
      interactionPoint: obj.interactionPoint,
      interactiveObject: obj,
      type: id.startsWith('npc-') ? 'npc' : 'station',
    };
  }

  public updateProximityTarget(): void {
    if (this.hud.currentNavMode === 'map') {
      if (this.hud.currentInteractionTarget) {
        this.hud.setProximityTarget(null);
      }
      return;
    }

    // No prompt while walking through a doorway or sitting at a table
    const actor = this.player.actor;
    if ((actor.sequence && !actor.sequence.interruptible) || actor.hold) {
      if (this.hud.currentInteractionTarget) this.hud.setProximityTarget(null);
      return;
    }

    const isInside = this.world.interiorManager.isPlayerInside();
    let candidates: InteractiveObject[] = [];

    if (isInside) {
      candidates = this.world.interiorManager.getActiveInteractiveObjects();
    } else {
      // In street mode, exclude interior objects
      candidates = this.world.interactiveObjects.filter((o) => {
        return (
          o.id !== 'interior_exit_door' &&
          !o.id.startsWith('interior_npc_') &&
          !o.id.startsWith('hosp_') &&
          !o.id.startsWith('bank_') &&
          !o.id.startsWith('buka_') &&
          !o.id.startsWith('police_') &&
          !o.id.startsWith('unilag_') &&
          !o.id.startsWith('airport_')
        );
      });

      const netMgr = NetworkManager.getInstance();
      if (netMgr) {
        netMgr.remotePlayers.forEach((rp, rId) => {
          candidates.push({
            mesh: rp.mesh,
            id: `remote_player_${rId}`,
            name: (rp as any).name || `@${rId.substring(0, 8)}`,
            category: 'Online Citizen',
            description: `Live Lagos Citizen strolling Broad Street. Emote: ${rp.currentEmote}. Press [E] to interact!`,
            interactionPoint: rp.mesh.position.clone(),
          });
        });
      }
    }

    let nearestCandidate: InteractiveObject | null = null;
    let minDistance = Infinity;
    let bestRank = Infinity;

    for (const obj of candidates) {
      const radius = this.getInteractionRadius(obj.id);
      const dist = this.player.position.distanceTo(obj.interactionPoint);
      // Some staffed stations share their exact standing spot with the attendant. The station
      // carries the action, so it wins the tie; attendants standing apart keep their own prompt.
      const rank = obj.id.startsWith('interior_npc_') ? dist + 0.3 : dist;
      if (dist <= radius && rank < bestRank) {
        bestRank = rank;
        minDistance = dist;
        nearestCandidate = obj;
      }
    }

    if (nearestCandidate) {
      const target = this.createInteractionTarget(nearestCandidate, minDistance);
      this.hud.setProximityTarget(target);

      if (this.lastLoggedTargetId !== target.id) {
        this.lastLoggedTargetId = target.id;
        console.log(`[Interaction] mode: ${isInside ? 'interior' : 'street'}`);
        console.log(`[Interaction] nearest target: ${target.name}`);
        console.log(`[Interaction] distance: ${target.distance.toFixed(1)}`);
        console.log(`[Interaction] prompt: ${target.label}`);
      }
    } else {
      if (this.hud.currentInteractionTarget) {
        this.hud.setProximityTarget(null);
        this.lastLoggedTargetId = null;
      }
    }
  }

  public update(delta: number): void {
    // Merge Virtual Joystick active keys
    if (this.virtualJoystick && this.virtualJoystick.isVisible) {
      for (const [k, v] of Object.entries(this.virtualJoystick.activeKeys)) {
        if (v) this.keys[k] = true;
      }
    }

    // Pushing a movement key or the joystick breaks out of a scripted action that allows it
    if (this.player.actor.scripted) {
      const k = this.keys;
      if (k['w'] || k['a'] || k['s'] || k['d'] || k['arrowup'] || k['arrowdown'] || k['arrowleft'] || k['arrowright']) {
        InteractionDirector.get().interrupt(this.player.actor);
      }
    }

    // Continuously evaluate nearest proximity interactive target
    this.updateProximityTarget();

    // Check pending interaction approach arrival
    if (this.pendingInteraction) {
      const dist = this.player.position.distanceTo(this.pendingInteraction.interactionPoint);
      const threshold = this.pendingInteraction.id.startsWith('veh-') ? 3.5 : 2.5;

      if (dist <= threshold || !this.player.isMoving) {
        const hitObj = this.pendingInteraction;
        this.pendingInteraction = null;
        this.player.stopMoving();

        // Turn smoothly towards the interaction point
        const lookDir = new THREE.Vector3().subVectors(hitObj.interactionPoint, this.player.position);
        if (lookDir.lengthSq() > 0.01) {
          this.player.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
        }

        this.hud.showInteractionCard(hitObj);
      }
    }

    // Auto-dismiss interaction card if player moves far away
    if (this.hud.currentActiveObject && !this.pendingInteraction && !this.player.actor.hold) {
      const activeDist = this.player.position.distanceTo(this.hud.currentActiveObject.interactionPoint);
      if (activeDist > 6.0) {
        this.hud.hideInteractionCard();
      }
    }

    // Animate click ripple marker
    if (this.markerAnimTime > 0) {
      this.markerAnimTime -= delta;
      const progress = 1 - this.markerAnimTime / 0.45;
      const scale = 0.6 + progress * 0.9;
      this.targetMarker.scale.set(scale, scale, scale);
      (this.targetMarker.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.9 * (1 - progress)
      );
    }

    // Hover reticle pulse
    if (this.hoverReticle.visible) {
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.08;
      this.hoverReticle.scale.set(pulse, pulse, pulse);
    }

    // Keyboard Camera Rotation [Q] = Turn Left, [R] = Turn Right
    if (this.cameraManager && this.hud.currentNavMode !== 'map') {
      const rotRate = delta * 2.4;
      if (this.keys['q'] || this.keys['[']) {
        this.cameraManager.rotate(rotRate);
      }
      if (this.keys['r'] || this.keys[']']) {
        this.cameraManager.rotate(-rotRate);
      }
    }
  }

  public findClosestInteractive(maxDist: number = 3.5): InteractiveObject | null {
    let closest: InteractiveObject | null = null;
    let minDist = maxDist;
    const isInside = this.world.interiorManager.isPlayerInside();
    const list: InteractiveObject[] = isInside
      ? [...this.world.interiorManager.getActiveInteractiveObjects()]
      : [...this.world.interactiveObjects];

    if (!isInside) {
      const netMgr = NetworkManager.getInstance();
      if (netMgr) {
        netMgr.remotePlayers.forEach((rp, rId) => {
          list.push({
            mesh: rp.mesh,
            id: `remote_player_${rId}`,
            name: (rp as any).name || `@${rId.substring(0, 8)}`,
            category: 'Online Citizen',
            description: `Live Lagos Citizen strolling Broad Street. Emote: ${rp.currentEmote}. Press [E] to interact!`,
            interactionPoint: rp.mesh.position.clone(),
          });
        });
      }
    }

    for (const obj of list) {
      const d = this.player.position.distanceTo(obj.interactionPoint);
      if (d < minDist) {
        minDist = d;
        closest = obj;
      }
    }
    return closest;
  }
}
