import * as THREE from 'three';
import type { MatchSim } from '../world/landmarks/MatchSim';

export type Channel = 'football' | 'news' | 'music';

export const CHANNELS: Array<{ id: Channel; name: string; icon: string }> = [
  { id: 'football', name: 'Football, live from the National Stadium', icon: '⚽' },
  { id: 'news', name: 'NigeriaLife News', icon: '📰' },
  { id: 'music', name: 'Afrobeats countdown', icon: '🎵' },
];

const HEADLINES = [
  'Traffic is heavy on Broad Street toward the bridge',
  'Apapa Port: the MV Eko Pride is unloading at the quay',
  'NigeriaLife Air adds flights between Abuja and Port Harcourt',
  'Land on Banana Island Road is changing hands',
  'Rain is expected over the lagoon this evening',
];
const SONGS = ['Lagos at Night', 'Oya Dance', 'Third Mainland', 'Sweet Like Zobo', 'Up NEPA'];

/**
 * A television that shows something. It draws its channel on a small canvas a few times a
 * second and the screen wears that as its picture. Football is the match really being played
 * at the stadium: the same players, the same ball and the same score, seen from above.
 */
export class Television {
  /** The match on the football channel, and whether one is being played now */
  public static match: MatchSim | null = null;
  public static matchOn: () => boolean = () => true;
  /** The time on the game's clock, for the news */
  public static clock: () => { day: number; hour: number } = () => ({ day: 1, hour: 12 });

  public on = false;
  public channel: Channel = 'football';
  private readonly screen: THREE.Mesh;
  private readonly canvas: HTMLCanvasElement;
  private readonly texture: THREE.CanvasTexture;
  private readonly lit: THREE.MeshBasicMaterial;
  private readonly dark: THREE.MeshBasicMaterial;
  private sinceDrawn = 1;
  private time = 0;
  /** How many pictures it has drawn since it was turned on: proof that something is showing */
  public frames = 0;

  constructor(screen: THREE.Mesh) {
    this.screen = screen;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 320;
    this.canvas.height = 180;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.lit = new THREE.MeshBasicMaterial({ map: this.texture });
    this.dark = new THREE.MeshBasicMaterial({ color: 0x06080c });
    this.screen.material = this.dark;
  }

  public turnOn(channel: Channel = this.channel): void {
    this.on = true;
    this.channel = channel;
    this.frames = 0;
    this.sinceDrawn = 1;
    this.screen.material = this.lit;
  }

  public turnOff(): void {
    this.on = false;
    this.screen.material = this.dark;
  }

  /** What it is showing, in words. */
  public showing(): string {
    if (!this.on) return 'Off';
    return CHANNELS.find((channel) => channel.id === this.channel)?.name ?? 'On';
  }

  public update(delta: number): void {
    if (!this.on) return;
    this.time += delta;
    this.sinceDrawn += delta;
    if (this.sinceDrawn < 0.16) return;
    this.sinceDrawn = 0;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.canvas;
    if (this.channel === 'football') this.football(ctx, width, height);
    else if (this.channel === 'news') this.news(ctx, width, height);
    else this.music(ctx, width, height);
    this.frames += 1;
    this.texture.needsUpdate = true;
  }

  private football(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const match = Television.match;
    if (!match || !Television.matchOn()) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 22px system-ui, sans-serif';
      ctx.fillText('No match on now', width / 2, height / 2 - 14);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillText('Kick-off at 9:00 at the National Stadium', width / 2, height / 2 + 14);
      return;
    }
    match.drawBroadcast(ctx, width, height);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(width - 52, height - 22, 46, 16);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 11px system-ui, sans-serif';
    ctx.fillText('LIVE', width - 29, height - 14);
  }

  private news(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const { day, hour } = Television.clock();
    ctx.fillStyle = '#0b2545';
    ctx.fillRect(0, 0, width, height);
    // The desk and the reader
    ctx.fillStyle = '#13315c';
    ctx.fillRect(0, height * 0.62, width, height * 0.38);
    ctx.fillStyle = '#6b4226';
    ctx.beginPath();
    ctx.arc(width * 0.26, height * 0.36, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#134074';
    ctx.fillRect(width * 0.26 - 26, height * 0.36 + 16, 52, 40);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText('NIGERIALIFE NEWS', width * 0.46, height * 0.2);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const whole = Math.floor(hour);
    const minutes = String(Math.floor((hour - whole) * 60)).padStart(2, '0');
    ctx.fillText(`Day ${day}  ·  ${whole}:${minutes}`, width * 0.46, height * 0.34);
    // The headline changes every few seconds; the strip along the bottom runs all the time
    const headline = HEADLINES[Math.floor(this.time / 5) % HEADLINES.length];
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, height * 0.7, width, 26);
    ctx.fillStyle = '#0b2545';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.fillText(headline, 10, height * 0.7 + 13, width - 20);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, height - 22, width, 22);
    ctx.fillStyle = '#ffffff';
    const strip = HEADLINES.join('   ·   ');
    const run = (this.time * 46) % (strip.length * 7.2);
    ctx.fillText(`${strip}   ·   ${strip}`, 10 - run, height - 11);
  }

  private music(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const beat = this.time / 0.535;
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(0, 0, width, height);
    const bars = 16;
    for (let i = 0; i < bars; i++) {
      const level = 0.25 + 0.75 * Math.abs(Math.sin(beat * Math.PI * (0.5 + (i % 5) * 0.21) + i * 1.3));
      const tall = level * height * 0.52;
      ctx.fillStyle = ['#ec4899', '#8b5cf6', '#22d3ee', '#facc15'][i % 4];
      ctx.fillRect(12 + i * ((width - 24) / bars), height * 0.82 - tall, (width - 24) / bars - 4, tall);
    }
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText('AFROBEATS COUNTDOWN', 12, 18);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = '#c4b5fd';
    const place = (Math.floor(this.time / 8) % SONGS.length);
    ctx.fillText(`No. ${SONGS.length - place}  ·  ${SONGS[place]}`, 12, height - 14);
  }
}
