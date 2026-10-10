import * as THREE from 'three';
import type { InteractiveObject } from '../World';
import type { Obstruction, Rect } from '../plan/CityPlan';
import type { Landmark } from './Landmark';
import { PlaceActions } from '../../destinations/PlaceActions';
import { createStadium, type StadiumLandmark } from './Stadium';
import { createPort } from './Port';
import { createAirport, type AirportLandmark } from './Airport';
import { createClub } from './Club';
import { CLUB } from '../../interiors/club/ClubService';
import type { StreetDoor } from '../Buildings';

/**
 * The great places of Lagos: the stadium, the port, the airport and the nightclub. Each is
 * built from the building kit by its own maker, which can be called again for another city.
 */
export class Landmarks {
  public readonly group = new THREE.Group();
  public readonly stadium: StadiumLandmark;
  public readonly port: Landmark;
  public readonly airport: AirportLandmark;
  public readonly club: Landmark;
  public readonly list: Landmark[];
  public readonly interactiveList: InteractiveObject[] = [];

  constructor() {
    this.group.name = 'Landmarks';
    this.stadium = createStadium({ id: 'surulere-stadium', name: 'National Stadium, Surulere', x: -74, z: 15, teams: ['Eko United', 'Rivers Stars'] });
    this.port = createPort({ id: 'apapa-port', name: 'Apapa Port', x: -87.5, z: 76, ship: 'MV EKO PRIDE' });
    this.airport = createAirport({
      ids: ['dest_lagos_airport', 'mma-airport'],
      name: 'Murtala Muhammed Airport',
      code: 'LOS',
      routes: [
        { flight: 'NL 204', back: 'NL 205', to: 'Abuja' },
        { flight: 'NL 310', back: 'NL 311', to: 'Port Harcourt' },
      ],
    });
    this.club = createClub({ id: 'quilox-club', name: CLUB.name, x: 24, z: 103, hours: CLUB.hours, gateFee: CLUB.gateFee });
    this.list = [this.stadium, this.port, this.airport, this.club];
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
