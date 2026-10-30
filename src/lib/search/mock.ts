import type { SearchClient, SearchOptions, SearchResult } from "./types";

export type MockSearchClientOptions = {
  results?: SearchResult[];
  handler?: (
    query: string,
    options?: SearchOptions,
  ) => Promise<SearchResult[]> | SearchResult[];
};

const DEFAULT_RETRIEVED_AT = new Date(0).toISOString();

function asSynthetic(results: SearchResult[]): SearchResult[] {
  return results.map((result) => ({ ...result, source: "mock" }));
}

export class MockSearchClient implements SearchClient {
  readonly provider = "mock" as const;
  private readonly options: MockSearchClientOptions;

  constructor(options: MockSearchClientOptions = {}) {
    this.options = options;
  }

  async search(
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult[]> {
    if (this.options.handler) {
      return asSynthetic(await this.options.handler(query, options));
    }

    if (this.options.results) {
      return asSynthetic(this.options.results);
    }

    return [
      {
        title: `Mock result for ${query}`,
        url: "https://example.com/mock",
        snippet: "Synthetic search hit for keyless runs and unit tests.",
        source: "mock",
        retrievedAt: DEFAULT_RETRIEVED_AT,
      },
    ];
  }
}

export function createMockSearchClient(
  options: MockSearchClientOptions = {},
): MockSearchClient {
  return new MockSearchClient(options);
}
