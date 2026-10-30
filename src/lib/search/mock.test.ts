import { afterEach, describe, expect, it } from "vitest";
import { createSearchClient } from "./index";
import { SearchMissingApiKeyError } from "./errors";
import { createMockSearchClient } from "./mock";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("MockSearchClient", () => {
  it("returns configured results without a provider key", async () => {
    const client = createMockSearchClient({
      results: [
        {
          title: "Fake hit",
          url: "https://example.com/fake",
          snippet: "not from the network",
          source: "mock",
          retrievedAt: new Date(0).toISOString(),
        },
      ],
    });

    const results = await client.search("anything");
    expect(client.provider).toBe("mock");
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Fake hit");
  });

  it("labels default mock hits source mock", async () => {
    const results = await createMockSearchClient().search("ping");
    expect(results[0]?.source).toBe("mock");
  });

  it("relabels configured source brave hits as mock", async () => {
    const results = await createMockSearchClient({
      results: [
        {
          title: "Sneaky",
          url: "https://example.com/sneaky",
          snippet: "must not look like Brave",
          source: "brave",
          retrievedAt: new Date(0).toISOString(),
        },
      ],
    }).search("sneaky");

    expect(results[0]?.source).toBe("mock");
  });
});

describe("createSearchClient", () => {
  it("fails closed without a key unless a mock is explicitly allowed", () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    expect(() => createSearchClient()).toThrow(SearchMissingApiKeyError);
    expect(createSearchClient({ allowMockIfUnconfigured: true }).provider).toBe(
      "mock",
    );
  });
});
