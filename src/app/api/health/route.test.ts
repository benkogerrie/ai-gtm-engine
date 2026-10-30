import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/health", () => {
  it("returns ok status, package version, and commit", async () => {
    process.env.GIT_COMMIT = "abc123def";

    const response = await GET();
    const body = (await response.json()) as {
      status: string;
      version: string;
      commit: string;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      status: "ok",
      version: "0.1.0",
      commit: "abc123def",
    });
  });

  it("falls back to commit 'dev' when no commit env is set", async () => {
    delete process.env.GIT_COMMIT;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GITHUB_SHA;

    const response = await GET();
    const body = (await response.json()) as { commit: string };

    expect(body.commit).toBe("dev");
  });
});
