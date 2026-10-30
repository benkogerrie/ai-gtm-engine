import { SearchMissingApiKeyError } from "./errors";

export const DEFAULT_SEARCH_PROVIDER = "brave" as const;
export const BRAVE_SEARCH_ENDPOINT =
  "https://api.search.brave.com/res/v1/web/search";
export const DEFAULT_SEARCH_TIMEOUT_MS = 15_000;
export const DEFAULT_SEARCH_MAX_ATTEMPTS = 3;
/**
 * Client-side floor between outbound requests.
 *
 * Brave rate-limits with a 1-second sliding window
 * (https://api-dashboard.search.brave.com/documentation/guides/rate-limiting).
 * Example response headers on that page show `X-RateLimit-Limit: 1, 15000`
 * (1 req/s). The public plans page is login-gated, so the exact current
 * "free tier" monthly quota is UNVERIFIED; 1 req/s is the documented
 * example burst window and the conservative default we enforce here.
 */
export const DEFAULT_SEARCH_MIN_INTERVAL_MS = 1_000;
export const BRAVE_COUNT_MIN = 1;
export const BRAVE_COUNT_MAX = 20;
export const BRAVE_OFFSET_MIN = 0;
export const BRAVE_OFFSET_MAX = 9;

export type SearchEnvConfig = {
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
  minIntervalMs: number;
};

export type SearchEnvSnapshot = {
  apiKey?: string;
  timeoutMs: number;
  maxAttempts: number;
  minIntervalMs: number;
};

export type SearchHealthStatus = {
  configured: boolean;
  provider: typeof DEFAULT_SEARCH_PROVIDER;
};

function readOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function isSearchConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(readOptional(env.BRAVE_SEARCH_API_KEY));
}

export function getSearchHealth(
  env: NodeJS.ProcessEnv = process.env,
): SearchHealthStatus {
  return {
    configured: isSearchConfigured(env),
    provider: DEFAULT_SEARCH_PROVIDER,
  };
}

export function readSearchEnv(
  env: NodeJS.ProcessEnv = process.env,
): SearchEnvSnapshot {
  return {
    apiKey: readOptional(env.BRAVE_SEARCH_API_KEY),
    timeoutMs: readPositiveInt(env.SEARCH_TIMEOUT_MS, DEFAULT_SEARCH_TIMEOUT_MS),
    maxAttempts: readPositiveInt(
      env.SEARCH_MAX_ATTEMPTS,
      DEFAULT_SEARCH_MAX_ATTEMPTS,
    ),
    minIntervalMs: readPositiveInt(
      env.SEARCH_MIN_INTERVAL_MS,
      DEFAULT_SEARCH_MIN_INTERVAL_MS,
    ),
  };
}

export function getSearchConfig(
  env: NodeJS.ProcessEnv = process.env,
): SearchEnvConfig {
  const snapshot = readSearchEnv(env);
  if (!snapshot.apiKey) {
    throw new SearchMissingApiKeyError();
  }

  return {
    apiKey: snapshot.apiKey,
    timeoutMs: snapshot.timeoutMs,
    maxAttempts: snapshot.maxAttempts,
    minIntervalMs: snapshot.minIntervalMs,
  };
}
