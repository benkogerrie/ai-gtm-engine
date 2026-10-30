// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockLlmClient } from "@/lib/llm";
import { createMockSearchClient, type SearchClient } from "@/lib/search";
import { listAuditEvents } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import type { DatabaseHandle } from "@/db/client";
import { citations } from "@/db/schema";
import { runDiscovery } from "./pipeline";
import type { DiscoveryInput } from "./types";

const actor = { actorType: "agent" as const, actorId: "discovery-test" };
const SAMPLE: DiscoveryInput = {
  productSummary: "B2B HRIS for mid-market teams",
  industries: ["HRIS"],
  geographies: ["United States"],
};

const BRAVE_HITS = [
  {
    title: "Rippling HRIS",
    url: "https://www.rippling.com/hris",
    snippet: "Rippling is an HRIS for mid-market United States teams.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
  {
    title: "Gusto payroll",
    url: "https://gusto.com/product/hr",
    snippet: "Gusto HRIS and payroll for growing companies.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
  {
    title: "BambooHR platform",
    url: "https://www.bamboohr.com",
    snippet: "BambooHR is HR software for mid-market HRIS buyers.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
];

function braveClient(): SearchClient {
  return {
    provider: "brave",
    search: async () => BRAVE_HITS,
  };
}

describe("runDiscovery", () => {
  let handle: DatabaseHandle;
  const orgId = "11111111-1111-4111-8111-111111111111";

  beforeEach(async () => {
    handle = await createTestDatabase();
  });

  afterEach(async () => {
    await handle.close();
  });

  it("labels mock search runs MOCK and never persists mock citations", async () => {
    const run = await runDiscovery(SAMPLE, {
      db: handle.db,
      orgId,
      actor,
      search: createMockSearchClient(),
      llm: createMockLlmClient({
        jsonValue: {
          companies: [
            {
              name: "Fabricated Co",
              domain: "fabricated.example",
              whyFit: "should not persist",
              signals: [],
              claims: [
                {
                  field: "name",
                  value: "Fabricated Co",
                  sourceUrl: "https://example.com/mock",
                  quote: "synthetic",
                },
              ],
            },
          ],
        },
      }),
    });

    expect(run.mode).toBe("MOCK");
    expect(run.status).toBe("completed");
    expect(run.prospects).toEqual([]);

    const citationRows = await handle.db.select().from(citations);
    expect(citationRows).toEqual([]);

    const events = await listAuditEvents(handle.db, { orgId });
    expect(
      events.some((event) => event.action === "discovery.run.completed"),
    ).toBe(true);
    const completed = events.find(
      (event) => event.action === "discovery.run.completed",
    );
    expect((completed?.after as { mode?: string } | null)?.mode).toBe("MOCK");
  });

  it("persists cited companies from real search hits and drops unsupported claims", async () => {
    const run = await runDiscovery(SAMPLE, {
      db: handle.db,
      orgId,
      actor,
      search: braveClient(),
      llm: createMockLlmClient({
        jsonHandler: async (schema) => {
          const raw = {
            companies: [
              {
                name: "Rippling",
                domain: "rippling.com",
                whyFit: "HRIS for mid-market United States teams",
                signals: [
                  {
                    summary: "HRIS product page",
                    sourceUrl: "https://www.rippling.com/hris",
                  },
                ],
                claims: [
                  {
                    field: "name",
                    value: "Rippling",
                    sourceUrl: "https://www.rippling.com/hris",
                    quote: "Rippling is an HRIS",
                  },
                  {
                    field: "headcount",
                    value: "999999",
                    sourceUrl: "https://invented.example/nope",
                    quote: "unsupported",
                  },
                ],
              },
            ],
            categories: [
              {
                category: "DIRECT",
                examples: ["Gusto"],
                sourceUrl: "https://gusto.com/product/hr",
                quote: "Gusto HRIS and payroll",
              },
            ],
            queries: [
              "HRIS companies United States",
              "HRIS customers United States",
              "HRIS vendors United States",
            ],
          };
          return schema.parse(raw);
        },
      }),
    });

    expect(run.mode).toBe("MOCK");
    expect(run.prospects.length).toBeGreaterThanOrEqual(3);
    expect(
      run.prospects.every((prospect) => prospect.claims.length >= 1),
    ).toBe(true);
    expect(
      run.prospects.every((prospect) =>
        prospect.claims.every((claim) => claim.sourceUrl.startsWith("https://")),
      ),
    ).toBe(true);
    expect(
      run.prospects.some((prospect) =>
        prospect.claims.some(
          (claim) => claim.sourceUrl === "https://invented.example/nope",
        ),
      ),
    ).toBe(false);
    expect(run.rejectedClaimCount).toBeGreaterThanOrEqual(1);

    const citationRows = await handle.db.select().from(citations);
    expect(citationRows.length).toBeGreaterThan(0);
    expect(
      citationRows.every((row) => row.sourceUrl.startsWith("https://")),
    ).toBe(true);
    expect(
      citationRows.some((row) => row.sourceUrl.includes("invented.example")),
    ).toBe(false);
  });
});
