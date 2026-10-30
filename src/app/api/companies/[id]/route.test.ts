// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createCompany, createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { GET } from "./route";

describe("/api/companies/[id]", () => {
  afterEach(async () => {
    await closeSingleton();
  });

  it("returns 400 on an invalid id", async () => {
    const response = await GET(new Request("http://localhost/api/companies/nope"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns company fields with verification status and citations", async () => {
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    const org = await createOrganization(
      handle.db,
      { name: "EXAMPLE Company Org" },
      { actorType: "agent", actorId: "test" },
    );
    const company = await createCompany(
      handle.db,
      { orgId: org.orgId, name: "EXAMPLE Cited Fields Co" },
      { actorType: "agent", actorId: "test" },
    );

    const response = await GET(
      new Request(`http://localhost/api/companies/${company.id}`),
      { params: Promise.resolve({ id: company.id }) },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      fields: { name: { verificationStatus: string; citations: unknown[] } };
    };
    expect(body.fields.name.verificationStatus).toBe("UNVERIFIED");
    expect(body.fields.name.citations).toEqual([]);
  });
});
