import { isLlmError, LlmInvalidJsonError, type LlmClient } from "@/lib/llm";
import { createLlmClient, isLlmConfigured } from "@/lib/llm";
import { createMockLlmClient } from "@/lib/llm";
import { buildMockOutreachDraft } from "./mock-output";
import { llmOutreachDraftNormalizedSchema } from "./normalize";
import {
  buildOutreachUserPrompt,
  OUTREACH_PROMPT_VERSION,
  OUTREACH_SYSTEM_PROMPT,
} from "./prompts/v1";
import type { CitedSignal, LlmOutreachDraft, OutreachCta, OutreachTone } from "./schema";

export { OUTREACH_PROMPT_VERSION };

export type GeneratedOutreachDraft = {
  draft: LlmOutreachDraft;
  inferenceMode: "live" | "mock";
  model: string;
  sourceUrls: string[];
};

function allowedUrls(cited: CitedSignal[]): Set<string> {
  return new Set(cited.flatMap((signal) => signal.sourceUrls));
}

function allowedIds(cited: CitedSignal[]): Set<string> {
  return new Set(cited.map((signal) => signal.id));
}

export function groundDraft(
  draft: LlmOutreachDraft,
  cited: CitedSignal[],
  controls: { tone: OutreachTone; cta: OutreachCta },
): LlmOutreachDraft {
  const urls = allowedUrls(cited);
  const ids = allowedIds(cited);
  const sourceUrls = draft.sourceUrls.filter((url) => urls.has(url));
  const citedSignalIds = draft.citedSignalIds.filter((id) => ids.has(id));
  return {
    ...draft,
    tone: draft.tone ?? controls.tone,
    cta: draft.cta ?? controls.cta,
    citedSignalIds: citedSignalIds.length ? citedSignalIds : [...ids],
    sourceUrls: sourceUrls.length ? sourceUrls : [...urls],
  };
}

export function createOutreachLlmClient(): {
  client: LlmClient;
  mode: "live" | "mock";
} {
  if (isLlmConfigured()) {
    return { client: createLlmClient(), mode: "live" };
  }
  return {
    client: createMockLlmClient({
      jsonHandler: (schema, messages) => {
        const prompt = messages.map((message) => message.content).join("\n");
        const companyName =
          /Prospect company name:\s*(.+)/.exec(prompt)?.[1]?.trim() ||
          /Company name:\s*(.+)/.exec(prompt)?.[1]?.trim() ||
          "TEST hospital";
        const toneMatch = /Tone \(literal enum\):\s*(professional|friendly|direct)/.exec(
          prompt,
        );
        const ctaMatch =
          /CTA \(literal enum\):\s*(book a call|reply|learn more)/.exec(prompt);
        const raw = buildMockOutreachDraft({
          companyName,
          tone: (toneMatch?.[1] as OutreachTone) ?? "professional",
          cta: (ctaMatch?.[1] as OutreachCta) ?? "book a call",
          cited: [
            {
              id: "mock-signal",
              kind: "signal",
              type: "OTHER",
              summary: "MOCK cited signal from the prompt",
              sourceUrls: ["https://example.com"],
              quotes: [],
            },
          ],
        });
        return schema.parse(raw);
      },
    }),
    mode: "mock",
  };
}

export async function generateOutreachDraft(
  client: LlmClient,
  input: {
    companyName: string;
    companyDomain: string | null;
    tone: OutreachTone;
    cta: OutreachCta;
    cited: CitedSignal[];
  },
): Promise<GeneratedOutreachDraft> {
  const messages = [
    { role: "system" as const, content: OUTREACH_SYSTEM_PROMPT },
    { role: "user" as const, content: buildOutreachUserPrompt(input) },
  ];

  try {
    const result = await client.json(llmOutreachDraftNormalizedSchema, messages);
    const grounded = groundDraft(result.data, input.cited, {
      tone: input.tone,
      cta: input.cta,
    });
    return {
      draft: grounded,
      inferenceMode: client.provider === "mock" ? "mock" : "live",
      model: result.model,
      sourceUrls: grounded.sourceUrls,
    };
  } catch (error) {
    if (error instanceof LlmInvalidJsonError || isLlmError(error)) {
      throw error;
    }
    throw error;
  }
}
