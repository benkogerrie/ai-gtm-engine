import { z } from "zod";

export const OUTREACH_TONES = ["professional", "friendly", "direct"] as const;
export const outreachToneSchema = z.enum(OUTREACH_TONES);
export type OutreachTone = z.infer<typeof outreachToneSchema>;

export const OUTREACH_CTAS = ["book a call", "reply", "learn more"] as const;
export const outreachCtaSchema = z.enum(OUTREACH_CTAS);
export type OutreachCta = z.infer<typeof outreachCtaSchema>;

export const citedSignalSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["signal", "claim"]),
  type: z.string().min(1),
  summary: z.string().min(1),
  sourceUrls: z.array(z.url()).min(1),
  quotes: z.array(z.string()).default([]),
});
export type CitedSignal = z.infer<typeof citedSignalSchema>;

export const llmOutreachDraftSchema = z.object({
  emailSubject: z.string().min(1),
  emailBody: z.string().min(1),
  linkedinMessage: z.string().min(1),
  tone: outreachToneSchema.optional(),
  cta: outreachCtaSchema.optional(),
  citedSignalIds: z.array(z.string()).default([]),
  sourceUrls: z.array(z.string()).default([]),
});
export type LlmOutreachDraft = z.infer<typeof llmOutreachDraftSchema>;

export const outreachDraftMetaSchema = z.object({
  kind: z.literal("b008-draft"),
  linkedinMessage: z.string(),
  tone: outreachToneSchema,
  cta: outreachCtaSchema,
  sourceUrls: z.array(z.string()),
  citedSignals: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["signal", "claim"]),
      type: z.string(),
      summary: z.string(),
      sourceUrls: z.array(z.string()),
    }),
  ),
  inferenceMode: z.enum(["live", "mock"]),
  version: z.number().int().min(1),
  parentOutreachId: z.string().nullable(),
  demoLabel: z.string().nullable(),
});
export type OutreachDraftMeta = z.infer<typeof outreachDraftMetaSchema>;
