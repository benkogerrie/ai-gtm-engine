import { describe, expect, it } from "vitest";
import {
  dedupeByDomain,
  isBlockedCompanyDomain,
  isRejectedSourceUrl,
} from "./filters";

describe("negative filters", () => {
  it("blocks aggregator, directory, and news-roundup company domains", () => {
    expect(isBlockedCompanyDomain("wikipedia.org")).toBe(true);
    expect(isBlockedCompanyDomain("https://www.linkedin.com/pulse/list")).toBe(
      true,
    );
    expect(isBlockedCompanyDomain("g2.com")).toBe(true);
    expect(isBlockedCompanyDomain("crunchbase.com")).toBe(true);
    expect(isBlockedCompanyDomain("techcrunch.com")).toBe(true);
  });

  it("blocks the seller's own domain via excludeDomains", () => {
    expect(isBlockedCompanyDomain("seller.io", ["seller.io"])).toBe(true);
    expect(isBlockedCompanyDomain("docs.seller.io", ["seller.io"])).toBe(true);
    expect(isBlockedCompanyDomain("rippling.com", ["seller.io"])).toBe(false);
  });

  it("rejects wikipedia / g2 / crunchbase listing URLs as claim sources", () => {
    expect(isRejectedSourceUrl("https://en.wikipedia.org/wiki/HRIS")).toBe(true);
    expect(isRejectedSourceUrl("https://www.g2.com/categories/hris")).toBe(true);
    expect(
      isRejectedSourceUrl("https://www.crunchbase.com/hub/hris-startups"),
    ).toBe(true);
    expect(isRejectedSourceUrl("https://rippling.com/blog/hris")).toBe(false);
  });
});

describe("dedupeByDomain", () => {
  it("dedupes www and bare hosts, keeping the first row", () => {
    const unique = dedupeByDomain([
      { domain: "www.Acme.com", name: "Acme" },
      { domain: "acme.com", name: "ACME Inc" },
      { domain: "other.dev", name: "Other" },
    ]);
    expect(unique.map((item) => item.domain)).toEqual(["acme.com", "other.dev"]);
    expect(unique[0]?.name).toBe("Acme");
  });
});
