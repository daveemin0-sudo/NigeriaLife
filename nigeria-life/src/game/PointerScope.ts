import { UIStateManager } from '../ui/UIStateManager';

/** Handles a wheel turn over the game view. Returns true if it used it. */
type GameWheelHandler = (pixels: number, event: WheelEvent) => boolean;

/**
 * Decides who a pointer or wheel event belongs to: the game view (the 3D canvas) or the
 * interface drawn on top of it. Every camera and map control asks here, and the one wheel
 * listener in the game lives here, so turning the wheel over a list, a phone screen or a
 * menu scrolls that panel and can never also move the world behind it.
 */
export class PointerScope {
  private static canvas: HTMLCanvasElement | null = null;
  private static handlers: GameWheelHandler[] = [];

  /** Call once, with the canvas the game is drawn on. */
  public static init(canvas: HTMLCanvasElement): void {
    if (PointerScope.canvas) return;
    PointerScope.canvas = canvas;
    // Not passive: a wheel turn that reaches the end of a list must be stopped there
    window.addEventListener('wheel', PointerScope.onWheel, { passive: false });
  }

  /** Is this event aimed at the 3D view itself, not at a button, panel or list over it? */
  public static isGameView(target: EventTarget | null): boolean {
    return target !== null && target === PointerScope.canvas;
  }

  /**
   * Registers something that zooms with the wheel (the street camera, the map).
   * It is only called for wheel turns over the game view while no dialog is open.
   */
  public static onGameWheel(handler: GameWheelHandler): void {
    PointerScope.handlers.push(handler);
  }

  private static onWheel = (event: WheelEvent): void => {
    // Ctrl + wheel and trackpad pinch are the browser's own zoom
    if (event.ctrlKey) return;

    if (PointerScope.isGameView(event.target)) {
      // A dialog owns the screen while it is open, even where the world shows around it
      if (UIStateManager.getInstance().isAnyModalOpen()) return;
      const pixels = PointerScope.toPixels(event, event.deltaY);
      for (const handler of PointerScope.handlers) {
        if (handler(pixels, event)) {
          event.preventDefault();
          return;
        }
      }
      return;
    }

    PointerScope.scrollInterface(event);
  };

  /** Wheel distance in pixels, whatever unit the browser reported it in. */
  private static toPixels(event: WheelEvent, delta: number): number {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 33;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * 400;
    return delta;
  }

  /**
   * Over the interface, the nearest scrolling panel under the pointer takes the wheel and
   * nothing else does: when it reaches its end, the panel it sits in does not start moving.
   */
  private static scrollInterface(event: WheelEvent): void {
    const sideways = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const amount = sideways && event.deltaX !== 0 ? event.deltaX : event.deltaY;
    if (amount === 0) return;

    for (let el = event.target as Element | null; el && el !== document.body; el = el.parentElement) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      const scrollsY = PointerScope.scrolls(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const scrollsX = PointerScope.scrolls(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (!scrollsY && !scrollsX) continue;

      if (scrollsY && !sideways) {
        const atEnd = amount < 0 ? el.scrollTop <= 0 : el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
        if (atEnd) event.preventDefault();
        return;
      }
      if (scrollsX) {
        // A strip that only scrolls sideways (chips, tabs) moves with an ordinary wheel too
        el.scrollLeft += PointerScope.toPixels(event, amount);
        event.preventDefault();
        return;
      }
      // A vertical list under a sideways gesture: leave it alone, and do not pass it on
      event.preventDefault();
      return;
    }
  }

  private static scrolls(overflow: string): boolean {
    return overflow === 'auto' || overflow === 'scroll';
  }
}
