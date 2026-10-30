import { afterEach, describe, expect, it } from "vitest";
import {
  DEMO_DAILY_LIMIT_MESSAGE,
  DEMO_HOURLY_LIMIT_MESSAGE,
  checkDemoRateLimit,
  enforceDemoRateLimit,
  resetDemoRateLimitStore,
} from "./demo-rate-limit";
import { clearTestAuth } from "./test-auth";

describe("demo rate limit", () => {
  afterEach(() => {
    resetDemoRateLimitStore();
    clearTestAuth();
  });

  it("allows up to the per-IP hourly cap and then returns a friendly error", () => {
    process.env.DEMO_MAX_PER_IP_PER_HOUR = "10";
    process.env.DEMO_MAX_RUNS_PER_DAY = "60";
    const now = Date.parse("2026-10-30T12:00:00.000Z");
    for (let i = 0; i < 10; i += 1) {
      expect(
        checkDemoRateLimit({ action: "discovery", ip: "203.0.113.9", now }),
      ).toEqual({ ok: true });
    }
    expect(
      checkDemoRateLimit({ action: "discovery", ip: "203.0.113.9", now }),
    ).toEqual({ ok: false, error: DEMO_HOURLY_LIMIT_MESSAGE });
  });

  it("enforces the global daily cap", () => {
    process.env.DEMO_MAX_PER_IP_PER_HOUR = "100";
    process.env.DEMO_MAX_RUNS_PER_DAY = "2";
    const now = Date.parse("2026-10-30T12:00:00.000Z");
    expect(
      checkDemoRateLimit({ action: "discovery", ip: "203.0.113.1", now }),
    ).toEqual({ ok: true });
    expect(
      checkDemoRateLimit({ action: "intake", ip: "203.0.113.2", now }),
    ).toEqual({ ok: true });
    expect(
      checkDemoRateLimit({ action: "outreach_draft", ip: "203.0.113.3", now }),
    ).toEqual({ ok: false, error: DEMO_DAILY_LIMIT_MESSAGE });
  });

  it("does not apply when public demo mode is off", () => {
    process.env.PUBLIC_DEMO_MODE = "false";
    process.env.DEMO_MAX_PER_IP_PER_HOUR = "1";
    process.env.DEMO_MAX_RUNS_PER_DAY = "1";
    expect(enforceDemoRateLimit("discovery", "203.0.113.9")).toEqual({
      ok: true,
    });
    expect(enforceDemoRateLimit("discovery", "203.0.113.9")).toEqual({
      ok: true,
    });
  });

  it("applies when public demo mode is on", () => {
    process.env.PUBLIC_DEMO_MODE = "true";
    process.env.DEMO_MAX_PER_IP_PER_HOUR = "1";
    process.env.DEMO_MAX_RUNS_PER_DAY = "60";
    expect(enforceDemoRateLimit("discovery", "203.0.113.9")).toEqual({
      ok: true,
    });
    expect(enforceDemoRateLimit("discovery", "203.0.113.9")).toEqual({
      ok: false,
      error: DEMO_HOURLY_LIMIT_MESSAGE,
    });
  });
});
