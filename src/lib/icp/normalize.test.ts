import { describe, expect, it } from "vitest";
import { llmIcpOutputSchema } from "@/domain";
import { failingLiveShape } from "./failing-live-shape";
import { llmIcpOutputNormalizedSchema, normalizeLlmIcpOutput } from "./normalize";

describe("normalizeLlmIcpOutput", () => {
  it("rejects the live failing shape before normalization", () => {
    const parsed = llmIcpOutputSchema.safeParse(failingLiveShape);
    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    const issues = parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.code}`,
    );
    expect(issues.some((issue) => issue.includes("headcountTiers"))).toBe(true);
    expect(issues.some((issue) => issue.includes("revenueBands"))).toBe(true);
    expect(issues.some((issue) => issue.includes("targetIndustries.0.name"))).toBe(
      true,
    );
    expect(issues.some((issue) => issue.includes("targetIndustries.0.naics"))).toBe(
      true,
    );
    expect(issues.some((issue) => issue.includes("summary"))).toBe(true);
    expect(issues.some((issue) => issue.includes("kind"))).toBe(true);
  });

  it("maps aliases, first NAICS/SIC string, and kind synonyms without inventing text", () => {
    const parsed = llmIcpOutputNormalizedSchema.safeParse(failingLiveShape);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw parsed.error;
    }
    expect(parsed.data.targetIndustries[0]).toMatchObject({
      name: "Support Activities for Transportation",
      naics: "488510",
      sic: "4731",
    });
    expect(parsed.data.companySize.headcountTiers[0]).toMatchObject({
      min: 51,
      max: 500,
    });
    expect(parsed.data.companySize.revenueBands[0]).toMatchObject({
      min: 10_000_000,
      max: 250_000_000,
    });
    expect(parsed.data.triggerEvents.map((event) => event.summary)).toEqual([
      "New TMS rollout",
      "New VP Operations hire",
      "Growth round",
    ]);
    expect(parsed.data.expansionSuggestions.map((item) => item.kind)).toEqual([
      "ADJACENT_SEGMENT",
      "EMERGING_VERTICAL",
      "NON_OBVIOUS_APPLICATION",
    ]);
    expect(parsed.data.expansionSuggestions[0]?.title).toBe("3PL control towers");
    expect(parsed.data.expansionSuggestions[0]?.evidence).toEqual([]);
  });

  it("does not invent required text when aliases are also missing", () => {
    const normalized = normalizeLlmIcpOutput({
      name: "X",
      targetIndustries: [{ naics: ["54"], confidence: 0.5, status: "INFERRED" }],
      companySize: { confidence: 0.5, status: "INFERRED" },
      buyerPersonas: [
        {
          title: "VP",
          functionalArea: "Ops",
          seniority: "vp",
          confidence: 0.5,
          status: "INFERRED",
        },
      ],
      triggerEvents: [{ type: "FUNDING", confidence: 0.5, status: "INFERRED" }],
      expansionSuggestions: [
        { kind: "adjacent", reasoning: "why", confidence: 0.5, status: "INFERRED" },
      ],
    });
    expect(llmIcpOutputSchema.safeParse(normalized).success).toBe(false);
  });
});
