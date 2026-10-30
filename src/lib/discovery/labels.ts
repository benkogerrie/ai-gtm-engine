import type { EvidenceLabel } from "./types";

const FACT_FIELDS = new Set([
  "name",
  "domain",
  "websiteUrl",
  "industry",
  "headcount",
  "region",
  "headquarters",
]);

export function labelDiscoveryClaim(input: {
  field: string;
  sourceUrl?: string;
  verifiedUrls?: Set<string>;
}): EvidenceLabel {
  if (input.field === "fitScore" || input.field === "rationale" || input.field === "whyFit") {
    return "INFERRED";
  }
  if (input.sourceUrl && input.verifiedUrls?.has(input.sourceUrl)) {
    return "VERIFIED";
  }
  if (FACT_FIELDS.has(input.field) && input.sourceUrl) {
    return input.verifiedUrls ? "source-candidate" : "VERIFIED";
  }
  return "source-candidate";
}

export function labelFitScore(): EvidenceLabel {
  return "INFERRED";
}
