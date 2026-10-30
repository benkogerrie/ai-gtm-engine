// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockLlmClient, type LlmClient, type LlmJsonResult } from "@/lib/llm";
import { createMockSearchClient, type SearchClient } from "@/lib/search";
import { listAuditEvents } from "@/db/repository";
import { createTestDatabase } from "@/db/test-utils";
import type { DatabaseHandle } from "@/db/client";
import { citations } from "@/db/schema";
import { runDiscovery } from "./pipeline";
import type { DiscoveryInput } from "./types";
import type { ZodType } from "zod";

const actor = { actorType: "agent" as const, actorId: "discovery-test" };
const SAMPLE: DiscoveryInput = {
  productSummary:
    "ShiftPilot — AI shift scheduling for hospitals and clinics that need nurse staffing coverage",
  industries: ["General Medical and Surgical Hospitals", "health systems"],
  geographies: ["United States"],
};

const BRAVE_HITS = [
  {
    title:
      "Ochsner Health announces system-wide launch of M7's Workforce Management Platform to improve staffing efficiency",
    url: "https://news.ochsner.org/news-releases/ochsner-health-announces",
    snippet:
      "<strong>Ochsner Health</strong> will implement a workforce platform to improve nurse staffing &#x27;system-wide&#x27;.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
  {
    title: "Making scheduling easier, more flexible for RNs and managers",
    url: "https://www.uchealth.org/today/making-scheduling-easier",
    snippet: "UCHealth is making nurse scheduling more flexible for RNs.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
  {
    title: "Mercy Flexible Scheduling for Nurse Work-Life Balance",
    url: "https://www.mercy.net/news/flexible-scheduling",
    snippet: "Mercy health system launched flexible scheduling for nurses.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
  {
    title: "symplr Launches AI-Powered Nurse Scheduling",
    url: "https://www.symplr.com/blog/ai-scheduling",
    snippet: "symplr launches AI-powered nurse scheduling software for hospitals.",
    source: "brave" as const,
    retrievedAt: new Date("2026-10-30T00:00:00.000Z").toISOString(),
  },
  {
    title: "Perceived Adequacy of Staffing and Scheduling Systems",
    url: "https://pubmed.ncbi.nlm.nih.gov/12345",
    snippet: "A completed survey measuring nurse staffing.",
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

function wrapJson<T>(schema: ZodType<T>, raw: unknown): LlmJsonResult<T> {
  return {
    data: schema.parse(raw),
    content: JSON.stringify(raw),
    model: "deepseek-chat",
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    latencyMs: 1,
    usageRecord: {
      provider: "deepseek",
      model: "deepseek-chat",
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 2,
      latencyMs: 1,
      createdAt: new Date(0).toISOString(),
    },
  };
}

function liveLlm(options: {
  companies?: unknown;
  failExtract?: boolean;
}): LlmClient {
  return {
    provider: "deepseek",
    model: "deepseek-chat",
    chat: async () => {
      throw new Error("chat is not used");
    },
    json: async (schema, messages) => {
      const blob = messages.map((message) => message.content).join("\n");
      if (blob.includes("Rewrite web search queries")) {
        return wrapJson(schema, {
          queries: [
            "hospital announces nurse staffing United States",
            "health system implementing nurse scheduling United States",
            "hospital EHR scheduling change press release United States",
          ],
        });
      }
      if (blob.includes("competitor categories") || blob.includes("example vendors")) {
        return wrapJson(schema, {
          categories: [
            {
              category: "Enterprise workforce platforms",
              examples: ["UKG"],
              sourceUrl: "https://www.symplr.com/blog/ai-scheduling",
              quote: "symplr launches AI-powered nurse scheduling software for hospitals",
            },
          ],
        });
      }
      if (options.failExtract) {
        throw new Error("model refused schema");
      }
      return wrapJson(
        schema,
        options.companies ?? {
          companies: [
            {
              name: "Ochsner Health",
              domain: "ochsner.org",
              role: "buyer",
              whyFit: "Health system launching workforce scheduling.",
              fitScore: 88,
              rationale:
                "Cited Ochsner release describes a system-wide nurse scheduling platform launch.",
              signals: [
                {
                  summary: "System-wide scheduling launch",
                  sourceUrl:
                    "https://news.ochsner.org/news-releases/ochsner-health-announces",
                },
              ],
              claims: [
                {
                  field: "name",
                  value: "Ochsner Health",
                  sourceUrl:
                    "https://news.ochsner.org/news-releases/ochsner-health-announces",
                  quote: "Ochsner Health announces system-wide launch",
                },
              ],
            },
            {
              name: "UCHealth",
              domain: "uchealth.org",
              role: "buyer",
              whyFit: "Health system making nurse scheduling more flexible.",
              fitScore: 74,
              rationale:
                "Cited UCHealth article is about flexible RN scheduling inside a US health system.",
              signals: [],
              claims: [
                {
                  field: "name",
                  value: "UCHealth",
                  sourceUrl:
                    "https://www.uchealth.org/today/making-scheduling-easier",
                  quote: "UCHealth is making nurse scheduling more flexible",
                },
              ],
            },
            {
              name: "Mercy",
              domain: "mercy.net",
              role: "buyer",
              whyFit: "Health system launched flexible nurse scheduling.",
              fitScore: 69,
              rationale:
                "Cited Mercy news post describes flexible scheduling for nurses.",
              signals: [],
              claims: [
                {
                  field: "name",
                  value: "Mercy",
                  sourceUrl: "https://www.mercy.net/news/flexible-scheduling",
                  quote: "Mercy health system launched flexible scheduling",
                },
              ],
            },
            {
              name: "symplr",
              domain: "symplr.com",
              role: "vendor_competitor",
              whyFit: "Vendor launching scheduling software.",
              fitScore: 20,
              rationale: "This is a vendor, not a buyer.",
              signals: [],
              claims: [
                {
                  field: "name",
                  value: "symplr",
                  sourceUrl: "https://www.symplr.com/blog/ai-scheduling",
                  quote: "symplr launches AI-powered nurse scheduling software",
                },
              ],
            },
            {
              name: "Perceived Adequacy of Staffing",
              domain: "",
              role: "media_research",
              whyFit: "PubMed paper, not a buyer.",
              fitScore: 10,
              rationale: "Research article.",
              signals: [],
              claims: [
                {
                  field: "name",
                  value: "Perceived Adequacy of Staffing",
                  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/12345",
                  quote: "A completed survey measuring nurse staffing",
                },
              ],
            },
          ],
        },
      );
    },
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
          companies: [],
        },
      }),
    });

    expect(run.mode).toBe("MOCK");
    expect(run.status).toBe("completed");
    expect(run.extractionPath).toBe("heuristic");
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

  it("keeps buyer hospitals, strips HTML, and drops vendors/media on the heuristic path", async () => {
    const run = await runDiscovery(SAMPLE, {
      db: handle.db,
      orgId,
      actor,
      search: braveClient(),
      llm: createMockLlmClient(),
    });

    expect(run.mode).toBe("MOCK");
    expect(run.extractionPath).toBe("heuristic");
    expect(run.prospects.map((prospect) => prospect.name)).toEqual(
      expect.arrayContaining(["Ochsner Health", "UCHealth", "Mercy"]),
    );
    expect(run.prospects.some((prospect) => /announces|making scheduling/i.test(prospect.name))).toBe(
      false,
    );
    expect(run.prospects.some((prospect) => /symplr|pubmed|pr newswire/i.test(prospect.name))).toBe(
      false,
    );
    expect(
      run.prospects.every((prospect) => !/<\/?strong>|&#x27;/.test(prospect.rationale)),
    ).toBe(true);
    expect(
      run.prospects.every((prospect) => prospect.claims.length >= 1),
    ).toBe(true);
    expect(
      run.prospects.every((prospect) =>
        prospect.claims.every((claim) => claim.sourceUrl.startsWith("https://")),
      ),
    ).toBe(true);

    const citationRows = await handle.db.select().from(citations);
    expect(citationRows.length).toBeGreaterThan(0);
    expect(
      citationRows.every((row) => row.sourceUrl.startsWith("https://")),
    ).toBe(true);
  });

  it("uses DeepSeek extraction/scoring on the live path and routes vendors to competitors", async () => {
    const run = await runDiscovery(SAMPLE, {
      db: handle.db,
      orgId,
      actor,
      search: braveClient(),
      llm: liveLlm({}),
    });

    expect(run.mode).toBe("LIVE");
    expect(run.status).toBe("completed");
    expect(run.extractionPath).toBe("deepseek");
    expect(run.scoringPath).toBe("deepseek");
    expect(run.prospects.map((prospect) => prospect.name)).toEqual([
      "Ochsner Health",
      "UCHealth",
      "Mercy",
    ]);
    expect(new Set(run.prospects.map((prospect) => prospect.fitScore)).size).toBe(3);
    expect(run.prospects.some((prospect) => prospect.name === "symplr")).toBe(false);
    expect(
      run.competitorCategories.some((category) =>
        category.examples.some((example) => /symplr/i.test(example)),
      ),
    ).toBe(true);
  });

  it("fails the live run when DeepSeek extraction fails instead of falling back", async () => {
    const run = await runDiscovery(SAMPLE, {
      db: handle.db,
      orgId,
      actor,
      search: braveClient(),
      llm: liveLlm({ failExtract: true }),
    });

    expect(run.mode).toBe("LIVE");
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/DeepSeek extraction failed/i);
    expect(run.prospects).toEqual([]);
    expect(run.extractionPath).toBe("deepseek");
  });
});
