// One-off (but safely re-runnable) maintenance script: wipes every piece of demo/test data
// so the app looks like a brand-new installation, while keeping the single `admin` login and
// the operating Location (that's infrastructure, not demo content) intact.
//
// Usage:  cd server && npx tsx prisma/reset-demo-data.ts
//
// Deletion order matters — children before parents, following the FK graph in schema.prisma
// (SaleItem→Sale, PurchaseItem→Purchase, ProductVariant→Product, etc.) so nothing hits a
// foreign-key constraint violation partway through.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KEEP_ADMIN_LOGIN = "admin";

async function main() {
  const admin = await prisma.user.findUnique({ where: { login: KEEP_ADMIN_LOGIN } });
  if (!admin) {
    throw new Error(
      `No user with login "${KEEP_ADMIN_LOGIN}" found — refusing to wipe data with no account ` +
        `left to log back in with. Run \`npm run seed\` first if this is a fresh database.`,
    );
  }

  const summary = await prisma.$transaction(async (tx) => {
    const saleItems = await tx.saleItem.deleteMany({});
    const sales = await tx.sale.deleteMany({});

    const purchaseItems = await tx.purchaseItem.deleteMany({});
    const purchases = await tx.purchase.deleteMany({});

    const stockMovements = await tx.stockMovement.deleteMany({});
    const priceHistory = await tx.priceHistory.deleteMany({});
    const recipes = await tx.recipe.deleteMany({});
    const stock = await tx.stock.deleteMany({});

    const productVariants = await tx.productVariant.deleteMany({});
    const products = await tx.product.deleteMany({});
    const categories = await tx.category.deleteMany({});
    const ingredients = await tx.ingredient.deleteMany({});
    const suppliers = await tx.supplier.deleteMany({});
    const backups = await tx.backup.deleteMany({});

    // RefreshToken has onDelete: Cascade from User, so deleting the users below would clean
    // these up automatically — deleted explicitly first anyway so the "users" count in the
    // summary only reflects actual User rows, not a mix of both.
    const otherUsersRefreshTokens = await tx.refreshToken.deleteMany({
      where: { user: { login: { not: KEEP_ADMIN_LOGIN } } },
    });
    const users = await tx.user.deleteMany({ where: { login: { not: KEEP_ADMIN_LOGIN } } });

    return {
      saleItems: saleItems.count,
      sales: sales.count,
      purchaseItems: purchaseItems.count,
      purchases: purchases.count,
      stockMovements: stockMovements.count,
      priceHistory: priceHistory.count,
      recipes: recipes.count,
      stock: stock.count,
      productVariants: productVariants.count,
      products: products.count,
      categories: categories.count,
      ingredients: ingredients.count,
      suppliers: suppliers.count,
      backups: backups.count,
      otherUsersRefreshTokens: otherUsersRefreshTokens.count,
      users: users.count,
    };
  });

  console.log("✅ Demo data wiped. Rows removed:");
  console.table(summary);
  console.log(`\nKept: user "${KEEP_ADMIN_LOGIN}" and all Location / Setting rows.`);
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
