import { BackendService } from '../backend/BackendService';
import type { PhoneApp, PhoneHost, PhoneWorld } from '../phone/PhoneApp';
import type { RideService } from '../phone/services/RideService';
import type { DeliveryService } from '../phone/services/DeliveryService';
import type { MessageService } from '../phone/services/MessageService';
import type { Market } from '../phone/services/Market';
import { bankApp, investApp, businessApp } from '../phone/apps/money';
import { jobsApp, propertyApp, healthApp, settingsApp } from '../phone/apps/life';
import { rideApp, shoppingApp, peopleApp } from '../phone/apps/out';
import { landApp } from '../phone/apps/land';
import { garageApp } from '../phone/apps/garage';
import { UIStateManager } from './UIStateManager';
import { draw } from './kit/StableView';
import { esc, naira, meter } from './kit/html';

/** The apps on the phone, in the order they sit on the home screen. Every one of them does something real. */
const APPS: PhoneApp[] = [
  peopleApp, bankApp, jobsApp, rideApp,
  shoppingApp, propertyApp, landApp, garageApp,
  businessApp, investApp, healthApp, settingsApp,
];

/** Things the phone opens elsewhere in the game instead of showing itself. */
const SHORTCUTS: Array<{ id: string; name: string; icon: string; open: (world: PhoneWorld) => void }> = [
  { id: 'map', name: 'Map', icon: '🗺️', open: (world) => world.openMap() },
  { id: 'flights', name: 'Flights', icon: '✈️', open: (world) => world.openFlights() },
  { id: 'bag', name: 'Bag', icon: '🎒', open: (world) => world.openBag() },
  { id: 'quests', name: 'Quests', icon: '🎯', open: (world) => world.openQuests() },
  { id: 'camera', name: 'Camera', icon: '📸', open: (world) => world.openCamera() },
];

export interface PhoneServices {
  world: PhoneWorld;
  rides: RideService;
  deliveries: DeliveryService;
  messages: MessageService;
  market: Market;
}

interface Place {
  app: string;
  route: string;
}

/**
 * The phone. The handset is built once and stays; only the screen inside it is redrawn, and
 * that goes through `draw`, so a list keeps its place while the game carries on underneath.
 * Going to another app or another page of an app is a new screen and starts at the top.
 */
export class PhoneModal {
  public isOpen = false;
  /** Kept for callers that still set them; the phone reaches the game through `connect` */
  public onOpenPhotoMode?: () => void;
  public onFastTravel?: (pos: { x: number; y: number; z: number }, propName: string) => void;

  private readonly container: HTMLDivElement;
  private readonly backend = BackendService.getInstance();
  private screen!: HTMLElement;
  private titleEl!: HTMLElement;
  private backEl!: HTMLButtonElement;
  private noticeEl!: HTMLElement;
  private clockEl!: HTMLElement;
  private placeEl!: HTMLElement;
  private confirmEl!: HTMLElement;

  private services: PhoneServices | null = null;
  private host: PhoneHost | null = null;
  private stack: Place[] = [{ app: 'home', route: '' }];
  private memory = new Map<string, unknown>();
  private noticeTimer: number | null = null;
  private answer: ((yes: boolean) => void) | null = null;
  /** The next draw is a different screen from the last one */
  private fresh = true;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'smartphone-wrapper';
    this.container.className = 'phone-closed';
    document.body.appendChild(this.container);
    this.build();

    this.backend.subscribe(() => this.refresh());
    // Escape is the back button: out of a question, then back a screen, and from the home screen the phone goes away
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.isOpen) return;
      if (!this.answer && this.stack.length <= 1) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.answer) this.settle(false);
      else this.back();
    }, true);
    // Countdowns on screen (a shift, a driver, a rider) tick once a second while the phone is open
    window.setInterval(() => {
      if (!this.isOpen || !this.host) return;
      this.updateStatusBar();
      const here = this.here();
      const app = this.appFor(here.app);
      if (here.app === 'home' || app?.live?.(this.host)) this.refresh();
    }, 1000);
  }

  /** Joins the phone to the game. Until this is called there is nothing for the apps to work with. */
  public connect(services: PhoneServices): void {
    this.services = services;
    const phone = this;
    this.host = {
      backend: this.backend,
      world: services.world,
      rides: services.rides,
      deliveries: services.deliveries,
      messages: services.messages,
      market: services.market,
      go: (route) => phone.go(route),
      back: () => phone.back(),
      openApp: (appId, route) => phone.openApp(appId, route),
      close: () => phone.close(),
      refresh: () => phone.refresh(),
      say: (text, tone) => phone.say(text, tone),
      confirm: (question, yes) => phone.confirm(question, yes),
      get: <T,>(key: string, initial: T) => (phone.memory.has(key) ? (phone.memory.get(key) as T) : initial),
      set: (key, value) => { phone.memory.set(key, value); },
    };
    services.rides.onChange = () => this.refresh();
    services.deliveries.onChange = () => this.refresh();
    services.messages.onChange = () => this.refresh();
    this.refresh();
  }

  // --- Opening and closing -----------------------------------------------------------------

  public open(): void {
    this.isOpen = true;
    this.container.className = 'phone-open';
    this.fresh = true;
    this.refresh();
    UIStateManager.getInstance().pushModal('phone');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.className = 'phone-closed';
    this.settle(false);
    UIStateManager.getInstance().popModal('phone');
  }

  public toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Opens an app (by its id, or an older name for it) from the home screen. */
  public openApp(appId: string, route = ''): void {
    const app = this.appFor(appId);
    if (!app) return;
    if (!this.isOpen) this.open();
    // The older names carry which part of the app they meant
    const start = route || (appId === 'chowdeck' ? 'food' : appId === 'boutique' || appId === 'market' ? 'market' : '');
    if (app.id === 'shopping' && start) this.memory.set('shopping.tab', start);
    const inside = app.id === 'shopping' ? '' : start;
    // Opened straight onto a screen inside an app, Back still goes up to the app before the home screen
    this.stack = [{ app: 'home', route: '' }, { app: app.id, route: '' }];
    if (inside) this.stack.push({ app: app.id, route: inside });
    this.fresh = true;
    this.refresh();
  }

  /** Draws the current screen again. Other code may call this after changing the game state. */
  public render(): void {
    this.refresh();
  }

  // --- Moving around -----------------------------------------------------------------------

  private here(): Place {
    return this.stack[this.stack.length - 1];
  }

  private appFor(id: string): PhoneApp | null {
    return APPS.find((app) => app.id === id || app.aliases?.includes(id)) ?? null;
  }

  private go(route: string): void {
    this.stack.push({ app: this.here().app, route });
    this.fresh = true;
    this.refresh();
  }

  private back(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.fresh = true;
      this.refresh();
    } else {
      this.close();
    }
  }

  private home(): void {
    if (this.stack.length === 1) {
      this.close();
      return;
    }
    this.stack = [{ app: 'home', route: '' }];
    this.fresh = true;
    this.refresh();
  }

  // --- The handset -------------------------------------------------------------------------

  private build(): void {
    this.container.innerHTML = `
      <button class="phone-close-floating-pill" id="phone-btn-floating-close" data-phone-close>✕ Close</button>
      <div class="smartphone-device nlphone" role="dialog" aria-label="Phone">
        <div class="phone-island"><span class="island-camera"></span></div>
        <div class="phone-status-bar">
          <span class="phone-time" id="phone-status-time"></span>
          <span class="phone-status-place" id="phone-status-place"></span>
        </div>
        <div class="nlphone-bar">
          <button class="nlphone-back" id="app-back-btn" data-phone-back aria-label="Back">‹</button>
          <span class="nlphone-title" id="phone-title"></span>
        </div>
        <div class="nlphone-notice" id="phone-notice" role="status" hidden></div>
        <div class="phone-screen" id="phone-screen-content"></div>
        <div class="nlphone-confirm" id="phone-confirm" hidden>
          <div class="nlphone-confirm-card">
            <p id="phone-confirm-text"></p>
            <div class="nl-split">
              <button class="nl-btn" id="phone-confirm-no" data-phone-answer="no">Cancel</button>
              <button class="nl-btn nl-btn--primary" id="phone-confirm-yes" data-phone-answer="yes"></button>
            </div>
          </div>
        </div>
        <div class="nlphone-nav">
          <button class="nlphone-nav-btn" data-phone-back aria-label="Back">‹</button>
          <button class="nlphone-nav-btn nlphone-nav-home" id="phone-home-bar" data-phone-home aria-label="Home screen"><span></span></button>
          <button class="nlphone-nav-btn" data-phone-close aria-label="Put the phone away">✕</button>
        </div>
      </div>
    `;
    const find = (id: string) => this.container.querySelector<HTMLElement>(`#${id}`)!;
    this.screen = find('phone-screen-content');
    this.titleEl = find('phone-title');
    this.backEl = find('app-back-btn') as HTMLButtonElement;
    this.noticeEl = find('phone-notice');
    this.clockEl = find('phone-status-time');
    this.placeEl = find('phone-status-place');
    this.confirmEl = find('phone-confirm');

    this.container.addEventListener('click', (event) => this.onClick(event));
    this.container.addEventListener('input', (event) => this.onInput(event));
    this.container.addEventListener('submit', (event) => this.onSubmit(event));
  }

  private onClick(event: MouseEvent): void {
    const el = (event.target as HTMLElement).closest<HTMLElement>(
      '[data-phone-answer],[data-phone-close],[data-phone-back],[data-phone-home],[data-shortcut],[data-app],[data-go],[data-set],[data-act]'
    );
    if (!el || !this.host || !this.services) return;
    if ((el as HTMLButtonElement).disabled) return;

    if (el.dataset.phoneAnswer) return this.settle(el.dataset.phoneAnswer === 'yes');
    // A question on screen has to be answered before anything else is done
    if (this.answer) return;

    if ('phoneClose' in el.dataset) return this.close();
    if ('phoneBack' in el.dataset) return this.back();
    if ('phoneHome' in el.dataset) return this.home();
    if (el.dataset.shortcut) {
      const shortcut = SHORTCUTS.find((entry) => entry.id === el.dataset.shortcut);
      if (!shortcut) return;
      this.close();
      shortcut.open(this.services.world);
      return;
    }
    if (el.dataset.app) return this.openApp(el.dataset.app, el.dataset.route ?? '');
    if (el.dataset.go !== undefined) return this.go(el.dataset.go);
    if (el.dataset.set) {
      this.memory.set(el.dataset.set, el.dataset.value ?? '');
      return this.refresh();
    }
    if (el.dataset.act) {
      const here = this.here();
      const app = this.appFor(here.app);
      void app?.act?.(this.host, el.dataset.act, el, here.route);
      this.refresh();
    }
  }

  private onInput(event: Event): void {
    const field = event.target as HTMLInputElement;
    const key = field.dataset?.bind;
    if (!key) return;
    this.memory.set(key, field.value);
    // A search narrows the list as it is typed; other fields are read when their button is pressed
    if (field.type === 'search' || 'live' in field.dataset) this.refresh();
  }

  private onSubmit(event: Event): void {
    const form = (event.target as HTMLElement).closest<HTMLFormElement>('[data-form]');
    if (!form || !this.host) return;
    event.preventDefault();
    const here = this.here();
    void this.appFor(here.app)?.act?.(this.host, form.dataset.form ?? '', form, here.route);
  }

  // --- Drawing -----------------------------------------------------------------------------

  private refresh(): void {
    if (!this.host || !this.services) return;
    // A closed phone is not redrawn; it catches up when it is next opened
    if (!this.isOpen) return;

    const here = this.here();
    const app = this.appFor(here.app);
    const page = app ? app.render(this.host, here.route) : { title: '', body: this.homeScreen(this.host) };

    this.titleEl.textContent = page.title;
    this.container.querySelector('.nlphone-bar')!.toggleAttribute('hidden', here.app === 'home');
    this.backEl.disabled = this.stack.length <= 1;
    // Not data-app: that is what a tile carries, and a tap anywhere on the screen would count as one
    this.screen.dataset.showing = here.app;
    this.screen.dataset.showingRoute = here.route;

    const fresh = this.fresh;
    this.fresh = false;
    draw(this.screen, page.body, {
      fresh,
      drawn: () => {
        // A conversation opens at its latest message; everything else at the top
        if (fresh) this.screen.scrollTop = here.app === 'messages' && here.route.startsWith('c:') ? this.screen.scrollHeight : 0;
      },
    });
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    if (!this.services) return;
    const clock = this.services.world.clock();
    if (this.clockEl.textContent !== clock.time) this.clockEl.textContent = clock.time;
    const place = this.services.world.placeName();
    if (this.placeEl.textContent !== place) this.placeEl.textContent = place;
  }

  private homeScreen(host: PhoneHost): string {
    const data = host.backend.getData();
    const clock = host.world.clock();
    const stats = data.stats;
    const tone = (value: number) => (value < 25 ? 'bad' : value < 50 ? 'warn' : 'good');
    const ride = host.rides.ride;
    const order = host.deliveries.order;
    const shift = host.backend.getActiveJobShift();

    const going: string[] = [];
    if (ride) {
      going.push(`<button class="nlphone-now" data-app="ride"><span>${ride.vehicle.icon}</span><span><strong>${ride.stage === 'driver_coming' ? `Driver in ${Math.max(1, Math.ceil(ride.eta))}s` : 'On your way'}</strong><small>to ${esc(ride.destination.name)}</small></span></button>`);
    }
    if (order) {
      going.push(`<button class="nlphone-now" data-app="shopping"><span>🛵</span><span><strong>${order.eta > 0 ? `Rider in ${Math.ceil(order.eta)}s` : 'Rider waiting'}</strong><small>${naira(order.total)} on delivery</small></span></button>`);
    }
    if (shift) {
      going.push(`<button class="nlphone-now" data-app="jobs"><span>${shift.job.icon}</span><span><strong>${shift.isReady ? 'Shift done: collect your pay' : `${shift.remainingSecs}s left on shift`}</strong><small>${esc(shift.job.title)}</small></span></button>`);
    }

    return `
      <div class="nlphone-home">
        <div class="nlphone-clock">
          <span class="nlphone-clock-time" id="phone-clock">${esc(clock.time)}</span>
          <span class="nlphone-clock-date">${esc(clock.date)} · ${esc(host.world.cityName())} · ${host.world.weather() === 'rainy' ? '🌧️ Rain' : '☀️ Sunny'}</span>
        </div>

        <button class="nl-hero nlphone-wallet" data-app="bank" id="phone-wallet">
          <span class="nl-hero-label">Bank</span>
          <span class="nl-hero-value">${naira(data.bank.balance)}</span>
          <span class="nl-hero-sub">Cash on you ${naira(data.walletCash)}</span>
        </button>

        <button class="nlphone-needs" data-app="health" aria-label="Your needs">
          <span>❤️ ${meter(stats.health, tone(stats.health))}</span>
          <span>🍲 ${meter(stats.hunger, tone(stats.hunger))}</span>
          <span>⚡ ${meter(stats.energy, tone(stats.energy))}</span>
        </button>

        ${going.join('')}

        <div class="nlphone-grid" id="phone-apps">
          ${APPS.map((app) => {
            const badge = app.badge?.(host) ?? 0;
            return `
              <button class="app-grid-icon-btn nlphone-app" data-app="${app.id}" title="${esc(app.purpose)}">
                <span class="nlphone-tile" style="background: linear-gradient(145deg, ${app.tint[0]}, ${app.tint[1]});">
                  ${app.icon}
                  ${badge > 0 ? `<span class="nlphone-badge" data-badge="${badge}">${badge > 9 ? '9+' : badge}</span>` : ''}
                </span>
                <span class="nlphone-app-name">${esc(app.name)}</span>
              </button>`;
          }).join('')}
        </div>

        <div class="nlphone-dock" id="phone-shortcuts">
          ${SHORTCUTS.map((shortcut) => `
            <button class="nlphone-dock-btn" data-shortcut="${shortcut.id}" title="${esc(shortcut.name)}">
              <span>${shortcut.icon}</span><small>${esc(shortcut.name)}</small>
            </button>`).join('')}
        </div>
      </div>
    `;
  }

  // --- Notices and questions ---------------------------------------------------------------

  private say(text: string, tone: 'good' | 'bad' | 'info' = 'info'): void {
    this.noticeEl.textContent = text;
    this.noticeEl.dataset.tone = tone;
    this.noticeEl.hidden = false;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => { this.noticeEl.hidden = true; }, 5200);
  }

  private confirm(question: string, yes: string): Promise<boolean> {
    this.settle(false);
    this.container.querySelector('#phone-confirm-text')!.textContent = question;
    this.container.querySelector('#phone-confirm-yes')!.textContent = yes;
    this.confirmEl.hidden = false;
    return new Promise((resolve) => { this.answer = resolve; });
  }

  private settle(yes: boolean): void {
    const answer = this.answer;
    this.answer = null;
    this.confirmEl.hidden = true;
    if (!answer) return;
    answer(yes);
    // What was confirmed has now been done: show the result
    queueMicrotask(() => queueMicrotask(() => this.refresh()));
  }
}
