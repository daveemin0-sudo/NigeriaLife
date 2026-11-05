// The title screen: the game's name over the city as it is now, the camera drifting slowly round
// the player, and a card with the life being lived (who, where, how much, what day) to carry on
// with. A new life starts beside it, never over it: every life on this device stays, to come
// back to from here.

import { PROFILE_ID } from '../backend/Profile';

export interface TitleHost {
  /** Who the player is and how they are doing, for the card */
  summary(): { name: string; day: string; money: string; place: string; home: string | null };
  /** Turns the camera a little, each frame, while the title is up */
  drift(delta: number): void;
  /** The view while the title is up (high over the city), and back to the street after */
  frame(on: boolean): void;
}

interface Life {
  id: string;
  name: string;
}

/** Every life kept in this browser: the first one, and any started since */
function lives(): Life[] {
  const out: Life[] = [];
  const nameIn = (key: string) => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return typeof saved?.name === 'string' && saved.name ? saved.name : null;
    } catch {
      return null;
    }
  };
  try {
    const main = nameIn('nigeria_life_character_v2');
    if (main || PROFILE_ID === 'main') out.push({ id: 'main', name: main ?? 'You' });
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? '';
      const m = key.match(/^nigeria_life_character_v2__player_([a-z0-9_-]+)$/);
      if (m) out.push({ id: m[1], name: nameIn(key) ?? 'A new life' });
    }
  } catch {
    // Storage shut off: only the life on screen
  }
  if (!out.some((life) => life.id === PROFILE_ID)) out.push({ id: PROFILE_ID, name: 'You' });
  return out;
}

const goTo = (id: string) => {
  const url = new URL(window.location.href);
  if (id === 'main') url.searchParams.delete('player');
  else url.searchParams.set('player', id);
  window.location.href = url.toString();
};

export class TitleScreen {
  private readonly el: HTMLDivElement;
  private readonly host: TitleHost;
  private open = true;
  private last = performance.now();

  constructor(host: TitleHost) {
    this.host = host;
    this.el = document.createElement('div');
    this.el.id = 'title-screen';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Nigeria Life');
    document.body.appendChild(this.el);
    document.body.classList.add('lx-title');
    this.host.frame(true);
    this.render();
    this.el.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-title]');
      if (!target) return;
      const act = target.dataset.title!;
      if (act === 'continue') this.close();
      else if (act === 'new') this.render(true);
      else if (act === 'cancel') this.render(false);
      else if (act === 'start') {
        const taken = new Set(lives().map((life) => life.id));
        let n = 2;
        while (taken.has(`life${n}`)) n++;
        goTo(`life${n}`);
      } else if (act.startsWith('life:')) goTo(act.slice(5));
    });
    window.addEventListener('keydown', this.onKey);
    requestAnimationFrame(this.tick);
  }

  private onKey = (event: KeyboardEvent) => {
    if (!this.open) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.close();
    }
  };

  private tick = (now: number) => {
    if (!this.open) return;
    const delta = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.host.drift(delta);
    requestAnimationFrame(this.tick);
  };

  public get isOpen(): boolean {
    return this.open;
  }

  private render(asking = false): void {
    const s = this.host.summary();
    const all = lives();
    const others = all.filter((life) => life.id !== PROFILE_ID);
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    this.el.innerHTML = `
      <div class="ts-top">
        <div class="ts-mark"><b>NL</b><i></i></div>
        <h1 class="ts-word">Nigeria<span>Life</span></h1>
        <p class="ts-line">Lagos · Abuja · Port Harcourt</p>
      </div>
      <div class="ts-card lx-pop is-open" id="title-card">
        ${asking ? `
          <div class="ts-ask">
            <strong>Start a new life?</strong>
            <p>A new life begins with ₦25,000 and nothing else: a new name, a new look, no home yet. Your life as ${esc(s.name)} is kept. Come back to it from here any time.</p>
            <div class="ts-row">
              <button type="button" class="lx-btn lx-btn-soft" data-title="cancel">Not now</button>
              <button type="button" class="lx-btn lx-btn-brand" data-title="start" id="title-start-new">Start a new life</button>
            </div>
          </div>` : `
          <div class="ts-who">
            <span class="ts-avatar">${esc(s.name.slice(0, 1).toUpperCase())}</span>
            <span class="ts-who-text"><strong>${esc(s.name)}</strong><em>${esc(s.place)} · ${esc(s.day)}</em></span>
            <span class="ts-money">${esc(s.money)}</span>
          </div>
          ${s.home ? `<div class="ts-home">🏠 ${esc(s.home)}</div>` : ''}
          <button type="button" class="lx-btn lx-btn-brand ts-go" data-title="continue" id="title-continue">Continue</button>
          <button type="button" class="lx-btn lx-btn-soft ts-new" data-title="new" id="title-new">New life</button>
          ${others.length ? `<div class="ts-lives"><span>Your other lives</span>${others.map((life) => `<button type="button" class="ts-life" data-title="life:${esc(life.id)}">${esc(life.name)}</button>`).join('')}</div>` : ''}`}
      </div>
      <p class="ts-tip">Tap Continue, or press Enter</p>
    `;
  }

  public close(): void {
    if (!this.open) return;
    this.open = false;
    window.removeEventListener('keydown', this.onKey);
    this.el.classList.add('is-gone');
    document.body.classList.remove('lx-title');
    this.host.frame(false);
    setTimeout(() => this.el.remove(), 600);
  }
}
