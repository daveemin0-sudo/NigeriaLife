import type { BackendService } from '../backend/BackendService';
import type { RideService } from './services/RideService';
import type { DeliveryService } from './services/DeliveryService';
import type { MessageService } from './services/MessageService';
import type { Market } from './services/Market';

/** What an app draws: a title for the bar at the top, and the HTML of its screen. */
export interface PhoneScreen {
  title: string;
  body: string;
}

/** What the rest of the game lets the phone do. The phone asks; the game does it. */
export interface PhoneWorld {
  /** The game's own clock, not the computer's */
  clock(): { day: number; hour: number; label: string; date: string; time: string };
  weather(): 'sunny' | 'rainy';
  cityName(): string;
  cityId(): string;
  /** Standing indoors, at the wheel or in the middle of a journey */
  where(): 'street' | 'inside' | 'driving' | 'transit';
  placeName(): string;
  goHome(): void;
  openMap(): void;
  openFlights(): void;
  openCamera(): void;
  openWardrobe(): void;
  openQuests(): void;
  openBag(): void;
  /** Takes the player to hospital by ambulance. False if that cannot happen right now. */
  ambulance(): boolean;
  /** How far the player is from a point in the city, in metres */
  distanceTo(x: number, z: number): number;
  /** Marks a place in the city so it can be found on foot */
  showPlace(x: number, z: number, name: string): void;
  /** Puts a building design on a plot as a preview, to be moved about and confirmed there */
  placeBuilding(plotId: string, typeId: string): void;
  /** Has one of the player's own vehicles brought to the kerb beside them. Returns why not, or null. */
  bringVehicle(vehicleId: string): string | null;
}

/** Everything an app is given to work with. */
export interface PhoneHost {
  backend: BackendService;
  world: PhoneWorld;
  rides: RideService;
  deliveries: DeliveryService;
  messages: MessageService;
  market: Market;
  /** Opens a further screen of the current app (a detail page). Back returns from it. */
  go(route: string): void;
  back(): void;
  openApp(appId: string, route?: string): void;
  close(): void;
  /** Draws the current screen again, keeping its place */
  refresh(): void;
  /** A short notice inside the phone, under the title bar */
  say(text: string, tone?: 'good' | 'bad' | 'info'): void;
  /** Asks the player to confirm something that costs money or cannot be undone */
  confirm(question: string, yes: string): Promise<boolean>;
  /** A value the app keeps while the phone is in use: a search, a filter, an amount typed in */
  get<T>(key: string, initial: T): T;
  set(key: string, value: unknown): void;
}

/** One app on the phone. */
export interface PhoneApp {
  id: string;
  /** Other ids this app answers to (older names that code elsewhere may still use) */
  aliases?: string[];
  name: string;
  icon: string;
  /** Two colours for its tile */
  tint: [string, string];
  /** What it is for, in a few words, for the tile's tooltip */
  purpose: string;
  /** A number for the red dot on its tile, when there is something waiting */
  badge?(host: PhoneHost): number;
  /** `route` is '' for the app's first screen, or whatever was passed to `go` */
  render(host: PhoneHost, route: string): PhoneScreen;
  /** A tap on anything marked `data-act` */
  act?(host: PhoneHost, action: string, el: HTMLElement, route: string): void | Promise<void>;
  /** True while something on screen is counting (a shift, a driver on the way), so it is redrawn each second */
  live?(host: PhoneHost): boolean;
}
