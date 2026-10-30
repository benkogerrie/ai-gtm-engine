import { describe, expect, it } from "vitest";
import {
  llmIcpOutputSchema,
  productIntakeSchema,
  structuredIcpSchema,
} from "./intake";

const validLlm = {
  name: "Ops Cloud ICP",
  targetIndustries: [
    {
      name: "Professional services",
      naics: "541",
      sic: "7371",
      confidence: 0.8,
      status: "INFERRED",
    },
  ],
  companySize: {
    headcountTiers: [
      { label: "51-200", min: 51, max: 200, confidence: 0.7, status: "INFERRED" },
    ],
    revenueBands: [
      {
        label: "$10-50M",
        min: 10_000_000,
        max: 50_000_000,
        currency: "USD",
        confidence: 0.6,
        status: "INFERRED",
      },
    ],
    confidence: 0.65,
    status: "INFERRED",
  },
  buyerPersonas: [
    {
      title: "VP Operations",
      functionalArea: "Operations",
      seniority: "vp",
      confidence: 0.72,
      status: "INFERRED",
    },
  ],
  triggerEvents: [
    {
      type: "FUNDING",
      summary: "Series B",
      confidence: 0.55,
      status: "INFERRED",
    },
  ],
  expansionSuggestions: [
    {
      kind: "ADJACENT_SEGMENT",
      title: "3PLs",
      reasoning: "Same ops buyer.",
      evidence: ["Existing freight customers"],
      confidence: 0.5,
      status: "INFERRED",
    },
  ],
};

describe("intake and ICP schemas", () => {
  it("accepts a valid product intake", () => {
    const parsed = productIntakeSchema.parse({
      name: "Harborline",
      description: "Ops cloud",
      freeText: "We help freight brokers",
    });
    expect(parsed.features).toEqual([]);
    expect(parsed.referenceWins).toEqual([]);
  });

  it("rejects an empty product name", () => {
    expect(
      productIntakeSchema.safeParse({ name: "", description: "x" }).success,
    ).toBe(false);
  });

  it("accepts valid LLM ICP output", () => {
    expect(llmIcpOutputSchema.parse(validLlm).name).toBe("Ops Cloud ICP");
  });

  it("rejects confidence outside 0..1", () => {
    const high = structuredClone(validLlm);
    high.targetIndustries[0].confidence = 1.2;
    expect(llmIcpOutputSchema.safeParse(high).success).toBe(false);

    const low = structuredClone(validLlm);
    low.buyerPersonas[0].confidence = -0.01;
    expect(llmIcpOutputSchema.safeParse(low).success).toBe(false);
  });

  it("rejects VERIFIED on inferred fields", () => {
    const verified = structuredClone(validLlm) as typeof validLlm & {
      buyerPersonas: Array<{ status: string }>;
    };
    verified.buyerPersonas[0].status = "VERIFIED";
    expect(llmIcpOutputSchema.safeParse(verified).success).toBe(false);
  });

  it("rejects invalid NAICS format in model output", () => {
    const bad = structuredClone(validLlm);
    bad.targetIndustries[0].naics = "54A";
    expect(llmIcpOutputSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a hydrated structured ICP", () => {
    const structured = structuredIcpSchema.parse({
      ...validLlm,
      targetIndustries: validLlm.targetIndustries.map((industry) => ({
        ...industry,
        naicsValidation: { formatValid: true, known: true, label: "PST" },
      })),
      expansionSuggestions: validLlm.expansionSuggestions.map((item) => ({
        ...item,
        id: "11111111-1111-4111-8111-111111111111",
        decision: "PENDING",
        decisionNote: null,
        decidedBy: null,
        decidedAt: null,
      })),
    });
    expect(structured.expansionSuggestions[0]?.decision).toBe("PENDING");
  });
});
