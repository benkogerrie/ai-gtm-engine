import { z } from "zod";
import { entityBaseSchema, jsonValueSchema, stringListSchema, uuidSchema } from "./base";
import {
  competitorCategorySchema,
  confidenceSchema,
  contactStatusSchema,
  fitScoreSchema,
  fitTierSchema,
  icpStatusSchema,
  inferenceModeSchema,
  leadStageSchema,
  outreachChannelSchema,
  outreachStatusSchema,
  signalTypeSchema,
} from "./enums";

export const organizationSchema = entityBaseSchema.extend({
  name: z.string().min(1),
});
export type Organization = z.infer<typeof organizationSchema>;

export const productSchema = entityBaseSchema.extend({
  name: z.string().min(1),
  description: z.string().min(1),
  features: stringListSchema,
  capabilities: stringListSchema,
  technicalConstraints: stringListSchema,
  existingCustomers: stringListSchema,
  pricingModel: z.string().nullable(),
  contractValueMin: z.number().nullable(),
  contractValueMax: z.number().nullable(),
  monetizationModel: z.string().nullable(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductInputSchema = productSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    features: stringListSchema.default([]),
    capabilities: stringListSchema.default([]),
    technicalConstraints: stringListSchema.default([]),
    existingCustomers: stringListSchema.default([]),
    pricingModel: z.string().nullable().default(null),
    contractValueMin: z.number().nullable().default(null),
    contractValueMax: z.number().nullable().default(null),
    monetizationModel: z.string().nullable().default(null),
  });
export type CreateProductInput = z.input<typeof createProductInputSchema>;

export const icpSchema = entityBaseSchema.extend({
  productId: uuidSchema,
  name: z.string().min(1),
  status: icpStatusSchema,
  targetIndustries: stringListSchema,
  companySizeMin: z.number().int().nullable(),
  companySizeMax: z.number().int().nullable(),
  revenueBandMin: z.number().nullable(),
  revenueBandMax: z.number().nullable(),
  buyerPersonas: jsonValueSchema,
  triggerEvents: stringListSchema,
  confidenceScores: z.record(z.string(), confidenceSchema),
  expansionSuggestions: stringListSchema,
  version: z.number().int().min(1),
  parentIcpId: uuidSchema.nullable(),
  approvedAt: z.coerce.date().nullable(),
  approvedBy: z.string().nullable(),
  inferenceMode: inferenceModeSchema,
  structured: jsonValueSchema,
});
export type Icp = z.infer<typeof icpSchema>;

export const createIcpInputSchema = icpSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: icpStatusSchema.default("DRAFT"),
    targetIndustries: stringListSchema.default([]),
    companySizeMin: z.number().int().nullable().default(null),
    companySizeMax: z.number().int().nullable().default(null),
    revenueBandMin: z.number().nullable().default(null),
    revenueBandMax: z.number().nullable().default(null),
    buyerPersonas: jsonValueSchema.default([]),
    triggerEvents: stringListSchema.default([]),
    confidenceScores: z.record(z.string(), confidenceSchema).default({}),
    expansionSuggestions: stringListSchema.default([]),
    version: z.number().int().min(1).default(1),
    parentIcpId: uuidSchema.nullable().default(null),
    approvedAt: z.coerce.date().nullable().default(null),
    approvedBy: z.string().nullable().default(null),
    inferenceMode: inferenceModeSchema.default("mock"),
    structured: jsonValueSchema.default({}),
  });
export type CreateIcpInput = z.input<typeof createIcpInputSchema>;

export const companySchema = entityBaseSchema.extend({
  name: z.string().min(1),
  domain: z.string().nullable(),
  websiteUrl: z.url().nullable(),
  industry: z.string().nullable(),
  headcount: z.number().int().nullable(),
  revenueBand: z.string().nullable(),
  headquarters: z.string().nullable(),
  region: z.string().nullable(),
  fitScore: fitScoreSchema.nullable(),
  fitTier: fitTierSchema.nullable(),
  intentScore: fitScoreSchema.nullable(),
  negativeSignals: stringListSchema,
});
export type Company = z.infer<typeof companySchema>;

export const createCompanyInputSchema = companySchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    domain: z.string().nullable().default(null),
    websiteUrl: z.url().nullable().default(null),
    industry: z.string().nullable().default(null),
    headcount: z.number().int().nullable().default(null),
    revenueBand: z.string().nullable().default(null),
    headquarters: z.string().nullable().default(null),
    region: z.string().nullable().default(null),
    fitScore: fitScoreSchema.nullable().default(null),
    fitTier: fitTierSchema.nullable().default(null),
    intentScore: fitScoreSchema.nullable().default(null),
    negativeSignals: stringListSchema.default([]),
  });
export type CreateCompanyInput = z.input<typeof createCompanyInputSchema>;

export const personSchema = entityBaseSchema.extend({
  companyId: uuidSchema.nullable(),
  fullName: z.string().min(1),
  title: z.string().nullable(),
  seniority: z.string().nullable(),
  email: z.email().nullable(),
  linkedinUrl: z.url().nullable(),
  contactStatus: contactStatusSchema,
  emailMxValid: z.boolean().nullable(),
  fitScore: fitScoreSchema.nullable(),
});
export type Person = z.infer<typeof personSchema>;

export const createPersonInputSchema = personSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    companyId: uuidSchema.nullable().default(null),
    title: z.string().nullable().default(null),
    seniority: z.string().nullable().default(null),
    email: z.email().nullable().default(null),
    linkedinUrl: z.url().nullable().default(null),
    contactStatus: contactStatusSchema.default("UNVERIFIED"),
    emailMxValid: z.boolean().nullable().default(null),
    fitScore: fitScoreSchema.nullable().default(null),
  });
export type CreatePersonInput = z.input<typeof createPersonInputSchema>;

export const competitorSchema = entityBaseSchema.extend({
  productId: uuidSchema.nullable(),
  name: z.string().min(1),
  domain: z.string().nullable(),
  websiteUrl: z.url().nullable(),
  category: competitorCategorySchema,
  positioning: z.string().nullable(),
  valueProposition: z.string().nullable(),
  pricingTiers: jsonValueSchema,
  differentiators: stringListSchema,
});
export type Competitor = z.infer<typeof competitorSchema>;

export const createCompetitorInputSchema = competitorSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    productId: uuidSchema.nullable().default(null),
    domain: z.string().nullable().default(null),
    websiteUrl: z.url().nullable().default(null),
    category: competitorCategorySchema.default("DIRECT"),
    positioning: z.string().nullable().default(null),
    valueProposition: z.string().nullable().default(null),
    pricingTiers: jsonValueSchema.default([]),
    differentiators: stringListSchema.default([]),
  });
export type CreateCompetitorInput = z.input<typeof createCompetitorInputSchema>;

export const signalSchema = entityBaseSchema.extend({
  companyId: uuidSchema.nullable(),
  type: signalTypeSchema,
  summary: z.string().min(1),
  occurredAt: z.coerce.date().nullable(),
  strength: fitScoreSchema.nullable(),
});
export type Signal = z.infer<typeof signalSchema>;

export const createSignalInputSchema = signalSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    companyId: uuidSchema.nullable().default(null),
    occurredAt: z.coerce.date().nullable().default(null),
    strength: fitScoreSchema.nullable().default(null),
  });
export type CreateSignalInput = z.input<typeof createSignalInputSchema>;

export const leadSchema = entityBaseSchema.extend({
  companyId: uuidSchema,
  personId: uuidSchema.nullable(),
  productId: uuidSchema.nullable(),
  icpId: uuidSchema.nullable(),
  stage: leadStageSchema,
  fitScore: fitScoreSchema.nullable(),
  fitTier: fitTierSchema.nullable(),
  ownerType: z.enum(["human", "agent"]),
  ownerId: z.string().min(1),
});
export type Lead = z.infer<typeof leadSchema>;

export const createLeadInputSchema = leadSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    personId: uuidSchema.nullable().default(null),
    productId: uuidSchema.nullable().default(null),
    icpId: uuidSchema.nullable().default(null),
    stage: leadStageSchema.default("MATCHED"),
    fitScore: fitScoreSchema.nullable().default(null),
    fitTier: fitTierSchema.nullable().default(null),
    ownerType: z.enum(["human", "agent"]).default("agent"),
  });
export type CreateLeadInput = z.input<typeof createLeadInputSchema>;

export const outreachSchema = entityBaseSchema.extend({
  leadId: uuidSchema.nullable(),
  personId: uuidSchema.nullable(),
  companyId: uuidSchema.nullable(),
  channel: outreachChannelSchema,
  subject: z.string().nullable(),
  body: z.string().min(1),
  status: outreachStatusSchema,
  dryRun: z.boolean(),
  variant: z.string().nullable(),
  sentAt: z.coerce.date().nullable(),
});
export type Outreach = z.infer<typeof outreachSchema>;

export const createOutreachInputSchema = outreachSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    leadId: uuidSchema.nullable().default(null),
    personId: uuidSchema.nullable().default(null),
    companyId: uuidSchema.nullable().default(null),
    subject: z.string().nullable().default(null),
    status: outreachStatusSchema.default("DRAFT"),
    dryRun: z.boolean().default(true),
    variant: z.string().nullable().default(null),
    sentAt: z.coerce.date().nullable().default(null),
  });
export type CreateOutreachInput = z.input<typeof createOutreachInputSchema>;

export const createProductApiSchema = createProductInputSchema.omit({
  orgId: true,
});
export type CreateProductApiInput = z.input<typeof createProductApiSchema>;
