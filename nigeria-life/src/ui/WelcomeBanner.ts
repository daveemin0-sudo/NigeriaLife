/**
 * The welcome a city gives a traveller who has just landed or arrived: its name, large, over the
 * green-white-green, and its own saying underneath ("Eko o ni baje!"). It fades in, stays a few
 * seconds and fades out; a tap clears it sooner. Nothing behind it is blocked once it is gone.
 */
const SAYINGS: Record<string, { title: string; line: string; saying: string }> = {
  lagos: { title: 'Welcome to Lagos', line: 'Centre of Excellence · Nigeria', saying: 'Eko o ni baje! 🇳🇬' },
  abuja: { title: 'Welcome to Abuja', line: 'Federal Capital Territory · Nigeria', saying: 'Centre of Unity 🇳🇬' },
  port_harcourt: { title: 'Welcome to Port Harcourt', line: 'Rivers State · Nigeria', saying: 'The Garden City 🌴 🇳🇬' },
};

export function showWelcomeBanner(city: string, under?: string): void {
  const said = SAYINGS[city];
  if (!said) return;
  document.getElementById('nl-welcome-banner')?.remove();
  const el = document.createElement('div');
  el.id = 'nl-welcome-banner';
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed', 'left:50%', 'top:22%', 'transform:translate(-50%,-10px)', 'z-index:9000',
    'width:min(560px,calc(100vw - 32px))', 'box-sizing:border-box', 'padding:0', 'border-radius:18px', 'overflow:hidden',
    'background:rgba(8,20,14,0.86)', 'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
    'box-shadow:0 18px 50px rgba(0,0,0,0.45)', 'color:#fff', 'text-align:center', 'font-family:Inter,system-ui,sans-serif',
    'opacity:0', 'transition:opacity .7s ease, transform .7s ease', 'pointer-events:auto', 'cursor:pointer',
  ].join(';');
  el.innerHTML = `
    <div style="display:flex;height:8px"><div style="flex:1;background:#008751"></div><div style="flex:1;background:#fff"></div><div style="flex:1;background:#008751"></div></div>
    <div style="padding:clamp(14px,3.5vw,24px) clamp(14px,4vw,28px) clamp(14px,3.5vw,22px)">
      <div style="font-size:clamp(11px,2.6vw,13px);letter-spacing:.18em;text-transform:uppercase;color:#a7f3d0;font-weight:700">${said.line}</div>
      <div style="font-size:clamp(26px,7.5vw,44px);font-weight:900;line-height:1.08;margin:6px 0 8px">${said.title}</div>
      <div style="font-size:clamp(17px,4.6vw,24px);font-weight:800;color:#facc15">${said.saying}</div>
      ${under ? `<div style="margin-top:10px;font-size:clamp(12px,3.2vw,14px);color:#d1fae5;line-height:1.4">${under}</div>` : ''}
    </div>`;
  document.body.appendChild(el);
  const hide = () => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%,-10px)';
    window.setTimeout(() => el.remove(), 800);
  };
  el.addEventListener('click', hide, { once: true });
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%,0)';
  });
  window.setTimeout(hide, 6000);
}
