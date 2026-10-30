import { z } from "zod";

/**
 * Adapter-friendly ICP slice for discovery.
 *
 * B003 (intake/ICP, parallel branch) can map without this module importing it:
 *   productSummary ← product.description
 *   industries     ← structured.targetIndustries[].name
 *   companySizes   ← structured.companySize.headcountTiers[].label
 *   geographies    ← (not on B003 yet; pass through when present)
 *   personas       ← structured.buyerPersonas[].title
 *   triggers       ← structured.triggerEvents[].summary
 *   excludeDomains ← the seller's own domain(s)
 */
export const discoveryInputSchema = z.object({
  productSummary: z.string().min(1),
  industries: z.array(z.string().min(1)).min(1),
  companySizes: z.array(z.string().min(1)).optional(),
  geographies: z.array(z.string().min(1)).optional(),
  personas: z.array(z.string().min(1)).optional(),
  triggers: z.array(z.string().min(1)).optional(),
  excludeDomains: z.array(z.string().min(1)).optional(),
});
export type DiscoveryInput = z.infer<typeof discoveryInputSchema>;

export const discoveryModeSchema = z.enum(["LIVE", "MOCK"]);
export type DiscoveryMode = z.infer<typeof discoveryModeSchema>;

export const discoveryRunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
]);
export type DiscoveryRunStatus = z.infer<typeof discoveryRunStatusSchema>;

export const discoveryClaimSchema = z.object({
  field: z.string().min(1),
  value: z.string().min(1),
  sourceUrl: z.string().min(1),
  quote: z.string().min(1),
});
export type DiscoveryClaim = z.infer<typeof discoveryClaimSchema>;

export const discoverySignalSchema = z.object({
  summary: z.string().min(1),
  sourceUrl: z.string().min(1),
});
export type DiscoverySignal = z.infer<typeof discoverySignalSchema>;

export const discoveryCandidateSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  whyFit: z.string().min(1),
  signals: z.array(discoverySignalSchema).default([]),
  claims: z.array(discoveryClaimSchema).min(1),
});
export type DiscoveryCandidate = z.infer<typeof discoveryCandidateSchema>;

export const scoredProspectSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(1),
  domain: z.string().min(1),
  websiteUrl: z.string().nullable(),
  whyFit: z.string().min(1),
  fitScore: z.number().int().min(0).max(100),
  rationale: z.string().min(1),
  signals: z.array(discoverySignalSchema),
  claims: z.array(discoveryClaimSchema),
});
export type ScoredProspect = z.infer<typeof scoredProspectSchema>;

export const competitorCategoryInsightSchema = z.object({
  competitorId: z.string().optional(),
  category: z.string().min(1),
  examples: z.array(z.string().min(1)),
  sourceUrl: z.string().min(1),
  quote: z.string().min(1),
});
export type CompetitorCategoryInsight = z.infer<
  typeof competitorCategoryInsightSchema
>;

export const discoveryRunSnapshotSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  status: discoveryRunStatusSchema,
  mode: discoveryModeSchema,
  input: discoveryInputSchema,
  queries: z.array(z.string()),
  prospects: z.array(scoredProspectSchema),
  competitorCategories: z.array(competitorCategoryInsightSchema),
  rejectedClaimCount: z.number().int().nonnegative(),
  droppedCompanyCount: z.number().int().nonnegative(),
  error: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type DiscoveryRunSnapshot = z.infer<typeof discoveryRunSnapshotSchema>;

export const DISCOVERY_RUN_ACTIONS = {
  STARTED: "discovery.run.started",
  COMPLETED: "discovery.run.completed",
  FAILED: "discovery.run.failed",
} as const;

export const llmProspectsSchema = z.object({
  companies: z.array(discoveryCandidateSchema),
});
export type LlmProspects = z.infer<typeof llmProspectsSchema>;

export const llmCompetitorCategoriesSchema = z.object({
  categories: z.array(
    z.object({
      category: z.string().min(1),
      examples: z.array(z.string().min(1)).default([]),
      sourceUrl: z.string().min(1),
      quote: z.string().min(1),
    }),
  ),
});
export type LlmCompetitorCategories = z.infer<
  typeof llmCompetitorCategoriesSchema
>;

export const llmQueryRefineSchema = z.object({
  queries: z.array(z.string().min(1)).min(3).max(6),
});
