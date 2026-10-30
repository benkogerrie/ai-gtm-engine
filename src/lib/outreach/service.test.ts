// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/domain";
import type { DatabaseHandle } from "@/db/client";
import {
  createCompany,
  createOrganization,
  listAuditEvents,
} from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { createMockLlmClient } from "@/lib/llm";
import { TEST_AUTH, clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { buildMockOutreachDraft } from "./mock-output";
import { seedDemoCompany } from "./seed";
import {
  approveOutreachDraft,
  draftOutreachForCompany,
  editOutreachDraft,
  rejectOutreachDraft,
  sendOutreachDryRun,
} from "./service";

const human = { actorType: "human" as const, actorId: "reviewer" };
const agent = { actorType: "agent" as const, actorId: "agent" };

function mockClient() {
  return createMockLlmClient({
    jsonHandler: (schema) =>
      schema.parse(
        buildMockOutreachDraft({
          companyName: "TEST — Example General Hospital",
          tone: "professional",
          cta: "book a call",
          cited: [
            {
              id: "sig",
              kind: "signal",
              type: "JOB_POSTING",
              summary: "TEST cited role",
              sourceUrls: ["https://example.com"],
              quotes: [],
            },
          ],
        }),
      ),
  });
}

describe("outreach service", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    installTestAuth();
    handle = await createTestDatabase();
    await createOrganization(
      handle.db,
      { id: TEST_AUTH.orgId, name: "TEST Org" },
      agent,
    );
  });

  afterEach(async () => {
    clearTestAuth();
    await handle.close();
  });

  async function seedCited() {
    return seedDemoCompany(handle.db, { orgId: TEST_AUTH.orgId, actor: agent });
  }

  it("refuses to draft when the company has no cited signal", async () => {
    const company = await createCompany(
      handle.db,
      { orgId: TEST_AUTH.orgId, name: "TEST — Bare Co" },
      agent,
    );

    await expect(
      draftOutreachForCompany(
        handle.db,
        { companyId: company.id, tone: "professional", cta: "reply" },
        { orgId: TEST_AUTH.orgId, actor: human },
        mockClient(),
      ),
    ).rejects.toMatchObject({ code: "NO_CITED_SIGNALS" });
  });

  it("blocks dry-run send without APPROVED and allows it after human approval", async () => {
    const { company } = await seedCited();
    const drafted = await draftOutreachForCompany(
      handle.db,
      { companyId: company.id, tone: "direct", cta: "learn more" },
      { orgId: TEST_AUTH.orgId, actor: human },
      mockClient(),
    );
    expect(drafted.status).toBe("DRAFT");
    expect(drafted.sourceUrls).toContain("https://example.com");

    await expect(
      sendOutreachDryRun(handle.db, drafted.id, {
        orgId: TEST_AUTH.orgId,
        actor: human,
      }),
    ).rejects.toMatchObject({ code: "OUTREACH_NOT_APPROVED" });

    const approved = await approveOutreachDraft(handle.db, drafted.id, {
      orgId: TEST_AUTH.orgId,
      actor: human,
    });
    expect(approved.status).toBe("APPROVED");

    const completed = await sendOutreachDryRun(handle.db, drafted.id, {
      orgId: TEST_AUTH.orgId,
      actor: human,
    });
    expect(completed.status).toBe("DRY_RUN_COMPLETED");
    expect(completed.sentAt).toBeNull();
    expect(completed.dryRun).toBe(true);

    const events = await listAuditEvents(handle.db, {
      orgId: TEST_AUTH.orgId,
      entityType: "outreach",
      entityId: drafted.id,
    });
    expect(events.some((event) => event.action === "outreach.transition")).toBe(
      true,
    );
    expect(
      events.some(
        (event) =>
          event.after &&
          typeof event.after === "object" &&
          "status" in event.after &&
          event.after.status === "DRY_RUN_COMPLETED",
      ),
    ).toBe(true);
  });

  it("rejects a draft and records the decision", async () => {
    const { company } = await seedCited();
    const drafted = await draftOutreachForCompany(
      handle.db,
      { companyId: company.id, tone: "friendly", cta: "reply" },
      { orgId: TEST_AUTH.orgId, actor: human },
      mockClient(),
    );

    const rejected = await rejectOutreachDraft(handle.db, drafted.id, {
      orgId: TEST_AUTH.orgId,
      actor: human,
    });
    expect(rejected.status).toBe("REJECTED");

    await expect(
      sendOutreachDryRun(handle.db, drafted.id, {
        orgId: TEST_AUTH.orgId,
        actor: human,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("writes an outreach.edit audit event", async () => {
    const { company } = await seedCited();
    const drafted = await draftOutreachForCompany(
      handle.db,
      { companyId: company.id, tone: "professional", cta: "book a call" },
      { orgId: TEST_AUTH.orgId, actor: human },
      mockClient(),
    );

    await editOutreachDraft(
      handle.db,
      {
        outreachId: drafted.id,
        subject: "TEST edited subject",
        body: "TEST edited body",
        linkedinMessage: "TEST edited linkedin",
      },
      { orgId: TEST_AUTH.orgId, actor: human },
    );

    const events = await listAuditEvents(handle.db, {
      orgId: TEST_AUTH.orgId,
      entityType: "outreach",
      entityId: drafted.id,
    });
    expect(events.some((event) => event.action === "outreach.edit")).toBe(true);
  });

  it("rejects approve and dry-run from a non-human actor", async () => {
    const { company } = await seedCited();
    const drafted = await draftOutreachForCompany(
      handle.db,
      { companyId: company.id, tone: "professional", cta: "book a call" },
      { orgId: TEST_AUTH.orgId, actor: agent },
      mockClient(),
    );

    await expect(
      approveOutreachDraft(handle.db, drafted.id, {
        orgId: TEST_AUTH.orgId,
        actor: agent,
      }),
    ).rejects.toMatchObject({ code: "HUMAN_ACTOR_REQUIRED" });
  });
});
