import { cleanText } from "./html";
import {
  capFitForRelevance,
  classifyEvidenceText,
  prospectEvidenceRelevance,
} from "./relevance";
import type { DiscoveryCandidate, DiscoveryInput, EvidenceRelevance } from "./types";

function mentions(haystack: string, needles: string[] | undefined): boolean {
  if (!needles?.length) {
    return false;
  }
  const text = haystack.toLowerCase();
  return needles.some((needle) => {
    const token = needle.trim().toLowerCase();
    return token.length > 0 && text.includes(token);
  });
}

export function scoreProspect(
  candidate: DiscoveryCandidate,
  input: DiscoveryInput,
): { fitScore: number; rationale: string; evidenceRelevance: EvidenceRelevance } {
  const blob = [
    candidate.name,
    candidate.domain,
    candidate.whyFit,
    ...candidate.claims.map((claim) => `${claim.value} ${claim.quote}`),
    ...candidate.signals.map((signal) => signal.summary),
  ].join(" ");

  const evidenceRelevance = prospectEvidenceRelevance(candidate);
  let fitScore = 48;
  const reasons: string[] = [];

  if (evidenceRelevance === "strong") {
    fitScore += 14;
    reasons.push("strong cited evidence of nurse/shift scheduling or staffing");
  } else {
    fitScore -= 14;
    reasons.push(
      "peripheral-only coverage (nursing/hospital mention without scheduling or staffing operations)",
    );
  }

  if (mentions(blob, input.industries)) {
    fitScore += evidenceRelevance === "strong" ? 18 : 6;
    reasons.push("industry terms appear in cited sources");
  }
  if (mentions(blob, input.geographies)) {
    fitScore += 10;
    reasons.push("geography match in sources");
  }
  if (mentions(blob, input.companySizes)) {
    fitScore += 8;
    reasons.push("company-size signal");
  }
  if (mentions(blob, input.triggers)) {
    fitScore += 8;
    reasons.push("trigger language in sources");
  }
  if (candidate.claims.length >= 2) {
    fitScore += 8;
    reasons.push("multiple cited claims");
  } else {
    fitScore += 4;
    reasons.push("one cited claim");
  }
  if (candidate.signals.length > 0) {
    fitScore += 6;
    reasons.push("buying-signal snippet present");
  }

  fitScore = capFitForRelevance(fitScore, evidenceRelevance);
  const rationale = cleanText(
    reasons.length > 0
      ? `${candidate.whyFit} Score ${fitScore} (${evidenceRelevance}): ${reasons.join("; ")}.`
      : candidate.whyFit,
    400,
  );
  return { fitScore, rationale, evidenceRelevance };
}

export function scoreFromLlm(candidate: DiscoveryCandidate): {
  fitScore: number;
  rationale: string;
  evidenceRelevance: EvidenceRelevance;
} | null {
  if (
    typeof candidate.fitScore !== "number" ||
    !candidate.rationale ||
    !candidate.rationale.trim()
  ) {
    return null;
  }
  const evidenceRelevance = prospectEvidenceRelevance(candidate);
  return {
    fitScore: capFitForRelevance(candidate.fitScore, evidenceRelevance),
    rationale: cleanText(
      evidenceRelevance === "peripheral" &&
        !/peripheral/i.test(candidate.rationale)
        ? `${candidate.rationale} Evidence relevance: peripheral (no direct nurse/shift scheduling or staffing operations).`
        : candidate.rationale,
      400,
    ),
    evidenceRelevance,
  };
}

export function fitTierFromScore(fitScore: number): "A" | "B" | "C" {
  if (fitScore >= 80) {
    return "A";
  }
  if (fitScore >= 60) {
    return "B";
  }
  return "C";
}

export { classifyEvidenceText, prospectEvidenceRelevance };
