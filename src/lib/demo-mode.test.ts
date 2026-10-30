import { afterEach, describe, expect, it } from "vitest";
import { DEMO_ACTOR_ID, DEMO_FALLBACK_ORG_ID, readDemoAuth, resolvePublicDemoMode } from "./demo-mode";
import { clearTestAuth } from "./test-auth";

describe("resolvePublicDemoMode", () => {
  it("defaults on for Vercel preview when unset", () => {
    expect(
      resolvePublicDemoMode({ VERCEL_ENV: "preview", NODE_ENV: "production" }),
    ).toBe(true);
  });

  it("stays off in tests and production unless explicitly enabled", () => {
    expect(resolvePublicDemoMode({ NODE_ENV: "test" })).toBe(false);
    expect(
      resolvePublicDemoMode({ VERCEL_ENV: "production", NODE_ENV: "production" }),
    ).toBe(false);
    expect(
      resolvePublicDemoMode({
        PUBLIC_DEMO_MODE: "false",
        VERCEL_ENV: "preview",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });

  it("turns on when PUBLIC_DEMO_MODE is true", () => {
    expect(
      resolvePublicDemoMode({ PUBLIC_DEMO_MODE: "true", NODE_ENV: "test" }),
    ).toBe(true);
  });
});

describe("readDemoAuth", () => {
  afterEach(() => {
    clearTestAuth();
  });

  it("maps to the server org and a human demo actor, ignoring nothing from the caller", () => {
    process.env.PUBLIC_DEMO_MODE = "true";
    process.env.APP_ORG_ID = "11111111-1111-4111-8111-111111111111";
    process.env.APP_ACTOR_ID = "preview-actor";
    expect(readDemoAuth()).toEqual({
      orgId: "11111111-1111-4111-8111-111111111111",
      actor: { actorType: "human", actorId: "preview-actor" },
    });
  });

  it("falls back to the server demo org when APP_ORG_ID is unset", () => {
    process.env.PUBLIC_DEMO_MODE = "true";
    delete process.env.APP_ORG_ID;
    expect(readDemoAuth()).toEqual({
      orgId: DEMO_FALLBACK_ORG_ID,
      actor: { actorType: "human", actorId: DEMO_ACTOR_ID },
    });
  });

  it("returns null when demo mode is off", () => {
    process.env.PUBLIC_DEMO_MODE = "false";
    process.env.APP_ORG_ID = "11111111-1111-4111-8111-111111111111";
    expect(readDemoAuth()).toBeNull();
  });
});
