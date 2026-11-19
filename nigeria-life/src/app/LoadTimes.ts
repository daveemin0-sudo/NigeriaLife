/**
 * How long the game took to start on this device, stage by stage, so it can be read on the phone
 * itself (Settings, under Graphics) and compared from one version to the next. Times are seconds
 * from the moment the page was asked for. The last five starts are kept on the device.
 *
 *   script   the game's code has arrived and begun to run
 *   fonts    the fonts for names over heads are ready (waited for, at most 1.5 s)
 *   world    the city, its people and its vehicles are built
 *   shaders  every shader the city needs is compiled
 *   shown    the splash has gone: the city is on the screen
 *   playable the first second after that with ten frames drawn in it
 */
export type LoadStage = 'script' | 'fonts' | 'world' | 'shaders' | 'shown' | 'playable';

export interface LoadRecord {
  at: string;
  version: string;
  stages: Partial<Record<LoadStage, number>>;
  programs?: number;
}

const KEY = 'nl_load_times_v1';
const KEEP = 5;
const current: LoadRecord = { at: new Date().toISOString(), version: String((import.meta.env as unknown as Record<string, string | undefined>).VITE_BUILD_ID ?? 'dev'), stages: {} };

export function markLoad(stage: LoadStage): void {
  if (current.stages[stage] !== undefined) return;
  current.stages[stage] = Math.round(performance.now()) / 1000;
  if (stage === 'playable') save();
}

export function noteLoad(details: Pick<LoadRecord, 'programs'>): void {
  Object.assign(current, details);
}

/** Watches for the first second with ten frames drawn in it, then marks the game playable */
export function watchPlayable(): void {
  const times: number[] = [];
  const started = performance.now();
  const tick = (now: number): void => {
    times.push(now);
    while (times.length && now - times[0] > 1000) times.shift();
    if (times.length >= 10 || now - started > 120_000) markLoad('playable');
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function save(): void {
  try {
    const kept = loadHistory();
    kept.unshift(current);
    localStorage.setItem(KEY, JSON.stringify(kept.slice(0, KEEP)));
  } catch {
    // Not kept: shown for this start only
  }
}

export function loadHistory(): LoadRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** This start, as it stands */
export function thisLoad(): LoadRecord {
  return current;
}

/** One line for a start: when it was playable, and the stages that made it up */
export function describeLoad(record: LoadRecord): string {
  const s = record.stages;
  const part = (label: string, from: number | undefined, to: number | undefined) => (from !== undefined && to !== undefined ? `${label} ${(to - from).toFixed(1)}` : null);
  const parts = [
    s.script !== undefined ? `code ${s.script.toFixed(1)}` : null,
    part('fonts', s.script, s.fonts),
    part('city', s.fonts, s.world),
    part('shaders', s.world, s.shaders),
    part('first frames', s.shown, s.playable),
  ].filter(Boolean);
  const total = s.playable ?? s.shown;
  return `${total !== undefined ? `${total.toFixed(1)} s to playable` : 'still starting'} (${parts.join(' · ')} s)`;
}
