import * as THREE from 'three';
import { WorldMapRenderer, type MapSelectionEvent } from './WorldMapRenderer';
import { WorldDataManager } from '../data/WorldDataManager';
import type { DistrictData } from '../data/WorldDataTypes';

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

  // Callbacks
  public onSelectItem?: (event: MapSelectionEvent) => void;
  public onHoverDistrict?: (district: DistrictData | null) => void;

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
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
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
        this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -120, 160);
        this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -140, 150);

        this.previousMousePosition = { x: e.clientX, y: e.clientY };
        this.updateCameraTransform();
      }

      // Check hover for districts and landmarks
      this.handleHover(e);
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    window.addEventListener('wheel', (e) => {
      if (!this.isActive) return;
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;

      const zoomDelta = e.deltaY * 0.001;
      this.zoomLevel = THREE.MathUtils.clamp(
        this.zoomLevel + zoomDelta,
        this.minZoom,
        this.maxZoom
      );
      this.updateCameraTransform();
    });

    window.addEventListener('click', (e) => {
      if (!this.isActive) return;
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
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
      const hitObj = intersects[0].object;
      const found = this.renderer.interactiveMapObjects.find(
        (o) => o.mesh === hitObj || o.mesh.children.includes(hitObj)
      );

      if (found && found.type === 'district') {
        const dist = found.data as DistrictData;
        if (this.hoveredDistrictId !== dist.id) {
          this.hoveredDistrictId = dist.id;
          this.renderer.highlightDistrict(dist.id);
          this.onHoverDistrict?.(dist);
          document.body.style.cursor = 'pointer';
        }
        return;
      }
    }

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
      const hitObj = intersects[0].object;
      const found = this.renderer.interactiveMapObjects.find(
        (o) => o.mesh === hitObj || o.mesh.children.includes(hitObj)
      );

      if (found) {
        this.onSelectItem?.({
          type: found.type,
          item: found.data,
          screenPosition: { x: e.clientX, y: e.clientY },
        });

        // If district clicked, smoothly focus camera towards it
        if (found.type === 'district') {
          const d = found.data as DistrictData;
          this.focusOnDistrict(d.id);
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

  public activate(): void {
    this.isActive = true;
    this.renderer.group.visible = true;

    // Center camera on player's current location or city center
    const playerPos = WorldDataManager.getInstance().getPlayerPosition();
    this.cameraTarget.set(playerPos.x, 0, playerPos.z);
    this.zoomLevel = 1.15;
    this.updateCameraTransform();
  }

  public deactivate(): void {
    this.isActive = false;
    this.renderer.group.visible = false;
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
