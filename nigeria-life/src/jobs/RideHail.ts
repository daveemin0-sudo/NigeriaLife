/**
 * Driving for Eko Rides: the player at the wheel of a car takes people where they are going and
 * is paid per trip. A request comes in for someone waiting at a bus stop; arrows on the road lead
 * there; the car pulls up at the kerb and the one at the front of the queue walks to the door and
 * gets in; arrows lead to where they asked for; the car stops, they get out and walk off, and the
 * fare (less the app's cut) is paid. Then the next request. It runs while the player is online.
 */

export interface RideHailStop {
  index: number;
  /** Where a car pulls up for it, in the kerb lane */
  x: number;
  z: number;
  name: string;
}

export interface RideHailHooks {
  /** The car the player is driving now, or null when they are not at a wheel (or not in Lagos) */
  car(): { x: number; z: number; speed: number; yaw: number } | null;
  stops(): RideHailStop[];
  waiting(stop: number): number;
  /** The car is pulled up at this stop (in the kerb lane beside it) */
  atStop(x: number, z: number): number;
  board(stop: number, doorX: number, doorZ: number, onBoard: () => boolean): boolean;
  places(): Array<{ name: string; x: number; z: number }>;
  /** Directions on the road; false if there is no way there by road */
  guide(to: { x: number; z: number }, name: string, arrived: () => void): boolean;
  stopGuide(): void;
  pay(amount: number, what: string): void;
  say(text: string, kind: 'info' | 'success' | 'warning'): void;
  /** The passenger gets out of the car standing here (heading `yaw`), on the kerb side, and walks off */
  alight(x: number, z: number, yaw: number): void;
  random?: () => number;
}

type Stage = 'off' | 'finding' | 'pickup' | 'boarding' | 'riding';

interface Trip {
  stop: RideHailStop;
  who: string;
  to: { name: string; x: number; z: number };
  metres: number;
  fare: number;
  /** The directions to where they are now going have finished (close by) */
  near: boolean;
  told: boolean;
}

const NAMES = ['Ada', 'Tunde', 'Ngozi', 'Emeka', 'Funmi', 'Bayo', 'Chioma', 'Segun', 'Aisha', 'Kelechi', 'Yemi', 'Ifeoma', 'Musa', 'Bisi', 'Dayo', 'Zainab'];
/** What the driver keeps of a fare, after the app's cut */
const DRIVER_SHARE = 0.8;

export class RideHail {
  private stage: Stage = 'off';
  private timer = 0;
  private trip: Trip | null = null;
  private pulledUp: { x: number; z: number } | null = null;
  private noCar = 0;
  private boardFor = 0;
  /** Trips done and what was earned while online today */
  public trips = 0;
  public earned = 0;

  private readonly hooks: RideHailHooks;

  constructor(hooks: RideHailHooks) {
    this.hooks = hooks;
  }

  public get online(): boolean {
    return this.stage !== 'off';
  }

  public get current(): Readonly<Trip> | null {
    return this.trip;
  }

  public get where(): Stage {
    return this.stage;
  }

  /** One line on how it is going, for the phone */
  public status(): string {
    if (this.stage === 'off') return this.trips ? `Offline · ${this.trips} trip${this.trips === 1 ? '' : 's'} · ₦${this.earned.toLocaleString()} earned` : 'Offline';
    const t = this.trip;
    if (this.stage === 'finding') return `Online · looking for a passenger · ${this.trips} done, ₦${this.earned.toLocaleString()}`;
    if (!t) return 'Online';
    if (this.stage === 'pickup' || this.stage === 'boarding') return `Picking up ${t.who} at ${t.stop.name}`;
    return `Taking ${t.who} to ${t.to.name} · ₦${t.fare.toLocaleString()}`;
  }

  /** Goes online: null, or why it cannot */
  public goOnline(): string | null {
    if (this.stage !== 'off') return null;
    if (!this.hooks.car()) return 'Get behind the wheel of a car first: Eko Rides is for drivers.';
    this.stage = 'finding';
    this.timer = 3;
    this.hooks.say('🟢 You are online with Eko Rides. A request will come in soon.', 'success');
    return null;
  }

  public goOffline(why?: string): void {
    if (this.stage === 'off') return;
    const carrying = this.stage === 'riding';
    this.stage = 'off';
    this.trip = null;
    this.hooks.stopGuide();
    this.hooks.say(why ?? (carrying ? 'Offline. Your passenger got out and found another ride.' : `⚪ Offline. ${this.trips} trip${this.trips === 1 ? '' : 's'}, ₦${this.earned.toLocaleString()} today.`), 'info');
  }

  /** The directions were closed by hand: the trip is given up, still online */
  public guideCancelled(): void {
    if (this.stage === 'pickup' || this.stage === 'boarding' || this.stage === 'riding') {
      this.hooks.say(this.stage === 'riding' ? `${this.trip?.who ?? 'The passenger'} got out, not happy. Trip cancelled.` : 'Request turned down.', 'warning');
      this.trip = null;
      this.stage = 'finding';
      this.timer = 6;
    }
  }

  public update(delta: number): void {
    if (this.stage === 'off') return;
    const car = this.hooks.car();
    // Out of the car for a while: offline
    if (!car) {
      this.noCar += delta;
      if (this.noCar > 8) this.goOffline(this.stage === 'riding' ? 'You left the car: your passenger got out. Offline with Eko Rides.' : 'You left the car. Offline with Eko Rides.');
      return;
    }
    this.noCar = 0;

    if (this.stage === 'finding') {
      this.timer -= delta;
      if (this.timer <= 0) this.offer(car);
      return;
    }
    const trip = this.trip;
    if (!trip) {
      this.stage = 'finding';
      return;
    }
    if (this.stage === 'pickup') {
      // Pulled up at the kerb by the stop, stopped: the passenger comes to the door
      if (Math.abs(car.speed) < 0.6 && this.hooks.atStop(car.x, car.z) === trip.stop.index) {
        const side = Math.sign(car.x) || 1;
        this.pulledUp = { x: car.x, z: car.z };
        const asked = this.hooks.board(trip.stop.index, car.x + side * 1.1, car.z, () => {
          const now = this.hooks.car();
          // Someone already in, or this trip given up: they stay at the stop
          if (this.trip !== trip || (this.stage !== 'boarding' && this.stage !== 'pickup')) return false;
          if (!now || !this.pulledUp || Math.hypot(now.x - this.pulledUp.x, now.z - this.pulledUp.z) > 3) {
            this.stage = 'pickup';
            return false;
          }
          this.inside(trip);
          return true;
        });
        if (!asked) {
          this.hooks.say(`Nobody is waiting at ${trip.stop.name} any more. Looking for another ride.`, 'info');
          this.hooks.stopGuide();
          this.trip = null;
          this.stage = 'finding';
          this.timer = 4;
          return;
        }
        this.stage = 'boarding';
        this.boardFor = 0;
        this.hooks.say(`${trip.who} has seen you and is coming to the car.`, 'info');
      } else if (!trip.told && Math.hypot(car.x - trip.stop.x, car.z - trip.stop.z) < 16) {
        trip.told = true;
        this.hooks.say(`Pull up at the kerb by the stop and stop: ${trip.who} is waiting.`, 'info');
      }
      return;
    }
    if (this.stage === 'boarding') {
      this.boardFor += delta;
      // Drove off before they got in, or they could not get to the car: try again from the kerb
      const droveOff = this.pulledUp && Math.hypot(car.x - this.pulledUp.x, car.z - this.pulledUp.z) > 4 && this.boardFor > 0.5;
      if (droveOff || this.boardFor > 30) {
        if (!droveOff) this.hooks.say(`${trip.who} could not get to the car. Pull up right by the stop.`, 'warning');
        this.stage = 'pickup';
        trip.told = false;
      }
      return;
    }
    if (this.stage === 'riding') {
      const there = Math.hypot(car.x - trip.to.x, car.z - trip.to.z);
      if ((trip.near || there < 25) && there < 30 && Math.abs(car.speed) < 0.8) this.arrive(trip, car);
    }
  }

  /** A request: someone waiting at a stop, going somewhere a good drive away */
  private offer(car: { x: number; z: number }): void {
    const rand = this.hooks.random ?? Math.random;
    const stops = this.hooks.stops().filter((s) => this.hooks.waiting(s.index) > 0);
    const places = this.hooks.places();
    if (!stops.length || !places.length) {
      this.timer = 8;
      return;
    }
    // A stop not too far: the nearest few, one of them
    stops.sort((a, b) => Math.hypot(a.x - car.x, a.z - car.z) - Math.hypot(b.x - car.x, b.z - car.z));
    const stop = stops[Math.floor(rand() * Math.min(3, stops.length))];
    // A proper drive (most Lagos trips are a few kilometres), else anything not round the corner
    const within = (lo: number, hi: number) => places.filter((p) => {
      const d = Math.hypot(p.x - stop.x, p.z - stop.z);
      return d > lo && d < hi;
    });
    const long = within(600, 6000);
    const far = long.length ? long : within(250, 6000);
    const to = (far.length ? far : places)[Math.floor(rand() * (far.length || places.length))];
    const metres = Math.round(Math.hypot(to.x - stop.x, to.z - stop.z) * 1.25);
    const fare = Math.round(((700 + metres * 0.55) * DRIVER_SHARE) / 50) * 50;
    const who = NAMES[Math.floor(rand() * NAMES.length)];
    const trip: Trip = { stop, who, to, metres, fare, near: false, told: false };
    if (!this.hooks.guide({ x: stop.x, z: stop.z }, `Pick up ${who} · ${stop.name}`, () => undefined)) {
      this.timer = 6;
      return;
    }
    this.trip = trip;
    this.stage = 'pickup';
    this.hooks.say(`📱 Eko Rides: ${who} at ${stop.name}, going to ${to.name} · ${(metres / 1000).toFixed(1)} km · ₦${fare.toLocaleString()} for you. Follow the arrows.`, 'success');
  }

  private inside(trip: Trip): void {
    this.stage = 'riding';
    trip.near = false;
    this.hooks.say(`${trip.who} gets in: "${trip.to.name}, abeg. Thank you!"`, 'info');
    const guided = this.hooks.guide({ x: trip.to.x, z: trip.to.z }, `${trip.who} to ${trip.to.name}`, () => {
      trip.near = true;
      this.hooks.say(`This is ${trip.to.name}. Stop and let ${trip.who} out.`, 'info');
    });
    if (!guided) trip.near = true;
  }

  private arrive(trip: Trip, car: { x: number; z: number; yaw: number }): void {
    this.hooks.stopGuide();
    this.hooks.alight(car.x, car.z, car.yaw);
    this.hooks.pay(trip.fare, `Eko Rides: ${trip.who} to ${trip.to.name}`);
    this.trips += 1;
    this.earned += trip.fare;
    this.hooks.say(`${trip.who} gets out: "Thank you, driver!" ★★★★★ · ₦${trip.fare.toLocaleString()} paid to you.`, 'success');
    this.trip = null;
    this.stage = 'finding';
    this.timer = 8 + (this.hooks.random ?? Math.random)() * 6;
  }
}
