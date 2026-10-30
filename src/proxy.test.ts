import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { proxy } from "./proxy";

describe("proxy auth gate", () => {
  afterEach(() => {
    clearTestAuth();
  });

  it("redirects unauthenticated /outreach to /login", () => {
    installTestAuth();
    const response = proxy(new NextRequest("http://localhost/outreach"));
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Foutreach");
  });

  it("redirects unauthenticated /dashboard to /login", () => {
    installTestAuth();
    const response = proxy(new NextRequest("http://localhost/dashboard"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fdashboard");
  });

  it("redirects unauthenticated /pipeline to /login", () => {
    installTestAuth();
    const response = proxy(new NextRequest("http://localhost/pipeline"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fpipeline");
  });

  it("redirects unauthenticated /graph to /login", () => {
    installTestAuth();
    const response = proxy(new NextRequest("http://localhost/graph"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Fgraph");
  });

  it("allows app pages without a cookie in public demo mode", () => {
    process.env.PUBLIC_DEMO_MODE = "true";
    process.env.APP_ORG_ID = "11111111-1111-4111-8111-111111111111";
    const response = proxy(new NextRequest("http://localhost/intake"));
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("location")).toBeNull();
    const graph = proxy(new NextRequest("http://localhost/graph"));
    expect(graph.status).toBeLessThan(300);
    expect(graph.headers.get("location")).toBeNull();
  });

  it("redirects unauthenticated /outreach/[id] to /login", () => {
    installTestAuth();
    const response = proxy(
      new NextRequest(
        "http://localhost/outreach/11111111-1111-4111-8111-111111111111",
      ),
    );
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
  });
});
