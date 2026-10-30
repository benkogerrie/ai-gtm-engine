import { isLabeledDemo } from "../meta";
import { SELLER_PRODUCT } from "../product";
import type { CitedSignal, OutreachCta, OutreachTone } from "../schema";

export const OUTREACH_PROMPT_VERSION = "v1";

export const OUTREACH_JSON_EXAMPLE = `{
  "emailSubject": "Nurse scheduling note after Ochsner listed a night-shift role",
  "emailBody": "Hello team at Ochsner Health,\\n\\nI noticed the nurse staffing / night-shift scheduling role on the cited source URL. ShiftPilot is AI shift scheduling for hospitals — we help staffing teams cut overtime.\\n\\nWould you book a short call this week?\\n\\n— ShiftPilot",
  "linkedinMessage": "Saw Ochsner Health's night-shift scheduling role on the cited URL. Open to a brief chat about ShiftPilot?",
  "tone": "professional",
  "cta": "book a call",
  "citedSignalIds": ["11111111-1111-4111-8111-111111111111"],
  "sourceUrls": ["https://news.ochsner.org/news-releases/example"]
}`;

export const OUTREACH_SYSTEM_PROMPT = `You write a short, signal-grounded B2B outreach draft for ${SELLER_PRODUCT.name} (${SELLER_PRODUCT.description}).

Return a single JSON object that matches this exact shape. Do not wrap it in markdown. Do not rename fields.

Required JSON shape (filled example — copy these keys and enum values literally):
${OUTREACH_JSON_EXAMPLE}

Field rules:
- emailSubject, emailBody, and linkedinMessage are required non-empty strings.
- tone is exactly one of: "professional" | "friendly" | "direct" (lowercase literals).
- cta is exactly one of: "book a call" | "reply" | "learn more" (lowercase literals with spaces).
- citedSignalIds must be a subset of the signal ids provided in the user message. Do not invent ids.
- sourceUrls must be a subset of the citation URLs provided in the user message. Do not invent URLs or companies.
- Reference only the cited signals/claims you were given. If a fact is not in those signals, omit it.
- Pitch ${SELLER_PRODUCT.name} only when it follows from those cited hospital-staffing signals.
- Never invent people, emails, phone numbers, or real-looking companies.
- Keep the email under 160 words. Keep the LinkedIn message under 300 characters.
- The draft is never sent. Do not claim you already emailed anyone.
- Sign off as "${SELLER_PRODUCT.name}" only. Write "labeled TEST draft", TEST/MOCK, or EXAMPLE ONLY when the user message marks the prospect as a labeled TEST/EXAMPLE demo. Never add that wording for a real company.
`;

export function buildOutreachUserPrompt(input: {
  companyName: string;
  companyDomain: string | null;
  tone: OutreachTone;
  cta: OutreachCta;
  cited: CitedSignal[];
}): string {
  const signals = input.cited
    .map((signal, index) => {
      const urls = signal.sourceUrls.join(", ");
      return `${index + 1}. id=${signal.id} kind=${signal.kind} type=${signal.type}\n   summary: ${signal.summary}\n   sourceUrls: ${urls}`;
    })
    .join("\n");

  return [
    `Seller product: ${SELLER_PRODUCT.name} — ${SELLER_PRODUCT.description}`,
    `Prospect company name: ${input.companyName}`,
    `Prospect company domain: ${input.companyDomain ?? "(unknown)"}`,
    `Prospect label: ${
      isLabeledDemo({
        companyName: input.companyName,
        companyDomain: input.companyDomain,
      })
        ? "labeled TEST / EXAMPLE demo — TEST wording is allowed"
        : "REAL company — do not write TEST, MOCK, EXAMPLE, or labeled TEST draft"
    }`,
    `Tone (literal enum): ${input.tone}`,
    `CTA (literal enum): ${input.cta}`,
    "",
    "Cited signals/claims (ONLY use these; do not invent facts):",
    signals,
    "",
    "Return one JSON object matching the required example shape.",
  ].join("\n");
}
