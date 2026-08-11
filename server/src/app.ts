import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { prisma } from "./config/db.js";
import { AppError, errorHandler, notFoundHandler } from "./middleware/error.js";
import { authenticate } from "./middleware/authenticate.js";
import { authorize } from "./middleware/authorize.js";
import authRoutes from "./modules/auth/auth.routes.js";
import ingredientRoutes from "./modules/ingredients/ingredient.routes.js";
import categoryRoutes from "./modules/categories/category.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import uploadRoutes from "./modules/uploads/upload.routes.js";
import recipeRoutes from "./modules/recipes/recipe.routes.js";
import saleRoutes from "./modules/sales/sale.routes.js";
import reportRoutes from "./modules/reports/report.routes.js";
import supplierRoutes from "./modules/suppliers/supplier.routes.js";
import purchaseRoutes from "./modules/purchases/purchase.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import notificationRoutes from "./modules/notifications/notification.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import { receiptInfo } from "./modules/settings/settings.controller.js";
import aiRoutes from "./modules/ai/ai.routes.js";
import { asyncHandler } from "./shared/utils/asyncHandler.js";
import { UPLOADS_DIR } from "./shared/utils/uploads.js";

// `localhost` and `127.0.0.1` are different origins as far as the browser (and thus CORS)
// is concerned, even though they're the same machine — Vite's dev server is reachable on
// both, and which one ends up in the address bar depends on how the user typed/clicked the
// URL. Treating them as interchangeable here means CLIENT_URL only has to list one of them
// and both still work, instead of every dev machine needing to discover and add the other.
function isOriginAllowed(origin: string): boolean {
  if (env.clientUrls.includes(origin)) return true;

  const swapped = origin.includes("localhost")
    ? origin.replace("localhost", "127.0.0.1")
    : origin.includes("127.0.0.1")
      ? origin.replace("127.0.0.1", "localhost")
      : null;

  return swapped !== null && env.clientUrls.includes(swapped);
}

export function createApp() {
  const app = express();
  if (env.trustProxy) app.set("trust proxy", 1);

  // ── Security & parsing ──────────────────────────────────────
  app.use(helmet());
  app.use(
    cors({
      // Reflects the request's Origin only when it's in the allowlist — same effective
      // security as a static origin, but supports multiple production domains (apex + www,
      // or staging + prod) from one CLIENT_URL env value (comma-separated).
      origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) return callback(null, true);
        callback(new AppError(403, "CORS_FORBIDDEN", "Origin not allowed"));
      },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());
  // Access logs go to stdout in both modes — dev gets the terse colored format, production
  // gets Apache-style combined logs so a process manager (Docker/PM2/systemd) can capture
  // them like any other 12-factor app; nothing here writes to a file directly.
  app.use(morgan(env.isProd ? "combined" : "dev"));

  // Basic rate limiting (tightened per-route in later modules)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // ── Health check ────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    let db = "unknown";
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    res.json({
      status: "ok",
      service: "champ-pos-server",
      module: "10 — settings",
      db,
      time: new Date().toISOString(),
    });
  });

  // Product photos: publicly readable (menu images), writes are admin-only via /api/uploads.
  // helmet()'s default Cross-Origin-Resource-Policy is "same-origin", which blocks <img> loads
  // from a different origin — on a split-host deploy (a static frontend + a separate backend
  // service, e.g. Render) that's every request, since the photos are only ever embedded from the
  // frontend's origin. Relaxed to "cross-origin" for this one public, read-only static route;
  // the rest of the API keeps helmet's stricter default.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(UPLOADS_DIR),
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/ingredients", authenticate, authorize("SUPER_ADMIN"), ingredientRoutes);
  // Categories/products: readable by both roles (POS needs the menu), writes are gated
  // per-route inside each router — SUPER_ADMIN only. See category.routes.ts / product.routes.ts.
  app.use("/api/categories", authenticate, categoryRoutes);
  app.use("/api/products", authenticate, productRoutes);
  app.use("/api/uploads", authenticate, authorize("SUPER_ADMIN"), uploadRoutes);
  app.use("/api/recipes", authenticate, authorize("SUPER_ADMIN"), recipeRoutes);
  app.use("/api/sales", authenticate, authorize("SUPER_ADMIN", "SELLER"), saleRoutes);
  app.use("/api/reports", authenticate, authorize("SUPER_ADMIN"), reportRoutes);
  app.use("/api/suppliers", authenticate, authorize("SUPER_ADMIN"), supplierRoutes);
  app.use("/api/purchases", authenticate, authorize("SUPER_ADMIN"), purchaseRoutes);
  app.use("/api/users", authenticate, authorize("SUPER_ADMIN"), userRoutes);
  // Authenticates itself (query-token, not the Authorization header — EventSource can't set
  // custom headers) inside notification.controller.ts, so it deliberately skips the shared
  // `authenticate` middleware other route groups use.
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/settings", authenticate, authorize("SUPER_ADMIN"), settingsRoutes);
  // The one settings slice a SELLER also needs — the company/receipt text printed on every
  // checkout. Registered separately (not nested under /api/settings) so it isn't caught by that
  // router's SUPER_ADMIN gate above; see getReceiptSettings()'s comment for the full reasoning.
  app.use("/api/receipt-info", authenticate, authorize("SUPER_ADMIN", "SELLER"), asyncHandler(receiptInfo));
  app.use("/api/ai", authenticate, authorize("SUPER_ADMIN"), aiRoutes);

  // ── Fallbacks ───────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
