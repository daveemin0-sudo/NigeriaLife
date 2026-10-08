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
      top: 82px;
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

  const toast = document.createElement('div');
  const borderColor =
    type === 'success'
      ? 'rgba(34, 197, 94, 0.7)'
      : type === 'error'
      ? 'rgba(239, 68, 68, 0.7)'
      : type === 'warning'
      ? 'rgba(245, 158, 11, 0.7)'
      : 'rgba(56, 189, 248, 0.7)';

  const shadowGlow =
    type === 'success'
      ? '0 0 24px rgba(34, 197, 94, 0.35)'
      : type === 'error'
      ? '0 0 24px rgba(239, 68, 68, 0.35)'
      : type === 'warning'
      ? '0 0 24px rgba(245, 158, 11, 0.35)'
      : '0 0 24px rgba(56, 189, 248, 0.35)';

  toast.style.cssText = `
    background: rgba(15, 23, 42, 0.94);
    backdrop-filter: blur(14px);
    border: 1px solid ${borderColor};
    color: #f8fafc;
    padding: 10px 22px;
    border-radius: 999px;
    font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13.5px;
    font-weight: 700;
    letter-spacing: 0.3px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), ${shadowGlow};
    display: inline-flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(-12px) scale(0.95);
    transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
    max-width: 90vw;
    text-align: center;
  `;

  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-12px) scale(0.92)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, durationMs);
}
