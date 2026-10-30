import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createDeepSeekLlmClient } from "./deepseek";
import {
  LlmInvalidJsonError,
  LlmMissingApiKeyError,
  LlmTimeoutError,
} from "./errors";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const icpSchema = z.object({
  name: z.string(),
  score: z.number(),
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completionPayload(content: string, usage = { prompt: 3, completion: 2 }) {
  return {
    model: "deepseek-chat",
    choices: [{ message: { content } }],
    usage: {
      prompt_tokens: usage.prompt,
      completion_tokens: usage.completion,
      total_tokens: usage.prompt + usage.completion,
    },
  };
}

function requestCall(
  fetchFn: { mock: { calls: unknown[] } },
  index: number,
): [string, RequestInit] {
  return fetchFn.mock.calls[index] as unknown as [string, RequestInit];
}

function testClient(
  fetchFn: (input: string, init?: RequestInit) => Promise<Response>,
  overrides: { timeoutMs?: number; maxAttempts?: number } = {},
) {
  return createDeepSeekLlmClient({
    apiKey: "sk-test-not-a-real-key",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    timeoutMs: overrides.timeoutMs ?? 1_000,
    maxAttempts: overrides.maxAttempts ?? 3,
    fetchFn,
    sleepFn: async () => undefined,
    nowFn: (() => {
      let t = 1_000;
      return () => {
        t += 5;
        return t;
      };
    })(),
  });
}

describe("DeepSeekLlmClient", () => {
  it("completes a successful chat call and returns usage plus latency", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(completionPayload("hello")));
    const client = testClient(fetchFn);

    const result = await client.chat([{ role: "user", content: "Say hello" }]);

    expect(result.content).toBe("hello");
    expect(result.model).toBe("deepseek-chat");
    expect(result.usage).toEqual({
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
    });
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.usageRecord).toMatchObject({
      provider: "deepseek",
      model: "deepseek-chat",
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [url, init] = requestCall(fetchFn, 0);
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-test-not-a-real-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "deepseek-chat",
      stream: false,
    });
  });

  it("retries on 429 and succeeds on the next attempt", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse(completionPayload("recovered")));
    const sleeps: number[] = [];
    const client = createDeepSeekLlmClient({
      apiKey: "sk-test-not-a-real-key",
      fetchFn,
      sleepFn: async (ms) => {
        sleeps.push(ms);
      },
    });

    const result = await client.chat([{ role: "user", content: "retry" }]);

    expect(result.content).toBe("recovered");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([200]);
  });

  it("does not retry on 400", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("bad request", { status: 400 }));
    const client = testClient(fetchFn);

    await expect(
      client.chat([{ role: "user", content: "nope" }]),
    ).rejects.toMatchObject({
      name: "LlmHttpError",
      status: 400,
      code: "HTTP",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
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

    await expect(
      client.chat([{ role: "user", content: "hang" }]),
    ).rejects.toBeInstanceOf(LlmTimeoutError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("repairs once on invalid JSON and then fails with a typed error", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(completionPayload("not-json")))
      .mockResolvedValueOnce(jsonResponse(completionPayload("still-not-json")));
    const client = testClient(fetchFn);

    await expect(
      client.json(icpSchema, [{ role: "user", content: "Return an ICP as JSON" }]),
    ).rejects.toBeInstanceOf(LlmInvalidJsonError);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(requestCall(fetchFn, 1)[1]?.body)) as {
      response_format?: { type: string };
      messages: { content: string }[];
    };
    expect(secondBody.response_format).toEqual({ type: "json_object" });
    expect(secondBody.messages.at(-1)?.content).toMatch(/not valid JSON/i);
  });

  it("returns structured data when the first JSON payload is valid", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(completionPayload(JSON.stringify({ name: "ACME", score: 81 }))),
    );
    const client = testClient(fetchFn);

    const result = await client.json(icpSchema, [
      { role: "user", content: "Return an ICP as JSON" },
    ]);

    expect(result.data).toEqual({ name: "ACME", score: 81 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(requestCall(fetchFn, 0)[1]?.body)).response_format).toEqual({
      type: "json_object",
    });
  });

  it("throws a typed missing-key error when the env key is absent", () => {
    delete process.env.DEEPSEEK_API_KEY;

    expect(() => createDeepSeekLlmClient()).toThrow(LlmMissingApiKeyError);
    expect(() => createDeepSeekLlmClient()).toThrow(/DEEPSEEK_API_KEY/);
  });
});
