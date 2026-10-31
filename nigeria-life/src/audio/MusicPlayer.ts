import { SoundEngine } from './SoundEngine';
import { NaijaBeats, SONGS, type Song } from './NaijaBeats';

/** A track in the playlist: one of the game's own songs, or one the player added from their phone */
export interface Track {
  id: string;
  title: string;
  artist: string;
  kind: 'song' | 'mine';
  song?: Song;
}

interface StoredSong {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}

const DB = 'nigerialife-music';
const STORE = 'songs';
const PREFS = 'nigerialife.music';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * The music player: the game's own songs and the player's own, one after another or shuffled,
 * through the game's sound so the mute and the volume apply. Songs the player adds stay on their
 * phone, kept in the browser; nothing is uploaded.
 */
export class MusicPlayer {
  private static instance: MusicPlayer | null = null;
  public static get(): MusicPlayer {
    return (this.instance ??= new MusicPlayer());
  }

  private beats: NaijaBeats | null = null;
  private gain: GainNode | null = null;
  private element: HTMLAudioElement | null = null;
  private url: string | null = null;
  private mine: Track[] = [];
  private listeners = new Set<() => void>();
  public current: Track | null = null;
  public playing = false;
  public shuffle = false;
  public volume = 0.8;

  private constructor() {
    try {
      const prefs = JSON.parse(localStorage.getItem(PREFS) || '{}');
      if (typeof prefs.volume === 'number') this.volume = Math.min(1, Math.max(0, prefs.volume));
      this.shuffle = !!prefs.shuffle;
    } catch {
      // Defaults
    }
    // The old street radio buttons start and stop this player
    SoundEngine.radio = { toggle: () => this.toggle(), isOn: () => this.playing };
    void this.loadMine();
  }

  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed(): void {
    try {
      localStorage.setItem(PREFS, JSON.stringify({ volume: this.volume, shuffle: this.shuffle }));
    } catch {
      // Not remembered
    }
    for (const listener of this.listeners) listener();
  }

  public tracks(): Track[] {
    return [...SONGS.map((song): Track => ({ id: song.id, title: song.title, artist: `${song.artist} · ${song.style === 'afropop' ? 'Afro-pop' : song.style[0].toUpperCase() + song.style.slice(1)}`, kind: 'song', song })), ...this.mine];
  }

  public get myTracks(): readonly Track[] {
    return this.mine;
  }

  private output(): GainNode | null {
    if (this.gain) return this.gain;
    const audio = SoundEngine.getInstance().audio();
    if (!audio) return null;
    this.gain = audio.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(audio.master);
    this.beats = new NaijaBeats(audio.ctx, this.gain);
    this.beats.onSongEnd = () => this.next();
    return this.gain;
  }

  public setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.gain) this.gain.gain.value = this.volume;
    this.changed();
  }

  public toggleShuffle(): void {
    this.shuffle = !this.shuffle;
    this.changed();
  }

  /** Plays a track (by id), or carries on with the current one, or starts the first */
  public async play(id?: string): Promise<boolean> {
    this.remember(true);
    const out = this.output();
    if (!out) return false;
    const track = (id && this.tracks().find((t) => t.id === id)) || this.current || this.preferred();
    if (!track) return false;
    this.stopSound();
    this.current = track;
    if (track.kind === 'song' && track.song) {
      this.beats!.play(track.song);
    } else {
      const stored = await withStore<StoredSong | undefined>('readonly', (s) => s.get(track.id) as IDBRequest<StoredSong | undefined>).catch(() => undefined);
      if (!stored) return false;
      const audio = SoundEngine.getInstance().audio()!;
      if (!this.element) {
        this.element = new Audio();
        this.element.addEventListener('ended', () => this.next());
        audio.ctx.createMediaElementSource(this.element).connect(out);
      }
      this.url = URL.createObjectURL(stored.blob);
      this.element.src = this.url;
      await this.element.play().catch(() => undefined);
    }
    this.playing = true;
    this.changed();
    return true;
  }

  /** Where music starts when nothing was chosen: the player's own songs first, picked at random, else the game's */
  private preferred(): Track | undefined {
    if (this.mine.length) return this.mine[Math.floor(Math.random() * this.mine.length)];
    const list = this.tracks();
    return list[Math.floor(Math.random() * list.length)];
  }

  private stopSound(): void {
    this.beats?.stop();
    if (this.element) this.element.pause();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = null;
  }

  public pause(): void {
    this.stopSound();
    this.playing = false;
    this.remember(false);
    this.changed();
  }

  /** Whether music starts by itself when the game opens: yes, until the player turns it off */
  private remember(on: boolean): void {
    try {
      localStorage.setItem('nl_music_autoplay', on ? '1' : '0');
    } catch {
      // Not kept
    }
  }

  /**
   * The game's sound from the moment it opens: at the player's first tap (browsers allow sound
   * only after one), the music starts, unless they turned it off last time.
   */
  public startWithTheGame(): void {
    let wanted = true;
    try {
      wanted = localStorage.getItem('nl_music_autoplay') !== '0';
    } catch {
      // Played
    }
    if (!wanted || this.playing) return;
    window.addEventListener('pointerdown', () => {
      if (!this.playing) void this.play();
    }, { once: true, capture: true });
  }

  /** Out of sight: an own song (an audio element) stops with the rest, and starts again on return */
  public hold(away: boolean): void {
    if (!this.element || !this.playing) return;
    if (away) this.element.pause();
    else void this.element.play().catch(() => undefined);
  }

  /** Starts or stops the music. Returns whether it is playing now. */
  public toggle(): boolean {
    if (this.playing) {
      this.pause();
      return false;
    }
    void this.play();
    return true;
  }

  public next(): void {
    const list = this.tracks();
    if (list.length === 0) return;
    const at = list.findIndex((t) => t.id === this.current?.id);
    const nextIndex = this.shuffle ? Math.floor(Math.random() * list.length) : (at + 1) % list.length;
    void this.play(list[nextIndex].id);
  }

  public previous(): void {
    const list = this.tracks();
    if (list.length === 0) return;
    const at = list.findIndex((t) => t.id === this.current?.id);
    void this.play(list[(at - 1 + list.length) % list.length].id);
  }

  /** How far through the track, 0 to 1 */
  public get progress(): number {
    if (!this.current) return 0;
    if (this.current.kind === 'song') return this.beats?.progress ?? 0;
    const el = this.element;
    return el && el.duration ? el.currentTime / el.duration : 0;
  }

  private async loadMine(): Promise<void> {
    try {
      const all = await withStore<StoredSong[]>('readonly', (s) => s.getAll() as IDBRequest<StoredSong[]>);
      this.mine = all.map((song) => ({ id: song.id, title: song.name.replace(/\.[a-z0-9]+$/i, ''), artist: 'From your phone', kind: 'mine' }));
      this.changed();
    } catch {
      // No storage in this browser: the player's own songs cannot be kept
    }
  }

  /** Adds songs from the player's phone. They are kept in this browser only. Returns how many were added. */
  public async addFiles(files: FileList | File[]): Promise<number> {
    let added = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue;
      const id = `mine-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
      try {
        await withStore('readwrite', (s) => s.put({ id, name: file.name, type: file.type, blob: file } satisfies StoredSong));
        added += 1;
      } catch {
        // Storage full: the rest are not kept
        break;
      }
    }
    await this.loadMine();
    return added;
  }

  public async remove(id: string): Promise<void> {
    if (this.current?.id === id) this.pause();
    await withStore('readwrite', (s) => s.delete(id)).catch(() => undefined);
    await this.loadMine();
  }
}
