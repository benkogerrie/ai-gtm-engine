import { formatNaicsPromptList } from "@/lib/icp/naics";
import { NAICS_2022_SOURCE_URL } from "@/lib/icp/naics-2022";

export const ICP_PROMPT_VERSION = "v1";

export const ICP_JSON_EXAMPLE = `{
  "name": "Harborline Ops Cloud ICP",
  "targetIndustries": [
    {
      "name": "Support Activities for Transportation",
      "naics": "488",
      "sic": "4731",
      "confidence": 0.78,
      "status": "INFERRED"
    }
  ],
  "companySize": {
    "headcountTiers": [
      {
        "label": "51–500",
        "min": 51,
        "max": 500,
        "confidence": 0.7,
        "status": "INFERRED"
      }
    ],
    "revenueBands": [
      {
        "label": "$10M–$250M",
        "min": 10000000,
        "max": 250000000,
        "currency": "USD",
        "confidence": 0.62,
        "status": "INFERRED"
      }
    ],
    "confidence": 0.66,
    "status": "INFERRED"
  },
  "buyerPersonas": [
    {
      "title": "Head of Capacity",
      "functionalArea": "Operations",
      "seniority": "director",
      "confidence": 0.74,
      "status": "INFERRED"
    }
  ],
  "triggerEvents": [
    {
      "type": "TECH_STACK_CHANGE",
      "summary": "New TMS or capacity marketplace rollout",
      "confidence": 0.71,
      "status": "INFERRED"
    },
    {
      "type": "EXEC_HIRE",
      "summary": "New VP Operations hire",
      "confidence": 0.64,
      "status": "INFERRED"
    },
    {
      "type": "FUNDING",
      "summary": "Growth round that funds ops tooling",
      "confidence": 0.55,
      "status": "INFERRED"
    }
  ],
  "expansionSuggestions": [
    {
      "kind": "ADJACENT_SEGMENT",
      "title": "3PL control towers",
      "reasoning": "Same ops buyer and tooling trigger as the core freight-broker segment.",
      "evidence": ["Existing freight customer profile", "Capacity-matching capability"],
      "confidence": 0.61,
      "status": "INFERRED"
    },
    {
      "kind": "EMERGING_VERTICAL",
      "title": "Embedded freight at mid-market shippers",
      "reasoning": "Contract band and constraints fit a second vertical with the same pain.",
      "evidence": ["Stated monetization model"],
      "confidence": 0.48,
      "status": "INFERRED"
    },
    {
      "kind": "NON_OBVIOUS_APPLICATION",
      "title": "Internal enablement for customer-success pods",
      "reasoning": "Account-scoring features can be reused for portfolio health if accepted.",
      "evidence": ["Lane scoring feature"],
      "confidence": 0.41,
      "status": "INFERRED"
    }
  ]
}`;

export const ICP_SYSTEM_PROMPT = `You infer an Ideal Customer Profile (ICP) for a B2B product.

Return a single JSON object that matches this exact shape. Do not wrap it in markdown. Do not rename fields. Do not return arrays where a string is required.

Required JSON shape (filled example — copy these keys literally):
${ICP_JSON_EXAMPLE}

Field rules:
- Every inferred object MUST include "confidence" (number 0.00–1.00) and "status": "INFERRED". Never "VERIFIED".
- targetIndustries[].name is a string. naics is a single 2–6 digit string or null (not an array). sic is a single 2–4 digit string or null (not an array).
- companySize MUST include headcountTiers (array of {label, min, max, confidence, status}) and revenueBands (array of {label, min, max, currency, confidence, status}).
- triggerEvents[].type is exactly one of TECH_STACK_CHANGE | EXEC_HIRE | FUNDING | OTHER.
- triggerEvents[].summary is a required string.
- expansionSuggestions[].kind is exactly one of ADJACENT_SEGMENT | EMERGING_VERTICAL | NON_OBVIOUS_APPLICATION.
- expansionSuggestions[].title, reasoning are required strings. evidence is a non-empty array of strings.
- NAICS codes must be 2–6 digits from the NAICS 2022 structure (${NAICS_2022_SOURCE_URL}). Do not invent codes. If unsure, set naics to null.
- Do not fabricate named customers.

NAICS 2022 sectors (use only these 2-digit prefixes or more specific codes under them):
${formatNaicsPromptList()}
`;

export function buildIcpUserPrompt(input: {
  name: string;
  description: string;
  features: string[];
  capabilities: string[];
  technicalConstraints: string[];
  existingCustomers: string[];
  pricingModel: string | null;
  contractValueMin: number | null;
  contractValueMax: number | null;
  monetizationModel: string | null;
  freeText?: string;
}): string {
  return [
    `Product name: ${input.name}`,
    `Description: ${input.description}`,
    `Features: ${input.features.join("; ") || "(none provided)"}`,
    `Capabilities: ${input.capabilities.join("; ") || "(none provided)"}`,
    `Technical constraints: ${input.technicalConstraints.join("; ") || "(none provided)"}`,
    `Existing customers / reference wins: ${input.existingCustomers.join("; ") || "(none provided)"}`,
    `Pricing model: ${input.pricingModel ?? "(unknown)"}`,
    `Contract value range: ${input.contractValueMin ?? "?"} – ${input.contractValueMax ?? "?"}`,
    `Monetization: ${input.monetizationModel ?? "(unknown)"}`,
    input.freeText?.trim()
      ? `Founder free-text description:\n${input.freeText.trim()}`
      : "",
    "",
    "Return the ICP as one JSON object matching the required example shape.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
