import { afterEach, describe, expect, it, vi } from "vitest";
import { BRAVE_SEARCH_ENDPOINT } from "./config";
import { createBraveSearchClient } from "./brave";
import { isRealSearchEvidence } from "./evidence";
import { SearchMissingApiKeyError, SearchTimeoutError } from "./errors";

const ORIGINAL_ENV = { ...process.env };
const FIXED_NOW = 1_700_000_000_000;
const RETRIEVED_AT = new Date(FIXED_NOW).toISOString();

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function bravePayload(
  results: Array<{
    title?: string;
    url?: string;
    description?: string;
    page_age?: string;
  }>,
) {
  return { web: { results } };
}

function requestCall(
  fetchFn: { mock: { calls: unknown[] } },
  index: number,
): [string, RequestInit] {
  return fetchFn.mock.calls[index] as unknown as [string, RequestInit];
}

function testClient(
  fetchFn: (input: string, init?: RequestInit) => Promise<Response>,
  overrides: {
    timeoutMs?: number;
    maxAttempts?: number;
    minIntervalMs?: number;
    sleepFn?: (ms: number) => Promise<void>;
  } = {},
) {
  return createBraveSearchClient({
    apiKey: "bsa-test-not-a-real-key",
    timeoutMs: overrides.timeoutMs ?? 1_000,
    maxAttempts: overrides.maxAttempts ?? 3,
    minIntervalMs: overrides.minIntervalMs ?? 0,
    fetchFn,
    sleepFn: overrides.sleepFn ?? (async () => undefined),
    nowFn: () => FIXED_NOW,
  });
}

describe("BraveSearchClient", () => {
  it("maps a successful Brave payload to normalized evidence candidates", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        bravePayload([
          {
            title: "Acme ICP notes",
            url: "https://Example.com/icp/?utm_source=brave",
            description: "A public write-up of the ICP.",
            page_age: "2026-01-15T00:00:00Z",
          },
          {
            title: "Same page, tracking params",
            url: "https://example.com/icp/",
            description: "Duplicate after normalization.",
          },
          {
            title: "Other source",
            url: "https://news.example/story",
            description: "Second unique hit.",
          },
        ]),
      ),
    );
    const client = testClient(fetchFn);

    const results = await client.search("acme icp", {
      count: 5,
      offset: 0,
      country: "US",
      freshness: "pw",
    });

    expect(results).toEqual([
      {
        title: "Acme ICP notes",
        url: "https://example.com/icp",
        snippet: "A public write-up of the ICP.",
        publishedAt: "2026-01-15T00:00:00.000Z",
        source: "brave",
        retrievedAt: RETRIEVED_AT,
      },
      {
        title: "Other source",
        url: "https://news.example/story",
        snippet: "Second unique hit.",
        source: "brave",
        retrievedAt: RETRIEVED_AT,
      },
    ]);

    expect(results.every((item) => item.source === "brave")).toBe(true);
    expect(results.every((item) => isRealSearchEvidence(item))).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = requestCall(fetchFn, 0);
    const parsed = new URL(url);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(BRAVE_SEARCH_ENDPOINT);
    expect(parsed.searchParams.get("q")).toBe("acme icp");
    expect(parsed.searchParams.get("count")).toBe("5");
    expect(parsed.searchParams.get("offset")).toBe("0");
    expect(parsed.searchParams.get("country")).toBe("US");
    expect(parsed.searchParams.get("freshness")).toBe("pw");
    expect(init.method).toBe("GET");
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      "X-Subscription-Token": "bsa-test-not-a-real-key",
    });
  });

  it("retries on 429 and waits for Retry-After before the next attempt", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "2" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          bravePayload([
            {
              title: "Recovered",
              url: "https://example.com/ok",
              description: "after retry",
            },
          ]),
        ),
      );
    const sleeps: number[] = [];
    const client = testClient(fetchFn, {
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    const results = await client.search("retry");

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Recovered");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2_000]);
  });

  it("does not retry on 400 or 401", async () => {
    for (const status of [400, 401]) {
      const fetchFn = vi.fn<typeof fetch>().mockImplementation(async () => {
        return new Response("nope", { status });
      });
      const client = testClient(fetchFn);

      await expect(client.search("blocked")).rejects.toMatchObject({
        name: "SearchHttpError",
        status,
        code: "HTTP",
      });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });

  it("times out when the provider never responds", async () => {
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("Aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    const client = testClient(fetchFn, { timeoutMs: 20, maxAttempts: 1 });

    await expect(client.search("hang")).rejects.toBeInstanceOf(
      SearchTimeoutError,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("dedups results that only differ by slash, case, or tracking params", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        bravePayload([
          { title: "First", url: "https://Docs.Example.com/guide/" },
          {
            title: "Dup",
            url: "https://docs.example.com/guide?utm_medium=cpc",
          },
        ]),
      ),
    );
    const results = await testClient(fetchFn).search("dedup");
    expect(results.map((item) => item.url)).toEqual([
      "https://docs.example.com/guide",
    ]);
  });

  it("throws a typed missing-key error when the env key is absent", () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    expect(() => createBraveSearchClient()).toThrow(SearchMissingApiKeyError);
    expect(() => createBraveSearchClient()).toThrow(/BRAVE_SEARCH_API_KEY/);
  });
});
