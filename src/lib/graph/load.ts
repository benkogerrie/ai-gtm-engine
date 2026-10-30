import { structuredIcpSchema } from "@/domain";
import type { AppDatabase } from "@/db/client";
import {
  getIcpForOrg,
  getProduct,
  listCompanies,
  listFieldAssertionsWithCitations,
  listIcpsForOrg,
} from "@/db/repository";
import { aggregateByOrganization } from "@/lib/discovery/names";
import { listDiscoveryRuns } from "@/lib/discovery/runs";
import type {
  DiscoveryInput,
  DiscoveryRunSnapshot,
  ScoredProspect,
} from "@/lib/discovery/types";
import { selectDashboardRun } from "@/lib/pipeline/board";
import { buildKnowledgeGraph } from "./builder";
import { rankProspectMatches } from "./path";
import type {
  GraphIcpInput,
  GraphProspectInput,
  KnowledgeGraph,
  MatchPath,
} from "./types";

export type GraphIcpOption = {
  id: string;
  name: string;
  status: string;
  approvedAt: string | null;
};

export type GraphRunOption = {
  id: string;
  status: string;
  mode: "LIVE" | "MOCK";
  createdAt: string;
  updatedAt: string;
  prospectCount: number;
};

export type GraphEmptyReason =
  | "no-icp"
  | "no-run"
  | "no-prospects"
  | "mock-empty"
  | null;

export type GraphSnapshot = {
  icp: GraphIcpOption | null;
  icps: GraphIcpOption[];
  run: GraphRunOption | null;
  runs: GraphRunOption[];
  sellerName: string | null;
  graph: KnowledgeGraph;
  matches: MatchPath[];
  mock: boolean;
  emptyReason: GraphEmptyReason;
};

function toRunOption(run: DiscoveryRunSnapshot): GraphRunOption {
  return {
    id: run.id,
    status: run.status,
    mode: run.mode,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    prospectCount: run.prospects.length,
  };
}

function sellerNameFromSummary(summary: string): string {
  const cut = summary.split(/\s[—–-]\s/)[0]?.trim();
  if (cut && cut.length > 0 && cut.length <= 80) {
    return cut;
  }
  return summary.slice(0, 60).trim();
}

function icpFromStored(
  icp: {
    id: string;
    name: string;
    targetIndustries: string[];
    buyerPersonas: unknown;
    triggerEvents: string[];
    structured: unknown;
  },
  runInput?: DiscoveryInput,
): GraphIcpInput {
  const structured = structuredIcpSchema.safeParse(icp.structured);
  if (structured.success) {
    return {
      id: icp.id,
      name: icp.name,
      industries: structured.data.targetIndustries.map((industry) => ({
        name: industry.name,
        naics: industry.naics,
        label: industry.naicsValidation.label,
      })),
      personas: structured.data.buyerPersonas.map((persona) => ({
        title: persona.title,
      })),
      triggers: structured.data.triggerEvents.map((trigger) => ({
        summary: trigger.summary,
        type: trigger.type,
      })),
    };
  }

  const industries =
    icp.targetIndustries.length > 0
      ? icp.targetIndustries.map((name) => ({ name }))
      : (runInput?.industries ?? []).map((name) => ({ name }));
  const personasFromJson = Array.isArray(icp.buyerPersonas)
    ? icp.buyerPersonas
        .map((persona) => {
          if (typeof persona === "string" && persona.trim()) {
            return { title: persona.trim() };
          }
          if (
            persona &&
            typeof persona === "object" &&
            "title" in persona &&
            typeof persona.title === "string" &&
            persona.title.trim()
          ) {
            return { title: persona.title.trim() };
          }
          return null;
        })
        .filter((persona): persona is { title: string } => persona !== null)
    : [];
  const personas =
    personasFromJson.length > 0
      ? personasFromJson
      : (runInput?.personas ?? []).map((title) => ({ title }));
  const triggers =
    icp.triggerEvents.length > 0
      ? icp.triggerEvents.map((summary) => ({ summary }))
      : (runInput?.triggers ?? []).map((summary) => ({ summary }));

  return {
    id: icp.id,
    name: icp.name,
    industries,
    personas,
    triggers,
  };
}

function emptyReason(input: {
  icp: GraphIcpOption | null;
  run: GraphRunOption | null;
  prospectCount: number;
  mock: boolean;
}): GraphEmptyReason {
  if (!input.icp) {
    return "no-icp";
  }
  if (!input.run) {
    return "no-run";
  }
  if (input.prospectCount === 0) {
    return input.mock ? "mock-empty" : "no-prospects";
  }
  return null;
}

export async function loadGraph(
  db: AppDatabase,
  orgId: string,
  options: { icpId?: string; runId?: string } = {},
): Promise<GraphSnapshot> {
  const icpRows = await listIcpsForOrg(db, orgId);
  const icps: GraphIcpOption[] = icpRows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
  }));
  const approved = icps
    .filter((icp) => icp.status === "APPROVED")
    .sort((left, right) =>
      (right.approvedAt ?? "").localeCompare(left.approvedAt ?? ""),
    );
  const selected =
    (options.icpId ? icps.find((icp) => icp.id === options.icpId) : undefined) ??
    approved[0] ??
    icps[0] ??
    null;

  const listed = selected
    ? await listDiscoveryRuns(db, orgId, { limit: 20, icpId: selected.id })
    : [];
  const completed = listed.filter((run) => run.status === "completed");
  const selectedRun = selectDashboardRun(listed, options.runId);
  const icpRow = selected
    ? await getIcpForOrg(db, selected.id, orgId)
    : null;
  const product = icpRow ? await getProduct(db, icpRow.productId) : null;

  const seller = product
    ? { id: product.id, name: product.name }
    : selectedRun?.input.productSummary
      ? {
          id: `run:${selectedRun.id}:seller`,
          name: sellerNameFromSummary(selectedRun.input.productSummary),
        }
      : null;

  const icpInput = icpRow
    ? icpFromStored(icpRow, selectedRun?.input)
    : null;

  const runProspects = selectedRun
    ? (selectedRun.prospects as ScoredProspect[])
    : [];
  const aggregated = aggregateByOrganization(runProspects);
  const companies = await listCompanies(db, orgId);
  const companiesById = new Map(companies.map((company) => [company.id, company]));
  const companyIds = aggregated
    .map((prospect) => prospect.companyId)
    .filter((id): id is string => Boolean(id));
  const assertions = await listFieldAssertionsWithCitations(
    db,
    orgId,
    "company",
    companyIds,
  );
  const verifiedUrlsByCompany = new Map<string, string[]>();
  for (const assertion of assertions) {
    if (assertion.verificationStatus !== "VERIFIED") {
      continue;
    }
    const urls = verifiedUrlsByCompany.get(assertion.entityId) ?? [];
    for (const citation of assertion.citations) {
      urls.push(citation.sourceUrl);
    }
    verifiedUrlsByCompany.set(assertion.entityId, urls);
  }

  const prospects: GraphProspectInput[] = [];
  for (const prospect of aggregated) {
    const id = prospect.companyId ?? `name:${prospect.name}:${prospect.domain}`;
    const company = prospect.companyId
      ? companiesById.get(prospect.companyId)
      : undefined;
    const verifiedUrls = prospect.companyId
      ? verifiedUrlsByCompany.get(prospect.companyId)
      : undefined;
    prospects.push({
      id,
      name: prospect.name || company?.name || id,
      domain: prospect.domain || company?.domain,
      industry: company?.industry ?? null,
      fitScore: prospect.fitScore ?? company?.fitScore,
      rationale: prospect.rationale,
      whyFit: prospect.whyFit,
      claims: prospect.claims,
      signals: prospect.signals,
      verifiedUrls,
    });
  }

  const graph = buildKnowledgeGraph({
    seller,
    icp: icpInput,
    prospects,
  });
  const matches = rankProspectMatches(graph, {
    sellerId: seller?.id,
    icpId: icpInput?.id,
  });
  const mock = selectedRun?.mode === "MOCK";

  return {
    icp: selected,
    icps,
    run: selectedRun ? toRunOption(selectedRun) : null,
    runs: completed.map(toRunOption),
    sellerName: seller?.name ?? null,
    graph,
    matches,
    mock: Boolean(mock),
    emptyReason: emptyReason({
      icp: selected,
      run: selectedRun ? toRunOption(selectedRun) : null,
      prospectCount: prospects.length,
      mock: Boolean(mock),
    }),
  };
}
