// PM2 process definition for the bare-metal (non-Docker) deployment path — see
// docs/DEPLOYMENT.md, "Вариант B: без Docker (PM2)". Not used by the Docker Compose path
// (there, the backend container's own entrypoint runs `node dist/index.js` directly).
//
// Usage (from the `server/` directory, after `npm run build`):
//   pm2 start ../deploy/ecosystem.config.cjs
//   pm2 save
//   pm2 startup            # prints a systemd command to run once — makes PM2 itself
//                           # survive a server reboot, which in turn restarts this app.
module.exports = {
  apps: [
    {
      name: "champ-pos-backend",
      cwd: __dirname + "/../server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      // server/.env is loaded by the app itself via dotenv (see src/config/env.ts) — PM2
      // doesn't need to inject anything beyond NODE_ENV above.
      max_memory_restart: "300M",
      autorestart: true,
      // Migrations run once here instead of on every restart (PM2 doesn't have Docker's
      // "entrypoint on every container start" model) — see the deploy docs for the
      // one-time `npx prisma migrate deploy` step before the first `pm2 start`.
      out_file: "/var/log/champ-pos/backend-out.log",
      error_file: "/var/log/champ-pos/backend-error.log",
      time: true,
    },
  ],
};
