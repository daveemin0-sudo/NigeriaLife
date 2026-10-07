import * as THREE from 'three';
import type { InteractiveObject } from '../world/World';

export type CityId = 'lagos' | 'abuja' | 'ibadan' | 'kano' | 'port_harcourt';

export interface CityTravelRoute {
  destinationId: CityId;
  mode: 'flight' | 'luxury_coach';
  airlineOrOperator: string;
  flightOrBusCode: string;
  fare: number;
  durationSeconds: number;
  departureStation: string;
  arrivalStation: string;
  perkDescription: string;
  souvenirItem: {
    id: string;
    name: string;
    icon: string;
    description: string;
  };
}

export interface CityMetadata {
  id: CityId;
  name: string;
  state: string;
  zone: string; // Geopolitical zone (e.g. South West, North Central)
  tagline: string;
  capital: boolean;
  climate: 'coastal_tropical' | 'savannah_highland' | 'sahelian_semiarid' | 'delta_mangrove';
  skyColorHex: number;
  fogColorHex: number;
  sunIntensity: number;
  routes: CityTravelRoute[];
}

export interface CityInstance {
  group: THREE.Group;
  interactiveList: InteractiveObject[];
  groundMesh?: THREE.Mesh;
  update(delta: number): void;
  dispose?(): void;
}
