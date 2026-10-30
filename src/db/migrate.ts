import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import {
  openDatabase,
  type DatabaseHandle,
  type PgliteDb,
  type PostgresDb,
} from "./client";

export function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(process.cwd(), "drizzle"),
    path.resolve(process.cwd(), "drizzle"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle"),
  ];

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "meta/_journal.json"))) {
      return candidate;
    }
  }

  return path.join(process.cwd(), "drizzle");
}

export async function applyMigrations(handle: DatabaseHandle): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  if (!existsSync(path.join(migrationsFolder, "meta/_journal.json"))) {
    throw new Error(
      `Drizzle migrations folder not found at ${migrationsFolder}`,
    );
  }

  if (handle.kind === "pglite") {
    await migratePglite(handle.db as PgliteDb, { migrationsFolder });
    return;
  }

  await migratePg(handle.db as PostgresDb, { migrationsFolder });
}

async function main() {
  const handle = await openDatabase();
  await applyMigrations(handle);
  const target =
    handle.kind === "postgres"
      ? "DATABASE_URL"
      : process.env.PGLITE_DATA_DIR ||
        (process.env.VERCEL || process.env.NODE_ENV === "test"
          ? "in-memory PGlite"
          : ".pglite");
  console.log(`Migrations applied (${handle.kind} → ${target}).`);
  await handle.close();
}

const invokedDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith("src/db/migrate.ts") ||
    process.argv[1].endsWith("db/migrate.ts") ||
    process.argv[1].includes("src/db/migrate"));

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
