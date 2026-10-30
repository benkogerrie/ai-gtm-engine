import { describe, expect, it } from "vitest";
import {
  buildCompetitorQuery,
  buildDiscoveryQueries,
  isHealthcareIcp,
} from "./queries";
import type { DiscoveryInput } from "./types";

const SHIFTPILOT: DiscoveryInput = {
  productSummary:
    "ShiftPilot — AI shift scheduling for hospitals and clinics",
  industries: ["General Medical and Surgical Hospitals", "health systems"],
  companySizes: ["200-2000 employees"],
  geographies: ["United States"],
  personas: ["Chief Nursing Officer"],
  triggers: ["nurse staffing shortage"],
};

const GENERIC: DiscoveryInput = {
  productSummary: "B2B freight matching for brokers",
  industries: ["Support Activities for Transportation"],
  geographies: ["United States"],
  personas: ["VP Operations"],
  triggers: ["TMS rollout"],
};

describe("buildDiscoveryQueries", () => {
  it("builds 3-6 org-finding hospital queries for a healthcare ICP", () => {
    expect(isHealthcareIcp(SHIFTPILOT)).toBe(true);
    const queries = buildDiscoveryQueries(SHIFTPILOT);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.length).toBeLessThanOrEqual(6);
    expect(queries.some((query) => /hospital|health system/i.test(query))).toBe(
      true,
    );
    expect(queries.some((query) => /United States/i.test(query))).toBe(true);
    expect(queries.some((query) => /-best|-top|-listicle/.test(query))).toBe(
      true,
    );
    expect(queries.every((query) => !/best hospitals/i.test(query))).toBe(true);
    expect(buildDiscoveryQueries(SHIFTPILOT)).toEqual(queries);
  });

  it("still returns at least 3 queries for a non-healthcare ICP", () => {
    const queries = buildDiscoveryQueries(GENERIC);
    expect(queries.length).toBeGreaterThanOrEqual(3);
    expect(queries.some((query) => /Transportation/i.test(query))).toBe(true);
  });

  it("builds a separate competitor query", () => {
    const query = buildCompetitorQuery(SHIFTPILOT);
    expect(query).toMatch(/competitor/i);
    expect(query).toMatch(/hospital|scheduling/i);
  });
});
