import { z } from "zod";
import { stringListSchema } from "./base";
import { createProductApiSchema } from "./entities";
import {
  confidenceSchema,
  expansionDecisionSchema,
  expansionKindSchema,
  triggerEventKindSchema,
} from "./enums";

export const inferredStatusSchema = z.literal("INFERRED");

export const inferredMetaSchema = z.object({
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const productIntakeSchema = createProductApiSchema.extend({
  referenceWins: stringListSchema.default([]),
  freeText: z.string().optional(),
});
export type ProductIntake = z.input<typeof productIntakeSchema>;

export const naicsCodeSchema = z
  .string()
  .regex(/^\d{2,6}$/, "NAICS codes must be 2–6 digits");

export const sicCodeSchema = z
  .string()
  .regex(/^\d{2,4}$/, "SIC codes must be 2–4 digits");

export const llmTargetIndustrySchema = z.object({
  name: z.string().min(1),
  naics: naicsCodeSchema.nullable(),
  sic: sicCodeSchema.nullable(),
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const headcountTierSchema = z.object({
  label: z.string().min(1),
  min: z.number().int().nonnegative().nullable(),
  max: z.number().int().nonnegative().nullable(),
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const revenueBandSchema = z.object({
  label: z.string().min(1),
  min: z.number().nonnegative().nullable(),
  max: z.number().nonnegative().nullable(),
  currency: z.string().min(1).default("USD"),
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const buyerPersonaSchema = z.object({
  title: z.string().min(1),
  functionalArea: z.string().min(1),
  seniority: z.string().min(1),
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const triggerEventSchema = z.object({
  type: triggerEventKindSchema,
  summary: z.string().min(1),
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const llmExpansionSuggestionSchema = z.object({
  kind: expansionKindSchema,
  title: z.string().min(1),
  reasoning: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  confidence: confidenceSchema,
  status: inferredStatusSchema,
});

export const llmIcpOutputSchema = z.object({
  name: z.string().min(1),
  targetIndustries: z.array(llmTargetIndustrySchema).min(1),
  companySize: z.object({
    headcountTiers: z.array(headcountTierSchema).min(1),
    revenueBands: z.array(revenueBandSchema).min(1),
    confidence: confidenceSchema,
    status: inferredStatusSchema,
  }),
  buyerPersonas: z.array(buyerPersonaSchema).min(1),
  triggerEvents: z.array(triggerEventSchema).min(1),
  expansionSuggestions: z.array(llmExpansionSuggestionSchema).min(1),
});
export type LlmIcpOutput = z.infer<typeof llmIcpOutputSchema>;

export const naicsValidationSchema = z.object({
  formatValid: z.boolean(),
  known: z.boolean(),
  label: z.string().nullable(),
});

export const structuredTargetIndustrySchema = llmTargetIndustrySchema.extend({
  naicsValidation: naicsValidationSchema,
});

export const structuredExpansionSchema = llmExpansionSuggestionSchema.extend({
  id: z.string().min(1),
  decision: expansionDecisionSchema,
  decisionNote: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.coerce.date().nullable(),
});

export const structuredIcpSchema = z.object({
  name: z.string().min(1),
  targetIndustries: z.array(structuredTargetIndustrySchema).min(1),
  companySize: llmIcpOutputSchema.shape.companySize,
  buyerPersonas: z.array(buyerPersonaSchema).min(1),
  triggerEvents: z.array(triggerEventSchema).min(1),
  expansionSuggestions: z.array(structuredExpansionSchema),
});
export type StructuredIcp = z.infer<typeof structuredIcpSchema>;

export const icpFieldEditSchema = z.object({
  name: z.string().min(1).optional(),
  targetIndustries: z.array(structuredTargetIndustrySchema).min(1).optional(),
  companySize: llmIcpOutputSchema.shape.companySize.optional(),
  buyerPersonas: z.array(buyerPersonaSchema).min(1).optional(),
  triggerEvents: z.array(triggerEventSchema).min(1).optional(),
});
export type IcpFieldEdit = z.infer<typeof icpFieldEditSchema>;
