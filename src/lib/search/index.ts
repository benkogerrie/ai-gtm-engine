import { isSearchConfigured } from "./config";
import { createBraveSearchClient } from "./brave";
import { createMockSearchClient } from "./mock";
import type { SearchClient } from "./types";

export {
  BRAVE_COUNT_MAX,
  BRAVE_COUNT_MIN,
  BRAVE_OFFSET_MAX,
  BRAVE_OFFSET_MIN,
  BRAVE_SEARCH_ENDPOINT,
  DEFAULT_SEARCH_MAX_ATTEMPTS,
  DEFAULT_SEARCH_MIN_INTERVAL_MS,
  DEFAULT_SEARCH_PROVIDER,
  DEFAULT_SEARCH_TIMEOUT_MS,
  getSearchConfig,
  getSearchHealth,
  isSearchConfigured,
  readSearchEnv,
} from "./config";
export type {
  SearchEnvConfig,
  SearchEnvSnapshot,
  SearchHealthStatus,
} from "./config";
export {
  BraveSearchClient,
  createBraveSearchClient,
} from "./brave";
export type { BraveSearchClientOptions } from "./brave";
export {
  SEARCH_ERROR_CODES,
  SearchError,
  SearchHttpError,
  SearchInvalidRequestError,
  SearchInvalidResponseError,
  SearchMissingApiKeyError,
  SearchSyntheticEvidenceError,
  SearchTimeoutError,
  isSearchError,
} from "./errors";
export { isRealSearchEvidence, toCitationCandidate } from "./evidence";
export { MockSearchClient, createMockSearchClient } from "./mock";
export type { MockSearchClientOptions } from "./mock";
export { SearchRateLimiter } from "./rate-limit";
export { dedupeSearchUrls, normalizeSearchUrl } from "./url";
export type {
  CitationCandidate,
  SearchClient,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from "./types";

export type CreateSearchClientOptions = {
  /**
   * When true, return a MockSearchClient if BRAVE_SEARCH_API_KEY is unset.
   * Default is false: missing key throws SearchMissingApiKeyError.
   */
  allowMockIfUnconfigured?: boolean;
};

export function createSearchClient(
  options: CreateSearchClientOptions = {},
): SearchClient {
  if (!isSearchConfigured() && options.allowMockIfUnconfigured) {
    return createMockSearchClient();
  }
  return createBraveSearchClient();
}
