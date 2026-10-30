import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SEARCH_MIN_INTERVAL_MS,
  DEFAULT_SEARCH_PROVIDER,
  DEFAULT_SEARCH_TIMEOUT_MS,
  getSearchConfig,
  getSearchHealth,
  isSearchConfigured,
} from "./config";
import { SearchMissingApiKeyError } from "./errors";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("search env config", () => {
  it("throws a typed missing-key error when BRAVE_SEARCH_API_KEY is unset", () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    expect(isSearchConfigured()).toBe(false);
    expect(() => getSearchConfig()).toThrow(SearchMissingApiKeyError);
    try {
      getSearchConfig();
    } catch (error) {
      expect(error).toBeInstanceOf(SearchMissingApiKeyError);
      expect((error as SearchMissingApiKeyError).code).toBe("MISSING_API_KEY");
    }
  });

  it("reports health without exposing the key", () => {
    process.env.BRAVE_SEARCH_API_KEY = "bsa-test-not-a-real-key";

    expect(getSearchHealth()).toEqual({
      configured: true,
      provider: DEFAULT_SEARCH_PROVIDER,
    });
    expect(getSearchConfig().timeoutMs).toBe(DEFAULT_SEARCH_TIMEOUT_MS);
    expect(getSearchConfig().minIntervalMs).toBe(DEFAULT_SEARCH_MIN_INTERVAL_MS);
  });
});
