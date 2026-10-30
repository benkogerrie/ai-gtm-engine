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
