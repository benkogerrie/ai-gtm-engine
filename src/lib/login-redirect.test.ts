import { describe, expect, it } from "vitest";
import { safeLoginRedirect } from "./login-redirect";

describe("safeLoginRedirect", () => {
  it("allows the intake and ICP review paths", () => {
    expect(safeLoginRedirect("/intake")).toBe("/intake");
    expect(safeLoginRedirect("/intake/")).toBe("/intake/");
    expect(safeLoginRedirect("/icp/11111111-1111-4111-8111-111111111111")).toBe(
      "/icp/11111111-1111-4111-8111-111111111111",
    );
    expect(
      safeLoginRedirect("/icp/11111111-1111-4111-8111-111111111111?tab=exp"),
    ).toBe("/icp/11111111-1111-4111-8111-111111111111?tab=exp");
  });

  it("allows prospects, outreach, dashboard, pipeline, graph, and ICP index paths", () => {
    expect(safeLoginRedirect("/prospects")).toBe("/prospects");
    expect(
      safeLoginRedirect("/prospects?icp=11111111-1111-4111-8111-111111111111&runId=9c1d74d6"),
    ).toBe("/prospects?icp=11111111-1111-4111-8111-111111111111&runId=9c1d74d6");
    expect(safeLoginRedirect("/outreach")).toBe("/outreach");
    expect(
      safeLoginRedirect("/outreach/11111111-1111-4111-8111-111111111111"),
    ).toBe("/outreach/11111111-1111-4111-8111-111111111111");
    expect(
      safeLoginRedirect("/outreach/new?companyId=11111111-1111-4111-8111-111111111111"),
    ).toBe("/outreach/new?companyId=11111111-1111-4111-8111-111111111111");
    expect(safeLoginRedirect("/dashboard")).toBe("/dashboard");
    expect(
      safeLoginRedirect("/dashboard?icp=11111111-1111-4111-8111-111111111111"),
    ).toBe("/dashboard?icp=11111111-1111-4111-8111-111111111111");
    expect(safeLoginRedirect("/pipeline")).toBe("/pipeline");
    expect(
      safeLoginRedirect("/pipeline?icp=11111111-1111-4111-8111-111111111111"),
    ).toBe("/pipeline?icp=11111111-1111-4111-8111-111111111111");
    expect(safeLoginRedirect("/graph")).toBe("/graph");
    expect(
      safeLoginRedirect("/graph?icp=11111111-1111-4111-8111-111111111111&run=9c1d74d6"),
    ).toBe("/graph?icp=11111111-1111-4111-8111-111111111111&run=9c1d74d6");
    expect(safeLoginRedirect("/icp")).toBe("/icp");
  });

  it("falls back for missing or non-allowlisted targets", () => {
    expect(safeLoginRedirect(undefined)).toBe("/intake");
    expect(safeLoginRedirect("")).toBe("/intake");
    expect(safeLoginRedirect("/")).toBe("/intake");
    expect(safeLoginRedirect("/login")).toBe("/intake");
    expect(safeLoginRedirect("intake")).toBe("/intake");
    expect(safeLoginRedirect("/prospects-evil")).toBe("/intake");
    expect(safeLoginRedirect("/outreach-evil")).toBe("/intake");
    expect(safeLoginRedirect("/dashboard-evil")).toBe("/intake");
    expect(safeLoginRedirect("/pipeline-evil")).toBe("/intake");
    expect(safeLoginRedirect("/graph-evil")).toBe("/intake");
    expect(safeLoginRedirect("/icp-evil")).toBe("/intake");
  });

  it("rejects protocol-relative, schemes, backslashes, and control chars", () => {
    expect(safeLoginRedirect("//evil.example")).toBe("/intake");
    expect(safeLoginRedirect("/\\evil.example")).toBe("/intake");
    expect(safeLoginRedirect("https://evil.example")).toBe("/intake");
    expect(safeLoginRedirect("http://evil.example/intake")).toBe("/intake");
    expect(safeLoginRedirect("javascript:alert(1)")).toBe("/intake");
    expect(safeLoginRedirect("/intake\u0000")).toBe("/intake");
    expect(safeLoginRedirect("/intake\n/extra")).toBe("/intake");
  });

  it("rejects encoded // and backslash variants", () => {
    expect(safeLoginRedirect("%2F%2Fevil.example")).toBe("/intake");
    expect(safeLoginRedirect("/%2F%2Fevil.example")).toBe("/intake");
    expect(safeLoginRedirect("/%2f%2fevil.example")).toBe("/intake");
    expect(safeLoginRedirect("/%5Cevil.example")).toBe("/intake");
    expect(safeLoginRedirect("/%5cevil.example")).toBe("/intake");
    expect(safeLoginRedirect("/intake%2F%2Fevil.example")).toBe("/intake");
  });
});
