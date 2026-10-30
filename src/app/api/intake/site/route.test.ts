// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockLlmClient } from "@/lib/llm";
import { readSite } from "@/lib/site-intake";
import { authHeaders, clearTestAuth, installTestAuth } from "@/lib/test-auth";
import { POST } from "./route";

const PUBLIC_IP = "93.184.216.34";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: PUBLIC_IP, family: 4 }]),
}));

const originalFetch = globalThis.fetch;

function html(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html", ...headers },
  });
}

describe("POST /api/intake/site", () => {
  beforeEach(() => {
    installTestAuth();
    delete process.env.DEEPSEEK_API_KEY;
  });

  afterEach(() => {
    clearTestAuth();
    globalThis.fetch = originalFetch;
  });

  it("returns 401 without auth", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/site", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects localhost before fetching", async () => {
    const fetchFn = vi.fn();
    globalThis.fetch = fetchFn;
    const response = await POST(
      new Request("http://localhost/api/intake/site", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url: "https://localhost" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; details: { code: string } };
    expect(body.details.code).toBe("BLOCKED_HOST");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects non-https schemes", async () => {
    const response = await POST(
      new Request("http://localhost/api/intake/site", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url: "ftp://example.com" }),
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { details: { code: string } };
    expect(body.details.code).toBe("INVALID_URL");
  });

  it("returns mock-labeled fields when DeepSeek is unset", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://example.com/") {
        return html(`
          <html>
            <title>ShiftPilot</title>
            <body>
              <p>AI shift scheduling for hospitals and clinics that need nurse coverage.</p>
              <a href="/about">About</a>
            </body>
          </html>
        `);
      }
      if (url === "https://example.com/about") {
        return html("<html><title>About</title><p>We build rostering tools.</p></html>");
      }
      throw new Error(`unexpected ${url}`);
    });

    const response = await POST(
      new Request("http://localhost/api/intake/site", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      pages: string[];
      suggested: { name: string; freeText: string };
    };
    expect(body.mode).toBe("mock");
    expect(body.pages[0]).toBe("https://example.com/");
    expect(body.suggested.name).toBe("ShiftPilot");
    expect(body.suggested.freeText).toContain("Website:");
  });
});

describe("readSite with mocked fetch + mock LLM", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns inferred fields and the pages it read", async () => {
    const fetchFn = vi.fn(async (input: string) => {
      if (input === "https://example.com/") {
        return html(`
          <html>
            <title>ShiftPilot</title>
            <body>
              <p>AI shift scheduling for hospitals and clinics that need nurse coverage.</p>
              <a href="/about">About</a>
            </body>
          </html>
        `);
      }
      if (input === "https://example.com/about") {
        return html("<html><title>About</title><p>We build rostering tools.</p></html>");
      }
      throw new Error(`unexpected ${input}`);
    });

    const result = await readSite("example.com", {
      fetchFn,
      lookupFn: async () => [{ address: PUBLIC_IP, family: 4 }],
      llm: createMockLlmClient({
        jsonValue: {
          name: "ShiftPilot",
          description: "AI shift scheduling for hospitals and clinics",
          targetCustomer: "Hospital operations leads",
          problem: null,
          offering: null,
          features: ["shift scheduling"],
          capabilities: null,
          technicalConstraints: null,
          existingCustomers: null,
          referenceWins: null,
          pricingModel: null,
          contractValueMin: null,
          contractValueMax: null,
          monetizationModel: null,
          freeText: null,
        },
      }),
    });

    expect(result.mode).toBe("mock");
    expect(result.pages).toEqual([
      "https://example.com/",
      "https://example.com/about",
    ]);
    expect(result.suggested.name).toBe("ShiftPilot");
    expect(result.suggested.features).toBe("shift scheduling");
    expect(result.suggested.freeText).toContain("Website: https://example.com/");
    expect(result.suggested.pricingModel).toBe("");
    expect(fetchFn).toHaveBeenCalled();
  });

  it("rejects a redirect hop to a private address", async () => {
    await expect(
      readSite("https://example.com", {
        lookupFn: async () => [{ address: PUBLIC_IP, family: 4 }],
        fetchFn: async () => html("", 302, { location: "https://10.0.0.2/" }),
        llm: createMockLlmClient({ jsonValue: {} }),
      }),
    ).rejects.toMatchObject({ code: "BLOCKED_HOST" });
  });
});
