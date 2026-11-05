import * as THREE from 'three';
import type { FlightDetails, FlightCameraView, FlightPhase } from './TransitTypes';
import type { HumanRig } from '../graphics/HumanMeshBuilder';
import { FlightPlan, type Pose, type Stage } from './flight/FlightPlan';
import { Airliner } from './flight/Airliner';
import { Cabin } from './flight/Cabin';
import { FlightWorld, lightFor } from './flight/FlightWorld';
import { FlightSound } from './flight/FlightSound';

/**
 * A flight, from the stand at one airport to the runway at the next, seen from outside the
 * aircraft, from the aisle or from the passenger's own window seat. The doors close and the
 * jet bridge pulls away; the tug pushes back; the crew show the safety drill on the taxi; the
 * engines spool up for the take-off roll, the nose comes up and the gear folds away; the climb
 * goes through the cloud; in the cruise the trolley comes down the aisle; the descent goes back
 * down through the cloud, the gear and flaps come out, the flare, the touchdown, the reversers,
 * the clapping, and the taxi in. The captain and the crew announce each part.
 */

const PHASE: Record<Stage, FlightPhase> = {
  gate: 'boarding', pushback: 'boarding', taxi: 'boarding', takeoff: 'takeoff', climb: 'takeoff',
  cruise: 'cruise', descent: 'cruise', final: 'landing', rollout: 'landing', 'taxi-in': 'landing',
};

const STATUS: Record<Stage, string> = {
  gate: 'Doors closing at the gate', pushback: 'Pushing back', taxi: 'Taxiing to the runway', takeoff: 'Taking off',
  climb: 'Climbing', cruise: 'Cruising at 35,000 ft', descent: 'Descending', final: 'On final approach', rollout: 'Landed', 'taxi-in': 'Taxiing to the gate',
};

/** How long each route really takes, in minutes, for the clock on the screen */
const MINUTES: Record<string, number> = { abuja: 65, port_harcourt: 60, kano: 85, enugu: 55, calabar: 70, ibadan: 30, lagos: 65 };
const COASTAL = new Set(['lagos', 'port_harcourt', 'calabar']);

interface Line { stage: Stage; at: number; who: 'captain' | 'crew'; chime?: boolean; text: (f: FlightDetails, minutes: number) => string }

const city = (name: string) => name.replace(/\s*\(.*\)$/, '').replace(/ International Airport| Airport/, '');

const LINES: Line[] = [
  { stage: 'gate', at: 0.8, who: 'crew', chime: true, text: (f) => `Good day ladies and gentlemen, and welcome aboard ${f.airlineName} flight ${f.flightCode} to ${city(f.destinationName)}. Please put your hand luggage in the overhead bins and take your seat.` },
  { stage: 'gate', at: 6.2, who: 'crew', text: () => 'Cabin crew, doors to automatic and cross-check.' },
  { stage: 'pushback', at: 0.6, who: 'captain', chime: true, text: (f, m) => `Good day from the flight deck, this is Captain Lawal. Our flight time to ${city(f.destinationName)} is ${m} minutes. We are pushing back now.` },
  { stage: 'pushback', at: 5.2, who: 'crew', text: () => 'Please give us your attention for the safety demonstration. Fasten your seatbelt by putting the metal tip into the buckle, and pull the strap tight.' },
  { stage: 'taxi', at: 2.0, who: 'crew', text: () => 'If the cabin loses pressure, oxygen masks will drop from the panel above you. Pull the mask down, put it over your nose and mouth, and breathe normally.' },
  { stage: 'taxi', at: 6.5, who: 'crew', text: () => 'Your life jacket is under your seat. There are eight exits: two at the front, four over the wings, and two at the back.' },
  { stage: 'taxi', at: 11.2, who: 'captain', chime: true, text: () => 'Cabin crew, please be seated for take-off.' },
  { stage: 'cruise', at: 1.0, who: 'captain', chime: true, text: () => 'Ladies and gentlemen, we have reached our cruising altitude of thirty-five thousand feet. The seatbelt sign is off. Sit back and enjoy the flight.' },
  { stage: 'cruise', at: 5.5, who: 'crew', text: () => 'We are coming through the cabin with chilled zobo, juice, water and a hot meat pie. Please lower your tray table.' },
  { stage: 'descent', at: 0.5, who: 'captain', chime: true, text: (f) => `Cabin crew, prepare for landing. Ladies and gentlemen, we have started our descent into ${city(f.destinationName)}. The weather there is sunny, thirty-one degrees.` },
  { stage: 'descent', at: 8.0, who: 'crew', text: () => 'Please return to your seats, fasten your seatbelts, put your seat back upright and stow your tray table.' },
  { stage: 'final', at: 0.5, who: 'captain', chime: true, text: () => 'Cabin crew, seats for landing.' },
  { stage: 'rollout', at: 2.2, who: 'crew', chime: true, text: (f) => `Welcome to ${city(f.destinationName)}. Please stay seated with your seatbelt fastened until the aircraft has stopped at the gate. Thank you for flying ${f.airlineName}.` },
];

export class FlightExperience {
  /** The flight has its own world, drawn instead of the city while it lasts */
  public readonly scene: THREE.Scene;
  public readonly group = new THREE.Group();
  public isActive = false;
  public currentCameraView: FlightCameraView = 'seat';
  public currentPhase: FlightPhase = 'boarding';
  public flightCamera: THREE.PerspectiveCamera;
  public currentFlight: FlightDetails | null = null;
  /** The player as they look, to sit in their seat */
  public passengerLook: (() => HumanRig) | null = null;
  /** The game's clock, for a day, dusk or night flight */
  public hour: () => number = () => 13;

  public onFlightPhaseChanged?: (phase: FlightPhase, timeRemainingSec: number, announcement: string) => void;
  public onAnnouncement?: (announcement: string) => void;
  public onFlightCompleted?: (flight: FlightDetails) => void;
  /** The stage, how far through, the trolley serving the player */
  public onLive?: (status: string, fraction: number) => void;
  public onServed?: () => void;

  private plan = new FlightPlan(120);
  private world: FlightWorld | null = null;
  private worldFor = 0;
  private airliner: Airliner | null = null;
  private cabin: Cabin | null = null;
  private readonly sound = new FlightSound();
  private readonly pose: Pose = FlightPlan.blank();
  private elapsed = 0;
  private stage: Stage = 'gate';
  private said = new Set<number>();
  private minutes = 60;
  private lastGear = 1;
  private shake = 0;
  private time = 0;
  // The camera
  private look = { yaw: 0, pitch: 0 };
  private orbit: { yaw: number; pitch: number; distance: number } | null = null;
  private shot = '';
  private readonly camPos = new THREE.Vector3();
  private readonly camAim = new THREE.Vector3();
  private dragging: { x: number; y: number } | null = null;
  private liveTimer = 0;
  private lastLine = '';

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.add(this.group);
    this.group.visible = false;
    this.flightCamera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 30000);
    window.addEventListener('pointerdown', (e) => {
      if (!this.isActive || !(e.target instanceof HTMLCanvasElement)) return;
      this.dragging = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.dragging || !this.isActive) return;
      const dx = (e.clientX - this.dragging.x) / window.innerWidth;
      const dy = (e.clientY - this.dragging.y) / window.innerHeight;
      this.dragging = { x: e.clientX, y: e.clientY };
      this.drag(dx, dy);
    });
    window.addEventListener('pointerup', () => { this.dragging = null; });
    window.addEventListener('pointercancel', () => { this.dragging = null; });
  }

  // --- Start and end ----------------------------------------------------------------------

  public startFlight(flight: FlightDetails): void {
    this.currentFlight = flight;
    const total = Math.max(120, flight.durationSeconds || 0);
    this.plan = new FlightPlan(total);
    const routeLength = this.plan.touchdownZ + 3000;
    if (!this.world || this.worldFor !== total) {
      if (this.world) this.group.remove(this.world.root);
      this.world = new FlightWorld(routeLength, this.plan.arrivalThreshold, this.scene);
      this.worldFor = total;
      this.group.add(this.world.root);
    }
    if (!this.airliner) {
      this.airliner = new Airliner();
      this.group.add(this.airliner.root);
    }
    if (this.cabin) this.airliner.body.remove(this.cabin.group);
    const seat = /seat\s+(\S+)/i.exec(flight.travelClass)?.[1];
    this.cabin = new Cabin(seat, this.passengerLook);
    this.cabin.onServed = () => this.onServed?.();
    this.airliner.body.add(this.cabin.group);

    this.world.setLight(lightFor(this.hour()));
    this.world.placeAirports(flight.originName, COASTAL.has(flight.originId), this.plan.arrivalThreshold, flight.destinationName, COASTAL.has(flight.destinationId));
    this.minutes = MINUTES[flight.destinationId === 'lagos' ? flight.originId : flight.destinationId] ?? 60;
    this.elapsed = 0;
    this.stage = 'gate';
    this.said.clear();
    this.lastLine = '';
    this.lastGear = 1;
    this.shake = 0;
    this.orbit = null;
    this.shot = '';
    this.look = { yaw: 0, pitch: 0 };
    this.isActive = true;
    this.group.visible = true;
    this.sound.start();
    this.step(0);
    this.setCameraView('seat');
    this.onFlightPhaseChanged?.('boarding', 16, LINES[0].text(flight, this.minutes));
  }

  public skipFlight(): void {
    this.completeFlight();
  }

  private completeFlight(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.group.visible = false;
    this.sound.stop();
    if (this.currentFlight) this.onFlightCompleted?.(this.currentFlight);
  }

  /** How far through the flight it is, for anything that follows it */
  public progress(): { phase: FlightPhase; elapsed: number; total: number; stage: Stage } {
    return { phase: this.currentPhase, elapsed: this.elapsed, total: this.plan.total, stage: this.stage };
  }

  public setCameraView(view: FlightCameraView): void {
    this.currentCameraView = view;
    this.look = { yaw: 0, pitch: 0 };
    this.shot = '';
    const inside = view !== 'outside';
    this.airliner?.setInside(inside);
    if (this.cabin) {
      this.cabin.group.visible = inside;
      this.cabin.setPlayerVisible(view === 'cabin');
    }
    this.flightCamera.near = inside ? 0.08 : 0.5;
    this.flightCamera.fov = view === 'seat' ? 64 : 58;
    this.flightCamera.updateProjectionMatrix();
  }

  public handleResize(): void {
    this.flightCamera.aspect = window.innerWidth / window.innerHeight;
    this.flightCamera.updateProjectionMatrix();
  }

  private drag(dx: number, dy: number): void {
    if (this.currentCameraView === 'outside') {
      if (!this.orbit) this.orbit = { yaw: 2.6, pitch: 0.2, distance: 70 };
      this.orbit.yaw -= dx * 4;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + dy * 2, -0.35, 1.2);
      return;
    }
    const wide = this.currentCameraView === 'seat' ? 1.8 : 1.4;
    this.look.yaw = THREE.MathUtils.clamp(this.look.yaw - dx * 3, -wide, wide);
    this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - dy * 2, -0.8, 0.7);
  }

  // --- Every frame ------------------------------------------------------------------------

  public update(delta: number): void {
    if (!this.isActive || !this.currentFlight) return;
    this.time += delta;
    this.elapsed += delta;
    if (this.elapsed >= this.plan.total) {
      this.completeFlight();
      return;
    }
    this.step(delta);
  }

  private step(delta: number): void {
    const flight = this.currentFlight!;
    const pose = this.plan.at(this.elapsed, this.pose);
    if (pose.stage !== this.stage) {
      const was = this.stage;
      this.stage = pose.stage;
      if (pose.stage === 'rollout') {
        this.sound.thump(0.8);
        this.shake = 1;
        setTimeout(() => this.isActive && this.sound.clap(4), 1400);
      }
      if (PHASE[pose.stage] !== PHASE[was]) this.currentPhase = PHASE[pose.stage];
      this.onFlightPhaseChanged?.(PHASE[pose.stage], this.plan.total - this.elapsed, this.lastLine || STATUS[pose.stage]);
    }
    // Announcements, each once, in order
    LINES.forEach((line, i) => {
      if (this.said.has(i) || line.stage !== pose.stage || pose.inStage < line.at) return;
      this.said.add(i);
      const text = line.text(flight, this.minutes);
      if (line.chime) this.sound.chime();
      setTimeout(() => this.sound.say(text, line.who), line.chime ? 1300 : 0);
      this.lastLine = `${line.who === 'captain' ? 'Captain Lawal' : 'Cabin crew'}: ${text}`;
      this.onAnnouncement?.(this.lastLine);
    });
    // The gear clunking up and down
    if ((this.lastGear > 0.5) !== (pose.gear > 0.5)) this.sound.thump(0.25);
    this.lastGear = pose.gear;

    const plane = this.airliner!;
    plane.setPose(pose.position, pose.yaw, pose.pitch, pose.roll);
    const night = lightFor(this.hour()) === 'night';
    plane.update(delta, { gear: pose.gear, flaps: pose.flaps, spoilers: pose.spoilers, thrust: pose.thrust, reverse: pose.reverse, engines: pose.engines, night });
    const atDeparture = pose.stage === 'gate' || pose.stage === 'pushback';
    const forward = new THREE.Vector3(Math.sin(pose.yaw), 0, Math.cos(pose.yaw));
    this.world!.setGround(atDeparture ? pose.bridge : 0, atDeparture && pose.tug, pose.position.clone().addScaledVector(forward, 21.5), pose.yaw + Math.PI);
    this.sound.engines(pose.engines, pose.thrust, pose.reverse, this.currentCameraView !== 'outside');

    const fraction = THREE.MathUtils.clamp((this.elapsed - this.plan.starts.takeoff) / (this.plan.starts.rollout - this.plan.starts.takeoff), 0, 1);
    this.cabin!.update(delta, this.time, pose, {
      from: city(flight.originName), to: city(flight.destinationName), fromCode: flight.originCode, toCode: flight.destinationCode,
      fraction, minutesLeft: Math.max(0, Math.round((1 - fraction) * this.minutes)),
      feet: Math.round((pose.position.y / 1700) * 35000 / 100) * 100, kmh: Math.round(pose.speed * 3.6 * (pose.position.y > 50 ? 4.6 : 1)),
    });
    this.liveTimer -= delta;
    if (this.liveTimer <= 0) {
      this.liveTimer = 0.5;
      const left = Math.max(1, Math.round((1 - fraction) * this.minutes));
      this.onLive?.(`${STATUS[pose.stage]}${fraction > 0 && fraction < 1 ? ` · ${left} min to ${city(flight.destinationName)}` : ''}`, (this.elapsed / this.plan.total));
    }

    this.placeCamera(delta, pose);
    this.world!.update(delta, this.flightCamera);
  }

  // --- The camera -------------------------------------------------------------------------

  private placeCamera(delta: number, pose: Pose): void {
    const cam = this.flightCamera;
    const plane = this.airliner!;
    // A rumble on the take-off roll and the landing, a bump at the touchdown, the odd jolt in cloud
    this.shake = Math.max(0, this.shake - delta * 1.6);
    const ground = pose.position.y < 1 && pose.speed > 20 ? (pose.speed / 90) * 0.006 : 0;
    const air = pose.position.y > 400 && pose.position.y < 1100 ? 0.004 : 0;
    const jolt = this.shake * 0.05 + ground + air;
    const jitter = new THREE.Vector3((Math.random() - 0.5) * jolt, (Math.random() - 0.5) * jolt, 0);

    if (this.currentCameraView !== 'outside') {
      const eye = this.currentCameraView === 'seat' ? this.cabin!.seatEye : this.cabin!.aisleEye;
      plane.body.updateWorldMatrix(true, false);
      cam.position.copy(plane.body.localToWorld(eye.clone().add(jitter)));
      const base = this.currentCameraView === 'seat' ? { yaw: this.cabin!.windowSide * 1.42, pitch: -0.14 } : { yaw: 0, pitch: -0.16 };
      const local = new THREE.Quaternion().setFromEuler(new THREE.Euler(base.pitch + this.look.pitch, base.yaw + this.look.yaw + Math.PI, 0, 'YXZ'));
      const bodyQ = plane.body.getWorldQuaternion(new THREE.Quaternion());
      cam.quaternion.copy(bodyQ).multiply(local);
      return;
    }

    // Outside: the shot for each part of the flight, or the player's own orbit once they have dragged
    const at = pose.position.clone().setY(pose.position.y + 3.6);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw);
    const rel = (x: number, y: number, z: number) => at.clone().add(new THREE.Vector3(x, y, z).applyQuaternion(yawQ));
    let want: THREE.Vector3;
    let aim = at.clone();
    let fixed = false;
    let name = pose.stage as string;
    if (this.orbit) {
      name = 'orbit';
      const o = this.orbit;
      want = at.clone().add(new THREE.Vector3(Math.sin(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.cos(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.distance));
    } else switch (pose.stage) {
      case 'gate': want = rel(34, 9, 30); aim = rel(0, 0, 4); break;
      case 'pushback': want = rel(-30, 14, 46); break;
      case 'taxi': want = rel(-16, 9, -46); break;
      case 'takeoff':
        if (pose.inStage < 5.5) { name = 'runway side'; fixed = true; want = new THREE.Vector3(70, 6, 330); }
        else want = rel(-22, 6, -55);
        break;
      case 'climb': want = rel(34, -8, -62); break;
      case 'cruise': {
        const a = 2.4 + pose.inStage * 0.09;
        want = at.clone().add(new THREE.Vector3(Math.sin(a) * 78, 14 + Math.sin(pose.inStage * 0.2) * 8, Math.cos(a) * 78));
        break;
      }
      case 'descent': want = rel(-42, 10, 66); break;
      case 'final':
        name = 'touchdown zone'; fixed = true;
        want = new THREE.Vector3(-75, 5, this.plan.arrivalThreshold + 470);
        break;
      default: want = rel(-26, 8, -48);
    }
    const cut = name !== this.shot;
    this.shot = name;
    if (cut || fixed) this.camPos.copy(want);
    else this.camPos.lerp(want, 1 - Math.exp(-delta * 3.5));
    if (cut) this.camAim.copy(aim);
    else this.camAim.lerp(aim, 1 - Math.exp(-delta * 8));
    cam.position.copy(this.camPos).add(jitter);
    cam.position.y = Math.max(cam.position.y, 1.5);
    cam.lookAt(this.camAim);
  }
}
