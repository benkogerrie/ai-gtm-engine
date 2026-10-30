import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

export type AppSchema = typeof schema;
export type PgliteDb = PgliteDatabase<AppSchema>;
export type PostgresDb = NodePgDatabase<AppSchema>;
export type AppDatabase = PgliteDb | PostgresDb;

export type DatabaseHandle = {
  db: AppDatabase;
  kind: "pglite" | "postgres";
  close: () => Promise<void>;
};

export type OpenDatabaseOptions = {
  url?: string;
  dataDir?: string;
  memory?: boolean;
};

const MEMORY_DIR = "memory://";

export function readDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || url.trim() === "") {
    return undefined;
  }
  return url;
}

function defaultPgliteDataDir(memory: boolean | undefined): string | undefined {
  if (memory) {
    return undefined;
  }
  if (process.env.PGLITE_DATA_DIR) {
    return process.env.PGLITE_DATA_DIR;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "test") {
    return undefined;
  }
  return ".pglite";
}

export async function openDatabase(
  options: OpenDatabaseOptions = {},
): Promise<DatabaseHandle> {
  const url = options.url ?? readDatabaseUrl();
  if (url) {
    const pool = new Pool({ connectionString: url });
    const db = drizzlePg(pool, { schema });
    return {
      db,
      kind: "postgres",
      close: async () => {
        await pool.end();
      },
    };
  }

  const dataDir = options.dataDir ?? defaultPgliteDataDir(options.memory);
  const pglite = dataDir
    ? new PGlite(dataDir === MEMORY_DIR ? undefined : dataDir)
    : new PGlite();
  const db = drizzlePglite(pglite, { schema });
  return {
    db,
    kind: "pglite",
    close: async () => {
      await pglite.close();
    },
  };
}

let singleton: DatabaseHandle | undefined;
let singletonReady: Promise<DatabaseHandle> | undefined;

export function setDatabaseHandle(handle: DatabaseHandle | undefined): void {
  singleton = handle;
  singletonReady = handle ? Promise.resolve(handle) : undefined;
}

export function getDatabaseHandle(): DatabaseHandle | undefined {
  return singleton;
}

export async function getDb(): Promise<AppDatabase> {
  const handle = await getOrCreateHandle();
  return handle.db;
}

export async function getOrCreateHandle(): Promise<DatabaseHandle> {
  if (singleton) {
    return singleton;
  }
  if (!singletonReady) {
    singletonReady = (async () => {
      const { applyMigrations } = await import("./migrate");
      const handle = await openDatabase();
      await applyMigrations(handle);
      singleton = handle;
      return handle;
    })().catch((error: unknown) => {
      singletonReady = undefined;
      throw error;
    });
  }
  return singletonReady;
}

export async function closeSingleton(): Promise<void> {
  if (singleton) {
    await singleton.close();
  }
  singleton = undefined;
  singletonReady = undefined;
}
