// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseHandle } from "@/db/client";
import { createOrganization, listCompanies } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import { persistProspects } from "./persist";
import type { ScoredProspect } from "./types";

const orgId = "11111111-1111-4111-8111-111111111111";
const actor = { actorType: "agent" as const, actorId: "discovery" };

const retrievedAt = new Date("2026-10-30T00:00:00.000Z").toISOString();

function prospect(
  name: string,
  domain: string,
  url: string,
  fitScore = 80,
): ScoredProspect {
  return {
    name,
    domain,
    websiteUrl: `https://${domain}`,
    whyFit: "Nurse scheduling rollout",
    fitScore,
    rationale: "Cited scheduling launch",
    evidenceRelevance: "strong",
    signals: [],
    claims: [
      {
        field: "name",
        value: name,
        sourceUrl: url,
        quote: `${name} nurse scheduling`,
      },
    ],
  };
}

describe("persistProspects org reuse", () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await createTestDatabase();
    await createOrganization(
      handle.db,
      { id: orgId, name: "Workspace" },
      actor,
    );
  });

  afterEach(async () => {
    await handle.close();
  });

  it("reuses one company row for HCA variants and keeps both citations", async () => {
    const results = [
      {
        title: "HCA nurse scheduling",
        url: "https://hcahealthcare.com/nurses",
        snippet: "HCA nurse scheduling",
        source: "brave" as const,
        retrievedAt,
      },
      {
        title: "HCA staffing",
        url: "https://investor.hcahealthcare.com/staffing",
        snippet: "HCA staffing",
        source: "brave" as const,
        retrievedAt,
      },
    ];

    const first = await persistProspects(
      handle.db,
      orgId,
      actor,
      [prospect("HCA Healthcare", "hcahealthcare.com", results[0]!.url)],
      results,
      "hospitals",
      "United States",
    );
    const second = await persistProspects(
      handle.db,
      orgId,
      actor,
      [prospect("HCA", "hcahealthcare.com", results[1]!.url)],
      results,
      "hospitals",
      "United States",
    );

    expect(first[0]?.companyId).toBe(second[0]?.companyId);
    const companies = await listCompanies(handle.db, orgId);
    expect(companies).toHaveLength(1);
    expect(companies[0]?.name).toMatch(/HCA/i);
  });

  it("writes the new run score onto the reused company row", async () => {
    const results = [
      {
        title: "UCHealth nurse scheduling",
        url: "https://uchealth.org/nurses",
        snippet: "UCHealth nurse scheduling",
        source: "brave" as const,
        retrievedAt,
      },
    ];

    await persistProspects(
      handle.db,
      orgId,
      actor,
      [prospect("UCHealth", "uchealth.org", results[0]!.url, 80)],
      results,
      "hospitals",
      "United States",
    );
    await persistProspects(
      handle.db,
      orgId,
      actor,
      [prospect("UCHealth", "uchealth.org", results[0]!.url, 70)],
      results,
      "hospitals",
      "United States",
    );

    const companies = await listCompanies(handle.db, orgId);
    expect(companies).toHaveLength(1);
    expect(companies[0]?.fitScore).toBe(70);
    expect(companies[0]?.fitTier).toBe("B");
  });
});
