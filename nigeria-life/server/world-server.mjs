// The world server is now the game server: accounts, money, rooms and the registry in one.
// Kept so `node server/world-server.mjs` and anything that starts it that way still work.
import './game-server.ts';
