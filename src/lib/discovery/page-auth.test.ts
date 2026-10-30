import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSessionValue } from "@/lib/auth";
import { TEST_AUTH, clearTestAuth, installTestAuth } from "@/lib/test-auth";

const { cookieValue } = vi.hoisted(() => ({
  cookieValue: { current: undefined as string | undefined },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE && cookieValue.current
        ? { value: cookieValue.current }
        : undefined,
  }),
}));

afterEach(() => {
  cookieValue.current = undefined;
  clearTestAuth();
});

describe("getDiscoveryPageAuth", () => {
  it("returns null without a session cookie", async () => {
    installTestAuth();
    const { getDiscoveryPageAuth } = await import("./page-auth");
    expect(await getDiscoveryPageAuth()).toBeNull();
  });

  it("maps a signed B003 session cookie to the configured org", async () => {
    installTestAuth();
    cookieValue.current = signSessionValue(TEST_AUTH.token);
    const { getDiscoveryPageAuth } = await import("./page-auth");
    const auth = await getDiscoveryPageAuth();
    expect(auth?.orgId).toBe(TEST_AUTH.orgId);
    expect(auth?.actor.actorType).toBe("human");
  });
});
