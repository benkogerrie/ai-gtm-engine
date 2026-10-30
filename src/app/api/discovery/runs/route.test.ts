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
import { POST } from "./route";

describe("POST /api/discovery/runs", () => {
  beforeEach(async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
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
    const response = await POST(
      new Request("http://localhost/api/discovery/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productSummary: "HRIS",
          industries: ["HRIS"],
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 401 when the bearer token is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/discovery/runs", {
        method: "POST",
        headers: authHeaders("wrong-token"),
        body: JSON.stringify({
          productSummary: "HRIS",
          industries: ["HRIS"],
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("creates a labeled MOCK run when search is synthetic", async () => {
    const response = await POST(
      new Request("http://localhost/api/discovery/runs", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          productSummary: "HRIS",
          industries: ["HRIS"],
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      mode: string;
      status: string;
      prospects: unknown[];
    };
    expect(body.mode).toBe("MOCK");
    expect(body.status).toBe("completed");
    expect(body.prospects).toEqual([]);
  });
});
