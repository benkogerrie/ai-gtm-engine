import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  getLlmConfig,
  getLlmHealth,
  isLlmConfigured,
} from "./config";
import { LlmMissingApiKeyError } from "./errors";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("LLM env config", () => {
  it("throws a typed missing-key error when DEEPSEEK_API_KEY is unset", () => {
    delete process.env.DEEPSEEK_API_KEY;

    expect(isLlmConfigured()).toBe(false);
    expect(() => getLlmConfig()).toThrow(LlmMissingApiKeyError);
    try {
      getLlmConfig();
    } catch (error) {
      expect(error).toBeInstanceOf(LlmMissingApiKeyError);
      expect((error as LlmMissingApiKeyError).code).toBe("MISSING_API_KEY");
    }
  });

  it("reads optional model, base URL, timeout, and max attempts from env", () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-not-a-real-key";
    process.env.LLM_MODEL = "deepseek-flash";
    process.env.LLM_BASE_URL = "https://api.deepseek.com/v1";
    process.env.LLM_TIMEOUT_MS = "12000";
    process.env.LLM_MAX_ATTEMPTS = "4";

    expect(getLlmConfig()).toEqual({
      apiKey: "sk-test-not-a-real-key",
      model: "deepseek-flash",
      baseUrl: "https://api.deepseek.com/v1",
      timeoutMs: 12_000,
      maxAttempts: 4,
    });
  });

  it("uses documented defaults when optional env vars are absent", () => {
    process.env.DEEPSEEK_API_KEY = "sk-test-not-a-real-key";
    delete process.env.LLM_MODEL;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_TIMEOUT_MS;
    delete process.env.LLM_MAX_ATTEMPTS;

    const config = getLlmConfig();
    expect(config.model).toBe(DEFAULT_LLM_MODEL);
    expect(config.baseUrl).toBe(DEFAULT_LLM_BASE_URL);
    expect(getLlmHealth()).toEqual({
      configured: true,
      model: DEFAULT_LLM_MODEL,
    });
  });
});
