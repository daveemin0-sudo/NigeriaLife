import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { esc, naira, row, empty } from '../../ui/kit/html';
import { profileKey } from '../../backend/Profile';
import { BackendService } from '../../backend/BackendService';
import { Police } from '../../life/Police';
import { OFFENCES } from '../../life/Offences';
import { PlaceOpeners } from '../../interiors/places/PlaceInterior';
import type { PlaceHost } from '../../destinations/PlaceActions';

interface Report {
  ref: string;
  what: string;
  who: string;
  city: string;
  at: number;
}

const KEY = 'nl-crime-reports';

function load(): Report[] {
  try {
    const raw = localStorage.getItem(profileKey(KEY));
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

function save(list: Report[]): void {
  try { localStorage.setItem(profileKey(KEY), JSON.stringify(list.slice(0, 30))); } catch { /* kept this visit */ }
}

function station(host: PhoneHost): string {
  const city = host.world.cityId();
  if (city === 'abuja') return 'FCT Police Command';
  if (city === 'port_harcourt') return 'Rivers State Police Command';
  return 'Lagos Area Command';
}

export const policeApp: PhoneApp = {
  id: 'police',
  name: 'Police',
  icon: '👮',
  tint: ['#1e3a8a', '#93c5fd'],
  purpose: 'Report a crime, check a case, pay a fine, ask for an escort or a police report',

  render(host, route) {
    const reports = load();
    const held = Police.get().custody();
    const record = Police.get().record();
    if (route === 'file') {
      return {
        title: 'Report',
        body: `
          <div class="nl-card">
            <div class="nl-card-line">Filed at ${esc(station(host))}. It stays in this city.</div>
            <input class="nl-field" id="police-what" placeholder="What happened" maxlength="160" data-bind="police.what" value="${esc(host.get('police.what', ''))}" />
            <input class="nl-field" id="police-who" placeholder="Who, if you know" maxlength="80" data-bind="police.who" value="${esc(host.get('police.who', ''))}" />
            <button class="nl-btn nl-btn--primary nl-btn--block" data-act="file">File the report</button>
          </div>
        `,
      };
    }
    if (route.startsWith('r:')) {
      const one = reports.find((r) => r.ref === route.slice(2));
      if (!one) return { title: 'Case', body: empty('📁', 'No such case', 'It is not on the book.') };
      return {
        title: one.ref,
        body: `
          <div class="nl-card">
            <div class="nl-card-title">${esc(one.ref)}</div>
            <div class="nl-card-line">${esc(one.what)}</div>
            <div class="nl-card-line">${one.who ? `About ${esc(one.who)}` : 'No person named'}</div>
            <div class="nl-card-line">Logged · ${esc(one.city)} · ${new Date(one.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
          </div>
        `,
      };
    }
    return {
      title: 'Police',
      body: `
        <div class="nl-card">
          <div class="nl-card-title">${esc(station(host))}</div>
          <div class="nl-card-line">From the phone. You do not have to drive to the station.</div>
        </div>
        <div class="nl-list">
          ${row({ icon: '📝', title: 'Report a crime', sub: 'Or a person', attrs: 'data-go="file"' })}
          ${held ? row({ icon: '🔒', title: 'Pay your bail', sub: naira(held.bail), trailing: '<button class="nl-btn nl-btn--sm" data-act="bail">Pay</button>' }) : ''}
          ${record.length ? row({
            icon: '💸',
            title: 'Pay a fine',
            sub: OFFENCES[record[0].offence]?.name ?? record[0].offence,
            trailing: '<button class="nl-btn nl-btn--sm" data-act="fine">Pay</button>',
          }) : ''}
          ${row({ icon: '🚨', title: 'Request an escort', sub: 'A patrol van for three days', trailing: '<button class="nl-btn nl-btn--sm" data-act="escort">Ask</button>' })}
          ${row({ icon: '📜', title: 'Police report', sub: 'A character certificate · ₦3,500', trailing: '<button class="nl-btn nl-btn--sm" data-act="cert">Ask</button>' })}
        </div>
        <div class="nl-section">Your cases</div>
        <div class="nl-list" id="police-cases">
          ${reports.length === 0
            ? empty('📁', 'No cases', 'A report you file shows here, with its reference.')
            : reports.map((r) => row({ icon: '📁', title: esc(r.ref), sub: esc(r.what), attrs: `data-go="r:${esc(r.ref)}"` })).join('')}
        </div>
      `,
    };
  },

  async act(host, action) {
    if (action === 'file') {
      const what = host.get('police.what', '').trim();
      const who = host.get('police.who', '').trim();
      if (what.length < 8) return host.say('Say what happened, in a few words.', 'bad');
      const ref = `PH${Date.now().toString(36).toUpperCase()}`;
      const list = load();
      list.unshift({ ref, what, who, city: host.world.cityName(), at: Date.now() });
      save(list);
      host.set('police.what', '');
      host.set('police.who', '');
      host.say(`Logged as ${ref} at ${station(host)}.`, 'good');
      host.go('');
      return;
    }
    if (action === 'bail') {
      const result = await Police.get().payBail();
      host.say(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
      return;
    }
    if (action === 'fine') {
      const result = Police.get().payFine();
      host.say(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) host.refresh();
      return;
    }
    if (action === 'escort') {
      const say = (text: string) => host.say(text, 'info');
      PlaceOpeners.open('escort:escort', { say } as PlaceHost);
      host.refresh();
      return;
    }
    if (action === 'cert') {
      if (host.backend.getData().inventory.some((item) => item.id === 'police_cert')) return host.say('You already have a police report in your bag.', 'info');
      const paid = BackendService.getInstance().processTransaction({
        type: 'SHOP_PURCHASE',
        amount: 3500,
        description: `Police character certificate, ${station(host)}`,
        source: 'bank',
      });
      if (!paid.success) return host.say('A police report is ₦3,500.', 'bad');
      host.backend.addItem({
        id: 'police_cert',
        name: 'Police character certificate',
        icon: '📜',
        price: 3500,
        category: 'document',
        usable: false,
        description: `Issued at ${station(host)}.`,
      });
      host.say('The certificate is in your bag.', 'good');
    }
  },
};
