import type { PhoneApp, PhoneHost } from '../PhoneApp';
import { chips, count, empty, esc, meter, naira, row } from '../../ui/kit/html';
import { SoundEngine } from '../../audio/SoundEngine';
import { AssetMarket, SALE_FEE_RATE } from '../../realestate/AssetMarket';
import { buildingType, demolitionCost, refundOnCancel } from '../../realestate/BuildingCatalogue';
import { Land, stageOf, STAGE_LABEL, STATUS_LABEL, type Plot, type PlotStatus } from '../../realestate/Land';
import { MY_ID } from '../../realestate/Registry';
import { CITY_NAME, STATE_NAME } from '../../realestate/PlotCatalogue';
import { hoursDone, isFinished, isLet, worldNow, MS_PER_GAME_DAY } from '../../realestate/WorldClock';
import { SETBACK } from '../../world/plan/CityPlan';
import type { AssetRef, Listing, Negotiation } from '../../realestate/types';

const land = () => Land.get();
const market = () => AssetMarket.get();

const USE_LABEL: Record<string, string> = { residential: 'Homes', commercial: 'Business' };
const STATUS_TONE: Record<PlotStatus, string> = { available: 'good', listed: 'good', negotiating: 'warn', reserved: 'warn', building: 'info', developed: 'info', owned: 'muted' };
const tag = (text: string, tone = 'muted') => `<span class="nl-tag nl-tag--${tone}">${esc(text)}</span>`;
const when = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
/** How long is left of something paid for, in game days. */
const daysLeft = (until: number) => Math.max(0, (until - worldNow()) / MS_PER_GAME_DAY);
const stateOf = (plot: Plot) => STATE_NAME[plot.city];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** What was typed as an amount: "45,000,000" and "45m" are both 45000000. Nothing usable is NaN. */
function amountFrom(typed: string): number {
  const text = String(typed).trim().toLowerCase().replace(/[₦,\s]/g, '');
  const match = /^(\d+(?:\.\d+)?)(k|m|b)?$/.exec(text);
  if (!match) return NaN;
  return Math.round(Number(match[1]) * (match[2] === 'k' ? 1e3 : match[2] === 'm' ? 1e6 : match[2] === 'b' ? 1e9 : 1));
}

function assetName(asset: AssetRef): string {
  return market().describe(asset);
}

function plotRow(plot: Plot): string {
  const status = land().status(plot.id);
  const price = land().askingPrice(plot.id);
  const mine = land().isMine(plot.id);
  return row({
    icon: mine ? '🟩' : status === 'available' ? '🟨' : '⬜',
    title: esc(plot.name),
    sub: `${esc(plot.neighbourhood)}, ${CITY_NAME[plot.city]} · ${Math.round(plot.area)} m² · ${plot.uses.map((use) => USE_LABEL[use]).join(' & ')}<br>${tag(mine ? 'Yours' : STATUS_LABEL[status], mine ? 'good' : STATUS_TONE[status])}${toLetTag(plot)}`,
    trailing: price !== null ? `<strong>${naira(price)}</strong>` : '<span class="nl-dim">Not for sale</span>',
    attrs: `data-go="plot:${esc(plot.id)}" data-plot="${esc(plot.id)}"`,
  });
}

/** A tag on a plot's row when its building can be rented, or is. */
function toLetTag(plot: Plot): string {
  const tenancy = land().tenancy(plot.id);
  if (!tenancy) return '';
  if (isLet(tenancy)) return ` ${tag(tenancy.tenantId === MY_ID ? 'You rent it' : 'Let', 'info')}`;
  return tenancy.ending ? '' : ` ${tag(`To let · ${naira(tenancy.rentPerWeek)} a week`, 'warn')}`;
}

/** Everything about letting the building on a plot, for whoever is looking at it. */
function lettingCard(host: PhoneHost, plot: Plot, mine: boolean): string {
  const building = land().building(plot.id);
  const type = building ? buildingType(building.typeId) : null;
  if (!building || !type || !isFinished(building)) return '';
  const tenancy = land().tenancy(plot.id);
  const let_ = isLet(tenancy);
  const what = type.home ? 'live in it' : 'run it and keep its takings';

  if (mine) {
    if (let_) {
      return `
        <div class="nl-card" id="land-let">
          <div class="nl-card-title">Let to ${esc(market().nameOf(tenancy.tenantId))}</div>
          <div class="nl-card-line">${naira(tenancy.rentPerWeek)} a week, paid up for ${daysLeft(tenancy.paidUntil).toFixed(1)} more game days.${tenancy.ending ? ' You have given notice: they leave when that runs out.' : ''}</div>
          ${tenancy.ending ? '' : `<button class="nl-btn nl-btn--danger nl-btn--sm" id="land-notice" data-act="stop-letting" data-arg="${esc(plot.id)}">Give notice</button>`}
        </div>`;
    }
    return `
      <div class="nl-card" id="land-let">
        <div class="nl-card-title">${tenancy ? `To let at ${naira(tenancy.rentPerWeek)} a week` : 'Let it to another player'}</div>
        <div class="nl-card-line">A tenant pays you by the week and gets to ${what}. You still own it and can sell it.</div>
        <label class="nl-label" for="land-rent">Weekly rent</label>
        <input class="nl-field" id="land-rent" type="text" inputmode="numeric" autocomplete="off" value="${esc(host.get(`land.rent.${plot.id}`, String(tenancy?.rentPerWeek ?? Math.max(5000, Math.round((type.cost * 0.02) / 1000) * 1000))))}" data-bind="land.rent.${esc(plot.id)}" />
        <div class="nl-split">
          <button class="nl-btn nl-btn--sm" id="land-let-btn" data-act="offer-let" data-arg="${esc(plot.id)}">${tenancy ? 'Change the rent' : 'Offer it to let'}</button>
          ${tenancy ? `<button class="nl-btn nl-btn--danger nl-btn--sm" id="land-unlet" data-act="stop-letting" data-arg="${esc(plot.id)}">Stop offering it</button>` : ''}
        </div>
      </div>`;
  }

  if (let_ && tenancy.tenantId === MY_ID) {
    const takings = land().takings(plot.id);
    return `
      <div class="nl-card nl-card--live" id="land-tenancy">
        <div class="nl-card-title">You rent this ${esc(type.name.toLowerCase())}</div>
        <div class="nl-card-line">${naira(tenancy.rentPerWeek)} a week. Paid up for ${daysLeft(tenancy.paidUntil).toFixed(1)} more game days.${tenancy.ending ? ' The owner has given notice: it ends then.' : ' The next week is paid from your account when this one is nearly up.'}</div>
        ${type.home ? '<button class="nl-btn nl-btn--primary nl-btn--block" id="land-go-in" data-act="go-in">Go inside</button>' : ''}
        ${type.incomePerDay > 0 ? `<button class="nl-btn nl-btn--primary nl-btn--block" id="land-collect" data-act="collect" data-arg="${esc(plot.id)}" ${takings > 0 ? '' : 'disabled'}>Collect ${naira(takings)}</button>` : ''}
        <div class="nl-split">
          ${tenancy.ending ? '' : `<button class="nl-btn nl-btn--sm" id="land-renew" data-act="pay-rent" data-arg="${esc(plot.id)}">Pay another week</button>`}
          <button class="nl-btn nl-btn--danger nl-btn--sm" id="land-leave" data-act="leave-let" data-arg="${esc(plot.id)}">Give it up</button>
        </div>
      </div>`;
  }
  if (let_) return `<div class="nl-note" id="land-let">This ${esc(type.name.toLowerCase())} is let to ${esc(market().nameOf(tenancy.tenantId))}.</div>`;
  if (tenancy && !tenancy.ending) {
    const short = market().funds() < tenancy.rentPerWeek;
    return `
      <div class="nl-card" id="land-let">
        <div class="nl-card-title">To let · ${naira(tenancy.rentPerWeek)} a week</div>
        <div class="nl-card-line">Rent it and you ${what}. ${type.incomePerDay > 0 ? `It brings in ${naira(type.incomePerDay)} a game day and costs ${naira(type.upkeepPerDay)} to keep.` : ''} A week is seven game days, paid in advance.</div>
        <button class="nl-btn nl-btn--primary nl-btn--block" id="land-rent-btn" data-act="pay-rent" data-arg="${esc(plot.id)}" ${short ? 'disabled' : ''}>Rent it · ${naira(tenancy.rentPerWeek)} for the first week</button>
        ${short ? `<div class="nl-note nl-note--warn">You have ${naira(market().funds())} in all.</div>` : ''}
      </div>`;
  }
  return '';
}

function dealRow(deal: Negotiation): string {
  const buying = deal.buyerId === MY_ID;
  const myTurn = deal.status === 'open' && deal.awaiting === (buying ? 'buyer' : 'seller');
  const state = deal.status === 'open' ? (myTurn ? 'Your turn to answer' : 'Waiting for their answer')
    : deal.status === 'accepted' ? (buying ? 'Agreed: paying now' : 'Agreed: waiting for payment')
    : deal.status === 'completed' ? 'Sold' : deal.status === 'failed' ? 'Fell through' : deal.status === 'cancelled' ? 'Withdrawn' : 'Turned down';
  return row({
    icon: buying ? '🛒' : '🏷️',
    title: esc(assetName(deal.asset)),
    sub: `${buying ? 'Buying from' : 'Selling to'} ${esc(market().nameOf(buying ? deal.sellerId : deal.buyerId))}<br>${tag(state, myTurn ? 'warn' : deal.status === 'completed' ? 'good' : 'muted')}`,
    trailing: `<strong>${naira(deal.amount)}</strong>`,
    attrs: `data-go="deal:${esc(deal.id)}" data-deal="${esc(deal.id)}"`,
  });
}

// ------------------------------------------------------------------------------------------------
// Screens
// ------------------------------------------------------------------------------------------------

function plotScreen(host: PhoneHost, plot: Plot) {
  const status = land().status(plot.id);
  const owner = land().ownerOf(plot.id);
  const mine = owner === MY_ID;
  const listing = land().listingFor(plot.id);
  const building = land().building(plot.id);
  const type = building ? buildingType(building.typeId) : null;
  const funds = market().funds();
  const title = market().title({ kind: 'plot', id: plot.id });
  const width = plot.rect.maxX - plot.rect.minX;
  const depth = plot.rect.maxZ - plot.rect.minZ;
  const myDeal = listing ? market().negotiationsOn(listing.id).find((deal) => deal.buyerId === MY_ID && (deal.status === 'open' || deal.status === 'accepted')) : undefined;

  let actions = '';
  if (status === 'available') {
    const short = funds < plot.statePrice;
    actions = `
      <button class="nl-btn nl-btn--primary nl-btn--block" id="land-buy" data-act="buy-state" data-arg="${esc(plot.id)}" ${short ? 'disabled' : ''}>Buy from ${esc(stateOf(plot))} · ${naira(plot.statePrice)}</button>
      ${short ? `<div class="nl-note nl-note--warn" id="land-short">You have ${naira(funds)} in all. You need ${naira(plot.statePrice - funds)} more.</div>` : ''}`;
  } else if (mine) {
    if (building && type && !isFinished(building)) {
      const worked = hoursDone(building);
      const done = Math.round((worked / building.hoursNeeded) * 100);
      actions += `
        <div class="nl-card nl-card--live" id="land-works">
          <div class="nl-card-title">${type.icon} ${esc(type.name)} going up</div>
          <div class="nl-card-line">${STAGE_LABEL[stageOf(building)]} · ${done}% built · about ${Math.max(0, Math.ceil(building.hoursNeeded - worked))} game hours of work left</div>
          ${meter(done)}
          <div class="nl-card-line">The builders keep working whether or not you are in the game.</div>
          <button class="nl-btn nl-btn--danger nl-btn--sm" data-act="stop-work" data-arg="${esc(plot.id)}">Stop work · ${naira(refundOnCancel(type, worked))} back</button>
        </div>`;
    } else if (building && type) {
      const takings = land().takings(plot.id);
      const tenanted = isLet(land().tenancy(plot.id));
      actions += `
        <div class="nl-card" id="land-building">
          <div class="nl-card-title">${type.icon} ${esc(type.name)}</div>
          <div class="nl-card-line">${type.incomePerDay > 0 ? `Brings in ${naira(type.incomePerDay)} a day and costs ${naira(type.upkeepPerDay)} a day to keep.` : `Costs ${naira(type.upkeepPerDay)} a day to keep.`}${type.home && !tenanted ? ' You can live here.' : ''}</div>
          ${type.incomePerDay > 0 && !tenanted ? `<button class="nl-btn nl-btn--primary nl-btn--block" id="land-collect" data-act="collect" data-arg="${esc(plot.id)}" ${takings > 0 ? '' : 'disabled'}>Collect ${naira(takings)}</button>` : ''}
          ${type.home && !tenanted ? '<button class="nl-btn nl-btn--block" id="land-go-in" data-act="go-in">Go inside</button>' : ''}
          ${tenanted ? '' : `<button class="nl-btn nl-btn--danger nl-btn--sm" data-act="demolish" data-arg="${esc(plot.id)}">Pull it down · costs ${naira(demolitionCost(type))}</button>`}
        </div>
        ${lettingCard(host, plot, true)}`;
    } else if (!listing || listing.status === 'active') {
      actions += `<button class="nl-btn nl-btn--primary nl-btn--block" id="land-build" data-go="build:${esc(plot.id)}">Build on this plot</button>`;
    }
    if (listing) {
      const offers = market().negotiationsOn(listing.id).filter((deal) => deal.status === 'open' || deal.status === 'accepted');
      actions += `
        <div class="nl-card" id="land-listing">
          <div class="nl-card-title">On the market at ${naira(listing.askingPrice)}</div>
          <div class="nl-card-line">${listing.status === 'pending' ? 'A sale has been agreed and is waiting for the buyer\'s payment.' : count(offers.length, 'offer') + ' to answer or wait on.'}</div>
          ${listing.status === 'active' ? `
            <div class="nl-split">
              <button class="nl-btn nl-btn--sm" data-go="sell:${esc(plot.id)}">Change price</button>
              <button class="nl-btn nl-btn--danger nl-btn--sm" id="land-withdraw" data-act="withdraw" data-arg="${esc(listing.id)}">Take off the market</button>
            </div>` : ''}
        </div>
        ${offers.length ? `<div class="nl-section">Offers</div><div class="nl-list" id="land-offers">${offers.map(dealRow).join('')}</div>` : ''}`;
    } else if (!building || isFinished(building)) {
      actions += `<button class="nl-btn nl-btn--block" id="land-sell" data-go="sell:${esc(plot.id)}">Put up for sale</button>`;
    } else {
      actions += '<div class="nl-hint">Land with building work under way cannot be sold. Finish the building or stop the work first.</div>';
    }
  } else if (listing && listing.status === 'active') {
    actions = myDeal
      ? `<div class="nl-list">${dealRow(myDeal)}</div>`
      : `
        <label class="nl-label" for="land-offer">Your offer</label>
        <input class="nl-field" id="land-offer" type="text" inputmode="numeric" autocomplete="off" placeholder="${naira(listing.askingPrice)}" value="${esc(host.get(`land.offer.${plot.id}`, ''))}" data-bind="land.offer.${esc(plot.id)}" />
        <div class="nl-hint">The asking price is ${naira(listing.askingPrice)}. Offer that or anything else: the owner can accept, refuse or name another price. You have ${naira(funds)} in all.</div>
        <button class="nl-btn nl-btn--primary nl-btn--block" id="land-offer-btn" data-act="offer" data-arg="${esc(listing.id)}|${esc(plot.id)}">Make this offer</button>`;
  } else if (status === 'reserved') {
    actions = myDeal ? `<div class="nl-list">${dealRow(myDeal)}</div>` : '<div class="nl-note" id="land-closed">A sale to another buyer has been agreed and is being completed.</div>';
  } else {
    actions = `<div class="nl-note" id="land-closed">This land belongs to ${esc(market().nameOf(owner))} and is not for sale. Only its owner can put it on the market.</div>`;
  }
  if (!mine) actions += lettingCard(host, plot, false);

  return {
    title: plot.name,
    body: `
      <div class="nl-hero nl-hero--green">
        <span class="nl-hero-label">${esc(plot.neighbourhood)}, ${CITY_NAME[plot.city]} · ${esc(plot.street)}</span>
        <span class="nl-hero-title">${Math.round(plot.area)} m²</span>
        <span class="nl-hero-sub">${width} m × ${depth} m · ${mine ? 'Your land' : STATUS_LABEL[status]}</span>
      </div>
      <div class="nl-list" id="land-facts">
        ${row({ icon: '👤', title: 'Owner', sub: esc(owner === null ? `${cap(stateOf(plot))} (not yet sold to anyone)` : mine ? 'You' : market().nameOf(owner)) })}
        ${row({ icon: '🏗️', title: 'What may be built', sub: `${plot.uses.map((use) => USE_LABEL[use]).join(' and ')} · up to ${count(plot.maxFloors, 'floor')}` })}
        ${row({ icon: '📏', title: 'Rules', sub: `Buildings stand at least ${SETBACK} m inside the boundary and never on the road or the pavement.` })}
        ${row({ icon: '💰', title: status === 'available' ? 'State price' : listing ? 'Asking price' : 'Price', sub: status === 'available' ? `${naira(plot.statePrice)} · an in-game price` : listing ? `${naira(listing.askingPrice)} · offers are negotiated` : 'Not for sale' })}
      </div>
      ${actions}
      <button class="nl-btn nl-btn--block" data-act="show" data-arg="${esc(plot.id)}">Show me where it is</button>
      ${title && title.history.length ? `
        <div class="nl-section">Who has owned it</div>
        <div class="nl-list" id="land-history">
          ${[...title.history].reverse().map((entry) => row({ icon: '📜', title: `${esc(market().nameOf(entry.to))} bought it`, sub: `From ${esc(entry.from === null ? stateOf(plot) : market().nameOf(entry.from))} · ${when(entry.at)}`, trailing: naira(entry.price) })).join('')}
        </div>` : ''}
    `,
  };
}

function sellScreen(host: PhoneHost, plot: Plot) {
  const listing = land().listingFor(plot.id);
  const price = host.get(`land.ask.${plot.id}`, String(listing?.askingPrice ?? plot.statePrice));
  const note = host.get(`land.note.${plot.id}`, listing?.description ?? '');
  const asking = amountFrom(price);
  return {
    title: listing ? 'Change the listing' : 'Put up for sale',
    body: `
      <div class="nl-card">
        <div class="nl-card-title">${esc(plot.name)}</div>
        <div class="nl-card-line">${esc(plot.neighbourhood)} · ${Math.round(plot.area)} m². The state's price for it was ${naira(plot.statePrice)}.</div>
      </div>
      <label class="nl-label" for="land-ask">Asking price</label>
      <input class="nl-field" id="land-ask" type="text" inputmode="numeric" autocomplete="off" value="${esc(price)}" data-bind="land.ask.${esc(plot.id)}" data-live />
      <label class="nl-label" for="land-note">What buyers should know (optional)</label>
      <input class="nl-field" id="land-note" type="text" maxlength="200" autocomplete="off" value="${esc(note)}" data-bind="land.note.${esc(plot.id)}" />
      <div class="nl-hint">This is an asking price. Listing sells nothing: the land stays yours until you accept an offer and the buyer has paid. ${Number.isFinite(asking) ? `At ${naira(asking)} you would receive ${naira(asking - Math.round(asking * SALE_FEE_RATE))} after the ${Math.round(SALE_FEE_RATE * 100)}% agent and registry fee.` : ''}</div>
      <button class="nl-btn nl-btn--primary nl-btn--block" id="land-list-btn" data-act="list" data-arg="${esc(plot.id)}">${listing ? 'Save the listing' : 'Put it on the market'}</button>
    `,
  };
}

function buildScreen(host: PhoneHost, plot: Plot) {
  const funds = market().funds();
  const elsewhere = host.world.cityId() !== plot.city;
  const far = elsewhere || host.world.distanceTo((plot.rect.minX + plot.rect.maxX) / 2, (plot.rect.minZ + plot.rect.maxZ) / 2) > 60;
  return {
    title: 'Build',
    body: `
      <div class="nl-card">
        <div class="nl-card-title">${esc(plot.name)}</div>
        <div class="nl-card-line">${plot.rect.maxX - plot.rect.minX} m × ${plot.rect.maxZ - plot.rect.minZ} m · ${plot.uses.map((use) => USE_LABEL[use]).join(' and ')} · up to ${count(plot.maxFloors, 'floor')}</div>
      </div>
      ${far ? `<div class="nl-note nl-note--warn" id="build-far">You choose where a building stands on the plot itself. ${elsewhere ? `It is in ${CITY_NAME[plot.city]}: travel there first.` : 'Go there first.'}</div>` : ''}
      <div class="nl-list" id="build-designs">
        ${land().designsFor(plot.id).map(({ type, why }) => {
          const short = funds < type.cost;
          const blocked = why ?? (short ? `You need ${naira(type.cost - funds)} more` : far ? 'Go to the plot to place it' : null);
          return row({
            icon: type.icon,
            title: esc(type.name),
            sub: `${type.width} m × ${type.depth} m · ${count(type.floors, 'floor')} · ${type.hours} game hours to build<br>${blocked ? `<span class="nl-bad">${esc(blocked)}</span>` : esc(type.incomePerDay > 0 ? `Brings in ${naira(type.incomePerDay)} a day, costs ${naira(type.upkeepPerDay)} a day` : type.blurb)}`,
            trailing: `<strong>${naira(type.cost)}</strong>`,
            attrs: blocked ? `disabled data-design="${type.id}"` : `data-act="place" data-arg="${esc(plot.id)}|${type.id}" data-design="${type.id}"`,
            tone: blocked ? 'muted' : 'default',
            tag: 'button',
          });
        }).join('')}
      </div>
      <div class="nl-hint">Choosing a design shows it on the plot before anything is paid. The cost is taken once, when you confirm where it stands.</div>
    `,
  };
}

function dealScreen(host: PhoneHost, deal: Negotiation) {
  const buying = deal.buyerId === MY_ID;
  const other = market().nameOf(buying ? deal.sellerId : deal.buyerId);
  const myTurn = deal.status === 'open' && deal.awaiting === (buying ? 'buyer' : 'seller');
  const listing = market().listings().find((entry) => entry.id === deal.listingId);
  const typed = host.get(`land.counter.${deal.id}`, '');
  const words: Record<string, string> = { offer: 'offered', counter: 'came back with', accept: 'accepted', reject: 'turned down', cancel: 'withdrew at', complete: 'paid', fail: 'could not complete at' };

  let actions = '';
  if (deal.status === 'open' && myTurn) {
    actions = `
      <button class="nl-btn nl-btn--primary nl-btn--block" id="deal-accept" data-act="accept" data-arg="${esc(deal.id)}">Accept ${naira(deal.amount)}</button>
      <label class="nl-label" for="deal-counter">Or name another price</label>
      <input class="nl-field" id="deal-counter" type="text" inputmode="numeric" autocomplete="off" placeholder="${naira(deal.amount)}" value="${esc(typed)}" data-bind="land.counter.${esc(deal.id)}" />
      <div class="nl-split">
        <button class="nl-btn" id="deal-counter-btn" data-act="counter" data-arg="${esc(deal.id)}">Counter</button>
        <button class="nl-btn nl-btn--danger" id="deal-reject" data-act="reject" data-arg="${esc(deal.id)}">${buying ? 'Walk away' : 'Turn it down'}</button>
      </div>`;
  } else if (deal.status === 'open') {
    actions = `
      <div class="nl-note" id="deal-waiting">Waiting for ${esc(other)} to answer ${naira(deal.amount)}.</div>
      <button class="nl-btn nl-btn--danger nl-btn--block" id="deal-reject" data-act="reject" data-arg="${esc(deal.id)}">${buying ? 'Withdraw my offer' : 'End this negotiation'}</button>`;
  } else if (deal.status === 'accepted') {
    actions = buying
      ? `<div class="nl-note" id="deal-paying">Agreed at ${naira(deal.amount)}. Your payment is being taken and the title moved.</div>
         <button class="nl-btn nl-btn--primary nl-btn--block" id="deal-pay" data-act="pay" data-arg="${esc(deal.id)}">Pay ${naira(deal.amount)} now</button>`
      : `<div class="nl-note" id="deal-paying">Agreed at ${naira(deal.amount)}. It is held for ${esc(other)} until their payment is taken, which happens as soon as they are in the game.</div>
         <button class="nl-btn nl-btn--danger nl-btn--block" id="deal-release" data-act="release" data-arg="${esc(deal.id)}">They have not paid: put it back on the market</button>`;
  } else {
    const last = deal.history[deal.history.length - 1];
    actions = `<div class="nl-note${deal.status === 'completed' ? ' nl-note--good' : ''}" id="deal-over">${deal.status === 'completed'
      ? (buying ? `Yours. You paid ${naira(deal.amount)}.` : `Sold for ${naira(deal.amount)}. ${naira(deal.amount - Math.round(deal.amount * SALE_FEE_RATE))} was paid into your bank account after the fee.`)
      : esc(last?.note ?? (deal.status === 'rejected' ? 'The offer was turned down.' : deal.status === 'cancelled' ? 'The offer was withdrawn.' : 'The sale did not go through. Nothing was paid.'))}</div>`;
  }

  return {
    title: buying ? 'Your offer' : 'Offer received',
    body: `
      <div class="nl-card">
        <div class="nl-card-title">${esc(assetName(deal.asset))}</div>
        <div class="nl-card-line">${buying ? 'Seller' : 'Buyer'}: ${esc(other)}${listing ? ` · asking ${naira(listing.askingPrice)}` : ''}</div>
        <div class="nl-card-line">On the table: <strong id="deal-amount">${naira(deal.amount)}</strong></div>
      </div>
      <div class="nl-chat" id="deal-history">
        ${deal.history.map((step) => {
          const mine = step.by === (buying ? 'buyer' : 'seller');
          return `<div class="nl-bubble nl-bubble--${mine ? 'me' : 'them'}">${mine ? 'You' : esc(other)} ${words[step.action] ?? step.action} ${naira(step.amount)}<span class="nl-bubble-at">${when(step.at)}</span></div>`;
        }).join('')}
      </div>
      ${actions}
      ${deal.asset.kind === 'plot' ? `<button class="nl-btn nl-btn--block" data-go="plot:${esc(deal.asset.id)}">See the plot</button>` : ''}
    `,
  };
}

const KIND_ICON: Record<string, string> = { plot: '🟨', vehicle: '🚙', property: '🏠', business: '🏪' };
const KIND_LABEL: Record<string, string> = { plot: 'Land', vehicle: 'Vehicle', property: 'Home', business: 'Business' };

function listingRow(listing: Listing): string {
  const mine = listing.sellerId === MY_ID;
  return row({
    icon: KIND_ICON[listing.asset.kind] ?? '🏷️',
    title: esc(assetName(listing.asset)),
    sub: `${KIND_LABEL[listing.asset.kind] ?? 'Asset'} · ${mine ? 'Your listing' : `Seller: ${esc(market().nameOf(listing.sellerId))}`}${listing.status === 'pending' ? ' · sale agreed' : ''}`,
    trailing: `<strong>${naira(listing.askingPrice)}</strong>`,
    attrs: listing.asset.kind === 'plot' ? `data-go="plot:${esc(listing.asset.id)}"` : listing.asset.kind === 'vehicle' ? `data-app="garage" data-route="car:${esc(listing.asset.id)}"` : `data-go="listing:${esc(listing.id)}" data-listing="${esc(listing.id)}"`,
  });
}

/** One listing of anything that is not land: a home or a business another player is selling, or this player's own. */
function listingScreen(host: PhoneHost, listing: Listing) {
  const mine = listing.sellerId === MY_ID;
  const offers = market().negotiationsOn(listing.id).filter((deal) => deal.status === 'open' || deal.status === 'accepted');
  const myDeal = offers.find((deal) => deal.buyerId === MY_ID);
  const open = listing.status === 'active';
  let actions = '';
  if (mine) {
    actions = `
      <div class="nl-card">
        <div class="nl-card-line">${listing.status === 'pending' ? 'A sale has been agreed and is waiting for the buyer\'s payment.' : listing.status === 'sold' ? 'Sold.' : listing.status === 'withdrawn' ? 'Taken off the market.' : `${count(offers.length, 'offer')}. It stays yours until you accept one and the buyer has paid.`}</div>
        ${open ? `
          <div class="nl-split">
            <button class="nl-btn nl-btn--sm" data-go="ask:${listing.asset.kind}:${esc(listing.asset.id)}">Change price</button>
            <button class="nl-btn nl-btn--danger nl-btn--sm" id="listing-withdraw" data-act="withdraw" data-arg="${esc(listing.id)}">Take off the market</button>
          </div>` : ''}
      </div>
      ${offers.length ? `<div class="nl-section">Offers</div><div class="nl-list" id="listing-offers">${offers.map(dealRow).join('')}</div>` : ''}`;
  } else if (myDeal) {
    actions = `<div class="nl-list">${dealRow(myDeal)}</div>`;
  } else if (open) {
    actions = `
      <label class="nl-label" for="listing-offer">Your offer</label>
      <input class="nl-field" id="listing-offer" type="text" inputmode="numeric" autocomplete="off" placeholder="${naira(listing.askingPrice)}" value="${esc(host.get(`land.offer.${listing.id}`, ''))}" data-bind="land.offer.${esc(listing.id)}" />
      <div class="nl-hint">${esc(market().nameOf(listing.sellerId))} is asking ${naira(listing.askingPrice)}. Offer that or anything else. You have ${naira(market().funds())} in all.</div>
      <button class="nl-btn nl-btn--primary nl-btn--block" id="listing-offer-btn" data-act="offer" data-arg="${esc(listing.id)}|${esc(listing.id)}">Make this offer</button>`;
  } else {
    actions = `<div class="nl-note" id="listing-closed">${listing.status === 'pending' ? 'A sale to another buyer has been agreed.' : 'This is no longer on the market.'}</div>`;
  }
  return {
    title: KIND_LABEL[listing.asset.kind] ?? 'For sale',
    body: `
      <div class="nl-hero nl-hero--amber">
        <span class="nl-hero-label">${mine ? 'Your listing' : `For sale by ${esc(market().nameOf(listing.sellerId))}`}</span>
        <span class="nl-hero-title">${esc(assetName(listing.asset))}</span>
        <span class="nl-hero-sub">Asking ${naira(listing.askingPrice)}</span>
      </div>
      ${listing.description ? `<div class="nl-note">${esc(listing.description)}</div>` : ''}
      ${actions}
    `,
  };
}

/** Naming an asking price for a home or a business the player owns outright. */
function askScreen(host: PhoneHost, asset: AssetRef) {
  const listing = market().listingFor(asset);
  const guide = asset.kind === 'property' || asset.kind === 'business' ? host.backend.deedPrice(asset.kind, asset.id) : 0;
  const key = `land.ask.${asset.kind}.${asset.id}`;
  const typed = host.get(key, String(listing?.askingPrice ?? guide));
  const asking = amountFrom(typed);
  return {
    title: listing ? 'Change the listing' : 'Sell to another player',
    body: `
      <div class="nl-card">
        <div class="nl-card-title">${KIND_ICON[asset.kind] ?? ''} ${esc(assetName(asset))}</div>
        ${guide ? `<div class="nl-card-line">It cost ${naira(guide)} on the open market.</div>` : ''}
      </div>
      <label class="nl-label" for="asset-ask">Asking price</label>
      <input class="nl-field" id="asset-ask" type="text" inputmode="numeric" autocomplete="off" value="${esc(typed)}" data-bind="${esc(key)}" data-live />
      <label class="nl-label" for="asset-note">What buyers should know (optional)</label>
      <input class="nl-field" id="asset-note" type="text" maxlength="200" autocomplete="off" value="${esc(host.get(`${key}.note`, listing?.description ?? ''))}" data-bind="${esc(key)}.note" />
      <div class="nl-hint">Listing sells nothing: it stays yours until you accept an offer and the buyer has paid. ${Number.isFinite(asking) ? `At ${naira(asking)} you would receive ${naira(asking - Math.round(asking * SALE_FEE_RATE))} after the ${Math.round(SALE_FEE_RATE * 100)}% fee.` : ''}</div>
      <button class="nl-btn nl-btn--primary nl-btn--block" id="asset-list-btn" data-act="list-asset" data-arg="${asset.kind}:${esc(asset.id)}">${listing ? 'Save the listing' : 'Put it on the market'}</button>
    `,
  };
}

// ------------------------------------------------------------------------------------------------
// The app
// ------------------------------------------------------------------------------------------------

export const landApp: PhoneApp = {
  id: 'land',
  aliases: ['exchange', 'plots'],
  name: 'Land',
  icon: '📜',
  tint: ['#3f6212', '#84cc16'],
  purpose: 'Buy land, build on it, and trade it with other players',
  badge: () => market().waitingOnMe(),
  live: () => land().myPlots().some((plot) => !!land().building(plot.id)) || land().myTenancies().length > 0,

  render(host, route) {
    if (route.startsWith('plot:')) {
      const plot = land().plot(route.slice(5));
      return plot ? plotScreen(host, plot) : { title: 'Land', body: empty('🗺️', 'No such plot', 'That plot is not in the land registry.') };
    }
    if (route.startsWith('sell:')) {
      const plot = land().plot(route.slice(5));
      if (plot && land().isMine(plot.id)) return sellScreen(host, plot);
      return { title: 'Land', body: empty('🚫', 'Not yours to sell', 'Only the owner of a plot can put it up for sale.') };
    }
    if (route.startsWith('build:')) {
      const plot = land().plot(route.slice(6));
      if (plot && land().isMine(plot.id)) return buildScreen(host, plot);
      return { title: 'Land', body: empty('🚫', 'Not yours to build on', 'Only the owner of a plot can build on it.') };
    }
    if (route.startsWith('listing:')) {
      const id = route.slice(8);
      const listing = Object.values(market().allListings()).find((entry) => entry.id === id);
      return listing ? listingScreen(host, listing) : { title: 'Market', body: empty('🏷️', 'No such listing', 'It may have been sold or withdrawn.') };
    }
    if (route.startsWith('ask:')) {
      const [, kind, ...rest] = route.split(':');
      const asset = { kind, id: rest.join(':') } as AssetRef;
      if (market().isMine(asset)) return askScreen(host, asset);
      return { title: 'Market', body: empty('🚫', 'Not yours to sell', 'Only the owner can put it up for sale. If you have just bought it, give it a moment to be registered.') };
    }
    if (route.startsWith('deal:')) {
      const deal = market().myNegotiations().find((entry) => entry.id === route.slice(5));
      return deal ? dealScreen(host, deal) : { title: 'Land', body: empty('🤝', 'No such negotiation', 'It may have been closed.') };
    }

    const tab = host.get<string>('land.tab', 'browse');
    const mine = land().myPlots();
    const deals = market().myNegotiations();
    const waiting = market().waitingOnMe();
    let content = '';

    if (tab === 'mine') {
      const rented = land().myTenancies().map((tenancy) => land().plot(tenancy.plotId)).filter((plot): plot is Plot => plot !== null);
      content = mine.length === 0 && rented.length === 0
        ? empty('🟨', 'You own no land', 'Plots for sale are under Browse. The yellow boards around the city mark them.')
        : `${mine.length ? `<div class="nl-list" id="land-mine">${mine.map(plotRow).join('')}</div>` : ''}
           ${rented.length ? `<div class="nl-section">You rent</div><div class="nl-list" id="land-rented">${rented.map(plotRow).join('')}</div>` : ''}`;
    } else if (tab === 'market') {
      const others = market().listings((listing) => listing.asset.kind !== 'plot');
      content = others.length === 0
        ? empty('🏷️', 'Nothing else for sale', 'Homes, businesses and vehicles that players put up for sale appear here. Land is under Browse.')
        : `<div class="nl-list" id="land-market">${others.map(listingRow).join('')}</div>`;
    } else if (tab === 'offers') {
      content = deals.length === 0
        ? empty('🤝', 'No offers', 'Offers you make, and offers on what you are selling, are kept here.')
        : `<div class="nl-list" id="land-deals">${deals.map(dealRow).join('')}</div>`;
    } else if (tab === 'history') {
      const sales = market().mySales();
      content = sales.length === 0
        ? empty('📜', 'Nothing bought or sold yet', 'Every completed sale you are part of is recorded here.')
        : `<div class="nl-list" id="land-sales">${sales.map((sale) => row({
            icon: sale.buyerId === MY_ID ? '🛒' : '💰',
            title: esc(assetName(sale.asset)),
            sub: `${sale.buyerId === MY_ID ? `Bought from ${esc(market().nameOf(sale.sellerId))}` : `Sold to ${esc(market().nameOf(sale.buyerId))}`} · ${when(sale.at)}`,
            trailing: `<strong class="${sale.buyerId === MY_ID ? 'nl-bad' : 'nl-good'}">${sale.buyerId === MY_ID ? '−' : '+'}${naira(sale.buyerId === MY_ID ? sale.price : sale.price - sale.fee)}</strong>`,
          })).join('')}</div>`;
    } else {
      const city = host.get<string>('land.city', host.world.cityId());
      const where = host.get<string>('land.where', 'all');
      const show = host.get<string>('land.show', 'all');
      const use = host.get<string>('land.use', 'all');
      const sort = host.get<string>('land.sort', 'price');
      const search = host.get('land.search', '').trim().toLowerCase();
      const places = Array.from(new Set(land().plots(city).map((plot) => plot.neighbourhood))).sort();
      let list = land().plots(city).filter((plot) => {
        const status = land().status(plot.id);
        if (where !== 'all' && plot.neighbourhood !== where) return false;
        if (show === 'let') {
          const tenancy = land().tenancy(plot.id);
          if (!tenancy || tenancy.ending || isLet(tenancy)) return false;
        }
        if (show === 'sale' && land().askingPrice(plot.id) === null) return false;
        if (show === 'state' && status !== 'available') return false;
        if (show === 'owners' && !(status === 'listed' || status === 'negotiating')) return false;
        if (use !== 'all' && !plot.uses.includes(use as 'residential' | 'commercial')) return false;
        if (search && !`${plot.name} ${plot.neighbourhood} ${plot.street}`.toLowerCase().includes(search)) return false;
        return true;
      });
      const priceOf = (plot: Plot) => land().askingPrice(plot.id) ?? Number.MAX_SAFE_INTEGER;
      list = list.sort((a, b) => (sort === 'size' ? b.area - a.area : sort === 'dear' ? priceOf(b) - priceOf(a) : priceOf(a) - priceOf(b)));
      content = `
        <input class="nl-field nl-field--search" id="land-search" type="search" placeholder="Search by street or area" value="${esc(host.get('land.search', ''))}" data-bind="land.search" />
        ${chips('land.city', city, [['lagos', 'Lagos'], ['abuja', 'Abuja'], ['port_harcourt', 'Port Harcourt']])}
        ${chips('land.show', show, [['all', 'All'], ['sale', 'For sale'], ['state', 'From the state'], ['owners', 'From owners'], ['let', 'To let']])}
        ${chips('land.where', where, [['all', 'Everywhere'], ...places.map((place) => [place, place] as [string, string])])}
        ${chips('land.use', use, [['all', 'Any use'], ['residential', 'Homes'], ['commercial', 'Business']])}
        ${chips('land.sort', sort, [['price', 'Cheapest'], ['dear', 'Dearest'], ['size', 'Biggest']])}
        <div class="nl-list" id="land-list">
          ${list.length === 0 ? empty('🔎', 'No plots match', 'Try a different area or clear the search.') : list.map(plotRow).join('')}
        </div>`;
    }

    return {
      title: 'Land',
      body: `
        <div class="nl-hero nl-hero--green">
          <span class="nl-hero-label">Land registry</span>
          <span class="nl-hero-title" id="land-owned">${count(mine.length, 'plot')} yours</span>
          <span class="nl-hero-sub">${naira(market().funds())} to spend${waiting ? ` · ${count(waiting, 'offer')} waiting for your answer` : ''}</span>
        </div>
        ${chips('land.tab', tab, [['browse', 'Land'], ['market', 'Market'], ['mine', 'Mine'], ['offers', waiting ? `Offers (${waiting})` : 'Offers'], ['history', 'History']])}
        ${content}
        <div class="nl-hint">Ownership here is shared by the players in this browser. There is no server yet, so players on other devices do not see it.</div>
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

    if (action === 'go-in') {
      host.close();
      host.world.goHome();
    } else if (action === 'show') {
      const plot = land().plot(arg);
      if (!plot) return;
      host.world.showPlace((plot.rect.minX + plot.rect.maxX) / 2, (plot.rect.minZ + plot.rect.maxZ) / 2, plot.name);
      host.say(`${plot.name} is marked with a green beam of light.`, 'info');
    } else if (action === 'buy-state') {
      const plot = land().plot(arg);
      if (!plot) return;
      if (!(await host.confirm(`Buy ${plot.name} from ${stateOf(plot)} for ${naira(plot.statePrice)}?`, 'Buy the land'))) return;
      const result = await land().buyFromState(plot.id);
      done(result.ok, `${plot.name} is yours.`, result.reason);
    } else if (action === 'list') {
      const plot = land().plot(arg);
      if (!plot) return;
      const price = amountFrom(host.get(`land.ask.${plot.id}`, String(land().listingFor(plot.id)?.askingPrice ?? plot.statePrice)));
      if (!Number.isFinite(price)) return host.say('Enter an asking price, such as 4500000 or 4.5m.', 'bad');
      const note = host.get(`land.note.${plot.id}`, '');
      const listing = land().listingFor(plot.id);
      const result = listing ? await market().editListing(listing.id, price, note) : await market().list({ kind: 'plot', id: plot.id }, price, note);
      if (result.ok) host.back();
      done(result.ok, `On the market at ${naira(price)}.`, result.reason);
    } else if (action === 'list-asset') {
      const [kind, ...rest] = arg.split(':');
      const asset = { kind, id: rest.join(':') } as AssetRef;
      const key = `land.ask.${asset.kind}.${asset.id}`;
      const listing = market().listingFor(asset);
      const guide = asset.kind === 'property' || asset.kind === 'business' ? host.backend.deedPrice(asset.kind, asset.id) : 0;
      const price = amountFrom(host.get(key, String(listing?.askingPrice ?? guide)));
      if (!Number.isFinite(price)) return host.say('Enter an asking price, such as 2500000 or 2.5m.', 'bad');
      const note = host.get(`${key}.note`, listing?.description ?? '');
      const result = listing ? await market().editListing(listing.id, price, note) : await market().list(asset, price, note);
      if (result.ok) host.back();
      done(result.ok, `On the market at ${naira(price)}.`, result.reason);
    } else if (action === 'withdraw') {
      if (!(await host.confirm('Take it off the market? Any offers on it will lapse.', 'Take it off'))) return;
      const result = await market().withdraw(arg);
      done(result.ok, 'It is off the market. Nothing was sold.', result.reason);
    } else if (action === 'offer') {
      const [listingId, plotId] = arg.split('|');
      const amount = amountFrom(host.get(`land.offer.${plotId}`, ''));
      if (!Number.isFinite(amount)) return host.say('Enter your offer, such as 4200000 or 4.2m.', 'bad');
      const result = await market().offer(listingId, amount);
      if (result.ok) host.set(`land.offer.${plotId}`, '');
      done(result.ok, `Your offer of ${naira(amount)} has gone to the owner.`, result.reason);
    } else if (action === 'counter') {
      const amount = amountFrom(host.get(`land.counter.${arg}`, ''));
      if (!Number.isFinite(amount)) return host.say('Enter the price you want, such as 4700000 or 4.7m.', 'bad');
      const result = await market().counter(arg, amount);
      if (result.ok) host.set(`land.counter.${arg}`, '');
      done(result.ok, `You came back with ${naira(amount)}.`, result.reason);
    } else if (action === 'accept') {
      const deal = market().myNegotiations().find((entry) => entry.id === arg);
      if (!deal) return;
      const buying = deal.buyerId === MY_ID;
      if (!(await host.confirm(buying ? `Pay ${naira(deal.amount)} and take ownership?` : `Sell for ${naira(deal.amount)}? You will receive ${naira(deal.amount - Math.round(deal.amount * SALE_FEE_RATE))} after the fee.`, buying ? 'Pay and buy' : 'Accept the offer'))) return;
      const result = await market().accept(arg);
      done(result.ok, buying ? 'Paid. It is yours.' : 'Accepted. It completes when the buyer\'s payment is taken.', result.reason);
    } else if (action === 'pay') {
      const result = await market().complete(arg);
      done(result.ok, 'Paid. It is yours.', result.reason);
    } else if (action === 'reject') {
      const result = await market().reject(arg);
      done(result.ok, 'The negotiation is closed. Nothing was paid.', result.reason);
    } else if (action === 'release') {
      const result = await market().release(arg);
      done(result.ok, 'It is back on the market.', result.reason);
    } else if (action === 'place') {
      const [plotId, typeId] = arg.split('|');
      host.close();
      host.world.placeBuilding(plotId, typeId);
    } else if (action === 'stop-work') {
      const building = land().building(arg);
      const type = building ? buildingType(building.typeId) : null;
      if (!building || !type) return;
      if (!(await host.confirm(`Stop work on the ${type.name.toLowerCase()}? ${naira(refundOnCancel(type, hoursDone(building)))} of the ${naira(type.cost)} comes back and what has been built is cleared away.`, 'Stop the work'))) return;
      const result = await land().cancelBuilding(arg);
      done(result.ok, `Work stopped. ${naira(result.refund ?? 0)} was paid back.`, result.reason);
    } else if (action === 'demolish') {
      const building = land().building(arg);
      const type = building ? buildingType(building.typeId) : null;
      if (!type) return;
      if (!(await host.confirm(`Pull down the ${type.name.toLowerCase()}? It costs ${naira(demolitionCost(type))} and nothing comes back.`, 'Pull it down'))) return;
      const result = await land().demolish(arg);
      done(result.ok, 'The building is gone. The plot is empty again.', result.reason);
    } else if (action === 'offer-let') {
      const rent = amountFrom(host.get(`land.rent.${arg}`, ''));
      const building = land().building(arg);
      const type = building ? buildingType(building.typeId) : null;
      const asked = Number.isFinite(rent) ? rent : land().tenancy(arg)?.rentPerWeek ?? (type ? Math.max(5000, Math.round((type.cost * 0.02) / 1000) * 1000) : NaN);
      if (!Number.isFinite(asked)) return host.say('Enter a weekly rent, such as 60000 or 60k.', 'bad');
      const result = await land().offerToLet(arg, asked);
      done(result.ok, `To let at ${naira(asked)} a week.`, result.reason);
    } else if (action === 'stop-letting') {
      const tenanted = isLet(land().tenancy(arg));
      if (tenanted && !(await host.confirm('Give the tenant notice? They stay until the rent they have paid runs out, and cannot renew.', 'Give notice'))) return;
      const result = await land().stopLetting(arg);
      done(result.ok, result.notice ? 'Notice given. The tenancy ends when the paid-up time runs out.' : 'It is no longer offered to let.', result.reason);
    } else if (action === 'pay-rent') {
      const tenancy = land().tenancy(arg);
      if (!tenancy) return;
      const first = !isLet(tenancy);
      if (first && !(await host.confirm(`Rent it for ${naira(tenancy.rentPerWeek)} a week? The first week is paid now.`, 'Rent it'))) return;
      const result = await land().payRent(arg);
      done(result.ok, first ? 'It is yours to use. A week is paid.' : 'Another week is paid.', result.reason);
    } else if (action === 'leave-let') {
      if (!(await host.confirm('Give the place up now? The rent already paid is not returned.', 'Give it up'))) return;
      const result = await land().leaveTenancy(arg);
      done(result.ok, 'You have given it up.', result.reason);
    } else if (action === 'collect') {
      const result = await land().collect(arg);
      done(result.ok, `${naira(result.amount ?? 0)} paid into your bank account.`, result.reason);
    }
  },
};
