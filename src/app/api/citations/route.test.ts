// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createTestDatabase } from "@/db/test-utils";
import { POST } from "./route";

describe("/api/citations", () => {
  afterEach(async () => {
    await closeSingleton();
  });

  it("returns 400 on invalid POST input", async () => {
    const response = await POST(
      new Request("http://localhost/api/citations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote: "missing url" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("creates a citation with a content hash", async () => {
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);

    const response = await POST(
      new Request("http://localhost/api/citations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgId: "11111111-1111-4111-8111-111111111111",
          sourceUrl: "https://cited-co.example/about",
          retrievedAt: "2026-10-01T00:00:00.000Z",
          sourceType: "WEBSITE",
          quote: "EXAMPLE quote",
          extractor: "agent",
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { contentHash: string };
    expect(body.contentHash).toHaveLength(64);
  });
});
