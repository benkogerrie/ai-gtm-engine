import { describe, expect, it } from "vitest";
import {
  brandFromDomain,
  dedupeByOrganization,
  extractOrganizationName,
  isLikelyArticleTitle,
  normalizeOrgKey,
} from "./names";

describe("extractOrganizationName", () => {
  it("takes the organization from an announce headline", () => {
    expect(
      extractOrganizationName(
        "Ochsner Health announces system-wide launch of M7's Workforce Management Platform to improve staffing efficiency",
        "news.ochsner.org",
      ),
    ).toBe("Ochsner Health");
  });

  it("uses the health-system brand when the title is a generic headline", () => {
    expect(
      extractOrganizationName(
        "Making scheduling easier, more flexible for RNs and managers",
        "uchealth.org",
      ),
    ).toBe("UCHealth");
  });

  it("extracts Mercy from a product-style headline on mercy.net", () => {
    expect(
      extractOrganizationName(
        "Mercy Flexible Scheduling for Nurse Work-Life Balance",
        "mercy.net",
      ),
    ).toBe("Mercy");
  });

  it("keeps a short org name that is not an article title", () => {
    expect(extractOrganizationName("HCA Healthcare", "hcahealthcare.com")).toBe(
      "HCA Healthcare",
    );
  });

  it("does not return the full article title as the company name", () => {
    const name = extractOrganizationName(
      "symplr Launches AI-Powered Nurse Scheduling to Move Healthcare Staffing from Reactive to Predictive",
      "symplr.com",
    );
    expect(name.toLowerCase()).toContain("symplr");
    expect(name.length).toBeLessThan(40);
    expect(isLikelyArticleTitle(name)).toBe(false);
  });
});

describe("brandFromDomain / org key", () => {
  it("maps news and magazine subdomains to the org brand", () => {
    expect(brandFromDomain("news.ochsner.org")).toBe("Ochsner Health");
    expect(brandFromDomain("magazine.uchealth.org")).toBe("UCHealth");
  });

  it("dedupes the same organization across article hosts", () => {
    const unique = dedupeByOrganization([
      { name: "Ochsner Health", domain: "ochsner.org" },
      { name: "Ochsner", domain: "news.ochsner.org" },
      { name: "UCHealth", domain: "uchealth.org" },
    ]);
    expect(unique.map((item) => item.name)).toEqual(["Ochsner Health", "UCHealth"]);
  });

  it("normalizes org keys without legal suffixes", () => {
    expect(normalizeOrgKey("Ochsner Health")).toBe(normalizeOrgKey("Ochsner"));
  });
});
