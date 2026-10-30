import { isLabeledDemo } from "./meta";
import type { LlmOutreachDraft } from "./schema";

const DEMO_PHRASES = [
  /\s*\(\s*labeled\s+TEST(?:\s+draft)?\s*\)/gi,
  /\blabeled\s+TEST(?:\s+draft)?\b/gi,
  /\bTEST\s*\/\s*MOCK\b/gi,
  /\bMOCK\s+output\b/gi,
  /\bThis (?:message|draft) is TEST\/MOCK[^.]*\.?/gi,
];

const LEADING_TEST_NOTE = /^\s*TEST(?:\s*\/\s*MOCK)?(?:\s+note)?\s+/i;

export function stripDemoWording(text: string): string {
  let next = text;
  for (const pattern of DEMO_PHRASES) {
    next = next.replace(pattern, "");
  }
  next = next.replace(LEADING_TEST_NOTE, "");
  return next.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeOutreachDraftCopy(
  draft: LlmOutreachDraft,
  prospect: { companyName?: string | null; companyDomain?: string | null },
): LlmOutreachDraft {
  if (isLabeledDemo(prospect)) {
    return draft;
  }
  return {
    ...draft,
    emailSubject: stripDemoWording(draft.emailSubject),
    emailBody: stripDemoWording(draft.emailBody),
    linkedinMessage: stripDemoWording(draft.linkedinMessage),
  };
}
