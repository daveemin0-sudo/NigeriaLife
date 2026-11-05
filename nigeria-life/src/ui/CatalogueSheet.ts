import { esc, naira } from './kit/html';
import { showGameToast } from './GameToast';
import { FurnitureThumbs } from './FurnitureThumbs';
import type { FurnitureKind } from '../housing/FurnitureModels';

/** What the sheet needs from the furniture system (kept narrow so the two do not tangle) */
export interface CatalogueHost {
  items(): ReadonlyArray<{ id: string; name: string; category: string; price: number; icon: string; description: string; modelType: string; isNew?: boolean }>;
  kind(modelType: string): FurnitureKind;
  footprint(modelType: string, turns: number): { width: number; depth: number };
  money(): number;
  stored(): readonly string[];
  begin(itemId: string, stored: boolean): boolean;
  walls(): ReadonlyArray<{ id: string; name: string; hex: number }>;
  floors(): ReadonlyArray<{ id: string; name: string; hex: number }>;
  wallNow(): string;
  floorNow(): string;
  paintPrice: number;
  floorPrice: number;
  paint(id: string): { ok: boolean; reason?: string };
  fitFloor(id: string): { ok: boolean; reason?: string };
  opened(): void;
  closed(): void;
}

type Item = ReturnType<CatalogueHost['items']>[number];

interface Section {
  id: string;
  icon: string;
  label: string;
  has: (item: Item, kind: FurnitureKind) => boolean;
}

const SECTIONS: Section[] = [
  { id: 'seating', icon: '🛋️', label: 'Seating', has: (i, k) => k.use === 'seat' && !/dining|kitchen|plastic|toilet/.test(i.modelType) },
  { id: 'beds', icon: '🛏️', label: 'Beds', has: (i, k) => k.use === 'bed' || /wardrobe|closet|nightstand/.test(i.modelType) },
  { id: 'tv', icon: '📺', label: 'TV & fun', has: (_i, k) => ['tv', 'game', 'music', 'snooker'].includes(k.use) },
  { id: 'kitchen', icon: '🍳', label: 'Kitchen & dining', has: (i, k) => k.use === 'cook' || k.use === 'drink' || /dining|fridge|freezer|kitchen|plastic/.test(i.modelType) },
  { id: 'bath', icon: '🛁', label: 'Bath', has: (i, k) => k.use === 'bath' || k.use === 'clean' || /toilet|towel/.test(i.modelType) },
  { id: 'power', icon: '⚡', label: 'Power & air', has: (i, k) => k.use === 'power' || i.category === 'power' || /fan|split_ac/.test(i.modelType) },
  { id: 'work', icon: '💼', label: 'Work & gym', has: (_i, k) => k.use === 'work' || k.use === 'fitness' },
  { id: 'decor', icon: '🖼️', label: 'Decor', has: () => true },
];

const PRICES: Array<{ id: string; label: string; min: number; max: number }> = [
  { id: 'any', label: 'Any price', min: 0, max: Infinity },
  { id: 'low', label: 'Under ₦50k', min: 0, max: 50_000 },
  { id: 'mid', label: '₦50k – ₦250k', min: 50_000, max: 250_000 },
  { id: 'high', label: '₦250k – ₦1m', min: 250_000, max: 1_000_000 },
  { id: 'top', label: 'Over ₦1m', min: 1_000_000, max: Infinity },
];

/** What a piece does for the player, in a word, for the card */
const NEED: Record<string, string> = {
  seat: '+Comfort', bed: '+Energy', tv: '+Fun', game: '+Fun', music: '+Fun', snooker: '+Fun', cook: '+Food', drink: '+Food',
  bath: '+Hygiene', clean: '+Hygiene', fitness: '+Fitness', work: '+Skills', power: 'No blackout', none: '+Mood',
};

const stars = (price: number) => '★'.repeat(price < 30_000 ? 1 : price < 150_000 ? 2 : price < 600_000 ? 3 : 4);

/**
 * The catalogue, as a sheet from the bottom of the screen: tabs for what is new, what is in
 * storage, everything, each kind of thing and the walls and floors; a price filter and a
 * search; a card with a picture for every piece. One tap starts putting a piece down; with
 * "Pick several" on, taps fill a basket that is then put down one piece after another.
 */
export class CatalogueSheet {
  private readonly host: CatalogueHost;
  private readonly el: HTMLDivElement;
  private tab = 'all';
  private price = 'any';
  private query = '';
  private searching = false;
  private picking = false;
  private basket: string[] = [];
  /** Pieces still to be put down from the basket, after the one being put down now */
  private queue: string[] = [];
  private sectionOf = new Map<string, string>();

  constructor(host: CatalogueHost) {
    this.host = host;
    this.el = document.createElement('div');
    this.el.id = 'house-catalogue-modal';
    this.el.className = 'cat-sheet';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Catalogue');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    this.el.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.matches('[data-query]')) {
        this.query = target.value.trim().toLowerCase();
        this.renderGrid();
      }
    });
    this.el.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      if (target.matches('[data-price]')) {
        this.price = target.value;
        this.renderGrid();
      }
    });
  }

  public get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  public open(): void {
    this.render();
    this.el.style.display = 'flex';
    this.host.opened();
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    this.host.closed();
  }

  /** A piece has been put down or given up: the next one picked, if several were. Decorate opens the catalogue again. */
  public placingEnded(placed: boolean): void {
    if (placed && this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (this.host.begin(next, false)) return;
    }
    this.queue = [];
  }

  private section(item: Item): string {
    let id = this.sectionOf.get(item.id);
    if (!id) {
      const kind = this.host.kind(item.modelType);
      id = /partition/.test(item.modelType) ? 'design' : (SECTIONS.find((s) => s.has(item, kind))?.id ?? 'decor');
      this.sectionOf.set(item.id, id);
    }
    return id;
  }

  private shown(): Item[] {
    const all = this.host.items();
    const stored = this.host.stored();
    const band = PRICES.find((p) => p.id === this.price) ?? PRICES[0];
    let list = all.filter((item) => {
      if (this.tab === 'new') return !!item.isNew;
      if (this.tab === 'storage') return stored.includes(item.id);
      if (this.tab === 'all') return true;
      return this.section(item) === this.tab;
    });
    if (this.tab !== 'storage') list = list.filter((item) => item.price >= band.min && item.price < band.max);
    if (this.query) list = list.filter((item) => `${item.name} ${item.description}`.toLowerCase().includes(this.query));
    return list.sort((a, b) => a.price - b.price);
  }

  private render(): void {
    const stored = this.host.stored().length;
    const tabs = [
      { id: 'new', label: '✨ New' },
      { id: 'storage', label: `📦 Storage${stored ? ` <b>${stored}</b>` : ''}` },
      { id: 'all', label: '▦ All' },
      ...SECTIONS.map((s) => ({ id: s.id, label: `${s.icon} ${s.label}` })),
      { id: 'design', label: '🎨 Walls & floors' },
    ];
    this.el.innerHTML = `
      <div class="cat-grab" aria-hidden="true"></div>
      <div class="cat-head">
        <div class="cat-title">
          <strong>Catalogue</strong>
          <span class="cat-wallet">${naira(this.host.money())} to spend</span>
        </div>
        <button class="cat-round" data-search aria-label="Search the catalogue">🔍</button>
        <button class="cat-round" id="btn-close-catalogue" data-close aria-label="Close the catalogue">✕</button>
      </div>
      <div class="cat-search" ${this.searching ? '' : 'hidden'}>
        <input type="search" data-query placeholder="Search beds, TVs, fans…" value="${esc(this.query)}" aria-label="Search the catalogue">
      </div>
      <div class="cat-tabs" role="tablist">
        ${tabs.map((t) => `<button class="cat-tab${t.id === this.tab ? ' is-on' : ''}" role="tab" aria-selected="${t.id === this.tab}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div class="cat-filters">
        <label class="cat-select"><span class="sr-only">Price</span>
          <select data-price>${PRICES.map((p) => `<option value="${p.id}" ${p.id === this.price ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select>
        </label>
        <button class="cat-pill${this.picking ? ' is-on' : ''}" data-pick aria-pressed="${this.picking}">☑ Pick several</button>
        <span class="cat-count" data-count></span>
      </div>
      <div class="cat-body" data-body></div>
      <div class="cat-basket" data-basket hidden></div>
    `;
    this.renderGrid();
  }

  private renderGrid(): void {
    const body = this.el.querySelector<HTMLDivElement>('[data-body]');
    if (!body) return;
    const money = this.host.money();
    const stored = this.host.stored();
    if (this.tab === 'design') {
      const swatch = (kind: 'wall' | 'floor', list: ReadonlyArray<{ id: string; name: string; hex: number }>, now: string) =>
        list.map((c) => `<button class="cat-swatch${c.id === now ? ' is-on' : ''}" data-${kind}="${c.id}" title="${esc(c.name)}"><span style="background:#${c.hex.toString(16).padStart(6, '0')}"></span><em>${esc(c.name)}${c.id === now ? ' ✓' : ''}</em></button>`).join('');
      const walls = this.host.items().filter((item) => this.section(item) === 'design');
      body.innerHTML = `
        <h4 class="cat-h">Paint the walls · ${naira(this.host.paintPrice)}</h4>
        <div class="cat-swatches">${swatch('wall', this.host.walls(), this.host.wallNow())}</div>
        <h4 class="cat-h">Lay a new floor · ${naira(this.host.floorPrice)}</h4>
        <div class="cat-swatches">${swatch('floor', this.host.floors(), this.host.floorNow())}</div>
        <h4 class="cat-h">Walls to split a room</h4>
        <div class="cat-grid">${walls.map((item) => this.card(item, money, stored)).join('')}</div>
      `;
    } else {
      const list = this.shown();
      body.innerHTML = list.length
        ? `<div class="cat-grid">${list.map((item) => this.card(item, money, stored)).join('')}</div>`
        : `<p class="cat-empty">${this.tab === 'storage' ? 'Nothing in storage. Tap a piece in your home and choose “Put it in storage”.' : 'Nothing here at that price. Try another price or tab.'}</p>`;
      const count = this.el.querySelector('[data-count]');
      if (count) count.textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
    }
    body.querySelectorAll<HTMLImageElement>('img[data-model]').forEach((img) => FurnitureThumbs.show(img.dataset.model!, img));
    this.renderBasket();
  }

  private card(item: Item, money: number, stored: readonly string[]): string {
    const kind = this.host.kind(item.modelType);
    const size = this.host.footprint(item.modelType, 0);
    const tiles = `${Math.max(1, Math.round(size.width))}×${Math.max(1, Math.round(size.depth))}`;
    const owned = stored.filter((id) => id === item.id).length;
    const inStorage = this.tab === 'storage' && owned > 0;
    const short = !inStorage && item.price > money;
    const picked = this.basket.filter((id) => id === item.id).length;
    return `
      <button class="cat-card${short ? ' is-short' : ''}${picked ? ' is-picked' : ''}" data-item-id="${item.id}" ${inStorage ? 'data-stored' : ''} aria-label="${esc(item.name)}, ${inStorage ? 'in storage' : naira(item.price)}">
        <span class="cat-card-top"><span class="cat-tiles">${kind.mount === 'wall' ? 'wall' : tiles}</span><span class="cat-stars">${stars(item.price)}</span></span>
        ${item.isNew && this.tab !== 'new' ? '<span class="cat-new">NEW</span>' : ''}
        ${picked ? `<span class="cat-picked">✓${picked > 1 ? ` ${picked}` : ''}</span>` : ''}
        <img class="cat-img" data-model="${item.modelType}" alt="" draggable="false">
        <span class="cat-name">${esc(item.name)}</span>
        <span class="cat-price">${inStorage ? `In storage${owned > 1 ? ` ×${owned}` : ''}` : naira(item.price)}</span>
        <span class="cat-need">${NEED[kind.use] ?? '+Mood'}</span>
      </button>`;
  }

  private renderBasket(): void {
    const bar = this.el.querySelector<HTMLDivElement>('[data-basket]');
    if (!bar) return;
    if (!this.picking || this.basket.length === 0) {
      bar.hidden = true;
      return;
    }
    const items = this.host.items();
    const total = this.basket.reduce((sum, id) => sum + (items.find((i) => i.id === id)?.price ?? 0), 0);
    bar.hidden = false;
    bar.innerHTML = `
      <span><b>${this.basket.length} picked</b> · ${naira(total)}</span>
      <button class="cat-pill" data-clear>Clear</button>
      <button class="cat-go" data-place-all ${total > this.host.money() ? 'disabled' : ''}>${total > this.host.money() ? 'Not enough money' : 'Place them'}</button>`;
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || !this.el.contains(target)) return;
    if ('close' in target.dataset) return this.close();
    if ('search' in target.dataset) {
      this.searching = !this.searching;
      if (!this.searching) this.query = '';
      this.render();
      if (this.searching) this.el.querySelector<HTMLInputElement>('[data-query]')?.focus();
      return;
    }
    if (target.dataset.tab) {
      this.tab = target.dataset.tab;
      this.render();
      return;
    }
    if ('pick' in target.dataset) {
      this.picking = !this.picking;
      if (!this.picking) this.basket = [];
      this.render();
      return;
    }
    if ('clear' in target.dataset) {
      this.basket = [];
      this.renderGrid();
      return;
    }
    if ('placeAll' in target.dataset) {
      const [first, ...rest] = this.basket;
      this.basket = [];
      this.picking = false;
      this.queue = rest;
      if (!first || !this.host.begin(first, false)) this.queue = [];
      return;
    }
    if (target.dataset.wall || target.dataset.floor) {
      const done = target.dataset.wall ? this.host.paint(target.dataset.wall) : this.host.fitFloor(target.dataset.floor!);
      if (done.ok) showGameToast(target.dataset.wall ? `The walls are painted. ${naira(this.host.paintPrice)} paid.` : `The new floor is down. ${naira(this.host.floorPrice)} paid.`, 'success');
      else showGameToast(done.reason ?? 'That could not be done.', 'warning');
      this.render();
      return;
    }
    const id = target.dataset.itemId;
    if (!id) return;
    const item = this.host.items().find((i) => i.id === id);
    if (!item) return;
    const stored = 'stored' in target.dataset;
    if (this.picking && !stored) {
      const at = this.basket.indexOf(id);
      if (at >= 0 && event.detail !== 2) this.basket.splice(at, 1);
      else this.basket.push(id);
      this.renderGrid();
      return;
    }
    if (!stored && item.price > this.host.money()) {
      showGameToast(`${item.name} is ${naira(item.price)}. You need ${naira(item.price - this.host.money())} more.`, 'warning', 3200);
      return;
    }
    this.host.begin(id, stored);
  }
}
