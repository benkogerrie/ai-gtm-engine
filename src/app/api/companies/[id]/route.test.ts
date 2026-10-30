// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createCompany, createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import {
  TEST_AUTH,
  authHeaders,
  clearTestAuth,
  installTestAuth,
} from "@/lib/test-auth";
import { GET } from "./route";

const ORG_B = "22222222-2222-4222-8222-222222222222";

describe("/api/companies/[id]", () => {
  beforeEach(async () => {
    installTestAuth();
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    await createOrganization(
      handle.db,
      { id: TEST_AUTH.orgId, name: "EXAMPLE Company Org A" },
      { actorType: "agent", actorId: "test" },
    );
    await createOrganization(
      handle.db,
      { id: ORG_B, name: "EXAMPLE Company Org B" },
      { actorType: "agent", actorId: "test" },
    );
  });

  afterEach(async () => {
    clearTestAuth();
    await closeSingleton();
  });

  it("returns 401 without a token", async () => {
    const response = await GET(
      new Request("http://localhost/api/companies/nope"),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 on an invalid id when authenticated", async () => {
    const response = await GET(
      new Request("http://localhost/api/companies/nope", {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns company fields with verification status and citations", async () => {
    const { getDatabaseHandle } = await import("@/db/client");
    const db = getDatabaseHandle()?.db;
    if (!db) {
      throw new Error("expected test db");
    }
    const company = await createCompany(
      db,
      { orgId: TEST_AUTH.orgId, name: "EXAMPLE Cited Fields Co" },
      { actorType: "agent", actorId: "test" },
    );

    const response = await GET(
      new Request(`http://localhost/api/companies/${company.id}`, {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: company.id }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      fields: { name: { verificationStatus: string; citations: unknown[] } };
    };
    expect(body.fields.name.verificationStatus).toBe("UNVERIFIED");
    expect(body.fields.name.citations).toEqual([]);
  });

  it("returns 404 when org A asks for an org B company", async () => {
    const { getDatabaseHandle } = await import("@/db/client");
    const db = getDatabaseHandle()?.db;
    if (!db) {
      throw new Error("expected test db");
    }
    const foreign = await createCompany(
      db,
      { orgId: ORG_B, name: "EXAMPLE Foreign Co" },
      { actorType: "agent", actorId: "test" },
    );

    const response = await GET(
      new Request(`http://localhost/api/companies/${foreign.id}`, {
        headers: authHeaders(),
      }),
      { params: Promise.resolve({ id: foreign.id }) },
    );
    expect(response.status).toBe(404);
  });
});
