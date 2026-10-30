// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "./client";
import { createOrganization } from "./repository";
import { createTestDatabase } from "./test-utils";

describe("audit_events append-only trigger", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await createTestDatabase();
    await createOrganization(
      handle.db,
      { name: "EXAMPLE Audit Org" },
      { actorType: "agent", actorId: "test" },
    );
  });

  afterEach(async () => {
    await handle.close();
  });

  function errorTree(error: unknown): string {
    const parts: string[] = [];
    let current: unknown = error;
    while (current && typeof current === "object") {
      if ("message" in current && typeof current.message === "string") {
        parts.push(current.message);
      }
      current = "cause" in current ? current.cause : undefined;
    }
    return parts.join("\n");
  }

  it("rejects UPDATE via raw SQL", async () => {
    const error = await handle.db
      .execute(sql`update audit_events set action = 'tampered'`)
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    expect(error).toBeTruthy();
    expect(errorTree(error)).toMatch(/append-only/i);
  });

  it("rejects DELETE via raw SQL", async () => {
    const error = await handle.db.execute(sql`delete from audit_events`).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeTruthy();
    expect(errorTree(error)).toMatch(/append-only/i);
  });
});
