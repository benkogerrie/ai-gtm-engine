// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/db/client";
import { newId } from "@/db/ids";
import {
  createCompany,
  createIcp,
  createOrganization,
  createProduct,
} from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { writeDiscoveryRunAudit } from "@/lib/discovery/runs";
import type { DiscoveryRunSnapshot, ScoredProspect } from "@/lib/discovery/types";
import { loadGraph } from "./load";

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
    whyFit: `${name} hospital nurse scheduling`,
    fitScore,
    rationale: `Score ${fitScore} hospital NAICS 622110`,
    evidenceRelevance: "strong",
    signals: [
      {
        summary: "nurse scheduling platform rollout",
        sourceUrl: `https://${domain}/news`,
      },
    ],
    claims: [
      {
        field: "industry",
        value: "General Medical and Surgical Hospitals",
        sourceUrl: `https://${domain}/news`,
        quote: `${name} hospital NAICS 622110 nurse scheduling`,
      },
    ],
  };
}

describe("loadGraph", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await createTestDatabase();
    await createOrganization(handle.db, { id: orgId, name: "Workspace" }, actor);
  });

  afterEach(async () => {
    await handle.close();
  });

  it("derives a graph from a completed run and ranks a path", async () => {
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
        targetIndustries: ["General Medical and Surgical Hospitals"],
        triggerEvents: ["nurse scheduling platform rollout"],
      },
      actor,
    );
    const montefiore = await createCompany(
      handle.db,
      {
        orgId,
        name: "Montefiore",
        domain: "montefiore.org",
        industry: "General Medical and Surgical Hospitals",
      },
      actor,
    );
    const runId = newId();
    const snapshot: DiscoveryRunSnapshot = {
      id: runId,
      orgId,
      icpId: icp.id,
      status: "completed",
      mode: "LIVE",
      input: {
        productSummary: "ShiftPilot — AI shift scheduling",
        industries: ["General Medical and Surgical Hospitals 622110"],
        geographies: ["United States"],
        triggers: ["nurse scheduling platform rollout"],
        icpId: icp.id,
      },
      queries: ["hospital nurse scheduling"],
      prospects: [prospect("Montefiore", "montefiore.org", montefiore.id, 81)],
      competitorCategories: [],
      rejectedClaimCount: 0,
      droppedCompanyCount: 0,
      error: null,
      createdAt: "2026-10-30T00:00:00.000Z",
      updatedAt: "2026-10-30T00:00:00.000Z",
    };
    await writeDiscoveryRunAudit(
      handle.db,
      snapshot,
      actor,
      "discovery.run.completed",
    );

    const loaded = await loadGraph(handle.db, orgId, { icpId: icp.id });
    expect(loaded.run?.id).toBe(runId);
    expect(loaded.sellerName).toBe("ShiftPilot");
    expect(loaded.mock).toBe(false);
    expect(loaded.graph.nodes.some((node) => node.type === "seller")).toBe(true);
    expect(loaded.graph.nodes.some((node) => node.prospectId === montefiore.id)).toBe(
      true,
    );
    expect(loaded.matches[0]?.prospectId).toBe(montefiore.id);
    expect(loaded.matches[0]?.explanation).toMatch(/ShiftPilot/);
    expect(loaded.matches[0]?.explanation).toMatch(/Montefiore/);
  });

  it("labels a MOCK run honestly and does not invent prospects", async () => {
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
    const runId = newId();
    await writeDiscoveryRunAudit(
      handle.db,
      {
        id: runId,
        orgId,
        icpId: icp.id,
        status: "completed",
        mode: "MOCK",
        input: {
          productSummary: "ShiftPilot — AI shift scheduling",
          industries: ["hospitals"],
          icpId: icp.id,
        },
        queries: [],
        prospects: [],
        competitorCategories: [],
        rejectedClaimCount: 0,
        droppedCompanyCount: 0,
        error: null,
        createdAt: "2026-10-30T00:00:00.000Z",
        updatedAt: "2026-10-30T00:00:00.000Z",
      },
      actor,
      "discovery.run.completed",
    );

    const loaded = await loadGraph(handle.db, orgId, { icpId: icp.id });
    expect(loaded.mock).toBe(true);
    expect(loaded.emptyReason).toBe("mock-empty");
    expect(loaded.graph.nodes.some((node) => node.type === "prospect")).toBe(
      false,
    );
    expect(loaded.matches).toEqual([]);
  });
});
