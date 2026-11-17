/**
 * Keeps `--nl-inset-top` / `--nl-inset-bottom` honest on real phones.
 *
 * Chrome on Android often reports `env(safe-area-inset-bottom)` as 0 while the
 * system Back/Home bar still covers the bottom of the page — worse when the
 * player turns Display size up. We take the max of CSS safe-area, the visual
 * viewport gap, and a touch floor so journey controls stay above that bar.
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

export function readSafeInsets(): { top: number; bottom: number; left: number; right: number } {
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

  // Display size "Large" grows the system nav in CSS px; keep a share of the short side.
  const touchFloor = isTouchLike()
    ? Math.round(Math.max(48, Math.min(window.innerWidth, window.innerHeight) * 0.09))
    : 0;

  return {
    top: Math.max(0, Math.round(safeTop)),
    right: Math.max(0, Math.round(safeRight)),
    bottom: Math.max(0, Math.round(Math.max(safeBottom, vvGap, touchFloor))),
    left: Math.max(0, Math.round(safeLeft)),
  };
}

/** Writes the CSS variables the HUD and journey card use. Safe to call often. */
export function applySafeInsets(): { top: number; bottom: number; left: number; right: number } {
  const insets = readSafeInsets();
  const root = document.documentElement;
  root.style.setProperty('--nl-inset-top', `${insets.top}px`);
  root.style.setProperty('--nl-inset-right', `${insets.right}px`);
  root.style.setProperty('--nl-inset-bottom', `${insets.bottom}px`);
  root.style.setProperty('--nl-inset-left', `${insets.left}px`);
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
  // First paint after fonts/layout can change innerHeight on Android Chrome
  requestAnimationFrame(() => requestAnimationFrame(run));
}
