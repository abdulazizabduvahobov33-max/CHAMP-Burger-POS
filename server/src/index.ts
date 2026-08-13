import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { ensureAdminExists, ensureSellerExists } from "./bootstrap/ensureUsers.js";
import { ensureOwnerExists } from "./bootstrap/ensureOwnerExists.js";
import { ensureIngredientsSeeded } from "./bootstrap/ensureIngredientsSeeded.js";
import { ensureMenuSeeded } from "./bootstrap/ensureMenuSeeded.js";
import { purgeLegacyMenu } from "./bootstrap/purgeLegacyMenu.js";
import { rebrandCafeName } from "./bootstrap/rebrandCafeName.js";
import { refreshMenuPhotos } from "./bootstrap/refreshMenuPhotos.js";

async function bootstrap() {
  await ensureAdminExists();
  await ensureSellerExists();
  await ensureOwnerExists();
  await purgeLegacyMenu();
  await rebrandCafeName();
  await ensureMenuSeeded();
  await refreshMenuPhotos();
  await ensureIngredientsSeeded();

  const app = createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `\n🚀 Sharof KFS POS server ready\n` +
        `   http://localhost:${env.port}/api/health\n` +
        `   env: ${env.nodeEnv}\n`,
    );
  });

  // ── Graceful shutdown ───────────────────────────────────────
  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received, shutting down...`);
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
