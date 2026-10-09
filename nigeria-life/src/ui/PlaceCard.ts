import type { InteractiveObject } from '../world/World';
import type { InteriorDefinition, InteriorType } from '../interiors/InteriorTypes';
import { UIStateManager } from './UIStateManager';

const PLACE_ICONS: Record<InteriorType, string> = {
  hospital: '🏥',
  bank: '🏦',
  restaurant: '🍲',
  police: '🚓',
  residence: '🏠',
  shop: '🛍️',
  office: '🏢',
  university: '🎓',
  airport: '✈️',
};

/** Short names for the shortcut chips. Anything not listed falls back to the object's own name. */
const SPOT_CHIPS: Record<string, { icon: string; label: string }> = {
  hosp_reception: { icon: '📋', label: 'Reception' },
  hosp_doctor_desk: { icon: '🩺', label: 'Doctor' },
  hosp_ward_bed: { icon: '🛏️', label: 'Ward bed' },
  hosp_pharmacy: { icon: '💊', label: 'Pharmacy' },
  bank_atm_station: { icon: '🏧', label: 'ATM' },
  bank_teller_station: { icon: '💱', label: 'Teller' },
  bank_manager_desk: { icon: '💼', label: 'Loans desk' },
  buka_food_counter: { icon: '🍲', label: 'Food counter' },
  buka_table_vip: { icon: '🪑', label: 'Free table' },
  police_front_desk: { icon: '📝', label: 'Front desk' },
  police_holding_cell: { icon: '⚖️', label: 'Holding cell' },
  unilag_lecture_podium: { icon: '🎓', label: 'Lecture hall' },
  unilag_library_desk: { icon: '📚', label: 'Library' },
  unilag_admin_portal: { icon: '🗂️', label: 'Registration' },
  unilag_quad_gist: { icon: '💬', label: 'Student quad' },
  airport_checkin_desk: { icon: '🎫', label: 'Check-in' },
  airport_security_gate: { icon: '🛡️', label: 'Security' },
  airport_flight_abuja: { icon: '🛫', label: 'Gate 1 · Abuja' },
  airport_flight_ph: { icon: '🛫', label: 'Gate 2 · Port Harcourt' },
  airport_vip_lounge: { icon: '🥂', label: 'VIP lounge' },
  'flat-tv': { icon: '📺', label: 'TV' },
  'flat-bed': { icon: '🛏️', label: 'Bed' },
  'flat-drum': { icon: '🚿', label: 'Water drum' },
};

export interface PlaceCardHooks {
  /** The interior the player is in, and what can be used there */
  getPlace: () => { def: InteriorDefinition; objects: InteractiveObject[] } | null;
  /** Walk to an object and open it */
  goTo: (obj: InteractiveObject) => void;
  leave: () => void;
}

/**
 * The bar shown while inside a building: where you are, a shortcut to every station and
 * person in the room, and the way out. One tap walks the player there, no keyboard needed.
 */
export class PlaceCard {
  private el: HTMLDivElement;
  private hooks: PlaceCardHooks;

  constructor(hooks: PlaceCardHooks) {
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.id = 'place-card';
    this.el.className = 'place-card';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);

    UIStateManager.getInstance().onModeChange((mode) => {
      if (mode === 'interior') {
        this.render();
      } else {
        this.el.style.display = 'none';
      }
    });
  }

  private chipFor(obj: InteractiveObject): { icon: string; label: string } {
    const known = SPOT_CHIPS[obj.id];
    if (known) return known;
    if (obj.id.startsWith('interior_npc_')) {
      // "Nurse Chidinma (Senior Triage Nurse)" -> "Nurse Chidinma"
      const short = obj.name.split('(')[0].trim().split(/\s+/).slice(0, 2).join(' ');
      return { icon: '💬', label: short };
    }
    return { icon: '📍', label: obj.name };
  }

  private render(): void {
    const place = this.hooks.getPlace();
    if (!place) {
      this.el.style.display = 'none';
      return;
    }

    const spots = place.objects.filter((o) => o.id !== 'interior_exit_door');
    const stations = spots.filter((o) => !o.id.startsWith('interior_npc_'));
    const people = spots.filter((o) => o.id.startsWith('interior_npc_'));

    this.el.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'place-card-head';

    const icon = document.createElement('span');
    icon.className = 'place-icon';
    icon.textContent = PLACE_ICONS[place.def.type] ?? '📍';

    const titles = document.createElement('div');
    titles.className = 'place-titles';
    const name = document.createElement('span');
    name.className = 'place-name';
    name.textContent = place.def.name;
    const sub = document.createElement('span');
    sub.className = 'place-sub';
    sub.textContent = `${place.def.districtName} · ${stations.length} thing${stations.length === 1 ? '' : 's'} to do · ${people.length} ${people.length === 1 ? 'person' : 'people'} here`;
    titles.append(name, sub);

    const leave = document.createElement('button');
    leave.className = 'place-leave-btn';
    leave.id = 'place-leave-btn';
    leave.textContent = '🚪 Leave';
    leave.addEventListener('click', () => this.hooks.leave());

    head.append(icon, titles, leave);

    const chips = document.createElement('div');
    chips.className = 'place-chips';
    for (const obj of [...stations, ...people]) {
      const { icon: chipIcon, label } = this.chipFor(obj);
      const chip = document.createElement('button');
      chip.className = obj.id.startsWith('interior_npc_') ? 'place-chip place-chip-person' : 'place-chip';
      chip.dataset.spot = obj.id;
      chip.title = obj.name;
      const chipIconEl = document.createElement('span');
      chipIconEl.className = 'place-chip-icon';
      chipIconEl.textContent = chipIcon;
      const chipLabel = document.createElement('span');
      chipLabel.textContent = label;
      chip.append(chipIconEl, chipLabel);
      chip.addEventListener('click', () => this.hooks.goTo(obj));
      chips.appendChild(chip);
    }

    this.el.append(head, chips);
    this.el.style.display = 'flex';
  }
}
