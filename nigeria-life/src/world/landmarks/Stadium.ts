import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { MatchSim } from './MatchSim';
import { PLACE_HOURS } from '../../destinations/Hours';
import { clickBox, figure, type Landmark, type LandmarkHost } from './Landmark';
import { Sequence, steps } from '../../interactions/Sequence';

/**
 * A football stadium: a pitch with a running track round it, four stands of stepped seats,
 * a roof over the two long ones, floodlights, a scoreboard and a gate with a ticket booth.
 * A match is played on the pitch through the day and a crowd watches it.
 *
 * Everything is measured from the centre spot. The pitch runs east-west; the gate is in the
 * east stand.
 */

const PITCH_L = 36;
const PITCH_W = 24;
/** Half the size of the running track round the pitch */
const TRACK_X = 21;
const TRACK_Z = 15;
/** Where the stands begin */
const STAND_X = 21.5;
const STAND_Z = 15.5;
const TIERS = 5;
const TIER_DEPTH = 1.1;
const TIER_RISE = 0.8;
/** The outside face of the walls */
const OUTER_X = 27.5;
const OUTER_Z = 21.5;
/** The way in through the east stand */
const GATE_FROM = -13;
const GATE_TO = -7;
const GATE_Z = (GATE_FROM + GATE_TO) / 2;

const OPENS = PLACE_HOURS.stadium.opens;
const CLOSES = PLACE_HOURS.stadium.closes;
export const TICKET_PRICE = 1500;

const GREEN = 0x15803d;
const WHITE = 0xf1f5f9;
const CONCRETE = 0xcbd5e1;

interface TierRun {
  along: 'x' | 'z';
  from: number;
  to: number;
  /** Where the row is on the other axis */
  fixed: number;
  top: number;
}

/** Every row of seats in the ground, lowest first. */
function tierRuns(): TierRun[] {
  const runs: TierRun[] = [];
  for (let i = 0; i < TIERS; i++) {
    const out = TIER_DEPTH * (i + 0.5);
    const top = TIER_RISE * (i + 1);
    runs.push({ along: 'x', from: -OUTER_X + 0.5, to: OUTER_X - 0.5, fixed: -(STAND_Z + out), top });
    runs.push({ along: 'x', from: -OUTER_X + 0.5, to: OUTER_X - 0.5, fixed: STAND_Z + out, top });
    runs.push({ along: 'z', from: -STAND_Z, to: STAND_Z, fixed: -(STAND_X + out), top });
    runs.push({ along: 'z', from: -STAND_Z, to: GATE_FROM, fixed: STAND_X + out, top });
    runs.push({ along: 'z', from: GATE_TO, to: STAND_Z, fixed: STAND_X + out, top });
  }
  return runs;
}

export interface StadiumOptions {
  id: string;
  name: string;
  /** Where the centre spot is */
  x: number;
  z: number;
  teams: [string, string];
}

export interface StadiumLandmark extends Landmark {
  match: MatchSim;
}

export function createStadium(options: StadiumOptions): StadiumLandmark {
  const site = { x: options.x, z: options.z };
  const at = (x: number, z: number) => new THREE.Vector3(site.x + x, 0, site.z + z);
  const sim = new MatchSim(PITCH_L, PITCH_W, options.teams);
  const b = new Builder();
  /** The grass, the lines and the track: a sheet of their own, lit by the floodlights at night */
  const field = new Builder();

  // --- The pitch and the track ------------------------------------------------------------
  field.ground(0xb4532a, TRACK_X * 2, TRACK_Z * 2, 0, 0.02, 0);
  for (const inset of [0.9, 1.9]) {
    // Lane lines
    field.ground(WHITE, TRACK_X * 2 - inset * 2, 0.08, 0, 0.03, -(TRACK_Z - inset)).ground(WHITE, TRACK_X * 2 - inset * 2, 0.08, 0, 0.03, TRACK_Z - inset);
    field.ground(WHITE, 0.08, TRACK_Z * 2 - inset * 2, -(TRACK_X - inset), 0.03, 0).ground(WHITE, 0.08, TRACK_Z * 2 - inset * 2, TRACK_X - inset, 0.03, 0);
  }
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    field.ground(i % 2 === 0 ? 0x2f8f3a : 0x3aa348, PITCH_L / stripes, PITCH_W, -PITCH_L / 2 + (i + 0.5) * (PITCH_L / stripes), 0.04, 0);
  }
  const line = 0.14;
  const paintY = 0.055;
  field.ground(WHITE, PITCH_L, line, 0, paintY, -PITCH_W / 2).ground(WHITE, PITCH_L, line, 0, paintY, PITCH_W / 2);
  field.ground(WHITE, line, PITCH_W, -PITCH_L / 2, paintY, 0).ground(WHITE, line, PITCH_W, PITCH_L / 2, paintY, 0);
  field.ground(WHITE, line, PITCH_W, 0, paintY, 0).ring(WHITE, 3, 3.14, 0, paintY, 0).ring(WHITE, 0, 0.2, 0, paintY, 0);
  for (const end of [-1, 1]) {
    const goalLine = (end * PITCH_L) / 2;
    // Penalty area and six-yard box
    for (const [depth, half] of [[5.5, 6.6], [2, 3.4]]) {
      field.ground(WHITE, line, half * 2, goalLine - end * depth, paintY, 0);
      field.ground(WHITE, depth, line, goalLine - (end * depth) / 2, paintY, -half).ground(WHITE, depth, line, goalLine - (end * depth) / 2, paintY, half);
    }
    field.ring(WHITE, 0, 0.16, goalLine - end * 4, paintY, 0);
    // The goal: posts, bar and a net
    b.cylinder(WHITE, 0.07, 2.3, goalLine, 0, -3.4).cylinder(WHITE, 0.07, 2.3, goalLine, 0, 3.4);
    b.box(WHITE, 0.12, 0.12, 6.94, goalLine, 2.3, 0);
    // The frame the net hangs on: two stays back from the bar to a rail along the ground
    for (const z of [-3.4, 3.4]) {
      b.cylinder(0xe2e8f0, 0.04, 1.5, goalLine + end * 1.3, 0, z).box(0xe2e8f0, 1.54, 0.06, 0.06, goalLine + end * 0.65, 1.87, z, { roll: end * -0.55 });
    }
    b.box(0xe2e8f0, 0.06, 0.06, 6.8, goalLine + end * 1.3, 1.5, 0).box(0xe2e8f0, 0.06, 0.06, 6.8, goalLine + end * 1.3, 0, 0);
  }
  // The dugouts, on the south touchline
  for (const x of [-7, 7]) {
    b.box(0x1e3a8a, 5, 1.7, 0.12, x, 0, TRACK_Z - 0.35).box(0x1e3a8a, 5.2, 0.1, 1.3, x, 1.7, TRACK_Z - 0.9).box(0x78716c, 4.6, 0.45, 0.4, x, 0, TRACK_Z - 0.7);
  }

  // --- The stands -------------------------------------------------------------------------
  for (const run of tierRuns()) {
    const length = run.to - run.from;
    const sections = Math.max(1, Math.round(length / 9));
    for (let s = 0; s < sections; s++) {
      const piece = length / sections;
      const mid = run.from + (s + 0.5) * piece;
      // Blocks of green and white seats, turn and turn about, shifting a block each row up
      const hex = (s + Math.round(run.top / TIER_RISE)) % 2 === 0 ? GREEN : WHITE;
      if (run.along === 'x') b.box(hex, piece, run.top, TIER_DEPTH, mid, 0, run.fixed);
      else b.box(hex, TIER_DEPTH, run.top, piece, run.fixed, 0, mid);
    }
  }
  const standDepth = OUTER_X - STAND_X;
  const top = TIERS * TIER_RISE;
  b.occupy(-OUTER_X, OUTER_X, -OUTER_Z, -STAND_Z, top + 2.2).occupy(-OUTER_X, OUTER_X, STAND_Z, OUTER_Z, top + 2.2);
  b.occupy(-OUTER_X, -STAND_X, -STAND_Z, STAND_Z, top + 2.2);
  b.occupy(STAND_X, OUTER_X, -STAND_Z, GATE_FROM, top + 2.2).occupy(STAND_X, OUTER_X, GATE_TO, STAND_Z, top + 2.2);

  // The wall round the outside, with a green band along the top
  const wallH = top + 2.2;
  b.box(CONCRETE, OUTER_X * 2, wallH, 0.5, 0, 0, -(OUTER_Z - 0.25)).box(CONCRETE, OUTER_X * 2, wallH, 0.5, 0, 0, OUTER_Z - 0.25);
  b.box(CONCRETE, 0.5, wallH, OUTER_Z * 2, -(OUTER_X - 0.25), 0, 0);
  const northPiece = GATE_FROM + OUTER_Z;
  const southPiece = OUTER_Z - GATE_TO;
  b.box(CONCRETE, 0.5, wallH, northPiece, OUTER_X - 0.25, 0, -OUTER_Z + northPiece / 2);
  b.box(CONCRETE, 0.5, wallH, southPiece, OUTER_X - 0.25, 0, GATE_TO + southPiece / 2);
  b.box(GREEN, OUTER_X * 2 + 0.1, 0.7, 0.6, 0, wallH - 0.7, -(OUTER_Z - 0.25)).box(GREEN, OUTER_X * 2 + 0.1, 0.7, 0.6, 0, wallH - 0.7, OUTER_Z - 0.25);
  b.box(GREEN, 0.6, 0.7, OUTER_Z * 2 + 0.1, -(OUTER_X - 0.25), wallH - 0.7, 0).box(GREEN, 0.6, 0.7, OUTER_Z * 2 + 0.1, OUTER_X - 0.25, wallH - 0.7, 0);
  // Piers down the outside, so the wall is not one flat sheet
  for (let x = -OUTER_X + 1.5; x <= OUTER_X - 1.4; x += 6.5) {
    b.box(0xe2e8f0, 0.7, wallH + 0.4, 0.3, x, 0, -OUTER_Z - 0.1).box(0xe2e8f0, 0.7, wallH + 0.4, 0.3, x, 0, OUTER_Z + 0.1);
  }
  for (let z = -OUTER_Z + 1.5; z <= OUTER_Z - 1.4; z += 6.5) {
    b.box(0xe2e8f0, 0.3, wallH + 0.4, 0.7, -OUTER_X - 0.1, 0, z);
    if (z < GATE_FROM - 0.6 || z > GATE_TO + 0.6) b.box(0xe2e8f0, 0.3, wallH + 0.4, 0.7, OUTER_X + 0.1, 0, z);
  }

  // The tunnel through the east stand, and the gate
  b.box(CONCRETE, standDepth + 0.5, top, 0.3, STAND_X + standDepth / 2, 0, GATE_FROM + 0.15).box(CONCRETE, standDepth + 0.5, top, 0.3, STAND_X + standDepth / 2, 0, GATE_TO - 0.15);
  b.box(GREEN, 0.7, 1.7, GATE_TO - GATE_FROM, OUTER_X - 0.25, wallH - 1.7, GATE_Z);
  b.box(0xe2e8f0, 0.9, wallH + 1, 0.9, OUTER_X - 0.1, 0, GATE_FROM - 0.2).box(0xe2e8f0, 0.9, wallH + 1, 0.9, OUTER_X - 0.1, 0, GATE_TO + 0.2);
  for (const z of [GATE_FROM + 1.4, GATE_TO - 1.4]) b.box(0x475569, 0.25, 1.05, 0.25, OUTER_X + 0.6, 0, z, { solid: true });

  // Roofs over the two long stands, held up from behind
  for (const side of [-1, 1]) {
    const z = side * (STAND_Z + standDepth / 2 - 0.4);
    b.box(0xf8fafc, OUTER_X * 2 + 1, 0.3, standDepth + 2.6, 0, wallH + 2.3, z, { pitch: side * -0.13 });
    b.box(GREEN, OUTER_X * 2 + 1, 0.5, 0.3, 0, wallH + 2.75, side * (STAND_Z - 1.3));
    for (let x = -OUTER_X + 1.5; x <= OUTER_X - 1.4; x += 6.5) {
      b.box(0x94a3b8, 0.35, 3.4, 0.35, x, wallH - 0.4, side * (OUTER_Z - 0.6));
      b.box(0x94a3b8, 0.2, 0.2, 5.4, x, wallH + 1.3, side * (OUTER_Z - 3.1), { pitch: side * -0.42 });
    }
  }

  // Floodlights at the four corners
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * (OUTER_X + 1.2);
    const z = sz * (OUTER_Z + 1.2);
    b.cylinder(0x94a3b8, 0.38, 21, x, 0, z, { topRadius: 0.2, solid: true });
    b.box(0x475569, 3.6, 2.4, 0.4, x, 20.2, z, { yaw: Math.atan2(-x, -z) });
    b.box(0xfff7c2, 3.2, 2, 0.46, x, 20.4, z, { yaw: Math.atan2(-x, -z), glow: true });
  }

  // The scoreboard, over the west stand
  b.box(0x0f172a, 0.5, 3.8, 10, -(OUTER_X - 0.6), wallH + 0.2, 0);

  // --- Outside the gate -------------------------------------------------------------------
  b.ground(0xd6d3d1, 5, OUTER_Z * 2, OUTER_X + 2.5, 0.015, 0);
  const boothX = OUTER_X + 2.3;
  const boothZ = GATE_FROM - 3.4;
  b.box(GREEN, 2.4, 2.6, 2.4, boothX, 0, boothZ, { solid: true }).box(0xf8fafc, 2.9, 0.18, 2.9, boothX, 2.6, boothZ);
  b.box(0xfef9c3, 1.5, 0.8, 0.1, boothX, 1.2, boothZ + 1.2, { glow: true }).box(0x78716c, 1.7, 0.08, 0.4, boothX, 1.1, boothZ + 1.35);
  for (const z of [4, 10, 16]) {
    const x = OUTER_X + 4.3;
    b.cylinder(0xe5e7eb, 0.07, 9, x, 0, z, { solid: true });
    b.box(0x0b7a43, 0.6, 1, 0.04, x + 0.37, 7.9, z).box(0xffffff, 0.6, 1, 0.04, x + 0.97, 7.9, z).box(0x0b7a43, 0.6, 1, 0.04, x + 1.57, 7.9, z);
  }
  // A bench at the foot of the east stand, where a ticket-holder sits
  const benchX = STAND_X - 0.45;
  const benchZ = 4.5;
  b.box(0x92400e, 0.5, 0.45, 9, benchX, 0, benchZ);

  const group = b.build(options.id);
  group.position.set(site.x, 0, site.z);
  // The playing surface takes no light from the sun: it is as bright as the floodlights make it
  const turf = (field.build('pitch').children[0] as THREE.Mesh);
  const turfLook = new THREE.MeshBasicMaterial({ vertexColors: true });
  turf.material = turfLook;
  turf.castShadow = false;
  group.add(turf);

  const gateSign = signBoard([options.name.toUpperCase(), 'Gate A  ·  Tickets at the booth'], 9, 1.7, '#14532d');
  gateSign.position.set(OUTER_X + 0.12, wallH + 1.1, GATE_Z);
  gateSign.rotation.y = Math.PI / 2;
  const boothSign = signBoard(['TICKETS'], 2.2, 0.5, '#f8fafc', '#14532d');
  boothSign.position.set(boothX, 2.3, boothZ + 1.22);
  const steward = figure(0xfacc15, 0x1f2937, 0x5b3a1e, 0x15803d);
  steward.position.set(OUTER_X + 0.9, 0, GATE_TO + 0.9);
  steward.rotation.y = Math.PI / 2;
  group.add(gateSign, boothSign, steward);

  // --- The scoreboard ---------------------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 3.2), new THREE.MeshBasicMaterial({ map: texture }));
  board.position.set(-(OUTER_X - 0.9), wallH + 2.1, 0);
  board.rotation.y = Math.PI / 2;
  board.userData.surface = true;
  group.add(board);
  let shown = '';
  const show = (first: string, second: string, loud: boolean) => {
    if (`${first}|${second}` === shown) return;
    shown = `${first}|${second}`;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    let size = 64;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (ctx.measureText(first).width > canvas.width - 40 && size > 20) {
      size -= 4;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    ctx.fillText(first, canvas.width / 2, 88);
    ctx.fillStyle = loud ? '#facc15' : '#4ade80';
    ctx.font = '800 72px system-ui, sans-serif';
    ctx.fillText(second, canvas.width / 2, 186);
    texture.needsUpdate = true;
  };

  // --- The crowd --------------------------------------------------------------------------
  let seed = 4127;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const seats: Array<{ x: number; y: number; z: number; phase: number }> = [];
  for (const run of tierRuns()) {
    for (let s = run.from + 0.5; s < run.to - 0.3; s += 0.78) {
      if (random() < 0.3) continue;
      seats.push({ x: run.along === 'x' ? s : run.fixed, y: run.top + 0.31, z: run.along === 'x' ? run.fixed : s, phase: random() * 6.28 });
    }
  }
  const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.62, 0.32), new THREE.MeshStandardMaterial({ roughness: 0.9 }), seats.length);
  const shirts = [0x15803d, 0xf8fafc, 0xfacc15, 0xdc2626, 0x1d4ed8, 0x111827, 0xf97316, 0x15803d, 0xf8fafc];
  const matrix = new THREE.Matrix4();
  const tint = new THREE.Color();
  seats.forEach((seat, index) => {
    crowd.setMatrixAt(index, matrix.makeTranslation(seat.x, seat.y, seat.z));
    crowd.setColorAt(index, tint.setHex(shirts[Math.floor(random() * shirts.length)]));
  });
  crowd.userData.surface = true;
  crowd.frustumCulled = false;
  group.add(crowd);

  // --- The players and the ball -----------------------------------------------------------
  // One shape for every player: the shirt takes the team's colour, the shorts and head stay dark
  const body = new Builder().box(0x3f3f46, 0.4, 0.85, 0.26, 0, 0, 0).box(0xffffff, 0.48, 0.6, 0.3, 0, 0.85, 0).box(0x7a5230, 0.28, 0.28, 0.28, 0, 1.47, 0).build('player');
  const shape = (body.children[0] as THREE.Mesh).geometry;
  const players = new THREE.InstancedMesh(shape, new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true }), sim.players.length);
  sim.players.forEach((player, index) => {
    players.setColorAt(index, tint.setHex(player.keeper ? 0xfacc15 : player.team === 0 ? 0xf8fafc : 0xdc2626));
  });
  players.userData.surface = true;
  players.frustumCulled = false;
  players.castShadow = true;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
  ball.userData.surface = true;
  group.add(players, ball);

  // --- What can be done here --------------------------------------------------------------
  const gate = clickBox(6, 6, 12);
  gate.position.set(OUTER_X + 1.5, 3, GATE_Z - 2);
  group.add(gate);

  let open = true;
  /** The match the player has a ticket for */
  let ticketFor = 0;
  const hasTicket = () => ticketFor === sim.matchNumber && !sim.fullTime;

  const buyTicket = (host: LandmarkHost) => {
    host.director.perform({
      id: 'buy a match ticket',
      actor: host.actor,
      point: at(boothX, boothZ + 2.1),
      target: at(boothX, boothZ),
      speed: 4,
      animation: { arms: 'reach' },
      seconds: 1.1,
      effectAt: 0.6,
      effect: () => {
        if (hasTicket()) return;
        if (!host.backend.spendCash(TICKET_PRICE, `Match ticket, ${options.name}`)) {
          host.say(`A ticket is ₦${TICKET_PRICE.toLocaleString()}. You do not have that on you.`, 'warning');
          return false;
        }
        ticketFor = sim.matchNumber;
        host.say(`Ticket bought: ${sim.teams[0]} v ${sim.teams[1]}. Go in through Gate A.`, 'success');
      },
    });
  };

  const takeSeat = (host: LandmarkHost) => {
    const actor = host.actor;
    const facingPitch = -Math.PI / 2;
    const sitDown = new Sequence('take a seat at the stadium', [actor]).add(
      steps.walk(actor, at(OUTER_X + 1.5, GATE_Z), { speed: 4 }),
      steps.walk(actor, at(STAND_X - 1.4, GATE_Z), { speed: 4 }),
      steps.walk(actor, at(benchX - 0.1, benchZ), { speed: 4 }),
      steps.face(actor, facingPitch),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
      steps.wait(0.3)
    );
    sitDown.onEnd((reason) => {
      if (reason !== 'done') return;
      actor.yaw = facingPitch;
      actor.hold = {
        release: () => {
          actor.hold = null;
          actor.pose = { legs: 'stand', arms: 'rest' };
          actor.setScripted(false);
        },
      };
      actor.setScripted(true);
      actor.pose = { legs: 'sit', arms: 'rest' };
      // Seen from over the stand behind, looking down the pitch
      host.look(Math.PI / 2, 0.8, 17);
      host.say(`${sim.scoreLine()}, ${sim.minute} minutes played. Move to get up.`, 'info');
    });
    host.director.run(sitDown);
  };

  let time = 0;
  let bouncing = false;

  return {
    id: options.id,
    name: options.name,
    match: sim,
    zone: { minX: site.x - OUTER_X - 1.5, maxX: site.x + OUTER_X + 5, minZ: site.z - OUTER_Z - 1.5, maxZ: site.z + OUTER_Z + 1.5 },
    group,
    obstructions: b.obstructions(options.name, site.x, site.z),
    interactive: [
      {
        mesh: gate,
        id: options.id,
        name: options.name,
        category: 'Stadium',
        description: `Football through the day, ${OPENS}:00 to ${CLOSES}:00. A ticket is ₦${TICKET_PRICE.toLocaleString()} at the booth by Gate A and is good for the match being played.`,
        interactionPoint: at(OUTER_X + 2.4, GATE_Z),
      },
    ],
    actions: {
      [options.id]: {
        label: () => {
          if (!open) return `🔒 Closed. The gates open at ${OPENS}:00`;
          return hasTicket() ? '🏟️ Go in and take your seat' : `🎟️ Buy a ticket for the match (₦${TICKET_PRICE.toLocaleString()})`;
        },
        run: (host) => {
          if (!open) {
            host.say(`The stadium is closed. The gates open at ${OPENS}:00.`, 'info');
            return;
          }
          if (host.director.interrupt(host.actor) === 'locked') return;
          if (hasTicket()) takeSeat(host);
          else buyTicket(host);
        },
      },
    },
    doors: [{ name: `Gate A of ${options.name}`, x: site.x + OUTER_X + 2.4, z: site.z + GATE_Z }],
    update(delta, hour) {
      time += delta;
      open = hour >= OPENS && hour < CLOSES;
      // Daylight by day; under the lights in the evening; dark when the ground is shut
      const dark = hour < 6.5 || hour >= 18.5;
      turfLook.color.setScalar(!dark ? 0.9 : open ? 0.78 : 0.2);
      const lift = dark && open ? 0.06 : 0;
      (players.material as THREE.MeshStandardMaterial).emissive.setScalar(lift);
      (crowd.material as THREE.MeshStandardMaterial).emissive.setScalar(lift);
      crowd.visible = players.visible = ball.visible = open;
      if (!open) {
        show(options.name.toUpperCase(), `NEXT MATCH ${OPENS}:00`, false);
        return;
      }
      sim.update(delta);
      sim.players.forEach((player, index) => players.setMatrixAt(index, matrix.makeTranslation(player.x, 0, player.z)));
      players.instanceMatrix.needsUpdate = true;
      ball.position.set(sim.ball.x, 0.22 + sim.ball.height, sim.ball.z);

      // The crowd is on its feet for a goal
      if (sim.celebrating > 0) {
        bouncing = true;
        seats.forEach((seat, index) => crowd.setMatrixAt(index, matrix.makeTranslation(seat.x, seat.y + Math.abs(Math.sin(time * 8 + seat.phase)) * 0.32, seat.z)));
        crowd.instanceMatrix.needsUpdate = true;
      } else if (bouncing) {
        bouncing = false;
        seats.forEach((seat, index) => crowd.setMatrixAt(index, matrix.makeTranslation(seat.x, seat.y, seat.z)));
        crowd.instanceMatrix.needsUpdate = true;
      }
      const score = `${sim.teams[0].toUpperCase()}  ${sim.score[0]} - ${sim.score[1]}  ${sim.teams[1].toUpperCase()}`;
      show(score, sim.celebrating > 0 ? 'GOAL!' : sim.fullTime ? 'FULL TIME' : `${sim.minute}'`, sim.celebrating > 0);
    },
    status: () => ({
      open,
      teams: sim.teams,
      score: [...sim.score],
      minute: sim.minute,
      matchNumber: sim.matchNumber,
      hasTicket: hasTicket(),
      crowd: seats.length,
      ball: { x: sim.ball.x, z: sim.ball.z },
    }),
  };
}
