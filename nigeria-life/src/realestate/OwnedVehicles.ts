import * as THREE from 'three';
import { DrivableVehicle } from '../world/DrivableVehicle';
import type { World, InteractiveObject } from '../world/World';
import { RENDER_LAYERS } from '../interiors/InteriorTypes';
import { MAIN_ROAD } from '../world/density/StreetLayout';
import { Garage, vehicleModel } from './Garage';
import { Registry } from './Registry';
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
 * The player's own vehicles as things in the city. A vehicle is in this player's world only
 * while the registry says it is theirs: sell it and it is gone from here, and the buyer's game
 * puts it in theirs. That is what stops someone driving a car they have sold.
 */
export class OwnedVehicles {
  private readonly garage = Garage.get();
  private readonly world: World;
  private readonly hooks: DriverHooks;
  private readonly spawned = new Map<string, { vehicle: DrivableVehicle; card: InteractiveObject; last: THREE.Vector3; metres: number }>();

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

  /** Makes the world match the registry: what is mine and parked somewhere is there, what is not mine is not. */
  public sync(): void {
    const mine = new Map(this.garage.mine().map((record) => [record.id, record]));
    for (const [id, entry] of Array.from(this.spawned)) {
      if (mine.has(id)) continue;
      // No longer this player's: out of the seat and out of this world
      if (this.hooks.driving() === entry.vehicle) this.hooks.getOut();
      this.world.removeVehicle(entry.vehicle, entry.card);
      this.spawned.delete(id);
    }
    for (const record of mine.values()) {
      if (!this.spawned.has(record.id) && record.parkedAt) this.put(record, record.parkedAt.x, record.parkedAt.z, record.parkedAt.yaw);
    }
  }

  private put(record: VehicleRecord, x: number, z: number, yaw: number): void {
    const model = vehicleModel(record.modelId);
    if (!model) return;
    const vehicle = new DrivableVehicle({ id: this.instanceId(record.id), name: `${model.name} · ${record.plate}`, type: model.type, ...model.drive }, new THREE.Vector3(x, 0, z), yaw);
    vehicle.mesh.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
    const card: InteractiveObject = {
      mesh: vehicle.mesh,
      id: vehicle.id,
      name: vehicle.name,
      category: 'Your vehicle',
      description: `Yours. ${Math.round(record.mileage)} km on the clock, condition ${Math.round(record.condition)}%.`,
      interactionPoint: new THREE.Vector3(x + 1.8, 0, z),
    };
    this.world.addVehicle(vehicle, card);
    this.spawned.set(record.id, { vehicle, card, last: vehicle.mesh.position.clone(), metres: 0 });
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
    this.put(record, x, z, yaw);
    void this.garage.addMileage(vehicleId, 0, { x, z, yaw });
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
    void this.garage.addMileage(id, kilometres, { x: vehicle.mesh.position.x, z: vehicle.mesh.position.z, yaw: vehicle.mesh.rotation.y });
  }
}
