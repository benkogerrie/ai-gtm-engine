import type { LlmIcpOutput, ProductIntake } from "@/domain";

export function buildMockIcpOutput(intake: ProductIntake): LlmIcpOutput {
  const text = [
    intake.name,
    intake.description,
    intake.freeText ?? "",
    ...(intake.features ?? []),
    ...(intake.capabilities ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const freight = /freight|broker|logistics|tms|lane/.test(text);
  const health = /health|clinic|hospital|patient/.test(text);

  const industry = freight
    ? {
        name: "Support Activities for Transportation",
        naics: "488",
        sic: "4731",
      }
    : health
      ? {
          name: "Ambulatory Health Care Services",
          naics: "621",
          sic: "8011",
        }
      : {
          name: "Professional, Scientific, and Technical Services",
          naics: "541",
          sic: "7371",
        };

  return {
    name: `${intake.name} ICP`,
    targetIndustries: [
      {
        ...industry,
        confidence: 0.78,
        status: "INFERRED",
      },
    ],
    companySize: {
      headcountTiers: [
        {
          label: "51–500",
          min: 51,
          max: 500,
          confidence: 0.7,
          status: "INFERRED",
        },
      ],
      revenueBands: [
        {
          label: "$10M–$250M",
          min: 10_000_000,
          max: 250_000_000,
          currency: "USD",
          confidence: 0.62,
          status: "INFERRED",
        },
      ],
      confidence: 0.66,
      status: "INFERRED",
    },
    buyerPersonas: [
      {
        title: freight ? "Head of Capacity" : "VP Operations",
        functionalArea: "Operations",
        seniority: "director",
        confidence: 0.74,
        status: "INFERRED",
      },
      {
        title: "Chief Revenue Officer",
        functionalArea: "Revenue",
        seniority: "c-level",
        confidence: 0.58,
        status: "INFERRED",
      },
    ],
    triggerEvents: [
      {
        type: "TECH_STACK_CHANGE",
        summary: freight
          ? "New TMS or capacity marketplace rollout"
          : "Core ops platform replacement",
        confidence: 0.71,
        status: "INFERRED",
      },
      {
        type: "EXEC_HIRE",
        summary: "New VP Operations or Head of Revenue hire",
        confidence: 0.64,
        status: "INFERRED",
      },
      {
        type: "FUNDING",
        summary: "Growth round that funds a GTM or ops tooling budget",
        confidence: 0.55,
        status: "INFERRED",
      },
    ],
    expansionSuggestions: [
      {
        kind: "ADJACENT_SEGMENT",
        title: freight ? "3PL control towers" : "Implementation consultancies",
        reasoning:
          "Same buyer motion and constraints as the stated core segment, with overlapping tooling triggers.",
        evidence: [
          intake.existingCustomers?.[0] || "Stated customer profile",
          intake.capabilities?.[0] || intake.description,
        ],
        confidence: 0.61,
        status: "INFERRED",
      },
      {
        kind: "EMERGING_VERTICAL",
        title: freight
          ? "Embedded freight at mid-market shippers"
          : "Vertical SaaS operators in adjacent industries",
        reasoning:
          "Monetization and contract band fit a second vertical that shares the same operational pain.",
        evidence: [
          intake.monetizationModel || "Stated monetization model",
          intake.technicalConstraints?.[0] || "Published constraints",
        ],
        confidence: 0.48,
        status: "INFERRED",
      },
      {
        kind: "NON_OBVIOUS_APPLICATION",
        title: "Internal enablement for customer-success pods",
        reasoning:
          "The same features that score external accounts can be reused for portfolio health if the founder accepts a non-sales motion.",
        evidence: [intake.features?.[0] || intake.description],
        confidence: 0.41,
        status: "INFERRED",
      },
    ],
  };
}
