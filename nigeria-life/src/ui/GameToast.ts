/**
 * GameToast.ts
 * High-fidelity in-game video game toast and notification system.
 * Replaces all intrusive browser alert() popups with native HUD notifications.
 */

let audioCtx: AudioContext | null = null;

function playToastSound(type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.22); // G5
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'error' || type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(190, now + 0.18);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.15); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    // Non-blocking audio fallback
  }
}

export function showGameToast(
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  durationMs: number = 3200
): void {
  playToastSound(type);

  let toastContainer = document.getElementById('game-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'game-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: ${window.innerWidth <= 700 ? 150 : 104}px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: var(--z-system-toast, 300);
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  // The same notice already showing is not shown twice; and no more than two at a time, the oldest going
  for (const shown of Array.from(toastContainer.children) as HTMLElement[]) {
    if (shown.dataset.message === message && shown.dataset.leaving !== '1') return;
  }
  const showing = (Array.from(toastContainer.children) as HTMLElement[]).filter((t) => t.dataset.leaving !== '1');
  while (showing.length >= 2) {
    const oldest = showing.shift()!;
    oldest.dataset.leaving = '1';
    oldest.style.opacity = '0';
    setTimeout(() => oldest.remove(), 250);
  }
  const phone = window.innerWidth <= 700;

  // Eko Luxe: a white card, the notice's own emoji (or a mark for its kind) in a tinted circle
  const tint =
    type === 'success' ? ['#e6f4ec', '#0e7a4e'] : type === 'error' ? ['#ffe4e8', '#e11d48'] : type === 'warning' ? ['#fdf1d8', '#b45309'] : ['#e6f4ec', '#0e7a4e'];
  const lead = message.match(/^\s*(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u);
  const icon = lead ? lead[1] : type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '!' : 'i';
  const text = lead ? message.slice(lead[0].length) : message;

  const toast = document.createElement('div');
  toast.dataset.message = message;
  toast.className = `game-toast game-toast-${type}`;
  toast.style.cssText = `
    background: rgba(255, 255, 255, 0.97);
    -webkit-backdrop-filter: saturate(170%) blur(18px);
    backdrop-filter: saturate(170%) blur(18px);
    border: 1px solid rgba(15, 26, 20, 0.08);
    color: #0f1a14;
    padding: ${phone ? '8px 14px 8px 8px' : '9px 18px 9px 9px'};
    border-radius: ${phone ? '18px' : '20px'};
    font-family: var(--nl-font);
    font-size: ${phone ? '12.5px' : '13.5px'};
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.005em;
    box-shadow: 0 14px 34px rgba(12, 28, 20, 0.18), 0 1px 2px rgba(12, 28, 20, 0.08);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
    transition: all 0.32s cubic-bezier(0.16, 1, 0.3, 1);
    max-width: ${phone ? '90vw' : 'min(90vw, 520px)'};
    text-align: left;
  `;
  const badge = document.createElement('span');
  badge.className = 'game-toast-icon';
  badge.textContent = icon;
  badge.style.cssText = `
    flex: 0 0 auto;
    width: ${phone ? '28px' : '32px'};
    height: ${phone ? '28px' : '32px'};
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: ${tint[0]};
    color: ${tint[1]};
    font-size: ${lead ? (phone ? '15px' : '17px') : '14px'};
    font-weight: 900;
  `;
  const words = document.createElement('span');
  words.className = 'game-toast-text';
  words.textContent = text;
  toast.append(badge, words);
  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  // Animate out and remove
  setTimeout(() => {
    toast.dataset.leaving = '1';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.92)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, durationMs);
}
