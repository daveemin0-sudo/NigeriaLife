import type { DrivableVehicle } from '../world/DrivableVehicle';
import type { Vehicles } from '../world/Vehicles';
import type { NetworkManager } from './NetworkManager';

/** How long after the last word from a driver their vehicle is taken to have stopped */
const QUIET_MS = 1500;

/**
 * Vehicles other players are driving, seen moving in this game.
 *
 * A driver's game says where their vehicle is several times a second. Here the same vehicle
 * (the city's own, or one a player owns) follows. While someone else is at the wheel nobody
 * in this game can get in.
 */
export class VehicleSync {
  private readonly driven = new Map<string, { by: string; x: number; z: number; yaw: number; at: number }>();
  private readonly vehicles: Vehicles;
  private readonly localVehicle: () => DrivableVehicle | null;

  constructor(vehicles: Vehicles, network: NetworkManager, localVehicle: () => DrivableVehicle | null) {
    this.vehicles = vehicles;
    this.localVehicle = localVehicle;
    network.setOnVehicle((playerId, vehicle) => {
      this.driven.set(vehicle.id, { by: playerId, x: vehicle.x, z: vehicle.z, yaw: vehicle.yaw, at: performance.now() });
    });
    network.setOnPlayerLeft((playerId) => {
      for (const [id, entry] of this.driven) if (entry.by === playerId) this.driven.delete(id);
    });
  }

  /** The player driving this vehicle from another game right now, if anyone is. */
  public driverOf(vehicle: DrivableVehicle): string | null {
    const entry = this.driven.get(vehicle.id);
    return entry && performance.now() - entry.at < QUIET_MS ? entry.by : null;
  }

  public update(delta: number): void {
    const now = performance.now();
    const mine = this.localVehicle();
    for (const [id, entry] of this.driven) {
      if (now - entry.at > QUIET_MS) {
        // They have stopped or got out: it stays where it was last seen
        this.driven.delete(id);
        continue;
      }
      const vehicle = this.vehicles.getVehicleById(id);
      if (!vehicle || vehicle === mine) continue;
      const ease = Math.min(1, delta * 10);
      vehicle.mesh.position.x += (entry.x - vehicle.mesh.position.x) * ease;
      vehicle.mesh.position.z += (entry.z - vehicle.mesh.position.z) * ease;
      const turn = Math.atan2(Math.sin(entry.yaw - vehicle.mesh.rotation.y), Math.cos(entry.yaw - vehicle.mesh.rotation.y));
      vehicle.mesh.rotation.y += turn * ease;
    }
  }
}
