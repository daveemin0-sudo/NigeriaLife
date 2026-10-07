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
  public hoveredObject: InteractiveObject | null = null;

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

    // Check hover against interactive buildings
    const buildingMeshes = this.world.interactiveObjects.map((obj) => obj.mesh);
    const buildingHits = this.raycaster.intersectObjects(buildingMeshes, true);

    if (buildingHits.length > 0) {
      document.body.style.cursor = 'pointer';
      const hitRoot = this.findInteractiveParent(buildingHits[0].object);
      this.hoveredObject = hitRoot;
      return;
    } else {
      this.hoveredObject = null;
    }

    // Check hover against ground
    const groundHits = this.raycaster.intersectObject(this.world.groundMesh);
    if (groundHits.length > 0) {
      document.body.style.cursor = 'crosshair';
      this.hoverReticle.position.x = groundHits[0].point.x;
      this.hoverReticle.position.z = groundHits[0].point.z;
      this.hoverReticle.visible = true;
    } else {
      document.body.style.cursor = 'default';
      this.hoverReticle.visible = false;
    }
  }

  private onPointerDown(event: MouseEvent): void {
    // Only respond to primary left click, ignore clicks on UI buttons & open modals
    if (event.button !== 0) return;
    const targetEl = event.target as HTMLElement;
    if (
      targetEl.closest('#hud-overlay') ||
      targetEl.closest('#inventory-modal') ||
      targetEl.closest('#atm-modal') ||
      targetEl.closest('#character-creator-modal') ||
      targetEl.closest('#smartphone-wrapper') ||
      targetEl.closest('#street-chat-box') ||
      targetEl.closest('#economy-modal') ||
      targetEl.closest('#travel-modal')
    ) {
      if (!targetEl.closest('canvas')) {
        return;
      }
    }

    // If player is currently driving a vehicle, do not steer/walk by clicking
    if (this.player.isDriving) return;

    this.mouseCoords.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseCoords.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseCoords, this.camera);

    // 1. Test click on interactive buildings
    const buildingMeshes = this.world.interactiveObjects.map((obj) => obj.mesh);
    const buildingHits = this.raycaster.intersectObjects(buildingMeshes, true);

    if (buildingHits.length > 0) {
      const hitObj = this.findInteractiveParent(buildingHits[0].object);
      if (hitObj) {
        // Move player towards building entrance
        this.player.setDestination(hitObj.interactionPoint);
        this.spawnClickMarker(hitObj.interactionPoint, 0xfacc15); // Golden target
        this.hud.showInteractionCard(hitObj);
        return;
      }
    }

    // 2. Test click on ground
    const groundHits = this.raycaster.intersectObject(this.world.groundMesh);
    if (groundHits.length > 0) {
      const clickPoint = groundHits[0].point;
      this.player.setDestination(clickPoint);
      this.spawnClickMarker(clickPoint, 0x00ff88); // Emerald target
      this.hud.hideInteractionCard();
    }
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
