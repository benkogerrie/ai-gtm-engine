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

  it("falls back for missing or non-allowlisted targets", () => {
    expect(safeLoginRedirect(undefined)).toBe("/intake");
    expect(safeLoginRedirect("")).toBe("/intake");
    expect(safeLoginRedirect("/")).toBe("/intake");
    expect(safeLoginRedirect("/login")).toBe("/intake");
    expect(safeLoginRedirect("intake")).toBe("/intake");
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
