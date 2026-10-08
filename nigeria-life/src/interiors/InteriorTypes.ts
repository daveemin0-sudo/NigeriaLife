import * as THREE from 'three';

export type GameLocationMode = 'street' | 'interior' | 'world-map';

export const RENDER_LAYERS = {
  DEFAULT: 0,
  STREET: 1,
  INTERIOR: 2,
  PLAYER: 3,
} as const;

export type BuildingTier = 
  | 'tier1_shell'      // Low-poly background facade (visual density, not enterable)
  | 'tier2_modular'    // Modular enterable template (residences, apartments, corner shops)
  | 'tier3_simulated'; // Handcrafted fully simulated destination (Hospital, Bank, Buka, Police)

export type InteriorType = 
  | 'hospital' 
  | 'bank' 
  | 'restaurant' 
  | 'police' 
  | 'residence' 
  | 'shop' 
  | 'office'
  | 'university'
  | 'airport';

export interface InteriorActivityAction {
  id: string;
  label: string;
  description: string;
  cost?: number;
  rewardCash?: number;
  rewardEnergy?: number;
  rewardHealth?: number;
  rewardCred?: number;
  rewardKnowledge?: number;
  rewardSocial?: number;
  itemReward?: {
    id: string;
    name: string;
    category: 'food' | 'medicine' | 'document' | 'electronics' | 'luxury';
    icon: string;
    description: string;
    price: number;
    usable: boolean;
    energyRestore?: number;
  };
  dialogueResponse: string;
}

export interface InteriorStationDef {
  id: string;
  name: string;
  category: string;
  description: string;
  relativePosition: THREE.Vector3; // Relative to interior origin
  interactionRadius?: number;
  icon?: string;
  actions: InteriorActivityAction[];
}

export interface InteriorNPCDef {
  id: string;
  name: string;
  role: string;
  title: string;
  relativePosition: THREE.Vector3;
  rotationY: number;
  outfitColor: number;
  hairColor?: number;
  skinColor?: number;
  hasStethoscope?: boolean;
  hasPoliceCap?: boolean;
  hasChefHat?: boolean;
  hasTie?: boolean;
  dialogueGreeting: string;
  actions: InteriorActivityAction[];
}

export interface InteriorRoomDef {
  id: string;
  name: string;
  size: { width: number; length: number; height: number };
  centerOffset: THREE.Vector3;
  floorColor: number;
  wallColor: number;
  hasCeiling?: boolean;
  ceilingColor?: number;
}

export interface InteriorDefinition {
  id: string;
  name: string;
  type: InteriorType;
  tier: BuildingTier;
  districtName: string;
  streetBuildingId: string;
  streetEntrance: THREE.Vector3;  // Position outside on the street
  streetExitRotation: number;    // Player heading when returning to street
  interiorOrigin: THREE.Vector3;  // Secluded world coordinates
  playerSpawnOffset: THREE.Vector3; // Where player lands inside
  exitDoorOffset: THREE.Vector3;  // Where the inside door object is located
  cameraOffset: THREE.Vector3;    // Camera viewing angle inside
  ambientLightColor: number;
  ambientLightIntensity: number;
  rooms: InteriorRoomDef[];
  stations: InteriorStationDef[];
  npcs: InteriorNPCDef[];
}
