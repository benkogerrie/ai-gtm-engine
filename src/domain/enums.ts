import { z } from "zod";

export const ACTOR_TYPES = ["human", "agent"] as const;
export const actorTypeSchema = z.enum(ACTOR_TYPES);
export type ActorType = z.infer<typeof actorTypeSchema>;

export const EXTRACTORS = ["agent", "human"] as const;
export const extractorSchema = z.enum(EXTRACTORS);
export type Extractor = z.infer<typeof extractorSchema>;

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "INFERRED",
  "UNVERIFIED",
  "REJECTED",
] as const;
export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;

export const SOURCE_TYPES = [
  "WEBSITE",
  "FILING",
  "PRESS",
  "JOB_POSTING",
  "ENRICHMENT",
  "REGULATORY",
  "OTHER",
] as const;
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const CONTACT_STATUSES = [
  "UNVERIFIED",
  "VERIFIED",
  "BOUNCED",
  "OPTED_OUT",
] as const;
export const contactStatusSchema = z.enum(CONTACT_STATUSES);
export type ContactStatus = z.infer<typeof contactStatusSchema>;

export const LEAD_STAGES = [
  "MATCHED",
  "CONTACTED",
  "REPLIED",
  "MEETING_BOOKED",
  "CLOSED_LOST",
] as const;
export const leadStageSchema = z.enum(LEAD_STAGES);
export type LeadStage = z.infer<typeof leadStageSchema>;

export const OUTREACH_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SENT",
  "REJECTED",
] as const;
export const outreachStatusSchema = z.enum(OUTREACH_STATUSES);
export type OutreachStatus = z.infer<typeof outreachStatusSchema>;

export const OUTREACH_CHANNELS = ["EMAIL", "LINKEDIN"] as const;
export const outreachChannelSchema = z.enum(OUTREACH_CHANNELS);
export type OutreachChannel = z.infer<typeof outreachChannelSchema>;

export const APPROVAL_DECISIONS = ["APPROVED", "REJECTED"] as const;
export const approvalDecisionSchema = z.enum(APPROVAL_DECISIONS);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;

export const COMPETITOR_CATEGORIES = [
  "DIRECT",
  "INDIRECT",
  "ALTERNATIVE",
] as const;
export const competitorCategorySchema = z.enum(COMPETITOR_CATEGORIES);
export type CompetitorCategory = z.infer<typeof competitorCategorySchema>;

export const FIT_TIERS = ["A", "B", "C"] as const;
export const fitTierSchema = z.enum(FIT_TIERS);
export type FitTier = z.infer<typeof fitTierSchema>;

export const SIGNAL_TYPES = [
  "FUNDING",
  "HIRE",
  "TECH_STACK_CHANGE",
  "JOB_POSTING",
  "RENEWAL",
  "CHURN",
  "HIRING_FREEZE",
  "OTHER",
] as const;
export const signalTypeSchema = z.enum(SIGNAL_TYPES);
export type SignalType = z.infer<typeof signalTypeSchema>;

export const ENTITY_TYPES = [
  "organization",
  "product",
  "icp",
  "company",
  "person",
  "competitor",
  "signal",
  "lead",
  "outreach",
  "outreach_approval",
  "citation",
  "field_assertion",
  "relationship_edge",
] as const;
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const RELATIONSHIP_EDGE_TYPES = [
  "WORKS_AT",
  "COMPETES_WITH",
  "MATCHED_TO",
  "CONTACTED_VIA",
  "REPLIED_TO",
  "PREVIOUSLY_EMPLOYED_AT",
] as const;
export const relationshipEdgeTypeSchema = z.enum(RELATIONSHIP_EDGE_TYPES);
export type RelationshipEdgeType = z.infer<typeof relationshipEdgeTypeSchema>;

export const ICP_STATUSES = ["DRAFT", "APPROVED", "REJECTED"] as const;
export const icpStatusSchema = z.enum(ICP_STATUSES);
export type IcpStatus = z.infer<typeof icpStatusSchema>;

export const fitScoreSchema = z.number().int().min(0).max(100);
export const confidenceSchema = z.number().min(0).max(1);
