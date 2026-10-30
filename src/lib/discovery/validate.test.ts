import { describe, expect, it } from "vitest";
import type { SearchResult } from "@/lib/search/types";
import { validateCandidates } from "./validate";
import type { DiscoveryCandidate } from "./types";

function result(url: string): SearchResult {
  return {
    title: "Acme",
    url,
    snippet: "Acme sells HRIS.",
    source: "brave",
    retrievedAt: new Date(0).toISOString(),
  };
}

function candidate(
  overrides: Partial<DiscoveryCandidate> = {},
): DiscoveryCandidate {
  return {
    name: "Acme",
    domain: "acme.com",
    whyFit: "HRIS for mid-market",
    signals: [],
    claims: [
      {
        field: "name",
        value: "Acme",
        sourceUrl: "https://acme.com/about",
        quote: "Acme sells HRIS.",
      },
    ],
    ...overrides,
  };
}

describe("validateCandidates", () => {
  it("rejects claims whose URL is not in the result set", () => {
    const { kept, rejectedClaimCount, droppedCompanyCount } = validateCandidates(
      [
        candidate({
          claims: [
            {
              field: "name",
              value: "Acme",
              sourceUrl: "https://not-in-results.example/about",
              quote: "invented",
            },
          ],
        }),
      ],
      [result("https://acme.com/about")],
    );

    expect(rejectedClaimCount).toBe(1);
    expect(droppedCompanyCount).toBe(1);
    expect(kept).toEqual([]);
  });

  it("keeps claims that match a result URL after normalization", () => {
    const { kept, rejectedClaimCount } = validateCandidates(
      [candidate()],
      [result("https://acme.com/about/")],
    );
    expect(rejectedClaimCount).toBe(0);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.claims[0]?.sourceUrl).toBe("https://acme.com/about");
  });

  it("drops a company when every claim is unsupported", () => {
    const { kept, droppedCompanyCount } = validateCandidates(
      [
        candidate({
          claims: [
            {
              field: "name",
              value: "Ghost Co",
              sourceUrl: "https://ghost.example",
              quote: "nope",
            },
          ],
        }),
      ],
      [result("https://acme.com/about")],
    );
    expect(kept).toEqual([]);
    expect(droppedCompanyCount).toBe(1);
  });
});
