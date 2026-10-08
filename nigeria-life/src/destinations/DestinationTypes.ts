import * as THREE from 'three';

export type DestinationCategory =
  | 'Healthcare'
  | 'University'
  | 'Airport'
  | 'Church'
  | 'Stadium'
  | 'Beach'
  | 'Bank'
  | 'Restaurant'
  | 'Nightclub'
  | 'Market'
  | 'Seaport'
  | 'Refinery'
  | 'Hotel'
  | 'Supermarket'
  | 'Residential';

export type TransportMode =
  | 'walk'
  | 'bike'
  | 'keke'
  | 'danfo'
  | 'brt'
  | 'taxi'
  | 'car';

export interface TransportOption {
  mode: TransportMode;
  label: string;
  icon: string;
  fare: number; // Fare in Nigerian Naira (₦)
  travelTimeSec: number; // Simulated travel time in seconds
  description: string;
}

export interface DestinationActivity {
  id: string;
  label: string;
  icon: string;
  description: string;
  cost?: number;
  rewardCash?: number;
  rewardEnergy?: number;
  rewardHealth?: number;
  rewardKnowledge?: number;
  rewardSocial?: number;
  itemReward?: {
    id: string;
    name: string;
    category: 'medicine' | 'food' | 'document' | 'electronics' | 'luxury';
    price: number;
    icon: string;
    description: string;
  };
  dialogueResponse: string;
}

export interface DestinationNPCSpec {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  attire: string;
  dialogueGreeting: string;
  relativePosition: THREE.Vector3;
}

export interface DestinationDefinition {
  id: string; // Canonical unique ID
  aliases: string[]; // Alternate IDs for backward compatibility and street linking
  name: string;
  category: DestinationCategory;
  city: 'lagos' | 'abuja' | 'port_harcourt';
  district: string; // Machine identifier e.g. 'lagos_island', 'yaba', 'airport'
  districtName: string; // Human display name e.g. 'Lagos Island', 'Akoka, Yaba', 'Ikeja'
  mapPosition: THREE.Vector3; // 3D coordinates on the world map
  mapVisualType: string;
  mapIcon: string;
  exteriorType: string;
  streetPosition: THREE.Vector3; // Player arrival landing point on the street
  entrance: {
    position: THREE.Vector3;
    promptLabel: string;
    triggerRadius: number;
  };
  interiorId: string;
  transportAvailability: TransportOption[];
  npcPopulation: DestinationNPCSpec[];
  activities: DestinationActivity[];
  services: string[];
  openingHours: string;
  destinationDescription: string;
  shortDescription: string;
  isEnterable: boolean;
}
