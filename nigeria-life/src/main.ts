import './style.css';
import './ui/kit/kit.css';
import { Game } from './game/Game';

// Initialize the Nigeria Life Engine
try {
  const game = new Game();
  (window as any).game = game;
  console.log('[NIGERIA LIFE] Game successfully initialized!');
} catch (err: any) {
  console.error('[NIGERIA LIFE ERROR]', err);
  (window as any).__last_error = err?.message || String(err);
  (window as any).__last_error_stack = err?.stack || '';
}