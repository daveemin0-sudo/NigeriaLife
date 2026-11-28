/**
 * Where Ikeja City Mall's two floors meet: the escalators' feet on the ground floor and their tops
 * upstairs, and the open well upstairs that looks down into the atrium. Both rooms read these, so
 * a ride up lands where the escalator really arrives.
 */

const RUN = 8.66;

export const MALL = {
  key: 'ikeja-city-mall',
  id: 'interior_place_ikeja-city-mall',
  width: 60,
  length: 44,
  height: 10,
  /** How high the gallery floor is */
  level: 5,
  run: RUN,
  /** The escalators rise toward -z from their feet */
  up: { x: 2.3, foot: -7.34 },
  down: { x: 3.55, foot: -7.34 },
};

export const MALL_UPPER = {
  key: 'ikeja-mall-upper',
  id: 'interior_place_ikeja-mall-upper',
  width: 50,
  length: 34,
  height: 6,
  /** The escalators come up through the well and arrive at its far edge */
  up: { x: 6.9, top: 2.0 },
  down: { x: 8.15, top: 2.0 },
  well: { minX: -7, maxX: 8.95, minZ: 1.5, maxZ: 12.5 },
  run: RUN,
};
