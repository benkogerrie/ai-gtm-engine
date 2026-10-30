import { describe, expect, it } from "vitest";
import { isOutsideIcpGeography } from "./geography";

describe("isOutsideIcpGeography", () => {
  it("drops a Korean hospital from a US-only ICP and keeps US systems", () => {
    expect(
      isOutsideIcpGeography(
        { name: "Inha University Hospital", domain: "inha.ac.kr", whyFit: "Seoul staffing" },
        ["United States"],
      ),
    ).toBe(true);
    expect(
      isOutsideIcpGeography(
        { name: "HCA Healthcare", domain: "hcahealthcare.com", whyFit: "US nurse scheduling" },
        ["United States"],
      ),
    ).toBe(false);
  });

  it("does not apply the US reject list when the ICP is not US-only", () => {
    expect(
      isOutsideIcpGeography(
        { name: "Inha University Hospital", domain: "inha.ac.kr" },
        ["South Korea"],
      ),
    ).toBe(false);
  });
});
