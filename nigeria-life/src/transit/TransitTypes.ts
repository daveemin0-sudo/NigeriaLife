import type { CityId } from '../cities/CityTypes';

export type FlightPhase = 'boarding' | 'takeoff' | 'cruise' | 'landing' | 'completed';
export type FlightCameraView = 'outside' | 'cabin' | 'seat';

export interface FlightDetails {
  flightCode: string;
  airlineName: string;
  travelClass: string;
  tailNumber: string;
  originId: CityId;
  destinationId: CityId;
  originCode: string;
  destinationCode: string;
  originName: string;
  destinationName: string;
  durationSeconds: number;
}

export type RideCameraView = 'chase' | 'side' | 'inside';

export interface RideDetails {
  vehicleName: string;
  vehicleType: string;
  originName: string;
  destinationName: string;
  durationSeconds: number;
  trafficCondition: 'Clear' | 'Go-slow' | 'Heavy Traffic';
  weatherCondition: 'Sunny' | 'Overcast' | 'Evening';
  destinationCityId: CityId;
}
