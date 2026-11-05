/** Full-screen hold shown while the game server has this player in the join queue. */
export class ServerQueueScreen {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLParagraphElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'server-queue-screen';
    this.root.hidden = true;
    this.root.setAttribute('role', 'status');
    this.root.setAttribute('aria-live', 'polite');
    this.root.innerHTML = `
      <div class="server-queue-card">
        <div class="server-queue-kicker">Nigeria Life</div>
        <p class="server-queue-title"></p>
        <p class="server-queue-sub">Stay on this page. You get in automatically when a spot opens.</p>
      </div>
    `;
    const title = this.root.querySelector('.server-queue-title');
    if (!title) throw new Error('Queue screen failed to build');
    this.title = title as HTMLParagraphElement;
    document.body.appendChild(this.root);
  }

  show(position: number): void {
    const place = Math.max(1, Math.floor(position));
    this.title.textContent = `Server busy, you are number ${place} in line`;
    this.root.hidden = false;
    document.body.classList.add('server-queue-open');
    document.body.dataset.gameServer = 'queued';
  }

  hide(): void {
    this.root.hidden = true;
    document.body.classList.remove('server-queue-open');
  }
}
