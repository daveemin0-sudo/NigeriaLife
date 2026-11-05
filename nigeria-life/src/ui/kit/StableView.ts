/**
 * Draws a screen from an HTML string without the reader losing their place.
 *
 * Screens in this game are redrawn from the game state, and the game state changes all the
 * time (needs tick every second, the save is written every few seconds). Replacing a screen's
 * HTML throws away the list the player was scrolling, so every screen draws through here:
 *
 * - if the HTML is the same as last time, nothing is touched at all;
 * - if it changed, every scrolled list, the focused field and what was typed are put back.
 *
 * A screen that is genuinely new (another tab, another app) asks for `fresh`, and starts at the top.
 *
 * A redraw also waits for a finger: while something on the screen is being pressed, the screen
 * is left alone until the press is over, because replacing a button between the press and the
 * release loses the click.
 */

interface Kept {
  html: string;
}

const lastDrawn = new WeakMap<HTMLElement, Kept>();

export interface DrawOptions {
  /** A new screen: start at the top instead of keeping the old place */
  fresh?: boolean;
  /** Called whenever the page is actually changed, now or once a press is over */
  drawn?: () => void;
}

/** What is being pressed right now, if anything */
let pressed: Element | null = null;
/** Screens whose redraw is waiting for that press to end */
const waiting = new Map<HTMLElement, { html: string; options: DrawOptions }>();

function redrawWaiting(): void {
  for (const [container, entry] of Array.from(waiting)) {
    waiting.delete(container);
    if (container.isConnected) draw(container, entry.html, entry.options);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (event) => {
    pressed = event.target instanceof Element ? event.target : null;
  }, true);
  const released = () => {
    pressed = null;
    // After the click this release produces has been delivered to what was pressed
    if (waiting.size > 0) window.setTimeout(redrawWaiting, 0);
  };
  document.addEventListener('pointerup', released, true);
  document.addEventListener('pointercancel', released, true);
}

/** Where an element sits under the container, as child positions, so it can be found again after a redraw. */
function pathTo(container: HTMLElement, el: Element): number[] | null {
  const path: number[] = [];
  let node: Element | null = el;
  while (node && node !== container) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;
    path.push(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return node === container ? path.reverse() : null;
}

function follow(container: HTMLElement, path: number[]): Element | null {
  let node: Element = container;
  for (const index of path) {
    const next = node.children[index];
    if (!next) return null;
    node = next;
  }
  return node;
}

/** An element is found again by its id when it has one, otherwise by where it sat. */
function locate(container: HTMLElement, id: string, path: number[] | null, tag: string): Element | null {
  if (id) {
    const byId = container.querySelector(`#${CSS.escape(id)}`);
    if (byId) return byId;
  }
  const byPath = path ? follow(container, path) : null;
  return byPath && byPath.tagName === tag ? byPath : null;
}

/**
 * Sets a container's HTML. Returns true if the page was actually changed, which is when the
 * caller needs to attach its event handlers again.
 */
export function draw(container: HTMLElement, html: string, options: DrawOptions = {}): boolean {
  if (pressed && pressed !== container && container.contains(pressed)) {
    const before = waiting.get(container);
    waiting.set(container, { html, options: { ...options, fresh: options.fresh || before?.options.fresh } });
    return false;
  }
  waiting.delete(container);

  const kept = lastDrawn.get(container);
  if (!options.fresh && kept && kept.html === html) return false;

  // Remember every list that has been scrolled, and the field being typed in
  const scrolled: Array<{ id: string; path: number[] | null; tag: string; top: number; left: number; atBottom: boolean }> = [];
  let focus: { id: string; path: number[] | null; tag: string; value: string | null; start: number | null; end: number | null } | null = null;
  const typed: Array<{ id: string; value: string }> = [];

  if (!options.fresh && kept) {
    const candidates: Element[] = [container, ...Array.from(container.querySelectorAll('*'))];
    for (const el of candidates) {
      if (el.scrollTop === 0 && el.scrollLeft === 0) continue;
      scrolled.push({
        id: el === container ? '' : el.id,
        path: el === container ? [] : pathTo(container, el),
        tag: el.tagName,
        top: el.scrollTop,
        left: el.scrollLeft,
        atBottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2,
      });
    }
    const active = document.activeElement;
    if (active && active !== container && container.contains(active)) {
      const field = active as HTMLInputElement;
      let start: number | null = null;
      let end: number | null = null;
      try {
        start = field.selectionStart ?? null;
        end = field.selectionEnd ?? null;
      } catch {
        // Not a text field: nothing to keep
      }
      focus = { id: active.id, path: pathTo(container, active), tag: active.tagName, value: 'value' in field ? field.value : null, start, end };
    }
    // What has been typed into named fields survives the redraw even when they are not focused.
    // A field marked data-bind is left out: whoever draws it keeps what was typed and writes it
    // into the HTML, which is also how it empties the field once the text has been used.
    for (const field of Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[id], textarea[id]'))) {
      if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'range' || field.dataset.bind) continue;
      if (field.value !== field.defaultValue) typed.push({ id: field.id, value: field.value });
    }
  }

  container.innerHTML = html;
  lastDrawn.set(container, { html });

  for (const entry of typed) {
    const field = container.querySelector<HTMLInputElement>(`#${CSS.escape(entry.id)}`);
    if (field) field.value = entry.value;
  }
  for (const entry of scrolled) {
    const el = entry.path && entry.path.length === 0 ? container : locate(container, entry.id, entry.path, entry.tag);
    if (!el) continue;
    // Someone reading the end of a list stays at the end if it grew or shrank
    el.scrollTop = entry.atBottom ? el.scrollHeight : entry.top;
    el.scrollLeft = entry.left;
  }
  if (focus) {
    const el = locate(container, focus.id, focus.path, focus.tag) as HTMLInputElement | null;
    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
      if (focus.value !== null && 'value' in el && !el.dataset.bind && el.value !== focus.value) el.value = focus.value;
      if (focus.start !== null && typeof el.setSelectionRange === 'function') {
        try {
          el.setSelectionRange(focus.start, focus.end ?? focus.start);
        } catch {
          // This kind of field has no caret to restore
        }
      }
    }
  }
  options.drawn?.();
  return true;
}

/** Forgets what was drawn, so the next draw is treated as new. Call when a screen is closed. */
export function forget(container: HTMLElement): void {
  lastDrawn.delete(container);
}
