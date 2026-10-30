import { and, desc, eq, inArray } from "drizzle-orm";
import type { MutationActor } from "../domain/audit";
import {
  createCompanyInputSchema,
  createCompetitorInputSchema,
  createIcpInputSchema,
  createLeadInputSchema,
  createOutreachInputSchema,
  createPersonInputSchema,
  createProductInputSchema,
  createSignalInputSchema,
  type CreateCompanyInput,
  type CreateCompetitorInput,
  type CreateIcpInput,
  type CreateLeadInput,
  type CreateOutreachInput,
  type CreatePersonInput,
  type CreateProductInput,
  type CreateSignalInput,
} from "../domain/entities";
import type { EntityType, FitTier, OutreachStatus } from "../domain/enums";
import {
  createCitationInputSchema,
  createFieldAssertionInputSchema,
  type CreateCitationInput,
  type CreateFieldAssertionInput,
  type FieldWithEvidence,
} from "../domain/evidence";
import {
  createRelationshipEdgeInputSchema,
  type CreateRelationshipEdgeInput,
} from "../domain/relationship";
import { DomainError } from "../domain/errors";
import {
  assertDryRunCannotBeSent,
  assertDryRunCompleted,
  assertOutreachTransition,
  assertSentHasApproval,
  assertVerifiedClaimHasCitation,
} from "../domain/rules";
import { hashCitationContent } from "../lib/hash";
import type { AppDatabase } from "./client";
import { newId, now } from "./ids";
import {
  auditEvents,
  citations,
  companies,
  competitors,
  fieldAssertionCitations,
  fieldAssertions,
  icps,
  leads,
  organizations,
  outreach,
  outreachApprovals,
  people,
  products,
  relationshipEdges,
  signals,
} from "./schema";

export type { MutationActor };

type TransactionalDb = Pick<
  AppDatabase,
  "insert" | "select" | "update" | "delete" | "query"
>;

async function writeAudit(
  tx: TransactionalDb,
  input: {
    orgId: string;
    actor: MutationActor;
    action: string;
    entityType: EntityType;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  const stamped = now();
  await tx.insert(auditEvents).values({
    id: newId(),
    orgId: input.orgId,
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: stamped,
    updatedAt: stamped,
  });
}

export async function withAudit<T>(
  db: AppDatabase,
  event: {
    orgId: string;
    actor: MutationActor;
    action: string;
    entityType: EntityType;
    entityId: string;
    before?: unknown;
    after?: unknown;
  },
  work: (tx: AppDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await work(tx as unknown as AppDatabase);
    await writeAudit(tx as unknown as TransactionalDb, event);
    return result;
  });
}

export async function createOrganization(
  db: AppDatabase,
  input: { name: string; id?: string },
  actor: MutationActor,
) {
  const stamped = now();
  const id = input.id ?? newId();
  const row = {
    id,
    orgId: id,
    name: input.name,
    createdAt: stamped,
    updatedAt: stamped,
  };
  return withAudit(
    db,
    {
      orgId: id,
      actor,
      action: "organization.create",
      entityType: "organization",
      entityId: id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(organizations).values(row).returning();
      return created;
    },
  );
}

export async function createProduct(
  db: AppDatabase,
  raw: CreateProductInput,
  actor: MutationActor,
) {
  const input = createProductInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "product.create",
      entityType: "product",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(products).values(row).returning();
      return created;
    },
  );
}

export async function listProducts(db: AppDatabase, orgId: string) {
  return db.select().from(products).where(eq(products.orgId, orgId));
}

export async function getProduct(db: AppDatabase, id: string) {
  const [row] = await db.select().from(products).where(eq(products.id, id));
  return row ?? null;
}

export async function createIcp(
  db: AppDatabase,
  raw: CreateIcpInput,
  actor: MutationActor,
) {
  const input = createIcpInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "icp.create",
      entityType: "icp",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(icps).values(row).returning();
      return created;
    },
  );
}

export async function getIcp(db: AppDatabase, id: string) {
  const [row] = await db.select().from(icps).where(eq(icps.id, id));
  return row ?? null;
}

export async function getIcpForOrg(db: AppDatabase, id: string, orgId: string) {
  const [row] = await db
    .select()
    .from(icps)
    .where(and(eq(icps.id, id), eq(icps.orgId, orgId)));
  return row ?? null;
}

export async function listIcpsForOrg(db: AppDatabase, orgId: string) {
  return db
    .select()
    .from(icps)
    .where(eq(icps.orgId, orgId))
    .orderBy(desc(icps.updatedAt));
}

export async function getOrganization(db: AppDatabase, id: string) {
  const [row] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id));
  return row ?? null;
}

export async function ensureOrganization(
  db: AppDatabase,
  input: { id: string; name: string },
  actor: MutationActor,
) {
  const existing = await getOrganization(db, input.id);
  if (existing) {
    return existing;
  }
  return createOrganization(db, input, actor);
}

export async function updateIcp(
  db: AppDatabase,
  id: string,
  orgId: string,
  patch: Record<string, unknown>,
  actor: MutationActor,
  action = "icp.update",
) {
  const current = await getIcpForOrg(db, id, orgId);
  if (!current) {
    throw new DomainError("ICP_NOT_FOUND", `ICP ${id} was not found for this org`);
  }
  const stamped = now();
  const next = { ...patch, updatedAt: stamped };
  return withAudit(
    db,
    {
      orgId: current.orgId,
      actor,
      action,
      entityType: "icp",
      entityId: current.id,
      before: current,
      after: { ...current, ...next },
    },
    async (tx) => {
      const [updated] = await tx
        .update(icps)
        .set(next)
        .where(eq(icps.id, current.id))
        .returning();
      return updated;
    },
  );
}

export async function createCompany(
  db: AppDatabase,
  raw: CreateCompanyInput,
  actor: MutationActor,
) {
  const input = createCompanyInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "company.create",
      entityType: "company",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(companies).values(row).returning();
      return created;
    },
  );
}

export async function getCompany(db: AppDatabase, id: string) {
  const [row] = await db.select().from(companies).where(eq(companies.id, id));
  return row ?? null;
}

export async function getCompanyForOrg(
  db: AppDatabase,
  id: string,
  orgId: string,
) {
  const [row] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.orgId, orgId)));
  return row ?? null;
}

export async function listCompanies(db: AppDatabase, orgId: string) {
  return db
    .select()
    .from(companies)
    .where(eq(companies.orgId, orgId))
    .orderBy(desc(companies.updatedAt));
}

export async function updateCompany(
  db: AppDatabase,
  id: string,
  orgId: string,
  patch: Partial<{
    fitScore: number | null;
    fitTier: FitTier | null;
  }>,
  actor: MutationActor,
  action = "company.update",
) {
  const current = await getCompanyForOrg(db, id, orgId);
  if (!current) {
    throw new DomainError(
      "ENTITY_NOT_FOUND",
      "Company was not found for this org",
    );
  }
  const stamped = now();
  const next = { ...patch, updatedAt: stamped };
  return withAudit(
    db,
    {
      orgId: current.orgId,
      actor,
      action,
      entityType: "company",
      entityId: current.id,
      before: current,
      after: { ...current, ...next },
    },
    async (tx) => {
      const [updated] = await tx
        .update(companies)
        .set(next)
        .where(eq(companies.id, current.id))
        .returning();
      return updated;
    },
  );
}

export async function listSignalsForCompany(
  db: AppDatabase,
  orgId: string,
  companyId: string,
) {
  return db
    .select()
    .from(signals)
    .where(and(eq(signals.orgId, orgId), eq(signals.companyId, companyId)))
    .orderBy(desc(signals.updatedAt));
}

const COMPANY_EVIDENCE_FIELDS = [
  "name",
  "domain",
  "websiteUrl",
  "industry",
  "headcount",
  "revenueBand",
  "headquarters",
  "region",
  "fitScore",
  "fitTier",
  "intentScore",
] as const;

export async function getCompanyWithEvidence(
  db: AppDatabase,
  id: string,
  orgId?: string,
) {
  const company = await getCompany(db, id);
  if (!company) {
    return null;
  }
  if (orgId && company.orgId !== orgId) {
    return null;
  }

  const assertions = await db
    .select()
    .from(fieldAssertions)
    .where(
      and(
        eq(fieldAssertions.entityType, "company"),
        eq(fieldAssertions.entityId, id),
      ),
    );

  const assertionIds = assertions.map((assertion) => assertion.id);
  const links = assertionIds.length
    ? await db
        .select()
        .from(fieldAssertionCitations)
        .where(inArray(fieldAssertionCitations.assertionId, assertionIds))
    : [];
  const citationIds = [...new Set(links.map((link) => link.citationId))];
  const citationRows = citationIds.length
    ? await db.select().from(citations).where(inArray(citations.id, citationIds))
    : [];
  const citationsById = new Map(
    citationRows.map((citation) => [citation.id, citation]),
  );
  const citationsByAssertion = new Map<string, typeof citationRows>();
  for (const link of links) {
    const list = citationsByAssertion.get(link.assertionId) ?? [];
    const citation = citationsById.get(link.citationId);
    if (citation) {
      list.push(citation);
    }
    citationsByAssertion.set(link.assertionId, list);
  }

  const assertionByField = new Map(
    assertions.map((assertion) => [assertion.fieldName, assertion]),
  );

  const fields: Record<string, FieldWithEvidence> = {};
  for (const fieldName of COMPANY_EVIDENCE_FIELDS) {
    const assertion = assertionByField.get(fieldName);
    const value = company[fieldName];
    fields[fieldName] = {
      value: assertion ? assertion.fieldValue : value,
      verificationStatus: assertion?.verificationStatus ?? "UNVERIFIED",
      citations: assertion
        ? (citationsByAssertion.get(assertion.id) ?? [])
        : [],
    };
  }

  return { company, fields };
}

export async function createPerson(
  db: AppDatabase,
  raw: CreatePersonInput,
  actor: MutationActor,
) {
  const input = createPersonInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "person.create",
      entityType: "person",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(people).values(row).returning();
      return created;
    },
  );
}

export async function getPerson(db: AppDatabase, id: string) {
  const [row] = await db.select().from(people).where(eq(people.id, id));
  return row ?? null;
}

export async function createCompetitor(
  db: AppDatabase,
  raw: CreateCompetitorInput,
  actor: MutationActor,
) {
  const input = createCompetitorInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "competitor.create",
      entityType: "competitor",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(competitors).values(row).returning();
      return created;
    },
  );
}

export async function getCompetitor(db: AppDatabase, id: string) {
  const [row] = await db
    .select()
    .from(competitors)
    .where(eq(competitors.id, id));
  return row ?? null;
}

export async function createSignal(
  db: AppDatabase,
  raw: CreateSignalInput,
  actor: MutationActor,
) {
  const input = createSignalInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "signal.create",
      entityType: "signal",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(signals).values(row).returning();
      return created;
    },
  );
}

export async function getSignal(db: AppDatabase, id: string) {
  const [row] = await db.select().from(signals).where(eq(signals.id, id));
  return row ?? null;
}

export async function createLead(
  db: AppDatabase,
  raw: CreateLeadInput,
  actor: MutationActor,
) {
  const input = createLeadInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "lead.create",
      entityType: "lead",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(leads).values(row).returning();
      return created;
    },
  );
}

export async function getLead(db: AppDatabase, id: string) {
  const [row] = await db.select().from(leads).where(eq(leads.id, id));
  return row ?? null;
}

export async function createOutreach(
  db: AppDatabase,
  raw: CreateOutreachInput,
  actor: MutationActor,
) {
  const input = createOutreachInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };

  assertDryRunCannotBeSent({ status: row.status, dryRun: row.dryRun });
  assertDryRunCompleted({ status: row.status, dryRun: row.dryRun });
  if (row.status === "SENT" || row.status === "DRY_RUN_COMPLETED") {
    assertSentHasApproval({
      status: "SENT",
      outreachId: row.id,
      orgId: row.orgId,
      approval: null,
    });
  }

  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "outreach.create",
      entityType: "outreach",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(outreach).values(row).returning();
      return created;
    },
  );
}

export async function getOutreach(db: AppDatabase, id: string) {
  const [row] = await db.select().from(outreach).where(eq(outreach.id, id));
  return row ?? null;
}

export async function getOutreachForOrg(
  db: AppDatabase,
  id: string,
  orgId: string,
) {
  const [row] = await db
    .select()
    .from(outreach)
    .where(and(eq(outreach.id, id), eq(outreach.orgId, orgId)));
  return row ?? null;
}

export async function listOutreachForOrg(db: AppDatabase, orgId: string) {
  return db
    .select({
      id: outreach.id,
      orgId: outreach.orgId,
      companyId: outreach.companyId,
      channel: outreach.channel,
      subject: outreach.subject,
      body: outreach.body,
      status: outreach.status,
      dryRun: outreach.dryRun,
      variant: outreach.variant,
      sentAt: outreach.sentAt,
      createdAt: outreach.createdAt,
      updatedAt: outreach.updatedAt,
      companyName: companies.name,
      companyDomain: companies.domain,
    })
    .from(outreach)
    .leftJoin(companies, eq(outreach.companyId, companies.id))
    .where(eq(outreach.orgId, orgId))
    .orderBy(desc(outreach.updatedAt));
}

export async function updateOutreach(
  db: AppDatabase,
  id: string,
  orgId: string,
  patch: Partial<{
    subject: string | null;
    body: string;
    variant: string | null;
    status: OutreachStatus;
  }>,
  actor: MutationActor,
  action = "outreach.edit",
) {
  const current = await getOutreachForOrg(db, id, orgId);
  if (!current) {
    throw new DomainError(
      "OUTREACH_NOT_FOUND",
      `Outreach ${id} was not found for this org`,
    );
  }
  if (patch.status && patch.status !== current.status) {
    assertOutreachTransition(current.status, patch.status);
    assertDryRunCannotBeSent({ status: patch.status, dryRun: current.dryRun });
    assertDryRunCompleted({ status: patch.status, dryRun: current.dryRun });
  }

  const stamped = now();
  const next = { ...patch, updatedAt: stamped };
  return withAudit(
    db,
    {
      orgId: current.orgId,
      actor,
      action,
      entityType: "outreach",
      entityId: current.id,
      before: current,
      after: { ...current, ...next },
    },
    async (tx) => {
      const [updated] = await tx
        .update(outreach)
        .set(next)
        .where(eq(outreach.id, current.id))
        .returning();
      return updated;
    },
  );
}

export async function listFieldAssertionsWithCitations(
  db: AppDatabase,
  orgId: string,
  entityType: EntityType,
  entityIds: string[],
) {
  if (entityIds.length === 0) {
    return [];
  }

  const assertions = await db
    .select()
    .from(fieldAssertions)
    .where(
      and(
        eq(fieldAssertions.orgId, orgId),
        eq(fieldAssertions.entityType, entityType),
        inArray(fieldAssertions.entityId, entityIds),
      ),
    );

  const assertionIds = assertions.map((assertion) => assertion.id);
  const links = assertionIds.length
    ? await db
        .select()
        .from(fieldAssertionCitations)
        .where(inArray(fieldAssertionCitations.assertionId, assertionIds))
    : [];
  const citationIds = [...new Set(links.map((link) => link.citationId))];
  const citationRows = citationIds.length
    ? await db.select().from(citations).where(inArray(citations.id, citationIds))
    : [];
  const citationsById = new Map(
    citationRows.map((citation) => [citation.id, citation]),
  );
  const citationsByAssertion = new Map<string, typeof citationRows>();
  for (const link of links) {
    const list = citationsByAssertion.get(link.assertionId) ?? [];
    const citation = citationsById.get(link.citationId);
    if (citation) {
      list.push(citation);
    }
    citationsByAssertion.set(link.assertionId, list);
  }

  return assertions.map((assertion) => ({
    ...assertion,
    citations: citationsByAssertion.get(assertion.id) ?? [],
  }));
}

export async function getLatestOutreachApproval(
  db: AppDatabase,
  outreachId: string,
) {
  const [row] = await db
    .select()
    .from(outreachApprovals)
    .where(eq(outreachApprovals.outreachId, outreachId))
    .orderBy(desc(outreachApprovals.approvedAt))
    .limit(1);
  return row ?? null;
}

export async function approveOutreach(
  db: AppDatabase,
  input: {
    outreachId: string;
    approvedBy: string;
    decision: "APPROVED" | "REJECTED";
    note?: string;
  },
  actor: MutationActor,
) {
  const current = await getOutreach(db, input.outreachId);
  if (!current) {
    throw new Error(`Outreach ${input.outreachId} not found`);
  }

  const nextStatus = input.decision;
  assertOutreachTransition(current.status, nextStatus);

  const stamped = now();
  const approvalRow = {
    id: newId(),
    orgId: current.orgId,
    outreachId: current.id,
    decision: input.decision,
    approvedBy: input.approvedBy,
    approvedAt: stamped,
    note: input.note ?? null,
    createdAt: stamped,
    updatedAt: stamped,
  };

  return withAudit(
    db,
    {
      orgId: current.orgId,
      actor,
      action: "outreach.approve",
      entityType: "outreach",
      entityId: current.id,
      before: current,
      after: { ...current, status: nextStatus, approval: approvalRow },
    },
    async (tx) => {
      await tx.insert(outreachApprovals).values(approvalRow);
      const [updated] = await tx
        .update(outreach)
        .set({ status: nextStatus, updatedAt: stamped })
        .where(eq(outreach.id, current.id))
        .returning();
      return { outreach: updated, approval: approvalRow };
    },
  );
}

export async function transitionOutreach(
  db: AppDatabase,
  input: { outreachId: string; status: OutreachStatus },
  actor: MutationActor,
) {
  const current = await getOutreach(db, input.outreachId);
  if (!current) {
    throw new Error(`Outreach ${input.outreachId} not found`);
  }

  assertOutreachTransition(current.status, input.status);
  assertDryRunCannotBeSent({ status: input.status, dryRun: current.dryRun });
  assertDryRunCompleted({ status: input.status, dryRun: current.dryRun });

  const approval = await getLatestOutreachApproval(db, current.id);
  if (input.status === "SENT" || input.status === "DRY_RUN_COMPLETED") {
    assertSentHasApproval({
      status: "SENT",
      outreachId: current.id,
      orgId: current.orgId,
      approval: approval
        ? {
            outreachId: approval.outreachId,
            orgId: approval.orgId,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            decision: approval.decision,
          }
        : null,
    });
  }

  const stamped = now();
  const next = {
    status: input.status,
    sentAt: input.status === "SENT" ? stamped : current.sentAt,
    updatedAt: stamped,
  };

  return withAudit(
    db,
    {
      orgId: current.orgId,
      actor,
      action: "outreach.transition",
      entityType: "outreach",
      entityId: current.id,
      before: current,
      after: { ...current, ...next },
    },
    async (tx) => {
      const [updated] = await tx
        .update(outreach)
        .set(next)
        .where(eq(outreach.id, current.id))
        .returning();
      return updated;
    },
  );
}

export async function createCitation(
  db: AppDatabase,
  raw: CreateCitationInput,
  actor: MutationActor,
) {
  const input = createCitationInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
    contentHash:
      input.contentHash ?? hashCitationContent(input.sourceUrl, input.quote),
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "citation.create",
      entityType: "citation",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx.insert(citations).values(row).returning();
      return created;
    },
  );
}

export async function getCitation(db: AppDatabase, id: string) {
  const [row] = await db.select().from(citations).where(eq(citations.id, id));
  return row ?? null;
}

const ENTITY_ORG_TABLES = {
  organization: organizations,
  product: products,
  icp: icps,
  company: companies,
  person: people,
  competitor: competitors,
  signal: signals,
  lead: leads,
  outreach,
  outreach_approval: outreachApprovals,
  citation: citations,
  field_assertion: fieldAssertions,
  relationship_edge: relationshipEdges,
} as const;

export async function getEntityOrgId(
  db: AppDatabase,
  entityType: EntityType,
  entityId: string,
): Promise<string | null> {
  const table = ENTITY_ORG_TABLES[entityType];
  const [row] = await db
    .select({ orgId: table.orgId })
    .from(table)
    .where(eq(table.id, entityId));
  return row?.orgId ?? null;
}

export async function createFieldAssertion(
  db: AppDatabase,
  raw: CreateFieldAssertionInput,
  actor: MutationActor,
) {
  const input = createFieldAssertionInputSchema.parse(raw);
  const linkedCitations = input.citationIds.length
    ? await db
        .select()
        .from(citations)
        .where(inArray(citations.id, input.citationIds))
    : [];

  if (linkedCitations.length !== input.citationIds.length) {
    throw new DomainError(
      "CITATION_NOT_FOUND",
      "One or more citation IDs are missing",
    );
  }
  if (linkedCitations.some((citation) => citation.orgId !== input.orgId)) {
    throw new DomainError(
      "CITATION_ORG_MISMATCH",
      "Citations must belong to the same org as the assertion",
    );
  }

  const targetOrgId = await getEntityOrgId(db, input.entityType, input.entityId);
  if (!targetOrgId) {
    throw new DomainError(
      "ENTITY_NOT_FOUND",
      "Target entity for the field assertion was not found",
    );
  }
  if (targetOrgId !== input.orgId) {
    throw new DomainError(
      "ENTITY_ORG_MISMATCH",
      "Target entity must belong to the same org as the assertion",
    );
  }

  assertVerifiedClaimHasCitation({
    verificationStatus: input.verificationStatus,
    citations: linkedCitations,
  });

  const stamped = now();
  const row = {
    id: newId(),
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldName: input.fieldName,
    fieldValue: input.fieldValue,
    verificationStatus: input.verificationStatus,
    assertedBy: input.assertedBy,
    assertedAt: input.assertedAt ?? stamped,
    createdAt: stamped,
    updatedAt: stamped,
  };

  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "field_assertion.create",
      entityType: "field_assertion",
      entityId: row.id,
      after: { ...row, citationIds: input.citationIds },
    },
    async (tx) => {
      const [created] = await tx.insert(fieldAssertions).values(row).returning();
      if (input.citationIds.length) {
        await tx.insert(fieldAssertionCitations).values(
          input.citationIds.map((citationId) => ({
            assertionId: created.id,
            citationId,
          })),
        );
      }
      return created;
    },
  );
}

export async function createRelationshipEdge(
  db: AppDatabase,
  raw: CreateRelationshipEdgeInput,
  actor: MutationActor,
) {
  const input = createRelationshipEdgeInputSchema.parse(raw);
  const stamped = now();
  const row = {
    id: newId(),
    createdAt: stamped,
    updatedAt: stamped,
    ...input,
  };
  return withAudit(
    db,
    {
      orgId: input.orgId,
      actor,
      action: "relationship_edge.create",
      entityType: "relationship_edge",
      entityId: row.id,
      after: row,
    },
    async (tx) => {
      const [created] = await tx
        .insert(relationshipEdges)
        .values(row)
        .returning();
      return created;
    },
  );
}

export async function listAuditEvents(
  db: AppDatabase,
  query: {
    orgId: string;
    entityType?: EntityType;
    entityId?: string;
    limit?: number;
  },
) {
  const filters = [eq(auditEvents.orgId, query.orgId)];
  if (query.entityType) {
    filters.push(eq(auditEvents.entityType, query.entityType));
  }
  if (query.entityId) {
    filters.push(eq(auditEvents.entityId, query.entityId));
  }

  return db
    .select()
    .from(auditEvents)
    .where(and(...filters))
    .orderBy(desc(auditEvents.createdAt))
    .limit(query.limit ?? 50);
}
