import { describe, expect, it } from "vitest";
import { normalizeLlmProspects } from "./normalize";

describe("normalizeLlmProspects", () => {
  it("rewrites article titles to organization names and maps aliases", () => {
    const normalized = normalizeLlmProspects({
      organizations: [
        {
          organization: "Ochsner Health announces system-wide launch of M7",
          website: "https://news.ochsner.org/release",
          classification: "customer",
          why_fit: "<strong>Ochsner</strong> launch",
          score: 81,
          reason: "Cited press release about nurse scheduling",
          claims: [
            {
              field: "name",
              value: "Ochsner Health announces system-wide launch of M7",
              url: "https://news.ochsner.org/release",
              snippet: "Ochsner Health announces system-wide launch",
            },
          ],
        },
      ],
    }) as { companies: Array<{ name: string; domain: string; role: string }> };

    expect(normalized.companies[0]?.name).toBe("Ochsner Health");
    expect(normalized.companies[0]?.domain).toBe("ochsner.org");
    expect(normalized.companies[0]?.role).toBe("buyer");
  });
});
