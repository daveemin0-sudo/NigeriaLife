import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
// Righteous for headings and banners; a flowing script for players' names
import '@fontsource/righteous/400.css';
import '@fontsource-variable/dancing-script/wght.css';
import './style.css';
import './ui/kit/kit.css';
// The one look of the game: loaded last, it decides how every surface looks
import './ui/theme/luxe.css';
import { Game } from './game/Game';

// The names over people's heads are drawn in the script font: it is loaded first (a moment at most)
const fontsReady = Promise.race([
  Promise.all([document.fonts.load('700 26px "Dancing Script Variable"'), document.fonts.load('26px "Righteous"')]),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]).catch(() => undefined);

// Initialize the Nigeria Life Engine
void fontsReady.then(() => {
  try {
    const game = new Game();
    (window as any).game = game;
    console.log('[NIGERIA LIFE] Game successfully initialized!');
  } catch (err: any) {
    console.error('[NIGERIA LIFE ERROR]', err);
    (window as any).__last_error = err?.message || String(err);
    (window as any).__last_error_stack = err?.stack || '';
  }
});