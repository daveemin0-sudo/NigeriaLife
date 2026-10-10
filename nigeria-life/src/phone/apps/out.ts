import type { PhoneApp } from '../PhoneApp';
import { esc, naira, row, empty, chips, meter, count } from '../../ui/kit/html';
import { DestinationRegistry } from '../../destinations/DestinationRegistry';
import type { Shop } from '../services/DeliveryService';
import { SoundEngine } from '../../audio/SoundEngine';

// ============================================================================================
// Ride
// ============================================================================================

export const rideApp: PhoneApp = {
  id: 'ride',
  name: 'Ride',
  icon: '🚕',
  tint: ['#a16207', '#facc15'],
  purpose: 'Book a keke, an okada or a cab to anywhere in the city',

  badge: (host) => (host.rides.ride ? 1 : 0),
  live: (host) => host.rides.ride?.stage === 'driver_coming',

  render(host, route) {
    const rides = host.rides;
    const ride = rides.ride;

    if (ride) {
      const waiting = ride.stage === 'driver_coming';
      return {
        title: 'Your ride',
        body: `
          <div class="nl-card nl-card--live" id="ride-status" data-stage="${ride.stage}">
            <div class="nl-card-title">${ride.vehicle.icon} ${esc(ride.vehicle.label)}</div>
            <div class="nl-card-line">To <strong>${esc(ride.destination.name)}</strong></div>
            ${waiting
              ? `<div class="nl-card-line" id="ride-eta">Driver arrives in ${Math.max(1, Math.ceil(ride.eta))}s. Wait on the street.</div>
                 ${meter((1 - ride.eta / 6) * 100)}
                 <div class="nl-card-line">Fare ${naira(ride.fare)}, paid when you get in.</div>
                 <button class="nl-btn nl-btn--danger nl-btn--block" id="ride-cancel" data-act="cancel">Cancel ride (no charge)</button>`
              : `<div class="nl-card-line">On the way. Fare of ${naira(ride.fare)} paid.</div>`}
          </div>
        `,
      };
    }

    if (route.startsWith('d:')) {
      const destination = DestinationRegistry.getInstance().getById(route.slice(2));
      if (!destination) return { title: 'Ride', body: empty('🗺️', 'Unknown place', 'Drivers do not know that place.') };
      const vehicles = rides.vehiclesFor(destination);
      const blocked = rides.cannotBook();
      return {
        title: 'Choose a ride',
        body: `
          <div class="nl-card">
            <div class="nl-card-title">${destination.mapIcon} ${esc(destination.name)}</div>
            <div class="nl-card-line">${esc(destination.districtName)} · ${esc(destination.shortDescription)}</div>
          </div>
          ${blocked ? `<div class="nl-note nl-note--warn" id="ride-blocked">${esc(blocked)}</div>` : ''}
          <div class="nl-list" id="ride-vehicles">
            ${vehicles.length === 0
              ? empty('🚫', 'No rides go there', 'Walk, or use the map for other ways of getting there.')
              : vehicles.map((vehicle) => {
                  const short = rides.funds() < vehicle.fare;
                  return row({
                    icon: vehicle.icon,
                    title: esc(vehicle.label),
                    sub: short ? `You need ${naira(vehicle.fare - rides.funds())} more` : esc(vehicle.description),
                    trailing: `<strong>${naira(vehicle.fare)}</strong>`,
                    attrs: blocked || short ? 'disabled' : `data-act="book" data-arg="${esc(destination.id)}|${vehicle.mode}" data-ride="${vehicle.mode}"`,
                    tone: blocked || short ? 'muted' : 'default',
                    tag: 'button',
                  });
                }).join('')}
          </div>
          <div class="nl-hint">The fare is taken when the driver arrives and you get in. Cancelling before that costs nothing.</div>
        `,
      };
    }

    const search = host.get('ride.search', '').toLowerCase();
    const places = rides.destinations().filter((dest) => !search || `${dest.name} ${dest.category} ${dest.districtName}`.toLowerCase().includes(search));
    const blocked = rides.cannotBook();
    return {
      title: 'Ride',
      body: `
        <div class="nl-hero nl-hero--amber">
          <span class="nl-hero-label">You are in</span>
          <span class="nl-hero-title">${esc(host.world.placeName())}</span>
          <span class="nl-hero-sub">${esc(host.world.cityName())} · where to?</span>
        </div>
        ${blocked ? `<div class="nl-note nl-note--warn" id="ride-blocked">${esc(blocked)}</div>` : ''}
        <input class="nl-field nl-field--search" id="ride-search" type="search" placeholder="Search places" value="${esc(host.get('ride.search', ''))}" data-bind="ride.search" />
        <div class="nl-list" id="ride-places">
          ${places.length === 0
            ? empty('🧭', 'No place matches', search ? 'Try a different search.' : 'Drivers have no destinations in this city yet.')
            : places.map((dest) => row({ icon: dest.mapIcon, title: esc(dest.name), sub: `${esc(dest.category)} · ${esc(dest.districtName)}`, trailing: '›', attrs: `data-go="d:${esc(dest.id)}" data-place="${esc(dest.id)}"` })).join('')}
        </div>
      `,
    };
  },

  act(host, action, el) {
    if (action === 'cancel') {
      const result = host.rides.cancel();
      host.say(result.ok ? 'Ride cancelled. You were not charged.' : result.reason ?? 'That ride cannot be cancelled.', result.ok ? 'info' : 'bad');
    } else if (action === 'book') {
      const [destinationId, mode] = (el.dataset.arg ?? '').split('|');
      const result = host.rides.book(destinationId, mode);
      if (!result.ok) return host.say(result.reason ?? 'That ride is not available.', 'bad');
      host.back();
      host.say('Driver on the way. Wait on the street.', 'good');
    }
  },
};

// ============================================================================================
// Shopping: food and groceries brought to you, and selling what is in your bag
// ============================================================================================

export const shoppingApp: PhoneApp = {
  id: 'shopping',
  aliases: ['chowdeck', 'boutique', 'market'],
  name: 'Shopping',
  icon: '🛵',
  tint: ['#c2410c', '#fb923c'],
  purpose: 'Food and groceries brought to you, and selling what you no longer need',

  badge: (host) => (host.deliveries.order ? 1 : 0),
  live: (host) => host.deliveries.order !== null,

  render(host, route) {
    const deliveries = host.deliveries;
    const data = host.backend.getData();
    const tab = host.get<string>('shopping.tab', route === 'market' || route === 'sell' ? route : 'food');
    const order = deliveries.order;

    const orderCard = order ? `
      <div class="nl-card nl-card--live" id="shopping-order">
        <div class="nl-card-title">🛵 ${order.shop === 'food' ? 'QuickChop' : 'Everyday Supermarket'} rider on the way</div>
        <div class="nl-card-line" id="shopping-eta">${order.eta > 0 ? `Arrives in about ${Math.ceil(order.eta)}s` : 'Waiting for you to finish your journey'} · ${count(order.lines.reduce((sum, line) => sum + line.quantity, 0), 'item')}</div>
        ${meter((1 - Math.max(0, order.eta) / order.seconds) * 100)}
        <div class="nl-card-line">${naira(order.total)} to pay the rider on arrival.</div>
        <button class="nl-btn nl-btn--danger nl-btn--sm" id="shopping-cancel" data-act="cancel">Cancel order (no charge)</button>
      </div>` : '';

    let content = '';
    if (tab === 'sell') {
      const sellable = data.inventory.filter((item) => host.backend.resaleValue(item) > 0);
      content = `
        <div class="nl-hint">A trader buys things from your bag for 40% of what they cost new. Keys, cards and papers are not for sale.</div>
        <div class="nl-list" id="shopping-sell">
          ${sellable.length === 0
            ? empty('🎒', 'Nothing to sell', 'There is nothing in your bag that a trader would buy.')
            : sellable.map((item) => row({
                icon: item.icon,
                title: `${esc(item.name)} <span class="nl-tag">×${item.quantity}</span>`,
                sub: `Costs ${naira(item.price)} new`,
                trailing: `<button class="nl-btn nl-btn--sm" data-act="sell" data-arg="${esc(item.id)}">Sell · ${naira(host.backend.resaleValue(item))}</button>`,
              })).join('')}
        </div>`;
    } else {
      const shop = tab as Shop;
      const search = host.get('shopping.search', '').toLowerCase();
      const things = deliveries.catalogue(shop).filter((thing) => !search || `${thing.name} ${thing.group}`.toLowerCase().includes(search));
      const inBasket = deliveries.basket[shop];
      const lines = deliveries.basketCount(shop);
      const goods = deliveries.basketTotal(shop);
      const blocked = deliveries.cannotOrder(shop);
      let group = '';
      content = `
        <input class="nl-field nl-field--search" id="shopping-search" type="search" placeholder="${shop === 'food' ? 'Search the menu' : 'Search the shelves'}" value="${esc(host.get('shopping.search', ''))}" data-bind="shopping.search" />
        <div class="nl-list" id="shopping-list">
          ${things.length === 0 ? empty('🔎', 'Nothing matches', 'Try a different search.') : things.map((thing) => {
            const heading = thing.group !== group ? `<div class="nl-section">${esc(thing.group)}</div>` : '';
            group = thing.group;
            const have = inBasket.get(thing.id) ?? 0;
            return heading + row({
              icon: thing.icon,
              title: esc(thing.name),
              sub: esc(thing.description),
              trailing: `<span class="nl-stack"><strong>${naira(thing.price)}</strong><span class="nl-stepper">
                ${have > 0 ? `<button class="nl-step" data-act="less" data-arg="${shop}|${esc(thing.id)}" aria-label="One fewer">−</button><span>${have}</span>` : ''}
                <button class="nl-step" data-act="more" data-arg="${shop}|${esc(thing.id)}" data-add="${esc(thing.id)}" aria-label="Add one">+</button></span></span>`,
            });
          }).join('')}
        </div>
        <div class="nl-bar" id="shopping-basket">
          <span class="nl-bar-text">${lines === 0 ? 'Basket empty' : `${count(lines, 'item')} · ${naira(goods)} + ${naira(deliveries.fee(shop))} delivery`}</span>
          <button class="nl-btn nl-btn--primary nl-btn--sm" id="shopping-order-btn" data-act="order" data-arg="${shop}" ${blocked ? 'disabled' : ''}>Order · pay on delivery</button>
        </div>
        ${lines > 0 && blocked ? `<div class="nl-note nl-note--warn">${esc(blocked)}</div>` : ''}`;
    }

    return {
      title: 'Shopping',
      body: `
        ${orderCard}
        ${chips('shopping.tab', tab, [['food', '🍛 Hot food'], ['market', '🛒 Groceries'], ['sell', '💸 Sell']])}
        ${content}
      `,
    };
  },

  async act(host, action, el) {
    const arg = el.dataset.arg ?? '';
    if (action === 'more' || action === 'less') {
      const [shop, id] = arg.split('|') as [Shop, string];
      if (action === 'less') return host.deliveries.remove(shop, id);
      const result = host.deliveries.add(shop, id);
      if (!result.ok) host.say(result.reason ?? 'That cannot be added.', 'bad');
    } else if (action === 'order') {
      const result = host.deliveries.place(arg as Shop);
      host.say(result.ok ? 'Order placed. You pay the rider when it arrives.' : result.reason ?? 'That cannot be ordered.', result.ok ? 'good' : 'bad');
    } else if (action === 'cancel') {
      const result = host.deliveries.cancel();
      host.say(result.ok ? 'Order cancelled. You were not charged.' : result.reason ?? 'There is no order.', 'info');
    } else if (action === 'sell') {
      const item = host.backend.getData().inventory.find((entry) => entry.id === arg);
      if (!item) return;
      if (item.price >= 20000 && !(await host.confirm(`Sell ${item.name} for ${naira(host.backend.resaleValue(item))}?`, 'Sell it'))) return;
      const result = host.backend.sellItem(arg);
      if (result.success) SoundEngine.getInstance().playTransactionSuccess();
      host.say(result.message, result.success ? 'good' : 'bad');
    }
  },
};

// ============================================================================================
// People: contacts and messages
// ============================================================================================

export const peopleApp: PhoneApp = {
  id: 'messages',
  aliases: ['contacts', 'meetumo', 'people'],
  name: 'Messages',
  icon: '💬',
  tint: ['#0e7490', '#22d3ee'],
  purpose: 'The people you have met and the players online, and what you have said to each other',

  badge: (host) => host.messages.unread(),

  render(host, route) {
    const messages = host.messages;

    if (route.startsWith('c:')) {
      const id = route.slice(2);
      const contact = messages.contact(id);
      if (!contact) return { title: 'Messages', body: empty('👤', 'Not in your contacts', 'You can write to people you have met in the city, and to players who are online.') };
      messages.markRead(id);
      const thread = messages.thread(id);
      return {
        title: contact.name,
        body: `
          <div class="nl-chat-who">
            <span class="nl-tag${contact.standing === 'friend' ? ' nl-tag--good' : ''}">${esc(contact.note)}</span>
            ${contact.kind === 'player' ? '<button class="nl-btn nl-btn--sm" data-app="bank" data-route="send">Send money</button>' : ''}
          </div>
          <div class="nl-chat" id="chat-thread">
            ${thread.length === 0
              ? empty('✍️', 'No messages yet', contact.kind === 'player' ? 'Say hello. Only the two of you see this.' : 'Write something. How they answer depends on how well they know you.')
              : thread.map((message) => `
                <div class="nl-bubble nl-bubble--${message.from}">
                  <span>${esc(message.text)}</span>
                  <small>${esc(message.at)}</small>
                </div>`).join('')}
          </div>
          <form class="nl-chat-form" data-form="send" data-arg="${esc(id)}">
            <input class="nl-field" id="chat-input" type="text" maxlength="240" autocomplete="off" placeholder="Message ${esc(contact.name)}" value="${esc(host.get(`chat.${id}`, ''))}" data-bind="chat.${esc(id)}" />
            <button class="nl-btn nl-btn--primary" id="chat-send" type="submit" aria-label="Send">➤</button>
          </form>
        `,
      };
    }

    const search = host.get('people.search', '').toLowerCase();
    const contacts = messages.contacts().filter((contact) => !search || contact.name.toLowerCase().includes(search));
    return {
      title: 'Messages',
      body: `
        <input class="nl-field nl-field--search" id="people-search" type="search" placeholder="Search people" value="${esc(host.get('people.search', ''))}" data-bind="people.search" />
        <div class="nl-list" id="people-list">
          ${contacts.length === 0
            ? empty('👋', search ? 'Nobody by that name' : 'No contacts yet', search ? 'Try a different search.' : 'Greet people in the city, shake hands, have a chat. Once someone knows your face they appear here, and so do players who are online.')
            : contacts.map((contact) => row({
                icon: contact.kind === 'player' ? '🟢' : contact.standing === 'friend' ? '🤝' : '👤',
                title: `${esc(contact.name)}${contact.unread > 0 ? ` <span class="nl-dot" aria-label="${contact.unread} unread">${contact.unread}</span>` : ''}`,
                sub: contact.last ? `${contact.last.from === 'me' ? 'You: ' : ''}${esc(contact.last.text)}` : esc(contact.note),
                trailing: `<span class="nl-row-sub">${contact.last ? esc(contact.last.at) : esc(contact.note)}</span>`,
                attrs: `data-go="c:${esc(contact.id)}" data-contact="${esc(contact.id)}"`,
              })).join('')}
        </div>
      `,
    };
  },

  act(host, action, el) {
    if (action !== 'send') return;
    const id = el.dataset.arg ?? '';
    const failed = host.messages.send(id, host.get(`chat.${id}`, ''));
    if (failed) return host.say(failed, 'bad');
    host.set(`chat.${id}`, '');
    host.refresh();
  },
};
