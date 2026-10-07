import './style.css';
import { Game } from './game/Game';

// Initialize the Nigeria Life Engine
const game = new Game();

// Expose game instance to window for development/debugging
(window as unknown as { game: Game }).game = game;