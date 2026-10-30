// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createTestDatabase } from "@/db/test-utils";
import { authHeaders, clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { POST } from "./route";

describe("/api/citations", () => {
  beforeEach(async () => {
    installTestAuth();
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
  });

  afterEach(async () => {
    clearTestAuth();
    await closeSingleton();
  });

  it("returns 401 without a token", async () => {
    const response = await POST(
      new Request("http://localhost/api/citations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote: "missing url" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid POST input when authenticated", async () => {
    const response = await POST(
      new Request("http://localhost/api/citations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ quote: "missing url" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("creates a citation for the server org and ignores body orgId", async () => {
    const response = await POST(
      new Request("http://localhost/api/citations", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          orgId: "22222222-2222-4222-8222-222222222222",
          sourceUrl: "https://cited-co.example/about",
          retrievedAt: "2026-10-01T00:00:00.000Z",
          sourceType: "WEBSITE",
          quote: "EXAMPLE quote",
          extractor: "agent",
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      contentHash: string;
      orgId: string;
    };
    expect(body.contentHash).toHaveLength(64);
    expect(body.orgId).toBe("11111111-1111-4111-8111-111111111111");
  });
});
