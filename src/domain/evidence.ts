import { z } from "zod";
import { entityBaseSchema, jsonValueSchema, uuidSchema } from "./base";
import {
  entityTypeSchema,
  extractorSchema,
  sourceTypeSchema,
  verificationStatusSchema,
} from "./enums";

export const citationSchema = entityBaseSchema.extend({
  sourceUrl: z.url(),
  retrievedAt: z.coerce.date(),
  sourceType: sourceTypeSchema,
  quote: z.string().min(1),
  contentHash: z.string().min(1),
  extractor: extractorSchema,
});
export type Citation = z.infer<typeof citationSchema>;

export const createCitationInputSchema = citationSchema
  .omit({ id: true, createdAt: true, updatedAt: true, contentHash: true })
  .extend({
    contentHash: z.string().min(1).optional(),
  });
export type CreateCitationInput = z.input<typeof createCitationInputSchema>;

export const fieldAssertionSchema = entityBaseSchema.extend({
  entityType: entityTypeSchema,
  entityId: uuidSchema,
  fieldName: z.string().min(1),
  fieldValue: jsonValueSchema,
  verificationStatus: verificationStatusSchema,
  assertedBy: extractorSchema,
  assertedAt: z.coerce.date(),
});
export type FieldAssertion = z.infer<typeof fieldAssertionSchema>;

export const createFieldAssertionInputSchema = fieldAssertionSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    verificationStatus: verificationStatusSchema.default("UNVERIFIED"),
    assertedBy: extractorSchema.default("agent"),
    assertedAt: z.coerce.date().optional(),
    citationIds: z.array(uuidSchema).default([]),
  });
export type CreateFieldAssertionInput = z.input<
  typeof createFieldAssertionInputSchema
>;

export const fieldWithEvidenceSchema = z.object({
  value: jsonValueSchema,
  verificationStatus: verificationStatusSchema,
  citations: z.array(citationSchema),
});
export type FieldWithEvidence = z.infer<typeof fieldWithEvidenceSchema>;

export const companyWithEvidenceSchema = z.object({
  company: z.record(z.string(), jsonValueSchema),
  fields: z.record(z.string(), fieldWithEvidenceSchema),
});
export type CompanyWithEvidence = z.infer<typeof companyWithEvidenceSchema>;
