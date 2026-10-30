import type { DiscoveryCandidate, DiscoveryInput } from "./types";

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
): { fitScore: number; rationale: string } {
  const blob = [
    candidate.name,
    candidate.domain,
    candidate.whyFit,
    ...candidate.claims.map((claim) => `${claim.value} ${claim.quote}`),
    ...candidate.signals.map((signal) => signal.summary),
  ].join(" ");

  let fitScore = 48;
  const reasons: string[] = [];

  if (mentions(blob, input.industries)) {
    fitScore += 18;
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

  fitScore = Math.max(0, Math.min(100, fitScore));
  const rationale =
    reasons.length > 0
      ? `${candidate.whyFit} Score ${fitScore}: ${reasons.join("; ")}.`
      : candidate.whyFit;
  return { fitScore, rationale };
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
