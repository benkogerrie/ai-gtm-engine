// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import {
  TEST_AUTH,
  authHeaders,
  clearTestAuth,
  installTestAuth,
} from "@/lib/test-auth";
import { GET } from "./route";

describe("/api/audit", () => {
  beforeEach(async () => {
    installTestAuth();
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    await createOrganization(
      handle.db,
      { id: TEST_AUTH.orgId, name: "EXAMPLE Audit Org" },
      { actorType: "human", actorId: "tester" },
    );
  });

  afterEach(async () => {
    clearTestAuth();
    await closeSingleton();
  });

  it("returns 401 without a token", async () => {
    const response = await GET(new Request("http://localhost/api/audit"));
    expect(response.status).toBe(401);
  });

  it("returns audit events for the server org only", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/audit?orgId=22222222-2222-4222-8222-222222222222",
        { headers: authHeaders() },
      ),
    );
    expect(response.status).toBe(200);
    const rows = (await response.json()) as Array<{
      action: string;
      orgId: string;
    }>;
    expect(rows.every((row) => row.orgId === TEST_AUTH.orgId)).toBe(true);
    expect(rows.some((row) => row.action === "organization.create")).toBe(true);
  });
});
