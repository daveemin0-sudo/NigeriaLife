import { BackendService } from '../backend/BackendService';
import { esc, naira } from './kit/html';
import { UIStateManager } from './UIStateManager';

export interface TopMenuHooks {
  /** The Today panel: hustles, ladder, album, season */
  openToday?: () => void;
  today?: () => string;
  clock(): string;
  city(): string;
  openQuests(): void;
  openMusic(): void;
  openFleet(): void;
  openApp(app: string): void;
  openMap(): void;
  cashMachine(): void;
  musicPlaying(): boolean;
  /** Lagos State House, and who governs now */
  openStateHouse(): void;
  governor(): string | null;
}

/**
 * The drop-down under the top bar: the time and the day, the player's needs at a glance, their
 * money, and one tap to everything else (missions, music, cars, jets and yachts, jobs, bank,
 * business, the map, settings).
 */
export class TopMenu {
  private readonly el: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly hooks: TopMenuHooks;

  constructor(hooks: TopMenuHooks) {
    this.hooks = hooks;
    this.button = document.createElement('button');
    this.button.id = 'top-menu-btn';
    this.button.className = 'top-menu-btn';
    this.button.type = 'button';
    this.button.setAttribute('aria-label', 'Menu');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.innerHTML = '<span aria-hidden="true">⌄</span>';
    this.button.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    document.body.appendChild(this.button);

    this.el = document.createElement('div');
    this.el.id = 'top-menu';
    this.el.className = 'top-menu';
    this.el.setAttribute('role', 'menu');
    this.el.hidden = true;
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    UIStateManager.getInstance().registerModal('top-menu', { id: 'top-menu', close: () => this.close(), isOpen: () => this.isOpen });
  }

  public get isOpen(): boolean {
    return !this.el.hidden;
  }

  public open(): void {
    this.render();
    this.el.hidden = false;
    this.button.classList.add('is-open');
    this.button.setAttribute('aria-expanded', 'true');
    UIStateManager.getInstance().pushModal('top-menu');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.hidden = true;
    this.button.classList.remove('is-open');
    this.button.setAttribute('aria-expanded', 'false');
    UIStateManager.getInstance().popModal('top-menu');
  }

  private render(): void {
    const data = BackendService.getInstance().getData();
    const st = data.stats as unknown as Record<string, number>;
    const need = (key: string, icon: string, label: string, colour: string) => {
      const v = Math.max(0, Math.min(100, Math.round(st[key] ?? 50)));
      return `<div class="tm-need" title="${label} ${v}"><span>${icon}</span><i><b style="width:${v}%;background:${colour}"></b></i></div>`;
    };
    const row = (action: string, icon: string, title: string, sub: string, trailing = '›') =>
      `<button class="tm-row" data-act="${action}"><span class="tm-icon">${icon}</span><span class="tm-text"><strong>${esc(title)}</strong><em>${esc(sub)}</em></span><span class="tm-trail">${trailing}</span></button>`;
    const total = data.walletCash + data.bank.balance;
    this.el.innerHTML = `
      <div class="tm-head">
        <div><strong class="tm-clock">${esc(this.hooks.clock())}</strong><span class="tm-city">${esc(this.hooks.city())}</span></div>
        <button class="cat-round" data-act="close" aria-label="Close">✕</button>
      </div>
      <div class="tm-needs">
        ${need('hunger', '🍲', 'Hunger', '#f59e0b')}${need('energy', '⚡', 'Energy', '#3b82f6')}${need('fun', '🎉', 'Fun', '#eab308')}
        ${need('social', '💬', 'Social', '#ec4899')}${need('hygiene', '🫧', 'Hygiene', '#14b8a6')}${need('bladder', '🚽', 'Bladder', '#8b5cf6')}${need('health', '❤️', 'Health', '#ef4444')}
      </div>
      ${row('wallet', '👛', naira(total), `Cash ${naira(data.walletCash)} · Bank ${naira(data.bank.balance)}`, '<b class="tm-plus">+</b>')}
      ${row('today', '🔥', "Today's hustle", this.hooks.today?.() ?? 'Three hustles, your streak, the ladder and the album')}
      ${row('quests', '🎯', 'Story missions', 'The story across the three cities')}
      ${row('music', '🎵', 'Music', this.hooks.musicPlaying() ? 'Playing now' : 'Afrobeats, Amapiano and your own songs')}
      ${row('fleet', '✈️', 'Jets & yachts', 'Buy, paint your name on, fly and cruise')}
      ${row('state', '🏛️', 'Lagos State House', this.hooks.governor() ? `Governor @${this.hooks.governor()} · laws and the election` : 'The weekly election is on')}
      <div class="tm-grid">
        <button class="tm-chip" data-act="app:garage">🚗<span>Cars</span></button>
        <button class="tm-chip" data-act="app:jobs">💼<span>Jobs</span></button>
        <button class="tm-chip" data-act="app:business">🏢<span>Business</span></button>
        <button class="tm-chip" data-act="app:bank">🏦<span>Bank</span></button>
        <button class="tm-chip" data-act="app:property">🏠<span>Houses</span></button>
        <button class="tm-chip" data-act="map">🗺️<span>Map</span></button>
        <button class="tm-chip" data-act="app:messages">💬<span>Messages</span></button>
        <button class="tm-chip" data-act="app:settings">⚙️<span>Settings</span></button>
      </div>`;
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    const act = target.dataset.act!;
    this.close();
    if (act === 'close') return;
    if (act === 'wallet') this.hooks.cashMachine();
    else if (act === 'quests') this.hooks.openQuests();
    else if (act === 'today') this.hooks.openToday?.();
    else if (act === 'music') this.hooks.openMusic();
    else if (act === 'fleet') this.hooks.openFleet();
    else if (act === 'state') this.hooks.openStateHouse();
    else if (act === 'map') this.hooks.openMap();
    else if (act.startsWith('app:')) this.hooks.openApp(act.slice(4));
  }
}
