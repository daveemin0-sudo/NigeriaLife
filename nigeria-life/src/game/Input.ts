import * as THREE from 'three';
import { Player } from '../player/Player';
import { World, type InteractiveObject } from '../world/World';
import { HUD } from '../ui/HUD';

export class InputManager {
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private player: Player;
  private world: World;
  private hud: HUD;

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

  public keys: Record<string, boolean> = {};
  public onToggleVehicle?: () => void;
  public onHonkVehicle?: () => void;

  constructor(
    camera: THREE.Camera,
    scene: THREE.Scene,
    player: Player,
    world: World,
    hud: HUD
  ) {
    this.camera = camera;
    this.scene = scene;
    this.player = player;
    this.world = world;
    this.hud = hud;

    this.raycaster = new THREE.Raycaster();
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
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys[k] = false;
    });
  }

  private onPointerMove(event: MouseEvent): void {
    // Convert to normalized device coordinates (-1 to +1)
    this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseCoords, this.camera);

    // Smart cursor priority: interactive object > walkable ground > default.
    const interactiveMeshes = this.world.interactiveObjects.map((obj) => obj.mesh);
    const interactiveHits = this.raycaster.intersectObjects(interactiveMeshes, true);

    if (interactiveHits.length > 0) {
      const hitRoot = this.findInteractiveParent(interactiveHits[0].object);
      this.hoveredObject = hitRoot;
      this.hoverReticle.visible = false;

      if (hitRoot) {
        this.setCursor('interact');
        // Show the reticle at the actual destination the player will walk to.
        this.hoverReticle.position.copy(hitRoot.interactionPoint);
        this.hoverReticle.position.y = 0.03;
        this.hoverReticle.visible = true;
        (this.hoverReticle.material as THREE.MeshBasicMaterial).opacity = 0.55;
      }
      return;
    }

    this.hoveredObject = null;

    // Check hover against walkable terrain.
    const groundHits = this.raycaster.intersectObject(this.world.groundMesh, false);
    if (groundHits.length > 0) {
      this.hoverGroundPoint.copy(groundHits[0].point);
      this.hoverReticle.position.copy(this.hoverGroundPoint);
      this.hoverReticle.position.y = 0.03;
      this.hoverReticle.visible = true;
      (this.hoverReticle.material as THREE.MeshBasicMaterial).opacity = 0.4;
      this.setCursor('walk');
    } else {
      this.hoverReticle.visible = false;
      this.setCursor('default');
    }
  }

  private onPointerDown(event: MouseEvent): void {
    // Only respond to primary left click, ignore clicks on UI buttons & open modals
    if (event.button !== 0) return;
    const targetEl = event.target as HTMLElement;
    // UI owns its own clicks. Only the WebGL canvas controls game movement.
    if (!targetEl.closest('canvas')) {
      return;
    }

    // If player is currently driving a vehicle, do not steer/walk by clicking
    if (this.player.isDriving) return;

    this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseCoords, this.camera);

    // 1. Test click on interactive buildings & objects
    const buildingMeshes = this.world.interactiveObjects.map((obj) => obj.mesh);
    const buildingHits = this.raycaster.intersectObjects(buildingMeshes, true);

    if (buildingHits.length > 0) {
      const hitObj = this.findInteractiveParent(buildingHits[0].object);
      if (hitObj) {
        const dist = this.player.position.distanceTo(hitObj.interactionPoint);
        const threshold = hitObj.id.startsWith('veh-') ? 3.5 : 2.8;

        if (dist <= threshold) {
          // Already within close proximity: face object and open immediately
          const lookDir = new THREE.Vector3().subVectors(hitObj.interactionPoint, this.player.position);
          if (lookDir.lengthSq() > 0.01) {
            this.player.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);
          }
          this.pendingInteraction = null;
          this.hud.showInteractionCard(hitObj);
        } else {
          // Player is at a distance: approach the object first, then interact on arrival
          this.player.setDestination(hitObj.interactionPoint);
          this.spawnClickMarker(hitObj.interactionPoint, 0xfacc15); // Golden approach target
          this.pendingInteraction = hitObj;
          this.hud.hideInteractionCard();
        }
        return;
      }
    }

    // 2. Test click on ground
    const groundHits = this.raycaster.intersectObject(this.world.groundMesh);
    if (groundHits.length > 0) {
      const clickPoint = groundHits[0].point;
      this.pendingInteraction = null;
      this.player.setDestination(clickPoint);
      this.spawnClickMarker(clickPoint, 0x00ff88); // Emerald target
      this.hud.hideInteractionCard();
    }
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
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      const match = this.world.interactiveObjects.find((item) => item.mesh === curr);
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

  public update(delta: number): void {
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
    if (this.hud.currentActiveObject && !this.pendingInteraction) {
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
  }
}
