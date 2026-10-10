import * as THREE from 'three';
import { DrivableVehicle } from '../world/DrivableVehicle';
import type { World, InteractiveObject } from '../world/World';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { MAIN_ROAD } from '../world/density/StreetLayout';
import { AssetMarket } from './AssetMarket';
import { Garage, vehicleModel } from './Garage';
import { Registry, MY_ID } from './Registry';
import type { VehicleRecord } from './types';

/** How the game's small map is read as distance on a vehicle's clock: a hundred metres of map is a kilometre. */
const KM_PER_METRE = 0.01;

export interface DriverHooks {
  /** The vehicle the player is at the wheel of, if any */
  driving(): DrivableVehicle | null;
  /** Gets the player out of whatever they are driving, at once */
  getOut(): void;
  playerPosition(): THREE.Vector3;
}

/**
 * Players' vehicles as things in the city. Every vehicle that has been parked somewhere is
 * seen there by everyone, with its owner's name on it. Only its owner can get in: the moment
 * a vehicle is sold, the seller is out of the seat and it is the buyer's to drive.
 *
 * Other players' vehicles are shown where they were last parked. They are not followed
 * while their owner is driving them.
 */
export class OwnedVehicles {
  private readonly garage = Garage.get();
  private readonly world: World;
  private readonly hooks: DriverHooks;
  private readonly spawned = new Map<string, { vehicle: DrivableVehicle; card: InteractiveObject; last: THREE.Vector3; metres: number; ownerId: string; at: string }>();
  private readonly market = AssetMarket.get();

  constructor(world: World, hooks: DriverHooks) {
    this.world = world;
    this.hooks = hooks;
    Registry.get().subscribe(() => this.sync());
    this.sync();
  }

  private instanceId = (vehicleId: string) => `veh-own-${vehicleId}`;

  /** Is this drivable one of the player's own, and if so which? */
  public vehicleIdOf(vehicle: DrivableVehicle | null): string | null {
    if (!vehicle) return null;
    for (const [id, entry] of this.spawned) if (entry.vehicle === vehicle) return id;
    return null;
  }

  public isOut(vehicleId: string): boolean {
    return this.spawned.has(vehicleId);
  }

  /** Why the player may not drive this, or null if they may. The city's own vehicles are for anyone. */
  public cannotDrive(vehicle: DrivableVehicle): string | null {
    const id = this.vehicleIdOf(vehicle);
    if (!id) return null;
    const owner = this.garage.ownerOf(id);
    return owner === MY_ID ? null : `That belongs to ${this.market.nameOf(owner)}. Only its owner can drive it.`;
  }

  /** Set by the game: is this vehicle being driven from another game right now? */
  public movingElsewhere: (vehicle: DrivableVehicle) => boolean = () => false;

  /** Makes the world match the registry: every parked vehicle is where it was left, under its owner's name. */
  public sync(): void {
    const state = Registry.get().peek();
    const parked = new Map(Object.values(state.vehicles).filter((record) => record.parkedAt).map((record) => [record.id, record]));
    for (const [id, entry] of Array.from(this.spawned)) {
      const record = parked.get(id);
      const owner = this.garage.ownerOf(id);
      const driving = this.hooks.driving() === entry.vehicle;
      // Sold from under its driver: out of the seat at once
      if (driving && owner !== MY_ID) this.hooks.getOut();
      const where = record?.parkedAt ? `${record.parkedAt.x},${record.parkedAt.z},${record.parkedAt.yaw}` : '';
      // Gone, changed hands, or parked somewhere else by its owner: take it away, and put it back below if it is still about
      const away = this.movingElsewhere(entry.vehicle);
      if (!record || owner !== entry.ownerId || (!driving && !away && owner !== MY_ID && where !== entry.at)) {
        this.world.removeVehicle(entry.vehicle, entry.card);
        this.spawned.delete(id);
      }
    }
    for (const record of parked.values()) {
      if (!this.spawned.has(record.id)) this.put(record, record.parkedAt!.x, record.parkedAt!.z, record.parkedAt!.yaw);
    }
  }

  private put(record: VehicleRecord, x: number, z: number, yaw: number): void {
    const model = vehicleModel(record.modelId);
    if (!model) return;
    const ownerId = this.garage.ownerOf(record.id) ?? '';
    const mine = ownerId === MY_ID;
    const vehicle = new DrivableVehicle({ id: this.instanceId(record.id), name: `${model.name} · ${record.plate}`, type: model.type, ...model.drive }, new THREE.Vector3(x, 0, z), yaw);
    vehicle.mesh.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
    const card: InteractiveObject = {
      mesh: vehicle.mesh,
      id: vehicle.id,
      name: vehicle.name,
      category: mine ? 'Your vehicle' : `Vehicle of ${this.market.nameOf(ownerId)}`,
      description: mine
        ? `Yours. ${Math.round(record.mileage)} km on the clock, condition ${Math.round(record.condition)}%.`
        : `This belongs to ${this.market.nameOf(ownerId)}. Only its owner can drive it.`,
      interactionPoint: new THREE.Vector3(x + 1.8, 0, z),
    };
    this.world.addVehicle(vehicle, card);
    this.spawned.set(record.id, { vehicle, card, last: vehicle.mesh.position.clone(), metres: 0, ownerId, at: `${record.parkedAt?.x ?? x},${record.parkedAt?.z ?? z},${record.parkedAt?.yaw ?? yaw}` });
  }

  /**
   * Has a vehicle brought to the kerb beside the player. Returns why it cannot be, or null.
   * A vehicle is one machine: bringing it here takes it from wherever it was.
   */
  public bringRound(vehicleId: string): string | null {
    const record = this.garage.mine().find((entry) => entry.id === vehicleId);
    if (!record) return 'That vehicle is not yours.';
    const existing = this.spawned.get(vehicleId);
    if (existing && this.hooks.driving() === existing.vehicle) return 'You are driving it.';
    const player = this.hooks.playerPosition();
    // At the edge of the carriageway nearest the player, facing along the street
    const side = player.x >= 0 ? 1 : -1;
    const onBroadStreet = Math.abs(player.x) < MAIN_ROAD.halfRoad + MAIN_ROAD.walk + 4 && player.z > MAIN_ROAD.zMin && player.z < MAIN_ROAD.zMax;
    const x = onBroadStreet ? side * (MAIN_ROAD.halfRoad - 1.6) : player.x + 3;
    const z = player.z;
    const yaw = onBroadStreet ? (side > 0 ? Math.PI : 0) : 0;
    if (existing) {
      this.world.removeVehicle(existing.vehicle, existing.card);
      this.spawned.delete(vehicleId);
    }
    const at = { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: Math.round(yaw * 100) / 100 };
    this.put({ ...record, parkedAt: at }, at.x, at.z, at.yaw);
    void this.garage.addMileage(vehicleId, 0, at);
    return null;
  }

  /** Counts the distance the player drives in their own vehicles. */
  public update(): void {
    for (const entry of this.spawned.values()) {
      const at = entry.vehicle.mesh.position;
      if (this.hooks.driving() === entry.vehicle) entry.metres += Math.hypot(at.x - entry.last.x, at.z - entry.last.z);
      entry.last.copy(at);
      entry.card.interactionPoint.set(at.x + 1.8, 0, at.z);
    }
  }

  /** The player has got out: what was driven goes on the clock, and the vehicle stays where it was left. */
  public leftVehicle(vehicle: DrivableVehicle): void {
    const id = this.vehicleIdOf(vehicle);
    const entry = id ? this.spawned.get(id) : null;
    if (!id || !entry) return;
    const kilometres = entry.metres * KM_PER_METRE;
    entry.metres = 0;
    const at = { x: Math.round(vehicle.mesh.position.x * 10) / 10, z: Math.round(vehicle.mesh.position.z * 10) / 10, yaw: Math.round(vehicle.mesh.rotation.y * 100) / 100 };
    entry.at = `${at.x},${at.z},${at.yaw}`;
    void this.garage.addMileage(id, kilometres, at);
  }
}
