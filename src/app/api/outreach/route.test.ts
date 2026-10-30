// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeSingleton, setDatabaseHandle } from "@/db/client";
import { createOrganization } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { SESSION_COOKIE, signSessionValue } from "@/lib/auth";
import {
  TEST_AUTH,
  authHeaders,
  clearTestAuth,
  installTestAuth,
} from "@/lib/test-auth";
import { GET, POST } from "./route";
import { POST as mutateOutreach } from "./[id]/route";

function sessionHeaders(): HeadersInit {
  return {
    cookie: `${SESSION_COOKIE}=${signSessionValue(TEST_AUTH.token)}`,
    "content-type": "application/json",
  };
}

describe("/api/outreach", () => {
  beforeEach(async () => {
    installTestAuth();
    const handle = await createTestDatabase();
    setDatabaseHandle(handle);
    await createOrganization(
      handle.db,
      { id: TEST_AUTH.orgId, name: "TEST API Org" },
      { actorType: "agent", actorId: "test" },
    );
  });

  afterEach(async () => {
    clearTestAuth();
    await closeSingleton();
  });

  it("returns 401 without a token or session", async () => {
    const response = await GET(new Request("http://localhost/api/outreach"));
    expect(response.status).toBe(401);
  });

  it("returns 401 for an invalid bearer token", async () => {
    const response = await GET(
      new Request("http://localhost/api/outreach", {
        headers: authHeaders("wrong-token"),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("blocks dry-run without APPROVED and allows a session human after approve", async () => {
    const seed = await POST(
      new Request("http://localhost/api/outreach", {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({ seedDemo: true }),
      }),
    );
    expect(seed.status).toBe(201);
    const seeded = (await seed.json()) as { company: { id: string } };

    const draftedResponse = await POST(
      new Request("http://localhost/api/outreach", {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({
          companyId: seeded.company.id,
          tone: "professional",
          cta: "book a call",
        }),
      }),
    );
    expect(draftedResponse.status).toBe(201);
    const drafted = (await draftedResponse.json()) as { id: string; status: string };
    expect(drafted.status).toBe("DRAFT");

    const blocked = await mutateOutreach(
      new Request(`http://localhost/api/outreach/${drafted.id}`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({ action: "dry-run" }),
      }),
      { params: Promise.resolve({ id: drafted.id }) },
    );
    expect(blocked.status).toBe(400);
    const blockedBody = (await blocked.json()) as { details?: { code?: string } };
    expect(blockedBody.details?.code).toBe("OUTREACH_NOT_APPROVED");

    const approved = await mutateOutreach(
      new Request(`http://localhost/api/outreach/${drafted.id}`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({ action: "approve" }),
      }),
      { params: Promise.resolve({ id: drafted.id }) },
    );
    expect(approved.status).toBe(200);

    const dryRun = await mutateOutreach(
      new Request(`http://localhost/api/outreach/${drafted.id}`, {
        method: "POST",
        headers: sessionHeaders(),
        body: JSON.stringify({ action: "dry-run" }),
      }),
      { params: Promise.resolve({ id: drafted.id }) },
    );
    expect(dryRun.status).toBe(200);
    const completed = (await dryRun.json()) as { status: string };
    expect(completed.status).toBe("DRY_RUN_COMPLETED");
  });
});
