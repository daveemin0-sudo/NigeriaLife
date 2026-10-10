import * as THREE from 'three';
import type { Item } from '../backend/types';
import { BackendService } from '../backend/BackendService';
import type { Actor } from '../interactions/Actor';
import { InteractionDirector, type PerformResult } from '../interactions/InteractionDirector';
import { Sequence, steps } from '../interactions/Sequence';
import { spotNear } from '../interactions/Social';
import { showGameToast } from '../ui/GameToast';

/** One thing a street seller has to offer. */
export interface VendorGood {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  color: number;
  shape: 'packet' | 'bundle' | 'wrap';
  item: Omit<Item, 'quantity'>;
}

export interface StreetVendor {
  /** The seller's first name, for what is said on screen */
  name: string;
  stall: string;
  goods: VendorGood[];
}

function good(
  id: string, name: string, icon: string, price: number, color: number, shape: VendorGood['shape'],
  description: string, category: Item['category'], energyRestore?: number
): VendorGood {
  return {
    id, name, icon, description, price, color, shape,
    item: { id, name, category, icon, description, price, usable: category === 'food', ...(energyRestore !== undefined ? { energyRestore } : {}) },
  };
}

/** Who sells what on the street, by the id of the person the player clicks. */
export const STREET_VENDORS: Record<string, StreetVendor> = {
  'npc-hawker': {
    name: 'Chidi',
    stall: 'Drinks & snacks, from the tray on his head',
    goods: [
      good('water_sachet', 'Chilled Pure Water Sachet', '💧', 100, 0xbae6fd, 'packet', 'Cold sachet water for the afternoon heat.', 'food', 15),
      good('gala_snack', 'Beef Gala Sausage Roll', '🌭', 250, 0xb91c1c, 'packet', 'The legendary King of highway and street snacks.', 'food', 25),
    ],
  },
  'suya-master': {
    name: 'Mallam Bisi',
    stall: 'Suya, hot off the grill',
    goods: [
      good('suya_beef_wrap', 'Beef suya, wrapped', '🥩', 1500, 0x7c2d12, 'wrap', 'Peppered beef suya with onions, wrapped in paper to take away.', 'food', 35),
      good('suya_chicken_wrap', 'Chicken suya, wrapped', '🍗', 2000, 0x9a3412, 'wrap', 'Chicken suya with yaji and tomatoes, wrapped to take away.', 'food', 40),
      good('kilishi_pack', 'Kilishi', '🥓', 1000, 0x57260f, 'packet', 'Thin, dried, spiced beef. Keeps for the road.', 'food', 22),
    ],
  },
  'aunty-ankara': {
    name: 'Mama Nkechi',
    stall: 'Wax print and lace, by the six yards',
    goods: [
      good('ankara_six_yards', 'Ankara, six yards', '🧵', 6000, 0xe11d48, 'bundle', 'Bright wax print, enough for a full outfit.', 'luxury'),
      good('hollandais_wax', 'Hollandais wax, six yards', '👗', 18000, 0x7c3aed, 'bundle', 'Grade one wax for a wedding or an owambe.', 'luxury'),
    ],
  },
};

function goodMesh(entry: VendorGood): THREE.Mesh {
  const geometry = entry.shape === 'bundle'
    ? new THREE.BoxGeometry(0.34, 0.12, 0.26)
    : entry.shape === 'wrap'
    ? new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8)
    : new THREE.BoxGeometry(0.2, 0.06, 0.14);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: entry.color, roughness: 0.7 }));
  if (entry.shape === 'wrap') mesh.rotation.z = Math.PI / 2;
  mesh.name = `vendor_good_${entry.id}`;
  return mesh;
}

/** Why this cannot be bought from this seller right now, or null if it can. */
export function cannotBuy(vendor: Actor, entry: VendorGood): string | null {
  const short = vendor.name.split('(')[0].trim();
  if (vendor.engaged) return `${short} is busy with someone else.`;
  const cash = BackendService.getInstance().getData().walletCash;
  if (cash < entry.price) {
    return `${entry.name} is ₦${entry.price.toLocaleString()}. You have ₦${cash.toLocaleString()} cash, so you need ₦${(entry.price - cash).toLocaleString()} more.`;
  }
  return null;
}

/**
 * Buy something from a seller on the street. The customer walks up, the seller takes the
 * thing out and holds it out, and it is paid for as it changes hands: no money, no goods.
 */
export function buyFromVendor(vendor: Actor, customer: Actor, entry: VendorGood): PerformResult {
  const director = InteractionDirector.get();
  const backend = BackendService.getInstance();
  const short = vendor.name.split('(')[0].trim();
  const blocked = cannotBuy(vendor, entry);
  if (blocked) return { ok: false, reason: blocked };
  if (director.interrupt(customer) === 'locked') return { ok: false, reason: 'busy' };

  const mesh = goodMesh(entry);
  let handedOver = false;

  const sale = new Sequence(`buy ${entry.id}`, [customer, vendor]).add(
    steps.walk(customer, () => spotNear(vendor, customer, 1.05), { ifStuck: 'snap' }),
    steps.face(vendor, () => customer.worldPosition()),
    steps.face(customer, () => vendor.worldPosition()),
    steps.call('price', () => vendor.say(`${entry.name}: ₦${entry.price.toLocaleString()}`, 2.4)),
    // The seller takes it out and holds it out
    steps.animate(vendor, { arms: 'reach' }, 0.9, [{ at: 0.5, run: () => vendor.carry(mesh) }]),
    // The customer takes it: this is the sale
    steps.animate(customer, { arms: 'reach' }, 0.8, [{
      at: 0.55,
      run: () => {
        if (handedOver) return false;
        const paid = backend.spendCash(entry.price, `${entry.name} from ${short}`, entry.item.category === 'food' ? 'FOOD_PURCHASE' : 'SHOP_PURCHASE');
        if (!paid) {
          vendor.say('Oga, your money no reach o.', 2.4);
          return false;
        }
        handedOver = true;
        if (vendor.carried === mesh) vendor.letGo();
        customer.carry(mesh);
        backend.addItem(entry.item, 1);
        showGameToast(`Paid ₦${entry.price.toLocaleString()}. ${entry.name} is in your bag.`, 'success', 3200);
      },
    }]),
    steps.call('thanks', () => vendor.say('Thank you! God bless.', 2.2)),
    steps.wait(1.1),
    steps.call('put away', () => {
      if (customer.carried === mesh) customer.letGo();
      mesh.removeFromParent();
    }),
    steps.face(vendor, vendor.homeYaw)
  );
  // However it ends, the thing is not left floating in anyone's hands
  sale.onEnd(() => {
    if (vendor.carried === mesh) vendor.letGo();
    if (customer.carried === mesh) customer.letGo();
    mesh.removeFromParent();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  if (!director.run(sale)) return { ok: false, reason: 'busy' };
  return { ok: true, sequence: sale };
}
