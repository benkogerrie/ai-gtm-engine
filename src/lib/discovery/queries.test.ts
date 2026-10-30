import { describe, expect, it } from "vitest";
import { buildCompetitorQuery, buildDiscoveryQueries } from "./queries";
import type { DiscoveryInput } from "./types";

const SAMPLE: DiscoveryInput = {
  productSummary:
    "B2B HRIS that automates payroll, benefits, and onboarding for mid-market companies",
  industries: ["Human Resources Software", "HRIS"],
  companySizes: ["200-2000 employees"],
  geographies: ["United States"],
  personas: ["VP People"],
  triggers: ["HRIS RFP"],
};

describe("buildDiscoveryQueries", () => {
  it("returns 3-6 deterministic queries that include industry and geography", () => {
    const queries = buildDiscoveryQueries(SAMPLE);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.length).toBeLessThanOrEqual(6);
    expect(queries.every((query) => query.length > 0)).toBe(true);
    expect(queries.some((query) => /HRIS|Human Resources/i.test(query))).toBe(
      true,
    );
    expect(queries.some((query) => /United States/i.test(query))).toBe(true);
    expect(buildDiscoveryQueries(SAMPLE)).toEqual(queries);
  });

  it("still returns at least 3 queries for a minimal input", () => {
    const queries = buildDiscoveryQueries({
      productSummary: "Ops tool",
      industries: ["logistics"],
    });
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.length).toBeLessThanOrEqual(6);
  });

  it("builds a separate competitor query", () => {
    const query = buildCompetitorQuery(SAMPLE);
    expect(query).toMatch(/competitor/i);
    expect(query).toMatch(/HRIS|Human Resources/i);
  });
});
