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
  coords?: () => { x: number; z: number } | null;
  activity?: () => string;
}

interface Snapshot {
  label: string;
  at: string;
  city: string;
  where: string;
  x: number | null;
  z: number | null;
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

interface LongFrame {
  at: string;
  gapMs: number;
  city: string;
  where: string;
  x: number | null;
  z: number | null;
  activity: string;
  programsDelta: number;
}

interface TapRecord {
  at: string;
  city: string;
  name: string;
  id: string;
  outcome: string;
}

const ON_KEY = 'nl_perf_readout_v1';
const MARKS_KEY = 'nl_perf_marks_v1';
const LONG_FRAMES_KEY = 'nl_perf_long_frames_v1';
const TAPS_KEY = 'nl_perf_taps_v1';
const ALIVE_KEY = 'nl_perf_alive_v1';
const WINDOW_MS = 10_000;
const LONG_FRAME_MS = 500;

export class PerfReadout {
  private static inst: PerfReadout | null = null;
  public static get(): PerfReadout {
    return (PerfReadout.inst ??= new PerfReadout());
  }

  private source: PerfSource | null = null;
  /** Frame times as [when, gap] pairs, the last 10 seconds */
  private readonly times: number[] = [];
  private last = 0;
  private lastPrograms = 0;
  private running = false;
  private collapsed = false;
  private shownAt = 0;
  private panel: HTMLDivElement | null = null;
  private text: HTMLDivElement | null = null;
  private body: HTMLDivElement | null = null;
  private toggleBtn: HTMLButtonElement | null = null;
  private titleSpan: HTMLSpanElement | null = null;
  private sheet: HTMLDivElement | null = null;
  private marks: Snapshot[] = [];
  private longFrames: LongFrame[] = [];
  private taps: TapRecord[] = [];
  /** How this page came to be: a fresh load, a reload, or brought back after Chrome discarded it */
  public readonly arrival: { reload: boolean; discarded: boolean; wasRunning: boolean };

  private constructor() {
    const nav = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    let wasRunning = false;
    try {
      wasRunning = sessionStorage.getItem(ALIVE_KEY) === '1';
      this.marks = JSON.parse(sessionStorage.getItem(MARKS_KEY) ?? '[]');
      if (!Array.isArray(this.marks)) this.marks = [];
      this.longFrames = JSON.parse(sessionStorage.getItem(LONG_FRAMES_KEY) ?? '[]');
      if (!Array.isArray(this.longFrames)) this.longFrames = [];
      this.taps = JSON.parse(sessionStorage.getItem(TAPS_KEY) ?? '[]');
      if (!Array.isArray(this.taps)) this.taps = [];
    } catch {
      this.marks = [];
      this.longFrames = [];
      this.taps = [];
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
    const pos = this.source?.coords?.() ?? null;
    return {
      label: label || `${city} ${where}`,
      at: new Date().toISOString(),
      city,
      where,
      x: pos ? Math.round(pos.x) : null,
      z: pos ? Math.round(pos.z) : null,
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

  /** Records a tapped place/object and what opened, for diagnosing A16 reports */
  public recordTap(name: string, outcome: string, id = ''): void {
    if (!this.enabled) return;
    const city = this.source?.city() ?? '';
    this.taps.push({
      at: new Date().toISOString().slice(11, 19),
      city,
      name: name.slice(0, 48),
      id: id.slice(0, 48),
      outcome: outcome.slice(0, 48),
    });
    if (this.taps.length > 8) this.taps.splice(0, this.taps.length - 8);
    try {
      sessionStorage.setItem(TAPS_KEY, JSON.stringify(this.taps));
    } catch {
      // Kept for this page only
    }
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
    this.longFrames = [];
    this.taps = [];
    try {
      sessionStorage.removeItem(MARKS_KEY);
      sessionStorage.removeItem(LONG_FRAMES_KEY);
      sessionStorage.removeItem(TAPS_KEY);
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
      `JS heap available: ${'memory' in performance ? 'yes (Chrome, rounded; includes uncollected garbage — live heap requires DevTools/GC, Android PSS requires adb)' : 'no (this browser does not give it)'}`,
      `This page: ${this.arrival.discarded ? 'BROUGHT BACK AFTER CHROME DISCARDED IT' : this.arrival.reload ? (this.arrival.wasRunning ? 'reloaded while the readout was running' : 'reloaded') : 'a fresh load'}`,
      `Start-up now: ${describeLoad(thisLoad())}`,
      ...loadHistory()
        .filter((r) => r.at !== thisLoad().at)
        .slice(0, 4)
        .map((r) => `Start-up ${r.at}: ${describeLoad(r)}`),
      '',
      'Marks (each over the 10 seconds before it):',
      'label | time | fps | p95 ms | worst ms | draw calls | triangles | geometries | textures | shaders | JS heap MB / limit | pos (x,z)',
      ...this.marks.map((m) => [m.label, m.at.slice(11, 19), m.fps, m.p95, m.worst, m.calls, m.triangles, m.geometries, m.textures, m.programs, m.heapMB === null ? 'n/a' : `${m.heapMB} / ${m.heapLimitMB}`, m.x !== null && m.z !== null ? `${m.x},${m.z}` : 'n/a'].join(' | ')),
      '',
      'Long frames (>500 ms):',
      ...(this.longFrames.length
        ? ['time | gap ms | city | where | pos (x,z) | activity | +shaders', ...this.longFrames.map((f) => [f.at, f.gapMs, f.city, f.where, f.x !== null && f.z !== null ? `${f.x},${f.z}` : 'n/a', f.activity || 'unknown', f.programsDelta].join(' | '))]
        : ['none recorded']),
      '',
      'Last places tapped:',
      ...(this.taps.length
        ? ['time | city | place | id | opened', ...this.taps.map((t) => [t.at, t.city, t.name, t.id || '-', t.outcome].join(' | '))]
        : ['none recorded']),
      '',
      `Now: ${(() => {
        const s = this.snapshot('now');
        const pos = s.x !== null && s.z !== null ? ` at (${s.x},${s.z})` : '';
        return `${s.fps} fps, p95 ${s.p95} ms, ${s.calls} calls, ${s.triangles} triangles, heap ${s.heapMB ?? 'n/a'} MB${pos}`;
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
    this.shownAt = 0;
    this.lastPrograms = this.source?.renderer.info.programs?.length ?? 0;
    this.show();
    const tick = (now: number): void => {
      if (!this.running) return;
      const gap = now - this.last;
      this.last = now;
      const programsNow = this.source?.renderer.info.programs?.length ?? 0;
      if (this.times.length > 0 && gap > LONG_FRAME_MS) {
        this.recordLongFrame(gap, programsNow - this.lastPrograms);
      }
      this.lastPrograms = programsNow;
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

  private recordLongFrame(gapMs: number, programsDelta: number): void {
    const pos = this.source?.coords?.() ?? null;
    this.longFrames.push({
      at: new Date().toISOString().slice(11, 19),
      gapMs: Math.round(gapMs),
      city: this.source?.city() ?? '',
      where: this.source?.where() ?? '',
      x: pos ? Math.round(pos.x) : null,
      z: pos ? Math.round(pos.z) : null,
      activity: this.source?.activity?.() ?? '',
      programsDelta,
    });
    if (this.longFrames.length > 30) this.longFrames.splice(0, this.longFrames.length - 30);
    try {
      sessionStorage.setItem(LONG_FRAMES_KEY, JSON.stringify(this.longFrames));
    } catch {
      // Kept for this page only
    }
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
    if (this.titleSpan) this.titleSpan.textContent = `Perf · ${s.fps} fps`;
    if (this.collapsed) return;
    const heap = s.heapMB === null ? 'heap n/a' : `heap ${s.heapMB} MB`;
    this.text.textContent = `${s.fps} fps · p95 ${s.p95} ms\n${s.calls} calls · ${Math.round(s.triangles / 1000)}k tris\n${heap} · ${s.city} ${s.where}`;
  }

  public setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    if (this.body) this.body.style.display = collapsed ? 'none' : '';
    if (this.panel) this.panel.style.width = collapsed ? 'auto' : '152px';
    if (this.toggleBtn) {
      this.toggleBtn.textContent = collapsed ? '+' : '−';
      this.toggleBtn.setAttribute('aria-label', collapsed ? 'Expand performance readout' : 'Collapse performance readout');
    }
    if (!collapsed) this.show();
  }

  private build(): void {
    if (this.panel) return;
    const panel = document.createElement('div');
    panel.id = 'nl-perf-readout';
    panel.setAttribute('style', [
      'position:fixed', 'top:4px', 'right:4px', 'left:auto', 'z-index:2147483000',
      'width:152px', 'max-width:calc(100vw - 8px)', 'padding:5px 7px',
      'background:rgba(15,23,42,0.82)', 'color:#e2e8f0', 'border-radius:8px',
      'font:600 10px/1.3 ui-monospace,Menlo,Consolas,monospace',
      'pointer-events:auto', 'user-select:none', 'box-sizing:border-box',
    ].join(';'));

    const header = document.createElement('div');
    header.setAttribute('style', 'display:flex;align-items:center;justify-content:space-between;gap:6px');
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Perf';
    titleSpan.setAttribute('style', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis');
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = '−';
    toggleBtn.setAttribute('aria-label', 'Collapse performance readout');
    toggleBtn.setAttribute('style', 'min-width:22px;min-height:22px;padding:0 5px;border:0;border-radius:5px;background:#334155;color:#f8fafc;font:700 12px/1 system-ui,sans-serif;cursor:pointer');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setCollapsed(!this.collapsed);
    });
    header.append(titleSpan, toggleBtn);

    const body = document.createElement('div');
    body.setAttribute('style', 'margin-top:4px');
    const text = document.createElement('div');
    text.style.whiteSpace = 'pre';
    body.appendChild(text);
    const bar = document.createElement('div');
    bar.setAttribute('style', 'display:flex;gap:4px;margin-top:5px');
    const button = (label: string, act: () => void): HTMLButtonElement => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('style', 'flex:1;min-height:28px;border:0;border-radius:6px;background:#334155;color:#f8fafc;font:600 11px/1 system-ui,sans-serif;cursor:pointer');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        act();
      });
      return b;
    };
    bar.append(button('Mark', () => this.mark()), button('Report', () => this.openSheet()));
    body.appendChild(bar);
    panel.append(header, body);
    document.body.appendChild(panel);
    this.panel = panel;
    this.body = body;
    this.text = text;
    this.toggleBtn = toggleBtn;
    this.titleSpan = titleSpan;
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
