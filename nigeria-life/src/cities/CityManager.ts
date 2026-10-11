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
  /** The rooms behind every door, in whatever city the door is: never put away with a city */
  public rooms: THREE.Object3D | null = null;
  /** The parts of Lagos that are its people and traffic: left out when the city is only being looked at on the map */
  public lagosLife = new Set<THREE.Object3D>();
  private lagosOnShow = true;

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

  public addLagosInteractive(object: InteractiveObject): void {
    this.lagosInteractiveObjects.push(object);
  }

  public removeLagosInteractive(object: InteractiveObject): void {
    const at = this.lagosInteractiveObjects.indexOf(object);
    if (at >= 0) this.lagosInteractiveObjects.splice(at, 1);
  }

  /** Adds something to Lagos after the city was first put together: it is shown, hidden and clickable with the rest of Lagos. */
  public addToLagos(group: THREE.Object3D, objects: InteractiveObject[]): void {
    this.lagosGroups.push(group);
    this.lagosInteractiveObjects.push(...objects);
    group.visible = this.currentCityId === 'lagos';
  }

  public registerLagosGroups(groups: THREE.Object3D[]): void {
    this.lagosGroups = groups;
  }

  /** Makes sure a city has been put up, so that it can be shown or asked about before anyone has been there. */
  public ensure(cityId: string): void {
    if (cityId === 'abuja') this.initAbuja();
    else if (cityId === 'port_harcourt') this.initPortHarcourt();
  }

  /** What can be walked up to and used in a city. */
  public thingsIn(cityId: string): InteractiveObject[] {
    this.ensure(cityId);
    if (cityId === 'abuja') return this.abujaCity?.interactiveList ?? [];
    if (cityId === 'port_harcourt') return this.portHarcourtCity?.interactiveList ?? [];
    return this.lagosInteractiveObjects;
  }

  /**
   * Shows one city and no other, or none (indoors, or on a journey). With `life` false only
   * what stands still is shown: the city as a map shows it, without its people and traffic.
   * This is the one place that decides which city is drawn.
   */
  public show(cityId: string | null, life = true): void {
    if (cityId) this.ensure(cityId);
    const lagos = cityId === 'lagos';
    for (const group of this.lagosGroups) group.visible = lagos && (life || !this.lagosLife.has(group));
    if (lagos !== this.lagosOnShow) this.showLagosThings(lagos);
    if (this.abujaCity) this.abujaCity.group.visible = cityId === 'abuja';
    if (this.portHarcourtCity) this.portHarcourtCity.group.visible = cityId === 'port_harcourt';
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
    this.showLagosThings(visible);
  }

  /** The things of Lagos that can be used, shown or put away with the city. What is indoors is left as it is. */
  private showLagosThings(visible: boolean): void {
    this.lagosOnShow = visible;
    for (const obj of this.lagosInteractiveObjects) {
      if (this.isIndoors(obj.mesh)) continue;
      obj.mesh.visible = visible;
    }
  }

  private isIndoors(object: THREE.Object3D): boolean {
    for (let at: THREE.Object3D | null = object; at; at = at.parent) if (at === this.rooms) return true;
    return false;
  }

  public update(delta: number): void {
    if (this.currentCityId === 'abuja' && this.abujaCity) {
      this.abujaCity.update(delta);
    } else if (this.currentCityId === 'port_harcourt' && this.portHarcourtCity) {
      this.portHarcourtCity.update(delta);
    }
  }
}
