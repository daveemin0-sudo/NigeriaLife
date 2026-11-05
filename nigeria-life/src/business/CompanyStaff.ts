import * as THREE from 'three';
import { HumanMeshBuilder } from '../graphics/HumanMeshBuilder';
import { bakeToGeometry } from '../graphics/MeshBaker';
import type { InteractiveObject } from '../world/World';
import { PlaceActions } from '../destinations/PlaceActions';
import { PlaceOpeners } from '../interiors/places/PlaceInterior';
import { BackendService } from '../backend/BackendService';
import { Companies, ROLES, type Staffer } from './Companies';

/**
 * The people a player has hired, at work at the front of the business: in its colours along
 * the shop front while it is open, the security guard there day and night. Each can be spoken
 * to, and says how the day is going.
 */

const PEOPLE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
/** Along the shop front, either side of the door */
/** Businesses whose staff are drawn inside their own room */
const INSIDE = new Set(['biz_supermarket']);
const SLOTS = [-2.2, 2.2, -3.1, 3.1, -4, 4, -4.9, 4.9, -5.8, 5.8];

interface Hooks {
  /** Lagos's clickable things, to find each business's building and to add the staff to */
  find(id: string): InteractiveObject | undefined;
  add(object: InteractiveObject): void;
  remove(object: InteractiveObject): void;
  hour(): number;
}

export class CompanyStaff {
  public readonly group = new THREE.Group();
  private placed: Array<{ staffer: Staffer; mesh: THREE.Mesh; card: InteractiveObject }> = [];
  private readonly companies = Companies.get();
  private readonly backend = BackendService.getInstance();
  private hooks: Hooks;
  private open: boolean | null = null;
  private shape = '';

  constructor(hooks: Hooks) {
    this.hooks = hooks;
    this.group.name = 'company staff';
    this.companies.subscribe(() => this.refresh());
    this.backend.subscribe(() => this.refresh());
    this.refresh();
  }

  /** Puts everyone where they work, if who works where has changed */
  public refresh(): void {
    const owned = this.backend.getData().businesses.filter((b) => b.owned);
    const shape = owned.map((b) => `${b.id}:${this.companies.staff(b.id).map((s) => s.id).join(',')}`).join('|');
    if (shape === this.shape) return;
    this.shape = shape;
    for (const p of this.placed) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      this.hooks.remove(p.card);
      PlaceActions.unregister(p.card.id);
    }
    this.placed = [];
    const used = new Map<string, number>();
    for (const biz of owned) {
      // A business whose staff work inside it (the supermarket) is seen in there instead
      if (INSIDE.has(biz.id)) continue;
      const building = biz.buildingId ? this.hooks.find(biz.buildingId) : undefined;
      if (!building) continue;
      // Which way the shop faces: from the middle of the building out to its door
      const middle = new THREE.Vector3();
      building.mesh.getWorldPosition(middle);
      const door = building.interactionPoint;
      const out = new THREE.Vector3(door.x - middle.x, 0, door.z - middle.z);
      if (out.lengthSq() < 0.01) out.set(0, 0, 1);
      out.normalize();
      const along = new THREE.Vector3(out.z, 0, -out.x);
      for (const staffer of this.companies.staff(biz.id)) {
        const slot = used.get(biz.buildingId!) ?? 0;
        if (slot >= SLOTS.length) break;
        used.set(biz.buildingId!, slot + 1);
        const role = ROLES[staffer.role];
        const female = staffer.gender === 'female';
        const rig = HumanMeshBuilder.createHuman({
          gender: staffer.gender, username: '', lod: 'street', outfitColor: role.outfit,
          outfit: staffer.role === 'manager' ? 'senator' : female ? 'casual_blouse' : 'casual_tee',
          hairstyle: female ? 'braids' : 'short_crop',
        });
        rig.nameTag.visible = false;
        if (staffer.role === 'security' || staffer.role === 'manager') rig.leftArm.rotation.x = rig.rightArm.rotation.x = 0.15;
        const geo = bakeToGeometry(rig.group);
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, PEOPLE);
        const at = door.clone().addScaledVector(out, -0.6).addScaledVector(along, SLOTS[slot]);
        mesh.position.set(at.x, 0, at.z);
        mesh.rotation.y = Math.atan2(out.x, out.z);
        mesh.castShadow = true;
        mesh.name = `staff ${staffer.name}`;
        this.group.add(mesh);
        const card: InteractiveObject = {
          mesh,
          id: `staff_${staffer.id}`,
          name: `${staffer.name} (${role.title})`,
          category: `Your staff at ${biz.name}`,
          description: role.says,
          interactionPoint: at.clone().addScaledVector(out, 1.3),
        };
        this.hooks.add(card);
        PlaceActions.register(card.id, {
          label: () => `💬 Talk to ${staffer.name.split(' ')[0]}`,
          run: (host) => {
            host.director.perform({
              id: `talk to ${staffer.name}`, actor: host.actor, point: card.interactionPoint, target: mesh.position, animation: { arms: 'talk' }, seconds: 1.4, effectAt: 0.9, ifStuck: 'snap',
              effect: () => {
                const today = this.companies.takenToday(biz.id);
                host.ask({
                  who: staffer.name,
                  role: `${role.title}, ${biz.name}`,
                  text: `${role.says} Taken so far today: ₦${today.toLocaleString()}. Paid ₦${staffer.wage.toLocaleString()} a day, since ${this.companies.dayName(staffer.since)}.`,
                  choices: [
                    { label: 'Open the company', note: 'Staff, branches, reports', pick: () => PlaceOpeners.open(`app:business:b:${biz.id}`) },
                    { label: 'Carry on', pick: () => undefined },
                  ],
                });
                return true;
              },
            });
          },
        });
        this.placed.push({ staffer, mesh, card });
      }
    }
    this.open = null;
    this.update();
  }

  /** Open from 7 in the morning to 9 at night; the security guard stays */
  public update(): void {
    const hour = this.hooks.hour();
    const open = hour >= 7 && hour < 21;
    if (open === this.open) return;
    this.open = open;
    for (const p of this.placed) {
      const there = open || p.staffer.role === 'security';
      if (there === p.mesh.visible) continue;
      // Gone home: not to be spoken to till morning
      p.mesh.visible = there;
      if (there) this.hooks.add(p.card);
      else this.hooks.remove(p.card);
    }
  }
}
