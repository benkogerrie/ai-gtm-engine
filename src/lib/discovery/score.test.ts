import { describe, expect, it } from "vitest";
import { classifyEvidenceText } from "./relevance";
import { scoreFromLlm, scoreProspect } from "./score";
import type { DiscoveryCandidate, DiscoveryInput } from "./types";

const SHIFTPILOT: DiscoveryInput = {
  productSummary:
    "ShiftPilot — AI shift scheduling for hospitals and clinics that need nurse staffing coverage",
  industries: ["General Medical and Surgical Hospitals"],
  geographies: ["United States"],
};

function candidate(input: {
  quote: string;
  whyFit: string;
  rationale?: string;
  fitScore?: number;
}): DiscoveryCandidate {
  return {
    name: "HCA Healthcare",
    domain: "hcahealthcare.com",
    whyFit: input.whyFit,
    fitScore: input.fitScore,
    rationale: input.rationale,
    signals: [],
    claims: [
      {
        field: "name",
        value: "HCA Healthcare",
        sourceUrl: "https://hcahealthcare.com/example",
        quote: input.quote,
      },
    ],
  };
}

describe("evidence relevance scoring", () => {
  it("treats nurse-scheduling coverage as strong and peripheral nursing articles as weaker", () => {
    expect(
      classifyEvidenceText(
        "Ochsner Health announces system-wide nurse scheduling platform",
      ),
    ).toBe("strong");
    expect(
      classifyEvidenceText(
        "A nursing education journal discusses bedside care quality",
      ),
    ).toBe("peripheral");

    const strong = scoreProspect(
      candidate({
        quote: "system-wide nurse scheduling platform launch",
        whyFit: "Health system launching nurse scheduling.",
      }),
      SHIFTPILOT,
    );
    const peripheral = scoreProspect(
      candidate({
        quote: "nursing education journal discusses bedside care quality",
        whyFit: "Hospital mentioned in a nursing research article.",
      }),
      SHIFTPILOT,
    );

    expect(strong.evidenceRelevance).toBe("strong");
    expect(peripheral.evidenceRelevance).toBe("peripheral");
    expect(strong.fitScore).toBeGreaterThan(peripheral.fitScore);
    expect(peripheral.fitScore).toBeLessThanOrEqual(54);
    expect(peripheral.rationale).toMatch(/peripheral/i);
  });

  it("caps an inflated LLM score when evidence is peripheral-only", () => {
    const scored = scoreFromLlm(
      candidate({
        quote: "nursing association annual meeting recap",
        whyFit: "Mentioned in a nursing association article.",
        rationale: "Looks like a hospital buyer.",
        fitScore: 91,
      }),
    );
    expect(scored?.evidenceRelevance).toBe("peripheral");
    expect(scored?.fitScore).toBeLessThanOrEqual(54);
  });
});
