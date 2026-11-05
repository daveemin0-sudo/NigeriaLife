import { MusicPlayer } from '../audio/MusicPlayer';
import { ICONS } from './ViewPicker';
import { esc } from './kit/html';
import { showGameToast } from './GameToast';
import { UIStateManager } from './UIStateManager';

/**
 * The music: what is playing, play and pause, next and back, shuffle and volume, the game's own
 * songs, and the player's own songs added from their phone. A round button on the right of the
 * screen opens it.
 */
export class MusicSheet {
  private readonly player = MusicPlayer.get();
  private readonly el: HTMLDivElement;
  private readonly fab: HTMLButtonElement;
  private frame = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'music-sheet';
    this.el.className = 'cat-sheet music-sheet';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-label', 'Music');
    this.el.style.display = 'none';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (event) => this.onClick(event));
    this.el.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.matches('[data-volume]')) this.player.setVolume(Number(target.value) / 100);
    });
    this.el.addEventListener('change', async (event) => {
      const target = event.target as HTMLInputElement;
      if (!target.matches('[data-files]') || !target.files?.length) return;
      const added = await this.player.addFiles(target.files);
      showGameToast(added ? `${added} song${added === 1 ? '' : 's'} added. They stay on this phone.` : 'Those files are not songs this phone can play.', added ? 'success' : 'warning', 3600);
      target.value = '';
    });

    this.fab = document.createElement('button');
    this.fab.id = 'music-fab';
    this.fab.className = 'music-fab';
    this.fab.type = 'button';
    this.fab.setAttribute('aria-label', 'Music');
    this.fab.innerHTML = ICONS.music;
    this.fab.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
    document.body.appendChild(this.fab);

    this.player.onChange(() => {
      this.fab.classList.toggle('is-playing', this.player.playing);
      if (this.isOpen) this.render();
    });
    UIStateManager.getInstance().registerModal('music', { id: 'music', close: () => this.close(), isOpen: () => this.isOpen });
  }

  public get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  public open(): void {
    this.render();
    this.el.style.display = 'flex';
    UIStateManager.getInstance().pushModal('music');
    const tick = () => {
      if (!this.isOpen) return;
      const bar = this.el.querySelector<HTMLElement>('[data-progress]');
      if (bar) bar.style.width = `${Math.round(this.player.progress * 1000) / 10}%`;
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  public close(): void {
    if (!this.isOpen) return;
    this.el.style.display = 'none';
    cancelAnimationFrame(this.frame);
    UIStateManager.getInstance().popModal('music');
  }

  private render(): void {
    const p = this.player;
    const now = p.current;
    const row = (t: ReturnType<MusicPlayer['tracks']>[number]) => `
      <div class="music-row${now?.id === t.id ? ' is-on' : ''}">
        <button class="music-pick" data-play="${t.id}">
          <span class="music-art">${now?.id === t.id && p.playing ? '<i class="eq"><b></b><b></b><b></b></i>' : t.kind === 'mine' ? '📱' : '🎶'}</span>
          <span class="music-text"><strong>${esc(t.title)}</strong><em>${esc(t.artist)}</em></span>
        </button>
        ${t.kind === 'mine' ? `<button class="cat-round" data-remove="${t.id}" aria-label="Remove ${esc(t.title)}">🗑</button>` : ''}
      </div>`;
    this.el.innerHTML = `
      <div class="cat-grab" aria-hidden="true"></div>
      <div class="cat-head">
        <div class="cat-title"><strong>🎵 Music</strong><span class="cat-wallet">Afrobeats, Amapiano, Highlife, and your own songs</span></div>
        <button class="cat-round" data-close aria-label="Close the music">✕</button>
      </div>
      <div class="music-now">
        <div class="music-now-text">
          <span class="music-label">${p.playing ? 'Now playing' : now ? 'Paused' : 'Nothing playing'}</span>
          <strong>${esc(now?.title ?? 'Tap a song to play it')}</strong>
          <em>${esc(now?.artist ?? 'NaijaFM')}</em>
        </div>
        <div class="music-bar"><span data-progress></span></div>
        <div class="music-controls">
          <button class="cat-round${p.shuffle ? ' is-on' : ''}" data-shuffle aria-pressed="${p.shuffle}" aria-label="Shuffle">🔀</button>
          <button class="cat-round" data-prev aria-label="Back">⏮</button>
          <button class="music-main" data-toggle aria-label="${p.playing ? 'Pause' : 'Play'}">${p.playing ? '⏸' : '▶'}</button>
          <button class="cat-round" data-next aria-label="Next">⏭</button>
          <label class="music-volume" aria-label="Volume">🔊<input type="range" min="0" max="100" value="${Math.round(p.volume * 100)}" data-volume></label>
        </div>
      </div>
      <div class="cat-body">
        <h4 class="cat-h">NaijaFM · songs made for NigeriaLife</h4>
        ${p.tracks().filter((t) => t.kind === 'song').map(row).join('')}
        <h4 class="cat-h">My music</h4>
        ${p.myTracks.map(row).join('') || '<p class="music-note">Add the songs you love (Asake, Burna, Wizkid, Rema, Tems…) from your phone: they play here, on your car stereo, in taxis and at the club, before the game’s own. They stay on this phone.</p>'}
        <label class="music-add">➕ Add songs from your phone<input type="file" accept="audio/*" multiple data-files hidden></label>
      </div>`;
  }

  private onClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>('button');
    if (!target) return;
    const p = this.player;
    if ('close' in target.dataset) this.close();
    else if ('toggle' in target.dataset) p.toggle();
    else if ('next' in target.dataset) p.next();
    else if ('prev' in target.dataset) p.previous();
    else if ('shuffle' in target.dataset) p.toggleShuffle();
    else if (target.dataset.play) void p.play(target.dataset.play);
    else if (target.dataset.remove) void p.remove(target.dataset.remove);
  }
}
