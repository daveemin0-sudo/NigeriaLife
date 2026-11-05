import { Fleet, FLEET_COLOURS, FLEET_MODELS, FLEET_SPACES, fleetModel, type FleetKind } from '../assets/Fleet';
import { BackendService } from '../backend/BackendService';
import { esc, naira } from './kit/html';
import { showGameToast } from './GameToast';
import { FurnitureThumbs } from './FurnitureThumbs';
import { UIStateManager } from './UIStateManager';

/**
 * Private jets and yachts: what is for sale, with a picture and the price; buying one with the
 * name to paint on it and its colour; and the ones owned, to repaint or sell.
 */
export class FleetSheet {
  private readonly fleet = Fleet.get();
  private readonly el: HTMLDivElement;
  private tab: FleetKind | 'mine' = 'jet';
  private choosing: string | null = null;
  private colour = 'white';
  private name = '';

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'fleet-sheet';
    this.el.className = 'cat-sheet';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Jets and yachts');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    this.el.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.matches('[data-name]')) this.name = target.value;
    });
    this.fleet.onChange(() => this.isOpen && this.render());
    UIStateManager.getInstance().registerModal('fleet', { id: 'fleet', close: () => this.close(), isOpen: () => this.isOpen });
  }

  public get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  public open(tab: FleetKind | 'mine' = 'jet'): void {
    this.tab = tab;
    this.choosing = null;
    this.render();
    this.el.style.display = 'flex';
    UIStateManager.getInstance().pushModal('fleet');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    UIStateManager.getInstance().popModal('fleet');
  }

  private money(): number {
    const data = BackendService.getInstance().getData();
    return data.walletCash + data.bank.balance;
  }

  private render(): void {
    const money = this.money();
    const tabs = [
      { id: 'jet', label: '✈️ Private jets' },
      { id: 'yacht', label: '🛥️ Yachts' },
      { id: 'mine', label: `⭐ Mine <b>${this.fleet.mine().length}</b>` },
    ];
    let body: string;
    if (this.choosing) {
      const model = fleetModel(this.choosing)!;
      body = `
        <div class="fleet-buy">
          <img class="cat-img" data-model="fleet:${model.id}:${this.colour}" alt="">
          <h4 class="cat-h">${esc(model.name)} · ${naira(model.price)}</h4>
          <p class="music-note">${esc(model.blurb)}</p>
          <label class="fleet-label">Name to paint on it
            <input class="fleet-input" data-name maxlength="16" placeholder="e.g. BIG DAVE" value="${esc(this.name)}">
          </label>
          <div class="cat-swatches">${FLEET_COLOURS.map((c) => `<button class="cat-swatch${c.id === this.colour ? ' is-on' : ''}" data-colour="${c.id}"><span style="background:#${c.hex.toString(16).padStart(6, '0')}"></span><em>${esc(c.name)}</em></button>`).join('')}</div>
          <div class="fleet-actions">
            <button class="cat-pill" data-back>Back</button>
            <button class="cat-go" data-buy ${model.price > money ? 'disabled' : ''}>${model.price > money ? `Need ${naira(model.price - money)} more` : `Buy for ${naira(model.price)}`}</button>
          </div>
        </div>`;
    } else if (this.tab === 'mine') {
      const mine = this.fleet.mine();
      body = mine.length
        ? `<div class="cat-grid">${mine.map((c) => {
            const m = fleetModel(c.modelId)!;
            return `<div class="cat-card"><img class="cat-img" data-model="fleet:${m.id}:${c.colour}" alt=""><span class="cat-name">"${esc(c.name)}"</span><span class="cat-price">${esc(m.name)}</span>
              <span class="fleet-row"><button class="cat-pill" data-repaint="${c.uid}">Repaint</button><button class="cat-pill" data-sell="${c.uid}">Sell ${naira(Math.round(m.price * 0.7))}</button></span></div>`;
          }).join('')}</div>`
        : '<p class="cat-empty">You own no jet or yacht yet. Jets stand at Eko Executive Airfield on the mainland; yachts berth at Eko Marina by the bridge.</p>';
    } else {
      const kind = this.tab;
      const room = FLEET_SPACES[kind] - this.fleet.mine(kind).length;
      body = `<p class="music-note">${kind === 'jet' ? `Kept at Eko Executive Airfield (mainland, after the bridge). Stands free: ${room}.` : `Berthed at Eko Marina, by the lagoon bridge. Berths free: ${room}.`}</p>
        <div class="cat-grid">${FLEET_MODELS.filter((m) => m.kind === kind).map((m) => `
          <button class="cat-card${m.price > money ? ' is-short' : ''}" data-choose="${m.id}">
            <span class="cat-card-top"><span class="cat-tiles">${m.length} m</span><span class="cat-stars">${m.seats} ${kind === 'jet' ? 'seats' : 'guests'}</span></span>
            <img class="cat-img" data-model="fleet:${m.id}:white" alt="">
            <span class="cat-name">${esc(m.name)}</span>
            <span class="cat-price">${naira(m.price)}</span>
          </button>`).join('')}</div>`;
    }
    this.el.innerHTML = `
      <div class="cat-grab" aria-hidden="true"></div>
      <div class="cat-head">
        <div class="cat-title"><strong>Jets & yachts</strong><span class="cat-wallet">${naira(money)} to spend</span></div>
        <button class="cat-round" data-close aria-label="Close">✕</button>
      </div>
      <div class="cat-tabs">${tabs.map((t) => `<button class="cat-tab${t.id === this.tab && !this.choosing ? ' is-on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</div>
      <div class="cat-body">${body}</div>`;
    this.el.querySelectorAll<HTMLImageElement>('img[data-model]').forEach((img) => FurnitureThumbs.show(img.dataset.model!, img));
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    if ('close' in target.dataset) return this.close();
    if (target.dataset.tab) {
      this.tab = target.dataset.tab as FleetKind | 'mine';
      this.choosing = null;
      return this.render();
    }
    if (target.dataset.choose) {
      this.choosing = target.dataset.choose;
      this.colour = 'white';
      return this.render();
    }
    if ('back' in target.dataset) {
      this.choosing = null;
      return this.render();
    }
    if (target.dataset.colour) {
      this.colour = target.dataset.colour;
      return this.render();
    }
    if ('buy' in target.dataset && this.choosing) {
      const model = fleetModel(this.choosing)!;
      const refused = this.fleet.buy(model.id, this.name, this.colour);
      if (refused) {
        showGameToast(refused, 'warning', 4000);
        return;
      }
      showGameToast(model.kind === 'jet' ? `✈️ Your ${model.name} is on its stand at Eko Executive Airfield. Congratulations!` : `🛥️ Your ${model.name} is berthed at Eko Marina. Congratulations!`, 'success', 6000);
      this.choosing = null;
      this.tab = 'mine';
      return this.render();
    }
    if (target.dataset.repaint) {
      const craft = this.fleet.mine().find((c) => c.uid === target.dataset.repaint);
      if (!craft) return;
      const next = FLEET_COLOURS[(FLEET_COLOURS.findIndex((c) => c.id === craft.colour) + 1) % FLEET_COLOURS.length];
      const name = window.prompt('Name to paint on it', craft.name) ?? craft.name;
      this.fleet.repaint(craft.uid, name, next.id);
      showGameToast(`Repainted ${next.name.toLowerCase()}, "${name.toUpperCase()}".`, 'success');
      return;
    }
    if (target.dataset.sell) {
      const value = this.fleet.sell(target.dataset.sell);
      if (value) showGameToast(`Sold for ${naira(value)}.`, 'success');
    }
  }
}
