import { startUpdates } from './app/Updates';
import '@fontsource-variable/outfit/wght.css';
import { StreetAmbience } from './audio/StreetAmbience';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
// Righteous for headings and banners; a flowing script for players' names
import '@fontsource/righteous/400.css';
import '@fontsource-variable/dancing-script/wght.css';
import './style.css';
import './ui/kit/kit.css';
// The one look of the game: loaded last, it decides how every surface looks
import './ui/theme/luxe.css';
import { Game } from './game/Game';
import { startTheme } from './ui/theme/Theme';
import { TitleScreen } from './ui/TitleScreen';
import { BackendService } from './backend/BackendService';

// Light or dark, as chosen last time, before anything is drawn
startTheme();

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
    // The city has drawn its first frames: the splash steps aside
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const splash = document.getElementById('nl-splash');
      if (!splash) return;
      splash.classList.add('is-gone');
      setTimeout(() => splash.remove(), 650);
    }));
    // On the web: kept on the phone, and told when a new version is out
    startUpdates();
    // The speech engine is woken at the first tap (Continue on the title), not mid-street
    window.addEventListener('pointerdown', () => StreetAmbience.get().warm(), { once: true, capture: true });
    // The title over the city, to carry on or begin a new life (not for the automated tests, unless asked for)
    const w = window as any;
    if (!navigator.webdriver || w.__titleOn) {
      w.titleScreen = new TitleScreen({
        summary: () => {
          const data = BackendService.getInstance().getData();
          const home = data.properties.find((p: any) => p.ownerId === data.id && (p.status === 'owned' || p.status === 'rented') && !['office', 'shop', 'business', 'land', 'commercial'].includes(String(p.type)));
          const label = game.world.skyEnvironment.getFormattedTimeString();
          return {
            name: game.player.config.name || data.username || 'You',
            day: label.split(' • ')[0] ?? label,
            money: `₦${(data.walletCash + data.bank.balance).toLocaleString()}`,
            place: game.world.getDistrictAtPosition(game.player.position).name,
            home: home ? home.name : null,
          };
        },
        drift: (delta) => game.cameraManager.rotate(delta * 0.1),
        frame: (on) => game.cameraManager.setPreset(on ? 'isometric' : 'street'),
      });
    }
  } catch (err: any) {
    console.error('[NIGERIA LIFE ERROR]', err);
    document.getElementById('nl-splash')?.classList.add('is-failed');
    (window as any).__last_error = err?.message || String(err);
    (window as any).__last_error_stack = err?.stack || '';
  }
});