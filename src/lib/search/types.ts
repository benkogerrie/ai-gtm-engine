export type SearchProvider = "brave" | "mock";

export type SearchOptions = {
  count?: number;
  offset?: number;
  country?: string;
  freshness?: string;
  timeoutMs?: number;
};

/**
 * Normalized web result. These are evidence *candidates* for the B002 ledger.
 * A search hit is never VERIFIED by itself — later tasks must corroborate it.
 * `source: "mock"` is synthetic and must never be persisted as a citation.
 */
export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source: SearchProvider;
  retrievedAt: string;
};

/** A result that is allowed to become a B002 citation candidate. */
export type CitationCandidate = SearchResult & { source: "brave" };

export interface SearchClient {
  readonly provider: SearchProvider;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
