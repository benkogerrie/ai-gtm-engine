import type { AppDatabase } from "@/db/client";
import {
  listAuditEvents,
  listCompanies,
  listFieldAssertionsWithCitations,
  listIcpsForOrg,
  listOutreachForOrg,
} from "@/db/repository";
import { isOutsideIcpGeography } from "@/lib/discovery/geography";
import { labelDiscoveryClaim } from "@/lib/discovery/labels";
import { aggregateByOrganization } from "@/lib/discovery/names";
import { listDiscoveryRuns } from "@/lib/discovery/runs";
import type {
  DiscoveryRunSnapshot,
  EvidenceLabel,
  EvidenceRelevance,
  ScoredProspect,
} from "@/lib/discovery/types";
import {
  allowedPipelineMoves,
  deriveAutoStage,
  hasDryRunCompletedAudit,
  parseManualStageMove,
  PIPELINE_STAGES,
  resolveDisplayedStage,
  type PipelineRecords,
  type PipelineStage,
} from "./stages";

export type DashboardIcpOption = {
  id: string;
  name: string;
  status: string;
  approvedAt: string | null;
};

export type DashboardEvidence = {
  url: string;
  title: string;
  domain: string;
  label: EvidenceLabel;
  relevance?: EvidenceRelevance;
};

export type DashboardCard = {
  companyId: string;
  name: string;
  domain: string | null;
  websiteUrl: string | null;
  fitScore: number | null;
  rationale: string;
  evidenceRelevance: EvidenceRelevance | null;
  stage: PipelineStage;
  stageSource: "derived" | "manual";
  stageAt: string | null;
  stageActor: string | null;
  allowedMoves: PipelineStage[];
  outreachId: string | null;
  channels: Array<"EMAIL" | "LINKEDIN">;
  evidence: DashboardEvidence[];
};

export type DashboardRunOption = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  prospectCount: number;
};

export type DashboardSnapshot = {
  icp: DashboardIcpOption | null;
  icps: DashboardIcpOption[];
  run: DashboardRunOption | null;
  runs: DashboardRunOption[];
  cards: DashboardCard[];
  stageCounts: Record<PipelineStage, number>;
  channelCounts: { email: number; linkedin: number };
};

export function selectDashboardRun(
  runs: DiscoveryRunSnapshot[],
  requestedRunId?: string,
): DiscoveryRunSnapshot | null {
  const completed = runs.filter((run) => run.status === "completed");
  if (requestedRunId) {
    return (
      completed.find((run) => run.id === requestedRunId) ?? completed[0] ?? null
    );
  }
  return completed[0] ?? null;
}

function toRunOption(run: DiscoveryRunSnapshot): DashboardRunOption {
  return {
    id: run.id,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    prospectCount: run.prospects.length,
  };
}

function emptyCounts(): Record<PipelineStage, number> {
  return Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
    PipelineStage,
    number
  >;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function recordsFromOutreach(
  rows: Array<{
    status: string;
    id: string;
    channel: string;
  }>,
  dryRunCompleted: boolean,
): PipelineRecords & { outreachId: string | null; channels: Array<"EMAIL" | "LINKEDIN"> } {
  const channels = [
    ...new Set(
      rows
        .map((row) => row.channel)
        .filter((channel): channel is "EMAIL" | "LINKEDIN" =>
          channel === "EMAIL" || channel === "LINKEDIN",
        ),
    ),
  ];
  const latest = rows[0] ?? null;
  return {
    prospectExists: true,
    hasDraft: rows.some(
      (row) => row.status === "DRAFT" || row.status === "PENDING_APPROVAL",
    ),
    hasApproved: rows.some((row) => row.status === "APPROVED"),
    hasDryRunCompletedAudit: dryRunCompleted,
    hasRejected: rows.some((row) => row.status === "REJECTED"),
    outreachId: latest?.id ?? null,
    channels,
  };
}

export async function loadDashboard(
  db: AppDatabase,
  orgId: string,
  options: { icpId?: string; runId?: string } = {},
): Promise<DashboardSnapshot> {
  const icpRows = await listIcpsForOrg(db, orgId);
  const icps: DashboardIcpOption[] = icpRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
  }));
  const approved = icps
    .filter((icp) => icp.status === "APPROVED")
    .sort((left, right) => (right.approvedAt ?? "").localeCompare(left.approvedAt ?? ""));
  const selected =
    (options.icpId
      ? icps.find((icp) => icp.id === options.icpId)
      : undefined) ??
    approved[0] ??
    icps[0] ??
    null;

  const listed = selected
    ? await listDiscoveryRuns(db, orgId, { limit: 20, icpId: selected.id })
    : [];
  const completed = listed.filter((run) => run.status === "completed");
  const selectedRun = selectDashboardRun(listed, options.runId);
  const runProspects = selectedRun
    ? (selectedRun.prospects as ScoredProspect[]).filter(
        (prospect) =>
          !isOutsideIcpGeography(prospect, selectedRun.input.geographies),
      )
    : [];
  const aggregated = aggregateByOrganization(runProspects);

  const [companies, outreachRows, companyEvents, outreachEvents] = await Promise.all([
    listCompanies(db, orgId),
    listOutreachForOrg(db, orgId),
    listAuditEvents(db, { orgId, entityType: "company", limit: 200 }),
    listAuditEvents(db, { orgId, entityType: "outreach", limit: 200 }),
  ]);

  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const outreachByCompany = new Map<string, typeof outreachRows>();
  for (const row of outreachRows) {
    if (!row.companyId) {
      continue;
    }
    const list = outreachByCompany.get(row.companyId) ?? [];
    list.push(row);
    outreachByCompany.set(row.companyId, list);
  }

  const dryRunByOutreach = new Set<string>();
  for (const event of outreachEvents) {
    if (hasDryRunCompletedAudit(event)) {
      dryRunByOutreach.add(event.entityId);
    }
  }

  const manualByCompany = new Map<
    string,
    { stage: PipelineStage; actorId: string; at: string }
  >();
  for (const event of companyEvents) {
    if (manualByCompany.has(event.entityId)) {
      continue;
    }
    const parsed = parseManualStageMove(event);
    if (parsed) {
      manualByCompany.set(event.entityId, parsed);
    }
  }

  const companyIds = aggregated
    .map((prospect) => prospect.companyId)
    .filter((id): id is string => Boolean(id));
  const assertions = await listFieldAssertionsWithCitations(
    db,
    orgId,
    "company",
    companyIds,
  );
  const verifiedUrlsByCompany = new Map<string, Set<string>>();
  for (const assertion of assertions) {
    if (assertion.verificationStatus !== "VERIFIED") {
      continue;
    }
    const urls = verifiedUrlsByCompany.get(assertion.entityId) ?? new Set<string>();
    for (const citation of assertion.citations) {
      urls.add(citation.sourceUrl);
    }
    verifiedUrlsByCompany.set(assertion.entityId, urls);
  }

  const cards: DashboardCard[] = [];
  for (const prospect of aggregated) {
    const company = prospect.companyId
      ? companiesById.get(prospect.companyId)
      : undefined;
    if (!prospect.companyId || !company) {
      continue;
    }
    const outreach = outreachByCompany.get(company.id) ?? [];
    const dryRun = outreach.some((row) => dryRunByOutreach.has(row.id));
    const recordExtras = recordsFromOutreach(outreach, dryRun);
    const records: PipelineRecords = {
      prospectExists: true,
      hasDraft: recordExtras.hasDraft,
      hasApproved: recordExtras.hasApproved,
      hasDryRunCompletedAudit: recordExtras.hasDryRunCompletedAudit,
      hasRejected: recordExtras.hasRejected,
    };
    const derived = deriveAutoStage(records);
    if (!derived) {
      continue;
    }
    const manual = manualByCompany.get(company.id);
    const displayed = resolveDisplayedStage({
      records,
      manualStage: manual?.stage,
    });
    if (!displayed.stage) {
      continue;
    }

    const verifiedUrls = verifiedUrlsByCompany.get(company.id) ?? new Set<string>();
    const evidence: DashboardEvidence[] = [];
    const seen = new Set<string>();
    for (const claim of prospect.claims) {
      if (seen.has(claim.sourceUrl)) {
        continue;
      }
      seen.add(claim.sourceUrl);
      evidence.push({
        url: claim.sourceUrl,
        title: claim.sourceTitle?.trim() || hostOf(claim.sourceUrl),
        domain: claim.sourceDomain ?? hostOf(claim.sourceUrl),
        label: labelDiscoveryClaim({
          field: claim.field,
          sourceUrl: claim.sourceUrl,
          verifiedUrls,
        }),
        relevance: claim.relevance ?? prospect.evidenceRelevance,
      });
    }

    cards.push({
      companyId: company.id,
      name: prospect.name || company.name,
      domain: prospect.domain || company.domain,
      websiteUrl: prospect.websiteUrl ?? company.websiteUrl,
      fitScore: prospect.fitScore ?? company.fitScore,
      rationale: prospect.rationale,
      evidenceRelevance: prospect.evidenceRelevance ?? null,
      stage: displayed.stage,
      stageSource: displayed.source,
      stageAt: displayed.source === "manual" ? (manual?.at ?? null) : null,
      stageActor: displayed.source === "manual" ? (manual?.actorId ?? null) : null,
      allowedMoves: allowedPipelineMoves(records),
      outreachId: recordExtras.outreachId,
      channels: recordExtras.channels,
      evidence,
    });
  }

  cards.sort((left, right) => (right.fitScore ?? 0) - (left.fitScore ?? 0));

  const stageCounts = emptyCounts();
  const channelCounts = { email: 0, linkedin: 0 };
  for (const card of cards) {
    stageCounts[card.stage] += 1;
    if (card.channels.includes("EMAIL")) {
      channelCounts.email += 1;
    }
    if (card.channels.includes("LINKEDIN")) {
      channelCounts.linkedin += 1;
    }
  }

  return {
    icp: selected,
    icps,
    run: selectedRun ? toRunOption(selectedRun) : null,
    runs: completed.map(toRunOption),
    cards,
    stageCounts,
    channelCounts,
  };
}
