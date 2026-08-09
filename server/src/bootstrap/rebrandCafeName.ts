import { prisma } from "../config/db.js";

// Same shape as purgeLegacyMenu.ts's cafe_name handling, but that function already ran (and
// permanently no-ops via its own marker) on every install that existed before this rebrand — so
// renaming its `NEW_CAFE_NAME` constant would never take effect anywhere. This is a second,
// independent one-time migration for the KRUNCH -> Sharof KFS move specifically.
const PRIOR_CAFE_NAME = "KRUNCH";
const NEW_CAFE_NAME = "Sharof KFS";

// Runs once — after the first successful rename this Setting row exists, so every later boot
// returns immediately. A brand-new install seeds `cafe_name` as "Sharof KFS" directly (see
// prisma/seed.ts) and never matches PRIOR_CAFE_NAME, so this is a no-op there too.
const MARKER_KEY = "cafe_name_rebrand_sharof_kfs_done";

export async function rebrandCafeName(): Promise<void> {
  try {
    if (await prisma.setting.findUnique({ where: { key: MARKER_KEY } })) return;

    const cafeName = await prisma.setting.findUnique({ where: { key: "cafe_name" } });
    // Only touch it if it's still exactly the prior default — an admin who already customized
    // this in Settings (a real restaurant name, not "KRUNCH") keeps whatever they set.
    if (cafeName && cafeName.value === PRIOR_CAFE_NAME) {
      await prisma.setting.update({ where: { key: "cafe_name" }, data: { value: NEW_CAFE_NAME } });
      // eslint-disable-next-line no-console
      console.log(`✅ Bootstrap: renamed cafe_name "${PRIOR_CAFE_NAME}" → "${NEW_CAFE_NAME}".`);
    }

    await prisma.setting.create({ data: { key: MARKER_KEY, value: "true" } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("⚠️  Bootstrap: could not run the Sharof KFS cafe_name rebrand:", err);
  }
}
