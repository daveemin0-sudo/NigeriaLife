/**
 * Process supervisor for the single game-server process.
 *
 *   npx pm2 start ecosystem.config.cjs
 *   npx pm2 status
 *   npx pm2 logs nigeria-life-game-server
 *   npx pm2 stop nigeria-life-game-server
 *
 * autorestart brings the process back after a crash. The safe player limit
 * matches the largest healthy step in docs/LOADTEST.md. Raise it only after
 * another load-test run stays inside the tick budget.
 */
module.exports = {
  apps: [
    {
      name: 'nigeria-life-game-server',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--experimental-strip-types',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 30,
      min_uptime: 2000,
      restart_delay: 500,
      exp_backoff_restart_delay: 100,
      kill_timeout: 4000,
      env: {
        NODE_ENV: 'production',
        PORT: '8787',
        SAFE_PLAYER_LIMIT: '2000',
        TICK_MS: '50',
      },
    },
  ],
};
