import * as THREE from 'three';
import { HumanMeshBuilder, type HumanConfig, type HumanRig } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import { Builder, signBoard } from '../../world/kit/ArchKit';
import { Actor } from '../../interactions/Actor';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { neutralJoints, poseTargets, writeJoints, type PoseState, type ArmPose } from '../../interactions/Poses';
import { Sequence, steps, type Step } from '../../interactions/Sequence';
import { SoundEngine } from '../../audio/SoundEngine';
import { NaijaBeats, type Song } from '../../audio/NaijaBeats';
import { MALE } from '../../audio/StreetAmbience';
import type { PlaceHost } from '../../destinations/PlaceActions';
import type { PlaceInterior } from './PlaceInterior';

/**
 * Churches and the mosque, alive. A service goes round all the time the doors are open, so
 * whoever walks in finds it under way.
 *
 * Faith Arena: praise and worship with the drums, the keyboard and the choir, the whole church
 * on its feet clapping and with hands raised; the pastor preaching up and down the stage with
 * the church answering him; then offering time, with people dancing their offering to the
 * baskets at the front. Redemption Cathedral: hymns with the organ, the sermon from the
 * pulpit, the church on its knees for prayer, the ushers bringing the offering bags down the
 * aisle. The Central Mosque: the call to prayer, the rows standing shoulder to shoulder behind
 * the imam through two rak'ahs (standing, bowing, prostrating, sitting, the salam), the du'a,
 * then the imam's lesson.
 *
 * The congregation is drawn as instances of a few figures baked in each pose; each person
 * moves into the next pose a moment after their neighbour, as people do. Those who walk (the
 * pastor, the ushers, the imam, those dancing to the front) are full figures. The player joins
 * in and does what the room is doing, in their pew or in the row.
 */

const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const POS = new THREE.Vector3();
const QUAT = new THREE.Quaternion();
const EUL = new THREE.Euler(0, 0, 0, 'YXZ');
const ONE = new THREE.Vector3(1, 1, 1);
const MAT = new THREE.Matrix4();
const HERE = new THREE.Vector3();

// --- People who say things --------------------------------------------------------------------

/** Lines said by people in the crowd, over their heads for a moment */
class Bubbles {
  private readonly live: Array<{ sprite: THREE.Sprite; left: number }> = [];
  private readonly group: THREE.Group;
  constructor(group: THREE.Group) {
    this.group = group;
  }

  public add(text: string, x: number, y: number, z: number, seconds = 2.2): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.font = '700 38px Inter, system-ui, sans-serif';
    const width = Math.min(372, Math.ceil(ctx.measureText(text).width) + 44);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect((384 - width) / 2, 12, width, 68, 30);
    ctx.fill();
    ctx.fillStyle = '#1c1917';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 192, 47, 352);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, fog: false, toneMapped: false }));
    sprite.scale.set(2.1, 0.52, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = 20;
    sprite.name = `said ${text}`;
    this.group.add(sprite);
    this.live.push({ sprite, left: seconds });
  }

  public tick(delta: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.left -= delta;
      b.sprite.position.y += delta * 0.12;
      if (b.left > 0) continue;
      this.group.remove(b.sprite);
      b.sprite.material.map?.dispose();
      b.sprite.material.dispose();
      this.live.splice(i, 1);
    }
  }

  public get said(): string[] {
    return this.live.map((b) => b.sprite.name.slice(5));
  }
}

let voices: SpeechSynthesisVoice[] | null = null;
/** The pastor's words out loud, in a man's voice, if the browser has one */
function speak(text: string): void {
  const speech = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!speech || SoundEngine.getInstance().isMuted || speech.speaking) return;
  if (!voices || !voices.length) voices = speech.getVoices().filter((v) => /^en/i.test(v.lang));
  const voice = voices.find((v) => /NG/i.test(v.lang) && MALE.test(v.name)) ?? voices.find((v) => MALE.test(v.name) && /GB|NG|ZA/i.test(v.lang)) ?? voices.find((v) => MALE.test(v.name)) ?? null;
  const line = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s,.!?'’:;-]/gu, ''));
  if (voice) line.voice = voice;
  line.lang = voice?.lang ?? 'en-GB';
  line.rate = 1.02;
  line.pitch = voice ? 0.85 : 0.6;
  line.volume = 0.8;
  speech.speak(line);
}

// --- The congregation, drawn as instances ---------------------------------------------------

interface Seat {
  x: number;
  z: number;
  yaw: number;
  /** Standing on a stage */
  y?: number;
  look: number;
}

interface PoseSet {
  pose: PoseState;
  /** The moment of the pose's own movement it is baked at (a clap open or shut) */
  time?: number;
  /** The head turned (the salam) */
  headY?: number;
  /** How far forward of the seat they are: standing in front of a pew, kneeling at it */
  forward?: number;
  /** Which seats are in this set (some clap, some raise their hands) */
  who?: (seat: number) => boolean;
}

class Crowd {
  public readonly group = new THREE.Group();
  private built = false;
  private readonly meshes = new Map<string, Array<{ mesh: THREE.InstancedMesh; shown: number }>>();
  private readonly where = new Map<string, Map<number, { m: number; k: number }>>();
  private readonly current: string[] = [];
  private readonly target: string[] = [];
  private readonly due: number[] = [];
  /** Each person's own small difference in timing, 0 to 1 */
  private readonly jitter: number[] = [];
  private clock = 0;
  private readonly looks: HumanConfig[];
  public readonly seats: Seat[];
  private readonly sets: Record<string, PoseSet>;

  constructor(name: string, looks: HumanConfig[], seats: Seat[], sets: Record<string, PoseSet>) {
    this.looks = looks;
    this.seats = seats;
    this.sets = sets;
    this.group.name = name;
    seats.forEach((_, i) => {
      this.current.push('');
      this.target.push('');
      this.due.push(0);
      this.jitter.push(((i * 7919) % 101) / 101);
    });
  }

  /** Bakes each look in each pose. Done when the room is first seen, not at the start of the game. */
  public build(): void {
    if (this.built) return;
    this.built = true;
    const joints = neutralJoints();
    this.looks.forEach((look, l) => {
      const rig = HumanMeshBuilder.createHuman({ lod: 'street', ...look, username: '' });
      rig.nameTag.visible = false;
      if (rig.phoneMesh) rig.phoneMesh.visible = false;
      const holder = new THREE.Group();
      holder.add(rig.group);
      const torsoY = rig.torso.position.y;
      for (const [name, set] of Object.entries(this.sets)) {
        const mine = this.seats.map((_, i) => i).filter((i) => this.seats[i].look === l && (set.who?.(i) ?? true));
        if (!mine.length) continue;
        poseTargets(set.pose, set.time ?? 0.3, joints);
        joints.headY += set.headY ?? 0;
        writeJoints(rig, joints, torsoY);
        const geo = bakeToGeometry(holder);
        if (!geo) continue;
        const mesh = new THREE.InstancedMesh(geo, PEOPLE, mine.length);
        mesh.name = `${this.group.name}: ${name}`;
        mesh.frustumCulled = false;
        mesh.visible = false;
        for (let k = 0; k < mine.length; k++) mesh.setMatrixAt(k, HIDDEN);
        this.group.add(mesh);
        const list = this.meshes.get(name) ?? [];
        list.push({ mesh, shown: 0 });
        this.meshes.set(name, list);
        const map = this.where.get(name) ?? new Map<number, { m: number; k: number }>();
        mine.forEach((i, k) => map.set(i, { m: list.length - 1, k }));
        this.where.set(name, map);
      }
    });
  }

  /** Everyone goes over to the first of these sets they are in, each a moment after the next */
  public go(names: string[], spread = 0.35): void {
    for (let i = 0; i < this.seats.length; i++) {
      const name = names.find((n) => this.where.get(n)?.has(i));
      if (!name || this.target[i] === name) continue;
      this.target[i] = name;
      this.due[i] = this.clock + this.jitter[i] * spread;
    }
  }

  /** Moves people into their new poses as their moment comes; those in `moving` sway and bob */
  public tick(delta: number, moving: string[] = [], sway = 0, bob = 0): void {
    this.clock += delta;
    for (let i = 0; i < this.seats.length; i++) {
      if (this.target[i] === this.current[i] || this.clock < this.due[i]) continue;
      this.put(i, this.current[i], false);
      this.put(i, this.target[i], true);
      this.current[i] = this.target[i];
    }
    if (!moving.length || (sway === 0 && bob === 0)) return;
    for (const name of moving) {
      const map = this.where.get(name);
      const list = this.meshes.get(name);
      if (!map || !list) continue;
      for (const [i, at] of map) {
        if (this.current[i] !== name) continue;
        list[at.m].mesh.setMatrixAt(at.k, this.place(i, this.sets[name], sway, bob));
      }
      for (const entry of list) entry.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private put(i: number, name: string, show: boolean): void {
    if (!name) return;
    const at = this.where.get(name)?.get(i);
    const entry = at ? this.meshes.get(name)?.[at.m] : undefined;
    if (!at || !entry) return;
    entry.mesh.setMatrixAt(at.k, show ? this.place(i, this.sets[name], 0, 0) : HIDDEN);
    entry.mesh.instanceMatrix.needsUpdate = true;
    entry.shown += show ? 1 : -1;
    entry.mesh.visible = entry.shown > 0;
  }

  private place(i: number, set: PoseSet, sway: number, bob: number): THREE.Matrix4 {
    const s = this.seats[i];
    const f = set.forward ?? 0;
    const phase = this.jitter[i] * Math.PI * 2;
    const twist = sway * Math.sin(this.clock * 2.6 + phase);
    const lift = bob * Math.abs(Math.sin(this.clock * 3.3 + phase));
    POS.set(s.x + Math.sin(s.yaw) * f, (s.y ?? 0) + lift, s.z + Math.cos(s.yaw) * f);
    EUL.set(0, s.yaw + twist, twist * 0.3);
    QUAT.setFromEuler(EUL);
    return MAT.compose(POS, QUAT, ONE);
  }

  /** How many people are shown in each pose (for the tests) */
  public counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const name of this.current) if (name) out[name] = (out[name] ?? 0) + 1;
    return out;
  }

  /** Over someone's head, for a word from them */
  public head(i: number): THREE.Vector3 {
    const s = this.seats[i];
    const sitting = /sit|kneel|sujud|salam|dua/.test(this.current[i]);
    return new THREE.Vector3(s.x, (s.y ?? 0) + (sitting ? 1.75 : 2.25), s.z);
  }
}

// --- Those who walk about -------------------------------------------------------------------

/** Someone in a place who walks about and is posed by the scene they are in (the pastor, a waiter) */
export class Figure {
  public readonly root = new THREE.Group();
  public readonly rig: HumanRig;
  public readonly actor: Actor;
  /** Busy with something of its own (praying over the player): the service leaves it alone */
  public busy = false;
  private route: THREE.Vector3[] = [];
  private then: (() => void) | null = null;
  private speed = 1.3;
  private arms: ArmPose = 'swing';
  private dancing = false;
  private holdLeft = 0;
  private holdThen: (() => void) | null = null;

  constructor(parent: THREE.Group, id: string, name: string, look: HumanConfig, at: [number, number], facing: number, y = 0) {
    this.rig = HumanMeshBuilder.createHuman({ lod: 'street', ...look, username: '' });
    this.rig.nameTag.visible = false;
    if (this.rig.phoneMesh) this.rig.phoneMesh.visible = false;
    this.root.name = `worship ${name}`;
    this.root.add(this.rig.group);
    this.root.position.set(at[0], y, at[1]);
    this.root.rotation.y = facing;
    parent.add(this.root);
    this.actor = InteractionDirector.get().register(new Actor({ id: `worship:${id}`, name, root: this.root, getRig: () => this.rig }));
    this.actor.setScripted(true);
  }

  public get walking(): boolean {
    return this.route.length > 0;
  }

  public pose(legs: PoseState['legs'], arms: ArmPose = 'rest'): void {
    if (this.walking) return;
    if (!this.actor.scripted) this.actor.setScripted(true);
    this.actor.pose = { legs, arms };
  }

  public place(x: number, z: number, yaw?: number): void {
    this.route = [];
    this.root.position.x = x;
    this.root.position.z = z;
    if (yaw !== undefined) this.root.rotation.y = yaw;
  }

  public face(yaw: number): void {
    this.root.rotation.y = yaw;
  }

  /** Walks through these points of the room, then does `then` */
  public walk(points: Array<[number, number]>, then?: () => void, opts: { speed?: number; arms?: ArmPose; dance?: boolean } = {}): void {
    this.route = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.then = then ?? null;
    this.speed = opts.speed ?? 1.3;
    this.arms = opts.arms ?? 'swing';
    this.dancing = !!opts.dance;
  }

  public say(text: string, seconds = 3): void {
    this.actor.say(text, seconds);
  }

  /** Stays as they are for a while on the game's clock, then does `then` */
  public hold(seconds: number, then: () => void): void {
    this.holdLeft = seconds;
    this.holdThen = then;
  }

  public where(): [number, number] {
    return [this.root.position.x, this.root.position.z];
  }

  public tick(delta: number): void {
    if (this.holdThen) {
      this.holdLeft -= delta;
      if (this.holdLeft <= 0) {
        const then = this.holdThen;
        this.holdThen = null;
        then();
      }
    }
    if (!this.route.length) return;
    if (!this.actor.scripted) this.actor.setScripted(true);
    const next = this.route[0];
    const p = this.root.position;
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.04) {
      this.route.shift();
      if (!this.route.length) {
        this.actor.pose = { legs: 'stand', arms: 'rest' };
        const then = this.then;
        this.then = null;
        then?.();
      }
      return;
    }
    const step = Math.min(d, this.speed * delta);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    this.actor.turnToward(Math.atan2(dx, dz), delta, 8);
    this.actor.pose = { legs: this.dancing ? 'dance' : 'walk', arms: this.arms };
  }
}

// --- Music ------------------------------------------------------------------------------------

/** Praise music: drums, shaker, bass and keyboard in the highlife way, written for the game */
const PRAISE: Song = { id: 'faith-arena-praise', title: 'Onise Iyanu', artist: 'Faith Arena Choir', style: 'highlife', bpm: 108, root: 60, minor: false, chords: [0, 3, 4, 0, 5, 3, 4, 4], seed: 7 };
/** A hymn's chords on the organ: I IV I V vi IV V I, in F */
const HYMN = [[0, 4, 7], [5, 9, 12], [0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

class Music {
  private beats: NaijaBeats | null = null;
  private organ: { next: number; chord: number; out: GainNode } | null = null;
  private last = 0;
  private watch: number | null = null;
  public playing = false;
  private readonly kind: 'praise' | 'organ';

  constructor(kind: 'praise' | 'organ') {
    this.kind = kind;
  }

  public on(): void {
    if (this.playing) return;
    const audio = SoundEngine.getInstance().audio(false);
    if (!audio) return;
    this.playing = true;
    this.last = performance.now();
    if (this.kind === 'praise') {
      this.beats ??= new NaijaBeats(audio.ctx, audio.master);
      this.beats.play(PRAISE);
    } else {
      const out = audio.ctx.createGain();
      out.gain.value = 0.5;
      const tone = audio.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2400;
      out.connect(tone).connect(audio.master);
      this.organ = { next: audio.ctx.currentTime + 0.1, chord: 0, out };
    }
    // The room stops being drawn when the player leaves it: the music stops with it
    this.watch = window.setInterval(() => { if (performance.now() - this.last > 700) this.off(); }, 300);
  }

  public off(): void {
    if (!this.playing) return;
    this.playing = false;
    this.beats?.stop();
    if (this.organ) {
      const ctx = this.organ.out.context;
      this.organ.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      this.organ = null;
    }
    if (this.watch !== null) window.clearInterval(this.watch);
    this.watch = null;
  }

  public tick(): void {
    this.last = performance.now();
    const organ = this.organ;
    if (!organ) return;
    const ctx = organ.out.context;
    while (organ.next < ctx.currentTime + 0.6) {
      const at = organ.next;
      for (const n of HYMN[organ.chord % HYMN.length]) {
        for (const [type, octave, level] of [['sine', 0, 0.05], ['triangle', 12, 0.025], ['sine', -12, 0.03]] as const) {
          const osc = ctx.createOscillator();
          osc.type = type;
          osc.frequency.value = hz(53 + n + octave);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(level, at + 0.25);
          g.gain.setValueAtTime(level, at + 2.1);
          g.gain.linearRampToValueAtTime(0, at + 2.7);
          osc.connect(g).connect(organ.out);
          osc.start(at);
          osc.stop(at + 2.8);
        }
      }
      organ.chord += 1;
      organ.next += 2.4;
    }
  }
}

// --- Shared bits -------------------------------------------------------------------------------

/** A step that keeps the player doing what the room is doing, where it says, until it says stop */
function keepTime(
  actor: Actor,
  room: PlaceInterior,
  yaw: number,
  now: () => { pose: PoseState; at: [number, number] } | null,
  maxSeconds: number,
  moments: Array<{ at: number; run: () => void }> = []
): Step {
  let elapsed = 0;
  let fired: boolean[] = [];
  return {
    name: 'keep time with the room',
    begin() {
      elapsed = 0;
      fired = moments.map(() => false);
    },
    tick(delta) {
      elapsed += delta;
      moments.forEach((m, i) => {
        if (!fired[i] && elapsed >= m.at) {
          fired[i] = true;
          m.run();
        }
      });
      const want = now();
      if (!want || elapsed >= maxSeconds) return true;
      actor.pose = { ...want.pose };
      const to = room.at(want.at[0], want.at[1]);
      const here = actor.worldPosition(HERE);
      const dx = to.x - here.x;
      const dz = to.z - here.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const s = Math.min(d, 1.6 * delta);
        actor.setWorldPosition(here.x + (dx / d) * s, here.z + (dz / d) * s);
      }
      actor.turnToward(yaw, delta);
      return false;
    },
  };
}

/** How far in front of their seat people stand in a pew, clear of its edge */
const STAND = 0.62;
const naira = (n: number) => `₦${n.toLocaleString()}`;
const clockOf = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Notes in a basket: each offering given puts one in, up to a pile */
function addNote(basket: THREE.Group, n: number): void {
  if (n > 14) return;
  const note = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.08), new THREE.MeshStandardMaterial({ color: [0x16a34a, 0xdb2777, 0x7c3aed, 0x0ea5e9][n % 4], roughness: 0.8 }));
  note.name = 'offering note';
  note.position.set(((n * 37) % 9) / 9 * 0.3 - 0.15, 0.06 + n * 0.012, ((n * 53) % 7) / 7 * 0.3 - 0.15);
  note.rotation.y = n * 1.3;
  basket.add(note);
}

function basketOn(b: Builder, group: THREE.Group, x: number, z: number): THREE.Group {
  b.cylinder(0x44403c, 0.05, 0.62, x, 0, z, { sides: 8 }).cylinder(0x44403c, 0.22, 0.04, x, 0, z, { sides: 12 });
  const basket = new THREE.Group();
  basket.name = 'offering basket';
  basket.position.set(x, 0.62, z);
  const weave = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.24, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9, side: THREE.DoubleSide }));
  weave.position.y = 0.12;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.26, 16), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  basket.add(weave, floor);
  group.add(basket);
  return basket;
}

// --- Churches ----------------------------------------------------------------------------------

type ChurchPhase = 'praise' | 'sermon' | 'offering' | 'hymn' | 'prayer';

interface ChurchPlan {
  style: 'pentecostal' | 'cathedral';
  phases: Array<[ChurchPhase, number]>;
  pews: { rows: number; z0: number; span: number; per: number };
  stageY: number;
  /** Where the pastor preaches from, and how far either way he paces */
  pulpit: [number, number];
  pace: number;
  pastor: { name: string; look: HumanConfig; rest: [number, number]; restYaw: number };
  leader?: { name: string; look: HumanConfig; at: [number, number]; rest: [number, number] };
  choir: { seats: Array<[number, number]>; looks: HumanConfig[] };
  band: Array<{ at: [number, number]; play: 'drum' | 'keys' | 'organ'; y: number; yaw: number }>;
  ushers: Array<{ name: string; look: HumanConfig; post: [number, number]; postYaw: number }>;
  baskets: Array<[number, number]>;
  screens?: Array<[number, number, number]>;
  sermon: string[];
  answers: string[];
  songs: string[];
  build(b: Builder): void;
}

/** A man: a senator or an agbada is one cloth top and bottom; with a suit or a tee, dark trousers */
const MEN = (outfitColor: number, outfit: HumanConfig['outfit'] = 'senator', extra: Partial<HumanConfig> = {}): HumanConfig => ({ gender: 'male', username: '', outfit, outfitColor, hairstyle: 'short_crop', trousersColor: outfit === 'senator' || outfit === 'agbada' ? outfitColor : 0x1f2937, ...extra });
const WOMEN = (outfitColor: number, outfit: HumanConfig['outfit'] = 'blue_dress', extra: Partial<HumanConfig> = {}): HumanConfig => ({ gender: 'female', username: '', outfit, outfitColor, hairstyle: 'gele', ...extra });

const CHURCH_LOOKS: HumanConfig[] = [
  MEN(0xf8fafc, 'senator', { skinTone: '#6b4226' }),
  WOMEN(0xdc2626, 'blue_dress', { skinTone: '#8d5a36' }),
  MEN(0x1e3a8a, 'lecturer_suit', { hasTie: true, skinTone: '#5e3a22' }),
  WOMEN(0x7c3aed, 'peplum_skirt', { skinTone: '#7a4a2a' }),
  MEN(0xe7d3b3, 'agbada', { hairstyle: 'fila', skinTone: '#4a2e1c' }),
  WOMEN(0x0ea5e9, 'blue_dress', { hairstyle: 'braids', skinTone: '#6b4226' }),
];

const PLANS: Record<string, ChurchPlan> = {
  'faith-arena': {
    style: 'pentecostal',
    phases: [['praise', 38], ['sermon', 34], ['offering', 28]],
    pews: { rows: 8, z0: -4, span: 9, per: 4 },
    stageY: 0.75,
    pulpit: [0, -8.7],
    pace: 3,
    pastor: { name: 'Pastor Ade', look: MEN(0x111827, 'lecturer_suit', { hasTie: true, skinTone: '#5e3a22' }), rest: [5.2, -11.3], restYaw: 0 },
    leader: { name: 'Sister Joy', look: WOMEN(0xd4af37, 'blue_dress', { skinTone: '#7a4a2a' }), at: [-1.6, -9.3], rest: [-4.6, -11.3] },
    choir: { seats: [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((x): [number, number] => [x, -11.3]), looks: [WOMEN(0x6d28d9, 'blue_dress', { hairstyle: 'bob_wig' }), MEN(0x6d28d9, 'senator')] },
    band: [
      { at: [-5.8, -10.3], play: 'drum', y: 0.75, yaw: 0 },
      { at: [6.0, -10.1], play: 'keys', y: 0.75, yaw: 0 },
    ],
    ushers: [
      { name: 'Usher Tolu', look: WOMEN(0x1e3a8a, 'peplum_skirt'), post: [10.6, 7], postYaw: Math.PI },
      { name: 'Usher Emeka', look: MEN(0x1e3a8a, 'lecturer_suit', { hasTie: true }), post: [-10.6, 7], postYaw: Math.PI },
    ],
    baskets: [[-1.7, -7.3], [1.7, -7.3]],
    screens: [[-9, 4.15, -11.66], [9, 4.15, -11.66]],
    sermon: [
      'Somebody shout Hallelujah!',
      'This week, your testimony shall be loud! Say Amen!',
      'Turn to your neighbour and say: it is well!',
      'The God who did it for Abraham will do it for you!',
      'Is there anybody here who believes?',
      'You will not labour in vain, in Jesus’ name!',
      'Where you are going, they will celebrate you!',
      'Lift your hands and say: thank you Jesus!',
    ],
    answers: ['Amen!', 'Hallelujah!', 'It is well!', 'Yes Lord!', 'Amen o!', 'Preach it!', 'Thank you Jesus!'],
    songs: ['🎵 Onise iyanu, o seun o!', '🎵 Jesu o, Jesu o, you are wonderful!', '🎵 Idinma, Chineke, idinma!', '🎵 Who is like unto thee, Jehovah?', '🎵 We lift your name on high!'],
    build: (b) => {
      // The choir's chairs, the drum kit, the keyboard, lights along the back of the stage
      for (const x of [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, -4.6, 5.2]) b.box(0x7f1d1d, 0.5, 0.45, 0.5, x, 0.75, -11.25).box(0x7f1d1d, 0.5, 0.55, 0.08, x, 1.2, -11.5);
      b.box(0x27272a, 0.4, 0.45, 0.4, -5.8, 0.75, -10.4);
      b.cylinder(0xdc2626, 0.32, 0.5, -5.8, 0.75, -9.55, { sides: 16 }).cylinder(0xe5e7eb, 0.2, 0.18, -6.3, 1.35, -9.75, { sides: 14 }).cylinder(0xe5e7eb, 0.2, 0.18, -5.3, 1.35, -9.75, { sides: 14 });
      b.cylinder(0xd4af37, 0.24, 0.02, -6.5, 1.85, -9.9, { sides: 16 }).cylinder(0x52525b, 0.02, 1.1, -6.5, 0.75, -9.9, { sides: 6 });
      b.box(0x18181b, 1.3, 0.08, 0.4, 6.0, 1.6, -9.55).box(0xf8fafc, 1.2, 0.02, 0.18, 6.0, 1.68, -9.5).box(0x3f3f46, 0.06, 0.85, 0.06, 6.0, 0.75, -9.55);
      for (let i = 0; i < 6; i++) b.box([0x7c3aed, 0x2563eb, 0xdb2777][i % 3], 0.5, 0.18, 0.18, -6 + i * 2.4, 0.78, -8.1, { glow: true });
    },
  },
  'redemption-cathedral': {
    style: 'cathedral',
    phases: [['hymn', 28], ['sermon', 32], ['prayer', 20], ['offering', 20]],
    pews: { rows: 6, z0: -3, span: 7, per: 3 },
    stageY: 0.75,
    pulpit: [0, -7.9],
    pace: 0,
    pastor: { name: 'Pastor Daniel', look: MEN(0x111827, 'lecturer_suit', { skinTone: '#4a2e1c' }), rest: [0, -7.9], restYaw: 0 },
    choir: { seats: [-3.3, -2.4, -1.5, 1.5, 2.4, 3.3].map((x): [number, number] => [x, -9.1]), looks: [WOMEN(0x991b1b, 'blue_dress', { hairstyle: 'bob_wig' }), MEN(0x991b1b, 'senator')] },
    band: [{ at: [-6.8, -6.9], play: 'organ', y: 0, yaw: Math.PI }],
    ushers: [
      { name: 'Sister Grace', look: WOMEN(0xf8fafc, 'peplum_skirt'), post: [-8.6, 6], postYaw: Math.PI },
      { name: 'Brother Femi', look: MEN(0x111827, 'lecturer_suit', { hasTie: true }), post: [8.6, 6], postYaw: Math.PI },
    ],
    baskets: [],
    sermon: [
      'The Lord be with you.',
      'Love your neighbour as yourself.',
      'Blessed are the peacemakers, for they shall be called children of God.',
      'Cast all your cares on Him, for He cares for you.',
      'Let your light so shine before men.',
      'Be kind to one another, tender-hearted, forgiving.',
    ],
    answers: ['Amen.', 'And also with you.', 'Thanks be to God.', 'Amen.'],
    songs: ['🎵 Holy, holy, holy! Lord God Almighty', '🎵 Amazing grace, how sweet the sound', '🎵 Abide with me, fast falls the eventide', '🎵 All people that on earth do dwell'],
    build: (b) => {
      for (const x of [-3.3, -2.4, -1.5, 1.5, 2.4, 3.3]) b.box(0x5b3a1e, 0.5, 0.45, 0.5, x, 0.75, -9.05).box(0x5b3a1e, 0.5, 0.6, 0.08, x, 1.2, -9.32);
      // The organ: a console at the front and pipes up the wall behind it
      b.box(0x5b3a1e, 1.6, 1.05, 0.7, -6.8, 0, -7.7).box(0xf8fafc, 1.4, 0.03, 0.24, -6.8, 0.95, -7.3).box(0x5b3a1e, 1.2, 0.45, 0.4, -6.8, 0, -6.6);
      for (let i = 0; i < 9; i++) b.cylinder(0xd4af37, 0.12, 2.2 + Math.abs(i - 4) * -0.25 + 1.2, -8.4 + i * 0.4, 1.1, -10.75, { sides: 10 });
      // The candle stand by the side wall
      b.box(0x44403c, 1.4, 0.9, 0.5, -8.6, 0, -4.5).box(0x78716c, 1.5, 0.04, 0.6, -8.6, 0.9, -4.5);
      for (let i = 0; i < 12; i++) b.cylinder(0xfafaf9, 0.025, 0.09, -9.15 + (i % 6) * 0.22, 0.94, -4.65 + Math.floor(i / 6) * 0.3, { sides: 6 });
    },
  },
};

class Church {
  private readonly group = new THREE.Group();
  private readonly plan: ChurchPlan;
  private readonly crowd: Crowd;
  private readonly choir: Crowd;
  private readonly band: Crowd;
  private readonly bubbles: Bubbles;
  private readonly music: Music;
  private pastor!: Figure;
  private leader: Figure | null = null;
  private readonly ushers: Figure[] = [];
  private readonly dancers: Array<{ fig: Figure; seat: [number, number]; standAt: [number, number]; went: boolean }> = [];
  private readonly basketGroups: THREE.Group[] = [];
  private readonly screens: Array<Map<ChurchPhase, THREE.Mesh>> = [];
  private readonly candles: THREE.Mesh[] = [];
  private notes = 0;
  private lit = 0;
  private built = false;
  /** Seconds into the service */
  private t = 0;
  private phase: ChurchPhase | null = null;
  private beat = 0;
  private clapShut = false;
  private nextLine = 0;
  private lineIndex = 0;
  private nextAnswer = 0;
  private bandFlip = 0;
  private bandA = true;
  /** Where the player sits and stands to join in */
  public readonly playerSeat: [number, number];
  public readonly playerStand: [number, number];
  private readonly room: PlaceInterior;
  private readonly key: string;

  constructor(room: PlaceInterior, key: string) {
    this.room = room;
    this.key = key;
    this.plan = PLANS[key];
    const plan = this.plan;
    this.group.name = `worship ${key}`;
    room.group.add(this.group);
    this.bubbles = new Bubbles(this.group);
    this.music = new Music(plan.style === 'pentecostal' ? 'praise' : 'organ');

    // The pews: who sits where. The player's place is at the aisle end of the fourth row on the left;
    // three on the right at the aisle are real people who get up and dance their offering forward.
    const { rows, z0, span, per } = plan.pews;
    const seats: Seat[] = [];
    const reserved = new Set<string>();
    const seatAt = (r: number, side: number, k: number): [number, number] => [side * (0.8 + (span * (k + 0.5)) / per), z0 + r * 1.4 + 0.2];
    this.playerSeat = seatAt(3, -1, 0);
    this.playerStand = [this.playerSeat[0], this.playerSeat[1] - STAND];
    reserved.add('3:-1:0');
    if (plan.style === 'pentecostal') for (let r = 0; r < 3; r++) reserved.add(`${r}:1:0`);
    for (let r = 0; r < rows; r++) for (const side of [-1, 1]) for (let k = 0; k < per; k++) {
      if (reserved.has(`${r}:${side}:${k}`)) continue;
      const [x, z] = seatAt(r, side, k);
      seats.push({ x, z, yaw: Math.PI, look: (seats.length * 5 + r) % CHURCH_LOOKS.length });
    }
    const lifted = (i: number) => ((i * 7919) % 101) / 101 > 0.68;
    const stand = STAND;
    const sets: Record<string, PoseSet> = plan.style === 'pentecostal'
      ? {
          sit: { pose: { legs: 'sit', arms: 'rest' } },
          clapShut: { pose: { legs: 'stand', arms: 'clap' }, time: 0.294, forward: stand, who: (i) => !lifted(i) },
          clapOpen: { pose: { legs: 'stand', arms: 'clap' }, time: 0, forward: stand, who: (i) => !lifted(i) },
          praise: { pose: { legs: 'stand', arms: 'praise' }, time: 0.6, forward: stand, who: lifted },
        }
      : {
          sit: { pose: { legs: 'sit', arms: 'rest' } },
          hymn: { pose: { legs: 'stand', arms: 'palms' }, forward: stand },
          kneel: { pose: { legs: 'kneel', arms: 'palms' }, forward: 0.62 },
        };
    this.crowd = new Crowd(`congregation ${key}`, CHURCH_LOOKS, seats, sets);
    this.group.add(this.crowd.group);

    const choirSeats: Seat[] = plan.choir.seats.map(([x, z], i) => ({ x, z, yaw: 0, y: plan.stageY, look: i % 2 }));
    this.choir = new Crowd(`choir ${key}`, plan.choir.looks, choirSeats, plan.style === 'pentecostal'
      ? {
          sit: { pose: { legs: 'sit', arms: 'rest' } },
          clapShut: { pose: { legs: 'stand', arms: 'clap' }, time: 0.294, forward: 0.5 },
          clapOpen: { pose: { legs: 'stand', arms: 'clap' }, time: 0, forward: 0.5 },
        }
      : {
          sit: { pose: { legs: 'sit', arms: 'rest' } },
          hymn: { pose: { legs: 'stand', arms: 'palms' }, forward: 0.5 },
          kneel: { pose: { legs: 'kneel', arms: 'palms' }, forward: 0.5 },
        });
    this.group.add(this.choir.group);

    const bandSeats: Seat[] = plan.band.map((m, i) => ({ x: m.at[0], z: m.at[1], yaw: m.yaw, y: m.y, look: i }));
    const bandLooks = plan.band.map(() => MEN(0x111827, 'casual_tee', { skinTone: '#5e3a22' }));
    const member = (play: string) => (i: number) => plan.band[i].play === play;
    this.band = new Crowd(`band ${key}`, bandLooks, bandSeats, {
      drumA: { pose: { legs: 'sit', arms: 'drum' }, time: 0.1208, who: member('drum') },
      drumB: { pose: { legs: 'sit', arms: 'drum' }, time: 0.3625, who: member('drum') },
      keysA: { pose: { legs: 'stand', arms: 'reach' }, who: member('keys') },
      keysB: { pose: { legs: 'stand', arms: 'palms' }, who: member('keys') },
      organA: { pose: { legs: 'sit', arms: 'reach' }, who: member('organ') },
      organB: { pose: { legs: 'sit', arms: 'palms' }, who: member('organ') },
      rest: { pose: { legs: 'sit', arms: 'rest' }, who: (i) => plan.band[i].play !== 'keys' },
      still: { pose: { legs: 'stand', arms: 'rest' }, who: member('keys') },
    });
    this.group.add(this.band.group);

    this.addCards();
  }

  /** The people and the furniture of the service, made the first time the room is seen */
  private build(): void {
    if (this.built) return;
    this.built = true;
    const plan = this.plan;
    const b = new Builder();
    plan.build(b);
    for (const [x, z] of plan.baskets) this.basketGroups.push(basketOn(b, this.group, x, z));
    this.group.add(b.build(`${this.key} worship furniture`, { roughness: 0.7 }));
    this.crowd.build();
    this.choir.build();
    this.band.build();
    this.crowd.go(['sit'], 0);
    this.choir.go(['sit'], 0);
    this.band.go(['rest', 'still'], 0);

    const p = plan.pastor;
    this.pastor = new Figure(this.group, `${this.key}-pastor`, p.name, p.look, p.rest, p.restYaw, plan.stageY);
    if (plan.leader) this.leader = new Figure(this.group, `${this.key}-leader`, plan.leader.name, plan.leader.look, plan.leader.rest, 0, plan.stageY);
    for (const u of plan.ushers) this.ushers.push(new Figure(this.group, `${this.key}-${u.name}`, u.name, u.look, u.post, u.postYaw));
    if (plan.style === 'pentecostal') {
      const { z0, span, per } = plan.pews;
      for (let r = 0; r < 3; r++) {
        const seat: [number, number] = [0.8 + span / (2 * per), z0 + r * 1.4 + 0.2];
        const fig = new Figure(this.group, `${this.key}-dancer-${r}`, ['Mama Bisi', 'Brother Kunle', 'Aunty Ngozi'][r], [WOMEN(0xf97316, 'blue_dress'), MEN(0x16a34a, 'agbada', { hairstyle: 'fila' }), WOMEN(0xdb2777, 'peplum_skirt')][r], seat, Math.PI);
        this.dancers.push({ fig, seat, standAt: [seat[0], seat[1] - STAND], went: false });
      }
    }
    // What the screens say, phase by phase
    for (const [x, y, z] of plan.screens ?? []) {
      const words: Array<[ChurchPhase, string, string]> = [
        ['praise', '🎵 PRAISE & WORSHIP', 'Onise iyanu, o seun o!'],
        ['sermon', '📖 TODAY’S WORD', 'Your testimony shall be loud'],
        ['offering', '💃 OFFERING', 'God loves a cheerful giver'],
      ];
      const set = new Map<ChurchPhase, THREE.Mesh>();
      for (const [ph, a, c] of words) {
        const board = signBoard([a, c], 4.6, 1.5, '#0b1e3f', '#ffffff');
        board.position.set(x, y, z);
        board.visible = false;
        board.name = `screen ${ph}`;
        this.group.add(board);
        set.set(ph, board);
      }
      this.screens.push(set);
    }
    if (plan.style === 'cathedral') {
      for (let i = 0; i < 12; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
        c.position.set(-9.15 + (i % 6) * 0.22, 1.07, -4.65 + Math.floor(i / 6) * 0.3);
        c.visible = false;
        c.name = 'candle flame';
        this.group.add(c);
        this.candles.push(c);
      }
    }
  }

  private phaseAt(t: number): { phase: ChurchPhase; start: number; end: number } {
    const total = this.plan.phases.reduce((s, [, d]) => s + d, 0);
    const at = ((t % total) + total) % total;
    let start = 0;
    for (const [phase, d] of this.plan.phases) {
      if (at < start + d) return { phase, start, end: start + d };
      start += d;
    }
    return { phase: this.plan.phases[0][0], start: 0, end: this.plan.phases[0][1] };
  }

  private get cycle(): number {
    return this.plan.phases.reduce((s, [, d]) => s + d, 0);
  }

  public tick(delta: number): void {
    this.build();
    this.t += delta;
    const now = this.phaseAt(this.t);
    const into = (this.t % this.cycle) - now.start;
    if (now.phase !== this.phase) this.begin(now.phase);
    const plan = this.plan;
    const loud = this.phase === 'praise' || (this.phase === 'offering' && plan.style === 'pentecostal');

    // The congregation and the choir
    if (loud) {
      this.beat += delta;
      if (this.beat >= 60 / 108 / 2) {
        this.beat = 0;
        this.clapShut = !this.clapShut;
        const clap = this.clapShut ? 'clapShut' : 'clapOpen';
        this.crowd.go([clap, 'praise'], 0.05);
        this.choir.go([clap], 0.05);
      }
    }
    this.crowd.tick(delta, loud ? ['praise', 'clapShut', 'clapOpen'] : this.phase === 'hymn' ? ['hymn'] : [], loud ? 0.12 : 0.05, loud ? 0.04 : 0);
    this.choir.tick(delta, loud ? ['clapShut', 'clapOpen'] : this.phase === 'hymn' ? ['hymn'] : [], 0.1, loud ? 0.03 : 0);
    // The band plays when there is music
    this.bandFlip += delta;
    const playing = loud || this.phase === 'hymn' || (this.phase === 'offering' && plan.style === 'cathedral');
    if (playing && this.bandFlip > 0.16) {
      this.bandFlip = 0;
      this.bandA = !this.bandA;
      this.band.go(this.bandA ? ['drumA', 'keysA', 'organA'] : ['drumB', 'keysB', 'organB'], 0);
    } else if (!playing) this.band.go(['rest', 'still'], 0.2);
    this.band.tick(delta);
    if (playing) this.music.on();
    else this.music.off();
    this.music.tick();

    // The pastor and the leader
    this.nextLine -= delta;
    this.nextAnswer -= delta;
    if (this.phase === 'sermon' && !this.pastor.busy) {
      if (plan.pace > 0 && !this.pastor.walking && this.nextLine < 2.2 && this.nextLine > 2.0) {
        const x = (Math.random() * 2 - 1) * plan.pace;
        this.pastor.walk([[x, plan.pulpit[1]]], () => this.pastor.face(0), { speed: 1.1 });
      }
      if (!this.pastor.walking) this.pastor.pose('stand', plan.style === 'pentecostal' ? 'preach' : 'talk');
      if (this.nextLine <= 0) {
        const line = plan.sermon[this.lineIndex++ % plan.sermon.length];
        this.pastor.say(line, 4);
        speak(line);
        this.nextLine = 5.2;
        this.nextAnswer = 2.6;
      }
      if (this.nextAnswer <= 0 && this.nextAnswer > -1) {
        this.answer(2);
        this.nextAnswer = -2;
      }
    } else if (this.phase === 'praise' || this.phase === 'hymn') {
      if (this.leader && !this.leader.walking) this.leader.pose('dance', 'preach');
      if (this.nextLine <= 0) {
        const line = plan.songs[this.lineIndex++ % plan.songs.length];
        if (this.leader) this.leader.say(line, 3.4);
        else this.pastor.say(line, 3.4);
        this.nextLine = 4.5;
      }
      if (!this.pastor.walking && !this.pastor.busy) this.pastor.pose(plan.style === 'pentecostal' ? 'stand' : 'stand', plan.style === 'pentecostal' ? 'praise' : 'palms');
    } else if (this.phase === 'prayer') {
      if (!this.pastor.busy) this.pastor.pose('stand', 'palms');
      if (this.nextLine <= 0) {
        const lines = ['Let us pray.', 'Lord, have mercy upon us.', 'Give us this day our daily bread.', 'Through Christ our Lord.'];
        this.pastor.say(lines[this.lineIndex++ % lines.length], 3.6);
        this.nextLine = 5;
        this.nextAnswer = 3.8;
      }
      if (this.nextAnswer <= 0 && this.nextAnswer > -1) {
        this.answer(3, 'Amen.');
        this.nextAnswer = -2;
      }
    } else if (this.phase === 'offering') {
      if (!this.pastor.busy && !this.pastor.walking) this.pastor.pose('stand', plan.style === 'pentecostal' ? 'clap' : 'palms');
      if (this.leader && !this.leader.walking) this.leader.pose('dance', 'praise');
      if (this.nextLine <= 0 && plan.style === 'pentecostal') {
        const lines = ['It is offering time! Dance to the front!', 'God loves a cheerful giver!', 'Bring it with joy! Dance!'];
        this.pastor.say(lines[this.lineIndex++ % lines.length], 3.4);
        this.nextLine = 6;
      }
      this.offeringDance(into);
    }
    for (const f of [this.pastor, this.leader, ...this.ushers, ...this.dancers.map((d) => d.fig)]) f?.tick(delta);
    this.bubbles.tick(delta);
  }

  /** A few in the pews answer the pastor */
  private answer(count: number, word?: string): void {
    for (let n = 0; n < count; n++) {
      const i = Math.floor(Math.random() * this.crowd.seats.length);
      const at = this.crowd.head(i);
      this.bubbles.add(word ?? this.plan.answers[Math.floor(Math.random() * this.plan.answers.length)], at.x, at.y, at.z, 2);
    }
  }

  /** The start of each part of the service */
  private begin(phase: ChurchPhase): void {
    this.phase = phase;
    this.nextLine = 0.6;
    const plan = this.plan;
    for (const set of this.screens) for (const [ph, board] of set) board.visible = ph === phase;
    if (phase === 'sermon') {
      this.crowd.go(['sit']);
      this.choir.go(['sit']);
      this.leader?.walk([plan.leader!.rest], () => { this.leader?.face(0); this.leader?.pose('sit'); });
      if (!this.pastor.busy) this.pastor.walk([plan.pulpit], () => this.pastor.face(0), { speed: 1.2 });
    } else if (phase === 'praise' || (phase === 'offering' && plan.style === 'pentecostal')) {
      this.crowd.go(['clapOpen', 'praise']);
      this.choir.go(['clapOpen']);
      if (this.leader) this.leader.walk([plan.leader!.at], () => this.leader?.face(0));
      if (phase === 'praise' && !this.pastor.busy) this.pastor.walk([[plan.pastor.rest[0], plan.pastor.rest[1] + 0.6]], () => this.pastor.face(0));
    } else if (phase === 'hymn') {
      this.crowd.go(['hymn']);
      this.choir.go(['hymn']);
    } else if (phase === 'prayer') {
      this.crowd.go(['kneel'], 0.8);
      this.choir.go(['kneel'], 0.5);
    } else if (phase === 'offering') {
      this.crowd.go(['sit']);
      this.choir.go(['sit']);
    }
    // The ushers: at the baskets for the offering, by the door the rest of the time
    plan.ushers.forEach((u, i) => {
      const fig = this.ushers[i];
      if (phase === 'offering' && plan.style === 'pentecostal') {
        const [bx, bz] = plan.baskets[i % plan.baskets.length];
        fig.walk([[u.post[0] * 0.95, -6.4], [bx + (bx < 0 ? -0.75 : 0.75), bz + 0.3]], () => { fig.face(0); fig.pose('stand', 'clap'); }, { speed: 1.6 });
      } else if (phase === 'offering') {
        // Down the aisle with the bag, row by row, and back to the door
        const cx = i === 0 ? -0.35 : 0.35;
        const rows = Array.from({ length: plan.pews.rows }, (_, r): [number, number] => [cx, plan.pews.z0 + r * 1.4 - 0.5]);
        const back = plan.pews.z0 + plan.pews.rows * 1.4 + 0.4;
        fig.walk([[u.post[0], -5.4], [cx, -5.4], ...rows, [cx, back], [u.post[0], back], u.post], () => { fig.face(u.postYaw); fig.pose('stand', 'rest'); }, { speed: 1.0, arms: 'carry' });
      } else if (fig.where()[1] < 0) {
        fig.walk([[u.post[0] * 0.95, -6.4], u.post], () => { fig.face(u.postYaw); fig.pose('stand', 'rest'); }, { speed: 1.6 });
      } else {
        fig.pose('stand', phase === 'praise' ? 'clap' : 'rest');
      }
    });
    // Those at the end of the pews on the right: standing or sitting with the rest
    for (const d of this.dancers) {
      d.went = false;
      if (d.fig.walking) continue;
      const up = phase !== 'sermon';
      d.fig.place(up ? d.standAt[0] : d.seat[0], up ? d.standAt[1] : d.seat[1], Math.PI);
      d.fig.pose(up ? 'dance' : 'sit', up ? 'clap' : 'rest');
    }
  }

  /** At offering time, one after another they dance their offering to the front */
  private offeringDance(into: number): void {
    const plan = this.plan;
    if (plan.style !== 'pentecostal') return;
    this.dancers.forEach((d, j) => {
      if (d.went || into < 2 + j * 5) return;
      d.went = true;
      const basket = plan.baskets[(j + 1) % plan.baskets.length];
      const front: [number, number] = [basket[0], basket[1] + 0.75];
      d.fig.walk([[0.25, d.standAt[1]], [0.25, -6.2], front], () => {
        d.fig.face(Math.PI);
        d.fig.pose('stand', 'reach');
        d.fig.hold(0.9, () => {
          addNote(this.basketGroups[(j + 1) % this.basketGroups.length], this.notes++);
          d.fig.walk([[0.25, -6.2], [0.25, d.standAt[1]], d.standAt], () => { d.fig.face(Math.PI); d.fig.pose('dance', 'clap'); }, { dance: true, arms: 'praise', speed: 1.1 });
        });
      }, { dance: true, arms: 'praise', speed: 1.1 });
    });
  }

  /** What the player does, sitting or standing in their pew, at each part of the service */
  private playerPose(): { pose: PoseState; at: [number, number] } {
    switch (this.phase) {
      case 'praise': return { pose: { legs: 'dance', arms: 'praise' }, at: this.playerStand };
      case 'offering': return this.plan.style === 'pentecostal' ? { pose: { legs: 'dance', arms: 'clap' }, at: this.playerStand } : { pose: { legs: 'sit', arms: 'rest' }, at: this.playerSeat };
      case 'hymn': return { pose: { legs: 'stand', arms: 'palms' }, at: this.playerStand };
      case 'prayer': return { pose: { legs: 'kneel', arms: 'palms' }, at: [this.playerSeat[0], this.playerSeat[1] - 0.62] };
      default: return { pose: { legs: 'sit', arms: 'rest' }, at: this.playerSeat };
    }
  }

  private label(): string {
    const { phase, end } = this.phaseAt(this.t);
    const left = clockOf(end - (this.t % this.cycle));
    if (phase === 'praise') return `🙌 Praise and worship is on (${left}): join in`;
    if (phase === 'hymn') return `🎵 The hymn is on (${left}): join the service`;
    if (phase === 'sermon') return `📖 The sermon (${left}): sit and listen`;
    if (phase === 'prayer') return `🙏 Prayers (${left}): kneel with them`;
    return this.plan.style === 'pentecostal' ? `💃 Offering time (${left}): join in` : `⛪ Offering (${left}): join the service`;
  }

  private addCards(): void {
    const key = this.key;
    const plan = this.plan;
    const [sx, sz] = this.playerSeat;
    this.room.addCard({
      id: `place_${key}_service`, name: plan.style === 'pentecostal' ? '🙌 The service' : '⛪ The service', description: 'Find your place in the pew and join in.',
      at: [sx, sz], stand: [-0.3, sz - STAND],
      label: () => this.label(),
      run: (host) => this.join(host),
    });
    if (plan.style === 'pentecostal') {
      const [bx, bz] = plan.baskets[0];
      this.room.addCard({
        id: `place_${key}_offering`, name: '💃 Offering baskets', description: 'Dance your offering to the front.',
        at: [bx, bz], stand: [bx, bz + 0.8],
        label: () => '💃 Dance your offering to the front',
        run: (host) => this.offerChoices(host),
      });
      this.room.addCard({
        id: `place_${key}_altar`, name: '🙏 The altar', description: 'Go forward for prayer.',
        at: [0, -7.9], stand: [0, -7.0],
        label: () => `🙏 Go forward for prayer: ${plan.pastor.name} will pray for you`,
        run: (host) => this.altarCall(host),
      });
    } else {
      this.room.addCard({
        id: `place_${key}_candle`, name: '🕯️ Candles', description: 'Light a candle and say a quiet prayer.',
        at: [-8.6, -4.5], stand: [-7.6, -4.5],
        label: () => '🕯️ Light a candle (₦500)',
        run: (host) => this.lightCandle(host),
      });
    }
  }

  /** Into the pew, and through the service with everyone else */
  private join(host: PlaceHost): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const [sx, sz] = this.playerSeat;
    const show = new Sequence('service in the pew', [actor]);
    show.maxSeconds = 70;
    show.add(
      steps.walk(actor, this.room.at(-0.3, sz - STAND), { speed: 3 }),
      steps.walk(actor, this.room.at(sx, sz - STAND), { speed: 1.6 }),
      keepTime(actor, this.room, Math.PI, () => this.playerPose(), 30, [
        { at: 4, run: () => host.say(this.phase === 'sermon' ? `${this.plan.pastor.name} is preaching. The church answers him.` : this.phase === 'prayer' ? 'Heads bowed, the whole church on its knees.' : 'The drums, the choir, the whole church on its feet.', 'info') },
      ]),
      steps.call('blessed', () => {
        host.backend.modifyNeed('social', 25);
        host.backend.modifyNeed('fun', 15);
        host.say(this.plan.style === 'pentecostal' ? '🙌 You leave lighter than you came. "It is well!"' : '⛪ A quiet hour, a full heart.', 'success');
      }),
      steps.animate(actor, { legs: 'stand', arms: 'rest' }, 0.3),
      steps.walk(actor, this.room.at(-0.3, sz - STAND), { speed: 1.6 })
    );
    host.director.run(show);
  }

  private offerChoices(host: PlaceHost): void {
    host.ask({
      who: 'Offering', role: this.room.spec.name, text: 'God loves a cheerful giver. How much do you bring?',
      choices: [
        ...[1000, 5000, 20000, 100000].map((amount) => ({ label: amount >= 100000 ? `A thanksgiving offering of ${naira(amount)}` : `Dance forward with ${naira(amount)}`, note: amount >= 100000 ? 'Social +30, Fun +20' : 'Social +10, Fun +10', pick: () => this.danceOffering(host, amount) })),
        { label: 'Not now', pick: () => undefined },
      ],
    });
  }

  /** Dancing up the aisle to the basket, the money going in at the moment of giving */
  private danceOffering(host: PlaceHost, amount: number): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const [bx, bz] = this.plan.baskets[0];
    const basket = this.basketGroups[0];
    const show = new Sequence('offering dance', [actor]);
    show.maxSeconds = 40;
    show.add(
      steps.walk(actor, this.room.at(-0.25, -5.6), { speed: 2.6 }),
      steps.walk(actor, this.room.at(bx, bz + 0.75), { speed: 1.6 }),
      steps.face(actor, this.room.at(bx, bz)),
      steps.animate(actor, { legs: 'dance', arms: 'praise' }, 2.5),
      steps.animate(actor, { legs: 'stand', arms: 'reach' }, 1.2, [{
        at: 0.6, run: () => {
          if (!host.backend.pay(amount, `Offering, ${this.room.spec.name}`, 'SHOP_PURCHASE')) {
            host.say(`You do not have ${naira(amount)} on you.`, 'warning');
            return false;
          }
          if (basket) addNote(basket, this.notes++);
          return true;
        },
      }]),
      steps.call('received', () => {
        const big = amount >= 100000;
        host.backend.modifyNeed('social', big ? 30 : 10);
        host.backend.modifyNeed('fun', big ? 20 : 10);
        this.ushers[0]?.say('God bless you!', 2.5);
        if (big) this.pastor.say('Somebody brought a thanksgiving! Clap for Jesus!', 3.5);
        host.say(big ? '💃 The whole church clapped you back to your seat.' : '💃 Into the basket, with a dance. God bless you!', 'success');
      }),
      steps.animate(actor, { legs: 'dance', arms: 'clap' }, 2.2)
    );
    host.director.run(show);
  }

  /** On the knees at the altar; the pastor comes to the edge of the stage and prays over the player */
  private altarCall(host: PlaceHost): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const pastor = this.pastor;
    const before = pastor.where();
    const show = new Sequence('altar call', [actor]);
    show.maxSeconds = 40;
    show.add(
      steps.walk(actor, this.room.at(-0.25, -5.6), { speed: 2.6 }),
      steps.walk(actor, this.room.at(0, -7.0), { speed: 1.4 }),
      steps.face(actor, this.room.at(0, -8.5)),
      steps.call('the pastor comes', () => {
        pastor.busy = true;
        pastor.walk([[0, -8.45]], () => { pastor.face(0); pastor.pose('stand', 'praise'); }, { speed: 1.6 });
      }),
      steps.animate(actor, { legs: 'kneel', arms: 'palms' }, 7, [
        { at: 0.3, run: () => pastor.say('Receive your miracle, in Jesus’ name!', 3.5) },
        { at: 0.65, run: () => { pastor.say('Every burden, fall away! Go in peace.', 3); speak('Receive your miracle. Every burden, fall away. Go in peace.'); } },
        {
          at: 0.95, run: () => {
            host.backend.modifyNeed('fun', 15);
            host.backend.modifyNeed('social', 20);
            host.backend.modifyNeed('energy', 10);
            host.say('🙏 You feel light. Whatever was heavy, you left it at the altar.', 'success');
          },
        },
      ]),
      steps.animate(actor, { legs: 'stand', arms: 'rest' }, 0.4)
    );
    show.onEnd(() => {
      pastor.walk([before], () => { pastor.busy = false; pastor.face(0); }, { speed: 1.3 });
    });
    host.director.run(show);
  }

  private lightCandle(host: PlaceHost): void {
    const flame = this.candles[this.lit % this.candles.length];
    host.director.perform({
      id: 'light a candle', actor: host.actor, point: this.room.at(-7.6, -4.5), target: this.room.at(-8.6, -4.5), animation: { arms: 'reach' }, seconds: 2.2, effectAt: 0.6, ifStuck: 'snap',
      effect: () => {
        if (!host.backend.pay(500, `A candle, ${this.room.spec.name}`, 'SHOP_PURCHASE')) {
          host.say('A candle is ₦500.', 'warning');
          return false;
        }
        if (flame) flame.visible = true;
        this.lit += 1;
        host.backend.modifyNeed('social', 6);
        host.backend.modifyNeed('fun', 4);
        host.say('🕯️ A small flame among the others, and a quiet prayer.', 'success');
        return true;
      },
    });
  }

  /** For the tests */
  public state(): Record<string, unknown> {
    return {
      phase: this.phase, t: +this.t.toFixed(1), crowd: this.crowd.counts(), choir: this.choir.counts(), band: this.band.counts(), seats: this.crowd.seats.length,
      pastor: { at: this.pastor?.where().map((v) => +v.toFixed(2)), pose: this.pastor?.actor.pose, walking: this.pastor?.walking, busy: this.pastor?.busy },
      dancers: this.dancers.map((d) => ({ at: d.fig.where().map((v) => +v.toFixed(2)), walking: d.fig.walking, pose: d.fig.actor.pose })),
      ushers: this.ushers.map((u) => ({ at: u.where().map((v) => +v.toFixed(2)), walking: u.walking })),
      said: this.bubbles.said, notes: this.notes, candles: this.lit, music: this.music.playing,
      screens: this.screens.map((s) => [...s].filter(([, m]) => m.visible).map(([p]) => p)),
    };
  }

  /** Jumps the service to the start of a part (for the tests) */
  public skipTo(phase: ChurchPhase): void {
    let start = 0;
    for (const [p, d] of this.plan.phases) {
      if (p === phase) break;
      start += d;
    }
    this.t = Math.floor(this.t / this.cycle) * this.cycle + start + 0.01;
  }
}

// --- The mosque ---------------------------------------------------------------------------------

type MosquePart = 'adhan' | 'rise' | 'salah' | 'dua' | 'lesson';
const MOSQUE_PARTS: Array<[MosquePart, number]> = [['adhan', 9], ['rise', 3], ['salah', 52.5], ['dua', 5.5], ['lesson', 30]];

/** Two rak'ahs: when each movement begins, from the opening takbir, and what the imam says as he moves */
const SALAH: Array<{ at: number; pose: string; said?: string }> = [
  { at: 0, pose: 'takbir', said: 'Allāhu akbar' },
  { at: 2, pose: 'qiyam', said: 'Al-ḥamdu lillāhi rabbil-‘ālamīn…' },
  { at: 8, pose: 'ruku', said: 'Allāhu akbar' },
  { at: 12, pose: 'stand', said: 'Sami‘a Allāhu liman ḥamidah' },
  { at: 14, pose: 'sujud', said: 'Allāhu akbar' },
  { at: 17.5, pose: 'sit', said: 'Allāhu akbar' },
  { at: 19.5, pose: 'sujud', said: 'Allāhu akbar' },
  { at: 23, pose: 'stand', said: 'Allāhu akbar' },
  { at: 24.5, pose: 'qiyam', said: 'Qul huwa Allāhu aḥad…' },
  { at: 29.5, pose: 'ruku', said: 'Allāhu akbar' },
  { at: 33.5, pose: 'stand', said: 'Sami‘a Allāhu liman ḥamidah' },
  { at: 35.5, pose: 'sujud', said: 'Allāhu akbar' },
  { at: 39, pose: 'sit', said: 'Allāhu akbar' },
  { at: 41, pose: 'sujud', said: 'Allāhu akbar' },
  { at: 44.5, pose: 'sit', said: 'Allāhu akbar' },
  { at: 49.5, pose: 'salamR', said: 'As-salāmu ‘alaykum wa raḥmatullāh' },
  { at: 51, pose: 'salamL', said: 'As-salāmu ‘alaykum wa raḥmatullāh' },
];
const POSES: Record<string, PoseState> = {
  sit: { legs: 'kneel', arms: 'rest' },
  stand: { legs: 'stand', arms: 'rest' },
  takbir: { legs: 'stand', arms: 'takbir' },
  qiyam: { legs: 'stand', arms: 'pray' },
  ruku: { legs: 'bow', arms: 'rest' },
  sujud: { legs: 'prostrate', arms: 'rest' },
  salamR: { legs: 'kneel', arms: 'rest' },
  salamL: { legs: 'kneel', arms: 'rest' },
  dua: { legs: 'kneel', arms: 'palms' },
};
const ADHAN = ['Allāhu akbar, Allāhu akbar', 'Ash-hadu an lā ilāha illallāh', 'Ḥayya ‘alaṣ-ṣalāh', 'Ḥayya ‘alal-falāḥ'];
const LESSON = [
  'Brothers, peace be upon you all.',
  'The Prophet, peace be upon him, said: the best of you are the best to their families.',
  'Smiling at your brother is charity.',
  'Whoever is honest in trade stands with the truthful.',
  'Remove what harms people from the road: that too is charity.',
  'Feed the hungry and visit the sick.',
  'Patience is light. Be patient with your neighbours.',
];
const ROWS = [-5.8, -4.4, -3.0, -1.6];
const MOSQUE_LOOKS: HumanConfig[] = [
  MEN(0xf8fafc, 'senator', { hairstyle: 'fila', skinTone: '#6b4226' }),
  MEN(0xe7e5e4, 'senator', { hairstyle: 'fila', skinTone: '#4a2e1c' }),
  MEN(0xbfdbfe, 'agbada', { hairstyle: 'fila', skinTone: '#8d5a36' }),
  MEN(0x9ca3af, 'senator', { skinTone: '#5e3a22' }),
];

class Mosque {
  private readonly group = new THREE.Group();
  private readonly crowd: Crowd;
  private readonly bubbles: Bubbles;
  private imam!: Figure;
  private muezzin!: Figure;
  private built = false;
  private t = 0;
  private part: MosquePart | null = null;
  private move = -1;
  private nextLine = 0;
  private lineIndex = 0;
  private given = 0;
  public readonly playerSpot: [number, number] = [2.25, ROWS[3]];
  private readonly muezzinSpot: [number, number] = [4.5, ROWS[0]];
  private readonly room: PlaceInterior;
  private readonly key: string;

  constructor(room: PlaceInterior, key: string) {
    this.room = room;
    this.key = key;
    this.group.name = `worship ${key}`;
    room.group.add(this.group);
    this.bubbles = new Bubbles(this.group);
    const seats: Seat[] = [];
    ROWS.forEach((z, r) => {
      const xs = r < 3 ? Array.from({ length: 11 }, (_, k) => -3.75 + k * 0.75) : [-1.5, -0.75, 0, 0.75, 1.5];
      for (const x of xs) seats.push({ x, z, yaw: Math.PI, look: (seats.length * 3 + r) % MOSQUE_LOOKS.length });
    });
    const sets: Record<string, PoseSet> = {};
    for (const [name, pose] of Object.entries(POSES)) sets[name] = { pose, headY: name === 'salamR' ? 0.95 : name === 'salamL' ? -0.95 : 0 };
    this.crowd = new Crowd(`congregation ${key}`, MOSQUE_LOOKS, seats, sets);
    this.group.add(this.crowd.group);
    this.addCards();
  }

  private build(): void {
    if (this.built) return;
    this.built = true;
    const b = new Builder();
    // The carpet in rows (saff), a line where each row stands, the imam's rug, the minbar
    b.box(0x7f1d1d, 10, 0.02, 6.4, 0, 0.005, -3.55);
    for (const z of ROWS) b.box(0xd4af37, 10, 0.025, 0.05, 0, 0.01, z + 0.42);
    for (const z of ROWS) for (let i = 0; i < 13; i++) b.box(0x14532d, 0.62, 0.022, 0.95, -4.5 + i * 0.75, 0.008, z - 0.55);
    b.box(0x166534, 1, 0.025, 1.7, 0, 0.01, -7.6);
    for (let step = 0; step < 4; step++) {
      const z = -7.2 - step * 0.45;
      const h = 0.3 + step * 0.3;
      b.box(0xf5f5f4, 0.9, h, 0.45, 2.6, 0, z).box(0xd4af37, 0.05, 0.9, 0.05, 2.15, h, z).box(0xd4af37, 0.05, 0.9, 0.05, 3.05, h, z);
    }
    b.box(0x14532d, 0.6, 1.0, 0.45, 5.5, 0, 7.6).box(0xd4af37, 0.4, 0.04, 0.2, 5.5, 1.0, 7.6);
    this.group.add(b.build(`${this.key} worship furniture`, { roughness: 0.8 }));
    this.crowd.build();
    this.crowd.go(['sit'], 0);
    this.imam = new Figure(this.group, `${this.key}-imam`, 'Imam Abdullahi', MEN(0xf8fafc, 'agbada', { hairstyle: 'fila', skinTone: '#4a2e1c' }), [0, -7.3], Math.PI);
    this.muezzin = new Figure(this.group, `${this.key}-muezzin`, 'Muezzin Sani', MEN(0xe7e5e4, 'senator', { hairstyle: 'fila', skinTone: '#5e3a22' }), [-4.6, -7.0], Math.PI);
    this.imam.pose('kneel');
  }

  private partAt(t: number): { part: MosquePart; start: number; end: number } {
    const total = MOSQUE_PARTS.reduce((s, [, d]) => s + d, 0);
    const at = ((t % total) + total) % total;
    let start = 0;
    for (const [part, d] of MOSQUE_PARTS) {
      if (at < start + d) return { part, start, end: start + d };
      start += d;
    }
    return { part: 'adhan', start: 0, end: 9 };
  }

  private get cycle(): number {
    return MOSQUE_PARTS.reduce((s, [, d]) => s + d, 0);
  }

  /** The movement of the prayer under way, if one is */
  private movement(): string | null {
    const { part, start } = this.partAt(this.t);
    if (part !== 'salah') return null;
    const into = (this.t % this.cycle) - start;
    let at = -1;
    SALAH.forEach((m, i) => { if (into >= m.at) at = i; });
    return at >= 0 ? SALAH[at].pose : null;
  }

  public tick(delta: number): void {
    this.build();
    this.t += delta;
    const now = this.partAt(this.t);
    const into = (this.t % this.cycle) - now.start;
    if (now.part !== this.part) this.begin(now.part);
    this.nextLine -= delta;
    if (this.part === 'adhan' && this.nextLine <= 0 && this.lineIndex < ADHAN.length) {
      this.muezzin.say(ADHAN[this.lineIndex++], 2.4);
      this.nextLine = 2.2;
    }
    if (this.part === 'salah') {
      let at = -1;
      SALAH.forEach((m, i) => { if (into >= m.at) at = i; });
      if (at !== this.move && at >= 0) {
        this.move = at;
        const m = SALAH[at];
        this.crowd.go([m.pose], 0.45);
        const pose = POSES[m.pose];
        this.imam.pose(pose.legs, pose.arms);
        if (!this.muezzin.walking) this.muezzin.pose(pose.legs, pose.arms);
        if (m.said) this.imam.say(m.said, 2.6);
      }
    }
    if (this.part === 'lesson' && this.nextLine <= 0) {
      this.imam.say(LESSON[this.lineIndex++ % LESSON.length], 4.4);
      this.nextLine = 5;
    }
    // The muezzin goes back to his place for the next call near the end of the lesson
    if (this.part === 'lesson' && into > 25 && !this.muezzin.walking && this.muezzin.where()[0] > 0) {
      this.muezzin.walk([[4.5, ROWS[0] - 0.9], [-4.6, -7.0]], () => { this.muezzin.face(Math.PI); this.muezzin.pose('stand'); });
    }
    this.crowd.tick(delta);
    this.imam.tick(delta);
    this.muezzin.tick(delta);
    this.bubbles.tick(delta);
  }

  private begin(part: MosquePart): void {
    this.part = part;
    this.lineIndex = 0;
    this.nextLine = 0.3;
    this.move = -1;
    if (part === 'adhan') {
      this.crowd.go(['sit'], 0.6);
      this.imam.place(0, -7.3, Math.PI);
      this.imam.pose('kneel');
      this.muezzin.place(-4.6, -7.0, Math.PI);
      this.muezzin.pose('stand', 'takbir');
    } else if (part === 'rise') {
      this.crowd.go(['stand'], 1.2);
      this.imam.pose('stand');
      this.muezzin.say('Qad qāmatiṣ-ṣalāh', 2.4);
      this.muezzin.walk([[-4.6, ROWS[0] - 0.9], [4.5, ROWS[0] - 0.9], this.muezzinSpot], () => { this.muezzin.face(Math.PI); this.muezzin.pose('stand'); }, { speed: 3.4 });
    } else if (part === 'dua') {
      this.crowd.go(['dua'], 0.6);
      this.imam.pose('kneel', 'palms');
      this.muezzin.pose('kneel', 'palms');
      this.imam.say('Āmīn', 2.4);
      this.bubbles.add('Āmīn', ...this.crowd.head(5).toArray() as [number, number, number]);
    } else if (part === 'lesson') {
      this.crowd.go(['sit'], 0.8);
      this.imam.face(0);
      this.imam.pose('kneel', 'talk');
      this.muezzin.pose('kneel');
    }
  }

  /** What the player does in the row at each moment */
  private playerPose(): { pose: PoseState; at: [number, number] } {
    const m = this.movement();
    const part = this.partAt(this.t).part;
    const name = m ?? (part === 'rise' ? 'stand' : part === 'dua' ? 'dua' : 'sit');
    return { pose: POSES[name], at: this.playerSpot };
  }

  private label(): string {
    const { part, end } = this.partAt(this.t);
    const into = this.t % this.cycle;
    if (part === 'salah') return '🕌 The prayer is on: join the row';
    if (part === 'rise' || part === 'adhan') return `🕌 The call to prayer: the prayer begins in ${clockOf(Math.max(0, 12 - into))}`;
    return `🕌 Join the next prayer (in ${clockOf(this.cycle - into + 12)})${part === 'lesson' ? ` · the lesson is on, ${clockOf(end - into)} left` : ''}`;
  }

  private addCards(): void {
    const key = this.key;
    this.room.addCard({
      id: `place_${key}_pray`, name: '🕌 The prayer', description: 'Shoes off, and stand in the row with the others.',
      at: [this.playerSpot[0], this.playerSpot[1] - 0.6], stand: [this.playerSpot[0], this.playerSpot[1] + 0.9],
      label: () => this.label(),
      run: (host) => this.pray(host),
    });
    this.room.addCard({
      id: `place_${key}_lesson`, name: '📖 The lesson', description: 'Sit with the others while the imam teaches.',
      at: [-3, ROWS[3]], stand: [-3, ROWS[3] + 0.9],
      label: () => (this.partAt(this.t).part === 'lesson' ? '📖 The imam is teaching: sit and listen' : `📖 The lesson is after the prayer (in ${clockOf(Math.max(0, 70 - (this.t % this.cycle)))})`),
      run: (host) => this.lesson(host),
    });
    this.room.addCard({
      id: `place_${key}_sadaqah`, name: '🤲 Charity box', description: 'Sadaqah for those in need.',
      at: [5.5, 7.6], stand: [5.5, 6.6],
      label: () => '🤲 Give sadaqah',
      run: (host) => host.ask({
        who: 'Charity box', role: this.room.spec.name, text: 'For the poor and those in need.',
        choices: [...[1000, 5000, 20000].map((amount) => ({ label: `Give ${naira(amount)}`, note: 'Social +8', pick: () => this.give(host, amount) })), { label: 'Not now', pick: () => undefined }],
      }),
    });
  }

  /** In the row behind the imam until the prayer is done and the du'a said */
  private pray(host: PlaceHost): void {
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    let prayed = false;
    const show = new Sequence('pray in the row', [actor]);
    show.maxSeconds = 130;
    show.add(
      steps.walk(actor, this.room.at(this.playerSpot[0], this.playerSpot[1] + 0.9), { speed: 2.6 }),
      steps.walk(actor, this.room.at(this.playerSpot[0], this.playerSpot[1]), { speed: 1.2 }),
      steps.face(actor, Math.PI),
      keepTime(actor, this.room, Math.PI, () => {
        const part = this.partAt(this.t).part;
        if (part === 'salah' || part === 'dua') prayed = true;
        if (prayed && (part === 'lesson' || part === 'adhan')) return null;
        return this.playerPose();
      }, 125),
      steps.call('prayed', () => {
        if (!prayed) return false;
        host.backend.modifyNeed('social', 15);
        host.backend.modifyNeed('fun', 8);
        host.say('🕌 You prayed in the row with the others. The noise of the road is far away.', 'success');
        return true;
      }),
      steps.animate(actor, { legs: 'stand', arms: 'rest' }, 0.5)
    );
    host.director.run(show);
  }

  private lesson(host: PlaceHost): void {
    if (this.partAt(this.t).part !== 'lesson') {
      host.say(`The lesson is after the prayer, in ${clockOf(Math.max(0, 70 - (this.t % this.cycle)))}.`, 'info');
      return;
    }
    if (host.director.interrupt(host.actor) === 'locked') return;
    const actor = host.actor;
    const spot: [number, number] = [-3, ROWS[3]];
    const show = new Sequence('mosque lesson', [actor]);
    show.maxSeconds = 45;
    show.add(
      steps.walk(actor, this.room.at(spot[0], spot[1] + 0.9), { speed: 2.6 }),
      steps.walk(actor, this.room.at(spot[0], spot[1]), { speed: 1.2 }),
      keepTime(actor, this.room, Math.PI, () => (this.partAt(this.t).part === 'lesson' ? { pose: { legs: 'kneel', arms: 'rest' }, at: spot } : null), 40),
      steps.call('taught', () => {
        host.backend.modifyNeed('social', 10);
        host.backend.addSkillExp('academics', 1);
        host.say('📖 You sat through the lesson. Something in it stays with you.', 'success');
      }),
      steps.animate(actor, { legs: 'stand', arms: 'rest' }, 0.5)
    );
    host.director.run(show);
  }

  private give(host: PlaceHost, amount: number): void {
    host.director.perform({
      id: 'sadaqah', actor: host.actor, point: this.room.at(5.5, 6.6), target: this.room.at(5.5, 7.6), animation: { arms: 'reach' }, seconds: 1.8, effectAt: 0.6, ifStuck: 'snap',
      effect: () => {
        if (!host.backend.pay(amount, `Sadaqah, ${this.room.spec.name}`, 'SHOP_PURCHASE')) {
          host.say(`You do not have ${naira(amount)} on you.`, 'warning');
          return false;
        }
        this.given += amount;
        host.backend.modifyNeed('social', 8);
        host.say('🤲 Into the box, for those in need. May it be accepted.', 'success');
        return true;
      },
    });
  }

  public state(): Record<string, unknown> {
    return {
      part: this.part, movement: this.movement(), t: +this.t.toFixed(1), crowd: this.crowd.counts(), seats: this.crowd.seats.length,
      imam: { at: this.imam?.where().map((v) => +v.toFixed(2)), pose: this.imam?.actor.pose, yaw: +(this.imam?.root.rotation.y ?? 0).toFixed(2), head: this.imam ? +this.imam.rig.head.getWorldPosition(new THREE.Vector3()).y.toFixed(2) : null },
      muezzin: { at: this.muezzin?.where().map((v) => +v.toFixed(2)), walking: this.muezzin?.walking },
      said: this.bubbles.said, given: this.given,
    };
  }

  public skipTo(part: MosquePart, offset = 0): void {
    let start = 0;
    for (const [p, d] of MOSQUE_PARTS) {
      if (p === part) break;
      start += d;
    }
    this.t = Math.floor(this.t / this.cycle) * this.cycle + start + offset + 0.01;
  }
}

/** The service in each place of worship, for the tests */
export const Worship = new Map<string, Church | Mosque>();

/** Gives a church or the mosque its living congregation */
export function attachWorship(room: PlaceInterior, key: string): void {
  let site: Church | Mosque | null = null;
  if (PLANS[key]) site = new Church(room, key);
  else if (key === 'central-mosque') site = new Mosque(room, key);
  if (!site) return;
  Worship.set(key, site);
  const s = site;
  room.ticks.push((delta) => s.tick(delta));
}
