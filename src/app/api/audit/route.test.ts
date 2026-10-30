// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { GET } from "./route";

describe("/api/audit", () => {
  afterEach(async () => {
    await closeSingleton();
  });

  it("returns 400 without orgId", async () => {
    const response = await GET(new Request("http://localhost/api/audit"));
    expect(response.status).toBe(400);
  });

  it("returns audit events for an org", async () => {
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    const org = await createOrganization(
      handle.db,
      { name: "EXAMPLE Audit Org" },
      { actorType: "human", actorId: "tester" },
    );

    const response = await GET(
      new Request(`http://localhost/api/audit?orgId=${org.orgId}`),
    );
    expect(response.status).toBe(200);
    const rows = (await response.json()) as Array<{ action: string }>;
    expect(rows.some((row) => row.action === "organization.create")).toBe(true);
  });
});
