// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/db/client";
import { newId } from "@/db/ids";
import {
  approveOutreach,
  createCompany,
  createIcp,
  createOrganization,
  createOutreach,
  createProduct,
  transitionOutreach,
} from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { writeDiscoveryRunAudit } from "@/lib/discovery/runs";
import type { DiscoveryRunSnapshot, ScoredProspect } from "@/lib/discovery/types";
import { loadDashboard, selectDashboardRun } from "./board";

const orgId = "11111111-1111-4111-8111-111111111111";
const actor = { actorType: "human" as const, actorId: "judge" };

function prospect(
  name: string,
  domain: string,
  companyId: string,
  fitScore: number,
): ScoredProspect {
  return {
    companyId,
    name,
    domain,
    websiteUrl: `https://${domain}`,
    whyFit: `${name} nurse scheduling`,
    fitScore,
    rationale: `Score ${fitScore}`,
    evidenceRelevance: "strong",
    signals: [],
    claims: [
      {
        field: "name",
        value: name,
        sourceUrl: `https://${domain}/news`,
        quote: `${name} nurse scheduling`,
      },
    ],
  };
}

function runSnapshot(input: {
  id: string;
  icpId: string;
  status: DiscoveryRunSnapshot["status"];
  createdAt: string;
  prospects: ScoredProspect[];
}): DiscoveryRunSnapshot {
  return {
    id: input.id,
    orgId,
    icpId: input.icpId,
    status: input.status,
    mode: "LIVE",
    input: {
      productSummary: "ShiftPilot — AI shift scheduling",
      industries: ["hospitals"],
      geographies: ["United States"],
      icpId: input.icpId,
    },
    queries: ["hospital nurse scheduling United States"],
    prospects: input.prospects,
    competitorCategories: [],
    rejectedClaimCount: 0,
    droppedCompanyCount: 0,
    error: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

describe("selectDashboardRun", () => {
  it("defaults to the latest completed run and ignores failed/running", () => {
    const older = runSnapshot({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      icpId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "completed",
      createdAt: "2026-10-29T00:00:00.000Z",
      prospects: [],
    });
    const latest = runSnapshot({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      icpId: older.icpId!,
      status: "completed",
      createdAt: "2026-10-30T00:00:00.000Z",
      prospects: [],
    });
    const failed = runSnapshot({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      icpId: older.icpId!,
      status: "failed",
      createdAt: "2026-10-30T12:00:00.000Z",
      prospects: [],
    });
    const listed = [failed, latest, older];
    expect(selectDashboardRun(listed)?.id).toBe(latest.id);
    expect(selectDashboardRun(listed, older.id)?.id).toBe(older.id);
    expect(selectDashboardRun(listed, failed.id)?.id).toBe(latest.id);
  });
});

describe("loadDashboard latest completed run", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await createTestDatabase();
    await createOrganization(handle.db, { id: orgId, name: "Workspace" }, actor);
  });

  afterEach(async () => {
    await handle.close();
  });

  it("shows the latest completed run scores and keeps org pipeline state", async () => {
    const product = await createProduct(
      handle.db,
      {
        orgId,
        name: "ShiftPilot",
        description: "AI shift scheduling",
      },
      actor,
    );
    const icp = await createIcp(
      handle.db,
      {
        orgId,
        productId: product.id,
        name: "US hospitals",
        status: "APPROVED",
        approvedAt: new Date("2026-10-30T00:00:00.000Z"),
        approvedBy: actor.actorId,
      },
      actor,
    );
    const hca = await createCompany(
      handle.db,
      { orgId, name: "HCA Healthcare", domain: "hcahealthcare.com" },
      actor,
    );
    const jefferson = await createCompany(
      handle.db,
      { orgId, name: "Jefferson Health", domain: "jeffersonhealth.org" },
      actor,
    );

    const olderId = newId();
    const latestId = newId();
    await writeDiscoveryRunAudit(
      handle.db,
      runSnapshot({
        id: olderId,
        icpId: icp.id,
        status: "completed",
        createdAt: "2026-10-29T00:00:00.000Z",
        prospects: [
          prospect("HCA Healthcare", "hcahealthcare.com", hca.id, 80),
          prospect("Jefferson Health", "jeffersonhealth.org", jefferson.id, 61),
        ],
      }),
      actor,
      "discovery.run.completed",
    );
    await writeDiscoveryRunAudit(
      handle.db,
      runSnapshot({
        id: latestId,
        icpId: icp.id,
        status: "completed",
        createdAt: "2026-10-30T00:00:00.000Z",
        prospects: [
          prospect("HCA Healthcare", "hcahealthcare.com", hca.id, 70),
          prospect(
            "Inha University Hospital",
            "inha.ac.kr",
            newId(),
            40,
          ),
        ],
      }),
      actor,
      "discovery.run.completed",
    );

    const outreach = await createOutreach(
      handle.db,
      {
        orgId,
        companyId: hca.id,
        channel: "EMAIL",
        subject: "HCA",
        body: "Hello team at HCA Healthcare",
        status: "DRAFT",
        dryRun: true,
      },
      actor,
    );
    await transitionOutreach(
      handle.db,
      { outreachId: outreach.id, status: "PENDING_APPROVAL" },
      actor,
    );
    await approveOutreach(
      handle.db,
      { outreachId: outreach.id, approvedBy: actor.actorId, decision: "APPROVED" },
      actor,
    );
    await transitionOutreach(
      handle.db,
      { outreachId: outreach.id, status: "DRY_RUN_COMPLETED" },
      actor,
    );

    const latest = await loadDashboard(handle.db, orgId, { icpId: icp.id });
    expect(latest.run?.id).toBe(latestId);
    expect(latest.cards.map((card) => card.name)).toEqual(["HCA Healthcare"]);
    expect(latest.cards[0]?.fitScore).toBe(70);
    expect(latest.cards[0]?.stage).toBe("DRY_RUN_SENT");
    expect(latest.cards.some((card) => card.name === "Jefferson Health")).toBe(
      false,
    );

    const older = await loadDashboard(handle.db, orgId, {
      icpId: icp.id,
      runId: olderId,
    });
    expect(older.run?.id).toBe(olderId);
    expect(older.cards.map((card) => card.name).sort()).toEqual([
      "HCA Healthcare",
      "Jefferson Health",
    ]);
    expect(older.cards.find((card) => card.name === "HCA Healthcare")?.fitScore).toBe(
      80,
    );
    expect(older.cards.find((card) => card.name === "HCA Healthcare")?.stage).toBe(
      "DRY_RUN_SENT",
    );
  });
});
