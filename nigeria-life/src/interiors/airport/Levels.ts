import * as THREE from 'three';

/**
 * The terminal's two levels and the ways between them. The main hall is the street level
 * (check-in, security, the gates, arrivals); the upper level is its own room above it (the food
 * court, duty free, the viewing gallery). Escalators and a glass lift join them: their places in
 * each, in each room's own coordinates.
 */
export const LEVEL_RISE = 5;
export const ESCALATOR_RUN = 8.66;

/** The main hall: its id and where it stands in the world */
export const HALL = { id: 'interior_airport', origin: new THREE.Vector3(260, 0, 240) };
/** The escalators in the hall: up on the left, down on the right; their feet, toward the entrance */
export const HALL_UP = { x: 4.6, foot: 15.96 };
export const HALL_DOWN = { x: 5.85, foot: 15.96 };
/** Where a passenger stands at the foot of each, and the glass lift's shaft and the spot before its doors */
export const HALL_UP_STAND = { x: 4.6, z: 17.3 };
export const HALL_DOWN_OFF = { x: 5.85, z: 17.4 };
export const HALL_LIFT = { x: 2.3, z: 15.2, stand: 16.9 };

/** The upper level: its key among the places, its room id, its size */
export const UPPER_KEY = 'airport-upper';
export const UPPER_ID = `interior_place_${UPPER_KEY}`;
export const UPPER_ROOM = { width: 40, length: 24, height: 5.5 };
/** The well the escalators come up through, and the lift's shaft, in the upper room's floor */
export const UPPER_WELL = { minX: 3.9, maxX: 6.55, minZ: 2.8, maxZ: 11.7 };
export const UPPER_LIFT = { x: 2.3, z: 10.2, minX: 1.3, maxX: 3.3, minZ: 9.25, maxZ: 11.15, stand: 8.3 };
/** The escalators' feet below the upper floor (toward the room's front) and their tops at its level */
export const UPPER_FOOT = 11.4;
export const UPPER_TOP = UPPER_FOOT - ESCALATOR_RUN;
