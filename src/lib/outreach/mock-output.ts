import { SELLER_PRODUCT } from "./product";
import type { CitedSignal, LlmOutreachDraft, OutreachCta, OutreachTone } from "./schema";

function ctaLine(cta: OutreachCta): string {
  if (cta === "book a call") {
    return "Would you book a short call this week?";
  }
  if (cta === "reply") {
    return "Happy to hear if this is relevant — a short reply is enough.";
  }
  return "More detail is available if useful — no send happens from this draft.";
}

export function buildMockOutreachDraft(input: {
  companyName: string;
  tone: OutreachTone;
  cta: OutreachCta;
  cited: CitedSignal[];
}): LlmOutreachDraft {
  const first = input.cited[0];
  const url = first?.sourceUrls[0] ?? "https://example.com";
  const summary = first?.summary ?? "a cited TEST signal";
  const ask = ctaLine(input.cta);

  return {
    emailSubject: `TEST / MOCK ${SELLER_PRODUCT.name} note for ${input.companyName}`,
    emailBody: [
      `Hello team at ${input.companyName},`,
      "",
      `This is a labeled MOCK draft from ${SELLER_PRODUCT.name} (${SELLER_PRODUCT.description}, tone: ${input.tone}). I only reference the cited signal: ${summary} (${url}).`,
      "",
      ask,
      "",
      "This message is TEST/MOCK data and will never be sent.",
    ].join("\n"),
    linkedinMessage: `MOCK ${SELLER_PRODUCT.name}: saw ${summary} (${url}). ${ask}`,
    tone: input.tone,
    cta: input.cta,
    citedSignalIds: input.cited.map((signal) => signal.id),
    sourceUrls: [...new Set(input.cited.flatMap((signal) => signal.sourceUrls))],
  };
}
