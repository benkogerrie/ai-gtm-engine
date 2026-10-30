import { SearchSyntheticEvidenceError } from "./errors";
import type { CitationCandidate, SearchResult } from "./types";

/**
 * Real provider hits only. Mock/synthetic rows are never citation-eligible
 * and must not be presented or persisted as Brave evidence.
 */
export function isRealSearchEvidence(
  result: SearchResult,
): result is CitationCandidate {
  return result.source === "brave";
}

/**
 * Fail closed: mock hits throw instead of becoming a citation candidate.
 */
export function toCitationCandidate(result: SearchResult): CitationCandidate {
  if (!isRealSearchEvidence(result)) {
    throw new SearchSyntheticEvidenceError();
  }
  return result;
}
