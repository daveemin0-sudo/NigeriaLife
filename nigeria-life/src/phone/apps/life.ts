import type { PhoneApp } from '../PhoneApp';
import { esc, naira, row, empty, chips, meter, count } from '../../ui/kit/html';
import { SoundEngine } from '../../audio/SoundEngine';
import { CloudSyncService } from '../../backend/CloudSyncService';
import { HouseDecorationSystem } from '../../housing/HouseDecorationSystem';
import type { RealEstateProperty } from '../../backend/types';

// ============================================================================================
// Jobs
// ============================================================================================

interface Gig {
  id: string;
  name: string;
  icon: string;
  pay: number;
  energy: number;
  cred: number;
  steps: [string, string, string];
}

/** Short pieces of work done step by step. Each costs energy and pays once, when the last step is done. */
const GIGS: Gig[] = [
  { id: 'danfo', name: 'Danfo conductor run', icon: '🚌', pay: 12500, energy: 20, cred: 25, steps: ['Call the passengers', 'Give the right change', 'Drop everyone at the last stop'] },
  { id: 'code', name: 'Code sprint at the hub', icon: '💻', pay: 25000, energy: 30, cred: 35, steps: ['Fix the payment bug', 'Speed up the slow page', 'Ship it'] },
  { id: 'gen', name: 'Generator repair', icon: '🔌', pay: 20000, energy: 25, cred: 30, steps: ['Check the fuel', 'Open the choke', 'Pull the cord'] },
];

const RANKS = [
  { level: 1, at: 0 },
  { level: 2, at: 100 },
  { level: 3, at: 300 },
];

export const jobsApp: PhoneApp = {
  id: 'jobs',
  name: 'Jobs',
  icon: '💼',
  tint: ['#3730a3', '#6366f1'],
  purpose: 'Shifts you can work, the one you are on, and how your career is going',

  badge(host) {
    return host.backend.getActiveJobShift()?.isReady ? 1 : 0;
  },

  live(host) {
    const shift = host.backend.getActiveJobShift();
    return !!shift && !shift.isReady;
  },

  render(host, route) {
    const data = host.backend.getData();
    const career = data.career;

    if (route.startsWith('gig:')) {
      const gig = GIGS.find((entry) => entry.id === route.slice(4));
      if (!gig) return { title: 'Jobs', body: empty('🧰', 'No such work', 'That piece of work is not on offer.') };
      const done = host.get(`gig.${gig.id}`, 0);
      return {
        title: gig.name,
        body: `
          <div class="nl-card">
            <div class="nl-card-title">${gig.icon} ${esc(gig.name)}</div>
            <div class="nl-card-line">Pays ${naira(gig.pay)} cash when all three steps are done. Uses ${gig.energy}% energy (you have ${Math.round(data.stats.energy)}%).</div>
          </div>
          <div class="nl-list">
            ${gig.steps.map((step, index) => row({
              icon: index < done ? '✅' : `${index + 1}`,
              title: esc(step),
              sub: index < done ? 'Done' : index === done ? 'Do this now' : 'After the step before',
              tone: index > done ? 'muted' : 'default',
              attrs: index === done ? `data-act="gig-step" data-arg="${gig.id}" data-gig-step="${index}"` : 'disabled',
              tag: 'button',
            })).join('')}
          </div>
        `,
      };
    }

    const shift = host.backend.getActiveJobShift();
    const next = RANKS.find((rank) => rank.level === career.rankLevel + 1);
    const from = RANKS.find((rank) => rank.level === career.rankLevel)?.at ?? 0;

    return {
      title: 'Jobs',
      body: `
        <div class="nl-hero nl-hero--indigo">
          <span class="nl-hero-label">Rank ${career.rankLevel}</span>
          <span class="nl-hero-title">${esc(career.title)}</span>
          <span class="nl-hero-sub">${career.xp} XP · ${count(career.completedGigs, 'job')} done · paid ×${(career.bonusMultiplier || 1).toFixed(2)}</span>
          ${next
            ? `${meter(((career.xp - from) / (next.at - from)) * 100, 'good')}<span class="nl-hero-sub">${next.at - career.xp} XP to rank ${next.level}</span>`
            : '<span class="nl-hero-sub">Top rank reached</span>'}
        </div>

        ${shift ? `
          <div class="nl-card nl-card--live" id="jobs-active-shift">
            <div class="nl-card-title">${shift.job.icon} ${esc(shift.job.title)}</div>
            <div class="nl-card-line">${esc(shift.job.workplace)}</div>
            ${meter(shift.progress * 100, shift.isReady ? 'good' : 'plain')}
            ${shift.isReady
              ? `<button class="nl-btn nl-btn--primary nl-btn--block" id="btn-claim-shift-salary" data-act="claim">Collect ${naira(Math.round(shift.job.salary * (career.bonusMultiplier || 1)))}</button>`
              : `<div class="nl-card-line" id="jobs-shift-time">${shift.remainingSecs}s left on this shift</div>`}
          </div>` : ''}

        <div class="nl-section">Shifts</div>
        <div class="nl-list" id="jobs-list">
          ${host.backend.getJobs().map((job) => {
            const locked = job.requiredLevel > career.rankLevel;
            const mine = shift?.job.id === job.id;
            const can = !shift && !locked;
            return row({
              icon: job.icon,
              title: esc(job.title),
              sub: `${esc(job.workplace)} · ${job.shiftDuration}s shift${locked ? ` · needs rank ${job.requiredLevel}` : ''}`,
              trailing: `<span class="nl-stack"><strong>${naira(job.salary)}</strong>${
                mine ? '<span class="nl-tag">On it</span>'
                : locked ? '<span class="nl-tag nl-tag--muted">🔒 Rank ' + job.requiredLevel + '</span>'
                : `<button class="nl-btn nl-btn--sm" data-start-job="${esc(job.id)}" data-act="start" data-arg="${esc(job.id)}" ${can ? '' : 'disabled'}>Take shift</button>`}</span>`,
              tone: locked ? 'muted' : 'default',
            });
          }).join('')}
        </div>

        <div class="nl-section">Quick work</div>
        <div class="nl-list">
          ${GIGS.map((gig) => row({ icon: gig.icon, title: esc(gig.name), sub: `Three steps · uses ${gig.energy}% energy`, trailing: `<strong>${naira(gig.pay)}</strong>`, attrs: `data-go="gig:${gig.id}"` })).join('')}
        </div>
      `,
    };
  },

  act(host, action, el) {
    if (action === 'start') {
      const result = host.backend.startJobShift(el.dataset.arg ?? '');
      host.say(result.message, result.success ? 'good' : 'bad');
    } else if (action === 'claim') {
      const result = host.backend.completeJobShift();
      if (result.success) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.success ? 'good' : 'bad');
    } else if (action === 'gig-step') {
      const gig = GIGS.find((entry) => entry.id === el.dataset.arg);
      if (!gig) return;
      const done = host.get(`gig.${gig.id}`, 0);
      if (Number(el.dataset.gigStep) !== done) return;
      if (done < 2) {
        host.set(`gig.${gig.id}`, done + 1);
        host.refresh();
        return;
      }
      // Last step: this is when it pays, once
      host.set(`gig.${gig.id}`, 0);
      const result = host.backend.performGig(gig.pay, gig.energy, gig.name);
      if (result.success) {
        host.backend.addStreetCred(gig.cred);
        SoundEngine.getInstance().playTransactionSuccess();
      }
      host.back();
      host.say(result.success ? `${gig.name} done. ${result.message}` : result.message, result.success ? 'good' : 'bad');
    }
  },
};

// ============================================================================================
// Property
// ============================================================================================

const isMine = (prop: RealEstateProperty) => prop.status === 'owned' || prop.status === 'rented' || prop.status === 'purchased';
const CITY_NAMES: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };

export const propertyApp: PhoneApp = {
  id: 'property',
  aliases: ['houses'],
  name: 'Property',
  icon: '🔑',
  tint: ['#065f46', '#10b981'],
  purpose: 'Homes to rent or buy, and the ones that are yours',

  render(host, route) {
    const data = host.backend.getData();
    const funds = data.bank.balance + data.walletCash;

    if (route.startsWith('p:')) {
      const prop = data.properties.find((entry) => entry.id === route.slice(2));
      if (!prop) return { title: 'Property', body: empty('🏚️', 'Not listed', 'That property is not on the market.') };
      const owned = prop.status === 'owned' || prop.status === 'purchased';
      const rented = prop.status === 'rented';
      const features = prop.perks?.length ? prop.perks : prop.features;
      return {
        title: owned ? 'Your property' : rented ? 'Your lease' : 'For sale or rent',
        body: `
          <div class="nl-card">
            <div class="nl-card-title">${prop.icon} ${esc(prop.name)}</div>
            <div class="nl-card-line">📍 ${esc(prop.location || prop.districtId)} · ${esc(CITY_NAMES[prop.cityId] ?? prop.cityId)} · ${prop.bedrooms} bedroom${prop.bedrooms === 1 ? '' : 's'}</div>
            <div class="nl-card-line">${esc(prop.description)}</div>
            <div class="nl-tags">${features.slice(0, 6).map((f) => `<span class="nl-tag">${esc(f)}</span>`).join('')}</div>
            <div class="nl-stats">
              <span><strong>${naira(prop.purchasePrice)}</strong>to buy</span>
              ${prop.rentalPriceMonthly > 0 ? `<span><strong>${naira(prop.rentalPriceMonthly)}</strong>to lease</span>` : ''}
              <span><strong>${owned ? 'Owned' : rented ? 'Leased' : 'Available'}</strong>status</span>
            </div>
          </div>
          ${owned || rented ? `
            <button class="nl-btn nl-btn--primary nl-btn--block" id="property-go-home" data-act="home">Go home</button>
            <button class="nl-btn nl-btn--block" data-act="decor">Furniture catalogue</button>
            ${owned
              ? `<button class="nl-btn nl-btn--danger nl-btn--block" data-act="sell" data-arg="${esc(prop.id)}">Sell for ${naira(Math.round(prop.purchasePrice * 0.8))}</button>`
              : `<button class="nl-btn nl-btn--danger nl-btn--block" data-act="leave" data-arg="${esc(prop.id)}">Move out</button>
                 <button class="nl-btn nl-btn--block" data-act="buy" data-arg="${esc(prop.id)}" ${funds >= prop.purchasePrice ? '' : 'disabled'}>Buy it outright · ${naira(prop.purchasePrice)}</button>`}
          ` : `
            ${prop.rentalPriceMonthly > 0 ? `<button class="nl-btn nl-btn--primary nl-btn--block" data-phone-rent-prop="${esc(prop.id)}" data-act="rent" data-arg="${esc(prop.id)}" ${funds >= prop.rentalPriceMonthly ? '' : 'disabled'}>Lease · ${naira(prop.rentalPriceMonthly)}</button>` : ''}
            <button class="nl-btn nl-btn--block" data-phone-buy-prop="${esc(prop.id)}" data-act="buy" data-arg="${esc(prop.id)}" ${funds >= prop.purchasePrice ? '' : 'disabled'}>Buy · ${naira(prop.purchasePrice)}</button>
            <div class="nl-hint">You have ${naira(funds)} between your bank account and your cash.${funds < (prop.rentalPriceMonthly || prop.purchasePrice) ? ' That is not enough for this one yet.' : ''}</div>
          `}
        `,
      };
    }

    const filter = host.get<string>('property.filter', 'all');
    const search = host.get('property.search', '').toLowerCase();
    const list = data.properties
      .filter((prop) => (filter === 'all' ? true : filter === 'mine' ? isMine(prop) : prop.cityId === filter))
      .filter((prop) => !search || `${prop.name} ${prop.location ?? ''} ${prop.districtId}`.toLowerCase().includes(search))
      .sort((a, b) => Number(isMine(b)) - Number(isMine(a)) || a.purchasePrice - b.purchasePrice);
    const mine = data.properties.filter(isMine);

    return {
      title: 'Property',
      body: `
        <div class="nl-hero nl-hero--green">
          <span class="nl-hero-label">Your home</span>
          <span class="nl-hero-title">${mine.length ? esc(mine[0].name) : 'No home yet'}</span>
          <span class="nl-hero-sub">${mine.length ? `${count(mine.length, 'property', 'properties')} in your name` : 'Lease or buy one below to have a bed, a sofa and a fridge of your own'}</span>
          ${mine.length ? '<div class="nl-hero-actions"><button class="nl-btn nl-btn--glass" data-act="home">Go home</button></div>' : ''}
        </div>
        ${chips('property.filter', filter, [['all', 'All'], ['mine', 'Mine'], ['lagos', 'Lagos'], ['abuja', 'Abuja'], ['port_harcourt', 'Port Harcourt']])}
        <input class="nl-field nl-field--search" id="property-search" type="search" placeholder="Search by name or area" value="${esc(host.get('property.search', ''))}" data-bind="property.search" />
        <div class="nl-list" id="property-list">
          ${list.length === 0
            ? empty('🏘️', 'Nothing matches', filter === 'mine' ? 'You do not own or lease anything yet.' : 'Try another city or a different search.')
            : list.map((prop) => row({
                icon: prop.icon,
                title: esc(prop.name),
                sub: `${esc(prop.location || prop.districtId)} · ${esc(CITY_NAMES[prop.cityId] ?? prop.cityId)}`,
                trailing: isMine(prop)
                  ? `<span class="nl-tag nl-tag--good">${prop.status === 'rented' ? 'Leased' : 'Owned'}</span>`
                  : `<span class="nl-stack"><strong>${naira(prop.purchasePrice)}</strong>${prop.rentalPriceMonthly > 0 ? `<span class="nl-row-sub">lease ${naira(prop.rentalPriceMonthly)}</span>` : ''}</span>`,
                attrs: `data-go="p:${esc(prop.id)}" data-property="${esc(prop.id)}"`,
              })).join('')}
        </div>
      `,
    };
  },

  async act(host, action, el) {
    const id = el.dataset.arg ?? '';
    const prop = host.backend.getData().properties.find((entry) => entry.id === id);
    if (action === 'home') {
      host.close();
      host.world.goHome();
    } else if (action === 'decor') {
      host.close();
      HouseDecorationSystem.getInstance().openCatalogueModal();
    } else if (action === 'rent' && prop) {
      if (!(await host.confirm(`Lease ${prop.name} for ${naira(prop.rentalPriceMonthly)}?`, 'Lease it'))) return;
      const result = host.backend.rentProperty(id);
      if (result.success) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.success ? 'good' : 'bad');
    } else if (action === 'buy' && prop) {
      if (!(await host.confirm(`Buy ${prop.name} for ${naira(prop.purchasePrice)}?`, 'Buy it'))) return;
      const result = host.backend.buyProperty(id);
      if (result.success) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.success ? 'good' : 'bad');
    } else if (action === 'sell' && prop) {
      if (!(await host.confirm(`Sell ${prop.name} for ${naira(Math.round(prop.purchasePrice * 0.8))}? You will no longer be able to go in.`, 'Sell it'))) return;
      const result = host.backend.sellProperty(id);
      host.say(result.message, result.success ? 'good' : 'bad');
    } else if (action === 'leave' && prop) {
      if (!(await host.confirm(`Move out of ${prop.name}? What you paid for the lease is not refunded.`, 'Move out'))) return;
      const result = host.backend.endLease(id);
      host.say(result.message, result.success ? 'good' : 'bad');
    }
  },
};

// ============================================================================================
// Health and emergencies
// ============================================================================================

const tone = (value: number) => (value < 25 ? 'bad' : value < 50 ? 'warn' : 'good');

export const healthApp: PhoneApp = {
  id: 'health',
  aliases: ['help'],
  name: 'Health',
  icon: '🩺',
  tint: ['#9f1239', '#f43f5e'],
  purpose: 'How you are doing, and help when you are not',

  badge(host) {
    const stats = host.backend.getData().stats;
    return stats.health < 30 || stats.hunger < 15 ? 1 : 0;
  },

  render(host) {
    const data = host.backend.getData();
    const stats = data.stats;
    const hasHome = host.backend.hasHome();
    const serious = stats.health < 40 || stats.hunger <= 0;
    const need = (icon: string, name: string, value: number, advice: string) => `
      <div class="nl-need">
        <span class="nl-need-top"><span>${icon} ${name}</span><strong>${Math.round(value)}%</strong></span>
        ${meter(value, tone(value))}
        <span class="nl-row-sub">${advice}</span>
      </div>`;
    return {
      title: 'Health',
      body: `
        <div class="nl-card" id="health-needs">
          ${need('❤️', 'Health', stats.health, stats.health < 40 ? 'Low. See a doctor, or call an ambulance below.' : stats.hunger < 50 || stats.energy < 40 ? 'Comes back slowly once you have eaten and rested.' : 'You are well.')}
          ${need('🍲', 'Hunger', stats.hunger, stats.hunger < 25 ? 'You need to eat. Order something, or sit down at Mama Put.' : 'You have eaten enough for now.')}
          ${need('⚡', 'Energy', stats.energy, stats.energy < 25 ? (hasHome ? 'You are worn out. Go home and sleep.' : 'You are worn out. Eat something, or rent a place to sleep.') : 'You have energy to work.')}
        </div>
        <div class="nl-section">What helps</div>
        <div class="nl-list">
          ${row({ icon: '🛵', title: 'Order food', sub: 'Brought to wherever you are', attrs: 'data-app="shopping" data-route="food"' })}
          ${hasHome
            ? row({ icon: '🛏️', title: 'Go home and sleep', sub: 'Energy and health come back while you sleep', attrs: 'data-act="home"' })
            : row({ icon: '🔑', title: 'Find a place to sleep', sub: 'You have no home yet', attrs: 'data-app="property"' })}
          ${row({ icon: '🏥', title: 'Ride to the hospital', sub: 'St. Nicholas General, Lagos Island', attrs: 'data-app="ride" data-route="d:dest_lagos_hospital"' })}
        </div>
        <div class="nl-section">Emergency</div>
        <div class="nl-card nl-card--warn">
          <div class="nl-card-title">🚑 Ambulance</div>
          <div class="nl-card-line">${serious
            ? 'Takes you straight to the hospital and treats you on arrival. The bill is ₦3,500, on credit if you cannot pay.'
            : 'For when your health is below 40% or you are starving. You are well enough to get there yourself.'}</div>
          <button class="nl-btn nl-btn--danger nl-btn--block" id="health-ambulance" data-act="ambulance" ${serious ? '' : 'disabled'}>Call an ambulance</button>
        </div>
        <div class="nl-list">
          ${row({ icon: '👮', title: 'Ride to the police station', sub: 'Area Command, Lagos Island. Reports are made at the front desk.', attrs: 'data-app="ride" data-route="d:dest_lagos_police"' })}
        </div>
      `,
    };
  },

  act(host, action) {
    if (action === 'home') {
      host.close();
      host.world.goHome();
    } else if (action === 'ambulance') {
      const stats = host.backend.getData().stats;
      if (stats.health >= 40 && stats.hunger > 0) return host.say('You are well enough to get there yourself.', 'info');
      if (!host.world.ambulance()) return host.say('The ambulance cannot reach you where you are right now.', 'bad');
      host.close();
    }
  },
};

// ============================================================================================
// Settings
// ============================================================================================

const toggle = (id: string, on: boolean, action: string) =>
  `<button class="nl-toggle${on ? ' is-on' : ''}" id="${id}" role="switch" aria-checked="${on}" data-act="${action}"><span></span></button>`;

export const settingsApp: PhoneApp = {
  id: 'settings',
  name: 'Settings',
  icon: '⚙️',
  tint: ['#334155', '#64748b'],
  purpose: 'Sound, your look, and a copy of your saved game',

  render(host) {
    const sound = SoundEngine.getInstance();
    const data = host.backend.getData();
    return {
      title: 'Settings',
      body: `
        <div class="nl-section">Sound</div>
        <div class="nl-list">
          ${row({ icon: '🔊', title: 'Game sound', sub: sound.isMuted ? 'Off' : 'On', trailing: toggle('settings-sound', !sound.isMuted, 'sound') })}
          ${row({ icon: '📻', title: 'Street radio', sub: sound.isRadioActive() ? 'Playing' : 'Off', trailing: toggle('settings-radio', sound.isRadioActive(), 'radio') })}
        </div>
        <div class="nl-section">You</div>
        <div class="nl-list">
          ${row({ icon: '🧑', title: esc(data.username), sub: esc(data.destinyTitle || data.career.title), trailing: '<span class="nl-tag">Profile</span>' })}
          ${row({ icon: '👕', title: 'Change your look', sub: 'Clothes, hair and skin tone', attrs: 'data-act="wardrobe"' })}
        </div>
        <div class="nl-section">Saved game</div>
        <div class="nl-hint">The game saves itself on this device every few seconds. A copy as text lets you move it to another browser.</div>
        <div class="nl-list">
          ${row({ icon: '📋', title: 'Copy my saved game', sub: 'Puts it on the clipboard as text', attrs: 'data-act="export"' })}
        </div>
        <label class="nl-label" for="settings-import">Restore from a copy</label>
        <input class="nl-field" id="settings-import" type="text" placeholder="Paste a saved game here" value="${esc(host.get('settings.import', ''))}" data-bind="settings.import" />
        <button class="nl-btn nl-btn--block" data-act="import">Restore</button>
      `,
    };
  },

  async act(host, action) {
    const sound = SoundEngine.getInstance();
    if (action === 'sound') {
      sound.toggleMute();
      host.refresh();
    } else if (action === 'radio') {
      sound.toggleRadio();
      host.refresh();
    } else if (action === 'wardrobe') {
      host.close();
      host.world.openWardrobe();
    } else if (action === 'export') {
      const text = CloudSyncService.getInstance().exportBackupString();
      try {
        await navigator.clipboard.writeText(text);
        host.say('Your saved game is on the clipboard.', 'good');
      } catch {
        host.say('The browser would not let the game use the clipboard.', 'bad');
      }
    } else if (action === 'import') {
      const text = host.get('settings.import', '').trim();
      if (!text) return host.say('Paste a saved game first.', 'bad');
      if (!(await host.confirm('Replace the game you are playing now with the pasted one?', 'Replace it'))) return;
      const result = CloudSyncService.getInstance().importBackupString(text);
      if (result.success) host.set('settings.import', '');
      host.say(result.message, result.success ? 'good' : 'bad');
    }
  },
};
