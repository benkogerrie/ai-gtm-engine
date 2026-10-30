import { openDatabase } from "./client";
import { applyMigrations } from "./migrate";
import { seedDemoCompany } from "@/lib/outreach/seed";
import { uuidSchema } from "@/domain";

const actor = {
  actorType: "agent" as const,
  actorId: "seed-demo-script",
};

export async function seedDemoOutreachCompany() {
  const handle = await openDatabase();
  await applyMigrations(handle);
  const { db } = handle;

  const configured = process.env.APP_ORG_ID?.trim();
  const orgId =
    configured && uuidSchema.safeParse(configured).success
      ? configured
      : "11111111-1111-4111-8111-111111111111";

  const result = await seedDemoCompany(db, { orgId, actor });
  await handle.close();
  return { orgId, companyId: result.company.id, created: result.created };
}

async function main() {
  const ids = await seedDemoOutreachCompany();
  console.log("Seeded TEST — Example General Hospital for ShiftPilot (labeled demo only):", ids);
}

const invokedDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith("src/db/seed-demo.ts") ||
    process.argv[1].includes("src/db/seed-demo"));

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
