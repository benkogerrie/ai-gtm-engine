import { describe, expect, it } from "vitest";
import { hydrateStructuredIcp } from "@/lib/icp/infer";
import { buildMockIcpOutput } from "@/lib/icp/mock-output";
import { discoveryInputFromIcp } from "./adapter";

describe("discoveryInputFromIcp", () => {
  it("maps industries, NAICS, sizes, personas, and triggers from a structured ICP", () => {
    const structured = hydrateStructuredIcp(
      buildMockIcpOutput({
        name: "ShiftPilot",
        description: "AI shift scheduling for hospitals and clinics in the US",
      }),
    );
    structured.targetIndustries[0] = {
      ...structured.targetIndustries[0]!,
      name: "General Medical and Surgical Hospitals",
      naics: "622110",
      naicsValidation: {
        formatValid: true,
        known: true,
        label: "General Medical and Surgical Hospitals",
      },
    };

    const input = discoveryInputFromIcp({
      icpId: "11111111-1111-4111-8111-111111111111",
      productSummary:
        "AI shift scheduling for hospitals and clinics in the United States",
      structured,
    });

    expect(input.icpId).toBe("11111111-1111-4111-8111-111111111111");
    expect(input.industries[0]).toMatch(/Hospitals/);
    expect(input.industries[0]).toMatch(/622110/);
    expect(input.geographies).toEqual(["United States"]);
    expect(input.personas?.length).toBeGreaterThan(0);
    expect(input.triggers?.length).toBeGreaterThan(0);
    expect(input.companySizes?.length).toBeGreaterThan(0);
  });
});
