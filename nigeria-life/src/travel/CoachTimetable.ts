/**
 * The coaches between the three cities: who runs them, where they leave from, and the board
 * at each park. This is the one record of it: the motor parks, the ticket window, the booking
 * sheet and the journey itself all read it from here.
 *
 * The operator is SwiftRoute, made up for the game.
 */

export const OPERATOR = 'SwiftRoute';

export type CoachCity = 'lagos' | 'abuja' | 'port_harcourt';

export const MOTOR_PARKS: Record<CoachCity, { name: string; city: string }> = {
  lagos: { name: 'Jibowu Motor Park', city: 'Lagos' },
  abuja: { name: 'Utako Motor Park', city: 'Abuja' },
  port_harcourt: { name: 'Waterlines Motor Park', city: 'Port Harcourt' },
};

export interface CoachRoute {
  coach: string;
  from: CoachCity;
  to: CoachCity;
  fare: number;
  /** How long the road is, in hours on the board at the park */
  hours: number;
}

/** The board at the park. Every road has a coach each way, with its own number. */
export const COACH_ROUTES: CoachRoute[] = [
  { coach: 'SR 12', from: 'lagos', to: 'abuja', fare: 12000, hours: 10 },
  { coach: 'SR 14', from: 'lagos', to: 'port_harcourt', fare: 13000, hours: 9 },
  { coach: 'SR 21', from: 'abuja', to: 'lagos', fare: 12000, hours: 10 },
  { coach: 'SR 24', from: 'abuja', to: 'port_harcourt', fare: 11000, hours: 8 },
  { coach: 'SR 41', from: 'port_harcourt', to: 'lagos', fare: 13000, hours: 9 },
  { coach: 'SR 42', from: 'port_harcourt', to: 'abuja', fare: 11000, hours: 8 },
];
