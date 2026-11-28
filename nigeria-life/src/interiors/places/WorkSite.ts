import * as THREE from 'three';
import type { InteriorNPCDef } from '../InteriorTypes';
import { InteriorNPCMesh } from '../InteriorNPCMesh';
import type { InteractiveObject } from '../../world/World';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import { createHandWork, Shifts, SHIFT_PIECES } from '../../jobs/HandWork';
import { Employment } from '../../jobs/Employment';
import type { WorkSpec } from './PlaceJobs';

/**
 * Work in a room: the one in charge stands there and takes people on, and a shift's tasks are done
 * in turn where they are done. Any room can have it: a place along the road, or the airport's hall.
 */
export interface WorkSite {
  /** The place's key (the ids of the cards are made from it) and its name */
  key: string;
  name: string;
  group: THREE.Group;
  interactiveList: InteractiveObject[];
  addNpc(npc: InteriorNPCMesh): void;
  /** A point of the room's own floor, in the world */
  world(x: number, z: number): THREE.Vector3;
}

export function addWork(site: WorkSite, w: WorkSpec): void {
  const jobs = Employment.get();
  if (!jobs.employer(w.employer)) return;
  const s = w.boss;
  const key = site.key;
  const def: InteriorNPCDef = {
    id: `${key}_boss_${w.employer}`, name: s.name, role: s.title, title: s.title, relativePosition: new THREE.Vector3(s.at[0], 0, s.at[1]), rotationY: s.facing,
    outfitColor: s.outfit, gender: s.gender, hasChefHat: s.chef, hasPoliceCap: s.cap, hasTie: s.tie, dialogueGreeting: s.says, actions: [], light: true,
  };
  const npc = new InteriorNPCMesh(def);
  site.addNpc(npc);
  site.group.add(npc.group);
  // A shift is a few rounds of this work; each round is paid as it is done
  const piece = w.piece ?? 'round';
  let host: PlaceHost | null = null;
  const work = createHandWork({
    employerId: w.employer,
    name: w.shift,
    words: { boss: s.name, theBoss: s.name, says: s.name, role: `${s.title}, ${site.name}`, offer: w.offer, ready: w.ready, piece, done: 'done' },
    rounds: w.tasks.map((t) => ({
      stand: site.world(t.at[0], t.at[1]),
      face: site.world(t.look[0], t.look[1]),
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
  const before = site.world(s.at[0] + Math.sin(s.facing) * 1.3, s.at[1] + Math.cos(s.facing) * 1.3);
  site.interactiveList.push({ mesh: npc.group, id: hire, name: `${s.name} (${s.title})`, category: site.name, description: s.says, interactionPoint: before });
  PlaceActions.register(hire, {
    label: () => (work.onShift ? `🦺 ${s.name}: you are on shift` : work.bossLabel()),
    // Up to them first, face to face, then the talk
    run: (by) => {
      host = by;
      const went = by.director.perform({
        id: `to ${s.name}`, actor: by.actor, point: before, target: site.world(s.at[0], s.at[1]), animation: { arms: 'talk' }, seconds: 0.7, effectAt: 0.2,
        effect: () => {
          work.askBoss(by);
          return true;
        },
      });
      if (!went.ok) work.askBoss(by);
    },
  });

  const first = w.tasks[0];
  const marker = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  marker.position.set(first.look[0], 0.8, first.look[1]);
  site.group.add(marker);
  const shift = `work_${key}_shift_${w.employer}`;
  const title = w.shift.charAt(0).toUpperCase() + w.shift.slice(1);
  site.interactiveList.push({ mesh: marker, id: shift, name: `💼 ${title}`, category: `${jobs.employer(w.employer)!.name}: staff only`, description: jobs.employer(w.employer)!.task, interactionPoint: site.world(first.at[0], first.at[1]) });
  PlaceActions.register(shift, {
    label: () => (work.onShift ? `🦺 On shift: ${Shifts.current?.done ?? 0} of ${Shifts.current?.total ?? SHIFT_PIECES} done` : jobs.isEmployed(w.employer) ? `💼 Start a shift: ${w.shift} · ₦${Math.round(work.rate() * Employment.payBoost()).toLocaleString()} each` : `💼 ${title} (ask ${s.name} for work)`),
    run: (by) => {
      host = by;
      work.startShift(by);
    },
  });
}
