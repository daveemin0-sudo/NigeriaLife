import type { PhoneApp } from '../PhoneApp';
import { esc, naira, row, empty } from '../../ui/kit/html';
import { BackendService } from '../../backend/BackendService';
import { profileKey } from '../../backend/Profile';
import type { Item } from '../../backend/types';

/** Real models, at the prices they go for. They go into the bag and stay there. */
const CATALOG: Array<Omit<Item, 'quantity'> & { use: 'play' | 'wear' | 'listen' }> = [
  { id: 'gad_tecno_camon', name: 'Tecno Camon 30', icon: '📱', price: 285000, category: 'electronics', usable: false, description: 'A Tecno Camon 30.', use: 'play' },
  { id: 'gad_iphone_15', name: 'iPhone 15', icon: '📱', price: 1450000, category: 'electronics', usable: false, description: 'An iPhone 15.', use: 'play' },
  { id: 'gad_ps5', name: 'PlayStation 5', icon: '🎮', price: 850000, category: 'electronics', usable: false, description: 'A PlayStation 5. Play it at home.', use: 'play' },
  { id: 'gad_titanium', name: 'Titanium watch', icon: '⌚', price: 420000, category: 'luxury', usable: false, description: 'A titanium watch.', use: 'wear' },
  { id: 'gad_retro', name: 'Retro football cartridge', icon: '🕹️', price: 15000, category: 'electronics', usable: false, description: 'An 8-bit football game.', use: 'play' },
  { id: 'gad_sports_watch', name: 'Sports watch', icon: '⌚', price: 45000, category: 'gadget', usable: false, description: 'A sports watch.', use: 'wear' },
  { id: 'gad_airpods', name: 'AirPods', icon: '🎧', price: 185000, category: 'electronics', usable: false, description: 'AirPods.', use: 'listen' },
  { id: 'gad_mp3', name: 'MP3 player', icon: '🎵', price: 12000, category: 'electronics', usable: false, description: 'An MP3 player.', use: 'listen' },
];

const wornKey = () => profileKey('nl-worn-gadget');

function worn(): string {
  try { return localStorage.getItem(wornKey()) ?? ''; } catch { return ''; }
}

export const gadgetsApp: PhoneApp = {
  id: 'gadgets',
  name: 'Gadgets',
  icon: '⌚',
  tint: ['#0f172a', '#38bdf8'],
  purpose: 'Phones, consoles, watches and players. They go into your bag.',

  render(host) {
    const bag = host.backend.getData().inventory;
    const have = (id: string) => bag.find((item) => item.id === id);
    const wearing = worn();
    return {
      title: 'Gadgets',
      body: `
        <div class="nl-list" id="gadgets-list">
          ${CATALOG.map((item) => {
            const owned = have(item.id);
            const on = wearing === item.id;
            return row({
              icon: item.icon,
              title: esc(item.name),
              sub: owned
                ? (item.use === 'wear' ? (on ? 'In your bag · wearing it' : 'In your bag') : 'In your bag')
                : naira(item.price),
              trailing: owned
                ? `<button class="nl-btn nl-btn--sm" data-act="use" data-arg="${esc(item.id)}">${item.use === 'wear' ? (on ? 'Take off' : 'Wear') : item.use === 'listen' ? 'Listen' : 'Play'}</button>`
                : `<button class="nl-btn nl-btn--sm" data-act="buy" data-arg="${esc(item.id)}">Buy</button>`,
            });
          }).join('')}
        </div>
        ${bag.some((item) => item.id.startsWith('gad_')) ? '' : empty('🛍️', 'Nothing in the bag yet', 'Buy one. It stays in the bag.')}
      `,
    };
  },

  act(host, action, el) {
    const id = el.dataset.arg ?? '';
    const item = CATALOG.find((entry) => entry.id === id);
    if (!item) return;
    if (action === 'buy') {
      const paid = BackendService.getInstance().processTransaction({
        type: 'SHOP_PURCHASE',
        amount: item.price,
        description: item.name,
        source: 'bank',
      });
      if (!paid.success) return host.say(`That is ${item.price.toLocaleString()} naira and you do not have it.`, 'bad');
      host.backend.addItem({
        id: item.id, name: item.name, icon: item.icon, price: item.price,
        category: item.category, usable: false, description: item.description,
      });
      host.say(`${item.name} is in your bag.`, 'good');
      host.refresh();
      return;
    }
    if (!host.backend.getData().inventory.some((entry) => entry.id === id)) return;
    if (item.use === 'play' || item.use === 'listen') {
      if (host.world.where() !== 'inside') return host.say('Take it home and use it there.', 'info');
      host.backend.modifyNeed('fun', item.use === 'play' ? 18 : 10);
      host.say(item.use === 'play' ? `You played ${item.name}.` : `You listened on the ${item.name}.`, 'good');
      return;
    }
    const now = worn();
    try {
      if (now === id) localStorage.removeItem(wornKey());
      else localStorage.setItem(wornKey(), id);
    } catch { /* still worn for this moment */ }
    if (now !== id) host.backend.modifyNeed('social', 4);
    host.say(now === id ? 'Taken off.' : `Wearing the ${item.name}.`, 'good');
    host.refresh();
  },
};
