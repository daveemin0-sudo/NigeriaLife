import { UIStateManager } from './UIStateManager';

export interface ActivityStatus {
  icon: string;
  title: string;
  line: string;
  stopLabel: string;
}

/**
 * A small status line for something the player is in the middle of (sleeping, watching TV),
 * with one button to stop. What is happening is shown in the room; this only says how it is going.
 */
export class ActivityStatusUI {
  private readonly el: HTMLDivElement;
  private readonly getStatus: () => ActivityStatus | null;
  private readonly onStop: () => void;

  constructor(id: string, getStatus: () => ActivityStatus | null, onStop: () => void) {
    this.getStatus = getStatus;
    this.onStop = onStop;
    this.el = document.createElement('div');
    this.el.id = id;
    // Shares the look of the buka's order status
    this.el.className = 'buka-order-status';
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    UIStateManager.getInstance().onModeChange(() => this.render());
  }

  public render(): void {
    const status = this.getStatus();
    if (!status || !UIStateManager.getInstance().isMode('interior')) {
      this.el.style.display = 'none';
      return;
    }
    this.el.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = 'buka-status-icon';
    icon.textContent = status.icon;
    const text = document.createElement('span');
    text.className = 'buka-status-text';
    const title = document.createElement('span');
    title.className = 'buka-status-name';
    title.textContent = status.title;
    const line = document.createElement('span');
    line.className = 'buka-status-line';
    line.textContent = status.line;
    text.append(title, line);
    const stop = document.createElement('button');
    stop.className = 'buka-status-btn';
    stop.id = `${this.el.id}-stop`;
    stop.textContent = status.stopLabel;
    stop.addEventListener('click', () => this.onStop());
    this.el.append(icon, text, stop);
    this.el.style.display = 'flex';
  }
}
