import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("next/server", () => ({
  connection: async () => undefined,
}));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/llm/health", () => {
  it("reports unconfigured status and default model without calling a provider", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.LLM_MODEL;

    const response = await GET();
    const body = (await response.json()) as {
      configured: boolean;
      model: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      configured: false,
      model: "deepseek-chat",
    });
  });

  it("reports configured true and the env model without exposing the key", async () => {
    const secret = "sk-test-not-a-real-key";
    process.env.DEEPSEEK_API_KEY = secret;
    process.env.LLM_MODEL = "deepseek-flash";

    const response = await GET();
    const raw = await response.text();
    const body = JSON.parse(raw) as { configured: boolean; model: string };

    expect(body).toEqual({
      configured: true,
      model: "deepseek-flash",
    });
    expect(raw).not.toContain(secret);
    expect(body).not.toHaveProperty("apiKey");
  });
});
