/**
 * The horn as the driver sees it from the bonnet. Everyone else sees a yellow bubble over the car
 * (DrivableVehicle); from the bonnet that bubble would sit in front of the lens and fill the screen,
 * so the driver gets this small tag instead, high in the middle of the screen, just under the row of
 * driving chips (clear of them, of the road ahead and of the pedals), and gone in a little over a second.
 */
let tag: HTMLDivElement | null = null;
let hideAt = 0;
let timer = 0;

export function showHornTag(text: string, seconds = 1.2): void {
  if (!tag) {
    tag = document.createElement('div');
    tag.id = 'horn-tag';
    tag.setAttribute('aria-live', 'polite');
    Object.assign(tag.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '60vw',
      padding: '5px 12px',
      borderRadius: '999px',
      background: '#facc15',
      color: '#111',
      border: '2px solid #111',
      font: '700 13px/1.2 system-ui, sans-serif',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      pointerEvents: 'none',
      zIndex: '40',
      transition: 'opacity 0.2s',
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(tag);
  }
  tag.textContent = text;
  // Under whatever sits across the top while driving (the chips on a phone), never on it
  let top = window.innerHeight * 0.2;
  for (const el of document.querySelectorAll<HTMLElement>('.drive-controls .drive-top, .drive-controls .drive-chip')) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.top < window.innerHeight * 0.45) top = Math.max(top, box.bottom + 10);
  }
  tag.style.top = `${Math.round(top)}px`;
  tag.style.opacity = '1';
  tag.style.display = 'block';
  hideAt = performance.now() + seconds * 1000;
  window.clearTimeout(timer);
  timer = window.setTimeout(hideHornTag, seconds * 1000);
}

export function hideHornTag(): void {
  if (!tag || performance.now() < hideAt - 5) return;
  tag.style.opacity = '0';
  tag.style.display = 'none';
}
