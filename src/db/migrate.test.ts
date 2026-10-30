// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./migrate";
import { openDatabase, type DatabaseHandle } from "./client";

const REQUIRED_TABLES = [
  "organizations",
  "products",
  "icps",
  "companies",
  "people",
  "competitors",
  "signals",
  "leads",
  "outreach",
  "outreach_approvals",
  "citations",
  "field_assertions",
  "field_assertion_citations",
  "audit_events",
  "relationship_edges",
];

describe("drizzle migrations", () => {
  let handle: DatabaseHandle | undefined;

  afterEach(async () => {
    await handle?.close();
  });

  it("applies on an empty PGlite database and is idempotent", async () => {
    handle = await openDatabase({ memory: true });
    await applyMigrations(handle);
    await applyMigrations(handle);

    const result = await handle.db.execute(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    const rows = Array.isArray(result) ? result : result.rows;
    const names = rows.map((row) => {
      const record = row as Record<string, unknown>;
      return String(record.tablename ?? record.tableName);
    });

    for (const table of REQUIRED_TABLES) {
      expect(names).toContain(table);
    }
  });
});
