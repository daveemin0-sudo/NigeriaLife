import * as THREE from 'three';
import { Builder, signBoard } from '../kit/ArchKit';
import { clickBox, type Landmark } from './Landmark';
import { Employment } from '../../jobs/Employment';
import { createHandWork } from '../../jobs/HandWork';
import { PLACE_HOURS, isOpen, clockTime } from '../../destinations/Hours';
import { RENDER_LAYERS } from '../../interiors/InteriorTypes';

/**
 * The yard of a building site, where the block work is done: a pallet of sandcrete blocks
 * by the way in, a footing where a wall is going up, a mason laying it, and a supervisor who
 * takes hands on. The work is carrying a course of blocks from the pallet to the wall, one
 * at a time; each is seen on the wall where it was set, and the wall grows a course with
 * every piece of work until that bay is up to height.
 *
 * It is drawn with the street on its west side.
 */

const HALF_X = 5.6;
const HALF_Z = 3.5;
const BLOCKS = 6;
const COURSES = 4;
const BLOCK = { long: 0.9, high: 0.36, thick: 0.3 };
const FOOTING = 0.12;
const WALL_Z = 2.75;
const PALLET = { x: -3.3, z: -1.7 };

export interface BuildingSiteOptions {
  /** The employer's id in `Employment`, and the id of the yard */
  id: string;
  name: string;
  /** The middle of the yard */
  x: number;
  z: number;
  /** The card of the site itself, where one already stands in the street: it sends people to the yard */
  siteCardId?: string;
}

export function createBuildingSite(options: BuildingSiteOptions): Landmark {
  const jobs = Employment.get();
  const site = { x: options.x, z: options.z };
  const at = (x: number, z: number) => new THREE.Vector3(site.x + x, 0, site.z + z);
  const hours = PLACE_HOURS.buildingSite;
  let hour = 12;

  const b = new Builder().around(site.x, site.z);
  const X = (x: number) => site.x + x;
  const Z = (z: number) => site.z + z;
  const person = (x: number, z: number, shirt: number, hat: number) => {
    b.box(0x1f2937, 0.42, 0.8, 0.3, X(x), 0, Z(z));
    b.box(shirt, 0.5, 0.62, 0.34, X(x), 0.8, Z(z));
    b.box(0x6b4226, 0.3, 0.3, 0.3, X(x), 1.43, Z(z));
    b.box(hat, 0.4, 0.16, 0.4, X(x), 1.73, Z(z));
  };

  // --- The yard: trodden earth, the footing of the wall, and what a block gang works with ---
  b.ground(0xb8a888, HALF_X * 2, HALF_Z * 2, X(0), 0.02, Z(0));
  b.box(0x9ca3af, 6.4, FOOTING, 0.6, X(0.25), 0, Z(WALL_Z));
  // Line pins at each end of the wall, with the line between them
  for (const x of [-3.05, 3.55]) b.box(0x7c2d12, 0.08, 1.9, 0.08, X(x), 0, Z(WALL_Z));
  b.box(0xfacc15, 6.6, 0.02, 0.02, X(0.25), 1.6, Z(WALL_Z));
  // The pallet, with blocks under the ones that will be carried
  b.box(0x92400e, 1.5, 0.14, 1.3, X(PALLET.x), 0, Z(PALLET.z));
  b.box(0x9ca3af, 1.2, 0.36, 0.92, X(PALLET.x + 1.7), 0, Z(PALLET.z));
  b.box(0x9ca3af, 1.2, 0.36, 0.92, X(PALLET.x + 1.7), 0.36, Z(PALLET.z + 0.05));
  // Mortar on a board by the wall, a heap of sand, a drum of water, a wheelbarrow
  b.box(0x78716c, 0.9, 0.06, 0.9, X(4.3), 0.3, Z(1.4)).box(0x57534e, 0.6, 0.14, 0.6, X(4.3), 0.36, Z(1.4));
  for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) b.box(0x44403c, 0.08, 0.3, 0.08, X(4.3 + dx), 0, Z(1.4 + dz));
  b.cone(0xd6b370, 1.1, 0.8, X(3.9), 0, Z(-2.2), 8);
  b.cylinder(0x1d4ed8, 0.32, 0.9, X(5), 0, Z(-0.6));
  b.box(0x15803d, 0.9, 0.3, 0.6, X(1.6), 0.35, Z(-2.4)).box(0x18181b, 0.12, 0.4, 0.4, X(1.05), 0, Z(-2.4)).box(0x44403c, 0.7, 0.05, 0.05, X(2.3), 0.5, Z(-2.65)).box(0x44403c, 0.7, 0.05, 0.05, X(2.3), 0.5, Z(-2.15));
  // Posts and tape along the pavement, with the way in between
  for (const z of [-3.3, -2.6, 0.9, 3.3]) b.box(0xf97316, 0.1, 1.1, 0.1, X(-HALF_X + 0.1), 0, Z(z));
  b.box(0xfde047, 0.03, 0.08, 0.7, X(-HALF_X + 0.1), 0.9, Z(-2.95)).box(0xfde047, 0.03, 0.08, 2.4, X(-HALF_X + 0.1), 0.9, Z(2.1));
  // The mason at the wall, and the supervisor by the way in
  person(4.4, 2.2, 0x9a3412, 0xfacc15);
  const supervisorAt = { x: -4.3, z: 1.9 };
  person(supervisorAt.x, supervisorAt.z, 0xf97316, 0xf8fafc);
  // Posts for the board
  for (const z of [1.2, 3.2]) b.box(0x44403c, 0.1, 3, 0.1, X(-HALF_X + 0.25), 0, Z(z));

  const group = b.build(options.id);
  group.position.set(site.x, 0, site.z);

  const board = signBoard([options.name.toUpperCase(), 'Hands wanted for block work: see the supervisor'], 2.3, 0.9, '#f8fafc', '#9a3412');
  board.position.set(-HALF_X + 0.19, 2.5, 2.2);
  board.rotation.y = -Math.PI / 2;
  group.add(board);

  // --- The blocks: six to carry, and the wall they go into ---------------------------------
  const blockShape = new THREE.BoxGeometry(BLOCK.long, BLOCK.high, BLOCK.thick);
  const blockLook = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.95 });
  const streetLayer = (object: THREE.Object3D) => object.traverse((child) => child.layers.set(RENDER_LAYERS.STREET));
  const blocks: THREE.Mesh[] = [];
  /** Where each waits on the pallet: three across, two high, lying end-on to whoever lifts them. The top three are lifted first. */
  const onPallet = (index: number) => new THREE.Vector3(PALLET.x + ((index % 3) - 1) * 0.4, 0.14 + BLOCK.high / 2 + (index < 3 ? BLOCK.high : 0), PALLET.z);
  for (let i = 0; i < BLOCKS; i++) {
    const block = new THREE.Mesh(blockShape, blockLook);
    block.castShadow = true;
    block.userData.surface = true;
    blocks.push(block);
  }
  /** The wall so far, as one thing however many blocks are in it */
  const wall = new THREE.InstancedMesh(blockShape, blockLook, BLOCKS * COURSES);
  wall.count = 0;
  wall.castShadow = true;
  wall.userData.surface = true;
  wall.frustumCulled = false;
  group.add(wall);
  /** Where a block sits in the wall: each course half a block along from the one below, as blocks are bonded */
  const inWall = (course: number, slot: number) => new THREE.Vector3(-2.2 + slot * 0.94 + (course % 2 ? 0.3 : 0), FOOTING + BLOCK.high / 2 + course * BLOCK.high, WALL_Z);
  const matrix = new THREE.Matrix4();
  let courses = 0;

  const blocksToThePallet = (carrier?: { carried: THREE.Object3D | null; letGo(): void }) => {
    if (carrier && blocks.includes(carrier.carried as THREE.Mesh)) carrier.letGo();
    blocks.forEach((block, index) => {
      block.removeFromParent();
      group.add(block);
      block.position.copy(onPallet(index));
      block.rotation.set(0, Math.PI / 2, 0);
      block.visible = true;
      streetLayer(block);
    });
  };
  blocksToThePallet();

  const work = createHandWork({
    employerId: options.id,
    name: 'lay a course of blocks',
    words: {
      boss: 'Supervisor Amaka',
      theBoss: 'the supervisor',
      says: 'Supervisor',
      role: options.name,
      offer: 'We want hands for the block work',
      ready: 'The pallet is by the way in.',
      piece: 'course',
      done: 'laid',
    },
    count: BLOCKS,
    lift: (i) => ({
      stand: at(onPallet(i).x, PALLET.z + 1.05),
      face: Math.PI,
      take: (actor) => {
        blocks[i].removeFromParent();
        blocks[i].rotation.set(0, 0, 0);
        actor.carry(blocks[i]);
      },
    }),
    set: (i) => ({
      stand: at(inWall(courses, i).x, WALL_Z - 0.95),
      face: 0,
      put: (actor) => {
        actor.letGo();
        blocks[i].visible = false;
        matrix.makeTranslation(inWall(courses, i).x, inWall(courses, i).y, inWall(courses, i).z);
        wall.setMatrixAt(courses * BLOCKS + i, matrix);
        wall.count = courses * BLOCKS + i + 1;
        wall.instanceMatrix.needsUpdate = true;
      },
    }),
    cannotStart: () => (isOpen(hours, hour) ? null : `Supervisor: "We have knocked off for the day. Work starts at ${clockTime(hours.opens)}."`),
    began: () => {
      // A bay that is up to height is finished: the gang starts the next from its footing
      if (courses >= COURSES) {
        courses = 0;
        wall.count = 0;
      }
    },
    ended: (paid, host) => {
      if (paid) courses += 1;
      // A course left half laid is taken down again: nothing was paid for it
      else wall.count = courses * BLOCKS;
      blocksToThePallet(host.actor);
    },
  });

  // --- What can be done here --------------------------------------------------------------
  const supervisorId = `${options.id}-supervisor`;
  const blocksId = `${options.id}-blocks`;
  const supervisorBox = clickBox(1.2, 2, 1.2);
  supervisorBox.position.set(supervisorAt.x, 1, supervisorAt.z);
  const palletBox = clickBox(3.4, 1.6, 1.6);
  palletBox.position.set(PALLET.x + 0.8, 0.8, PALLET.z);
  supervisorBox.userData.surface = true;
  palletBox.userData.surface = true;
  group.add(supervisorBox, palletBox);
  const employer = jobs.employer(options.id);
  const effort = employer?.energy ?? 0;

  return {
    id: options.id,
    name: options.name,
    zone: { minX: site.x - HALF_X - 0.2, maxX: site.x + HALF_X + 0.2, minZ: site.z - HALF_Z - 0.2, maxZ: site.z + HALF_Z + 0.2 },
    group,
    obstructions: b.obstructions(options.name, site.x, site.z),
    interactive: [
      {
        mesh: supervisorBox,
        id: supervisorId,
        name: 'Supervisor Amaka',
        category: 'Building site · Work',
        description: `Runs the block work. She takes hands on: ${work.terms()}.`,
        interactionPoint: at(supervisorAt.x + 1.2, supervisorAt.z - 0.6),
      },
      {
        mesh: palletBox,
        id: blocksId,
        name: 'Pallet of blocks',
        category: 'Building site · Work',
        description: `Carry ${BLOCKS} blocks from the pallet to the wall, one at a time: that is a course. Paid when the last is laid, at the rate of your grade, and it takes ${effort}% of your energy. For those the supervisor has taken on. Work is from ${clockTime(hours.opens)} to ${clockTime(hours.closes)}.`,
        interactionPoint: at(PALLET.x, PALLET.z + 1.5),
      },
    ],
    actions: {
      ...(options.siteCardId
        ? {
            [options.siteCardId]: {
              label: () => '👷 Ask at the site about work',
              run: (host) => host.say(jobs.isEmployed(options.id) ? 'Watchman: "Morning. The block gang is in the yard, on the south side."' : 'Watchman: "They want hands for the block work. See the supervisor in the yard, on the south side."', 'info'),
            },
          }
        : {}),
      [supervisorId]: {
        label: () => work.bossLabel(),
        run: (host) => work.askBoss(host),
      },
      [blocksId]: {
        label: () => {
          if (!jobs.isEmployed(options.id)) return '🧱 Hands wanted: ask the supervisor';
          if (work.working) return `🧱 Laying: ${work.setDown} of ${BLOCKS} down`;
          if (!isOpen(hours, hour)) return `🧱 Knocked off. Work starts at ${clockTime(hours.opens)}`;
          return `🧱 Lay a course: ${BLOCKS} blocks (₦${work.rate().toLocaleString()})`;
        },
        run: (host) => work.start(host),
      },
    },
    doors: [{ name: `Way in to the yard of ${options.name}`, x: site.x - HALF_X - 1, z: site.z - 0.8 }],
    update(_delta, now) {
      hour = now;
    },
    status: () => ({
      working: work.working,
      setDown: work.setDown,
      paidRuns: work.paid,
      courses,
      inWall: wall.count,
      onPallet: blocks.filter((block) => block.parent === group && block.visible).length,
      employed: jobs.isEmployed(options.id),
      grade: jobs.grade(options.id)?.title ?? null,
      rate: work.rate(),
      done: jobs.done(options.id),
      open: isOpen(hours, hour),
    }),
  };
}
