/**
 * Nigeria Life on the web: kept on the phone for quick starts (the service worker), and told
 * when a new version is out. The published game carries the id of its build; every few minutes,
 * and whenever the player comes back to it, it asks what the latest build is, and if it is newer
 * a bar offers to update: one tap and the new version opens, the save carried over as always.
 */

const env = import.meta.env as unknown as Record<string, string | boolean | undefined>;
const BUILD = String(env.VITE_BUILD_ID ?? 'dev');
const BASE = String(env.BASE_URL ?? '/');

export function startUpdates(): void {
  if (env.DEV || BUILD === 'dev' || navigator.webdriver) return;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => undefined);
  let offered = false;
  const check = async () => {
    if (offered) return;
    try {
      const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const latest = (await res.json()) as { build?: string };
      if (latest.build && latest.build !== BUILD) {
        offered = true;
        offer(latest.build);
      }
    } catch {
      // Offline: asked again later
    }
  };
  setTimeout(check, 15_000);
  setInterval(check, 3 * 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
}

function offer(build: string): void {
  const bar = document.createElement('div');
  bar.id = 'nl-update';
  bar.setAttribute('role', 'status');
  bar.style.cssText = 'position:fixed;left:50%;bottom:calc(86px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147482000;display:flex;align-items:center;gap:10px;padding:10px 10px 10px 16px;border-radius:99px;background:#0f1a14;color:#fff;font:700 13px/1.2 system-ui,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.35);max-width:92vw';
  bar.innerHTML = '<span>✨ A new version of Nigeria Life is ready</span><button type="button" style="border:0;border-radius:99px;padding:8px 14px;background:#1db574;color:#fff;font:800 13px system-ui,sans-serif;cursor:pointer">Update</button>';
  bar.querySelector('button')!.addEventListener('click', () => {
    // A new address for the page, so no copy kept anywhere stands in for the new one
    window.location.replace(`${BASE}?v=${encodeURIComponent(build.slice(0, 12))}`);
  });
  document.body.appendChild(bar);
}
