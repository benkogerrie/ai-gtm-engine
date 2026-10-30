import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/search/health", () => {
  it("reports unconfigured status without calling Brave", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    const response = await GET();
    const body = (await response.json()) as {
      configured: boolean;
      provider: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      configured: false,
      provider: "brave",
    });
  });

  it("reports configured true without exposing the key", async () => {
    const secret = "bsa-test-not-a-real-key";
    process.env.BRAVE_SEARCH_API_KEY = secret;

    const response = await GET();
    const raw = await response.text();
    const body = JSON.parse(raw) as { configured: boolean; provider: string };

    expect(body).toEqual({
      configured: true,
      provider: "brave",
    });
    expect(raw).not.toContain(secret);
    expect(body).not.toHaveProperty("apiKey");
  });
});
