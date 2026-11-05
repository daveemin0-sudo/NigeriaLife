// The View button: one round white button on the right, and a small white sheet beside it with
// the ways to look (a segmented control whose thumb slides between them), turning, a photo and a
// clean screen. The same on a phone and a laptop; V still cycles, P still opens the photo.

export type ViewId = 'close' | 'street' | 'isometric' | 'aerial' | 'eye';

export interface ViewHost {
  preset(): ViewId;
  inside(): boolean;
  set(view: ViewId): void;
  rotate(deltaYaw: number): void;
  reset(): void;
  photo(): void;
}

interface Choice {
  id: ViewId;
  label: string;
  line: string;
}

const OUTSIDE: Choice[] = [
  { id: 'close', label: 'Close', line: 'Over your shoulder' },
  { id: 'street', label: 'Street', line: 'At street level, a few steps back' },
  { id: 'isometric', label: 'High', line: 'Raised, to see the road and the people' },
  { id: 'aerial', label: 'Above', line: 'From the sky, the whole block' },
];
const INSIDE: Choice[] = [
  { id: 'street', label: 'Room', line: 'The whole room, from the corner' },
  { id: 'eye', label: 'Eyes', line: 'Through your own eyes' },
  { id: 'close', label: 'Close', line: 'Over your shoulder' },
  { id: 'aerial', label: 'Above', line: 'From above, the walls cut away' },
];

const svg = (body: string, size = 22) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  view: svg('<rect x="2.5" y="6.5" width="13" height="11" rx="2.6"/><path d="M15.5 10.4l5-2.9v9l-5-2.9z"/>'),
  photo: svg('<path d="M3 8.6A2.6 2.6 0 0 1 5.6 6h1.6l1.5-2.2h6.6L16.8 6h1.6A2.6 2.6 0 0 1 21 8.6v8.8a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 17.4z"/><circle cx="12" cy="12.8" r="3.6"/>', 18),
  left: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3"/><path d="M3.5 3.8v5h5"/>', 20),
  right: svg('<path d="M20.5 12a8.5 8.5 0 1 1-2.8-6.3"/><path d="M20.5 3.8v5h-5"/>', 20),
  centre: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3"/>', 20),
  hide: svg('<path d="M2.5 12c1.6-3.6 5.2-6.5 9.5-6.5s7.9 2.9 9.5 6.5c-1.6 3.6-5.2 6.5-9.5 6.5S4.1 15.6 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20L20 4"/>', 18),
  show: svg('<path d="M2.5 12c1.6-3.6 5.2-6.5 9.5-6.5s7.9 2.9 9.5 6.5c-1.6 3.6-5.2 6.5-9.5 6.5S4.1 15.6 2.5 12z"/><circle cx="12" cy="12" r="3"/>', 22),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 16),
  music: svg('<path d="M9 18V5.5l11-2.2V16"/><circle cx="6.2" cy="18" r="2.8"/><circle cx="17.2" cy="16" r="2.8"/>', 21),
};

export class ViewPicker {
  public readonly fab: HTMLButtonElement;
  private readonly sheet: HTMLDivElement;
  private shownFor = '';

  private readonly host: ViewHost;

  constructor(host: ViewHost) {
    this.host = host;
    this.fab = document.createElement('button');
    this.fab.type = 'button';
    this.fab.id = 'view-fab';
    this.fab.className = 'lx-fab view-fab';
    this.fab.setAttribute('aria-label', 'View');
    this.fab.innerHTML = ICONS.view;
    this.fab.addEventListener('click', (event) => {
      event.stopPropagation();
      if (document.body.classList.contains('lx-clean')) this.setClean(false);
      else if (this.isOpen) this.close();
      else this.open();
    });

    this.sheet = document.createElement('div');
    this.sheet.id = 'view-sheet';
    this.sheet.className = 'lx-pop view-sheet';
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-label', 'View');
    this.sheet.addEventListener('click', (event) => {
      event.stopPropagation();
      const target = (event.target as HTMLElement).closest('[data-view],[data-act]') as HTMLElement | null;
      if (!target) return;
      const view = target.dataset.view as ViewId | undefined;
      if (view) {
        this.host.set(view);
        this.tap();
        this.render();
        return;
      }
      const act = target.dataset.act;
      this.tap();
      if (act === 'left') this.host.rotate(Math.PI / 4);
      else if (act === 'right') this.host.rotate(-Math.PI / 4);
      else if (act === 'centre') this.host.reset();
      else if (act === 'photo') {
        this.close();
        this.host.photo();
      } else if (act === 'clean') {
        this.close();
        this.setClean(true);
      } else if (act === 'x') this.close();
    });

    document.body.append(this.fab, this.sheet);
    // A tap anywhere else closes it; so does Escape
    document.addEventListener('pointerdown', (event) => {
      if (!this.isOpen) return;
      const t = event.target as Node;
      if (!this.sheet.contains(t) && !this.fab.contains(t)) this.close();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (this.isOpen) this.close();
      else if (document.body.classList.contains('lx-clean')) this.setClean(false);
    });
  }

  public get isOpen(): boolean {
    return this.sheet.classList.contains('is-open');
  }

  public open(): void {
    this.render();
    this.sheet.classList.add('is-open');
    this.fab.classList.add('is-active');
  }

  public close(): void {
    this.sheet.classList.remove('is-open');
    this.fab.classList.remove('is-active');
  }

  /** The screen with nothing on it but the city and the one button that brings it back */
  public setClean(on: boolean): void {
    document.body.classList.toggle('lx-clean', on);
    this.fab.innerHTML = on ? ICONS.show : ICONS.view;
    this.fab.setAttribute('aria-label', on ? 'Show the screen' : 'View');
  }

  /** Called every frame: keeps the sheet true when the view changes another way (V, a door) */
  public update(): void {
    if (!this.isOpen) return;
    const key = `${this.host.inside()}:${this.host.preset()}`;
    if (key !== this.shownFor) this.render();
  }

  private choices(): Choice[] {
    return this.host.inside() ? INSIDE : OUTSIDE;
  }

  private tap(): void {
    try {
      navigator.vibrate?.(8);
    } catch {
      /* not every browser lets a page buzz */
    }
  }

  private render(): void {
    const choices = this.choices();
    const now = this.host.preset();
    let index = choices.findIndex((c) => c.id === now);
    if (index < 0) index = this.host.inside() ? 0 : 1;
    this.shownFor = `${this.host.inside()}:${now}`;
    const current = choices[index];
    const first = !this.sheet.querySelector('.lx-seg');
    if (first || this.sheet.dataset.place !== String(this.host.inside())) {
      this.sheet.dataset.place = String(this.host.inside());
      this.sheet.innerHTML = `
        <div class="view-head">
          <span class="view-title">View</span>
          <span class="view-where">${this.host.inside() ? 'Inside' : 'Outside'}</span>
          <button type="button" class="view-x" data-act="x" aria-label="Close">${ICONS.close}</button>
        </div>
        <div class="lx-seg" role="radiogroup" style="--n:${choices.length}">
          <span class="lx-seg-thumb"></span>
          ${choices.map((c) => `<button type="button" role="radio" class="lx-seg-btn" data-view="${c.id}">${c.label}</button>`).join('')}
        </div>
        <p class="view-line"></p>
        <div class="view-turn">
          <button type="button" class="lx-round" data-act="left" aria-label="Turn left">${ICONS.left}</button>
          <button type="button" class="lx-round" data-act="centre" aria-label="Behind me">${ICONS.centre}</button>
          <button type="button" class="lx-round" data-act="right" aria-label="Turn right">${ICONS.right}</button>
        </div>
        <div class="view-acts">
          <button type="button" class="lx-btn lx-btn-brand" data-act="photo">${ICONS.photo}<span>Photo</span></button>
          <button type="button" class="lx-btn lx-btn-soft" data-act="clean">${ICONS.hide}<span>Clean screen</span></button>
        </div>`;
    }
    const seg = this.sheet.querySelector('.lx-seg') as HTMLElement;
    seg.style.setProperty('--i', String(index));
    seg.querySelectorAll<HTMLElement>('.lx-seg-btn').forEach((b, i) => {
      b.classList.toggle('is-on', i === index);
      b.setAttribute('aria-checked', String(i === index));
    });
    (this.sheet.querySelector('.view-line') as HTMLElement).textContent = current.line;
  }
}
