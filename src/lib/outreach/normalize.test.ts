import { describe, expect, it } from "vitest";
import { llmOutreachDraftSchema } from "./schema";
import {
  llmOutreachDraftNormalizedSchema,
  normalizeOutreachLlmOutput,
} from "./normalize";

const messy = {
  email_subject: "  Hello team  ",
  body: "We saw the TEST role on the cited page.",
  linkedin: "Quick MOCK note",
  Tone: "Professional",
  CTA: "Book a Call",
  cited_signal_ids: ["sig-1"],
  sources: ["https://example.com"],
};

describe("normalizeOutreachLlmOutput", () => {
  it("rejects messy aliases before normalization", () => {
    expect(llmOutreachDraftSchema.safeParse(messy).success).toBe(false);
  });

  it("maps snake_case, extra spaces, and enum aliases", () => {
    const parsed = llmOutreachDraftNormalizedSchema.safeParse(messy);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw parsed.error;
    }
    expect(parsed.data).toMatchObject({
      emailSubject: "Hello team",
      emailBody: "We saw the TEST role on the cited page.",
      linkedinMessage: "Quick MOCK note",
      tone: "professional",
      cta: "book a call",
      citedSignalIds: ["sig-1"],
      sourceUrls: ["https://example.com"],
    });
  });

  it("does not invent required copy when aliases are missing", () => {
    const normalized = normalizeOutreachLlmOutput({
      tone: "friendly",
      cta: "reply",
    });
    expect(llmOutreachDraftSchema.safeParse(normalized).success).toBe(false);
  });

  it("accepts the filled prompt example object", () => {
    const example = {
      emailSubject: "TEST note after Example Co listed an operations role",
      emailBody: "Hello team at TEST — Example Co",
      linkedinMessage: "Saw TEST — Example Co's operations role on https://example.com.",
      tone: "professional",
      cta: "book a call",
      citedSignalIds: ["11111111-1111-4111-8111-111111111111"],
      sourceUrls: ["https://example.com"],
    };
    expect(llmOutreachDraftSchema.safeParse(example).success).toBe(true);
  });
});
