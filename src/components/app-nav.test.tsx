import { describe, expect, it } from "vitest";
import { APP_NAV_LINKS, isAppNavActive } from "./app-nav";

describe("APP_NAV_LINKS", () => {
  it("lists the judge flow with Pipeline then Graph at the end", () => {
    expect(APP_NAV_LINKS.map((link) => link.label)).toEqual([
      "Intake",
      "ICP",
      "Prospects",
      "Outreach",
      "Dashboard",
      "Pipeline",
      "Graph",
    ]);
    expect(APP_NAV_LINKS.map((link) => link.href)).toEqual([
      "/intake",
      "/icp",
      "/prospects",
      "/outreach",
      "/dashboard",
      "/pipeline",
      "/graph",
    ]);
  });
});

describe("isAppNavActive", () => {
  it("highlights Dashboard on /dashboard and nested dashboard paths", () => {
    expect(isAppNavActive("/dashboard", "/dashboard")).toBe(true);
    expect(isAppNavActive("/dashboard/extra", "/dashboard")).toBe(true);
  });

  it("does not treat other flow routes as Dashboard", () => {
    expect(isAppNavActive("/intake", "/dashboard")).toBe(false);
    expect(isAppNavActive("/icp", "/dashboard")).toBe(false);
    expect(isAppNavActive("/", "/dashboard")).toBe(false);
    expect(isAppNavActive("/pipeline", "/dashboard")).toBe(false);
    expect(isAppNavActive("/graph", "/dashboard")).toBe(false);
  });

  it("highlights Pipeline on /pipeline and nested pipeline paths", () => {
    expect(isAppNavActive("/pipeline", "/pipeline")).toBe(true);
    expect(isAppNavActive("/pipeline/extra", "/pipeline")).toBe(true);
    expect(isAppNavActive("/dashboard", "/pipeline")).toBe(false);
    expect(isAppNavActive("/graph", "/pipeline")).toBe(false);
  });

  it("highlights Graph on /graph and nested graph paths", () => {
    expect(isAppNavActive("/graph", "/graph")).toBe(true);
    expect(isAppNavActive("/graph/extra", "/graph")).toBe(true);
    expect(isAppNavActive("/dashboard", "/graph")).toBe(false);
    expect(isAppNavActive("/pipeline", "/graph")).toBe(false);
  });

  it("keeps sibling flow tabs isolated", () => {
    expect(isAppNavActive("/icp/abc", "/icp")).toBe(true);
    expect(isAppNavActive("/icp", "/intake")).toBe(false);
    expect(isAppNavActive("/outreach/new", "/outreach")).toBe(true);
    expect(isAppNavActive("/graph", "/graph")).toBe(true);
    expect(isAppNavActive("/graph", "/dashboard")).toBe(false);
  });
});
