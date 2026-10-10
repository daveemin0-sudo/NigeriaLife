import * as THREE from 'three';
import { RENDER_LAYERS } from '../InteriorTypes';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { NavGrid } from '../../interactions/NavGrid';
import { Sequence, steps } from '../../interactions/Sequence';
import { BackendService } from '../../backend/BackendService';
import { showGameToast } from '../../ui/GameToast';

/** Where things are in the apartment, relative to the room centre. */
export const HOME = {
  room: { width: 32, length: 26 },
  bed: { root: new THREE.Vector3(10.5, 0, -5.0), side: new THREE.Vector3(7.35, 0, -5.4), top: 1.15 },
  sofa: { seat: new THREE.Vector3(-7.65, 0, 2.5), front: new THREE.Vector3(-9.15, 0, 2.5) },
  tv: new THREE.Vector3(-15.6, 0, 4),
  fridge: { position: new THREE.Vector3(-14.7, 0, 10.6), front: new THREE.Vector3(-13.35, 0, 10.6) },
  drum: { position: new THREE.Vector3(8.5, 0, 0.5), front: new THREE.Vector3(7.1, 0, 0.5) },
};

export type HomeActivity = 'sleeping' | 'watching_tv';

/** What the on-screen status line needs to know about the activity in progress. */
export interface HomeStatus {
  activity: HomeActivity;
  icon: string;
  title: string;
  line: string;
  stopLabel: string;
}

const SLEEP = { energyPerSecond: 9, healthPerSecond: 5, longestSeconds: 14 };
const TV = { energyPerSecond: 2, mostEnergy: 30 };

/**
 * Daily life at home: sleeping in the bed, watching TV from the sofa, eating from the fridge
 * and bathing at the drum. Each is acted out with the shared interaction steps, and what it
 * gives the player arrives while it is happening, not all at once on a click.
 */
export class HomeLife {
  public readonly nav: NavGrid;
  /** Called whenever the current activity starts, progresses or ends */
  public onChange: (() => void) | null = null;

  private readonly group: THREE.Group;
  private readonly origin: THREE.Vector3;
  private readonly director = InteractionDirector.get();
  private readonly backend = BackendService.getInstance();
  private activity: HomeActivity | null = null;
  private elapsed = 0;
  private gained = 0;

  constructor(group: THREE.Group, origin: THREE.Vector3) {
    this.group = group;
    this.origin = origin.clone();
    this.nav = new NavGrid(origin, HOME.room.width, HOME.room.length);
  }

  private world(local: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(this.origin.x + local.x, 0, this.origin.z + local.z);
  }

  public status(): HomeStatus | null {
    const stats = this.backend.getData().stats;
    if (this.activity === 'sleeping') {
      return {
        activity: 'sleeping',
        icon: '🛏️',
        title: 'Sleeping',
        line: `Energy ${Math.round(stats.energy)}% · Health ${Math.round(stats.health)}%`,
        stopLabel: 'Get up',
      };
    }
    if (this.activity === 'watching_tv') {
      return {
        activity: 'watching_tv',
        icon: '📺',
        title: 'Watching the match',
        line: this.gained >= TV.mostEnergy ? 'Fully relaxed' : `Relaxing · Energy ${Math.round(stats.energy)}%`,
        stopLabel: 'Stand up',
      };
    }
    return null;
  }

  private changed(): void {
    this.onChange?.();
  }

  private begin(activity: HomeActivity): void {
    this.activity = activity;
    this.elapsed = 0;
    this.gained = 0;
    this.changed();
  }

  // --- Bed ---------------------------------------------------------------------------------

  /** Walk to the bed, lie down and sleep. Energy and health come back while asleep. */
  public sleep(): boolean {
    const player = this.director.player;
    if (!player || this.director.interrupt(player) === 'locked') return false;
    const lying = { legs: 'lie' as const, arms: 'rest' as const, height: HOME.bed.top };

    const lieDown = new Sequence('lie down', [player]).add(
      steps.walk(player, this.world(HOME.bed.side), { nav: this.nav }),
      steps.face(player, this.world(HOME.bed.root)),
      steps.slide(player, this.world(HOME.bed.root), 0.5),
      steps.face(player, 0),
      steps.setPose(player, lying),
      steps.wait(0.5)
    );
    lieDown.onEnd((reason) => {
      if (reason !== 'done') return;
      player.yaw = 0;
      player.hold = { release: (instant) => this.leaveFurniture(HOME.bed.side, instant) };
      player.setScripted(true);
      player.pose = lying;
      this.begin('sleeping');
    });
    return this.director.run(lieDown);
  }

  // --- Sofa and TV -------------------------------------------------------------------------

  /** Walk to the sofa, sit and watch the match. Sitting there slowly restores a little energy. */
  public watchTv(): boolean {
    const player = this.director.player;
    if (!player || this.director.interrupt(player) === 'locked') return false;
    const facingTv = -Math.PI / 2;

    const sitDown = new Sequence('sit on sofa', [player]).add(
      steps.walk(player, this.world(HOME.sofa.front), { nav: this.nav }),
      steps.face(player, facingTv),
      steps.slide(player, this.world(HOME.sofa.seat), 0.45),
      steps.setPose(player, { legs: 'sit', arms: 'rest' }),
      steps.wait(0.3)
    );
    sitDown.onEnd((reason) => {
      if (reason !== 'done') return;
      player.yaw = facingTv;
      player.hold = { release: (instant) => this.leaveFurniture(HOME.sofa.front, instant) };
      player.setScripted(true);
      player.pose = { legs: 'sit', arms: 'rest' };
      this.begin('watching_tv');
    });
    return this.director.run(sitDown);
  }

  /** Gets the player off the bed or sofa and back on their feet beside it. */
  private leaveFurniture(standAt: THREE.Vector3, instant = false): void {
    const player = this.director.player;
    const was = this.activity;
    this.activity = null;
    this.changed();
    if (!player) return;
    player.hold = null;
    if (instant) {
      player.setScripted(false);
      return;
    }
    if (was === 'sleeping' && this.elapsed > 1) showGameToast('You got up. What you rested, you keep.', 'info', 2600);
    const rise = new Sequence('get up', [player]).locked().add(
      steps.setPose(player, { legs: 'stand', arms: 'rest' }),
      steps.slide(player, this.world(standAt), 0.5)
    );
    if (!this.director.run(rise)) player.setScripted(false);
  }

  /** Ends whatever the player is doing on the bed or sofa (the on-screen button). */
  public stop(): void {
    const player = this.director.player;
    if (player?.hold && this.activity) player.hold.release();
  }

  // --- Fridge ------------------------------------------------------------------------------

  /** The first thing in the bag that can be eaten. */
  private foodInBag(): { id: string; name: string } | null {
    const item = this.backend.getData().inventory.find((entry) => entry.category === 'food' && entry.usable && entry.quantity > 0);
    return item ? { id: item.id, name: item.name } : null;
  }

  /** Walk to the fridge, take out something from the bag and eat it. Uses up exactly one item. */
  public eatFromFridge(): { ok: boolean; reason?: string } {
    const player = this.director.player;
    if (!player) return { ok: false };
    const food = this.foodInBag();
    if (!food) return { ok: false, reason: 'There is no food in your bag to eat. Buy some first.' };
    if (this.director.interrupt(player) === 'locked') return { ok: false };

    const snack = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.12, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 })
    );
    snack.name = 'home_snack';
    const dropSnack = () => {
      if (player.carried === snack) player.letGo();
      snack.removeFromParent();
    };

    const result = this.director.perform([
      {
        id: 'open fridge',
        actor: player,
        point: this.world(HOME.fridge.front),
        target: this.world(HOME.fridge.position),
        nav: this.nav,
        animation: { arms: 'reach' },
        seconds: 0.9,
        // The bag may have been emptied on the walk over
        requires: () => (this.foodInBag()?.id === food.id ? null : 'That food is gone.'),
        effect: () => player.carry(snack),
      },
      {
        id: 'eat it',
        actor: player,
        animation: { arms: 'eat' },
        seconds: 3.2,
        effectAt: 0.7,
        effect: () => {
          const used = this.backend.useItem(food.id);
          if (!used.success) return false;
          showGameToast(`You ate the ${food.name}.`, 'success', 2600);
        },
      },
    ]);
    result.sequence?.onEnd(dropSnack);
    return { ok: result.ok, reason: result.reason };
  }

  // --- Bath --------------------------------------------------------------------------------

  /** Walk to the water drum and take a bucket bath. */
  public bathe(): boolean {
    const player = this.director.player;
    if (!player || this.director.interrupt(player) === 'locked') return false;
    return this.director.perform({
      id: 'bucket bath',
      actor: player,
      point: this.world(HOME.drum.front),
      target: this.world(HOME.drum.position),
      nav: this.nav,
      animation: { arms: 'reach' },
      seconds: 2.4,
      effectAt: 0.75,
      effect: () => {
        this.backend.rest(30, 20);
        showGameToast('Cold bucket bath. Fresh! Energy +30, Health +20.', 'success', 2800);
      },
    }).ok;
  }

  // --- Each frame --------------------------------------------------------------------------

  public update(delta: number): void {
    if (!this.activity) return;
    const before = Math.floor(this.elapsed);
    this.elapsed += delta;
    const stats = this.backend.getData().stats;

    if (this.activity === 'sleeping') {
      this.backend.rest(SLEEP.energyPerSecond * delta, SLEEP.healthPerSecond * delta, false);
      const rested = stats.energy >= 100 && stats.health >= 100;
      if ((rested && this.elapsed > 3) || this.elapsed > SLEEP.longestSeconds) {
        this.backend.rest(0, 0);
        showGameToast('You woke up rested.', 'success', 2600);
        this.elapsed = 0; // already announced; no second message from getting up
        this.stop();
        return;
      }
    } else if (this.gained < TV.mostEnergy) {
      const amount = Math.min(TV.energyPerSecond * delta, TV.mostEnergy - this.gained);
      this.gained += amount;
      this.backend.rest(amount, 0, false);
    }
    // Refresh the status line once a second, not every frame
    if (Math.floor(this.elapsed) !== before) this.changed();
  }

  /** The player has left the apartment: nothing keeps running in an empty room. */
  public playerLeft(): void {
    if (this.activity) this.backend.rest(0, 0);
    this.activity = null;
    this.group.getObjectByName('home_snack')?.removeFromParent();
    this.changed();
  }

  /** Marks a piece of furniture as solid. Coordinates are relative to the room centre. */
  public block(centerX: number, centerZ: number, halfWidth: number, halfLength: number): void {
    this.nav.blockRect(centerX, centerZ, halfWidth, halfLength);
  }

  public toInteriorLayer(object: THREE.Object3D): void {
    object.traverse((child) => child.layers.set(RENDER_LAYERS.INTERIOR));
  }
}
