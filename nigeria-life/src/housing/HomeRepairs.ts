/**
 * Call a tradesperson to the home: electrician, AC technician, plumber or appliance repairer.
 * They arrive, visibly work, a message says the job is done, payment happens at hand-over, then they leave.
 * Money only through BackendService.
 */
import * as THREE from 'three';
import { BackendService } from '../backend/BackendService';
import { PlaceActions, type PlaceHost } from '../destinations/PlaceActions';
import { Figure } from '../interiors/places/Worship';
import type { HumanConfig } from '../graphics/HumanMeshBuilder';
import { Sequence, steps } from '../interactions/Sequence';
import { showGameToast } from '../ui/GameToast';
import type { InteractiveObject } from '../world/World';
import type { HomePlan } from './HomePlan';

export type RepairKind = 'electrician' | 'ac' | 'plumber' | 'appliance';

export interface RepairSpec {
  id: RepairKind;
  title: string;
  name: string;
  icon: string;
  fee: number;
  minutes: number;
  workSaid: string;
  doneSaid: string;
  look: HumanConfig;
}

export const REPAIR_KINDS: readonly RepairSpec[] = [
  {
    id: 'electrician',
    title: 'Electrician',
    name: 'Engr. Tunde',
    icon: '⚡',
    fee: 25_000,
    minutes: 8,
    workSaid: 'He opens the consumer unit, tests the lines, and rewires a loose live.',
    doneSaid: 'Power is steady. He packs his tools.',
    look: {
      gender: 'male',
      username: 'Engr. Tunde',
      skinTone: '#4a2c1a',
      hairstyle: 'fade',
      outfit: 'engineer_vest',
      outfitColor: 0xfacc15,
      trousersColor: 0x1e293b,
    },
  },
  {
    id: 'ac',
    title: 'AC Technician',
    name: 'Chidi Cool',
    icon: '❄️',
    fee: 35_000,
    minutes: 10,
    workSaid: 'He gauges the gas, cleans the filter, and runs the split until the air is cold.',
    doneSaid: 'AC blowing ice. He wipes his hands.',
    look: {
      gender: 'male',
      username: 'Chidi Cool',
      skinTone: '#5c3a21',
      hairstyle: 'low_cut',
      outfit: 'polo_shirt',
      outfitColor: 0x0ea5e9,
      trousersColor: 0x0f172a,
    },
  },
  {
    id: 'plumber',
    title: 'Plumber',
    name: 'Baba Pipe',
    icon: '🔧',
    fee: 22_000,
    minutes: 9,
    workSaid: 'He clears the trap, reseats a washer, and runs the tap until it is clear.',
    doneSaid: 'No more drip. Floor is dry.',
    look: {
      gender: 'male',
      username: 'Baba Pipe',
      skinTone: '#3f2718',
      hairstyle: 'bald',
      outfit: 'mechanic_overalls',
      outfitColor: 0xb45309,
      trousersColor: 0x44403c,
    },
  },
  {
    id: 'appliance',
    title: 'Appliance Repairer',
    name: 'Ada Fridge',
    icon: '🔌',
    fee: 28_000,
    minutes: 9,
    workSaid: 'She opens the panel, swaps a relay, and the fridge hums again.',
    doneSaid: 'Appliance running. She closes her toolbox.',
    look: {
      gender: 'female',
      username: 'Ada Fridge',
      skinTone: '#6b4423',
      hairstyle: 'braids',
      outfit: 'casual_blouse',
      outfitColor: 0x16a34a,
      trousersColor: 0x1e293b,
    },
  },
];

type Visit = {
  kind: RepairKind;
  figure: Figure;
  card: InteractiveObject;
  phase: 'arriving' | 'working' | 'handover' | 'done';
  workLeft: number;
};

export class HomeRepairs {
  private static instance: HomeRepairs | null = null;
  private homeGroup: THREE.Group | null = null;
  private homePlan: HomePlan | null = null;
  private homeInteractive: InteractiveObject[] | null = null;
  private visit: Visit | null = null;
  private readonly listeners = new Set<() => void>();

  public static get(): HomeRepairs {
    if (!HomeRepairs.instance) HomeRepairs.instance = new HomeRepairs();
    return HomeRepairs.instance;
  }

  public onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb();
  }

  public syncHome(group: THREE.Group, plan: HomePlan | null, interactiveList: InteractiveObject[]): void {
    this.homeGroup = group;
    this.homePlan = plan;
    this.homeInteractive = interactiveList;
  }

  public busy(): boolean {
    return !!this.visit && this.visit.phase !== 'done';
  }

  public active(): RepairSpec | null {
    if (!this.visit || this.visit.phase === 'done') return null;
    return REPAIR_KINDS.find((k) => k.id === this.visit!.kind) ?? null;
  }

  /** Call a tradesperson. They appear at the entrance and start work. */
  public call(kind: RepairKind): { ok: boolean; message: string } {
    if (!this.homeGroup || !this.homeInteractive) {
      return { ok: false, message: 'Go home first, then call them to the house.' };
    }
    if (this.busy()) {
      return { ok: false, message: 'Someone is already working here. Wait until they finish.' };
    }
    const spec = REPAIR_KINDS.find((k) => k.id === kind);
    if (!spec) return { ok: false, message: 'Unknown trade.' };

    const entrance = this.homePlan?.entrance ?? { x: 0, z: 11 };
    const start: [number, number] = [entrance.x + 0.4, entrance.z - 1.2];
    const work: [number, number] = [entrance.x - 1.2, entrance.z - 3.5];
    const origin = this.homeGroup.position;
    const figure = new Figure(this.homeGroup, `repair_${kind}`, spec.name, spec.look, start, Math.PI, 0, true);
    const cardId = `repair_home_${kind}`;
    const card: InteractiveObject = {
      id: cardId,
      name: `${spec.name} (${spec.title})`,
      category: 'Home Repair',
      description: `${spec.title} · ₦${spec.fee.toLocaleString()} when the job is done.`,
      mesh: figure.root,
      interactionPoint: new THREE.Vector3(origin.x + start[0], 0, origin.z + start[1] + 0.9),
    };
    this.homeInteractive.push(card);
    this.visit = { kind, figure, card, phase: 'arriving', workLeft: spec.minutes };
    showGameToast(`${spec.icon} ${spec.name} is at the door.`, 'info', 4000);

    figure.walk([work], () => {
      if (!this.visit || this.visit.kind !== kind) return;
      this.visit.phase = 'working';
      figure.pose('stand', 'reach');
      showGameToast(`${spec.icon} ${spec.workSaid}`, 'info', 4500);
      this.emit();
    });

    PlaceActions.register(cardId, {
      label: () => {
        if (!this.visit) return `${spec.icon} ${spec.title}`;
        if (this.visit.phase === 'working') return `${spec.icon} ${spec.name} is working…`;
        if (this.visit.phase === 'handover') return `${spec.icon} Pay ₦${spec.fee.toLocaleString()} · Job done`;
        return `${spec.icon} Speak to ${spec.name}`;
      },
      run: (host: PlaceHost) => this.talk(host, spec),
    });

    this.emit();
    return { ok: true, message: `${spec.name} is on the way into the house.` };
  }

  private talk(host: PlaceHost, spec: RepairSpec): void {
    if (!this.visit || this.visit.kind !== spec.id || !this.homeGroup) return;
    const player = host.actor;
    if (host.director.interrupt(player) === 'locked') return;
    const origin = this.homeGroup.position;
    const [fx, fz] = this.visit.figure.where();
    const standWorld = new THREE.Vector3(origin.x + fx, 0, origin.z + fz + 1.0);
    const figWorld = new THREE.Vector3(origin.x + fx, 0, origin.z + fz);

    if (this.visit.phase === 'working') {
      host.say(`${spec.icon} ${spec.name}: "I dey on am. Small time."`, 'info');
      return;
    }

    if (this.visit.phase === 'handover') {
      const seq = new Sequence(`pay ${spec.name}`, [player, this.visit.figure.actor]).add(
        steps.walk(player, standWorld, { ifStuck: 'snap' }),
        steps.face(player, figWorld),
        steps.face(this.visit.figure.actor, standWorld),
        steps.animate(this.visit.figure.actor, { arms: 'reach' }, 1.0),
        steps.call('pay at hand-over', () => {
          const paid = BackendService.getInstance().pay(spec.fee, `${spec.title}: ${spec.name}`, 'SHOP_PURCHASE');
          if (!paid) {
            host.say(`That is ₦${spec.fee.toLocaleString()} and you do not have it.`, 'warning');
            return false;
          }
          host.say(`${spec.icon} ${spec.doneSaid} Paid ₦${spec.fee.toLocaleString()} at hand-over.`, 'success');
          this.finishVisit(true);
          return true;
        }),
      );
      host.director.run(seq);
      return;
    }

    host.say(`${spec.icon} ${spec.name}: "I just arrive. Make I start."`, 'info');
  }

  private finishVisit(paid: boolean): void {
    if (!this.visit) return;
    const { figure, card, kind } = this.visit;
    const spec = REPAIR_KINDS.find((k) => k.id === kind)!;
    const entrance = this.homePlan?.entrance ?? { x: 0, z: 11 };
    const out: [number, number] = [entrance.x, entrance.z + 0.5];
    this.visit.phase = 'done';
    PlaceActions.unregister(card.id);
    const idx = this.homeInteractive?.findIndex((o) => o.id === card.id) ?? -1;
    if (idx >= 0) this.homeInteractive?.splice(idx, 1);

    figure.walk([out], () => {
      figure.root.visible = false;
      figure.root.removeFromParent();
      if (paid) showGameToast(`${spec.icon} ${spec.name} has left.`, 'info', 3000);
      this.visit = null;
      this.emit();
    });
  }

  public tick(delta: number, inHome: boolean): void {
    if (!this.visit || !inHome) return;
    this.visit.figure.tick(delta);
    const origin = this.homeGroup?.position;
    if (origin) {
      const [fx, fz] = this.visit.figure.where();
      this.visit.card.interactionPoint.set(origin.x + fx, 0, origin.z + fz + 0.9);
    }
    if (this.visit.phase === 'working') {
      this.visit.workLeft -= delta;
      if (this.visit.workLeft <= 0) {
        this.visit.phase = 'handover';
        this.visit.figure.pose('stand', 'wave');
        const spec = REPAIR_KINDS.find((k) => k.id === this.visit!.kind)!;
        showGameToast(`${spec.icon} ${spec.name}: "Job done. Settle me."`, 'success', 4500);
        this.emit();
      }
    }
  }
}
