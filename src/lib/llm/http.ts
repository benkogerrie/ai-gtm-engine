import { LlmHttpError, LlmTimeoutError } from "./errors";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export type SleepFn = (ms: number) => Promise<void>;

export type HttpRetryOptions = {
  timeoutMs: number;
  maxAttempts: number;
  fetchFn?: FetchLike;
  sleepFn?: SleepFn;
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

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: HttpRetryOptions,
): Promise<Response> {
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? defaultSleep;
  const { timeoutMs, maxAttempts } = options;

  let lastHttpError: LlmHttpError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
      lastHttpError = new LlmHttpError(response.status, body);

      if (shouldRetryStatus(response.status) && attempt < maxAttempts) {
        await sleepFn(backoffDelayMs(attempt));
        continue;
      }

      throw lastHttpError;
    } catch (error) {
      if (error instanceof LlmHttpError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new LlmTimeoutError(timeoutMs);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastHttpError ?? new LlmHttpError(0, "LLM request failed without a response");
}

export function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}
