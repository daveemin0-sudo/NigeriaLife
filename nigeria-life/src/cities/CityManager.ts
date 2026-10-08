import * as THREE from 'three';
import type { CityId } from './CityTypes';
import { NIGERIA_CITIES_REGISTRY } from './CityRegistry';
import { AbujaCity } from './AbujaCity';
import { PortHarcourtCity } from './PortHarcourtCity';
import type { Player } from '../player/Player';
import type { InteractiveObject } from '../world/World';

export class CityManager {
  private scene: THREE.Scene;
  public currentCityId: CityId = 'lagos';

  // Sub-city instances
  public abujaCity: AbujaCity | null = null;
  public portHarcourtCity: PortHarcourtCity | null = null;
  public lagosGroups: THREE.Object3D[] = [];
  public lagosInteractiveObjects: InteractiveObject[] = [];
  public onCityChanged?: (cityId: CityId) => void;

  // Environment elements
  private sunLight: THREE.DirectionalLight | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public registerSunLight(sun: THREE.DirectionalLight): void {
    this.sunLight = sun;
  }

  public registerLagosInteractive(objects: InteractiveObject[]): void {
    this.lagosInteractiveObjects = objects;
  }

  public registerLagosGroups(groups: THREE.Object3D[]): void {
    this.lagosGroups = groups;
  }

  public initAbuja(): void {
    if (!this.abujaCity) {
      this.abujaCity = new AbujaCity();
      this.abujaCity.group.visible = false;
      this.scene.add(this.abujaCity.group);
    }
  }

  public initPortHarcourt(): void {
    if (!this.portHarcourtCity) {
      this.portHarcourtCity = new PortHarcourtCity();
      this.portHarcourtCity.group.visible = false;
      this.scene.add(this.portHarcourtCity.group);
    }
  }

  public switchCity(
    targetCityId: CityId,
    player: Player,
    onInteractiveObjectsChanged: (newObjects: InteractiveObject[]) => void,
    onComplete?: () => void
  ): void {
    if (this.currentCityId === targetCityId) {
      onComplete?.();
      return;
    }

    this.initAbuja();
    this.initPortHarcourt();

    this.currentCityId = targetCityId;
    const meta = NIGERIA_CITIES_REGISTRY[targetCityId];

    if (targetCityId === 'abuja') {
      this.setLagosVisible(false);
      if (this.portHarcourtCity) this.portHarcourtCity.group.visible = false;

      if (this.abujaCity) {
        this.abujaCity.group.visible = true;
        onInteractiveObjectsChanged(this.abujaCity.interactiveList);
      }

      // Position player at Shehu Shagari Way capital boulevard
      player.mesh.position.set(0, 0, 10);
      if (player.currentVehicle) {
        player.currentVehicle.mesh.position.set(0, 0, 10);
      }

      // Apply capital atmosphere
      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(meta.fogColorHex);
        this.scene.fog.density = 0.009;
      }
      this.scene.background = new THREE.Color(meta.skyColorHex);
      if (this.sunLight) this.sunLight.intensity = meta.sunIntensity;

    } else if (targetCityId === 'port_harcourt') {
      this.setLagosVisible(false);
      if (this.abujaCity) this.abujaCity.group.visible = false;

      if (this.portHarcourtCity) {
        this.portHarcourtCity.group.visible = true;
        onInteractiveObjectsChanged(this.portHarcourtCity.interactiveList);
      }

      // Position player at Aba Road / Bole spot
      player.mesh.position.set(0, 0, 10);
      if (player.currentVehicle) {
        player.currentVehicle.mesh.position.set(0, 0, 10);
      }

      // Apply Niger delta mangrove atmosphere
      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(meta.fogColorHex);
        this.scene.fog.density = 0.010;
      }
      this.scene.background = new THREE.Color(meta.skyColorHex);
      if (this.sunLight) this.sunLight.intensity = meta.sunIntensity;

    } else {
      // Show Lagos
      if (this.abujaCity) this.abujaCity.group.visible = false;
      if (this.portHarcourtCity) this.portHarcourtCity.group.visible = false;

      this.setLagosVisible(true);
      onInteractiveObjectsChanged(this.lagosInteractiveObjects);

      // Position player at Broad Street starter position
      player.mesh.position.set(0, 0, 5);
      if (player.currentVehicle) {
        player.currentVehicle.mesh.position.set(-8.5, 0, 10);
      }

      // Apply coastal tropical atmosphere
      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(meta.fogColorHex);
        this.scene.fog.density = 0.012;
      }
      this.scene.background = new THREE.Color(meta.skyColorHex);
      if (this.sunLight) this.sunLight.intensity = meta.sunIntensity;
    }

    this.onCityChanged?.(targetCityId);
    onComplete?.();
  }

  private setLagosVisible(visible: boolean): void {
    for (const group of this.lagosGroups) {
      group.visible = visible;
    }
    for (const obj of this.lagosInteractiveObjects) {
      obj.mesh.visible = visible;
    }
  }

  public update(delta: number): void {
    if (this.currentCityId === 'abuja' && this.abujaCity) {
      this.abujaCity.update(delta);
    } else if (this.currentCityId === 'port_harcourt' && this.portHarcourtCity) {
      this.portHarcourtCity.update(delta);
    }
  }
}
