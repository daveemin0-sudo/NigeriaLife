import type { PlaceInterior } from './PlaceInterior';

/** Every place's room by its key, as soon as it is made (before it is built): for the ways between rooms */
export const placeRooms = new Map<string, PlaceInterior>();
