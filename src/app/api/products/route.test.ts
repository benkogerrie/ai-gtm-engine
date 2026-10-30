// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import {
  createOrganization,
  createProduct,
  listAuditEvents,
} from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import {
  TEST_AUTH,
  authHeaders,
  clearTestAuth,
  installTestAuth,
} from "@/lib/test-auth";
import { GET, POST } from "./route";

const ORG_B = "22222222-2222-4222-8222-222222222222";

describe("/api/products", () => {
  beforeEach(async () => {
    installTestAuth();
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    await createOrganization(
      handle.db,
      { id: TEST_AUTH.orgId, name: "EXAMPLE API Org A" },
      { actorType: "agent", actorId: "seed" },
    );
    await createOrganization(
      handle.db,
      { id: ORG_B, name: "EXAMPLE API Org B" },
      { actorType: "agent", actorId: "seed" },
    );
  });

  afterEach(async () => {
    clearTestAuth();
    await closeSingleton();
  });

  it("returns 401 when the bearer token is missing", async () => {
    const response = await GET(new Request("http://localhost/api/products"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when the bearer token is invalid", async () => {
    const response = await GET(
      new Request("http://localhost/api/products", {
        headers: authHeaders("wrong-token"),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid POST input when authenticated", async () => {
    const response = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: 12 }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Invalid input");
  });

  it("creates and lists products for the server org only", async () => {
    const created = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: "EXAMPLE API Product",
          description: "EXAMPLE description",
        }),
      }),
    );
    expect(created.status).toBe(201);
    const product = (await created.json()) as {
      id: string;
      name: string;
      orgId: string;
    };
    expect(product.name).toBe("EXAMPLE API Product");
    expect(product.orgId).toBe(TEST_AUTH.orgId);

    const listed = await GET(
      new Request("http://localhost/api/products?orgId=" + ORG_B, {
        headers: authHeaders(),
      }),
    );
    expect(listed.status).toBe(200);
    const rows = (await listed.json()) as Array<{ id: string; orgId: string }>;
    expect(rows.every((row) => row.orgId === TEST_AUTH.orgId)).toBe(true);
    expect(rows.some((row) => row.id === product.id)).toBe(true);
  });

  it("ignores a spoofed body orgId and actor headers (cross-org write)", async () => {
    const created = await POST(
      new Request("http://localhost/api/products", {
        method: "POST",
        headers: {
          ...authHeaders(),
          "x-actor-id": "spoofed-actor",
          "x-actor-type": "human",
        },
        body: JSON.stringify({
          orgId: ORG_B,
          name: "EXAMPLE Spoofed Product",
          description: "should land in org A",
        }),
      }),
    );
    expect(created.status).toBe(201);
    const product = (await created.json()) as { orgId: string };
    expect(product.orgId).toBe(TEST_AUTH.orgId);

    const { getDatabaseHandle } = await import("@/db/client");
    const db = getDatabaseHandle()?.db;
    if (!db) {
      throw new Error("expected test db");
    }
    const events = await listAuditEvents(db, { orgId: TEST_AUTH.orgId });
    const createEvent = events.find((event) => event.action === "product.create");
    expect(createEvent?.actorId).toBe(TEST_AUTH.actorId);
    expect(createEvent?.orgId).toBe(TEST_AUTH.orgId);
  });

  it("does not list org B products under an org A token", async () => {
    const { getDatabaseHandle } = await import("@/db/client");
    const db = getDatabaseHandle()?.db;
    if (!db) {
      throw new Error("expected test db");
    }
    await createProduct(
      db,
      {
        orgId: ORG_B,
        name: "EXAMPLE Org B Product",
        description: "secret to A",
      },
      { actorType: "agent", actorId: "seed" },
    );

    const listed = await GET(
      new Request("http://localhost/api/products", {
        headers: authHeaders(),
      }),
    );
    const rows = (await listed.json()) as Array<{ name: string }>;
    expect(rows.some((row) => row.name === "EXAMPLE Org B Product")).toBe(false);
  });
});
