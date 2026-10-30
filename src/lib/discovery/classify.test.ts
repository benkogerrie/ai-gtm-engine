import { describe, expect, it } from "vitest";
import {
  classifyCandidate,
  collectVendors,
  filterBuyers,
  isCredibleCompetitorCitation,
  vendorsToCompetitorCategory,
} from "./classify";
import type { DiscoveryCandidate } from "./types";

function candidate(
  overrides: Partial<DiscoveryCandidate> & Pick<DiscoveryCandidate, "name">,
): DiscoveryCandidate {
  return {
    domain: "",
    whyFit: "cited signal",
    signals: [],
    claims: [
      {
        field: "name",
        value: overrides.name,
        sourceUrl: "https://news.ochsner.org/release",
        quote: "Ochsner Health announces a system-wide scheduling launch",
      },
    ],
    ...overrides,
  };
}

describe("buyer / vendor / media classification", () => {
  it("keeps hospitals as buyers and drops vendors plus media", () => {
    const ochsner = candidate({
      name: "Ochsner Health",
      domain: "ochsner.org",
    });
    const uchealth = candidate({
      name: "UCHealth",
      domain: "uchealth.org",
      claims: [
        {
          field: "name",
          value: "UCHealth",
          sourceUrl: "https://www.uchealth.org/today/scheduling",
          quote: "UCHealth is making nurse scheduling more flexible",
        },
      ],
    });
    const symplr = candidate({
      name: "symplr",
      domain: "symplr.com",
      claims: [
        {
          field: "name",
          value: "symplr",
          sourceUrl: "https://www.symplr.com/blog/ai-scheduling",
          quote: "symplr launches AI-powered nurse scheduling software",
        },
      ],
    });
    const pubmed = candidate({
      name: "Perceived Adequacy of Staffing",
      domain: "",
      claims: [
        {
          field: "name",
          value: "Perceived Adequacy of Staffing",
          sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/12345",
          quote: "A completed survey measuring staffing",
        },
      ],
    });
    const wire = candidate({
      name: "PR Newswire",
      domain: "prnewswire.com",
      claims: [
        {
          field: "name",
          value: "PR Newswire",
          sourceUrl: "https://www.prnewswire.com/news-releases/example",
          quote: "Vendor announces a product",
        },
      ],
    });

    const all = [ochsner, uchealth, symplr, pubmed, wire];
    expect(all.map(classifyCandidate)).toEqual([
      "buyer",
      "buyer",
      "vendor_competitor",
      "media_research",
      "media_research",
    ]);
    expect(filterBuyers(all).map((item) => item.name)).toEqual([
      "Ochsner Health",
      "UCHealth",
    ]);
    expect(collectVendors(all).map((item) => item.name)).toEqual(["symplr"]);
  });

  it("trusts an explicit LLM role", () => {
    expect(
      classifyCandidate(
        candidate({
          name: "ShiftMed",
          domain: "shiftmed.com",
          role: "vendor_competitor",
        }),
      ),
    ).toBe("vendor_competitor");
  });

  it("routes vendors into a competitor category with a real citation", () => {
    const vendors = collectVendors([
      candidate({
        name: "M7 Health",
        domain: "m7health.com",
        role: "vendor_competitor",
        claims: [
          {
            field: "name",
            value: "M7 Health",
            sourceUrl: "https://m7health.com/news",
            quote: "M7 Health workforce management platform",
          },
        ],
      }),
    ]);
    const category = vendorsToCompetitorCategory(vendors);
    expect(category?.examples).toContain("M7 Health");
    expect(category?.sourceUrl).toBe("https://m7health.com/news");
  });

  it("drops junk competitor citations", () => {
    expect(
      isCredibleCompetitorCitation({
        sourceUrl: "https://wpauthorbox.com/plugin",
        quote: "author box",
        category: "Enterprise workforce platforms",
      }),
    ).toBe(false);
    expect(
      isCredibleCompetitorCitation({
        sourceUrl: "https://simplescheduleai.com/",
        quote: "AI scheduling",
        category: "Scheduling tools",
      }),
    ).toBe(false);
    expect(
      isCredibleCompetitorCitation({
        sourceUrl: "https://www.ukg.com/products/workforce-management",
        quote: "UKG workforce management for hospital nurse scheduling",
        category: "Enterprise workforce platforms",
      }),
    ).toBe(true);
  });
});
