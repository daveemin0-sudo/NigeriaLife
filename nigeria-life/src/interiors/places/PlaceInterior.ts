import * as THREE from 'three';
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
}

const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });

/** Opens something of the game's own (set by the game) */
export const PlaceOpeners: { open: (what: string) => void } = { open: () => {} };

export class PlaceInterior {
  public group = new THREE.Group();
  public interactiveList: InteractiveObject[] = [];
  public npcs: InteriorNPCMesh[] = [];
  public def: InteriorDefinition;
  public readonly spec: PlaceSpec;

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
    this.group.add(b.build(`${this.spec.key} furniture`, { roughness: 0.7 }));
    if (this.spec.sign) {
      const board = signBoard([this.spec.sign.text, this.spec.sign.sub], Math.min(width - 4, 10), 1.6, this.spec.sign.bg, '#ffffff');
      board.position.set(0, height - 1.3, -length / 2 + 0.25);
      this.group.add(board);
    }

    const door = InteriorPrefabs.createExitDoor(new THREE.Vector3(0, 0, length / 2), Math.PI);
    this.group.add(door);
    this.interactiveList.push({ mesh: door, id: 'interior_exit_door', name: `Way out of ${this.spec.name}`, category: 'Exit to the road', description: 'Back out to the expressway.', interactionPoint: this.world(0, length / 2 - 1) });

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
            PlaceOpeners.open(c.open);
            return;
          }
          const stand = this.world(st.stand[0], st.stand[1]);
          const look = this.world(st.at[0], st.at[1]);
          if (c.dance) {
            const done = host.director.perform({ id: `${st.id} ${c.label}`, actor: host.actor, point: stand, target: look, animation: { arms: 'rest' }, seconds: 0.3, effect: () => this.settle(c, host) });
            if (done.ok) host.emote('zanku', c.seconds ?? 8);
            return;
          }
          host.director.perform({
            id: `${st.id} ${c.label}`,
            actor: host.actor,
            point: stand,
            target: look,
            animation: { arms: c.arms ?? 'reach', legs: c.sit ? 'sit' : 'stand' },
            seconds: c.seconds ?? 2,
            effectAt: c.sit ? 0.9 : 0.6,
            ifStuck: 'snap',
            effect: () => this.settle(c, host),
          });
        },
      })),
    });
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

  public update(delta: number, time: number): void {
    for (const npc of this.npcs) npc.update(delta, time);
  }
}
