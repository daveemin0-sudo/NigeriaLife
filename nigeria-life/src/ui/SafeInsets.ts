/**
 * Phone chrome insets.
 *
 * `--nl-inset-*` = real safe-area + visualViewport gap only. Used carefully;
 * the Map/Phone bottom bar must stay in its normal place (not lifted by a floor).
 *
 * `--nl-transit-inset-bottom` = that bottom inset plus a touch floor, so the
 * ride Chase/Side/Inside bar clears Android Back/Home when safe-area is 0
 * (Display size Large). Transit-only — do not wire the master nav to this.
 */
const PROBE_ID = 'nl-safe-inset-probe';

function ensureProbe(): HTMLElement {
  let el = document.getElementById(PROBE_ID);
  if (el) return el;
  el = document.createElement('div');
  el.id = PROBE_ID;
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    'width:0',
    'height:0',
    'pointer-events:none',
    'visibility:hidden',
    'padding-top:env(safe-area-inset-top, 0px)',
    'padding-right:env(safe-area-inset-right, 0px)',
    'padding-bottom:env(safe-area-inset-bottom, 0px)',
    'padding-left:env(safe-area-inset-left, 0px)',
  ].join(';');
  document.documentElement.appendChild(el);
  return el;
}

function isTouchLike(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches
    || Math.min(window.innerWidth, window.innerHeight) <= 700;
}

export function readSafeInsets(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
  transitBottom: number;
} {
  const probe = ensureProbe();
  const style = getComputedStyle(probe);
  const safeTop = parseFloat(style.paddingTop) || 0;
  const safeRight = parseFloat(style.paddingRight) || 0;
  const safeBottom = parseFloat(style.paddingBottom) || 0;
  const safeLeft = parseFloat(style.paddingLeft) || 0;

  const vv = window.visualViewport;
  const layoutH = window.innerHeight;
  const vvBottom = vv ? vv.offsetTop + vv.height : layoutH;
  const vvGap = Math.max(0, Math.round(layoutH - vvBottom));

  const bottom = Math.max(0, Math.round(Math.max(safeBottom, vvGap)));
  // Display size "Large" grows the system nav; only the journey camera bar uses this floor.
  const touchFloor = isTouchLike()
    ? Math.round(Math.max(48, Math.min(window.innerWidth, window.innerHeight) * 0.09))
    : 0;
  const transitBottom = Math.max(bottom, touchFloor);

  // Real iPhones report a large safe-area under the Dynamic Island / notch. Desktop phone
  // previews and some WebViews report 0 — still keep the clock/money clear of that chrome.
  let top = Math.max(0, Math.round(safeTop));
  const narrow = Math.min(window.innerWidth, window.innerHeight) <= 500;
  if (isTouchLike() && narrow && top < 44) top = 47;

  return {
    top,
    right: Math.max(0, Math.round(safeRight)),
    bottom,
    left: Math.max(0, Math.round(safeLeft)),
    transitBottom,
  };
}

/** Writes the CSS variables. Safe to call often. */
export function applySafeInsets(): ReturnType<typeof readSafeInsets> {
  const insets = readSafeInsets();
  const root = document.documentElement;
  root.style.setProperty('--nl-inset-top', `${insets.top}px`);
  root.style.setProperty('--nl-inset-right', `${insets.right}px`);
  root.style.setProperty('--nl-inset-bottom', `${insets.bottom}px`);
  root.style.setProperty('--nl-inset-left', `${insets.left}px`);
  root.style.setProperty('--nl-transit-inset-bottom', `${insets.transitBottom}px`);
  return insets;
}

/** Start listening. Call once at boot. */
export function installSafeInsets(): void {
  const run = () => {
    try { applySafeInsets(); } catch { /* ignore */ }
  };
  run();
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  window.visualViewport?.addEventListener('resize', run);
  window.visualViewport?.addEventListener('scroll', run);
  requestAnimationFrame(() => requestAnimationFrame(run));
}
