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

describe("GET /api/discovery/runs/[id]", () => {
  beforeEach(async () => {
    installTestAuth();
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    await createOrganization(
      handle.db,
      { id: TEST_AUTH.orgId, name: "EXAMPLE Discovery Org" },
      { actorType: "agent", actorId: "seed" },
    );
  });

  afterEach(async () => {
    clearTestAuth();
    await closeSingleton();
  });

  it("returns 401 without a token", async () => {
    const response = await GET(
      new Request("http://localhost/api/discovery/runs/11111111-1111-4111-8111-111111111111"),
      {
        params: Promise.resolve({
          id: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown run when authenticated", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/discovery/runs/11111111-1111-4111-8111-111111111111",
        { headers: authHeaders() },
      ),
      {
        params: Promise.resolve({
          id: "11111111-1111-4111-8111-111111111111",
        }),
      },
    );
    expect(response.status).toBe(404);
  });
});
