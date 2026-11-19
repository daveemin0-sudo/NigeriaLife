import type { PhoneApp } from '../PhoneApp';
import { esc, row, empty } from '../../ui/kit/html';
import { MessageService } from '../services/MessageService';
import { Employment } from '../../jobs/Employment';
import { BackendService } from '../../backend/BackendService';
import { Companies } from '../../business/Companies';

MessageService.addContacts(() => {
  const out: Array<{ id: string; name: string; note: string; standing: 'acquaintance' }> = [];
  for (const job of Employment.get().jobs()) {
    out.push({ id: `boss:${job.employer.id}`, name: job.employer.name, note: 'Your employer', standing: 'acquaintance' });
  }
  const data = BackendService.getInstance().getData();
  for (const id of Object.keys(data.leases ?? {})) {
    const prop = data.properties.find((p) => p.id === id);
    out.push({ id: `landlord:${id}`, name: prop ? `Landlord, ${prop.name}` : 'Your landlord', note: 'Your landlord', standing: 'acquaintance' });
  }
  for (const biz of data.businesses) {
    if (!biz.owned) continue;
    for (const person of Companies.get().staff(biz.id)) {
      out.push({ id: `staff:${person.id}`, name: person.name, note: `Works at ${biz.name}`, standing: 'acquaintance' });
    }
  }
  return out;
});

/** Everyone the player knows, with how they know them, a call and a message. */
export const contactsApp: PhoneApp = {
  id: 'contacts',
  name: 'Contacts',
  icon: '👤',
  tint: ['#134e4a', '#2dd4bf'],
  purpose: 'Everyone you have met: call them or send a message',

  render(host) {
    const people = host.messages.contacts();
    return {
      title: 'Contacts',
      body: `
        <div class="nl-list" id="contacts-list">
          ${people.length === 0
            ? empty('👋', 'Nobody here yet', 'Greet people in the city. Your employer, your landlord and your staff appear here too.')
            : people.map((person) => row({
                icon: person.kind === 'player' ? '🟢' : '👤',
                title: esc(person.name),
                sub: esc(person.note),
                trailing: `<span class="nl-stack"><button class="nl-btn nl-btn--sm" data-act="call" data-arg="${esc(person.id)}">Call</button><button class="nl-btn nl-btn--sm" data-act="write" data-arg="${esc(person.id)}">Message</button></span>`,
              })).join('')}
        </div>
      `,
    };
  },

  act(host, action, el) {
    const id = el.dataset.arg ?? '';
    const person = host.messages.contact(id);
    if (!person) return host.say('They are not in your contacts.', 'bad');
    if (action === 'write') {
      host.openApp('messages', `c:${id}`);
      return;
    }
    if (action === 'call') {
      const failed = host.messages.send(id, 'Called you.');
      if (failed) return host.say(failed, 'bad');
      host.say(person.kind === 'player' ? `Ringing ${person.name}.` : `${person.name} picked up. You spoke for a minute.`, 'good');
    }
  },
};
