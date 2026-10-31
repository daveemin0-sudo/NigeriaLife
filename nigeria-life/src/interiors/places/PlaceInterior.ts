import * as THREE from 'three';
import { Sequence, steps } from '../../interactions/Sequence';
import type { InteriorDefinition, InteriorNPCDef } from '../InteriorTypes';
import { InteriorPrefabs } from '../InteriorPrefabs';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import { HumanMeshBuilder } from '../../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../../graphics/MeshBaker';
import type { InteractiveObject } from '../../world/World';
import { Builder, signBoard } from '../../world/kit/ArchKit';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import type { ArmPose } from '../../interactions/Poses';
import type { Item } from '../../backend/types';
import type { BackendService } from '../../backend/BackendService';
import { PLACE_WORK, type WorkSpec } from './PlaceJobs';
import { createHandWork } from '../../jobs/HandWork';
import { Employment } from '../../jobs/Employment';
import { attachShows } from './LiveEvents';
import { attachWorship, Figure } from './Worship';
import { attachHotel } from './Hotel';
import { attachViewing } from './ViewingCentre';
import { attachTravellers } from './Travellers';

/**
 * A place along the expressway, gone into: its own room, laid out for what is done there, with
 * the people who work there, a few regulars, and stations where the player does it. Every
 * choice at a station is acted out (walk up, reach, sit, dance) and its money and goods change
 * hands at that moment.
 */

export interface StationChoice {
  label: string;
  note?: string;
  price?: number;
  arms?: ArmPose;
  /** Sit down to do it (at a table, on a bench) */
  sit?: boolean;
  seconds?: number;
  /** Dance through it */
  dance?: boolean;
  /** What it does to the player: needs, skills */
  effect?: (backend: BackendService) => void;
  /** What goes into the bag */
  item?: Omit<Item, 'quantity'>;
  /** Something the game opens instead (the State House, the jobs app) */
  open?: string;
  said?: string;
}

export interface StationSpec {
  id: string;
  name: string;
  /** Where the thing is, and where the player stands to use it, in the room's own space */
  at: [number, number];
  stand: [number, number];
  who: string;
  role: string;
  text: string;
  choices: StationChoice[];
}

export interface StaffSpec {
  name: string;
  title: string;
  at: [number, number];
  facing: number;
  outfit: number;
  gender?: 'male' | 'female';
  chef?: boolean;
  cap?: boolean;
  tie?: boolean;
  says: string;
}

export interface PlaceSpec {
  /** The place along the road it is the inside of */
  key: string;
  name: string;
  district: string;
  room: { width: number; length: number; height: number; floor: number; wall: number };
  /** What the room is furnished with, drawn in its own space (the door is at +z) */
  build(b: Builder, room: THREE.Group): void;
  /** The sign on the back wall */
  sign?: { text: string; sub: string; bg: string };
  staff: StaffSpec[];
  /** People there already: standing or sitting, facing which way */
  regulars?: Array<{ at: [number, number]; facing: number; outfit: number; gender?: 'male' | 'female'; sit?: boolean }>;
  stations: StationSpec[];
  /** Anything that changes as the game goes on (a supermarket's shelves), added once the room is built */
  attach?(room: PlaceInterior): void;
  /** What the door in the front wall is called, when it does not lead out to the road (a hotel room's door) */
  door?: { name: string; category: string; description: string };
}

const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });

/** A chair put where something is done sitting and nothing was there to sit on: facing `yaw` */
function chairAt(x: number, z: number, yaw: number): THREE.Object3D {
  const b = new Builder();
  for (const [lx, lz] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]]) b.box(0x1f2937, 0.045, 0.42, 0.045, lx, 0, lz);
  b.box(0x374151, 0.5, 0.07, 0.48, 0, 0.42, 0).box(0x4b5563, 0.46, 0.04, 0.44, 0, 0.49, 0.01);
  // The back, behind the sitter
  b.box(0x374151, 0.5, 0.52, 0.06, 0, 0.5, -0.23).box(0x1f2937, 0.045, 0.5, 0.045, -0.22, 0.42, -0.24).box(0x1f2937, 0.045, 0.5, 0.045, 0.22, 0.42, -0.24);
  const chair = b.build('a chair', { roughness: 0.6 });
  chair.position.set(x, 0, z);
  chair.rotation.y = yaw;
  return chair;
}

/** Opens something of the game's own (set by the game) */
export const PlaceOpeners: { open: (what: string, host?: PlaceHost) => void } = { open: () => {} };

export class PlaceInterior {
  public group = new THREE.Group();
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  public readonly spec: PlaceSpec;
  /** Where the toilet door went along the back wall, and whether a clear spot was found (for the tests) */
  public restroomAt = { x: 0, clear: false };
  /**
   * Where the door in the front wall leads, when it is not out to the road: a hotel room's door
   * opens on the corridor, the corridor's stairs go down to the lobby. Set by the place itself.
   */
  public leadsTo: (() => { id: string; spawnAt: THREE.Vector3; spawnYaw: number } | null) | null = null;

  constructor(spec: PlaceSpec, origin: THREE.Vector3, comeOutAt: THREE.Vector3) {
    this.spec = spec;
    this.group.position.copy(origin);
    this.group.name = `place ${spec.key}`;
    const { width, length, height } = spec.room;
    this.def = {
      id: `interior_place_${spec.key}`,
      name: spec.name,
      type: 'office',
      tier: 'tier3_simulated',
      districtName: spec.district,
      streetBuildingId: `roadside-${spec.key}`,
      streetEntrance: comeOutAt.clone(),
      streetExitRotation: 0,
      interiorOrigin: origin,
      playerSpawnOffset: new THREE.Vector3(0, 0, length / 2 - 1.6),
      exitDoorOffset: new THREE.Vector3(0, 0, length / 2),
      cameraOffset: new THREE.Vector3(0, 14, 16),
      ambientLightColor: 0xfffaf0,
      ambientLightIntensity: 1.4,
      rooms: [{ id: `${spec.key}_room`, name: spec.name, size: { width, length, height }, centerOffset: new THREE.Vector3(), floorColor: spec.room.floor, wallColor: spec.room.wall }],
      stations: [],
      npcs: [],
    };
    this.build();
  }

  /** A point in the room's own space, in the world */
  public at(x: number, z: number): THREE.Vector3 {
    return this.world(x, z);
  }

  /** Something in the room to go up to and use, with its own action */
  public addCard(card: { id: string; name: string; description: string; at: [number, number]; stand: [number, number]; label: () => string; run: (host: PlaceHost) => void }): void {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    marker.position.set(card.at[0], 0.8, card.at[1]);
    this.group.add(marker);
    this.interactiveList.push({ mesh: marker, id: card.id, name: card.name, category: this.spec.name, description: card.description, interactionPoint: this.world(card.stand[0], card.stand[1]) });
    PlaceActions.register(card.id, { label: card.label, run: card.run });
  }

  private world(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(this.group.position.x + x, 0, this.group.position.z + z);
  }

  private build(): void {
    const { width, length, height, floor, wall } = this.spec.room;
    this.group.add(InteriorPrefabs.createRoom(width, length, height, floor, wall));
    // Lights across the ceiling, so the room is bright at any hour
    for (let x = -width / 2 + 4; x < width / 2 - 2; x += 7) for (let z = -length / 2 + 4; z < length / 2 - 2; z += 7) this.group.add(InteriorPrefabs.createCeilingLight(new THREE.Vector3(x, height - 0.3, z), 0xfff7e6));
    const b = new Builder();
    this.spec.build(b, this.group);
    for (const work of PLACE_WORK[this.spec.key] ?? []) work.build?.(b);
    this.group.add(b.build(`${this.spec.key} furniture`, { roughness: 0.7 }));
    // What was built (not the people, nor the cards put in later): where the seats are found
    this.built = this.group.children.slice();
    if (this.spec.sign) {
      const board = signBoard([this.spec.sign.text, this.spec.sign.sub], Math.min(width - 4, 10), 1.6, this.spec.sign.bg, '#ffffff');
      board.position.set(0, height - 1.3, -length / 2 + 0.25);
      this.group.add(board);
    }

    const door = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, length / 2), Math.PI);
    this.group.add(door);
    const way = this.spec.door ?? { name: `Way out of ${this.spec.name}`, category: 'Exit to the road', description: 'Back out to the expressway.' };
    this.interactiveList.push({ mesh: door, id: 'interior_exit_door', name: way.name, category: way.category, description: way.description, interactionPoint: this.world(0, length / 2 - 1), exitLabel: this.spec.door ? `🚪 ${this.spec.door.name}` : undefined });
    this.addRestroom(b.footprints);
    // The tables: what was built at table height, small enough to sit round
    this.tables = b.footprints.filter((f) => f.height >= 0.6 && f.height <= 0.92 && f.maxX - f.minX >= 0.8 && f.maxZ - f.minZ >= 0.6 && f.maxX - f.minX <= 4.2 && f.maxZ - f.minZ <= 4.2);

    // Those who work here
    this.spec.staff.forEach((s, i) => {
      const def: InteriorNPCDef = {
        id: `${this.spec.key}_staff_${i}`, name: s.name, role: s.title, title: s.title, relativePosition: new THREE.Vector3(s.at[0], 0, s.at[1]), rotationY: s.facing,
        outfitColor: s.outfit, gender: s.gender, hasChefHat: s.chef, hasPoliceCap: s.cap, hasTie: s.tie, dialogueGreeting: s.says, actions: [], light: this.spec.staff.length > 3,
      };
      const npc = new InteriorNPCMesh(def);
      this.npcs.push(npc);
      this.group.add(npc.group);
      this.interactiveList.push({ mesh: npc.group, id: `interior_npc_${def.id}`, name: `${s.name} (${s.title})`, category: this.spec.name, description: s.says, interactionPoint: this.world(s.at[0] + Math.sin(s.facing) * 1.3, s.at[1] + Math.cos(s.facing) * 1.3) });
    });
    // Others already here: each one mesh, standing or sat down
    (this.spec.regulars ?? []).forEach((r, i) => {
      const female = (r.gender ?? (i % 2 ? 'female' : 'male')) === 'female';
      const rig = HumanMeshBuilder.createHuman({
        gender: female ? 'female' : 'male', username: '', lod: 'street', outfitColor: r.outfit,
        outfit: female ? (i % 2 ? 'blue_dress' : 'casual_blouse') : i % 3 ? 'casual_tee' : 'senator',
        hairstyle: female ? (i % 2 ? 'braids' : 'gele') : 'short_crop',
      });
      rig.nameTag.visible = false;
      if (r.sit) {
        rig.leftLeg.rotation.x = rig.rightLeg.rotation.x = -1.42;
        if (rig.leftLowerLeg) rig.leftLowerLeg.rotation.x = 1.3;
        if (rig.rightLowerLeg) rig.rightLowerLeg.rotation.x = 1.3;
        rig.leftArm.rotation.x = rig.rightArm.rotation.x = -0.5;
      }
      const geo = bakeToGeometry(rig.group);
      if (!geo) return;
      const mesh = new THREE.Mesh(geo, PEOPLE);
      mesh.position.set(r.at[0], r.sit ? -0.3 : 0, r.at[1]);
      mesh.rotation.y = r.facing;
      mesh.castShadow = true;
      this.group.add(mesh);
    });

    // The stations
    for (const st of this.spec.stations) {
      const marker = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      marker.position.set(st.at[0], 0.8, st.at[1]);
      this.group.add(marker);
      const id = `place_${this.spec.key}_${st.id}`;
      this.interactiveList.push({ mesh: marker, id, name: st.name, category: this.spec.name, description: st.text, interactionPoint: this.world(st.stand[0], st.stand[1]) });
      PlaceActions.register(id, { label: () => st.name, run: (host) => this.offer(st, host) });
    }
    // Everything done sitting down has a seat: the chair itself, a bench beside it, or a chair put there
    for (const st of this.spec.stations) if (st.choices.some((c) => c.sit && !(this.tables.length && /Hunger \+/.test(c.note ?? '')))) this.seatFor(st);
    for (const work of PLACE_WORK[this.spec.key] ?? []) this.addWork(work);
    this.spec.attach?.(this);
    attachShows(this, this.spec.key);
    attachWorship(this, this.spec.key);
    attachHotel(this, this.spec.key);
    if (this.spec.key === 'viewing-centre') attachViewing(this);
    if (this.spec.key === 'mmia-terminal') attachTravellers(this);
  }

  /**
   * The toilet: a door in the back wall, where the camera always sees it, put where nothing
   * stands in front of it. The player goes through it, the flush is heard from behind it, and
   * they come out again relieved and washed up.
   */
  private addRestroom(footprints: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; height: number }>): void {
    const { width, length } = this.spec.room;
    const z = -length / 2 + 0.24;
    const points: Array<[number, number]> = [
      ...this.spec.staff.map((st) => st.at),
      ...this.spec.stations.flatMap((st) => [st.at, st.stand]),
      ...(PLACE_WORK[this.spec.key] ?? []).flatMap((w) => [w.boss.at, ...w.tasks.map((t) => t.at)]),
      ...(this.spec.regulars ?? []).map((r) => r.at),
    ];
    const clear = (x: number) => {
      const box = { minX: x - 0.9, maxX: x + 0.9, minZ: -length / 2, maxZ: -length / 2 + 2.4 };
      const hit = footprints.some((f) => f.height > 0.15 && f.maxX > box.minX && f.minX < box.maxX && f.maxZ > box.minZ && f.minZ < box.maxZ);
      return !hit && !points.some(([px, pz]) => px > box.minX - 0.4 && px < box.maxX + 0.4 && pz < box.maxZ + 0.4);
    };
    const tries: number[] = [];
    for (let step = 1.6; step < width / 2 - 1; step += 1.2) tries.push(width / 2 - step, -width / 2 + step);
    const x = tries.find(clear) ?? width / 2 - 1.6;
    this.restroomAt = { x, clear: tries.some(clear) };
    const holder = new THREE.Group();
    holder.name = 'restroom door';
    holder.position.set(x - 0.45, 0, z);
    holder.rotation.y = 0;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 0.6 }));
    leaf.name = 'door_leaf';
    leaf.position.set(0.45, 1.05, 0);
    const pivot = new THREE.Group();
    pivot.add(leaf);
    holder.add(pivot);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 }));
    frame.position.set(0.45, 1.1, -0.03);
    holder.add(frame);
    const sign = signBoard(['🚻 Toilet', 'Customers only'], 0.9, 0.36, '#1d4ed8', '#ffffff');
    sign.position.set(0.45, 2.45, 0.06);
    holder.add(sign);
    this.group.add(holder);
    this.addCard({
      id: `toilet_${this.spec.key}`, name: 'Toilet', description: 'The toilet at the back.',
      at: [x, z + 0.6], stand: [x, -length / 2 + 1.3],
      label: () => '🚽 Use the toilet',
      run: (host) => {
        const actor = host.actor;
        const result = host.director.perform([
          {
            id: 'into the toilet', actor, point: this.world(x, -length / 2 + 1.3), target: this.world(x, -length / 2), animation: { arms: 'reach' }, seconds: 0.7, effectAt: 0.6, ifStuck: 'snap',
            effect: () => { pivot.rotation.y = -1.4; actor.root.visible = false; },
          },
          {
            id: 'in the toilet', actor, animation: { arms: 'rest' }, seconds: 3.2, effectAt: 0.95,
            effect: () => {
              host.backend.relieveBladder();
              host.backend.modifyNeed('hygiene', 3);
              host.say('🚽 *Flush* You wash your hands and come out relieved.', 'success');
            },
          },
        ], { locked: true });
        result.sequence?.onEnd(() => { actor.root.visible = true; pivot.rotation.y = 0; });
        if (!result.ok && result.reason) host.say(result.reason, 'info');
      },
    });
  }

  /**
   * A job here: the one in charge, who takes people on and keeps the book, and the place where
   * a shift is started. The shift's tasks are acted out in turn; it is paid once, when the last
   * is done, and not at all if the worker walks off.
   */
  private addWork(w: WorkSpec): void {
    const jobs = Employment.get();
    if (!jobs.employer(w.employer)) return;
    const s = w.boss;
    const key = this.spec.key;
    const def: InteriorNPCDef = {
      id: `${key}_boss_${w.employer}`, name: s.name, role: s.title, title: s.title, relativePosition: new THREE.Vector3(s.at[0], 0, s.at[1]), rotationY: s.facing,
      outfitColor: s.outfit, gender: s.gender, hasChefHat: s.chef, hasPoliceCap: s.cap, hasTie: s.tie, dialogueGreeting: s.says, actions: [], light: true,
    };
    const npc = new InteriorNPCMesh(def);
    this.npcs.push(npc);
    this.group.add(npc.group);
    const piece = w.piece ?? 'shift';
    let host: PlaceHost | null = null;
    const work = createHandWork({
      employerId: w.employer,
      name: w.shift,
      words: { boss: s.name, theBoss: s.name, says: s.name, role: `${s.title}, ${this.spec.name}`, offer: w.offer, ready: w.ready, piece, done: 'done' },
      rounds: w.tasks.map((t) => ({
        stand: this.world(t.at[0], t.at[1]),
        face: this.world(t.look[0], t.look[1]),
        arms: t.arms,
        legs: t.sit ? 'sit' as const : 'stand' as const,
        seconds: t.seconds,
        done: () => host?.say(t.says, 'info'),
      })),
      maxSeconds: 120,
      ended: (paid, by) => {
        if (!paid && work.setDown > 0) by.say(`You left the ${piece} half done. ${s.name} pays nothing for that.`, 'warning');
      },
    });
    const hire = `work_${key}_hire_${w.employer}`;
    this.interactiveList.push({ mesh: npc.group, id: hire, name: `${s.name} (${s.title})`, category: this.spec.name, description: s.says, interactionPoint: this.world(s.at[0] + Math.sin(s.facing) * 1.3, s.at[1] + Math.cos(s.facing) * 1.3) });
    PlaceActions.register(hire, { label: () => work.bossLabel(), run: (by) => work.askBoss(by) });

    const first = w.tasks[0];
    const marker = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    marker.position.set(first.look[0], 0.8, first.look[1]);
    this.group.add(marker);
    const shift = `work_${key}_shift_${w.employer}`;
    const title = w.shift.charAt(0).toUpperCase() + w.shift.slice(1);
    this.interactiveList.push({ mesh: marker, id: shift, name: `💼 ${title}`, category: `${jobs.employer(w.employer)!.name}: staff only`, description: jobs.employer(w.employer)!.task, interactionPoint: this.world(first.at[0], first.at[1]) });
    PlaceActions.register(shift, {
      label: () => (jobs.isEmployed(w.employer) ? `💼 Start: ${w.shift} · ₦${Math.round(work.rate() * Employment.payBoost()).toLocaleString()}` : `💼 ${title} (ask ${s.name} for work)`),
      run: (by) => {
        host = by;
        work.start(by);
      },
    });
  }

  /** The station's choices; the one picked is acted out, and its money and goods change hands as it happens */
  private offer(st: StationSpec, host: PlaceHost): void {
    host.ask({
      who: st.who,
      role: st.role,
      text: st.text,
      choices: st.choices.map((c) => ({
        label: c.label,
        note: c.price ? `₦${c.price.toLocaleString()}${c.note ? ` · ${c.note}` : ''}` : c.note,
        pick: () => {
          if (c.open) {
            PlaceOpeners.open(c.open, host);
            return;
          }
          const stand = this.world(st.stand[0], st.stand[1]);
          const look = this.world(st.at[0], st.at[1]);
          if (c.dance) {
            const done = host.director.perform({ id: `${st.id} ${c.label}`, actor: host.actor, point: stand, target: look, animation: { arms: 'rest' }, seconds: 0.3, effect: () => this.settle(c, host) });
            if (done.ok) host.emote('zanku', c.seconds ?? 8);
            return;
          }
          // A meal is eaten where it is seen: the plate (and the bottle) in front of them as they eat
          const meal = /Hunger \+/.test(c.note ?? '');
          // Sat down at a table, the food brought to them there, when the place has tables
          if (meal && c.sit && this.sitDownMeal(st, c, host)) return;
          if (c.sit) {
            this.sitAndDo(st, c, host, meal);
            return;
          }
          const done = host.director.perform({
            id: `${st.id} ${c.label}`,
            actor: host.actor,
            point: stand,
            target: look,
            animation: { arms: meal ? 'eat' : c.arms ?? 'reach', legs: c.sit ? 'sit' : 'stand' },
            seconds: c.seconds ?? 2,
            effectAt: c.sit ? 0.9 : 0.6,
            ifStuck: 'snap',
            effect: () => this.settle(c, host),
          });
          if (meal && done.ok && done.sequence) this.serve(c, host, done.sequence);
        },
      })),
    });
  }

  /**
   * The plate a meal is eaten from, put down in front of the player the moment they start eating
   * (on the table when sitting, in the hand when standing) and cleared when they are done.
   */
  private serve(c: StationChoice, host: PlaceHost, sequence: Sequence): void {
    const label = c.label.toLowerCase();
    const food = /jollof|rice|fried rice/.test(label) ? 0xea580c : /amala|ewedu|eba|pounded|semo/.test(label) ? 0x6b4f2a : /okra|soup|vegetable/.test(label) ? 0x4d7c0f
      : /suya|asun|meat|chicken|goat|fish/.test(label) ? 0x7c2d12 : /shawarma|sandwich|bread/.test(label) ? 0xfde68a : /chips|plantain|dodo/.test(label) ? 0xfacc15 : 0xd97706;
    const plate = new THREE.Group();
    plate.name = 'served meal';
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }));
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: food, roughness: 0.8 }));
    heap.scale.set(1.1, 0.6, 1.1);
    heap.position.y = 0.015;
    plate.add(dish, heap);
    if (/drink|coke|chapman|malt|beer|juice|water|wine|champagne|zobo/.test(label)) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 10), new THREE.MeshStandardMaterial({ color: /coke|malt/.test(label) ? 0x3f1d0b : 0x166534, roughness: 0.3 }));
      bottle.position.set(0.22, 0.12, 0.05);
      plate.add(bottle);
    }
    const actor = host.actor;
    const here = new THREE.Vector3();
    const watch = () => {
      if (plate.parent || actor.sequence !== sequence || actor.pose.arms !== 'eat') return;
      // In front of them: on the table at a seat, held up in front when standing
      actor.worldPosition(here);
      const ahead = c.sit ? 0.5 : 0.34;
      plate.position.set(here.x - this.group.position.x + Math.sin(actor.yaw) * ahead, c.sit ? 0.78 : 1.02, here.z - this.group.position.z + Math.cos(actor.yaw) * ahead);
      plate.rotation.y = actor.yaw;
      this.group.add(plate);
    };
    this.ticks.push(watch);
    sequence.onEnd(() => {
      plate.removeFromParent();
      const i = this.ticks.indexOf(watch);
      if (i >= 0) this.ticks.splice(i, 1);
    });
  }

  /** What was built in the room, to find the seats in */
  private built: THREE.Object3D[] = [];
  private readonly ray = new THREE.Raycaster();
  /** Each seated station's seat: where to sit, which way, and where to step in from */
  public readonly seats = new Map<string, { seat: [number, number]; from: [number, number]; yaw: number; added: boolean }>();

  /** How high the first thing under a point of the room is, looking down from above head height (0 for bare floor) */
  public topAt(x: number, z: number, from = 2.4): number {
    const o = this.group.position;
    this.group.updateMatrixWorld(true);
    this.ray.camera ??= new THREE.PerspectiveCamera();
    this.ray.layers.enableAll();
    this.ray.set(new THREE.Vector3(o.x + x, o.y + from, o.z + z), new THREE.Vector3(0, -1, 0));
    this.ray.far = from;
    for (const hit of this.ray.intersectObjects(this.built, true)) {
      const m = (hit.object as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      const first = Array.isArray(m) ? m[0] : m;
      if (!(hit.object as THREE.Mesh).isMesh || (first && first.transparent && first.opacity < 0.05)) continue;
      return hit.point.y - o.y;
    }
    return 0;
  }

  private readonly seated = new Map<string, boolean>();
  /** Is there a chair or a bench at this place by a table (looked once) */
  private hasSeat(key: string, seat: [number, number]): boolean {
    let known = this.seated.get(key);
    if (known === undefined) {
      const top = this.topAt(seat[0], seat[1]);
      known = top >= 0.3 && top <= 0.7;
      this.seated.set(key, known);
    }
    return known;
  }

  /** A surface to sit on at a point: above the knee, below a table, with floor in front for the feet (not a stage, not a bed's middle) */
  private seatTop(x: number, z: number): boolean {
    const top = this.topAt(x, z);
    if (top < 0.3 || top > 0.7) return false;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      if (this.topAt(x + Math.sin(a) * 0.6, z + Math.cos(a) * 0.6) < 0.25) return true;
    }
    return false;
  }

  /**
   * Where a seated station is sat: in the thing itself when it is a seat (a barber's chair, a
   * lounger), else on a seat beside where one stands (a bench before the stage); facing away from
   * its back when it has one, else toward what is watched or used. With nothing to sit on, a
   * chair is put down there facing it. Worked out once, when the room is built.
   */
  private seatFor(st: StationSpec): { seat: [number, number]; from: [number, number]; yaw: number; added: boolean } {
    const known = this.seats.get(st.id);
    if (known) return known;
    const [ax, az] = st.at;
    const [sx, sz] = st.stand;
    let seat: [number, number] | null = null;
    let itself = false;
    if (this.seatTop(ax, az)) {
      seat = [ax, az];
      itself = true;
    } else {
      let best = Infinity;
      for (let dx = -1.2; dx <= 1.21; dx += 0.15) {
        for (let dz = -1.2; dz <= 1.21; dz += 0.15) {
          const d = Math.hypot(dx, dz);
          if (d > 1.2 || d >= best) continue;
          if (this.seatTop(sx + dx, sz + dz)) {
            best = d;
            seat = [sx + dx, sz + dz];
          }
        }
      }
    }
    let yaw: number;
    let back = false;
    let added = false;
    if (seat) {
      // Its back: something chest-high right behind the seat
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const top = this.topAt(seat[0] + Math.sin(a) * 0.32, seat[1] + Math.cos(a) * 0.32);
        if (top > 0.9 && top < 1.8) {
          yaw = a + Math.PI;
          back = true;
          break;
        }
      }
      yaw ??= itself ? Math.atan2(sx - ax, sz - az) : Math.atan2(ax - seat[0], az - seat[1]);
    } else {
      seat = [sx, sz];
      yaw = Math.atan2(ax - sx, az - sz);
      const chair = chairAt(sx, sz, yaw);
      this.group.add(chair);
      this.built.push(chair);
      back = true;
      added = true;
    }
    // Stepped into from the side nearer the way in when it has a back, else from in front
    const across: [number, number] = [Math.cos(yaw!), -Math.sin(yaw!)];
    const toStand = Math.sign((sx - seat[0]) * across[0] + (sz - seat[1]) * across[1]) || 1;
    const from: [number, number] = back
      ? [seat[0] + across[0] * 0.62 * toStand, seat[1] + across[1] * 0.62 * toStand]
      : [seat[0] + Math.sin(yaw!) * 0.55, seat[1] + Math.cos(yaw!) * 0.55];
    const found = { seat: [+seat[0].toFixed(2), +seat[1].toFixed(2)] as [number, number], from, yaw: yaw!, added };
    this.seats.set(st.id, found);
    return found;
  }

  /**
   * Something done sitting (a haircut, a film, a show, a drink at the bar): stepped into the seat,
   * sat there through it, paid for as it is done, and up again.
   */
  private sitAndDo(st: StationSpec, c: StationChoice, host: PlaceHost, meal: boolean): void {
    const { seat, from, yaw } = this.seatFor(st);
    const actor = host.actor;
    if (host.director.interrupt(actor) === 'locked') return;
    const arms: ArmPose = meal ? 'eat' : c.arms && c.arms !== 'reach' ? c.arms : 'rest';
    const sitting = new Sequence(`${st.id} ${c.label}`, [actor]).add(
      steps.walk(actor, this.world(from[0], from[1]), { ifStuck: 'snap' }),
      steps.face(actor, yaw),
      steps.slide(actor, this.world(seat[0], seat[1]), 0.5),
      steps.setPose(actor, { legs: 'sit', arms }),
      steps.animate(actor, { legs: 'sit', arms }, c.seconds ?? 2, [{ at: 0.9, run: () => this.settle(c, host) }]),
      steps.setPose(actor, { legs: 'stand', arms: 'rest' }),
      steps.slide(actor, this.world(from[0], from[1]), 0.5),
    );
    if (!host.director.run(sitting)) return;
    if (meal) this.serve(c, host, sitting);
  }

  /** A free place at a table, nearest a point: where to sit, which way, where to come from, where the plate goes */
  private freeSeat(near: [number, number]): { key: string; seat: [number, number]; behind: [number, number]; yaw: number; plate: [number, number]; height: number; server: [number, number] } | null {
    const taken = [...(this.spec.regulars ?? []).map((r) => r.at), ...this.spec.staff.map((st) => st.at)];
    let best: ReturnType<PlaceInterior['freeSeat']> = null;
    let bestD = Infinity;
    for (const t of this.tables) {
      const w = t.maxX - t.minX;
      const d = t.maxZ - t.minZ;
      const along = w >= d;
      const length = along ? w : d;
      const count = Math.max(1, Math.floor(length / 0.9));
      for (let i = 0; i < count; i++) {
        const u = (along ? t.minX : t.minZ) + (i + 0.5) * (length / count);
        for (const side of [-1, 1]) {
          const edge = along ? (side < 0 ? t.minZ : t.maxZ) : side < 0 ? t.minX : t.maxX;
          const seat: [number, number] = along ? [u, edge + side * 0.45] : [edge + side * 0.45, u];
          const behind: [number, number] = along ? [u, edge + side * 1.15] : [edge + side * 1.15, u];
          const plate: [number, number] = along ? [u, edge - side * 0.22] : [edge - side * 0.22, u];
          // Facing the table: from the low side toward +, from the high side back
          const yaw = along ? (side < 0 ? 0 : Math.PI) : side < 0 ? Math.PI / 2 : -Math.PI / 2;
          // The server stands at the table beside them
          const server: [number, number] = along ? [u + 0.75, edge + side * 0.75] : [edge + side * 0.75, u + 0.75];
          const key = `${seat[0].toFixed(2)},${seat[1].toFixed(2)}`;
          if (this.seatsInUse.has(key)) continue;
          if (taken.some(([px, pz]) => Math.hypot(px - seat[0], pz - seat[1]) < 0.7)) continue;
          // Only where a chair or a bench stands
          if (!this.hasSeat(key, seat)) continue;
          const dd = Math.hypot(seat[0] - near[0], seat[1] - near[1]);
          if (dd < bestD) {
            bestD = dd;
            best = { key, seat, behind, yaw, plate, height: t.height, server };
          }
        }
      }
    }
    return best;
  }

  /**
   * Ordered at the counter, paid there; then to a free table, sat down, and the food is carried
   * out and put down in front of them; eaten sitting there; up again when it is finished.
   */
  private sitDownMeal(st: StationSpec, c: StationChoice, host: PlaceHost): boolean {
    const spot = this.freeSeat(st.stand);
    if (!spot) return false;
    const actor = host.actor;
    const order = host.director.perform({
      id: `${st.id} order ${c.label}`,
      actor,
      point: this.world(st.stand[0], st.stand[1]),
      target: this.world(st.at[0], st.at[1]),
      animation: { arms: 'reach' },
      seconds: 1.0,
      effectAt: 0.6,
      ifStuck: 'snap',
      effect: () => {
        // Ordered here, paid for once it is eaten
        if (c.price && !host.backend.canPay(c.price)) {
          host.say(`That is ₦${c.price.toLocaleString()}. You do not have enough.`, 'warning');
          return false;
        }
        host.say(`${st.who}: Sit down, I am bringing it.`, 'info');
        return true;
      },
    });
    if (!order.ok || !order.sequence) return true;
    order.sequence.onEnd((reason) => {
      if (reason === 'done') this.toTable(c, host, spot);
    });
    return true;
  }

  private toTable(c: StationChoice, host: PlaceHost, spot: NonNullable<ReturnType<PlaceInterior['freeSeat']>>): void {
    const actor = host.actor;
    let served = false;
    const plate = this.plateFor(c.label);
    this.seatsInUse.add(spot.key);
    const seat = this.world(spot.seat[0], spot.seat[1]);
    const behind = this.world(spot.behind[0], spot.behind[1]);
    const meal = new Sequence(`eat ${c.label}`, [actor]);
    meal.maxSeconds = 150;
    meal.add(
      steps.walk(actor, behind, { ifStuck: 'snap' }),
      steps.face(actor, seat),
      steps.slide(actor, seat, 0.45),
      steps.face(actor, spot.yaw),
      steps.setPose(actor, { legs: 'sit', arms: 'rest' }),
      steps.call('call for the food', () => this.bring(spot, plate, () => { served = true; })),
      steps.until('the food comes', () => served, 45, 'continue'),
      steps.animate(actor, { arms: 'eat' }, c.seconds ?? 5, [{ at: 0.15, run: () => {
        c.effect?.(host.backend);
        if (c.item) host.backend.addItem(c.item);
        if (c.said) host.say(c.said, 'success');
      } }, { at: 0.95, run: () => {
        // The bill, when the plate is empty
        if (c.price && !host.backend.pay(c.price, `${c.label}, ${this.spec.name}`, 'FOOD_PURCHASE')) host.say(`₦${c.price.toLocaleString()} for the ${c.label.toLowerCase()}, and you do not have it. They let it go this time.`, 'warning');
      } }]),
      steps.call('done', () => { plate.removeFromParent(); }),
      steps.setPose(actor, { legs: 'stand', arms: 'rest' }),
      steps.slide(actor, behind, 0.45),
    );
    meal.onEnd(() => {
      plate.removeFromParent();
      this.seatsInUse.delete(spot.key);
    });
    host.director.run(meal);
  }

  /** The server carries the plate from the counter to the table, puts it down, and goes back */
  private bring(spot: NonNullable<ReturnType<PlaceInterior['freeSeat']>>, plate: THREE.Group, done: () => void): void {
    const staff = this.spec.staff[0];
    const from: [number, number] = staff ? [staff.at[0] + Math.sin(staff.facing) * 1.2, staff.at[1] + Math.cos(staff.facing) * 1.2] : [0, -2];
    if (!this.server) {
      const female = (staff?.gender ?? 'female') === 'female';
      this.server = new Figure(this.group, `${this.spec.key}-server`, 'Server', {
        gender: female ? 'female' : 'male', username: '', outfitColor: staff?.outfit ?? 0x15803d,
        outfit: female ? 'casual_blouse' : 'casual_tee', hairstyle: female ? 'braids' : 'short_crop',
      }, from, 0);
      const server = this.server;
      this.ticks.push((delta) => server.tick(delta));
    }
    const server = this.server;
    server.root.visible = true;
    server.place(from[0], from[1]);
    plate.position.set(0, 1.02, 0.36);
    plate.rotation.set(0, 0, 0);
    server.root.add(plate);
    server.walk([spot.server], () => {
      server.face(Math.atan2(spot.plate[0] - spot.server[0], spot.plate[1] - spot.server[1]));
      server.pose('stand', 'reach');
      server.hold(0.6, () => {
        // Down on the table in front of the player
        plate.removeFromParent();
        plate.position.set(spot.plate[0], spot.height + 0.01, spot.plate[1]);
        plate.rotation.y = spot.yaw;
        this.group.add(plate);
        done();
        server.pose('stand', 'rest');
        server.walk([from], () => { server.root.visible = false; });
      });
    }, { arms: 'carry', speed: 1.6 });
  }

  /** The plate of food (and the bottle with it) */
  private plateFor(label: string): THREE.Group {
    const l = label.toLowerCase();
    const food = /jollof|rice|fried rice/.test(l) ? 0xea580c : /amala|ewedu|eba|pounded|semo/.test(l) ? 0x6b4f2a : /okra|soup|vegetable/.test(l) ? 0x4d7c0f
      : /suya|asun|meat|chicken|goat|fish/.test(l) ? 0x7c2d12 : /shawarma|sandwich|bread/.test(l) ? 0xfde68a : /chips|plantain|dodo/.test(l) ? 0xfacc15 : 0xd97706;
    const plate = new THREE.Group();
    plate.name = 'served meal';
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.03, 18), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }));
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: food, roughness: 0.8 }));
    heap.scale.set(1.1, 0.6, 1.1);
    heap.position.y = 0.015;
    plate.add(dish, heap);
    if (/drink|coke|chapman|malt|beer|juice|water|wine|champagne|zobo/.test(l)) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 10), new THREE.MeshStandardMaterial({ color: /coke|malt/.test(l) ? 0x3f1d0b : 0x166534, roughness: 0.3 }));
      bottle.position.set(0.22, 0.12, 0.05);
      plate.add(bottle);
    }
    return plate;
  }

  /** The moment it is done: paid for, the goods in the bag, what it does done */
  private settle(c: StationChoice, host: PlaceHost): boolean {
    if (c.price && !host.backend.pay(c.price, `${c.label}, ${this.spec.name}`, c.item?.category === 'food' ? 'FOOD_PURCHASE' : 'SHOP_PURCHASE')) {
      host.say(`That is ₦${c.price.toLocaleString()}. You do not have enough.`, 'warning');
      return false;
    }
    if (c.item) host.backend.addItem(c.item);
    c.effect?.(host.backend);
    if (c.said) host.say(c.said, 'success');
    return true;
  }

  /** Things in the room that move or change as the game goes on (a show on its stage), each frame */
  public readonly ticks: Array<(delta: number) => void> = [];
  /** Tables to sit at and eat, as built */
  private tables: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; height: number }> = [];
  /** The one who carries a meal to the table: comes out when there is something to bring */
  private server: Figure | null = null;
  /** Seats taken by the player's own meals now, so two orders do not share a chair */
  private seatsInUse = new Set<string>();

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) npc.update(delta, time);
    for (const tick of this.ticks) tick(delta);
  }
}
