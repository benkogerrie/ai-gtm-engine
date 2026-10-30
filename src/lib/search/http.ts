import { SearchHttpError, SearchTimeoutError } from "./errors";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type SleepFn = (ms: number) => Promise<void>;
export type NowFn = () => number;

export type HttpRetryOptions = {
  timeoutMs: number;
  maxAttempts: number;
  fetchFn?: FetchLike;
  sleepFn?: SleepFn;
  nowFn?: NowFn;
  beforeAttempt?: () => Promise<void>;
};

const DEFAULT_BACKOFF_MS = 200;
const MAX_BACKOFF_MS = 2_000;

export function shouldRetryStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function backoffDelayMs(attempt: number): number {
  const exp = DEFAULT_BACKOFF_MS * 2 ** (attempt - 1);
  return Math.min(MAX_BACKOFF_MS, exp);
}

export async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "TimeoutError";
}

/**
 * Parse `Retry-After` as seconds or an HTTP-date.
 * https://httpwg.org/specs/rfc9110.html#field.retry-after
 */
export function parseRetryAfterMs(
  header: string | null,
  fallbackMs: number,
  nowMs: number = Date.now(),
): number {
  if (!header?.trim()) {
    return fallbackMs;
  }

  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.max(0, Number.parseInt(trimmed, 10) * 1_000);
  }

  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - nowMs);
  }

  return fallbackMs;
}

export function retryDelayMs(
  response: Response,
  attempt: number,
  nowMs: number = Date.now(),
): number {
  return parseRetryAfterMs(
    response.headers.get("Retry-After"),
    backoffDelayMs(attempt),
    nowMs,
  );
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: HttpRetryOptions,
): Promise<Response> {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? defaultSleep;
  const nowFn = options.nowFn ?? Date.now;
  const { timeoutMs, maxAttempts } = options;

  let lastHttpError: SearchHttpError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.beforeAttempt) {
      await options.beforeAttempt();
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchFn(url, {
        ...init,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      const body = await response.text();
      lastHttpError = new SearchHttpError(response.status, body);

      if (shouldRetryStatus(response.status) && attempt < maxAttempts) {
        await sleepFn(retryDelayMs(response, attempt, nowFn()));
        continue;
      }

      throw lastHttpError;
    } catch (error) {
      if (error instanceof SearchHttpError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new SearchTimeoutError(timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw (
    lastHttpError ?? new SearchHttpError(0, "Search request failed without a response")
  );
}
