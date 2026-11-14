import type * as THREE from 'three';
import { describeLoad, loadHistory, thisLoad } from '../app/LoadTimes';
import { SERVER_URL } from '../realestate/ServerLink';

/**
 * A performance readout, for measuring the game on a real phone (quality roadmap, stage 0).
 *
 * Off unless switched on: Settings › Graphics, or `?perf=1` in the page's address (`?perf=0` turns
 * it off again). It shows only what the page itself can know, and says so:
 *
 *   frames      the gaps between animation frames (requestAnimationFrame), as frames a second and
 *               the 95th-percentile gap, over the last 10 seconds
 *   drawing     three.js's own counts of the last frame drawn: draw calls, triangles, and the
 *               geometries and textures it holds
 *   JS heap     Chrome's performance.memory: the JavaScript heap only, rounded by Chrome. It is a
 *               trend, not the phone's memory; Android's own figure for the tab needs a USB cable
 *               and `adb shell dumpsys meminfo` (see docs/A16_TEST_SESSION.md)
 *   start-up    the game's own load timer (src/app/LoadTimes.ts)
 *   reload      whether this page is a reload, and whether Chrome says it was discarded (killed
 *               for memory) and brought back
 *
 * "Mark" keeps a snapshot of the last 10 seconds with a label (the city and where the player is).
 * "Report" shows everything as text to copy or save. On a phone the test page is plain http on the
 * home network, where Chrome refuses the clipboard, so the report is shown in a box to select and
 * copy, with a button that saves it as a file. Nothing is sent anywhere.
 *
 * Its cost: one timestamp a frame and a few lines of text twice a second; it draws nothing in the scene.
 */
export interface PerfSource {
  renderer: THREE.WebGLRenderer;
  city: () => string;
  where: () => string;
}

interface Snapshot {
  label: string;
  at: string;
  city: string;
  where: string;
  fps: number;
  p95: number;
  worst: number;
  frames: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  heapMB: number | null;
  heapLimitMB: number | null;
}

const ON_KEY = 'nl_perf_readout_v1';
const MARKS_KEY = 'nl_perf_marks_v1';
const ALIVE_KEY = 'nl_perf_alive_v1';
const WINDOW_MS = 10_000;

export class PerfReadout {
  private static inst: PerfReadout | null = null;
  public static get(): PerfReadout {
    return (PerfReadout.inst ??= new PerfReadout());
  }

  private source: PerfSource | null = null;
  /** Frame times as [when, gap] pairs, the last 10 seconds */
  private readonly times: number[] = [];
  private last = 0;
  private running = false;
  private shownAt = 0;
  private panel: HTMLDivElement | null = null;
  private text: HTMLDivElement | null = null;
  private sheet: HTMLDivElement | null = null;
  private marks: Snapshot[] = [];
  /** How this page came to be: a fresh load, a reload, or brought back after Chrome discarded it */
  public readonly arrival: { reload: boolean; discarded: boolean; wasRunning: boolean };

  private constructor() {
    const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    let wasRunning = false;
    try {
      wasRunning = sessionStorage.getItem(ALIVE_KEY) === '1';
      this.marks = JSON.parse(sessionStorage.getItem(MARKS_KEY) ?? '[]');
      if (!Array.isArray(this.marks)) this.marks = [];
    } catch {
      this.marks = [];
    }
    this.arrival = { reload: nav === 'reload', discarded: !!(document as Document & { wasDiscarded?: boolean }).wasDiscarded, wasRunning };
    // The address can switch it on or off for this device
    try {
      const asked = new URLSearchParams(location.search).get('perf');
      if (asked === '1') localStorage.setItem(ON_KEY, '1');
      if (asked === '0') localStorage.removeItem(ON_KEY);
    } catch {
      // No storage: it stays as it is
    }
  }

  /** Is it switched on for this device? */
  public get enabled(): boolean {
    try {
      return localStorage.getItem(ON_KEY) === '1';
    } catch {
      return false;
    }
  }

  public setEnabled(on: boolean): void {
    try {
      if (on) localStorage.setItem(ON_KEY, '1');
      else localStorage.removeItem(ON_KEY);
    } catch {
      // Not kept: for this visit only
    }
    if (on) this.start();
    else this.stop();
  }

  /** The game hands over what to read; the readout starts if it is switched on */
  public attach(source: PerfSource): void {
    this.source = source;
    if (this.enabled) this.start();
  }

  /** The figures over the last 10 seconds, and the last frame's drawing counts */
  public snapshot(label = ''): Snapshot {
    const gaps: number[] = [];
    for (let i = 1; i < this.times.length; i += 2) gaps.push(this.times[i]);
    gaps.sort((a, b) => a - b);
    const total = gaps.reduce((t, g) => t + g, 0);
    const info = this.source?.renderer.info;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    const city = this.source?.city() ?? '';
    const where = this.source?.where() ?? '';
    return {
      label: label || `${city} ${where}`,
      at: new Date().toISOString(),
      city,
      where,
      fps: gaps.length && total > 0 ? +((gaps.length * 1000) / total).toFixed(1) : 0,
      p95: gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))].toFixed(1) : 0,
      worst: gaps.length ? +gaps[gaps.length - 1].toFixed(1) : 0,
      frames: gaps.length,
      calls: info?.render.calls ?? 0,
      triangles: info?.render.triangles ?? 0,
      geometries: info?.memory.geometries ?? 0,
      textures: info?.memory.textures ?? 0,
      programs: info?.programs?.length ?? 0,
      heapMB: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
      heapLimitMB: memory ? Math.round(memory.jsHeapSizeLimit / 1048576) : null,
    };
  }

  /** Keeps a snapshot of now, labelled */
  public mark(label = ''): Snapshot {
    const snap = this.snapshot(label);
    this.marks.push(snap);
    try {
      sessionStorage.setItem(MARKS_KEY, JSON.stringify(this.marks.slice(-60)));
    } catch {
      // Kept for this page only
    }
    this.flash(`Marked: ${snap.label}`);
    return snap;
  }

  public clearMarks(): void {
    this.marks = [];
    try {
      sessionStorage.removeItem(MARKS_KEY);
    } catch {
      // Nothing kept
    }
  }

  /** Everything, as plain text: the device, the server, the start-ups, how the page arrived, and the marks */
  public report(): string {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const server = SERVER_URL ?? 'none (playing on this device only)';
    const live = SERVER_URL ? /onrender\.com|github\.io/i.test(SERVER_URL) : false;
    const lines = [
      'NigeriaLife performance report',
      `When: ${new Date().toISOString()}`,
      `Build: ${String((import.meta.env as unknown as Record<string, string | undefined>).VITE_BUILD_ID ?? 'dev')}`,
      `Page: ${location.origin}${location.pathname}`,
      `Server: ${server}${live ? '  << THE LIVE SERVER: this is not a test session' : ''}`,
      `Device: ${navigator.userAgent}`,
      `Screen: ${screen.width}x${screen.height} CSS px, window ${innerWidth}x${innerHeight}, pixel ratio ${devicePixelRatio}`,
      `Device memory (Chrome's rounded figure): ${nav.deviceMemory ?? 'not given'} GB; CPU threads: ${navigator.hardwareConcurrency ?? 'not given'}`,
      `JS heap available: ${'memory' in performance ? 'yes (Chrome, rounded)' : 'no (this browser does not give it)'}`,
      `This page: ${this.arrival.discarded ? 'BROUGHT BACK AFTER CHROME DISCARDED IT' : this.arrival.reload ? (this.arrival.wasRunning ? 'reloaded while the readout was running' : 'reloaded') : 'a fresh load'}`,
      `Start-up now: ${describeLoad(thisLoad())}`,
      ...loadHistory()
        .filter((r) => r.at !== thisLoad().at)
        .slice(0, 4)
        .map((r) => `Start-up ${r.at}: ${describeLoad(r)}`),
      '',
      'Marks (each over the 10 seconds before it):',
      'label | time | fps | p95 ms | worst ms | draw calls | triangles | geometries | textures | shaders | JS heap MB / limit',
      ...this.marks.map((m) => [m.label, m.at.slice(11, 19), m.fps, m.p95, m.worst, m.calls, m.triangles, m.geometries, m.textures, m.programs, m.heapMB === null ? 'n/a' : `${m.heapMB} / ${m.heapLimitMB}`].join(' | ')),
      '',
      `Now: ${(() => {
        const s = this.snapshot('now');
        return `${s.fps} fps, p95 ${s.p95} ms, ${s.calls} calls, ${s.triangles} triangles, heap ${s.heapMB ?? 'n/a'} MB`;
      })()}`,
    ];
    return lines.join('\n');
  }

  // ------------------------------------------------------------------ the panel

  private start(): void {
    if (this.running) return;
    this.running = true;
    try {
      sessionStorage.setItem(ALIVE_KEY, '1');
    } catch {
      // Not kept
    }
    this.build();
    if (this.panel) this.panel.style.display = '';
    this.last = performance.now();
    const tick = (now: number): void => {
      if (!this.running) return;
      const gap = now - this.last;
      this.last = now;
      this.times.push(now, gap);
      while (this.times.length > 2 && now - this.times[0] > WINDOW_MS) this.times.splice(0, 2);
      if (now - this.shownAt > 500) {
        this.shownAt = now;
        this.show();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private stop(): void {
    this.running = false;
    try {
      sessionStorage.removeItem(ALIVE_KEY);
    } catch {
      // Nothing kept
    }
    if (this.panel) this.panel.style.display = 'none';
    this.closeSheet();
  }

  private show(): void {
    if (!this.text) return;
    const s = this.snapshot();
    const heap = s.heapMB === null ? 'heap n/a' : `heap ${s.heapMB} MB`;
    this.text.textContent = `${s.fps} fps · p95 ${s.p95} ms\n${s.calls} calls · ${Math.round(s.triangles / 1000)}k tris\n${heap} · ${s.city} ${s.where}`;
  }

  private build(): void {
    if (this.panel) return;
    const panel = document.createElement('div');
    panel.id = 'nl-perf-readout';
    panel.setAttribute('style', [
      'position:fixed', 'left:6px', 'top:42%', 'z-index:2147483000', 'width:156px', 'padding:6px 8px',
      'background:rgba(15,23,42,0.78)', 'color:#e2e8f0', 'border-radius:8px', 'font:600 11px/1.35 ui-monospace,Menlo,Consolas,monospace',
      'pointer-events:auto', 'user-select:none',
    ].join(';'));
    const text = document.createElement('div');
    text.style.whiteSpace = 'pre';
    panel.appendChild(text);
    const bar = document.createElement('div');
    bar.setAttribute('style', 'display:flex;gap:4px;margin-top:5px');
    const button = (label: string, act: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('style', 'flex:1;min-height:32px;border:0;border-radius:6px;background:#334155;color:#f8fafc;font:600 11px/1 system-ui,sans-serif');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        act();
      });
      return b;
    };
    bar.append(button('Mark', () => this.mark()), button('Report', () => this.openSheet()));
    panel.appendChild(bar);
    document.body.appendChild(panel);
    this.panel = panel;
    this.text = text;
  }

  private flash(message: string): void {
    if (!this.text) return;
    this.text.textContent = message;
    this.shownAt = performance.now() + 900;
  }

  private openSheet(): void {
    this.closeSheet();
    const sheet = document.createElement('div');
    sheet.id = 'nl-perf-report';
    sheet.setAttribute('style', 'position:fixed;inset:0;z-index:2147483001;background:rgba(2,6,23,0.92);display:flex;flex-direction:column;padding:12px;gap:8px');
    const box = document.createElement('textarea');
    box.readOnly = true;
    box.value = this.report();
    box.setAttribute('style', 'flex:1;width:100%;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:8px');
    const row = document.createElement('div');
    row.setAttribute('style', 'display:flex;gap:8px;flex-wrap:wrap');
    const button = (label: string, act: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.textContent = label;
      b.setAttribute('style', 'flex:1;min-width:96px;min-height:44px;border:0;border-radius:8px;background:#1e293b;color:#f8fafc;font:600 14px system-ui,sans-serif');
      b.addEventListener('click', act);
      return b;
    };
    row.append(
      button('Select all', () => {
        box.focus();
        box.select();
        try {
          void navigator.clipboard?.writeText(box.value);
        } catch {
          // Not allowed on a plain-http page: long-press and copy instead
        }
      }),
      button('Save as file', () => {
        const blob = new Blob([box.value], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nigerialife-perf-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }),
      button('Clear marks', () => {
        this.clearMarks();
        box.value = this.report();
      }),
      button('Close', () => this.closeSheet())
    );
    sheet.append(box, row);
    document.body.appendChild(sheet);
    this.sheet = sheet;
  }

  private closeSheet(): void {
    this.sheet?.remove();
    this.sheet = null;
  }
}
