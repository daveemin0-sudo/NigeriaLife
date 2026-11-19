import * as THREE from 'three';
import type { CityId, CityInstance } from './CityTypes';
import { NIGERIA_CITIES_REGISTRY } from './CityRegistry';
import { AbujaCity } from './AbujaCity';
import { PortHarcourtCity } from './PortHarcourtCity';
import type { CityLife } from './CityLife';
import type { Player } from '../player/Player';
import type { InteractiveObject } from '../world/World';

export class CityManager {
  private scene: THREE.Scene;
  public currentCityId: CityId = 'lagos';

  // Extensible per-city factory & instance registry (Lagos is managed directly by World)
  private readonly cityFactories = new Map<CityId, () => CityInstance>();
  private readonly cities = new Map<CityId, CityInstance>();

  // Backwards-compatible typed accessors for existing Abuja / Port Harcourt callers
  public get abujaCity(): AbujaCity | null {
    return (this.cities.get('abuja') as AbujaCity | undefined) ?? null;
  }
  public get portHarcourtCity(): PortHarcourtCity | null {
    return (this.cities.get('port_harcourt') as PortHarcourtCity | undefined) ?? null;
  }

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
    this.registerCity('abuja', () => new AbujaCity());
    this.registerCity('port_harcourt', () => new PortHarcourtCity());
  }

  /** Registers a city builder by id so new states/cities plug in without changing switchCity(). */
  public registerCity(cityId: CityId, factory: () => CityInstance): void {
    this.cityFactories.set(cityId, factory);
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
    const id = cityId as CityId;
    if (id === 'lagos' || this.cities.has(id)) return;
    const factory = this.cityFactories.get(id);
    if (!factory) return;
    const instance = factory();
    instance.group.visible = false;
    this.cities.set(id, instance);
    this.scene.add(instance.group);
  }

  /** Which cities have been built in memory so far. */
  public builtCities(): CityId[] {
    return ['lagos', ...this.cities.keys()];
  }

  /** Scene groups for camera wall & vehicle collision checks in the given city. */
  public getCameraColliders(cityId: CityId = this.currentCityId): THREE.Object3D[] {
    if (cityId === 'lagos') return [];
    const inst = this.cities.get(cityId);
    return inst ? [inst.group] : [];
  }

  /** What can be walked up to and used in a city. */
  public thingsIn(cityId: string): InteractiveObject[] {
    this.ensure(cityId);
    if (cityId === 'lagos') return this.lagosInteractiveObjects;
    return this.cities.get(cityId as CityId)?.interactiveList ?? this.lagosInteractiveObjects;
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
    for (const [id, inst] of this.cities) inst.group.visible = id === cityId;
  }

  public initAbuja(): void {
    this.ensure('abuja');
  }

  public initPortHarcourt(): void {
    this.ensure('port_harcourt');
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

    this.ensure(targetCityId);
    this.currentCityId = targetCityId;
    const meta = NIGERIA_CITIES_REGISTRY[targetCityId];

    // Toggle city visibility uniformly using the descriptor registry
    const isLagos = targetCityId === 'lagos';
    this.setLagosVisible(isLagos);
    for (const [id, inst] of this.cities) {
      inst.group.visible = id === targetCityId;
    }

    const active = isLagos ? null : this.cities.get(targetCityId) ?? null;
    onInteractiveObjectsChanged(active ? active.interactiveList : this.lagosInteractiveObjects);

    // Position player & vehicle using the city descriptor's spawn point
    if (meta) {
      player.mesh.position.set(meta.spawn.x, meta.spawn.y, meta.spawn.z);
      if (player.currentVehicle) {
        player.currentVehicle.mesh.position.set(
          meta.spawn.vehicleX ?? meta.spawn.x,
          meta.spawn.y,
          meta.spawn.vehicleZ ?? meta.spawn.z
        );
      }

      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(meta.fogColorHex);
        this.scene.fog.density = meta.fogDensity;
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

  /** The traffic and people of the city on show, if it is Abuja or Port Harcourt (Lagos's are the world's own) */
  public lifeHere(): CityLife | null {
    const inst = this.cities.get(this.currentCityId) as (CityInstance & { life?: CityLife }) | undefined;
    return inst?.life ?? null;
  }

  public update(delta: number, viewer?: { x: number; z: number }): void {
    this.cities.get(this.currentCityId)?.update(delta, viewer);
  }
}
