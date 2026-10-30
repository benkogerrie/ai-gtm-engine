import { applyMigrations } from "./migrate";
import { openDatabase, type DatabaseHandle } from "./client";

export async function createTestDatabase(): Promise<DatabaseHandle> {
  const handle = await openDatabase({ memory: true });
  await applyMigrations(handle);
  return handle;
}
