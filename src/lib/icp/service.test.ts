// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/domain/errors";
import type { DatabaseHandle } from "@/db/client";
import { listAuditEvents } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { createMockLlmClient } from "@/lib/llm";
import { TEST_AUTH, clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { buildMockIcpOutput } from "./mock-output";
import {
  approveIcp,
  decideExpansion,
  editIcpFields,
  loadIcpForOrg,
  submitProductIntake,
} from "./service";

const actor = { actorType: "human" as const, actorId: "founder" };
const ORG_B = "22222222-2222-4222-8222-222222222222";

const intake = {
  name: "Harborline Ops Cloud",
  description: "Freight brokerage operations platform",
  features: ["lane scoring"],
  capabilities: ["intake chat"],
  existingCustomers: ["Cedar Freight Desk"],
};

describe("ICP service", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    installTestAuth();
    handle = await createTestDatabase();
  });

  afterEach(async () => {
    clearTestAuth();
    await handle.close();
  });

  async function seedDraft() {
    const client = createMockLlmClient({
      jsonValue: buildMockIcpOutput(intake),
    });
    return submitProductIntake(
      handle.db,
      intake,
      { orgId: TEST_AUTH.orgId, actor },
      client,
    );
  }

  it("persists a draft ICP with INFERRED expansions and audit", async () => {
    const { icp, structured } = await seedDraft();
    expect(icp.status).toBe("DRAFT");
    expect(icp.orgId).toBe(TEST_AUTH.orgId);
    expect(structured.expansionSuggestions.every((item) => item.decision === "PENDING")).toBe(
      true,
    );

    const events = await listAuditEvents(handle.db, { orgId: TEST_AUTH.orgId });
    expect(events.some((event) => event.action === "product.create")).toBe(true);
    expect(events.some((event) => event.action === "icp.create")).toBe(true);
  });

  it("accepts, adjusts, and dismisses expansions with actor + timestamp", async () => {
    const { icp, structured } = await seedDraft();
    const [first, second, third] = structured.expansionSuggestions;
    if (!first || !second || !third) {
      throw new Error("expected three expansions");
    }

    await decideExpansion(
      handle.db,
      {
        icpId: icp.id,
        suggestionId: first.id,
        decision: "ACCEPTED",
      },
      { orgId: TEST_AUTH.orgId, actor },
    );
    await decideExpansion(
      handle.db,
      {
        icpId: icp.id,
        suggestionId: second.id,
        decision: "ADJUSTED",
        note: "Narrow to Midwest 3PLs",
      },
      { orgId: TEST_AUTH.orgId, actor },
    );
    await decideExpansion(
      handle.db,
      {
        icpId: icp.id,
        suggestionId: third.id,
        decision: "DISMISSED",
      },
      { orgId: TEST_AUTH.orgId, actor },
    );

    const loaded = await loadIcpForOrg(handle.db, icp.id, TEST_AUTH.orgId);
    const decisions = loaded?.structured?.expansionSuggestions ?? [];
    expect(decisions[0]?.decision).toBe("ACCEPTED");
    expect(decisions[1]?.decision).toBe("ADJUSTED");
    expect(decisions[1]?.decisionNote).toBe("Narrow to Midwest 3PLs");
    expect(decisions[2]?.decision).toBe("DISMISSED");
    expect(decisions.every((item) => item.decidedBy === actor.actorId)).toBe(true);
    expect(decisions.every((item) => item.decidedAt)).toBeTruthy();

    const events = await listAuditEvents(handle.db, {
      orgId: TEST_AUTH.orgId,
      entityId: icp.id,
    });
    expect(events.some((event) => event.action === "icp.expansion.accepted")).toBe(
      true,
    );
  });

  it("approves a draft and versions edits after approval", async () => {
    const { icp } = await seedDraft();
    const approved = await approveIcp(handle.db, icp.id, {
      orgId: TEST_AUTH.orgId,
      actor,
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy).toBe(actor.actorId);

    const next = await editIcpFields(
      handle.db,
      icp.id,
      { name: "Harborline ICP v2" },
      { orgId: TEST_AUTH.orgId, actor },
    );
    expect(next.id).not.toBe(icp.id);
    expect(next.status).toBe("DRAFT");
    expect(next.version).toBe(2);
    expect(next.parentIcpId).toBe(icp.id);

    const events = await listAuditEvents(handle.db, { orgId: TEST_AUTH.orgId });
    expect(events.some((event) => event.action === "icp.approve")).toBe(true);
  });

  it("hides another org's ICP", async () => {
    const { icp } = await seedDraft();
    expect(await loadIcpForOrg(handle.db, icp.id, ORG_B)).toBeNull();
    await expect(
      approveIcp(handle.db, icp.id, { orgId: ORG_B, actor }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
