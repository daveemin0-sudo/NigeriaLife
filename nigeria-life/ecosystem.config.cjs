/**
 * Keeps the game server running on your own machine or a VPS (Render restarts it by itself).
 *
 *   npx pm2 start ecosystem.config.cjs
 *   npx pm2 status
 *   npx pm2 logs nigeria-life
 *   npx pm2 save && npx pm2 startup     start again after the machine reboots
 *
 * One process, because players in one city must share one set of rooms. NL_MAX_PLAYERS is
 * how many it lets in before the next waits in line: about 300 per CPU core it can have to
 * itself (docs/LOADTEST.md). Measure again with `npm run loadtest` on the real machine.
 */
module.exports = {
  apps: [
    {
      name: 'nigeria-life',
      script: 'server/game-server.ts',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 50,
      min_uptime: 5000,
      exp_backoff_restart_delay: 200,
      max_memory_restart: '1500M',
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: '8787',
        NL_MAX_PLAYERS: '300',
      },
    },
  ],
};
