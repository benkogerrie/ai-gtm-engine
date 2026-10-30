// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { GET, POST } from "./route";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

describe("/api/products", () => {
  beforeEach(async () => {
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    await createOrganization(
      handle.db,
      { id: ORG_ID, name: "EXAMPLE API Org" },
      { actorType: "agent", actorId: "test" },
    );
  });

  afterEach(async () => {
    await closeSingleton();
  });

  it("returns 400 on invalid POST input", async () => {
    const response = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: 12 }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Invalid input");
  });

  it("creates and lists products", async () => {
    const created = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orgId: ORG_ID,
          name: "EXAMPLE API Product",
          description: "EXAMPLE description",
        }),
      }),
    );
    expect(created.status).toBe(201);
    const product = (await created.json()) as { id: string; name: string };
    expect(product.name).toBe("EXAMPLE API Product");

    const listed = await GET(
      new Request(`http://localhost/api/products?orgId=${ORG_ID}`),
    );
    expect(listed.status).toBe(200);
    const rows = (await listed.json()) as Array<{ id: string }>;
    expect(rows.some((row) => row.id === product.id)).toBe(true);
  });

  it("returns 400 when listing without orgId", async () => {
    const response = await GET(new Request("http://localhost/api/products"));
    expect(response.status).toBe(400);
  });
});
