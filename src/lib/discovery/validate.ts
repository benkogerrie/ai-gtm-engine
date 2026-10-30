import { normalizeSearchUrl } from "@/lib/search/url";
import { isRealSearchEvidence } from "@/lib/search/evidence";
import type { SearchResult } from "@/lib/search/types";
import { isRejectedSourceUrl, normalizeDomain } from "./filters";
import type { DiscoveryCandidate, DiscoveryClaim } from "./types";

export function allowedResultUrls(results: SearchResult[]): Set<string> {
  const allowed = new Set<string>();
  for (const result of results) {
    allowed.add(result.url);
    const normalized = normalizeSearchUrl(result.url);
    if (normalized) {
      allowed.add(normalized);
    }
  }
  return allowed;
}

export function isClaimUrlAllowed(
  sourceUrl: string,
  allowed: Set<string>,
): boolean {
  if (allowed.has(sourceUrl)) {
    return true;
  }
  const normalized = normalizeSearchUrl(sourceUrl);
  return normalized !== null && allowed.has(normalized);
}

export function resultByUrl(
  results: SearchResult[],
  sourceUrl: string,
): SearchResult | undefined {
  const normalized = normalizeSearchUrl(sourceUrl) ?? sourceUrl;
  return results.find((result) => {
    if (result.url === sourceUrl) {
      return true;
    }
    return (normalizeSearchUrl(result.url) ?? result.url) === normalized;
  });
}

export function keepCitedClaims(
  claims: DiscoveryClaim[],
  allowed: Set<string>,
): { kept: DiscoveryClaim[]; rejectedCount: number } {
  const kept: DiscoveryClaim[] = [];
  let rejectedCount = 0;
  for (const claim of claims) {
    if (!isClaimUrlAllowed(claim.sourceUrl, allowed)) {
      rejectedCount += 1;
      continue;
    }
    if (isRejectedSourceUrl(claim.sourceUrl)) {
      rejectedCount += 1;
      continue;
    }
    kept.push(claim);
  }
  return { kept, rejectedCount };
}

export function validateCandidates(
  candidates: DiscoveryCandidate[],
  results: SearchResult[],
): {
  kept: DiscoveryCandidate[];
  rejectedClaimCount: number;
  droppedCompanyCount: number;
} {
  const allowed = allowedResultUrls(results);
  const kept: DiscoveryCandidate[] = [];
  let rejectedClaimCount = 0;
  let droppedCompanyCount = 0;

  for (const candidate of candidates) {
    const domain = normalizeDomain(candidate.domain) ?? candidate.domain ?? "";
    const { kept: claims, rejectedCount } = keepCitedClaims(
      candidate.claims,
      allowed,
    );
    rejectedClaimCount += rejectedCount;
    if (claims.length === 0) {
      droppedCompanyCount += 1;
      continue;
    }
    kept.push({
      ...candidate,
      domain,
      signals: candidate.signals.filter((signal) =>
        isClaimUrlAllowed(signal.sourceUrl, allowed),
      ),
    });
  }

  return { kept, rejectedClaimCount, droppedCompanyCount };
}

/** Claims that may become B002 citations (real Brave hits only). */
export function citationEligibleClaims(
  claims: DiscoveryClaim[],
  results: SearchResult[],
): DiscoveryClaim[] {
  return claims.filter((claim) => {
    const result = resultByUrl(results, claim.sourceUrl);
    return result !== undefined && isRealSearchEvidence(result);
  });
}
