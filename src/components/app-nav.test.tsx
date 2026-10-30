import { describe, expect, it } from "vitest";
import { isAppNavActive } from "./app-nav";

describe("isAppNavActive", () => {
  it("highlights Dashboard on /dashboard and nested dashboard paths", () => {
    expect(isAppNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isAppNavActive("/dashboard/extra", "/dashboard")).toBe(true);
  });

  it("does not treat other flow routes as Dashboard", () => {
    expect(isAppNavActive("/intake", "/dashboard")).toBe(false);
    expect(isAppNavActive("/icp", "/dashboard")).toBe(false);
    expect(isAppNavActive("/", "/dashboard")).toBe(false);
  });

  it("keeps sibling flow tabs isolated", () => {
    expect(isAppNavActive("/icp/abc", "/icp")).toBe(true);
    expect(isAppNavActive("/icp", "/intake")).toBe(false);
    expect(isAppNavActive("/outreach/new", "/outreach")).toBe(true);
  });
});
