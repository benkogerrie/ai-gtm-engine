import {
  BRAVE_COUNT_MAX,
  BRAVE_COUNT_MIN,
  BRAVE_OFFSET_MAX,
  BRAVE_OFFSET_MIN,
  BRAVE_SEARCH_ENDPOINT,
  readSearchEnv,
} from "./config";
import {
  SearchInvalidRequestError,
  SearchInvalidResponseError,
  SearchMissingApiKeyError,
} from "./errors";
import { fetchWithRetry, type FetchLike, type NowFn, type SleepFn } from "./http";
import { SearchRateLimiter } from "./rate-limit";
import type { SearchClient, SearchOptions, SearchResult } from "./types";
import { normalizeSearchUrl } from "./url";

export type BraveSearchClientOptions = {
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
  minIntervalMs: number;
  fetchFn?: FetchLike;
  sleepFn?: SleepFn;
  nowFn?: NowFn;
  endpoint?: string;
};

type BraveWebResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  page_age?: unknown;
};

type BraveSearchPayload = {
  web?: {
    results?: unknown;
  };
};

function clampInt(
  value: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function parsePublishedAt(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function asWebResults(payload: unknown): BraveWebResult[] {
  if (!payload || typeof payload !== "object") {
    throw new SearchInvalidResponseError(
      "Brave Search response was not a JSON object",
    );
  }

  const web = (payload as BraveSearchPayload).web;
  if (web === undefined) {
    return [];
  }
  if (!web || typeof web !== "object" || !Array.isArray(web.results)) {
    throw new SearchInvalidResponseError(
      "Brave Search payload was missing web.results",
    );
  }

  return web.results.filter(
    (item): item is BraveWebResult => Boolean(item) && typeof item === "object",
  );
}

function buildSearchUrl(
  endpoint: string,
  query: string,
  options: SearchOptions | undefined,
): string {
  const url = new URL(endpoint);
  url.searchParams.set("q", query);

  const count = clampInt(options?.count, BRAVE_COUNT_MIN, BRAVE_COUNT_MAX);
  if (count !== undefined) {
    url.searchParams.set("count", String(count));
  }

  const offset = clampInt(options?.offset, BRAVE_OFFSET_MIN, BRAVE_OFFSET_MAX);
  if (offset !== undefined) {
    url.searchParams.set("offset", String(offset));
  }

  const country = options?.country?.trim();
  if (country) {
    url.searchParams.set("country", country);
  }

  const freshness = options?.freshness?.trim();
  if (freshness) {
    url.searchParams.set("freshness", freshness);
  }

  return url.toString();
}

/**
 * Brave Web Search client.
 *
 * Request / response shape:
 * https://api-dashboard.search.brave.com/documentation/services/web-search
 * https://api-dashboard.search.brave.com/api-reference/web/search/post
 *
 * Auth header `X-Subscription-Token`:
 * https://api-dashboard.search.brave.com/documentation/guides/authentication
 *
 * Official examples use GET with query params to
 * `https://api.search.brave.com/res/v1/web/search`. The OpenAPI reference
 * also documents POST; this client uses GET to match the service docs.
 */
export class BraveSearchClient implements SearchClient {
  readonly provider = "brave" as const;
  private readonly options: BraveSearchClientOptions;
  private readonly rateLimiter: SearchRateLimiter;

  constructor(options: BraveSearchClientOptions) {
    if (!options.apiKey.trim()) {
      throw new SearchMissingApiKeyError();
    }
    this.options = options;
    this.rateLimiter = new SearchRateLimiter(
      options.minIntervalMs,
      options.sleepFn,
      options.nowFn,
    );
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      throw new SearchInvalidRequestError("Search query must not be empty");
    }

    const now = this.options.nowFn ?? Date.now;
    const retrievedAt = new Date(now()).toISOString();
    const timeoutMs = options?.timeoutMs ?? this.options.timeoutMs;
    const endpoint = this.options.endpoint ?? BRAVE_SEARCH_ENDPOINT;
    const url = buildSearchUrl(endpoint, trimmed, options);

    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": this.options.apiKey,
        },
      },
      {
        timeoutMs,
        maxAttempts: this.options.maxAttempts,
        fetchFn: this.options.fetchFn,
        sleepFn: this.options.sleepFn,
        nowFn: this.options.nowFn,
        beforeAttempt: () => this.rateLimiter.schedule(),
      },
    );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new SearchInvalidResponseError(
        "Brave Search response was not valid JSON",
        { cause: error },
      );
    }

    return this.mapResults(asWebResults(payload), retrievedAt);
  }

  private mapResults(
    raw: BraveWebResult[],
    retrievedAt: string,
  ): SearchResult[] {
    const mapped: SearchResult[] = [];
    const seen = new Set<string>();

    for (const item of raw) {
      if (typeof item.title !== "string" || typeof item.url !== "string") {
        continue;
      }

      const url = normalizeSearchUrl(item.url);
      if (!url || seen.has(url)) {
        continue;
      }
      seen.add(url);

      const snippet =
        typeof item.description === "string" ? item.description : "";
      const publishedAt = parsePublishedAt(item.page_age);

      mapped.push({
        title: item.title,
        url,
        snippet,
        ...(publishedAt ? { publishedAt } : {}),
        source: "brave",
        retrievedAt,
      });
    }

    return mapped;
  }
}

export function createBraveSearchClient(
  overrides: Partial<BraveSearchClientOptions> = {},
): BraveSearchClient {
  const env = readSearchEnv();
  const apiKey = overrides.apiKey ?? env.apiKey;
  if (!apiKey) {
    throw new SearchMissingApiKeyError();
  }

  return new BraveSearchClient({
    apiKey,
    timeoutMs: overrides.timeoutMs ?? env.timeoutMs,
    maxAttempts: overrides.maxAttempts ?? env.maxAttempts,
    minIntervalMs: overrides.minIntervalMs ?? env.minIntervalMs,
    fetchFn: overrides.fetchFn,
    sleepFn: overrides.sleepFn,
    nowFn: overrides.nowFn,
    endpoint: overrides.endpoint,
  });
}
