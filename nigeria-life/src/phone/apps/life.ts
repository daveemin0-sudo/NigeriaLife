import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { areaName, bandOf, hasLight, homeArea, hourWords, hoursOfLight, nextChange, BAND_HOURS, type Band } from '../../life/Grid';
import { theme, setTheme } from '../../ui/theme/Theme';
import { esc, naira, row, empty, chips, meter, count } from '../../ui/kit/html';
import { SoundEngine } from '../../audio/SoundEngine';
import { MusicPlayer } from '../../audio/MusicPlayer';
import { noticesEnabled, setNotices } from '../../ui/GameToast';
import { Employment, EMPLOYERS, WORKSITES } from '../../jobs/Employment';
import { Qualifications } from '../../life/Qualifications';
import { WORKPLACE } from '../../interiors/places/PlaceJobs';
import { Shifts } from '../../jobs/HandWork';
import { CareerShift } from '../../jobs/CareerShift';
import { PlaceOpeners } from '../../interiors/places/PlaceInterior';
import { Deeds } from '../../realestate/Deeds';
import { ServerLink, SERVER_URL, rememberServer } from '../../realestate/ServerLink';
import { AssetMarket } from '../../realestate/AssetMarket';
import { CloudSyncService } from '../../backend/CloudSyncService';
import { HouseDecorationSystem } from '../../housing/HouseDecorationSystem';
import { DrivableVehicle } from '../../world/DrivableVehicle';
import { LagosStreetLifeSystem } from '../../world/LagosStreetLifeSystem';
import { OnlineAccount } from '../../online/OnlineAccount';
import type { RealEstateProperty, PlayerSkills } from '../../backend/types';
import { Dues, dayLabel } from '../../life/Dues';

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

interface SkillMeta {
  key: keyof PlayerSkills;
  name: string;
  icon: string;
  desc: string;
  activity: string;
}

const SKILL_METAS: SkillMeta[] = [
  { key: 'coding', name: 'Coding', icon: '💻', desc: 'Software engineering, algorithms & fintech APIs', activity: 'CcHUB Innovation Lab' },
  { key: 'charisma', name: 'Charisma', icon: '🗣️', desc: 'Negotiation, public speaking & VIP networking', activity: 'High Society Events' },
  { key: 'music', name: 'Music', icon: '🎵', desc: 'Afrobeats rhythm, sound mixing & live brass', activity: 'New Afrika Shrine' },
  { key: 'hustle', name: 'Hustle', icon: '💼', desc: 'Street commerce, bargaining & container trade', activity: 'Balogun Wholesale Market' },
  { key: 'fitness', name: 'Fitness', icon: '🏋️', desc: 'Athletic endurance, strength & agility', activity: 'i-Fitness Gym Lekki' },
  { key: 'cooking', name: 'Cooking', icon: '🍲', desc: 'Traditional Nigerian cuisine, buka recipes & spices', activity: 'Amala Shitta Surulere' },
  { key: 'craft', name: 'Craft', icon: '🛠️', desc: 'Mechanical repair, masonry & styling arts', activity: 'Artisan Workshop' },
  { key: 'driving', name: 'Driving', icon: '🚗', desc: 'Commercial navigation, route mastery & piloting', activity: 'Broad St Transit Terminal' },
  { key: 'academics', name: 'Academics', icon: '📚', desc: 'University research, analytics & medicine', activity: 'UNILAG Campus Akoka' },
];

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

function leftWords(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest}s` : `${minutes} min`;
}

/** What Collect pays. Signed in, the server pays the wage. A rank bonus is added only on this device. */
function collectPay(salary: number, bonus: number): number {
  return Math.round(salary * (OnlineAccount.get() ? 1 : (bonus || 1)));
}

/**
 * The server clocks the shift first. Only then does the phone start it.
 * If the server cannot be reached, the shift runs on the phone and can be paid once the server answers.
 * A refusal (unknown work, not at a site) does not start a shift that can never be paid.
 */
async function beginShift(host: PhoneHost, id: string): Promise<void> {
  const online = OnlineAccount.get();
  if (online) {
    const started = await online.startGig(`career:${id}`);
    if (!started.ok && started.status !== 0) {
      host.say(started.reason ?? 'The server did not start the shift.', 'bad');
      return;
    }
    if (!started.ok) host.say('The server could not be reached. This shift runs on the phone, and it can be paid once the server answers.', 'info');
  }
  const result = host.backend.startJobShift(id);
  host.say(result.message, result.success ? 'good' : 'bad');
  if (result.success) CareerShift.started(id);
}

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
              ? `<button class="nl-btn nl-btn--primary nl-btn--block" id="btn-claim-shift-salary" data-act="claim">Collect ${naira(collectPay(shift.job.salary, career.bonusMultiplier))}</button>`
              : `<div class="nl-card-line" id="jobs-shift-time">${leftWords(shift.remainingSecs)} left on this shift</div>`}
          </div>` : ''}

        <div class="nl-section">Where you work</div>
        <div class="nl-list" id="jobs-employment">
          ${Employment.get().jobs().map((job) => row({
            icon: '🧑‍🏭',
            title: `${esc(job.employer.name)} · ${esc(job.grade.title)}`,
            sub: `${esc(job.employer.task)} · ${count(job.done, job.employer.id === 'apapa-port' ? 'lorry' : job.employer.id === 'eko-plaza-site' ? 'course' : 'shift')} done${job.next ? ` · ${esc(job.next.title)} at ${job.next.from}` : ' · top grade'}`,
            // A workplace to ride to: there, straight to the one in charge and into a shift
            trailing: `<span class="nl-stack"><strong>${naira(job.grade.pay)}</strong>${WORKPLACE[job.employer.id] ? `<button class="nl-btn nl-btn--sm" data-act="work-go" data-arg="${esc(job.employer.id)}">🚕 Go to work</button>` : ''}</span>`,
          })).join('')}
          ${(() => {
            // Those with a place to go and ask come first, with a way there
            const open = EMPLOYERS.filter((employer) => !Employment.get().isEmployed(employer.id));
            const there = (id: string) => (WORKPLACE[id] ? 2 : WORKSITES[id] ? 1 : 0);
            return [...open].sort((a, b) => there(b.id) - there(a.id)).map((employer) => {
              const how = there(employer.id);
              const paper = employer.needs
                ? Qualifications.get().missing(employer.needs.course, employer.needs.level, employer.needs.paper)
                : null;
              return row({
                icon: how ? '📌' : '🕓',
                title: how ? `${esc(employer.name)} is taking hands on` : esc(employer.name),
                sub: `${how ? `${esc(employer.trade)} · ask at ${esc(employer.place)}` : `${esc(employer.trade)} · not taking walk-ins yet`}${paper ? ` · ${esc(paper)}` : ''}`,
                trailing: `<span class="nl-stack"><strong>${naira(employer.grades[0].pay)}</strong>${how === 2
                  ? `<button class="nl-btn nl-btn--sm" data-act="work-go" data-arg="${esc(employer.id)}">🚕 Go</button>`
                  : how === 1 ? `<button class="nl-btn nl-btn--sm" data-act="work-show" data-arg="${esc(employer.id)}">📍 Show</button>` : ''}</span>`,
                tone: how ? 'default' : 'muted',
              });
            }).join('');
          })()}
        </div>

        <div class="nl-section">9 Life Skills</div>
        <div class="nl-list" id="jobs-skills">
          ${(() => {
            const skills = host.backend.getSkills();
            return SKILL_METAS.map((m) => {
              const lvl = skills[m.key] ?? 1;
              const maxed = lvl >= 10;
              return row({
                icon: m.icon,
                title: `${m.name} · Level ${lvl}/10`,
                sub: `${esc(m.desc)} · ${esc(m.activity)}`,
                trailing: maxed
                  ? '<span class="nl-tag nl-tag--good">Mastered</span>'
                  : `<button class="nl-btn nl-btn--sm" data-act="train-skill" data-arg="${m.key}">Train (-15⚡)</button>`,
              });
            }).join('');
          })()}
        </div>

        <div class="nl-section">Shifts</div>
        <div class="nl-list" id="jobs-list">
          ${host.backend.getJobs().map((job) => {
            const locked = job.requiredLevel > career.rankLevel;
            const mine = shift?.job.id === job.id;
            const can = !shift && !locked;
            return row({
              icon: job.icon,
              title: esc(job.title),
              sub: `${esc(job.workplace)} · ${naira(job.salary * 22)} a month · ${leftWords(job.shiftDuration)} shift${locked ? ` · needs rank ${job.requiredLevel}` : ''}`,
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
    if (action === 'work-go') {
      const key = WORKPLACE[el.dataset.arg ?? ''];
      if (!key) return;
      const site = WORKSITES[el.dataset.arg ?? ''];
      const city = site?.city ?? 'lagos';
      if (city !== host.world.cityId()) {
        const names: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };
        host.say(`That workplace is in ${names[city] ?? city}. Fly or take the coach.`, 'info');
        host.close();
        host.world.openFlights();
        return;
      }
      // On arrival, straight to whoever is in charge there: they take the player on and start the shift
      Shifts.arriving = el.dataset.arg ?? null;
      host.close();
      PlaceOpeners.open(`ride:roadside-${key}`);
    } else if (action === 'work-show') {
      const site = WORKSITES[el.dataset.arg ?? ''];
      const employer = EMPLOYERS.find((e) => e.id === el.dataset.arg);
      if (!site || !employer) return;
      if (site.city !== host.world.cityId()) {
        const names: Record<string, string> = { lagos: 'Lagos', abuja: 'Abuja', port_harcourt: 'Port Harcourt' };
        host.say(`That workplace is in ${names[site.city] ?? site.city}. Fly or take the coach.`, 'info');
        host.close();
        host.world.openFlights();
        return;
      }
      host.world.showPlace(site.x, site.z, employer.name);
      host.close();
    } else if (action === 'start') {
      return beginShift(host, el.dataset.arg ?? '');
    } else if (action === 'claim') {
      return CareerShift.collect();
    } else if (action === 'train-skill') {
      const skillKey = (el.dataset.arg || '') as keyof PlayerSkills;
      const data = host.backend.getData();
      if (data.stats.energy < 15) {
        host.say('You are too exhausted to train! Eat food or rest first (needs 15% energy).', 'bad');
        return;
      }
      data.stats.energy = Math.max(0, data.stats.energy - 15);
      const res = host.backend.addSkillXp(skillKey, 1);
      SoundEngine.getInstance().playTransactionSuccess();
      const meta = SKILL_METAS.find((s) => s.key === skillKey);
      const name = meta ? meta.name : skillKey;
      host.say(`Trained ${name}! Level is now ${res.level}/10. (-15% Energy)`, 'good');
      host.refresh();
    } else if (action === 'gig-step') {
      const gig = GIGS.find((entry) => entry.id === el.dataset.arg);
      if (!gig) return;
      const done = host.get(`gig.${gig.id}`, 0);
      if (Number(el.dataset.gigStep) !== done) return;
      const online = OnlineAccount.get();
      if (online) {
        void (async () => {
          if (done === 0) {
            const started = await online.startGig(`life:${gig.id}`);
            if (!started.ok) { host.say(started.reason ?? 'That work could not be started.', 'bad'); return; }
          }
          if (done < 2) {
            host.set(`gig.${gig.id}`, done + 1);
            host.refresh();
            return;
          }
          let shift = online.rememberedGig(`life:${gig.id}`);
          if (!shift) {
            const opened = await online.openGig(`life:${gig.id}`);
            if (typeof opened.shift === 'string') shift = opened.shift;
          }
          if (!shift) { host.say('The server has no record of this work.', 'bad'); return; }
          if (host.backend.getData().stats.energy < gig.energy) {
            host.say(`You are too exhausted for this work (need ${gig.energy}% Energy). Eat or rest first.`, 'bad');
            return;
          }
          const finished = await online.finishGig(shift);
          if (!finished.ok) { host.say(finished.reason ?? 'Not paid.', 'bad'); return; }
          online.forgetGig(`life:${gig.id}`);
          host.set(`gig.${gig.id}`, 0);
          host.backend.modifyNeed('energy', -gig.energy);
          host.backend.addStreetCred(gig.cred);
          SoundEngine.getInstance().playTransactionSuccess();
          host.back();
          host.say(`${gig.name} done. Earned ₦${(finished.pay ?? 0).toLocaleString()} cash. Energy -${gig.energy}%`, 'good');
        })();
        return;
      }
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
/** Who the player is on the game server, and how a guest keeps their progress */
function accountSection(host: { get(key: string, fallback: string): string }): string {
  const online = OnlineAccount.get();
  const label = CloudSyncService.getInstance().getSyncInfo().label;
  const statusLine = `<div class="nl-hint" id="settings-save-status">${esc(label)}</div>`;
  if (!online) {
    return `
        <div class="nl-section">Your account</div>
        ${statusLine}
        <div class="nl-hint">A guest who never signs up can lose everything.</div>`;
  }
  const account = online.account;
  const devLink = host.get('settings.devLink', '');
  const guest = !account || account.kind === 'guest' || !account.verified;
  const who = !account ? 'Signing in…' : guest ? `${esc(account.name)}, playing as a guest` : `${esc(account.name)}${account.email ? `, ${esc(account.email)}` : ''}`;
  if (guest) {
    return `
        <div class="nl-section">Your account</div>
        <div class="nl-list">
          ${row({ icon: '👤', title: online.connected ? 'Online' : 'Connecting…', sub: who })}
        </div>
        ${statusLine}
        <div class="nl-hint">A guest who never signs up can lose everything. Create an account and this life — homes, bag, businesses — is kept, and it is there when you sign in on another phone.</div>
        <label class="nl-label" for="settings-username">Username</label>
        <input class="nl-field" id="settings-username" type="text" autocomplete="username" autocapitalize="off" spellcheck="false" maxlength="16" placeholder="e.g. Ada_Lagos" value="${esc(host.get('settings.username', ''))}" data-bind="settings.username" />
        <label class="nl-label" for="settings-password">Password</label>
        <input class="nl-field" id="settings-password" type="password" autocomplete="new-password" placeholder="At least 6 characters" value="${esc(host.get('settings.password', ''))}" data-bind="settings.password" />
        <button class="nl-btn nl-btn--block" id="settings-account-register" data-act="account-register">Create my account</button>
        <div class="nl-hint">Or add an email address and open the sign-in link. That keeps this same life too.</div>
        <label class="nl-label" for="settings-email">Email address</label>
        <input class="nl-field" id="settings-email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(host.get('settings.email', ''))}" data-bind="settings.email" />
        <button class="nl-btn nl-btn--block" id="settings-email-send" data-act="account-email">Send me a sign-in link</button>
        ${devLink ? `<div class="nl-hint" id="settings-dev-link">Sign-in link: <a href="${esc(devLink)}">${esc(devLink)}</a></div>` : ''}`;
  }
  return `
        <div class="nl-section">Your account</div>
        <div class="nl-list">
          ${row({ icon: '✅', title: online.connected ? 'Online' : 'Connecting…', sub: who })}
        </div>
        ${statusLine}
        <label class="nl-label" for="settings-new-email">Change email</label>
        <input class="nl-field" id="settings-new-email" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(host.get('settings.newEmail', ''))}" data-bind="settings.newEmail" />
        <label class="nl-label" for="settings-email-password">Password</label>
        <input class="nl-field" id="settings-email-password" type="password" autocomplete="current-password" placeholder="Your password" value="${esc(host.get('settings.emailPassword', ''))}" data-bind="settings.emailPassword" />
        <button class="nl-btn nl-btn--block" id="settings-account-email-change" data-act="account-change-email">Save this email</button>
        <button class="nl-btn nl-btn--block" id="settings-account-download" data-act="account-download">Download my data</button>
        <button class="nl-btn nl-btn--block" id="settings-account-signout" data-act="account-signout">Sign out</button>
        <label class="nl-label" for="settings-delete-password">Delete this account</label>
        <input class="nl-field" id="settings-delete-password" type="password" autocomplete="current-password" placeholder="Your password" value="${esc(host.get('settings.deletePassword', ''))}" data-bind="settings.deletePassword" />
        <button class="nl-btn nl-btn--danger nl-btn--block" id="settings-account-delete" data-act="account-delete">Delete my account</button>`;
}

/** What each graphics level gives up, in the player's terms */
const GRAPHICS_NOTES: Record<string, string> = {
  high: 'everything drawn in full',
  balanced: 'sharp on ordinary screens, distant people simpler',
  low: 'softer picture, no sun shadows, fewer people far off',
};
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
      // Another player may own it outright, in which case only they can sell it
      const takenBy = owned ? null : Deeds.get().takenBy('property', prop.id);
      const listing = Deeds.get().listingFor('property', prop.id);
      const lease = rented ? Dues.get().leaseOf(prop.id) : null;
      // Its light: the area's band, and NEPA now (src/life/Grid.ts)
      const sky = (window as any).game?.world.skyEnvironment;
      const area = homeArea(prop.districtId, prop.location ?? '');
      const ownPower = bandOf(area, prop.cityId) === 'own' || /zero power cuts|24\/7 microgrid|24\/7 .*power|full solar array/i.test(prop.features.join(' '));
      const lightNow = ownPower || !sky || hasLight(area, sky.day, sky.currentHour, prop.cityId);
      const change = !ownPower && sky ? nextChange(area, sky.day, sky.currentHour, prop.cityId) : null;
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
              <span><strong>${owned ? 'Owned' : rented ? 'Leased' : takenBy ? 'Owned' : 'Available'}</strong>status</span>
            </div>
          </div>
          <div class="nl-card" id="property-power">
            <div class="nl-card-title">${lightNow ? '💡' : '🕯️'} Light</div>
            <div class="nl-card-line">${ownPower
              ? 'The estate makes its own power: light day and night, whatever NEPA does.'
              : `${esc(areaName(area))} is <strong>Band ${esc(String(bandOf(area, prop.cityId)))}</strong>: at least ${BAND_HOURS[bandOf(area, prop.cityId) as Band]} hours of NEPA light a day, ${sky ? `${hoursOfLight(area, sky.day, prop.cityId)} today` : ''}.`}</div>
            ${ownPower ? '' : `<div class="nl-card-line" id="property-power-now">${lightNow ? 'NEPA has light there now' : '<strong>No NEPA light there now</strong>'}${change ? `${lightNow ? ' until' : '; back'} about ${hourWords(change.hour)}` : ''}. A generator or an inverter from the furniture catalogue keeps a home going through a cut.</div>`}
          </div>
          ${lease ? `
            <div class="nl-card ${lease.deadline !== null ? 'nl-card--warn' : ''}" id="property-rent">
              <div class="nl-card-title">${lease.deadline !== null ? '📜 Quit notice' : 'Rent'}</div>
              <div class="nl-card-line">${naira(lease.weekly)} every Saturday, from your bank and then your cash.</div>
              <div class="nl-card-line" id="property-rent-next">Next rent on <strong>${esc(dayLabel(lease.nextDue))}</strong>.</div>
              ${lease.deadline !== null ? `
                <div class="nl-card-line" id="property-rent-owed">You owe <strong>${naira(lease.arrears)}</strong>. Pay it, with the next rent, before <strong>${esc(dayLabel(lease.deadline))}</strong> or the locks will be changed.</div>
                <button class="nl-btn nl-btn--primary nl-btn--block" id="property-pay-rent" data-act="pay-rent" data-arg="${esc(prop.id)}" ${funds >= lease.arrears ? '' : 'disabled'}>Pay the landlord · ${naira(lease.arrears)}</button>` : ''}
            </div>` : ''}
          ${owned || rented ? `
            <button class="nl-btn nl-btn--primary nl-btn--block" id="property-go-home" data-act="home" data-arg="${esc(prop.id)}">Go home here</button>
            <button class="nl-btn nl-btn--block" data-act="decor">Furniture catalogue</button>
            ${owned
              ? `${listing
                  ? `<button class="nl-btn nl-btn--block" id="property-listing" data-app="land" data-route="listing:${esc(listing.id)}">On the market at ${naira(listing.askingPrice)} · see offers</button>`
                  : `<button class="nl-btn nl-btn--block" id="property-sell-player" data-app="land" data-route="ask:property:${esc(prop.id)}">Sell to another player</button>`}
                 <button class="nl-btn nl-btn--danger nl-btn--block" data-act="sell" data-arg="${esc(prop.id)}" ${listing ? 'disabled' : ''}>Sell to an agent now for ${naira(Math.round(prop.purchasePrice * 0.8))}</button>`
              : `<button class="nl-btn nl-btn--danger nl-btn--block" data-act="leave" data-arg="${esc(prop.id)}">Move out</button>
                 <button class="nl-btn nl-btn--block" data-act="buy" data-arg="${esc(prop.id)}" ${funds >= prop.purchasePrice ? '' : 'disabled'}>Buy it outright · ${naira(prop.purchasePrice)}</button>`}
          ` : takenBy ? `
            <div class="nl-note" id="property-taken">${esc(AssetMarket.get().nameOf(takenBy))} owns this home. It can only be bought from them.</div>
            ${listing && listing.status === 'active' ? `<button class="nl-btn nl-btn--primary nl-btn--block" id="property-their-listing" data-app="land" data-route="listing:${esc(listing.id)}">They are asking ${naira(listing.askingPrice)} · make an offer</button>` : ''}
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
      // From a home's own page: that home; from the top of the list: the home last gone into
      host.world.goHome(id || undefined);
    } else if (action === 'decor') {
      host.close();
      HouseDecorationSystem.getInstance().openCatalogueModal();
    } else if (action === 'pay-rent' && prop) {
      const result = Dues.get().payRentOwed(id);
      if (result.ok) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.ok ? 'good' : 'bad');
    } else if (action === 'rent' && prop) {
      if (!(await host.confirm(`Lease ${prop.name} for ${naira(prop.rentalPriceMonthly)}? That pays the first four weeks; then ${naira(prop.weeklyRent ?? Math.max(100, Math.round(prop.rentalPriceMonthly / 4)))} is due every Saturday.`, 'Lease it'))) return;
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
          ${(() => {
            const city = host.world.cityId();
            const hospital = city === 'abuja'
              ? { name: 'National Hospital, Garki', id: 'dest_abuja_garki_hospital' }
              : city === 'port_harcourt'
                ? { name: 'UPTH, Choba', id: 'dest_ph_upth' }
                : { name: 'St. Nicholas General, Lagos Island', id: 'dest_lagos_hospital' };
            return row({ icon: '🏥', title: 'Ride to the hospital', sub: hospital.name, attrs: `data-app="ride" data-route="d:${hospital.id}"` });
          })()}
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
          ${(() => {
            const city = host.world.cityId();
            const station = city === 'abuja'
              ? { name: 'FCT Police Command', id: 'dest_abuja_police' }
              : city === 'port_harcourt'
                ? { name: 'Rivers State Police Command', id: 'dest_ph_police' }
                : { name: 'Area Command, Lagos Island', id: 'dest_lagos_police' };
            return row({ icon: '👮', title: 'Ride to the police station', sub: `${station.name}. Reports are made at the front desk.`, attrs: `data-app="ride" data-route="d:${station.id}"` });
          })()}
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
    } else if (action === 'to-lagos') {
      host.say('That is in Lagos. You go there by air or by coach.', 'info');
      host.close();
      host.world.openFlights();
    }
  },
};

// ============================================================================================
// Settings
// ============================================================================================

const toggle = (id: string, on: boolean, action: string) =>
  `<button class="nl-toggle${on ? ' is-on' : ''}" id="${id}" role="switch" aria-checked="${on}" data-act="${action}"><span></span></button>`;

type TextSize = 'small' | 'normal' | 'large';

function textSize(): TextSize {
  try {
    const saved = localStorage.getItem('nl_text');
    if (saved === 'small' || saved === 'large') return saved;
  } catch { /* normal */ }
  return 'normal';
}

function applyText(size: TextSize): void {
  if (size === 'normal') delete document.documentElement.dataset.text;
  else document.documentElement.dataset.text = size;
  try { localStorage.setItem('nl_text', size); } catch { /* this visit only */ }
}

applyText(textSize());

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
        <div class="nl-section">How to play</div>
        <div class="nl-card" id="settings-howto">
          <div class="nl-card-title">A short guide</div>
          <div class="nl-card-line"><strong>Moving.</strong> On a phone, use the stick. On a computer, use W A S D or the arrow keys. Hold run to go faster.</div>
          <div class="nl-card-line"><strong>Places.</strong> Walk up to a door and press the action button (or F on a computer) to go in. The card on the screen names what you can do there.</div>
          <div class="nl-card-line"><strong>This phone.</strong> Open it from the bar. Jobs, the bank, rides, your homes and the map are apps. Close it to see the street again.</div>
          <div class="nl-card-line"><strong>Jobs.</strong> Take a shift and stay for the time it says, then collect. The wage is one day of that job's monthly pay. At a workplace, talk to the person in charge and do the rounds there. Walking off ends the shift.</div>
          <div class="nl-card-line"><strong>Money.</strong> Cash is on you. The bank holds the rest. What you earn while signed in is paid by the server, once.</div>
          <div class="nl-card-line"><strong>Homes.</strong> Rent from Property, or buy land and build. Sleep in the bed, eat from the fridge, sit, watch the television, wash, and run the generator when the light goes.</div>
          <div class="nl-card-line"><strong>Driving.</strong> Walk to your car and get in. On a phone the wheel is on the screen. On a computer the arrows steer and drive. Get out the same way you got in.</div>
        </div>
        <div class="nl-section">Controls</div>
        <div class="nl-list">
          ${row({ icon: '📱', title: 'On a phone', sub: 'Stick to walk · the round button to act, get in, or get out · RUN beside the stick · the bar along the bottom opens the phone, the map and the bag' })}
          ${row({ icon: '⌨️', title: 'On a computer', sub: 'W A S D or arrows to walk and to drive · Shift to run · F to act, enter, get in or get out · M map · P phone · Esc closes what is open' })}
        </div>
        <div class="nl-section">Look</div>
        <div class="nl-card" id="settings-look">
          <div class="nl-card-title">Light or dark</div>
          <div class="nl-card-line">The whole game: the bars, the cards, the map and this phone.</div>
          <div class="lx-seg" role="radiogroup" style="--n:2;--i:${theme() === 'dark' ? 1 : 0};margin-top:8px">
            <span class="lx-seg-thumb"></span>
            <button type="button" role="radio" class="lx-seg-btn${theme() === 'light' ? ' is-on' : ''}" id="settings-theme-light" aria-checked="${theme() === 'light'}" data-act="theme-light">☀️ Light</button>
            <button type="button" role="radio" class="lx-seg-btn${theme() === 'dark' ? ' is-on' : ''}" id="settings-theme-dark" aria-checked="${theme() === 'dark'}" data-act="theme-dark">🌙 Dark</button>
          </div>
        </div>
        <div class="nl-section">Text</div>
        <div class="lx-seg" role="radiogroup" style="--n:3;--i:${textSize() === 'small' ? 0 : textSize() === 'large' ? 2 : 1}">
          <span class="lx-seg-thumb"></span>
          <button type="button" role="radio" class="lx-seg-btn${textSize() === 'small' ? ' is-on' : ''}" id="settings-text-small" data-act="text-small">Small</button>
          <button type="button" role="radio" class="lx-seg-btn${textSize() === 'normal' ? ' is-on' : ''}" id="settings-text-normal" data-act="text-normal">Normal</button>
          <button type="button" role="radio" class="lx-seg-btn${textSize() === 'large' ? ' is-on' : ''}" id="settings-text-large" data-act="text-large">Large</button>
        </div>
        <div class="nl-section">Sound</div>
        <div class="nl-list">
          ${row({ icon: '🔊', title: 'Game sound', sub: sound.isMuted ? 'Off' : 'On', trailing: toggle('settings-sound', !sound.isMuted, 'sound') })}
          ${row({ icon: '📻', title: 'Music', sub: sound.isRadioActive() ? 'Playing' : 'Off', trailing: toggle('settings-radio', sound.isRadioActive(), 'radio') })}
        </div>
        <label class="nl-label" for="settings-sound-level">Sound volume</label>
        <input id="settings-sound-level" type="range" min="0" max="100" value="${Math.round(sound.soundLevel * 100)}" data-act="sound-level" />
        <label class="nl-label" for="settings-music-level">Music volume</label>
        <input id="settings-music-level" type="range" min="0" max="100" value="${Math.round(MusicPlayer.get().volume * 100)}" data-act="music-level" />
        <div class="nl-section">Notices</div>
        <div class="nl-list">
          ${row({ icon: '🔔', title: 'Notifications', sub: noticesEnabled() ? 'On. Warnings still show if you turn these off.' : 'Off. Warnings and problems still show.', trailing: toggle('settings-notices', noticesEnabled(), 'notices') })}
        </div>
        <div class="nl-section">You</div>
        <div class="nl-list">
          ${row({ icon: '🧑', title: esc(data.username), sub: esc(data.destinyTitle || data.career.title), trailing: '<span class="nl-tag">Profile</span>' })}
          ${row({ icon: '👕', title: 'Change your look', sub: 'Clothes, hair and skin tone', attrs: 'data-act="wardrobe"' })}
        </div>
        <div class="nl-section">Playing with others</div>
        ${SERVER_URL ? `
          <div class="nl-card" id="settings-server">
            <div class="nl-card-title">${ServerLink.get()?.connected ? '🟢 Connected' : '🟠 Trying to reach'} the world server</div>
            <div class="nl-card-line">${esc(SERVER_URL)}</div>
            <div class="nl-card-line">Land, buildings, vehicles and the market are shared with everyone on this server. Your money and your land are decided by the server. The rest of your life is saved to your account.</div>
            <button class="nl-btn nl-btn--danger nl-btn--sm" data-act="server-off">Leave the server and play on this device only</button>
          </div>` : `
          <div class="nl-hint">Land and the market are shared by the players in this browser. To share them with other devices, run the world server (npm run server) and enter its address.</div>
          <label class="nl-label" for="settings-server-url">World server address</label>
          <input class="nl-field" id="settings-server-url" type="text" inputmode="url" autocomplete="off" placeholder="http://192.168.1.20:8787" value="${esc(host.get('settings.server', ''))}" data-bind="settings.server" />
          <button class="nl-btn nl-btn--block" id="settings-server-join" data-act="server-on">Connect</button>`}
        ${accountSection(host)}
        <div class="nl-section">Graphics</div>
        <div class="nl-list">
          ${row({
            icon: '🖥️',
            title: 'Graphics quality',
            sub: `${(window as any).game?.graphics?.label ?? 'High'}: ${GRAPHICS_NOTES[(window as any).game?.graphics?.level ?? 'high']}`,
            trailing: '<button class="nl-btn nl-btn--sm" data-act="toggle-graphics">Change</button>',
          })}
        </div>
        <div class="nl-section">Driving & Vehicle Handling</div>
        <div class="nl-list">
          ${row({
            icon: '🚗',
            title: 'Steering sensitivity',
            sub: DrivableVehicle.steeringSensitivity <= 0.75 ? 'Forgiving (70%)' : DrivableVehicle.steeringSensitivity >= 1.25 ? 'High (130%)' : 'Standard (100%)',
            trailing: '<button class="nl-btn nl-btn--sm" data-act="toggle-steer-sens">Change</button>',
          })}
          ${row({
            icon: '🛣️',
            title: 'Lane centering assistance',
            sub: DrivableVehicle.laneAssistStrength === 0 ? 'Off (0%)' : DrivableVehicle.laneAssistStrength >= 1.0 ? 'Strong (100%)' : 'Balanced (85%)',
            trailing: '<button class="nl-btn nl-btn--sm" data-act="toggle-lane-assist">Change</button>',
          })}
          ${row({
            icon: '🎥',
            title: 'Driving chase camera',
            sub: DrivableVehicle.cameraSmoothing <= 0.7 ? 'Direct / Crisp' : DrivableVehicle.cameraSmoothing >= 1.2 ? 'Smooth Follow' : 'Balanced',
            trailing: '<button class="nl-btn nl-btn--sm" data-act="toggle-cam-smooth">Change</button>',
          })}
        </div>
        <div class="nl-section">World Clock & Time Model</div>
        <div class="nl-list">
          ${row({
            icon: '⏰',
            title: 'Authoritative world clock',
            sub: (window as any).game?.world.skyEnvironment.clockMode === 'REAL_TIME' ? 'Real Time (WAT Africa/Lagos)' : 'Simulated Accelerated Time',
            trailing: '<button class="nl-btn nl-btn--sm" data-act="toggle-clock-mode">Switch</button>',
          })}
        </div>
        <div class="nl-section">Lagos Street Life & Power</div>
        <div class="nl-list">
          ${row({
            icon: '⚡',
            title: 'Lagos power grid (NEPA)',
            sub: `${LagosStreetLifeSystem.getInstance().isNepaOn ? 'Light here now' : 'No light here now'}, by this area's band. Switching it holds for ten minutes.`,
            trailing: '<button class="nl-btn nl-btn--sm" data-act="toggle-nepa-power">Toggle</button>',
          })}
        </div>
        <div class="nl-section">Privacy</div>
        <div class="nl-card" id="settings-privacy">
          <div class="nl-card-line">While you are signed in, your money and your land are kept by the server, so a changed number in the browser does not stick. Everything else you own is saved to your account, and signing in on another phone brings it back. A guest who never signs up can lose everything. Other players see your name and what you do in the same place. You can block someone from their chat.</div>
        </div>
        <div class="nl-section">Help</div>
        <div class="nl-hint">The guide at the top of this page covers moving, places, the phone, jobs, money, homes and driving. If something is wrong, write it below and copy it, then send it to whoever runs this game.</div>
        <label class="nl-label" for="settings-report">Report a problem</label>
        <input class="nl-field" id="settings-report" type="text" maxlength="240" placeholder="What happened, and where you were" value="${esc(host.get('settings.report', ''))}" data-bind="settings.report" />
        <button class="nl-btn nl-btn--block" id="settings-report-copy" data-act="report">Copy the report</button>
      `,
    };
  },

  async act(host, action, el) {
    if (action === 'theme-light' || action === 'theme-dark') {
      setTheme(action === 'theme-dark' ? 'dark' : 'light');
      host.refresh();
      return;
    }
    if (action === 'text-small' || action === 'text-normal' || action === 'text-large') {
      applyText(action === 'text-small' ? 'small' : action === 'text-large' ? 'large' : 'normal');
      host.refresh();
      return;
    }
    if (action === 'sound-level') {
      SoundEngine.getInstance().setLevel(Number((el as HTMLInputElement).value) / 100);
      return;
    }
    if (action === 'music-level') {
      MusicPlayer.get().setVolume(Number((el as HTMLInputElement).value) / 100);
      return;
    }
    if (action === 'notices') {
      setNotices(!noticesEnabled());
      host.refresh();
      return;
    }
    if (action === 'report') {
      const note = host.get('settings.report', '').trim();
      if (!note) return host.say('Write what happened first.', 'bad');
      try {
        await navigator.clipboard.writeText(`Nigeria Life: ${note}`);
        host.say('Copied. Send it to the person who runs this game.', 'good');
      } catch {
        host.say('Could not copy. Select the text and copy it yourself.', 'bad');
      }
      return;
    }
    const sound = SoundEngine.getInstance();
    if (action === 'sound') {
      sound.toggleMute();
      host.refresh();
    } else if (action === 'radio') {
      sound.toggleRadio();
      host.refresh();
    } else if (action === 'account-email') {
      const online = OnlineAccount.get();
      const email = host.get('settings.email', '').trim();
      if (!online) return;
      const result = await online.askForSignInLink(email);
      if (!result.ok) return host.say(result.reason ?? 'The link could not be sent.', 'bad');
      host.set('settings.devLink', result.devLink ?? '');
      host.say(result.devLink ? 'No email service is set up on this server: the link is shown below.' : `A sign-in link is on its way to ${email}. Open it within 15 minutes.`, 'good');
      host.refresh();
    } else if (action === 'account-register') {
      const online = OnlineAccount.get();
      if (!online) return;
      const result = await online.register(host.get('settings.username', '').trim(), host.get('settings.password', ''));
      if (!result.ok) return host.say(result.reason ?? 'Could not create the account.', 'bad');
      host.say('Your account is ready. This life is kept on it.', 'good');
      host.refresh();
    } else if (action === 'account-change-email') {
      const result = await CloudSyncService.getInstance().changeEmail(host.get('settings.newEmail', '').trim(), host.get('settings.emailPassword', ''));
      host.say(result.ok ? 'That email is on your account now.' : (result.reason ?? 'The email was not changed.'), result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
    } else if (action === 'account-download') {
      const text = await CloudSyncService.getInstance().download();
      if (!text) return host.say('Nothing is saved to the account yet.', 'bad');
      const file = new Blob([text], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = 'nigeria-life.json';
      link.click();
      URL.revokeObjectURL(link.href);
      host.say('Your data is downloading.', 'good');
    } else if (action === 'account-signout') {
      if (!(await host.confirm('Sign out on this device? Your life stays on the account.', 'Sign out'))) return;
      await CloudSyncService.getInstance().signOut();
    } else if (action === 'account-delete') {
      if (!(await host.confirm('Delete this account? It cannot be signed in to again.', 'Delete'))) return;
      const result = await CloudSyncService.getInstance().deleteAccount(host.get('settings.deletePassword', ''));
      if (!result.ok) host.say(result.reason ?? 'The account was not deleted.', 'bad');
    } else if (action === 'toggle-graphics') {
      const graphics = (window as any).game?.graphics;
      if (graphics) graphics.choose(graphics.next());
      host.refresh();
    } else if (action === 'toggle-steer-sens') {
      DrivableVehicle.steeringSensitivity =
        DrivableVehicle.steeringSensitivity >= 1.25 ? 0.70 :
        DrivableVehicle.steeringSensitivity <= 0.75 ? 1.0 : 1.30;
      DrivableVehicle.saveSettings();
      host.refresh();
    } else if (action === 'toggle-lane-assist') {
      DrivableVehicle.laneAssistStrength =
        DrivableVehicle.laneAssistStrength === 0 ? 0.85 :
        DrivableVehicle.laneAssistStrength >= 1.0 ? 0.0 : 1.0;
      DrivableVehicle.saveSettings();
      host.refresh();
    } else if (action === 'toggle-cam-smooth') {
      DrivableVehicle.cameraSmoothing =
        DrivableVehicle.cameraSmoothing >= 1.2 ? 0.6 :
        DrivableVehicle.cameraSmoothing <= 0.7 ? 1.0 : 1.3;
      DrivableVehicle.saveSettings();
      host.refresh();
    } else if (action === 'toggle-clock-mode') {
      const sky = (window as any).game?.world.skyEnvironment;
      if (sky) {
        const nextMode = sky.clockMode === 'REAL_TIME' ? 'SIMULATED_TIME' : 'REAL_TIME';
        sky.setClockMode(nextMode);
        host.refresh();
      }
    } else if (action === 'toggle-nepa-power') {
      const sky = (window as any).game?.world.skyEnvironment;
      LagosStreetLifeSystem.getInstance().toggleNepaPower(sky?.currentPeriod || 'night');
      host.refresh();
    } else if (action === 'server-on') {
      const url = host.get('settings.server', '').trim();
      if (!/^https?:\/\/[^\s]+$/.test(url)) return host.say('Enter the address the server printed, such as http://192.168.1.20:8787.', 'bad');
      try {
        const response = await fetch(`${url.replace(/\/+$/, '')}/health`, { cache: 'no-store' });
        if (!response.ok) throw new Error(String(response.status));
      } catch {
        return host.say('Nothing answered at that address. Check that the server is running and that this device can reach it.', 'bad');
      }
      if (!(await host.confirm('Connect to this world server? The game will restart. Land and vehicles you own in this browser come with you, except any plot that already has an owner there.', 'Connect'))) return;
      rememberServer(url);
      window.location.reload();
    } else if (action === 'server-off') {
      if (!(await host.confirm('Leave the world server? The game will restart and use the land registry in this browser.', 'Leave'))) return;
      rememberServer(null);
      window.location.reload();
    } else if (action === 'wardrobe') {
      host.close();
      host.world.openWardrobe();
    }
  },
};
