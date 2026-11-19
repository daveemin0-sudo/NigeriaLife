/**
 * In a two-storey home: which floor the player is on, and the way to the other. Going up or down
 * is walked like everything else (to the foot of the stairs and up them); this only says where to.
 */
export class StoreyButton {
  private readonly el: HTMLButtonElement;
  private storey = 0;
  /** The player asked for the other floor */
  public onGo: ((storey: number) => void) | null = null;

  constructor() {
    this.el = document.createElement('button');
    this.el.id = 'nl-storey';
    this.el.type = 'button';
    this.el.className = 'nl-storey';
    this.el.hidden = true;
    this.el.addEventListener('click', (event) => {
      event.stopPropagation();
      this.onGo?.(this.storey === 0 ? 1 : 0);
    });
    document.body.appendChild(this.el);
  }

  /** On this floor of a home with this many floors; one floor (or none: out of the house) hides it */
  public show(storey: number, storeys: number): void {
    this.storey = storey;
    if (storeys < 2) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    const up = storey === 0;
    this.el.dataset.storey = String(storey);
    this.el.setAttribute('aria-label', up ? 'Go upstairs' : 'Go downstairs');
    this.el.innerHTML = `<span class="nl-storey-arrow" aria-hidden="true">${up ? '▲' : '▼'}</span><span class="nl-storey-words"><b>${up ? 'Upstairs' : 'Downstairs'}</b><small>${up ? 'You are on the ground floor' : 'You are on the first floor'}</small></span>`;
  }
}
