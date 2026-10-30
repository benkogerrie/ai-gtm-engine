// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/db/client";
import {
  createCompany,
  createOrganization,
  listAuditEvents,
} from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { DomainError } from "@/domain";
import { movePipelineCard } from "./move";
import { PIPELINE_STAGE_MOVE_ACTION } from "./stages";

const orgId = "11111111-1111-4111-8111-111111111111";
const human = { actorType: "human" as const, actorId: "judge" };

describe("movePipelineCard", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await createTestDatabase();
    await createOrganization(
      handle.db,
      { id: orgId, name: "Workspace" },
      human,
    );
  });

  afterEach(async () => {
    await handle.close();
  });

  it("persists a manual move with timestamp and actor in the audit log", async () => {
    const company = await createCompany(
      handle.db,
      {
        orgId,
        name: "HCA Healthcare",
        domain: "hcahealthcare.com",
        negativeSignals: [],
      },
      human,
    );

    const moved = await movePipelineCard(
      handle.db,
      {
        companyId: company.id,
        stage: "REPLIED",
        records: {
          prospectExists: true,
          hasDraft: false,
          hasApproved: false,
          hasDryRunCompletedAudit: false,
          hasRejected: false,
        },
      },
      { orgId, actor: human },
    );

    expect(moved.stage).toBe("REPLIED");
    expect(moved.source).toBe("manual");
    expect(moved.actorId).toBe("judge");
    expect(moved.at).toBeTruthy();

    const events = await listAuditEvents(handle.db, {
      orgId,
      entityType: "company",
      entityId: company.id,
    });
    expect(
      events.some(
        (event) =>
          event.action === PIPELINE_STAGE_MOVE_ACTION &&
          event.actorType === "human" &&
          event.actorId === "judge",
      ),
    ).toBe(true);
  });

  it("refuses an auto stage that has no real record", async () => {
    const company = await createCompany(
      handle.db,
      {
        orgId,
        name: "Mercy",
        domain: "mercy.net",
        negativeSignals: [],
      },
      human,
    );

    await expect(
      movePipelineCard(
        handle.db,
        {
          companyId: company.id,
          stage: "DRY_RUN_SENT",
          records: {
            prospectExists: true,
            hasDraft: false,
            hasApproved: false,
            hasDryRunCompletedAudit: false,
            hasRejected: false,
          },
        },
        { orgId, actor: human },
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });
});
