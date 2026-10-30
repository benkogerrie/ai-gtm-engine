import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ACTOR_TYPES,
  APPROVAL_DECISIONS,
  COMPETITOR_CATEGORIES,
  CONTACT_STATUSES,
  ENTITY_TYPES,
  EXTRACTORS,
  FIT_TIERS,
  ICP_STATUSES,
  LEAD_STAGES,
  OUTREACH_CHANNELS,
  OUTREACH_STATUSES,
  RELATIONSHIP_EDGE_TYPES,
  SIGNAL_TYPES,
  SOURCE_TYPES,
  VERIFICATION_STATUSES,
} from "../domain/enums";

function enumTuple<T extends readonly string[]>(values: T) {
  return values as unknown as [T[number], ...T[number][]];
}

export const actorTypeEnum = pgEnum("actor_type", enumTuple(ACTOR_TYPES));
export const extractorEnum = pgEnum("extractor", enumTuple(EXTRACTORS));
export const verificationStatusEnum = pgEnum(
  "verification_status",
  enumTuple(VERIFICATION_STATUSES),
);
export const sourceTypeEnum = pgEnum("source_type", enumTuple(SOURCE_TYPES));
export const contactStatusEnum = pgEnum(
  "contact_status",
  enumTuple(CONTACT_STATUSES),
);
export const leadStageEnum = pgEnum("lead_stage", enumTuple(LEAD_STAGES));
export const outreachStatusEnum = pgEnum(
  "outreach_status",
  enumTuple(OUTREACH_STATUSES),
);
export const outreachChannelEnum = pgEnum(
  "outreach_channel",
  enumTuple(OUTREACH_CHANNELS),
);
export const approvalDecisionEnum = pgEnum(
  "approval_decision",
  enumTuple(APPROVAL_DECISIONS),
);
export const competitorCategoryEnum = pgEnum(
  "competitor_category",
  enumTuple(COMPETITOR_CATEGORIES),
);
export const fitTierEnum = pgEnum("fit_tier", enumTuple(FIT_TIERS));
export const signalTypeEnum = pgEnum("signal_type", enumTuple(SIGNAL_TYPES));
export const entityTypeEnum = pgEnum("entity_type", enumTuple(ENTITY_TYPES));
export const relationshipEdgeTypeEnum = pgEnum(
  "relationship_edge_type",
  enumTuple(RELATIONSHIP_EDGE_TYPES),
);
export const icpStatusEnum = pgEnum("icp_status", enumTuple(ICP_STATUSES));

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  name: text("name").notNull(),
  ...timestamps,
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    features: jsonb("features").$type<string[]>().notNull(),
    capabilities: jsonb("capabilities").$type<string[]>().notNull(),
    technicalConstraints: jsonb("technical_constraints")
      .$type<string[]>()
      .notNull(),
    existingCustomers: jsonb("existing_customers").$type<string[]>().notNull(),
    pricingModel: text("pricing_model"),
    contractValueMin: real("contract_value_min"),
    contractValueMax: real("contract_value_max"),
    monetizationModel: text("monetization_model"),
    ...timestamps,
  },
  (table) => [index("products_org_id_idx").on(table.orgId)],
);

export const icps = pgTable(
  "icps",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    name: text("name").notNull(),
    status: icpStatusEnum("status").notNull(),
    targetIndustries: jsonb("target_industries").$type<string[]>().notNull(),
    companySizeMin: integer("company_size_min"),
    companySizeMax: integer("company_size_max"),
    revenueBandMin: real("revenue_band_min"),
    revenueBandMax: real("revenue_band_max"),
    buyerPersonas: jsonb("buyer_personas").$type<unknown>().notNull(),
    triggerEvents: jsonb("trigger_events").$type<string[]>().notNull(),
    confidenceScores: jsonb("confidence_scores")
      .$type<Record<string, number>>()
      .notNull(),
    expansionSuggestions: jsonb("expansion_suggestions")
      .$type<string[]>()
      .notNull(),
    ...timestamps,
  },
  (table) => [index("icps_org_id_idx").on(table.orgId)],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    name: text("name").notNull(),
    domain: text("domain"),
    websiteUrl: text("website_url"),
    industry: text("industry"),
    headcount: integer("headcount"),
    revenueBand: text("revenue_band"),
    headquarters: text("headquarters"),
    region: text("region"),
    fitScore: integer("fit_score"),
    fitTier: fitTierEnum("fit_tier"),
    intentScore: integer("intent_score"),
    negativeSignals: jsonb("negative_signals").$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [index("companies_org_id_idx").on(table.orgId)],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    fullName: text("full_name").notNull(),
    title: text("title"),
    seniority: text("seniority"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    contactStatus: contactStatusEnum("contact_status").notNull(),
    emailMxValid: boolean("email_mx_valid"),
    fitScore: integer("fit_score"),
    ...timestamps,
  },
  (table) => [index("people_org_id_idx").on(table.orgId)],
);

export const competitors = pgTable(
  "competitors",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    productId: uuid("product_id").references(() => products.id),
    name: text("name").notNull(),
    domain: text("domain"),
    websiteUrl: text("website_url"),
    category: competitorCategoryEnum("category").notNull(),
    positioning: text("positioning"),
    valueProposition: text("value_proposition"),
    pricingTiers: jsonb("pricing_tiers").$type<unknown>().notNull(),
    differentiators: jsonb("differentiators").$type<string[]>().notNull(),
    ...timestamps,
  },
  (table) => [index("competitors_org_id_idx").on(table.orgId)],
);

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    type: signalTypeEnum("type").notNull(),
    summary: text("summary").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    strength: integer("strength"),
    ...timestamps,
  },
  (table) => [index("signals_org_id_idx").on(table.orgId)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    personId: uuid("person_id").references(() => people.id),
    productId: uuid("product_id").references(() => products.id),
    icpId: uuid("icp_id").references(() => icps.id),
    stage: leadStageEnum("stage").notNull(),
    fitScore: integer("fit_score"),
    fitTier: fitTierEnum("fit_tier"),
    ownerType: actorTypeEnum("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    ...timestamps,
  },
  (table) => [index("leads_org_id_idx").on(table.orgId)],
);

export const outreach = pgTable(
  "outreach",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    leadId: uuid("lead_id").references(() => leads.id),
    personId: uuid("person_id").references(() => people.id),
    companyId: uuid("company_id").references(() => companies.id),
    channel: outreachChannelEnum("channel").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: outreachStatusEnum("status").notNull(),
    dryRun: boolean("dry_run").notNull().default(true),
    variant: text("variant"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("outreach_org_id_idx").on(table.orgId)],
);

export const outreachApprovals = pgTable(
  "outreach_approvals",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    outreachId: uuid("outreach_id")
      .notNull()
      .references(() => outreach.id),
    decision: approvalDecisionEnum("decision").notNull(),
    approvedBy: text("approved_by").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (table) => [index("outreach_approvals_outreach_id_idx").on(table.outreachId)],
);

export const citations = pgTable(
  "citations",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    sourceType: sourceTypeEnum("source_type").notNull(),
    quote: text("quote").notNull(),
    contentHash: text("content_hash").notNull(),
    extractor: extractorEnum("extractor").notNull(),
    ...timestamps,
  },
  (table) => [index("citations_org_id_idx").on(table.orgId)],
);

export const fieldAssertions = pgTable(
  "field_assertions",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fieldName: text("field_name").notNull(),
    fieldValue: jsonb("field_value").$type<unknown>().notNull(),
    verificationStatus: verificationStatusEnum("verification_status").notNull(),
    assertedBy: extractorEnum("asserted_by").notNull(),
    assertedAt: timestamp("asserted_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [
    index("field_assertions_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const fieldAssertionCitations = pgTable(
  "field_assertion_citations",
  {
    assertionId: uuid("assertion_id")
      .notNull()
      .references(() => fieldAssertions.id),
    citationId: uuid("citation_id")
      .notNull()
      .references(() => citations.id),
  },
  (table) => [primaryKey({ columns: [table.assertionId, table.citationId] })],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("audit_events_org_id_idx").on(table.orgId),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export const relationshipEdges = pgTable(
  "relationship_edges",
  {
    id: uuid("id").primaryKey(),
    orgId: uuid("org_id").notNull(),
    fromEntityType: entityTypeEnum("from_entity_type").notNull(),
    fromEntityId: uuid("from_entity_id").notNull(),
    toEntityType: entityTypeEnum("to_entity_type").notNull(),
    toEntityId: uuid("to_entity_id").notNull(),
    edgeType: relationshipEdgeTypeEnum("edge_type").notNull(),
    ...timestamps,
  },
  (table) => [index("relationship_edges_org_id_idx").on(table.orgId)],
);

export const schema = {
  organizations,
  products,
  icps,
  companies,
  people,
  competitors,
  signals,
  leads,
  outreach,
  outreachApprovals,
  citations,
  fieldAssertions,
  fieldAssertionCitations,
  auditEvents,
  relationshipEdges,
};
