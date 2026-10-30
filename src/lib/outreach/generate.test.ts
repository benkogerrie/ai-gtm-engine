import { afterEach, describe, expect, it } from "vitest";
import { LlmMissingApiKeyError } from "@/lib/llm";
import { createOutreachLlmClient, groundDraft, isTestProspect } from "./generate";
import type { CitedSignal } from "./schema";

const cited: CitedSignal[] = [
  {
    id: "sig-1",
    kind: "signal",
    type: "JOB_POSTING",
    summary: "TEST role",
    sourceUrls: ["https://example.com"],
    quotes: [],
  },
];

describe("isTestProspect / createOutreachLlmClient", () => {
  const previousKey = process.env.DEEPSEEK_API_KEY;

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousKey;
    }
  });

  it("treats TEST hospitals as demo and real buyers as live-only", () => {
    expect(
      isTestProspect({
        companyName: "TEST — Example General Hospital",
        companyDomain: "example.com",
      }),
    ).toBe(true);
    expect(
      isTestProspect({
        companyName: "Ochsner Health",
        companyDomain: "ochsner.org",
      }),
    ).toBe(false);
  });

  it("refuses a mock client when live DeepSeek is required", () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(() => createOutreachLlmClient({ requireLive: true })).toThrow(
      LlmMissingApiKeyError,
    );
  });

  it("still returns a mock client for labeled TEST prospects", () => {
    delete process.env.DEEPSEEK_API_KEY;
    const created = createOutreachLlmClient({ requireLive: false });
    expect(created.mode).toBe("mock");
    expect(created.client.provider).toBe("mock");
  });
});

describe("groundDraft", () => {
  it("drops invented URLs and signal ids, then falls back to cited ones", () => {
    const grounded = groundDraft(
      {
        emailSubject: "Hi",
        emailBody: "Body",
        linkedinMessage: "Li",
        citedSignalIds: ["invented"],
        sourceUrls: ["https://not-real.example"],
      },
      cited,
      { tone: "direct", cta: "reply" },
    );
    expect(grounded.sourceUrls).toEqual(["https://example.com"]);
    expect(grounded.citedSignalIds).toEqual(["sig-1"]);
    expect(grounded.tone).toBe("direct");
    expect(grounded.cta).toBe("reply");
  });
});
