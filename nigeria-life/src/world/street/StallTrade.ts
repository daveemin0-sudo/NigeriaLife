import * as THREE from 'three';
import { PlaceActions, type PlaceHost } from '../../destinations/PlaceActions';
import { clickBox } from '../landmarks/Landmark';
import type { InteractiveObject } from '../World';
import type { StallSells, StallSpot } from './StreetStalls';

/**
 * Roadside stalls you can buy from: the umbrellas already on Lagos side streets and on
 * Abuja's and Port Harcourt's avenues. When the trader has the stall up, the player can
 * walk up and buy what it sells — sachet water and airtime, akara or rice, or suya.
 * Shut stalls say so; nothing is invented behind a closed tarp.
 */

interface Offer {
  label: string;
  note: string;
  price: number;
  /** Toast after a successful buy */
  done: string;
  apply: (host: PlaceHost) => void;
}

const WHO: Record<StallSells, string[]> = {
  goods: ['Chinedu', 'Aisha', 'Tunde', 'Ngozi'],
  food: ['Mama Bisi', 'Alhaja Ronke', 'Mama Chioma', 'Uncle Femi'],
  suya: ['Mallam Ibrahim', 'Mallam Sani', 'Audu', 'Mallam Yusuf'],
};

const ROLE: Record<StallSells, string> = {
  goods: 'Roadside provisions',
  food: 'Roadside food',
  suya: 'Suya grill',
};

const MENU: Record<StallSells, Offer[]> = {
  goods: [
    {
      label: 'Sachet pure water',
      note: '₦200 · +5 Energy',
      price: 200,
      done: 'Cold sachet — oya drink am.',
      apply: (host) => {
        host.backend.modifyNeed('energy', 5);
        host.backend.modifyNeed('hunger', 2);
      },
    },
    {
      label: 'Airtime recharge',
      note: '₦500 · +4 Fun',
      price: 500,
      done: 'Airtime loaded. Your people fit call you now.',
      apply: (host) => {
        host.backend.modifyNeed('fun', 4);
      },
    },
  ],
  food: [
    {
      label: 'Akara wrap',
      note: '₦800 · Hunger +22 · Energy +8',
      price: 800,
      done: 'Hot akara, wrapped in paper. Sharp sharp.',
      apply: (host) => {
        host.backend.eatBite(22, 8, 1);
      },
    },
    {
      label: 'Rice and stew',
      note: '₦1,500 · Hunger +35 · Energy +12',
      price: 1_500,
      done: 'Plate of rice and stew. Chop well.',
      apply: (host) => {
        host.backend.eatBite(35, 12, 2);
      },
    },
  ],
  suya: [
    {
      label: 'Suya stick',
      note: '₦1,200 · Hunger +28 · Fun +8',
      price: 1_200,
      done: 'Pepper suya, fresh off the grill.',
      apply: (host) => {
        host.backend.eatBite(28, 10, 1);
        host.backend.modifyNeed('fun', 8);
      },
    },
  ],
};

function whoAt(sells: StallSells, index: number): string {
  const names = WHO[sells];
  return names[index % names.length];
}

function titleOf(sells: StallSells): string {
  if (sells === 'suya') return 'Suya spot';
  if (sells === 'food') return 'Roadside food stall';
  return 'Roadside provisions stall';
}

export interface StallTradeOptions {
  cityId: string;
  spots: readonly StallSpot[];
  /** Whether stall `i` is currently open for trade */
  isOpen: (i: number) => boolean;
  /** Where click meshes are parented (so they hide with the city) */
  parent: THREE.Object3D;
}

/** Clickables and card actions for every stall in `spots`. Returns the interactive list to push into the city. */
export function wireStallTrade(options: StallTradeOptions): InteractiveObject[] {
  const { cityId, spots, isOpen, parent } = options;
  const cards: InteractiveObject[] = [];
  const group = new THREE.Group();
  group.name = `${cityId} stall trade`;
  parent.add(group);

  spots.forEach((spot, i) => {
    const id = `${cityId}-stall-${i}`;
    const sells = spot.sells;
    const fx = Math.sin(spot.yaw);
    const fz = Math.cos(spot.yaw);
    // Stand in front of the table, facing the trader
    const stand = new THREE.Vector3(spot.x + fx * 1.05, 0, spot.z + fz * 1.05);
    const mesh = clickBox(1.2, 2.0, 1.0);
    mesh.position.set(stand.x, 1.0, stand.z);
    mesh.userData.surface = true;
    group.add(mesh);

    cards.push({
      mesh,
      id,
      name: titleOf(sells),
      category: ROLE[sells],
      description: sells === 'suya'
        ? 'Peppered meat on the grill. Buy a stick when the coals are hot.'
        : sells === 'food'
          ? 'Akara, rice and stew from the pavement pot.'
          : 'Sachet water, airtime and small provisions under the umbrella.',
      interactionPoint: stand.clone(),
    });

    PlaceActions.register(id, {
      label: () => (isOpen(i) ? `🛒 Buy from ${titleOf(sells).toLowerCase()}` : '🔒 Stall closed'),
      run: (host) => {
        if (!isOpen(i)) {
          host.say('The tarp is down. Come back when the trader has opened up.', 'info');
          return;
        }
        const who = whoAt(sells, i);
        const offers = MENU[sells];
        host.ask({
          who,
          role: `${ROLE[sells]} · ${titleOf(sells)}`,
          text: sells === 'suya'
            ? 'Oga, suya dey hot. How many stick you want?'
            : sells === 'food'
              ? 'Customer, food dey ready. What you dey chop?'
              : 'Boss, pure water, recharge — wetin you need?',
          choices: [
            ...offers.map((offer) => ({
              label: offer.label,
              note: offer.note,
              pick: () => {
                if (!host.backend.spendCash(offer.price, `${who}: ${offer.label}`)) {
                  host.say(`You need ₦${offer.price.toLocaleString()} cash for that.`, 'warning');
                  return;
                }
                offer.apply(host);
                host.say(`${offer.done} (−₦${offer.price.toLocaleString()})`, 'success');
              },
            })),
            { label: 'Nothing for now', pick: () => {} },
          ],
        });
      },
    });
  });

  return cards;
}
