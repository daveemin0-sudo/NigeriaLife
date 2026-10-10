import * as THREE from 'three';
import { NavGrid } from '../../interactions/NavGrid';
import { InteractionDirector } from '../../interactions/InteractionDirector';
import { Sequence, steps } from '../../interactions/Sequence';
import type { Actor } from '../../interactions/Actor';
import { BackendService } from '../../backend/BackendService';
import { profileKey } from '../../backend/Profile';
import type { PlaceHost } from '../../destinations/PlaceActions';
import { type OpeningHours, isOpen, clockTime } from '../../destinations/Hours';

/** Where everything stands in the club, measured from the middle of the room. The door is in the south wall. */
export const CLUB = {
  name: 'Quilox',
  room: { width: 20, length: 16, height: 4.6 },
  hours: { opens: 20, closes: 5 } as OpeningHours,
  gateFee: 5000,
  desk: { x: 5.2, z: 5.6, halfWidth: 1.3, halfLength: 0.45 },
  deskStand: new THREE.Vector3(5.2, 0, 6.8),
  cashier: new THREE.Vector3(5.2, 0, 4.6),
  floor: { x: -1, z: -1, halfWidth: 4, halfLength: 3.5 },
  /** Kept clear of the other dancers, for the player */
  floorSpot: new THREE.Vector3(-1, 0, 1.4),
  booth: { x: -1, z: -6.7, halfWidth: 2.6, halfLength: 0.8 },
  bar: { x: 7.4, z: -2.5, halfWidth: 0.45, halfLength: 3.6 },
  barStand: new THREE.Vector3(6.3, 0, -2.5),
  barman: new THREE.Vector3(8.5, 0, -2.5),
  sofa: { x: -8.6, z: -3, halfWidth: 0.6, halfLength: 1.6 },
  sofaStand: new THREE.Vector3(-7.4, 0, -3),
  sofaSeat: new THREE.Vector3(-8.7, 0, -3),
};

export interface Drink {
  id: string;
  name: string;
  price: number;
  energy: number;
  cred: number;
  /** Buying it gets the buyer a seat in the lounge for the night */
  table?: boolean;
  colour: number;
}

export const DRINKS: Drink[] = [
  { id: 'malt', name: 'Cold malt', price: 1500, energy: 10, cred: 0, colour: 0x7c2d12 },
  { id: 'chapman', name: 'Chapman', price: 2500, energy: 14, cred: 1, colour: 0xdc2626 },
  { id: 'bubbly', name: 'Bottle of bubbly with sparklers', price: 25000, energy: 8, cred: 12, table: true, colour: 0xfde68a },
];

const DANCE_SECONDS = 9;
const DANCE_CRED = 3;
const DANCE_ENERGY = 6;
/** A night's dancing only does so much for a name */
const DANCES_THAT_COUNT = 4;

interface Night {
  /** The night the gate fee was paid for */
  paid: number;
  /** The night a table was bought for */
  table: number;
  dancedOn: number;
  dances: number;
}

/**
 * Runs the club: the gate fee at the desk, drinks at the bar, the dance floor and the lounge.
 * Money changes hands at the desk and across the bar, at the moment of the hand-over and
 * once only. The fee is for one night, which runs from opening to closing.
 */
export class ClubService {
  public readonly nav: NavGrid;
  /** Told when the music stops and everyone is sent home */
  public onClosingTime: (() => void) | null = null;

  private readonly group: THREE.Group;
  private readonly origin: THREE.Vector3;
  private readonly director = InteractionDirector.get();
  private readonly backend = BackendService.getInstance();
  private cashier: Actor | null = null;
  private barman: Actor | null = null;
  /** The game's clock in hours since the game began (day x 24 + hour) */
  private clock: () => number = () => 22;
  private night: Night = { paid: -1, table: -1, dancedOn: -1, dances: 0 };
  private serving = false;
  private dancing = 0;
  private dancer: PlaceHost | null = null;
  private playerInside = false;
  private sentHome = false;

  constructor(group: THREE.Group, origin: THREE.Vector3) {
    this.group = group;
    this.origin = origin.clone();
    this.nav = new NavGrid(origin, CLUB.room.width, CLUB.room.length);
    this.nav.blockRect(CLUB.desk.x, CLUB.desk.z, CLUB.desk.halfWidth, CLUB.desk.halfLength);
    this.nav.blockRect(CLUB.booth.x, CLUB.booth.z, CLUB.booth.halfWidth, CLUB.booth.halfLength);
    this.nav.blockRect(CLUB.bar.x, CLUB.bar.z, CLUB.bar.halfWidth, CLUB.bar.halfLength);
    this.nav.blockRect(CLUB.sofa.x, CLUB.sofa.z, CLUB.sofa.halfWidth, CLUB.sofa.halfLength);
    try {
      const saved = JSON.parse(localStorage.getItem(profileKey('nigeria_life_club_v1')) || 'null');
      if (saved && typeof saved.paid === 'number') this.night = { ...this.night, ...saved };
    } catch {
      // A night out that cannot be read back is simply forgotten
    }
  }

  public connect(clock: () => number): void {
    this.clock = clock;
  }

  public setStaff(cashier: Actor, barman: Actor): void {
    this.cashier = cashier;
    this.barman = barman;
  }

  private world(point: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(this.origin.x + point.x, 0, this.origin.z + point.z);
  }

  private save(): void {
    try {
      localStorage.setItem(profileKey('nigeria_life_club_v1'), JSON.stringify(this.night));
    } catch {
      // Storage full or shut off: the night is still good until the page is closed
    }
  }

  // --- The night --------------------------------------------------------------------------

  private get hour(): number {
    return ((this.clock() % 24) + 24) % 24;
  }

  /** Which night it is: the hours after midnight belong to the night that began the evening before. */
  private get tonight(): number {
    return Math.floor((this.clock() - CLUB.hours.closes) / 24);
  }

  public get open(): boolean {
    return isOpen(CLUB.hours, this.hour);
  }

  public get paid(): boolean {
    return this.night.paid === this.tonight;
  }

  public get hasTable(): boolean {
    return this.night.table === this.tonight;
  }

  // --- The desk ---------------------------------------------------------------------------

  public deskLabel(): string {
    return this.paid ? '✅ You are in for the night' : `🎟️ Pay the gate fee (₦${CLUB.gateFee.toLocaleString()})`;
  }

  public payAtDesk(host: PlaceHost): void {
    if (this.paid) {
      host.say('You have paid for tonight. The bar is on your right and the floor is straight ahead.', 'info');
      return;
    }
    if (this.director.interrupt(host.actor) === 'locked') return;
    this.director.perform({
      id: 'pay the gate fee',
      actor: host.actor,
      point: this.world(CLUB.deskStand),
      target: this.world(CLUB.cashier),
      nav: this.nav,
      animation: { arms: 'reach' },
      seconds: 1.1,
      effectAt: 0.6,
      effect: () => {
        if (this.paid) return;
        if (!this.backend.pay(CLUB.gateFee, `Gate fee, ${CLUB.name}`)) {
          host.say(`The gate fee is ₦${CLUB.gateFee.toLocaleString()}. You do not have it.`, 'warning');
          return false;
        }
        this.night.paid = this.tonight;
        this.save();
        this.cashier?.say('Enjoy your night.');
        host.say(`Gate fee paid. You are in until ${clockTime(CLUB.hours.closes)}.`, 'success');
      },
    });
  }

  private turnedAway(host: PlaceHost): boolean {
    if (this.paid) return false;
    host.say('Pay the gate fee at the desk by the door first.', 'warning');
    return true;
  }

  // --- The bar ----------------------------------------------------------------------------

  public barLabel(): string {
    return '🍹 Order at the bar';
  }

  public askAtBar(host: PlaceHost): void {
    if (this.turnedAway(host)) return;
    if (this.serving) return;
    host.ask({
      who: 'Tunde',
      role: `Barman, ${CLUB.name}`,
      text: 'What are you having?',
      choices: DRINKS.map((drink) => ({
        label: drink.name,
        note: `₦${drink.price.toLocaleString()}`,
        pick: () => this.order(host, drink),
      })),
    });
  }

  /** The barman makes it, and it is paid for as he hands it over. */
  public order(host: PlaceHost, drink: Drink): boolean {
    const barman = this.barman;
    if (!barman || this.serving || this.turnedAway(host)) return false;
    if (this.director.interrupt(host.actor) === 'locked') return false;
    const player = host.actor;

    const glass = new THREE.Mesh(
      drink.table ? new THREE.CylinderGeometry(0.07, 0.09, 0.36, 10) : new THREE.CylinderGeometry(0.06, 0.05, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: drink.colour, roughness: 0.3 })
    );
    const putAway = () => {
      if (barman.carried === glass) barman.letGo();
      if (player.carried === glass) player.letGo();
      glass.removeFromParent();
    };

    this.serving = true;
    const round = new Sequence(`a ${drink.name} at the bar`, [player, barman]).add(
      steps.walk(player, this.world(CLUB.barStand), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(player, this.world(CLUB.barman)),
      // He turns to the shelf behind him and comes back with it
      steps.face(barman, Math.PI / 2),
      steps.animate(barman, { arms: 'reach' }, 0.9, [{ at: 0.7, run: () => barman.carry(glass) }]),
      steps.face(barman, this.world(CLUB.barStand)),
      steps.animate(barman, { arms: 'reach' }, 0.8, [{
        at: 0.6,
        run: () => {
          if (!this.backend.pay(drink.price, `${drink.name}, ${CLUB.name}`, 'FOOD_PURCHASE')) {
            host.say(`${drink.name} is ₦${drink.price.toLocaleString()}. You do not have it.`, 'warning');
            return false;
          }
          this.backend.rest(drink.energy, 0);
          barman.letGo();
          player.carry(glass);
          if (drink.cred) this.backend.addStreetCred(drink.cred);
          if (drink.table) {
            this.night.table = this.tonight;
            this.save();
          }
        },
      }]),
      steps.animate(player, { arms: 'eat' }, 2.4),
      steps.call('finished', () => {
        host.say(drink.table ? `${drink.name}: the lounge is yours tonight. Street cred +${drink.cred}.` : `${drink.name}. Energy +${drink.energy}.`, 'success');
      })
    );
    round.onEnd(() => {
      putAway();
      this.serving = false;
    });
    if (!this.director.run(round)) {
      this.serving = false;
      return false;
    }
    return true;
  }

  // --- The floor --------------------------------------------------------------------------

  public floorLabel(): string {
    return '🕺 Get on the dance floor';
  }

  public dance(host: PlaceHost): void {
    if (this.turnedAway(host)) return;
    if (this.director.interrupt(host.actor) === 'locked') return;
    const result = this.director.perform({
      id: 'onto the dance floor',
      actor: host.actor,
      point: this.world(CLUB.floorSpot),
      target: this.world(new THREE.Vector3(CLUB.booth.x, 0, CLUB.booth.z)),
      nav: this.nav,
      ifStuck: 'snap',
      animation: { arms: 'wave' },
      seconds: 0.5,
    });
    result.sequence?.onEnd((reason) => {
      if (reason !== 'done') return;
      host.emote('zanku', DANCE_SECONDS);
      this.dancing = DANCE_SECONDS;
      this.dancer = host;
    });
  }

  private onTheFloor(actor: Actor): boolean {
    const here = actor.worldPosition();
    return Math.abs(here.x - this.origin.x - CLUB.floor.x) <= CLUB.floor.halfWidth && Math.abs(here.z - this.origin.z - CLUB.floor.z) <= CLUB.floor.halfLength;
  }

  // --- The lounge -------------------------------------------------------------------------

  public loungeLabel(): string {
    return this.hasTable ? '🛋️ Sit at your table' : '🔒 Lounge tables go with a bottle from the bar';
  }

  public sitInLounge(host: PlaceHost): void {
    if (this.turnedAway(host)) return;
    if (!this.hasTable) {
      host.say('The lounge is for tables. Buy a bottle at the bar and one is yours for the night.', 'info');
      return;
    }
    const actor = host.actor;
    if (this.director.interrupt(actor) === 'locked') return;
    const facingRoom = Math.PI / 2;
    const sit = new Sequence('sit in the lounge', [actor]).add(
      steps.walk(actor, this.world(CLUB.sofaStand), { nav: this.nav, ifStuck: 'snap' }),
      steps.face(actor, facingRoom),
      steps.slide(actor, this.world(CLUB.sofaSeat), 0.4, { legs: 'sit', arms: 'rest' }),
      steps.wait(0.2)
    );
    sit.onEnd((reason) => {
      if (reason !== 'done') return;
      actor.yaw = facingRoom;
      actor.hold = {
        release: (instant) => {
          actor.hold = null;
          actor.pose = { legs: 'stand', arms: 'rest' };
          if (!instant) {
            const stand = this.world(CLUB.sofaStand);
            actor.setWorldPosition(stand.x, stand.z);
          }
          actor.setScripted(false);
        },
      };
      actor.setScripted(true);
      actor.pose = { legs: 'sit', arms: 'rest' };
    });
    this.director.run(sit);
  }

  // --- Coming and going -------------------------------------------------------------------

  public playerEntered(): void {
    this.playerInside = true;
    this.sentHome = false;
  }

  public playerLeft(): void {
    this.playerInside = false;
    this.dancing = 0;
    this.dancer = null;
    this.serving = false;
  }

  public update(delta: number): void {
    // A dance that is seen through counts for something, a few times a night
    if (this.dancing > 0 && this.dancer) {
      this.dancing -= delta;
      if (this.dancing <= 0) {
        const host = this.dancer;
        this.dancer = null;
        if (this.onTheFloor(host.actor)) {
          if (this.night.dancedOn !== this.tonight) {
            this.night.dancedOn = this.tonight;
            this.night.dances = 0;
          }
          if (this.night.dances < DANCES_THAT_COUNT && this.backend.depleteEnergy(DANCE_ENERGY)) {
            this.night.dances += 1;
            this.save();
            this.backend.addStreetCred(DANCE_CRED);
            host.say(`The floor liked that. Street cred +${DANCE_CRED}, energy -${DANCE_ENERGY}%.`, 'success');
          } else {
            host.say('Good dancing. You have made your name on this floor for tonight.', 'info');
          }
        }
      }
    }

    // Closing time: the lights come up and everyone goes home
    if (this.playerInside && !this.open && !this.sentHome) {
      this.sentHome = true;
      this.onClosingTime?.();
    }
  }

  /** What is going on, in plain values, for anything that wants to show or check it. */
  public status(): Record<string, unknown> {
    return {
      open: this.open,
      hour: this.hour,
      paid: this.paid,
      table: this.hasTable,
      serving: this.serving,
      dancing: this.dancing > 0,
      dancesCounted: this.night.dancedOn === this.tonight ? this.night.dances : 0,
      inside: this.playerInside,
    };
  }

  /** The room this service runs, for whoever builds what is in it. */
  public get room(): THREE.Group {
    return this.group;
  }
}
