import type { MutationActor } from "@/domain";
import { DomainError } from "@/domain";
import type { AppDatabase } from "@/db/client";
import {
  approveOutreach,
  createOutreach,
  getOutreachForOrg,
  listAuditEvents,
  listCompanies,
  listOutreachForOrg,
  transitionOutreach,
  updateOutreach,
} from "@/db/repository";
import type { LlmClient } from "@/lib/llm";
import { assertHasCitedSignals, collectCitedSignals } from "./cited";
import {
  createOutreachLlmClient,
  generateOutreachDraft,
  isTestProspect,
} from "./generate";
import { isLabeledDemo, parseOutreachMeta, serializeOutreachMeta } from "./meta";
import { seedDemoCompany } from "./seed";
import type {
  OutreachCta,
  OutreachDraftMeta,
  OutreachTone,
} from "./schema";

export type OutreachAuth = { orgId: string; actor: MutationActor };

export type OutreachView = {
  id: string;
  orgId: string;
  companyId: string | null;
  companyName: string | null;
  companyDomain: string | null;
  channel: string;
  subject: string | null;
  body: string;
  linkedinMessage: string;
  status: string;
  dryRun: boolean;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tone: OutreachTone;
  cta: OutreachCta;
  sourceUrls: string[];
  citedSignals: OutreachDraftMeta["citedSignals"];
  inferenceMode: "live" | "mock";
  version: number;
  parentOutreachId: string | null;
  demo: boolean;
  labeledTest: boolean;
};

function assertOrgOutreach(
  row: { orgId: string } | null,
  orgId: string,
): asserts row is NonNullable<typeof row> {
  if (!row) {
    throw new DomainError("OUTREACH_NOT_FOUND", "Outreach was not found");
  }
  if (row.orgId !== orgId) {
    throw new DomainError(
      "OUTREACH_ORG_MISMATCH",
      "Outreach does not belong to this org",
    );
  }
}

function assertHuman(actor: MutationActor): void {
  if (actor.actorType !== "human") {
    throw new DomainError(
      "HUMAN_ACTOR_REQUIRED",
      "Approve, reject, and dry-run send require an authenticated human actor",
    );
  }
}

function viewFromRow(
  row: {
    id: string;
    orgId: string;
    companyId: string | null;
    channel: string;
    subject: string | null;
    body: string;
    status: string;
    dryRun: boolean;
    variant: string | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  company: { name: string | null; domain: string | null },
): OutreachView {
  const meta = parseOutreachMeta(row.variant);
  const inferenceMode = meta?.inferenceMode ?? "mock";
  const labeledTest = isLabeledDemo({
    companyName: company.name,
    companyDomain: company.domain,
    inferenceMode,
    demoLabel: meta?.demoLabel,
  });
  return {
    id: row.id,
    orgId: row.orgId,
    companyId: row.companyId,
    companyName: company.name,
    companyDomain: company.domain,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    linkedinMessage: meta?.linkedinMessage ?? "",
    status: row.status,
    dryRun: row.dryRun,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tone: meta?.tone ?? "professional",
    cta: meta?.cta ?? "book a call",
    sourceUrls: meta?.sourceUrls ?? [],
    citedSignals: meta?.citedSignals ?? [],
    inferenceMode,
    version: meta?.version ?? 1,
    parentOutreachId: meta?.parentOutreachId ?? null,
    demo: labeledTest,
    labeledTest,
  };
}

function terminalStatus(status: string): boolean {
  return (
    status === "REJECTED" ||
    status === "DRY_RUN_COMPLETED" ||
    status === "SENT"
  );
}

async function persistDraft(
  db: AppDatabase,
  input: {
    orgId: string;
    companyId: string;
    companyName: string;
    companyDomain: string | null;
    subject: string;
    body: string;
    linkedinMessage: string;
    tone: OutreachTone;
    cta: OutreachCta;
    sourceUrls: string[];
    citedSignals: OutreachDraftMeta["citedSignals"];
    inferenceMode: "live" | "mock";
    version: number;
    parentOutreachId: string | null;
  },
  actor: MutationActor,
) {
  const demoLabel = isLabeledDemo({
    companyName: input.companyName,
    companyDomain: input.companyDomain,
    inferenceMode: input.inferenceMode,
  })
    ? "TEST"
    : null;

  return createOutreach(
    db,
    {
      orgId: input.orgId,
      companyId: input.companyId,
      channel: "EMAIL",
      subject: input.subject,
      body: input.body,
      status: "DRAFT",
      dryRun: true,
      sentAt: null,
      variant: serializeOutreachMeta({
        kind: "b008-draft",
        linkedinMessage: input.linkedinMessage,
        tone: input.tone,
        cta: input.cta,
        sourceUrls: input.sourceUrls,
        citedSignals: input.citedSignals,
        inferenceMode: input.inferenceMode,
        version: input.version,
        parentOutreachId: input.parentOutreachId,
        demoLabel,
      }),
    },
    actor,
  );
}

export async function draftOutreachForCompany(
  db: AppDatabase,
  input: { companyId: string; tone: OutreachTone; cta: OutreachCta },
  ctx: OutreachAuth,
  client?: LlmClient,
) {
  const collected = await collectCitedSignals(db, input.companyId, ctx.orgId);
  assertHasCitedSignals(collected.cited);

  const llmClient =
    client ??
    createOutreachLlmClient({
      requireLive: !isTestProspect({
        companyName: collected.companyName,
        companyDomain: collected.companyDomain,
      }),
    }).client;

  const generated = await generateOutreachDraft(llmClient, {
    companyName: collected.companyName,
    companyDomain: collected.companyDomain,
    tone: input.tone,
    cta: input.cta,
    cited: collected.cited,
  });

  const row = await persistDraft(
    db,
    {
      orgId: ctx.orgId,
      companyId: input.companyId,
      companyName: collected.companyName,
      companyDomain: collected.companyDomain,
      subject: generated.draft.emailSubject,
      body: generated.draft.emailBody,
      linkedinMessage: generated.draft.linkedinMessage,
      tone: generated.draft.tone ?? input.tone,
      cta: generated.draft.cta ?? input.cta,
      sourceUrls: generated.sourceUrls,
      citedSignals: collected.cited.map((signal) => ({
        id: signal.id,
        kind: signal.kind,
        type: signal.type,
        summary: signal.summary,
        sourceUrls: signal.sourceUrls,
      })),
      inferenceMode: generated.inferenceMode,
      version: 1,
      parentOutreachId: null,
    },
    ctx.actor,
  );

  return viewFromRow(row, {
    name: collected.companyName,
    domain: collected.companyDomain,
  });
}

export async function editOutreachDraft(
  db: AppDatabase,
  input: {
    outreachId: string;
    subject: string;
    body: string;
    linkedinMessage: string;
  },
  ctx: OutreachAuth,
) {
  const current = await getOutreachForOrg(db, input.outreachId, ctx.orgId);
  assertOrgOutreach(current, ctx.orgId);

  const meta = parseOutreachMeta(current.variant);
  const nextMeta: OutreachDraftMeta = {
    kind: "b008-draft",
    linkedinMessage: input.linkedinMessage,
    tone: meta?.tone ?? "professional",
    cta: meta?.cta ?? "book a call",
    sourceUrls: meta?.sourceUrls ?? [],
    citedSignals: meta?.citedSignals ?? [],
    inferenceMode: meta?.inferenceMode ?? "mock",
    version: meta?.version ?? 1,
    parentOutreachId: meta?.parentOutreachId ?? null,
    demoLabel: meta?.demoLabel ?? null,
  };

  if (current.status === "APPROVED" || terminalStatus(current.status)) {
    if (!current.companyId) {
      throw new DomainError(
        "ENTITY_NOT_FOUND",
        "Outreach has no company to version",
      );
    }
    const created = await persistDraft(
      db,
      {
        orgId: ctx.orgId,
        companyId: current.companyId,
        companyName: "",
        companyDomain: null,
        subject: input.subject,
        body: input.body,
        linkedinMessage: input.linkedinMessage,
        tone: nextMeta.tone,
        cta: nextMeta.cta,
        sourceUrls: nextMeta.sourceUrls,
        citedSignals: nextMeta.citedSignals,
        inferenceMode: nextMeta.inferenceMode,
        version: nextMeta.version + 1,
        parentOutreachId: current.id,
      },
      ctx.actor,
    );
    return loadOutreachView(db, created.id, ctx.orgId);
  }

  const updated = await updateOutreach(
    db,
    current.id,
    ctx.orgId,
    {
      subject: input.subject,
      body: input.body,
      variant: serializeOutreachMeta(nextMeta),
    },
    ctx.actor,
    "outreach.edit",
  );
  return loadOutreachView(db, updated.id, ctx.orgId);
}

export async function regenerateOutreach(
  db: AppDatabase,
  input: { outreachId: string; tone: OutreachTone; cta: OutreachCta },
  ctx: OutreachAuth,
  client?: LlmClient,
) {
  const current = await getOutreachForOrg(db, input.outreachId, ctx.orgId);
  assertOrgOutreach(current, ctx.orgId);
  if (!current.companyId) {
    throw new DomainError(
      "ENTITY_NOT_FOUND",
      "Outreach has no company to regenerate from",
    );
  }

  const collected = await collectCitedSignals(db, current.companyId, ctx.orgId);
  assertHasCitedSignals(collected.cited);

  const llmClient =
    client ??
    createOutreachLlmClient({
      requireLive: !isTestProspect({
        companyName: collected.companyName,
        companyDomain: collected.companyDomain,
      }),
    }).client;
  const generated = await generateOutreachDraft(llmClient, {
    companyName: collected.companyName,
    companyDomain: collected.companyDomain,
    tone: input.tone,
    cta: input.cta,
    cited: collected.cited,
  });

  const meta = parseOutreachMeta(current.variant);
  const nextMeta: OutreachDraftMeta = {
    kind: "b008-draft",
    linkedinMessage: generated.draft.linkedinMessage,
    tone: generated.draft.tone ?? input.tone,
    cta: generated.draft.cta ?? input.cta,
    sourceUrls: generated.sourceUrls,
    citedSignals: collected.cited.map((signal) => ({
      id: signal.id,
      kind: signal.kind,
      type: signal.type,
      summary: signal.summary,
      sourceUrls: signal.sourceUrls,
    })),
    inferenceMode: generated.inferenceMode,
    version: (meta?.version ?? 1) + (current.status === "DRAFT" ? 0 : 1),
    parentOutreachId:
      current.status === "DRAFT" ? (meta?.parentOutreachId ?? null) : current.id,
    demoLabel: meta?.demoLabel ?? null,
  };

  if (current.status !== "DRAFT" && current.status !== "PENDING_APPROVAL") {
    const created = await persistDraft(
      db,
      {
        orgId: ctx.orgId,
        companyId: current.companyId,
        companyName: collected.companyName,
        companyDomain: collected.companyDomain,
        subject: generated.draft.emailSubject,
        body: generated.draft.emailBody,
        linkedinMessage: generated.draft.linkedinMessage,
        tone: nextMeta.tone,
        cta: nextMeta.cta,
        sourceUrls: nextMeta.sourceUrls,
        citedSignals: nextMeta.citedSignals,
        inferenceMode: nextMeta.inferenceMode,
        version: nextMeta.version,
        parentOutreachId: current.id,
      },
      ctx.actor,
    );
    return loadOutreachView(db, created.id, ctx.orgId);
  }

  const updated = await updateOutreach(
    db,
    current.id,
    ctx.orgId,
    {
      subject: generated.draft.emailSubject,
      body: generated.draft.emailBody,
      variant: serializeOutreachMeta(nextMeta),
    },
    ctx.actor,
    "outreach.regenerate",
  );
  return loadOutreachView(db, updated.id, ctx.orgId);
}

export async function approveOutreachDraft(
  db: AppDatabase,
  outreachId: string,
  ctx: OutreachAuth,
) {
  assertHuman(ctx.actor);
  const current = await getOutreachForOrg(db, outreachId, ctx.orgId);
  assertOrgOutreach(current, ctx.orgId);

  if (current.status === "DRAFT") {
    await transitionOutreach(
      db,
      { outreachId: current.id, status: "PENDING_APPROVAL" },
      ctx.actor,
    );
  }

  const result = await approveOutreach(
    db,
    {
      outreachId: current.id,
      approvedBy: ctx.actor.actorId,
      decision: "APPROVED",
    },
    ctx.actor,
  );
  return loadOutreachView(db, result.outreach.id, ctx.orgId);
}

export async function rejectOutreachDraft(
  db: AppDatabase,
  outreachId: string,
  ctx: OutreachAuth,
  note?: string,
) {
  assertHuman(ctx.actor);
  const current = await getOutreachForOrg(db, outreachId, ctx.orgId);
  assertOrgOutreach(current, ctx.orgId);

  const result = await approveOutreach(
    db,
    {
      outreachId: current.id,
      approvedBy: ctx.actor.actorId,
      decision: "REJECTED",
      note,
    },
    ctx.actor,
  );
  return loadOutreachView(db, result.outreach.id, ctx.orgId);
}

export async function sendOutreachDryRun(
  db: AppDatabase,
  outreachId: string,
  ctx: OutreachAuth,
) {
  assertHuman(ctx.actor);
  const current = await getOutreachForOrg(db, outreachId, ctx.orgId);
  assertOrgOutreach(current, ctx.orgId);

  if (current.status !== "APPROVED") {
    throw new DomainError(
      "OUTREACH_NOT_APPROVED",
      "Send (dry run) is allowed only after a human APPROVED decision",
    );
  }
  if (!current.dryRun) {
    throw new DomainError(
      "DRY_RUN_CANNOT_BE_SENT",
      "This slice has no real send path. Dry-run is the only completion.",
    );
  }

  await transitionOutreach(
    db,
    { outreachId: current.id, status: "DRY_RUN_COMPLETED" },
    ctx.actor,
  );
  return loadOutreachView(db, current.id, ctx.orgId);
}

export async function loadOutreachView(
  db: AppDatabase,
  outreachId: string,
  orgId: string,
): Promise<OutreachView> {
  const rows = await listOutreachForOrg(db, orgId);
  const row = rows.find((item) => item.id === outreachId);
  if (!row) {
    throw new DomainError("OUTREACH_NOT_FOUND", "Outreach was not found");
  }
  return viewFromRow(row, {
    name: row.companyName,
    domain: row.companyDomain,
  });
}

export async function listOutreachViews(db: AppDatabase, orgId: string) {
  const rows = await listOutreachForOrg(db, orgId);
  return rows.map((row) =>
    viewFromRow(row, { name: row.companyName, domain: row.companyDomain }),
  );
}

export async function listOrgCompanies(db: AppDatabase, orgId: string) {
  return listCompanies(db, orgId);
}

export async function listOutreachAudit(
  db: AppDatabase,
  orgId: string,
  outreachId: string,
) {
  return listAuditEvents(db, {
    orgId,
    entityType: "outreach",
    entityId: outreachId,
    limit: 50,
  });
}

export { seedDemoCompany };
