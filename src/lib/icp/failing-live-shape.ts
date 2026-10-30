/**
 * Reconstructed from the live DeepSeek failure on f1f00cc:
 * missing companySize.headcountTiers/revenueBands, industry name missing,
 * naics/sic as arrays, trigger summary missing, expansion kind/title/evidence off-schema.
 */
export const failingLiveShape = {
  name: "Harborline Ops Cloud ICP",
  targetIndustries: [
    {
      industry: "Support Activities for Transportation",
      naics: ["488510"],
      sic: ["4731"],
      confidence: 0.78,
      status: "INFERRED",
    },
  ],
  companySize: {
    headcount: { min: 51, max: 500 },
    revenue: { min: 10_000_000, max: 250_000_000 },
    confidence: 0.66,
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
      type: "TECH_STACK_CHANGE",
      description: "New TMS rollout",
      confidence: 0.71,
      status: "INFERRED",
    },
    {
      type: "hire",
      description: "New VP Operations hire",
      confidence: 0.64,
      status: "INFERRED",
    },
    {
      type: "FUNDING",
      description: "Growth round",
      confidence: 0.55,
      status: "INFERRED",
    },
  ],
  expansionSuggestions: [
    {
      kind: "adjacent",
      name: "3PL control towers",
      reasoning: "Same ops buyer as the core segment.",
      confidence: 0.61,
      status: "INFERRED",
    },
    {
      kind: "emerging_vertical",
      name: "Embedded freight at shippers",
      reasoning: "Contract band fits a second vertical.",
      confidence: 0.48,
      status: "INFERRED",
    },
    {
      kind: "non-obvious",
      name: "CS pod enablement",
      reasoning: "Scoring features can be reused internally.",
      confidence: 0.41,
      status: "INFERRED",
    },
  ],
};
