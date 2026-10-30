import { cleanText } from "./html";
import type { DiscoveryCandidate, EvidenceRelevance } from "./types";

const STRONG_PRODUCT_EVIDENCE =
  /\b(?:shift\s+schedul(?:e|ing)|nurse\s+schedul(?:e|ing)|rn\s+schedul(?:e|ing)|staffing\s+(?:coverage|shortage|platform|software|system|tool)|workforce\s+(?:schedul(?:e|ing)|management|platform)|flexible\s+schedul(?:e|ing)|schedul(?:e|ing)\s+(?:for\s+)?(?:nurses|rns|staff)|nurse\s+staffing|staffing\s+ratio|float\s+pool|shift\s+bidding|self[- ]schedul(?:e|ing))\b/i;

export function classifyEvidenceText(text: string): EvidenceRelevance {
  return STRONG_PRODUCT_EVIDENCE.test(text) ? "strong" : "peripheral";
}

export function prospectEvidenceRelevance(
  candidate: Pick<
    DiscoveryCandidate,
    "name" | "whyFit" | "rationale" | "claims" | "signals" | "evidenceRelevance"
  >,
): EvidenceRelevance {
  const claimRelevance = candidate.claims.map((claim) =>
    claim.relevance ?? classifyEvidenceText(`${claim.value} ${claim.quote}`),
  );
  if (claimRelevance.some((value) => value === "strong")) {
    return "strong";
  }

  const blob = cleanText(
    [
      candidate.whyFit,
      candidate.rationale ?? "",
      ...candidate.signals.map((signal) => signal.summary),
    ].join(" "),
  );
  if (classifyEvidenceText(blob) === "strong") {
    return "strong";
  }
  return "peripheral";
}

/** Peripheral-only prospects must score below a strong-evidence buyer. */
export function capFitForRelevance(
  fitScore: number,
  relevance: EvidenceRelevance,
): number {
  const rounded = Math.max(0, Math.min(100, Math.round(fitScore)));
  if (relevance === "peripheral") {
    return Math.min(rounded, 54);
  }
  return rounded;
}
