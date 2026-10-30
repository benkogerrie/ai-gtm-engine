import type { MutationActor } from "@/domain";
import type { AppDatabase } from "@/db/client";
import {
  createCitation,
  createCompany,
  createFieldAssertion,
  createSignal,
  ensureOrganization,
  listCompanies,
  listFieldAssertionsWithCitations,
  listSignalsForCompany,
} from "@/db/repository";

export const DEMO_COMPANY_NAME = "TEST — Example General Hospital";
export const DEMO_COMPANY_DOMAIN = "example.com";
export const DEMO_CITATION_URL = "https://example.com";
export const DEMO_SIGNAL_SUMMARY =
  "TEST — Example General Hospital posted a nurse staffing / night-shift scheduling role (labeled demo signal for ShiftPilot).";

export async function seedDemoCompany(
  db: AppDatabase,
  ctx: { orgId: string; actor: MutationActor },
) {
  await ensureOrganization(
    db,
    { id: ctx.orgId, name: "TEST — Demo Workspace" },
    ctx.actor,
  );

  const existing = (await listCompanies(db, ctx.orgId)).find(
    (company) =>
      company.domain === DEMO_COMPANY_DOMAIN &&
      company.name === DEMO_COMPANY_NAME,
  );

  const company =
    existing ??
    (await createCompany(
      db,
      {
        orgId: ctx.orgId,
        name: DEMO_COMPANY_NAME,
        domain: DEMO_COMPANY_DOMAIN,
        websiteUrl: DEMO_CITATION_URL,
        industry: "Hospitals and health systems (TEST / MOCK ShiftPilot prospect — not a real hospital)",
        headquarters: "TEST city",
        region: "TEST",
        negativeSignals: [],
      },
      ctx.actor,
    ));

  const signals = await listSignalsForCompany(db, ctx.orgId, company.id);
  const signal =
    signals.find((row) => row.summary === DEMO_SIGNAL_SUMMARY) ??
    (await createSignal(
      db,
      {
        orgId: ctx.orgId,
        companyId: company.id,
        type: "JOB_POSTING",
        summary: DEMO_SIGNAL_SUMMARY,
        occurredAt: new Date("2026-10-01T00:00:00.000Z"),
        strength: 40,
      },
      ctx.actor,
    ));

  const existingCited = await listFieldAssertionsWithCitations(
    db,
    ctx.orgId,
    "signal",
    [signal.id],
  );
  const alreadyCited = existingCited.some((assertion) =>
    assertion.citations.some(
      (citation) => citation.sourceUrl === DEMO_CITATION_URL,
    ),
  );

  if (!alreadyCited) {
    const citation = await createCitation(
      db,
      {
        orgId: ctx.orgId,
        sourceUrl: DEMO_CITATION_URL,
        retrievedAt: new Date("2026-10-15T12:00:00.000Z"),
        sourceType: "WEBSITE",
        quote:
          "TEST snippet from https://example.com — labeled hospital demo citation for ShiftPilot, not a real hospital page.",
        extractor: "agent",
      },
      ctx.actor,
    );

    await createFieldAssertion(
      db,
      {
        orgId: ctx.orgId,
        entityType: "signal",
        entityId: signal.id,
        fieldName: "summary",
        fieldValue: signal.summary,
        verificationStatus: "UNVERIFIED",
        assertedBy: "agent",
        citationIds: [citation.id],
      },
      ctx.actor,
    );

    await createFieldAssertion(
      db,
      {
        orgId: ctx.orgId,
        entityType: "company",
        entityId: company.id,
        fieldName: "name",
        fieldValue: company.name,
        verificationStatus: "UNVERIFIED",
        assertedBy: "agent",
        citationIds: [citation.id],
      },
      ctx.actor,
    );
  }

  return { company, signal, created: !existing };
}
