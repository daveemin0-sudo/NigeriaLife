import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { chips, count, empty, esc, meter, naira, row } from '../../ui/kit/html';
import { SoundEngine } from '../../audio/SoundEngine';
import { AssetMarket, SALE_FEE_RATE } from '../../realestate/AssetMarket';
import { Garage, VEHICLE_MODELS, guidePrice, vehicleModel } from '../../realestate/Garage';
import { MY_ID } from '../../realestate/Registry';
import type { VehicleRecord } from '../../realestate/types';

const garage = () => Garage.get();
const market = () => AssetMarket.get();

function amountFrom(typed: string): number {
  const text = String(typed).trim().toLowerCase().replace(/[₦,\s]/g, '');
  const match = /^(\d+(?:\.\d+)?)(k|m|b)?$/.exec(text);
  if (!match) return NaN;
  return Math.round(Number(match[1]) * (match[2] === 'k' ? 1e3 : match[2] === 'm' ? 1e6 : match[2] === 'b' ? 1e9 : 1));
}

const facts = (record: VehicleRecord) => `${Math.round(record.mileage).toLocaleString()} km · condition ${Math.round(record.condition)}% · ${esc(record.plate)}`;

function carScreen(host: PhoneHost, record: VehicleRecord) {
  const model = vehicleModel(record.modelId)!;
  const owner = garage().ownerOf(record.id);
  const mine = owner === MY_ID;
  const listing = garage().listingFor(record.id);
  const title = market().title({ kind: 'vehicle', id: record.id });
  const guide = guidePrice(model, record);
  const myDeal = listing ? market().negotiationsOn(listing.id).find((deal) => deal.buyerId === MY_ID && (deal.status === 'open' || deal.status === 'accepted')) : undefined;
  const where = host.world.where();

  let actions = '';
  if (mine) {
    const offers = listing ? market().negotiationsOn(listing.id).filter((deal) => deal.status === 'open' || deal.status === 'accepted') : [];
    actions = `
      <button class="nl-btn nl-btn--primary nl-btn--block" id="garage-bring" data-act="bring" data-arg="${esc(record.id)}" ${where === 'street' ? '' : 'disabled'}>Have it brought to me</button>
      ${where === 'street' ? '' : '<div class="nl-hint">It can be brought to you when you are standing on the street.</div>'}
      ${listing ? `
        <div class="nl-card" id="garage-listing">
          <div class="nl-card-title">On the market at ${naira(listing.askingPrice)}</div>
          <div class="nl-card-line">${listing.status === 'pending' ? 'A sale has been agreed and is waiting for the buyer\'s payment.' : `${count(offers.length, 'offer')}. It stays yours, and yours to drive, until a sale completes.`}</div>
          ${listing.status === 'active' ? `<button class="nl-btn nl-btn--danger nl-btn--sm" id="garage-withdraw" data-act="withdraw" data-arg="${esc(listing.id)}">Take off the market</button>` : ''}
        </div>
        ${offers.length ? `<div class="nl-list" id="garage-offers">${offers.map((deal) => row({ icon: '🤝', title: `${esc(market().nameOf(deal.buyerId))} offers ${naira(deal.amount)}`, sub: deal.status === 'accepted' ? 'Agreed: waiting for payment' : deal.awaiting === 'seller' ? 'Your turn to answer' : 'Waiting for their answer', attrs: `data-app="land" data-route="deal:${esc(deal.id)}"` })).join('')}</div>` : ''}
      ` : `
        <label class="nl-label" for="garage-ask">Sell it: asking price</label>
        <input class="nl-field" id="garage-ask" type="text" inputmode="numeric" autocomplete="off" value="${esc(host.get(`garage.ask.${record.id}`, String(guide)))}" data-bind="garage.ask.${esc(record.id)}" />
        <div class="nl-hint">A guide for one in this state is about ${naira(guide)}. Listing sells nothing: you choose which offer to accept. The agent takes ${Math.round(SALE_FEE_RATE * 100)}% of the sale.</div>
        <button class="nl-btn nl-btn--block" id="garage-list" data-act="list" data-arg="${esc(record.id)}">Put it up for sale</button>
      `}`;
  } else if (listing && listing.status === 'active') {
    actions = myDeal
      ? `<div class="nl-list">${row({ icon: '🤝', title: `Your offer: ${naira(myDeal.amount)}`, sub: myDeal.status === 'accepted' ? 'Agreed' : myDeal.awaiting === 'buyer' ? 'Your turn to answer' : 'Waiting for the seller', attrs: `data-app="land" data-route="deal:${esc(myDeal.id)}"` })}</div>`
      : `
        <label class="nl-label" for="garage-offer">Your offer</label>
        <input class="nl-field" id="garage-offer" type="text" inputmode="numeric" autocomplete="off" placeholder="${naira(listing.askingPrice)}" value="${esc(host.get(`garage.offer.${record.id}`, ''))}" data-bind="garage.offer.${esc(record.id)}" />
        <div class="nl-hint">${esc(market().nameOf(listing.sellerId))} is asking ${naira(listing.askingPrice)}. You have ${naira(market().funds())} in all.</div>
        <button class="nl-btn nl-btn--primary nl-btn--block" id="garage-offer-btn" data-act="offer" data-arg="${esc(listing.id)}|${esc(record.id)}">Make this offer</button>`;
  } else {
    actions = `<div class="nl-note" id="garage-closed">${listing ? 'A sale to another buyer has been agreed.' : `This belongs to ${esc(market().nameOf(owner))} and is not for sale.`}</div>`;
  }

  return {
    title: model.name,
    body: `
      <div class="nl-hero nl-hero--amber">
        <span class="nl-hero-label">${esc(record.plate)} · ${mine ? 'Yours' : `Owner: ${esc(market().nameOf(owner))}`}</span>
        <span class="nl-hero-title">${model.icon} ${esc(model.name)}</span>
        <span class="nl-hero-sub">${Math.round(record.mileage).toLocaleString()} km on the clock</span>
      </div>
      <div class="nl-card">
        <div class="nl-card-line">Condition ${Math.round(record.condition)}%</div>
        ${meter(record.condition, record.condition < 45 ? 'bad' : record.condition < 70 ? 'warn' : 'good')}
        <div class="nl-card-line">${esc(model.blurb)}</div>
      </div>
      ${actions}
      ${title && title.history.length ? `
        <div class="nl-section">Owners</div>
        <div class="nl-list" id="garage-history">
          ${[...title.history].reverse().map((entry) => row({ icon: '📜', title: `${esc(market().nameOf(entry.to))}`, sub: entry.from === null ? 'Bought new from the dealer' : `Bought from ${esc(market().nameOf(entry.from))}`, trailing: naira(entry.price) })).join('')}
        </div>` : ''}
    `,
  };
}

export const garageApp: PhoneApp = {
  id: 'garage',
  aliases: ['cars', 'vehicles'],
  name: 'Garage',
  icon: '🚙',
  tint: ['#7c2d12', '#f59e0b'],
  purpose: 'Your vehicles, the dealer, and cars other players are selling',

  render(host, route) {
    if (route.startsWith('car:')) {
      const record = garage().record(route.slice(4));
      return record && vehicleModel(record.modelId) ? carScreen(host, record) : { title: 'Garage', body: empty('🚗', 'No such vehicle', 'It is not in the vehicle register.') };
    }

    const tab = host.get<string>('garage.tab', 'mine');
    const mine = garage().mine();
    const funds = market().funds();
    let content = '';
    if (tab === 'dealer') {
      content = `
        <div class="nl-hint">Ojota Motors sells new vehicles at fixed in-game prices. A new one is registered to you the moment it is paid for.</div>
        <div class="nl-list" id="garage-dealer">
          ${VEHICLE_MODELS.map((model) => row({
            icon: model.icon,
            title: esc(model.name),
            sub: `${esc(model.blurb)}${funds < model.price ? `<br><span class="nl-bad">You need ${naira(model.price - funds)} more</span>` : ''}`,
            trailing: `<strong>${naira(model.price)}</strong>`,
            attrs: funds < model.price ? `disabled data-model="${model.id}"` : `data-act="buy-new" data-arg="${model.id}" data-model="${model.id}"`,
            tone: funds < model.price ? 'muted' : 'default',
            tag: 'button',
          })).join('')}
        </div>`;
    } else if (tab === 'market') {
      const listings = garage().forSale();
      content = listings.length === 0
        ? empty('🏷️', 'No vehicles for sale', 'When a player lists one of theirs, it appears here with its mileage, condition and asking price.')
        : `<div class="nl-list" id="garage-market">${listings.map((listing) => {
            const record = garage().record(listing.asset.id);
            const model = record ? vehicleModel(record.modelId) : null;
            if (!record || !model) return '';
            return row({
              icon: model.icon,
              title: esc(model.name),
              sub: `${facts(record)}<br>${listing.sellerId === MY_ID ? 'Your listing' : `Seller: ${esc(market().nameOf(listing.sellerId))}`}${listing.status === 'pending' ? ' · sale agreed' : ''}`,
              trailing: `<strong>${naira(listing.askingPrice)}</strong>`,
              attrs: `data-go="car:${esc(record.id)}" data-car="${esc(record.id)}"`,
            });
          }).join('')}</div>`;
    } else {
      content = mine.length === 0
        ? empty('🚗', 'You own no vehicle', 'The vehicles standing about the city are for anyone to try. One of your own comes from the dealer, or from another player.')
        : `<div class="nl-list" id="garage-mine">${mine.map((record) => {
            const model = vehicleModel(record.modelId);
            if (!model) return '';
            const listing = garage().listingFor(record.id);
            return row({ icon: model.icon, title: esc(model.name), sub: `${facts(record)}${listing ? `<br><span class="nl-tag nl-tag--warn">For sale at ${naira(listing.askingPrice)}</span>` : ''}`, trailing: '›', attrs: `data-go="car:${esc(record.id)}" data-car="${esc(record.id)}"` });
          }).join('')}</div>`;
    }

    return {
      title: 'Garage',
      body: `
        <div class="nl-hero nl-hero--amber">
          <span class="nl-hero-label">Vehicle register</span>
          <span class="nl-hero-title" id="garage-owned">${count(mine.length, 'vehicle')} yours</span>
          <span class="nl-hero-sub">${naira(funds)} to spend</span>
        </div>
        ${chips('garage.tab', tab, [['mine', 'Mine'], ['dealer', 'Dealer'], ['market', 'For sale']])}
        ${content}
      `,
    };
  },

  async act(host, action, el) {
    const arg = el.dataset.arg ?? '';
    const done = (ok: boolean, good: string, bad?: string) => {
      if (ok) SoundEngine.getInstance().playTransactionSuccess();
      host.say(ok ? good : bad ?? 'That could not be done.', ok ? 'good' : 'bad');
      host.refresh();
    };
    if (action === 'buy-new') {
      const model = vehicleModel(arg);
      if (!model) return;
      if (!(await host.confirm(`Buy a new ${model.name} for ${naira(model.price)}?`, 'Buy it'))) return;
      const result = await garage().buyNew(model.id);
      if (result.ok) host.set('garage.tab', 'mine');
      done(result.ok, `The ${model.name} is yours. Have it brought to you from its page.`, result.reason);
    } else if (action === 'bring') {
      const blocked = host.world.bringVehicle(arg);
      if (blocked) return host.say(blocked, 'bad');
      host.close();
    } else if (action === 'list') {
      const price = amountFrom(host.get(`garage.ask.${arg}`, ''));
      const record = garage().record(arg);
      const model = record ? vehicleModel(record.modelId) : null;
      const asking = Number.isFinite(price) ? price : record && model ? guidePrice(model, record) : NaN;
      if (!Number.isFinite(asking)) return host.say('Enter an asking price, such as 2500000 or 2.5m.', 'bad');
      const result = await market().list({ kind: 'vehicle', id: arg }, asking);
      done(result.ok, `On the market at ${naira(asking)}.`, result.reason);
    } else if (action === 'withdraw') {
      const result = await market().withdraw(arg);
      done(result.ok, 'It is off the market. Nothing was sold.', result.reason);
    } else if (action === 'offer') {
      const [listingId, carId] = arg.split('|');
      const amount = amountFrom(host.get(`garage.offer.${carId}`, ''));
      if (!Number.isFinite(amount)) return host.say('Enter your offer, such as 2000000 or 2m.', 'bad');
      const result = await market().offer(listingId, amount);
      if (result.ok) host.set(`garage.offer.${carId}`, '');
      done(result.ok, `Your offer of ${naira(amount)} has gone to the seller.`, result.reason);
    }
  },
};
