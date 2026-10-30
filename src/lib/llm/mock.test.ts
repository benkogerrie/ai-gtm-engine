import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createLlmClient } from "./index";
import { LlmInvalidJsonError, LlmMissingApiKeyError } from "./errors";
import { createMockLlmClient } from "./mock";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("MockLlmClient", () => {
  it("returns configured chat text without a provider key", async () => {
    const client = createMockLlmClient({ chatContent: "pong" });
    const result = await client.chat([{ role: "user", content: "ping" }]);
    expect(result.content).toBe("pong");
    expect(result.usageRecord.provider).toBe("mock");
  });

  it("validates configured JSON against the schema and does not invent data", async () => {
    const schema = z.object({ ok: z.boolean() });
    const client = createMockLlmClient({ jsonValue: { ok: true } });
    const result = await client.json(schema, [{ role: "user", content: "json" }]);
    expect(result.data).toEqual({ ok: true });

    const empty = createMockLlmClient();
    await expect(
      empty.json(schema, [{ role: "user", content: "json" }]),
    ).rejects.toBeInstanceOf(LlmInvalidJsonError);
  });
});

describe("createLlmClient", () => {
  it("fails closed without a key unless a mock is explicitly allowed", () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;

    expect(() => createLlmClient()).toThrow(LlmMissingApiKeyError);
    expect(createLlmClient({ allowMockIfUnconfigured: true }).provider).toBe(
      "mock",
    );

    if (previous === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});
