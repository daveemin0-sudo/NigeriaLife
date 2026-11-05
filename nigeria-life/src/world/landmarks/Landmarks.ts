import * as THREE from 'three';
import type { InteractiveObject } from '../World';
import type { Obstruction, Rect } from '../plan/CityPlan';
import type { Landmark } from './Landmark';
import { PlaceActions } from '../../destinations/PlaceActions';
import { createStadium, type StadiumLandmark } from './Stadium';
import { createPort } from './Port';
import { createAirport, type AirportLandmark } from './Airport';

/** Where the Lagos airport's drawing goes: Ikeja, west of Ikorodu Road at Murtala Muhammed (drawn at -100, -125) */
export const LAGOS_AIRPORT = { x: -73, z: 6245 };
/** Its kerb, outside the terminal's front door, where the drawing put it at (-80, -101.2) */
export const LAGOS_AIRPORT_KERB = { x: -80 + 27, z: -101.2 + 6370 };
import { createClub } from './Club';
import { createMotorPark, type MotorParkLandmark } from './MotorPark';
import { createBuildingSite } from './BuildingSite';
import { CLUB } from '../../interiors/club/ClubService';
import type { StreetDoor } from '../Buildings';

/**
 * The great places of Lagos: the stadium, the port, the airport, the nightclub and the motor park. Each is
 * built from the building kit by its own maker, which can be called again for another city.
 */
export class Landmarks {
  public readonly group = new THREE.Group();
  public readonly stadium: StadiumLandmark;
  public readonly port: Landmark;
  public readonly airport: AirportLandmark;
  public readonly club: Landmark;
  public readonly motorPark: MotorParkLandmark;
  public readonly buildingSite: Landmark;
  public readonly list: Landmark[];
  public readonly interactiveList: InteractiveObject[] = [];

  constructor() {
    this.group.name = 'Landmarks';
    this.stadium = createStadium({ id: 'surulere-stadium', name: 'National Stadium, Surulere', x: -74, z: 15, teams: ['Eko United', 'Rivers Stars'] });
    this.port = createPort({ id: 'apapa-port', name: 'Apapa Port', x: -87.5, z: 76, ship: 'MV EKO PRIDE' });
    // Murtala Muhammed, in Ikeja: behind its hall on Ikorodu Road, with its own road out to it
    this.airport = createAirport({
      ids: ['dest_lagos_airport', 'mma-airport'],
      city: 'lagos',
      x: LAGOS_AIRPORT.x,
      z: LAGOS_AIRPORT.z,
      ownDoor: true,
      approach: { alongZ: -70, toX: -42 },
    });
    this.club = createClub({ id: 'quilox-club', name: CLUB.name, x: 24, z: 103, hours: CLUB.hours, gateFee: CLUB.gateFee });
    // Jibowu Motor Park, on the north side of Martins Street: where the coaches to Abuja and Port Harcourt leave from
    this.motorPark = createMotorPark({ id: 'jibowu-park', city: 'lagos', x: 92.5, z: -69.6, faces: 'south' });
    // The yard of the Eko Mega Plaza site on Broad Street, where the block work is done
    this.buildingSite = createBuildingSite({ id: 'eko-plaza-site', name: 'Eko Mega Plaza site', x: 19.4, z: 64.3, siteCardId: 'construction-site' });
    this.list = [this.stadium, this.port, this.airport, this.club, this.motorPark, this.buildingSite];
    for (const landmark of this.list) {
      this.group.add(landmark.group);
      this.interactiveList.push(...landmark.interactive);
      PlaceActions.registerAll(landmark.actions);
    }
  }

  /** The ground they stand on, which the generated city leaves alone. */
  public zones(): Rect[] {
    return this.list.map((landmark) => landmark.zone);
  }

  public obstructions(): Obstruction[] {
    return this.list.flatMap((landmark) => landmark.obstructions);
  }

  public doors(): Array<{ name: string; x: number; z: number }> {
    return this.list.flatMap((landmark) => landmark.doors);
  }

  /** Doors that lead to a room inside. */
  public streetDoors(): StreetDoor[] {
    return this.list.flatMap((landmark) => landmark.streetDoors ?? []);
  }

  /** The middle of the landmark that any of these ids belongs to (its own id, or one of its gates). */
  public middleOf(ids: Array<string | undefined>): THREE.Vector3 | null {
    const landmark = this.list.find((one) => ids.includes(one.id) || one.interactive.some((thing) => ids.includes(thing.id)));
    if (!landmark) return null;
    return new THREE.Vector3((landmark.zone.minX + landmark.zone.maxX) / 2, 0, (landmark.zone.minZ + landmark.zone.maxZ) / 2);
  }

  public update(delta: number, hour: number): void {
    for (const landmark of this.list) landmark.update?.(delta, hour);
  }

  /** What is going on at each of them, by id. */
  public status(): Record<string, Record<string, unknown>> {
    const out: Record<string, Record<string, unknown>> = {};
    for (const landmark of this.list) out[landmark.id] = landmark.status?.() ?? {};
    return out;
  }
}
