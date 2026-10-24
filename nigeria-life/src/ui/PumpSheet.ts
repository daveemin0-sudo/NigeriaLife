import { esc, naira } from './kit/html';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';
import { fillCost, rangeKm, JERRY_CAN_LITRES, JERRY_CAN_PER_LITRE } from '../world/Fuel';

export interface PumpRow {
  id: string;
  name: string;
  type: string;
  /** 0 to 100 */
  fuel: number;
  /** On this forecourt (or being driven onto it): only these can be filled */
  here: boolean;
}

export interface PumpHooks {
  rows(): PumpRow[];
  /** Pays and fills it; returns why not, or null when done */
  fill(id: string, cost: number): string | null;
  /** A jerry can for the vehicle being driven; returns why not, or null */
  jerryCan(cost: number): string | null;
}

const ICON: Record<string, string> = { okada: '🏍️', keke: '🛺', danfo: '🚐', suv: '🚙', gwagon: '🚙', sports_car: '🏎️', electric_car: '⚡', ambulance: '🚑' };
/** How long the attendant takes to fill a tank */
const FILLING_MS = 2400;

/**
 * The pump at a filling station: every vehicle the player owns with what is in its tank and how
 * far that goes, and "Fill up" with the price for those on the forecourt. Far from any station,
 * with the tank empty, a jerry can can be brought out instead.
 */
export class PumpSheet {
  private readonly el: HTMLDivElement;
  private readonly hooks: PumpHooks;
  private station = '';
  private jerry = false;
  private filling: string | null = null;

  constructor(hooks: PumpHooks) {
    this.hooks = hooks;
    this.el = document.createElement('div');
    this.el.id = 'pump-sheet';
    this.el.className = 'cat-sheet pump-sheet';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'The pump');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    UIStateManager.getInstance().registerModal('pump', { id: 'pump', close: () => this.close(), isOpen: () => this.isOpen });
  }

  public get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  public open(stationName: string): void {
    this.station = stationName;
    this.jerry = false;
    this.show();
  }

  /** Out of fuel with no station near: a jerry can brought to the car */
  public openJerryCan(): void {
    this.station = '';
    this.jerry = true;
    this.show();
  }

  private show(): void {
    this.render();
    if (this.isOpen) return;
    this.el.style.display = 'flex';
    UIStateManager.getInstance().pushModal('pump');
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    UIStateManager.getInstance().popModal('pump');
  }

  private render(): void {
    const head = this.jerry
      ? `<div class="cat-title"><strong>⛽ Out of fuel</strong><span class="cat-wallet">No filling station near</span></div>`
      : `<div class="cat-title"><strong>⛽ The pump</strong><span class="cat-wallet">${esc(this.station)}</span></div>`;
    let body: string;
    if (this.jerry) {
      const cost = JERRY_CAN_LITRES * JERRY_CAN_PER_LITRE;
      body = `<p class="music-note">A boy on an okada brings ${JERRY_CAN_LITRES} litres in a jerry can, enough to reach a station. It costs more than the pump.</p>
        <div class="pump-row"><span class="pump-icon">🛢️</span><span class="pump-text"><strong>Jerry can, ${JERRY_CAN_LITRES} litres</strong><em>Brought to you</em></span>
        <button class="cat-go pump-fill" data-jerry ${this.filling ? 'disabled' : ''}>${this.filling ? 'Coming…' : `Buy · ${naira(cost)}`}</button></div>`;
    } else {
      const rows = this.hooks.rows();
      body = rows.length
        ? rows.map((r) => {
            const cost = fillCost(r.type, r.fuel);
            const full = r.fuel >= 99;
            const button = this.filling === r.id
              ? '<button class="cat-go pump-fill" disabled>Filling…</button>'
              : full
                ? '<span class="pump-full">Full</span>'
                : r.here
                  ? `<button class="cat-go pump-fill" data-fill="${esc(r.id)}" data-cost="${cost}">Fill up · ${naira(cost)}</button>`
                  : '<span class="pump-full">Not here</span>';
            return `<div class="pump-row"><span class="pump-icon">${ICON[r.type] ?? '🚗'}</span><span class="pump-text"><strong>${esc(r.name)}</strong><em>Tank ${Math.round(r.fuel)}% · ${rangeKm(r.type, r.fuel)} km</em></span>${button}</div>`;
          }).join('')
        : '<p class="cat-empty">You have no vehicle to fill. Buy one from Cars on your phone, or at Sankofa Motors.</p>';
      body = `<p class="music-note">Drive onto the forecourt and the attendant fills you up. Petrol is ₦950 a litre.</p>${body}`;
    }
    this.el.innerHTML = `
      <div class="cat-grab" aria-hidden="true"></div>
      <div class="cat-head">${head}<button class="cat-round" data-close aria-label="Close">✕</button></div>
      <div class="cat-body pump-body">${body}</div>`;
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target || this.filling) return;
    if ('close' in target.dataset) return this.close();
    if (target.dataset.fill) {
      const id = target.dataset.fill;
      const cost = Number(target.dataset.cost);
      this.filling = id;
      this.render();
      // The attendant fills it, and it is paid for when the nozzle comes out
      window.setTimeout(() => {
        this.filling = null;
        const refused = this.hooks.fill(id, cost);
        if (refused) showGameToast(refused, 'warning', 4000);
        else showGameToast(`⛽ Filled up. ${naira(cost)} paid.`, 'success', 3200);
        if (this.isOpen) this.render();
      }, FILLING_MS);
      return;
    }
    if ('jerry' in target.dataset) {
      const cost = JERRY_CAN_LITRES * JERRY_CAN_PER_LITRE;
      this.filling = 'jerry';
      this.render();
      window.setTimeout(() => {
        this.filling = null;
        const refused = this.hooks.jerryCan(cost);
        if (refused) showGameToast(refused, 'warning', 4000);
        else {
          showGameToast(`🛢️ ${JERRY_CAN_LITRES} litres poured in. ${naira(cost)} paid. Get to a filling station.`, 'success', 4200);
          this.close();
        }
        if (this.isOpen) this.render();
      }, FILLING_MS);
    }
  }
}
