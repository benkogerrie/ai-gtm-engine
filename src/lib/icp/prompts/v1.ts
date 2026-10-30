import { formatNaicsPromptList } from "@/lib/icp/naics";
import { NAICS_2022_SOURCE_URL } from "@/lib/icp/naics-2022";

export const ICP_PROMPT_VERSION = "v1";

export const ICP_SYSTEM_PROMPT = `You infer an Ideal Customer Profile (ICP) for a B2B product.

Return a single JSON object that matches the schema exactly. Do not wrap it in markdown.

Rules:
- Every inferred field MUST include "confidence" as a number from 0.00 to 1.00 and "status": "INFERRED".
- Never use status "VERIFIED". You do not have retrieved source evidence.
- NAICS codes must be 2–6 digits from the NAICS 2022 structure (${NAICS_2022_SOURCE_URL}). Do not invent codes. If unsure, set naics to null rather than guessing.
- SIC codes are optional 2–4 digits; set sic to null when unknown.
- Buyer personas need a functional title, functionalArea, and seniority.
- Trigger events should include tech-stack changes, executive hires, and funding when relevant (type: TECH_STACK_CHANGE | EXEC_HIRE | FUNDING | OTHER).
- Expansion suggestions must be one of ADJACENT_SEGMENT, EMERGING_VERTICAL, NON_OBVIOUS_APPLICATION, each with evidence-based reasoning (why this follows from the product, customers, or constraints). Do not fabricate named customers.

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
    "Infer the ICP JSON now.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
