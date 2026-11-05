import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { clickBox, type Landmark, type LandmarkHost } from './Landmark';
import { Sequence, steps } from '../../interactions/Sequence';
import { CoachService, MOTOR_PARKS, OPERATOR, COACH_REFUND_SHARE, type CoachCity } from '../../travel/Coaches';

/**
 * A motor park: where the coaches to other cities leave from and pull in. A fenced yard with
 * a gate on the street, a ticket office with a window, a shelter where passengers wait, and
 * three bays with a coach in each. The coach in the middle bay is the one that goes: a
 * passenger with a ticket walks up to its door, shows the conductor the ticket, and it pulls
 * out through the gate with them on it.
 *
 * It is drawn looking in from the street: `u` runs across the front (right is positive) and
 * `v` runs from the gate to the back fence. The same park is put down facing whichever way
 * its street is.
 */

const WIDTH = 29;
const DEPTH = 31;
const GATE = 4.2;
const BAY_V = 22.5;
const COACH_LENGTH = 12;

const LIVERY = 0x0f5132;
const CREAM = 0xf5f0e6;
const GLASS = 0x1e293b;
const WHITE = 0xf8fafc;
const TYRE = 0x18181b;
const FENCE = 0x64748b;
const ASPHALT = 0x3f3f46;

/** How long the coach takes to pull out of its bay and through the gate */
const PULL_OUT_SECONDS = 4.6;

type Put = (hex: number, length: number, height: number, width: number, along: number, baseY: number, across: number, options?: { glow?: boolean; solid?: boolean }) => void;

/**
 * A coach, in its own terms: `along` runs to its front, `across` to its right, where the door
 * is. Whoever draws it says where those point.
 */
function drawCoach(put: Put, body: number): void {
  // Wheels and the skirt between them
  for (const along of [-3.9, 3.7]) put(TYRE, 1.05, 1.05, 2.66, along, 0, 0);
  put(0x27272a, COACH_LENGTH - 0.6, 0.45, 2.4, 0, 0.3, 0);
  // The body, the band of windows along it, and the roof
  put(body, COACH_LENGTH, 2.75, 2.55, 0, 0.55, 0, { solid: true });
  put(GLASS, COACH_LENGTH - 1.2, 0.95, 2.6, -0.35, 1.85, 0);
  put(WHITE, COACH_LENGTH + 0.02, 0.2, 2.58, 0, 1.5, 0);
  put(WHITE, COACH_LENGTH - 0.3, 0.16, 2.45, 0, 3.3, 0);
  put(0xd4d4d8, 2.6, 0.32, 1.6, -1.2, 3.42, 0);
  // The front: windscreen, the board over it, headlights
  put(0x0f172a, 0.08, 1.45, 2.3, COACH_LENGTH / 2 + 0.01, 1.35, 0);
  put(0xfde68a, 0.08, 0.3, 1.5, COACH_LENGTH / 2 + 0.02, 2.88, 0, { glow: true });
  for (const across of [-0.9, 0.9]) put(0xfef9c3, 0.07, 0.24, 0.5, COACH_LENGTH / 2 + 0.02, 0.78, across, { glow: true });
  // The back: lights
  for (const across of [-0.95, 0.95]) put(0xdc2626, 0.07, 0.3, 0.36, -COACH_LENGTH / 2 - 0.02, 1.0, across, { glow: true });
  // The door, on the right near the front, and the mirrors
  put(0x0b3d26, 0.95, 2.1, 0.06, 4.55, 0.6, 1.28);
  put(GLASS, 0.6, 0.8, 0.07, 4.55, 1.8, 1.29);
  for (const across of [-1.45, 1.45]) put(TYRE, 0.12, 0.42, 0.22, COACH_LENGTH / 2 - 0.3, 2.1, across);
}

export interface MotorParkOptions {
  id: string;
  city: CoachCity;
  /** The middle of the gate, on the line of the front fence */
  x: number;
  z: number;
  /** Which way the park looks out: toward the street it stands on */
  faces: 'south' | 'west';
  /** How much bare ground lies between the gate and the pavement of the street, to be paved */
  apron?: number;
  /** The id the ticket window answers to, where a city already had a name for it */
  ticketsId?: string;
}

export interface MotorParkLandmark extends Landmark {
  city: CoachCity;
  /** Where a passenger who has just got down from a coach stands, and which way they look */
  setDown: THREE.Vector3;
  setDownFacing: number;
  /** Where the coach is: whoever is on it goes where it goes */
  coach: THREE.Group;
  /** Which way the gate is from the bays: the way a coach leaves */
  leaves: { x: number; z: number };
  /** The coach is in its bay, for a passenger arriving on it */
  receive(): void;
  /** The coach pulls out of its bay and through the gate; `gone` is called when it has left the park */
  sendOff(gone: () => void): void;
}

export function createMotorPark(options: MotorParkOptions): MotorParkLandmark {
  const coaches = CoachService.get();
  const city = options.city;
  const name = MOTOR_PARKS[city].name;
  const site = { x: options.x, z: options.z };
  const south = options.faces === 'south';
  const X = (u: number, v: number) => site.x + (south ? u : v);
  const Z = (u: number, v: number) => site.z + (south ? -v : u);
  const at = (u: number, v: number) => new THREE.Vector3(X(u, v), 0, Z(u, v));
  const local = (u: number, y: number, v: number) => new THREE.Vector3(X(u, v) - site.x, y, Z(u, v) - site.z);
  /** The way something faces, given where its front points in the park's own terms */
  const yawOf = (du: number, dv: number) => Math.atan2(south ? du : dv, south ? -dv : du);

  const b = new Builder().around(site.x, site.z);
  const box = (hex: number, across: number, height: number, deep: number, u: number, baseY: number, v: number, opts: { glow?: boolean; solid?: boolean } = {}) =>
    b.box(hex, south ? across : deep, height, south ? deep : across, X(u, v), baseY, Z(u, v), opts);
  const ground = (hex: number, across: number, deep: number, u: number, y: number, v: number) => b.ground(hex, south ? across : deep, south ? deep : across, X(u, v), y, Z(u, v));
  const post = (hex: number, radius: number, height: number, u: number, v: number, opts: { solid?: boolean } = {}) => b.cylinder(hex, radius, height, X(u, v), 0, Z(u, v), opts);
  /** Someone standing about: trousers, shirt, head */
  const person = (u: number, v: number, shirt: number, trousers = 0x1f2937, hat?: number) => {
    box(trousers, 0.42, 0.8, 0.3, u, 0, v);
    box(shirt, 0.5, 0.62, 0.34, u, 0.8, v);
    box(0x6b4226, 0.3, 0.3, 0.3, u, 1.43, v);
    if (hat !== undefined) box(hat, 0.38, 0.14, 0.38, u, 1.73, v);
  };

  // --- The yard ---------------------------------------------------------------------------
  ground(ASPHALT, WIDTH, DEPTH, 0, 0.02, DEPTH / 2);
  if ((options.apron ?? 0) > 0) ground(0xbdb5a8, GATE * 2 + 1.2, options.apron!, 0, 0.018, -options.apron! / 2);
  // The bays: a line each side of where a coach stands, and a stop bar at the front of each
  for (const u of [-9.5, 0, 9.5]) {
    for (const side of [-1.9, 1.9]) ground(WHITE, 0.14, COACH_LENGTH + 1.4, u + side, 0.03, BAY_V);
    ground(0xfacc15, 3.8, 0.2, u, 0.03, BAY_V - COACH_LENGTH / 2 - 0.9);
  }
  // The way out, from the middle bay to the gate
  for (let v = 2; v < 14; v += 3) ground(0xfacc15, 0.16, 1.5, 0, 0.03, v);

  // --- The fence, and the gate in it ------------------------------------------------------
  const frontRun = WIDTH / 2 - GATE - 0.6;
  for (const side of [-1, 1]) {
    box(FENCE, frontRun, 2.4, 0.2, side * (GATE + 0.6 + frontRun / 2), 0, 0, { solid: true });
    box(FENCE, 0.2, 2.4, DEPTH, side * (WIDTH / 2), 0, DEPTH / 2, { solid: true });
    box(WHITE, 0.7, 5.3, 0.7, side * (GATE + 0.35), 0, 0, { solid: true });
  }
  box(FENCE, WIDTH, 2.4, 0.2, 0, 0, DEPTH, { solid: true });
  box(LIVERY, GATE * 2 + 1.4, 1.1, 0.5, 0, 4.5, 0);

  // --- The ticket office, left of the gate, with its window on the side the passengers pass --
  box(CREAM, 6, 3.2, 4.6, -10.8, 0, 4.2, { solid: true });
  box(LIVERY, 6.7, 0.26, 5.3, -10.8, 3.2, 4.2);
  box(0xfef9c3, 0.1, 0.9, 1.7, -7.76, 1.2, 4.2, { glow: true });
  box(0x78716c, 0.45, 0.08, 1.9, -7.58, 1.1, 4.2);
  box(LIVERY, 0.3, 0.5, 4.6, -7.9, 0, 4.2);

  // --- The shelter, right of the gate: a roof on posts, two benches, people waiting with their bags
  box(0xe2e8f0, 7.4, 0.2, 4.8, 10.4, 2.9, 4.4);
  box(LIVERY, 7.4, 0.3, 0.14, 10.4, 2.6, 2.05);
  for (const u of [7, 13.8]) for (const v of [2.3, 6.5]) post(0x94a3b8, 0.09, 2.9, u, v);
  for (const v of [3.3, 5.5]) {
    box(0x92400e, 5.6, 0.1, 0.5, 10.4, 0.45, v);
    for (const u of [8, 12.8]) box(0x44403c, 0.1, 0.45, 0.4, u, 0, v);
  }
  person(8.6, 4.4, 0xb91c1c);
  person(10.9, 4.4, 0x1d4ed8, 0x374151, 0xfacc15);
  person(12.4, 2.6, 0x7c3aed);
  box(0x7c2d12, 0.7, 0.5, 0.45, 9.4, 0, 4.5);
  box(0x1e3a8a, 0.5, 0.75, 0.35, 11.6, 0, 4.6);
  box(0x365314, 0.9, 0.42, 0.6, 12.9, 0, 3.4);

  // --- Two coaches standing in the outer bays -----------------------------------------------
  for (const [bay, colour] of [[-9.5, LIVERY], [9.5, 0x14532d]] as Array<[number, number]>) {
    drawCoach((hex, length, height, width, along, baseY, across, opts) => box(hex, width, height, length, bay - across, baseY, BAY_V - along, opts), colour);
  }

  // --- The conductor by the door of the coach that goes, and what is waiting to be loaded ---
  person(-2.5, 16.2, LIVERY, 0x1f2937, 0x0b3d26);
  box(0x7c2d12, 0.8, 0.55, 0.5, -3.3, 0, 20.4);
  box(0x334155, 0.6, 0.8, 0.4, -3.4, 0, 21.4);
  box(0x92400e, 0.7, 0.4, 0.7, -3.2, 0.55, 20.4);
  // Lamps, a stack of tyres, a drum
  for (const u of [-13.6, 13.6]) {
    post(0x94a3b8, 0.1, 6.5, u, 13);
    box(0xfff7c2, 1.4, 0.2, 0.5, u - Math.sign(u) * 0.6, 6.5, 13, { glow: true });
  }
  for (let k = 0; k < 3; k++) b.cylinder(TYRE, 0.5, 0.28, X(13.2, 29.6), k * 0.3, Z(13.2, 29.6));
  b.cylinder(0x1d4ed8, 0.32, 0.95, X(-13.4, 29.8), 0, Z(-13.4, 29.8));
  // Posts for the board that stands over the back fence
  for (const u of [-5.6, 5.6]) box(0x94a3b8, 0.2, 4.2, 0.2, u, 0, DEPTH - 0.35);

  const group = b.build(options.id);
  group.position.set(site.x, 0, site.z);

  // --- Writing ----------------------------------------------------------------------------
  const others = coaches.routesFrom(city).map((route) => MOTOR_PARKS[route.to].city);
  const gateSign = signBoard([name.toUpperCase(), `${OPERATOR} coaches to ${others.join(' and ')}`], GATE * 2 + 1.2, 1.0, '#0f5132');
  gateSign.position.copy(local(0, 5.05, -0.27));
  gateSign.rotation.y = yawOf(0, -1);
  const ticketSign = signBoard(['TICKETS'], 2.2, 0.5, '#f8fafc', '#0f5132');
  ticketSign.position.copy(local(-7.72, 2.5, 4.2));
  ticketSign.rotation.y = yawOf(1, 0);
  const board = signBoard([`${OPERATOR.toUpperCase()} COACHES`, `Departures from the middle bay  ·  ${others.join('  ·  ')}`], 12, 1.5, '#0f172a', '#facc15');
  board.position.copy(local(0, 3.4, DEPTH - 0.2));
  board.rotation.y = yawOf(0, -1);
  group.add(gateSign, ticketSign, board);

  // --- The coach that goes ----------------------------------------------------------------
  const coachBuilder = new Builder().around(0, 0);
  drawCoach((hex, length, height, width, along, baseY, across, opts) => coachBuilder.box(hex, length, height, width, along, baseY, across, { glow: opts?.glow }), LIVERY);
  const coach = coachBuilder.build(`${options.id}-coach`);
  const destination = signBoard([OPERATOR.toUpperCase()], 1.5, 0.3, '#0f172a', '#fde68a');
  destination.rotation.y = Math.PI / 2;
  destination.position.set(COACH_LENGTH / 2 + 0.07, 3.03, 0);
  coach.add(destination);
  coach.traverse((child) => { child.userData.surface = true; });
  // Its front is its +x: in its bay it points at the gate
  const towardGate = Math.atan2(-(Z(0, 0) - Z(0, 1)), X(0, 0) - X(0, 1));
  const park = (v: number) => {
    coach.position.copy(local(0, 0, v));
    coach.rotation.y = towardGate;
  };
  park(BAY_V);
  group.add(coach);

  // --- What can be done here --------------------------------------------------------------
  const windowPoint = at(-6.4, 4.2);
  const windowTarget = at(-7.8, 4.2);
  const doorPoint = at(-2.5, BAY_V - 4.55);
  const doorTarget = at(-1.3, BAY_V - 4.55);
  const ticketsId = options.ticketsId ?? `${options.id}-tickets`;
  const coachId = `${options.id}-coach`;

  const windowBox = clickBox(south ? 2.6 : 3.2, 3, south ? 3.2 : 2.6);
  windowBox.position.copy(local(-7.2, 1.5, 4.2));
  const coachBox = clickBox(south ? 4.4 : COACH_LENGTH * 0.6, 3.6, south ? COACH_LENGTH * 0.6 : 4.4);
  coachBox.position.copy(local(-0.8, 1.8, BAY_V - 3));
  // Marks of where to press, not things standing in the yard
  windowBox.userData.surface = true;
  coachBox.userData.surface = true;
  group.add(windowBox, coachBox);

  let leaving: { clock: number; gone: (() => void) | null } | null = null;
  let away = false;

  const atWindow = (host: LandmarkHost, id: string, effect: () => boolean | void) =>
    host.director.perform({ id, actor: host.actor, point: windowPoint, target: windowTarget, speed: 4, animation: { arms: 'reach' }, seconds: 1.1, effectAt: 0.6, effect });

  const landmark: MotorParkLandmark = {
    id: options.id,
    name,
    city,
    coach,
    leaves: { x: X(0, 0) - X(0, 1), z: Z(0, 0) - Z(0, 1) },
    setDown: doorPoint,
    setDownFacing: yawOf(0, -1),
    zone: south
      ? { minX: site.x - WIDTH / 2 - 0.3, maxX: site.x + WIDTH / 2 + 0.3, minZ: site.z - DEPTH - 0.3, maxZ: site.z + 0.4 }
      : { minX: site.x - 0.4, maxX: site.x + DEPTH + 0.3, minZ: site.z - WIDTH / 2 - 0.3, maxZ: site.z + WIDTH / 2 + 0.3 },
    group,
    obstructions: b.obstructions(name, site.x, site.z),
    interactive: [
      {
        mesh: windowBox,
        id: ticketsId,
        name: `${name}, ticket window`,
        category: 'Coaches to other cities',
        description: `${OPERATOR} coaches leave from here for ${others.join(' and ')}. A ticket is bought at this window and shown to the conductor at the coach.`,
        interactionPoint: windowPoint,
      },
      {
        mesh: coachBox,
        id: coachId,
        name: `${OPERATOR} coach, middle bay`,
        category: 'Coaches · Boarding',
        description: 'The coach that goes next. The conductor at its door lets on passengers who hold a ticket from this park.',
        interactionPoint: doorPoint,
      },
    ],
    actions: {
      [ticketsId]: {
        label: () => {
          const held = coaches.ticket;
          return held ? `🎫 Your ticket: ${held.route.coach} to ${MOTOR_PARKS[held.route.to].city}` : '🎫 Buy a coach ticket';
        },
        run: (host) => {
          const held = coaches.ticket;
          const choices: Array<{ label: string; note?: string; pick: () => void }> = [];
          if (held) {
            choices.push({
              label: 'Hand the ticket back',
              note: `₦${Math.round(held.route.fare * COACH_REFUND_SHARE).toLocaleString()} back`,
              pick: () => atWindow(host, 'hand back a coach ticket', () => {
                const result = coaches.handBack();
                host.say(result.ok ? `Ticket handed back. ${result.reason}` : result.reason ?? 'It cannot be handed back.', result.ok ? 'success' : 'warning');
              }),
            });
          } else {
            for (const route of coaches.routesFrom(city)) {
              choices.push({
                label: `${MOTOR_PARKS[route.to].city}, ${route.coach}`,
                note: `₦${route.fare.toLocaleString()} · about ${route.hours} hours`,
                pick: () => atWindow(host, 'buy a coach ticket', () => {
                  const result = coaches.buy(route, city);
                  if (!result.ok) {
                    host.say(result.reason ?? 'The ticket could not be sold.', 'warning');
                    return false;
                  }
                  host.say(`Ticket bought: ${coaches.describe(route)}, seat ${coaches.ticket?.seat}. The coach is in the middle bay: show the conductor your ticket.`, 'success');
                }),
              });
            }
          }
          choices.push({ label: 'Not now', pick: () => {} });
          host.ask({
            who: 'Ticket clerk',
            role: `${OPERATOR}, ${name}`,
            text: held
              ? `You hold a ticket for ${coaches.describe(held.route)}, seat ${held.seat}. ${held.route.from === city ? 'The coach is in the middle bay.' : `It leaves from ${MOTOR_PARKS[held.route.from].name}.`}`
              : `Coaches leave from here for ${others.join(' and ')}. Where are you going?`,
            choices,
          });
        },
      },
      [coachId]: {
        label: () => {
          const held = coaches.ticket;
          if (!held || held.route.from !== city) return '🚌 Boarding is for passengers with a ticket';
          return leaving || away ? '🚌 The coach has gone' : `🚌 Board ${held.route.coach} to ${MOTOR_PARKS[held.route.to].city}`;
        },
        run: (host) => {
          const held = coaches.ticket;
          if (!held) {
            host.say('The conductor wants to see a ticket. The ticket window is by the gate.', 'info');
            return;
          }
          if (held.route.from !== city) {
            host.say(`Your ticket is for ${coaches.describe(held.route)}. That coach leaves from ${MOTOR_PARKS[held.route.from].name}.`, 'info');
            return;
          }
          if (leaving || away) return;
          const actor = host.actor;
          if (host.director.interrupt(actor) === 'locked') return;
          const board = new Sequence('board the coach', [actor]).add(
            steps.walk(actor, doorPoint, { speed: 4 }),
            steps.face(actor, doorTarget),
            // The ticket is shown to the conductor
            steps.setPose(actor, { arms: 'reach' }),
            steps.wait(0.8),
            steps.setPose(actor, { arms: 'rest' }),
            steps.call('up the steps', () => {
              const result = coaches.board(city);
              if (!result.ok) {
                host.say(result.reason ?? 'You cannot board.', 'warning');
                return false;
              }
            })
          );
          host.director.run(board);
        },
      },
    },
    doors: [{ name: `Gate of ${name}`, x: X(0, -0.9), z: Z(0, -0.9) }],
    receive() {
      leaving = null;
      away = false;
      coach.visible = true;
      park(BAY_V);
    },
    sendOff(gone) {
      leaving = { clock: 0, gone };
    },
    update(delta) {
      // The coach that took someone away is back in its bay by the time anyone is here to see it
      if (away && coaches.status().state !== 'boarded') landmark.receive();
      if (!leaving) return;
      leaving.clock += delta;
      // Away from the bay gently, then out through the gate and on to the road
      const t = Math.min(1, leaving.clock / PULL_OUT_SECONDS);
      park(BAY_V - (BAY_V + 13) * t * t);
      if (t >= 1) {
        const gone = leaving.gone;
        leaving = null;
        away = true;
        coach.visible = false;
        gone?.();
      }
    },
    status: () => ({ city, coachInBay: !leaving && !away, leaving: !!leaving, ticket: coaches.status() }),
  };
  return landmark;
}
