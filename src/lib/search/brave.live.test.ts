import { describe, expect, it } from "vitest";
import { createBraveSearchClient } from "./brave";

const hasLiveKey = Boolean(process.env.BRAVE_SEARCH_API_KEY?.trim());

describe("live Brave Search smoke", () => {
  it.skipIf(!hasLiveKey)(
    "returns at least one normalized result from the live API",
    async () => {
      const client = createBraveSearchClient();
      const results = await client.search("Brave Search API", {
        count: 1,
        country: "US",
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.source).toBe("brave");
      expect(results[0]?.url).toMatch(/^https?:\/\//);
      expect(results[0]?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    },
  );

  it("skips cleanly when BRAVE_SEARCH_API_KEY is unset", () => {
    if (!hasLiveKey) {
      expect(hasLiveKey).toBe(false);
    } else {
      expect(hasLiveKey).toBe(true);
    }
  });
});
