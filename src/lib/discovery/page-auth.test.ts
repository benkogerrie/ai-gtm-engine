import { afterEach, describe, expect, it } from "vitest";
import { TEST_AUTH, clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { DISCOVERY_DEMO_ORG_ID, getDiscoveryPageAuth } from "./page-auth";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  clearTestAuth();
});

describe("getDiscoveryPageAuth", () => {
  it("uses APP_ORG_ID / APP_ACTOR_* when configured", () => {
    installTestAuth();
    const auth = getDiscoveryPageAuth();
    expect(auth.orgId).toBe(TEST_AUTH.orgId);
    expect(auth.actor.actorId).toBe(TEST_AUTH.actorId);
  });

  it("falls back to a demo org so /prospects stays usable without login", () => {
    delete process.env.APP_ORG_ID;
    const auth = getDiscoveryPageAuth();
    expect(auth.orgId).toBe(DISCOVERY_DEMO_ORG_ID);
    expect(auth.actor.actorId).toBe("discovery-page");
  });
});
