import * as THREE from 'three';

export interface DistrictData {
  id: string;
  name: string;
  subtitle: string;
  tagline: string;
  zone: 'Mainland' | 'Island' | 'Peninsula' | 'Industrial' | 'Special';
  center: THREE.Vector3;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  color: number;
  populationEstimate: string;
  propertyCount: number;
  businessCount: number;
  description: string;
  landmarks: string[];
  visualTheme: {
    buildingDensity: number;
    avgHeight: number;
    residentialRatio: number;
    commercialRatio: number;
    industrialRatio: number;
  };
  streetSpawnPoint: THREE.Vector3;
}

export interface MapLandmark {
  id: string;
  name: string;
  districtId: string;
  type: 'airport' | 'port' | 'bridge' | 'stadium' | 'landmark' | 'commercial' | 'culture' | 'tech';
  position: THREE.Vector3;
  rotationY?: number;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  actions: Array<{
    label: string;
    actionType: 'travel' | 'interstate' | 'enter' | 'inspect';
    targetId?: string;
  }>;
}

export type PropertyType =
  | 'room'
  | 'self-contained'
  | 'apartment'
  | 'duplex'
  | 'luxury apartment'
  | 'house'
  | 'shop'
  | 'office'
  | 'warehouse'
  | 'land';

export type PropertyStatus = 'available' | 'rented' | 'owned' | 'unavailable' | 'unowned' | 'purchased';

export interface MapProperty {
  id: string;
  cityId: string;
  districtId: string;
  type: PropertyType;
  name: string;
  position: THREE.Vector3;
  streetPosition: THREE.Vector3;
  price: number;
  rentPrice: number;
  status: PropertyStatus;
  ownerId: string;
  level: number;
  bedrooms: number;
  businessCompatible: boolean;
  description: string;
  features: string[];
  icon: string;
  safeBalance?: number;
}

export type BusinessType =
  | 'restaurant'
  | 'supermarket'
  | 'pharmacy'
  | 'fashion shop'
  | 'phone shop'
  | 'mechanic'
  | 'salon'
  | 'barbershop'
  | 'hotel'
  | 'logistics'
  | 'filling station'
  | 'tech company'
  | 'transport business';

export interface MapBusiness {
  id: string;
  name: string;
  cityId: string;
  districtId: string;
  propertyId: string;
  type: BusinessType;
  ownerId: string;
  income: number;
  operatingCost: number;
  level: number;
  status: 'open' | 'closed';
  position: THREE.Vector3;
  streetPosition: THREE.Vector3;
  icon: string;
  revenueEst: string;
  pendingRevenue?: number;
}

export interface CityMapData {
  id: string;
  name: string;
  state: string;
  tagline: string;
  districts: DistrictData[];
  landmarks: MapLandmark[];
  properties: MapProperty[];
  businesses: MapBusiness[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  waterBodies: Array<{
    name: string;
    type: 'ocean' | 'lagoon' | 'creek';
    center: THREE.Vector3;
    size: THREE.Vector2;
  }>;
  bridges: Array<{
    id: string;
    name: string;
    start: THREE.Vector3;
    end: THREE.Vector3;
    width: number;
  }>;
}
