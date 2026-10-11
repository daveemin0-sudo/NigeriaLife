import * as THREE from 'three';
import { WorldMapRenderer, type MapSelectionEvent } from './WorldMapRenderer';
import { WorldDataManager } from '../data/WorldDataManager';
import type { DistrictData } from '../data/WorldDataTypes';
import { PointerScope } from '../../game/PointerScope';
import { RENDER_LAYERS } from '../../interiors/InteriorTypes';

export class WorldMap {
  public scene: THREE.Scene;
  public renderer: WorldMapRenderer;
  public isActive: boolean = false;

  // Dedicated Isometric Map Camera
  public mapCamera: THREE.PerspectiveCamera;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(10, 0, 10);
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 160, 130);

  // Pan & Zoom controls
  private isDragging: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private zoomLevel: number = 1.0;
  private readonly minZoom = 0.55;
  private readonly maxZoom = 2.4;

  // Raycasting for interactive map selection
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();
  public hoveredDistrictId: string | null = null;

  /** Can this city's map be the city itself, seen from above? (Its real streets must be standing.) */
  public useRealWorld?: (cityId: string) => boolean;
  /** Told to bring the real city into view under the map, or to put it away again */
  public onRealWorld?: (on: boolean) => void;

  // Callbacks
  public onSelectItem?: (event: MapSelectionEvent) => void;
  public onHoverDistrict?: (district: DistrictData | null) => void;
  public onHoverItem?: (
    item: { type: 'landmark' | 'property' | 'business'; data: any } | null,
    screenPosition: { x: number; y: number }
  ) => void;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.renderer = new WorldMapRenderer();
    this.renderer.group.visible = false;
    this.scene.add(this.renderer.group);

    // Dedicated Isometric Perspective Camera
    this.mapCamera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    // The real city is on the street layer, and the map looks at it
    this.mapCamera.layers.enable(RENDER_LAYERS.STREET);
    this.updateCameraTransform();

    this.setupEventListeners();
  }

  private updateCameraTransform(): void {
    const scaledOffset = this.cameraOffset.clone().multiplyScalar(this.zoomLevel);
    this.mapCamera.position.copy(this.cameraTarget).add(scaledOffset);
    this.mapCamera.lookAt(this.cameraTarget);
  }

  private setupEventListeners(): void {
    window.addEventListener('mousedown', (e) => {
      if (!this.isActive) return;
      if (!PointerScope.isGameView(e.target)) return;
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isActive) return;

      if (this.isDragging) {
        const deltaX = e.clientX - this.previousMousePosition.x;
        const deltaY = e.clientY - this.previousMousePosition.y;

        // Pan map target across X and Z
        const panSpeed = 0.42 * this.zoomLevel;
        this.cameraTarget.x -= deltaX * panSpeed;
        this.cameraTarget.z -= deltaY * panSpeed;

        // Clamp map bounds
        this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -160, 160);
        this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -160, 150);

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
        this.updateCameraTransform();
      }

      // Check hover for buildings, landmarks, properties and districts
      this.handleHover(e);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // Wheel zoom, only for wheel turns over the map itself (see PointerScope)
    PointerScope.onGameWheel((pixels) => {
      if (!this.isActive) return false;
      this.zoomLevel = THREE.MathUtils.clamp(
        this.zoomLevel + pixels * 0.001,
        this.minZoom,
        this.maxZoom
      );
      this.updateCameraTransform();
      return true;
    });

    window.addEventListener('click', (e) => {
      if (!this.isActive) return;
      if (!PointerScope.isGameView(e.target)) return;
      this.handleClick(e);
    });
  }

  private handleHover(e: MouseEvent): void {
    this.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.mapCamera);

    const hitObjects = this.renderer.interactiveMapObjects.map((o) => o.mesh);
    const intersects = this.raycaster.intersectObjects(hitObjects, true);

    if (intersects.length > 0) {
      // 1. FIRST PRIORITY: Check for Building / Landmark / Property hit
      for (const hit of intersects) {
        const found = this.renderer.interactiveMapObjects.find(
          (o) => o.mesh === hit.object || o.mesh.children.includes(hit.object)
        );

        if (found && (found.type === 'landmark' || found.type === 'property' || found.type === 'business')) {
          this.onHoverItem?.({ type: found.type, data: found.data }, { x: e.clientX, y: e.clientY });
          document.body.style.cursor = 'pointer';
          return;
        }
      }

      // 2. SECOND PRIORITY: Check for District ground hit
      for (const hit of intersects) {
        const found = this.renderer.interactiveMapObjects.find(
          (o) => o.mesh === hit.object || o.mesh.children.includes(hit.object)
        );

        if (found && found.type === 'district') {
          const dist = found.data as DistrictData;
          this.onHoverItem?.(null, { x: e.clientX, y: e.clientY });
          if (this.hoveredDistrictId !== dist.id) {
            this.hoveredDistrictId = dist.id;
            this.renderer.highlightDistrict(dist.id);
            this.onHoverDistrict?.(dist);
            document.body.style.cursor = 'pointer';
          }
          return;
        }
      }
    }

    // Nothing hit
    this.onHoverItem?.(null, { x: e.clientX, y: e.clientY });
    if (this.hoveredDistrictId !== null) {
      this.hoveredDistrictId = null;
      this.renderer.highlightDistrict(null);
      this.onHoverDistrict?.(null);
      document.body.style.cursor = 'default';
    }
  }

  private handleClick(e: MouseEvent): void {
    this.mouseVec.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.mapCamera);

    const hitObjects = this.renderer.interactiveMapObjects.map((o) => o.mesh);
    const intersects = this.raycaster.intersectObjects(hitObjects, true);

    if (intersects.length > 0) {
      // 1. Priority: Building / Landmark / Property
      for (const hit of intersects) {
        const found = this.renderer.interactiveMapObjects.find(
          (o) => o.mesh === hit.object || o.mesh.children.includes(hit.object)
        );

        if (found && (found.type === 'landmark' || found.type === 'property' || found.type === 'business')) {
          this.onSelectItem?.({
            type: found.type,
            item: found.data,
            screenPosition: { x: e.clientX, y: e.clientY },
          });
          return;
        }
      }

      // 2. District Fallback
      for (const hit of intersects) {
        const found = this.renderer.interactiveMapObjects.find(
          (o) => o.mesh === hit.object || o.mesh.children.includes(hit.object)
        );

        if (found && found.type === 'district') {
          this.onSelectItem?.({
            type: found.type,
            item: found.data,
            screenPosition: { x: e.clientX, y: e.clientY },
          });
          const d = found.data as DistrictData;
          this.focusOnDistrict(d.id);
          return;
        }
      }
    }
  }

  public focusOnDistrict(districtId: string): void {
    const d = WorldDataManager.getInstance().getDistrictById(districtId);
    if (d) {
      this.cameraTarget.copy(d.center);
      this.zoomLevel = 1.0;
      this.updateCameraTransform();
      this.renderer.highlightDistrict(districtId);
    }
  }

  /** Brings a spot to the middle of the map, close enough to see what stands there. */
  public focusOn(x: number, z: number): void {
    this.cameraTarget.set(THREE.MathUtils.clamp(x, -160, 160), 0, THREE.MathUtils.clamp(z, -160, 150));
    this.zoomLevel = Math.min(this.zoomLevel, 0.8);
    this.updateCameraTransform();
  }

  /**
   * Brings a stretch of the city into view, all of it: a way from one place to another, say.
   * `coveredRight` is how much of the right of the screen something else is standing over
   * (the card of a place), so what is framed sits in the part that is left.
   */
  public frame(minX: number, maxX: number, minZ: number, maxZ: number, coveredRight = 0): void {
    const free = 1 - coveredRight;
    // At zoom 1 the camera takes in about this much ground across and from front to back
    const across = 158 * this.mapCamera.aspect * free;
    const deep = 200;
    const zoom = Math.max((maxX - minX + 30) / across, (maxZ - minZ + 40) / deep);
    this.zoomLevel = THREE.MathUtils.clamp(zoom, this.minZoom, this.maxZoom);
    // Looking a little to the right of it puts it in the free part of the screen on the left
    const shift = (coveredRight / 2) * 158 * this.mapCamera.aspect * this.zoomLevel;
    this.cameraTarget.set(THREE.MathUtils.clamp((minX + maxX) / 2 + shift, -160, 160), 0, THREE.MathUtils.clamp((minZ + maxZ) / 2, -160, 150));
    this.updateCameraTransform();
  }

  /** Where the map is looking, and how closely */
  public get view(): { x: number; z: number; zoom: number } {
    return { x: this.cameraTarget.x, z: this.cameraTarget.z, zoom: this.zoomLevel };
  }

  public switchCity(cityId: string): void {
    WorldDataManager.getInstance().switchCity(cityId);
    const real = this.useRealWorld?.(cityId) ?? false;
    this.renderer.loadCity(cityId, real);
    this.onRealWorld?.(this.isActive && real);
    this.cameraTarget.set(0, 0, 0);
    this.zoomLevel = 1.05;
    this.updateCameraTransform();
  }

  /** True while the map on show is the real city. */
  public get showingRealWorld(): boolean {
    return this.isActive && this.renderer.realWorld;
  }

  public activate(): void {
    this.isActive = true;
    this.renderer.group.visible = true;
    const real = this.useRealWorld?.(this.renderer.currentCityId) ?? false;
    if (real !== this.renderer.realWorld) this.renderer.loadCity(this.renderer.currentCityId, real);
    this.onRealWorld?.(real);

    // Center camera on player's current location or city center
    const playerPos = WorldDataManager.getInstance().getPlayerPosition();
    this.cameraTarget.set(playerPos.x, 0, playerPos.z);
    this.zoomLevel = 1.15;
    this.updateCameraTransform();
  }

  public deactivate(): void {
    this.isActive = false;
    this.renderer.group.visible = false;
    this.onRealWorld?.(false);
    this.renderer.highlightDistrict(null);
    document.body.style.cursor = 'default';
  }

  public handleResize(): void {
    this.mapCamera.aspect = window.innerWidth / window.innerHeight;
    this.mapCamera.updateProjectionMatrix();
    this.updateCameraTransform();
  }

  public update(delta: number): void {
    if (!this.isActive) return;
    this.renderer.update(delta);
  }
}
