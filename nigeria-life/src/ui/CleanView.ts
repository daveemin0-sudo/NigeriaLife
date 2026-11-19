/**
 * Hide the buttons: one tap and the screen is the game, only the stick to walk with (and the
 * pedals while driving) left; a small pill brings everything back. Remembered on this device.
 */
const KEY = 'nl_clean_view_v1';

export function setupCleanView(): void {
  const nav = document.querySelector('.bottom-master-nav');
  if (!nav || document.getElementById('nav-btn-hide')) return;
  const hide = document.createElement('button');
  hide.className = 'master-nav-item';
  hide.id = 'nav-btn-hide';
  hide.title = 'Hide the buttons';
  hide.innerHTML = '<span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 8.5 4.4 9.5 6-0.5 0.8-1.6 2.3-3.2 3.6M6.4 7.6C4.6 8.9 3.2 10.7 2.5 12c1 1.6 4.5 6 9.5 6 1.5 0 2.9-0.4 4.1-1"/><path d="M9.9 10.1a3 3 0 0 0 4 4"/></svg></span><span class="nav-label">Hide</span>';
  nav.appendChild(hide);
  const show = document.createElement('button');
  show.id = 'nl-show-ui';
  show.type = 'button';
  show.innerHTML = '<span aria-hidden="true">👁</span> Show';
  show.setAttribute('aria-label', 'Show the buttons');
  document.body.appendChild(show);
  const set = (on: boolean) => {
    document.body.classList.toggle('nl-hud-hidden', on);
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* kept for now */ }
  };
  hide.addEventListener('click', (event) => {
    event.stopPropagation();
    set(true);
  });
  show.addEventListener('click', (event) => {
    event.stopPropagation();
    set(false);
  });
  let start = false;
  try { start = localStorage.getItem(KEY) === '1'; } catch { /* nothing kept */ }
  set(start);
}
