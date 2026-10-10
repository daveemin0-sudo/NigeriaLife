import { BackendService } from '../backend/BackendService';
import { ContextMenu, type MenuItem } from './kit/ContextMenu';
import { meter, naira, count } from './kit/html';

/** What the player's own menu can ask the game about and ask it to do. */
export interface SelfMenuHooks {
  name(): string;
  where(): 'street' | 'inside' | 'driving' | 'transit';
  /** In the middle of something scripted that cannot be dropped (walking through a door) */
  locked(): boolean;
  /** The kind of building the player is inside, if any */
  interior(): string | null;
  /** A vehicle close enough to get into, by name */
  vehicleNearby(): string | null;
  /** Sitting or lying on something right now */
  seated(): boolean;
  standUp(): void;
  openWardrobe(): void;
  openBag(): void;
  openPhone(app?: string): void;
  openQuests(): void;
  emote(kind: 'wave' | 'greet' | 'zanku' | 'groove' | 'salute'): void;
  getIntoVehicle(): void;
  sleep(): void;
  sitOnSofa(): void;
  sitAtTable(): void;
}

/**
 * The menu that opens when the player clicks their own character: who they are, what they
 * have, and what they can do where they are standing. Things that cannot be done here are
 * still listed, greyed, with the reason.
 */
export class SelfMenu {
  private readonly menu = new ContextMenu('self-menu');
  private readonly backend = BackendService.getInstance();
  private readonly hooks: SelfMenuHooks;

  constructor(hooks: SelfMenuHooks) {
    this.hooks = hooks;
  }

  public get isOpen(): boolean {
    return this.menu.isOpen;
  }

  public close(): void {
    this.menu.close();
  }

  public open(anchor: { x: number; y: number }): void {
    const data = this.backend.getData();
    const stats = data.stats;
    const hooks = this.hooks;
    const where = hooks.where();
    const tone = (value: number) => (value < 25 ? 'bad' : value < 50 ? 'warn' : 'good');

    const busy = hooks.locked() ? 'Finish what you are doing first' : where === 'driving' ? 'Not while driving' : where === 'transit' ? 'Not during a journey' : '';
    const seated = hooks.seated();
    // A wave or a bow can be done from a chair; dancing cannot
    const emote = (id: 'wave' | 'greet' | 'zanku' | 'groove' | 'salute', icon: string, label: string): MenuItem => {
      const why = busy || (seated && id !== 'wave' && id !== 'greet' ? 'Stand up first' : '');
      return { id: `emote-${id}`, icon, label, disabled: !!why, note: why || undefined, run: () => hooks.emote(id) };
    };

    // Sitting and lying down need something to sit or lie on
    const interior = hooks.interior();
    const rest: MenuItem[] = [];
    if (seated) {
      // Already down: the one thing left to do about it is get up
    } else if (interior === 'residence') {
      rest.push({ id: 'rest-sleep', icon: '🛏️', label: 'Sleep in your bed', note: 'Energy and health come back while you sleep', run: () => hooks.sleep() });
      rest.push({ id: 'rest-sofa', icon: '🛋️', label: 'Sit on the sofa', note: 'Watch the match and get your breath back', run: () => hooks.sitOnSofa() });
    } else if (interior === 'restaurant') {
      rest.push({ id: 'rest-table', icon: '🪑', label: 'Sit at a table', note: 'Opens the menu: you sit, and the food is brought', run: () => hooks.sitAtTable() });
    }
    const restWhy = busy
      || (rest.length > 0 ? ''
        : this.backend.hasHome() ? 'Nothing to sit or lie on here. Your bed and sofa are at home.'
        : 'Nothing to sit or lie on here. Mama Put has chairs.');

    const vehicle = hooks.vehicleNearby();
    const vehicleWhy = where === 'driving' ? 'You are already at the wheel'
      : where !== 'street' ? 'There are no vehicles indoors'
      : vehicle ? '' : 'No vehicle close enough. Walk up to one.';
    const owned = data.properties.filter((p) => p.status === 'owned' || p.status === 'rented' || p.status === 'purchased');
    const items = data.inventory.reduce((sum, item) => sum + item.quantity, 0);

    this.menu.open({
      anchor,
      title: hooks.name(),
      subtitle: `${data.career.title} · rank ${data.career.rankLevel} · ⭐ ${Math.round(stats.streetCred)}`,
      header: `
        <div class="nl-menu-needs" id="self-menu-needs">
          <span>❤️ ${Math.round(stats.health)}% ${meter(stats.health, tone(stats.health))}</span>
          <span>🍲 ${Math.round(stats.hunger)}% ${meter(stats.hunger, tone(stats.hunger))}</span>
          <span>⚡ ${Math.round(stats.energy)}% ${meter(stats.energy, tone(stats.energy))}</span>
        </div>`,
      items: [
        { id: 'look', icon: '👕', label: 'Profile & look', note: 'Name, clothes, hair', run: () => hooks.openWardrobe() },
        { id: 'bag', icon: '🎒', label: 'Bag', note: items === 0 ? 'Empty' : count(items, 'thing'), run: () => hooks.openBag() },
        { id: 'money', icon: '💳', label: 'Money', note: `${naira(data.walletCash)} cash · ${naira(data.bank.balance)} in the bank`, run: () => hooks.openPhone('bank') },
        { id: 'needs', icon: '❤️', label: 'Health & needs', note: stats.health < 40 || stats.hunger < 25 ? 'You need looking after' : 'You are doing fine', run: () => hooks.openPhone('health') },
        { id: 'career', icon: '💼', label: 'Work & career', note: `${data.career.xp} XP · ${count(data.career.completedGigs, 'job')} done`, run: () => hooks.openPhone('jobs') },
        { id: 'property', icon: '🏠', label: 'Property', note: owned.length ? owned.map((p) => p.name).join(', ') : 'You have no home yet', run: () => hooks.openPhone('property') },
        { id: 'vehicle', icon: '🚗', label: vehicle ? `Get into the ${vehicle}` : 'Get into a vehicle', disabled: !!vehicleWhy, note: vehicleWhy || 'Walks you round to the driver\'s door', run: () => hooks.getIntoVehicle() },
        {
          id: 'emotes', icon: '🕺', label: 'Emotes', disabled: !!busy, note: busy || undefined,
          items: [
            emote('wave', '👋', 'Wave'),
            emote('greet', '🙏', 'Bow in greeting'),
            emote('zanku', '🔥', 'Zanku'),
            emote('groove', '🎶', 'Groove'),
            emote('salute', '🫡', 'Salute'),
          ],
        },
        seated
          ? { id: 'stand', icon: '🧍', label: 'Get up', disabled: hooks.locked(), note: hooks.locked() ? 'Finish what you are doing first' : undefined, run: () => hooks.standUp() }
          : { id: 'rest', icon: '🪑', label: 'Sit or rest', disabled: !!restWhy, note: restWhy || undefined, items: rest },
      ],
      quick: [
        { id: 'quests', icon: '🎯', label: 'Quests', run: () => hooks.openQuests() },
        { id: 'phone', icon: '📱', label: 'Phone', run: () => hooks.openPhone() },
        { id: 'settings', icon: '⚙️', label: 'Settings', run: () => hooks.openPhone('settings') },
      ],
    });
  }
}
