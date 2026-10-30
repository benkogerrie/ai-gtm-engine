import { describe, expect, it } from "vitest";
import {
  isRealSearchEvidence,
  toCitationCandidate,
} from "./evidence";
import { SearchSyntheticEvidenceError } from "./errors";
import { createMockSearchClient } from "./mock";
import type { SearchResult } from "./types";

function braveHit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    title: "Acme ICP notes",
    url: "https://example.com/icp",
    snippet: "A public write-up of the ICP.",
    source: "brave",
    retrievedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("isRealSearchEvidence", () => {
  it("rejects mock results", async () => {
    const [mockHit] = await createMockSearchClient().search("guard");
    expect(mockHit).toBeDefined();
    expect(isRealSearchEvidence(mockHit!)).toBe(false);
  });

  it("accepts Brave results", () => {
    const result = braveHit();
    expect(result.source).toBe("brave");
    expect(isRealSearchEvidence(result)).toBe(true);
  });
});

describe("toCitationCandidate", () => {
  it("rejects mock results so they cannot become citations", async () => {
    const [mockHit] = await createMockSearchClient().search("citation");
    expect(mockHit).toBeDefined();
    expect(() => toCitationCandidate(mockHit!)).toThrow(
      SearchSyntheticEvidenceError,
    );
  });

  it("keeps Brave results as citation candidates", () => {
    const result = braveHit({ publishedAt: "2026-01-15T00:00:00.000Z" });
    const candidate = toCitationCandidate(result);
    expect(candidate.source).toBe("brave");
    expect(candidate).toEqual(result);
  });
});
