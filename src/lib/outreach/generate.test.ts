import { describe, expect, it } from "vitest";
import { groundDraft } from "./generate";
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
