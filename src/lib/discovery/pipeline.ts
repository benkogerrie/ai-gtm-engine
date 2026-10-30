import type { MutationActor } from "@/domain";
import type { AppDatabase } from "@/db/client";
import { newId } from "@/db/ids";
import {
  createLlmClient,
  createMockLlmClient,
  isLlmConfigured,
  type LlmClient,
} from "@/lib/llm";
import {
  createSearchClient,
  isSearchConfigured,
  type SearchClient,
  type SearchResult,
} from "@/lib/search";
import {
  extractCandidatesFromResults,
  extractCandidatesWithLlm,
  extractCompetitorCategoriesFromResults,
  extractCompetitorCategoriesWithLlm,
  refineQueriesWithLlm,
} from "./extract";
import {
  dedupeByDomain,
  isBlockedCompanyDomain,
  isRejectedSourceUrl,
  normalizeDomain,
} from "./filters";
import { persistCompetitorCategories, persistProspects } from "./persist";
import { countryFromGeographies, buildCompetitorQuery, buildDiscoveryQueries } from "./queries";
import {
  ensureDiscoveryOrg,
  writeDiscoveryRunAudit,
} from "./runs";
import { scoreProspect } from "./score";
import {
  citationEligibleClaims,
  isClaimUrlAllowed,
  validateCandidates,
} from "./validate";
import {
  DISCOVERY_RUN_ACTIONS,
  type CompetitorCategoryInsight,
  type DiscoveryCandidate,
  type DiscoveryInput,
  type DiscoveryMode,
  type DiscoveryRunSnapshot,
  type ScoredProspect,
} from "./types";

export type DiscoveryDeps = {
  db: AppDatabase;
  orgId: string;
  actor: MutationActor;
  search?: SearchClient;
  llm?: LlmClient;
  runId?: string;
  now?: () => Date;
};

function resolveMode(search: SearchClient, llm: LlmClient | undefined): DiscoveryMode {
  if (search.provider === "mock") {
    return "MOCK";
  }
  if (!llm || llm.provider === "mock" || !isLlmConfigured()) {
    return "MOCK";
  }
  return "LIVE";
}

export function createDiscoveryClients(): {
  search: SearchClient;
  llm: LlmClient | undefined;
} {
  const search = createSearchClient({ allowMockIfUnconfigured: true });
  const llm = isLlmConfigured()
    ? createLlmClient()
    : createMockLlmClient();
  return { search, llm: isLlmConfigured() ? llm : undefined };
}

async function searchAll(
  search: SearchClient,
  queries: string[],
  country?: string,
): Promise<SearchResult[]> {
  const collected: SearchResult[] = [];
  for (const query of queries) {
    const hits = await search.search(query, {
      count: 10,
      ...(country ? { country } : {}),
    });
    collected.push(...hits);
  }
  return collected;
}

function mergeCandidates(
  primary: DiscoveryCandidate[],
  extra: DiscoveryCandidate[],
): DiscoveryCandidate[] {
  const byDomain = new Map<string, DiscoveryCandidate>();
  for (const candidate of [...primary, ...extra]) {
    const domain = normalizeDomain(candidate.domain);
    if (!domain) {
      continue;
    }
    const current = byDomain.get(domain);
    if (!current) {
      byDomain.set(domain, { ...candidate, domain });
      continue;
    }
    byDomain.set(domain, {
      ...current,
      whyFit: current.whyFit.length >= candidate.whyFit.length
        ? current.whyFit
        : candidate.whyFit,
      claims: [...current.claims, ...candidate.claims],
      signals: [...current.signals, ...candidate.signals],
    });
  }
  return [...byDomain.values()];
}

export async function runDiscovery(
  input: DiscoveryInput,
  deps: DiscoveryDeps,
): Promise<DiscoveryRunSnapshot> {
  const search = deps.search ?? createDiscoveryClients().search;
  const llm = deps.llm ?? createDiscoveryClients().llm;
  const mode = resolveMode(search, llm);
  const createdAt = (deps.now ?? (() => new Date()))().toISOString();
  const runId = deps.runId ?? newId();

  await ensureDiscoveryOrg(deps.db, deps.orgId, deps.actor);

  let snapshot: DiscoveryRunSnapshot = {
    id: runId,
    orgId: deps.orgId,
    status: "running",
    mode,
    input,
    queries: [],
    prospects: [],
    competitorCategories: [],
    rejectedClaimCount: 0,
    droppedCompanyCount: 0,
    error: null,
    createdAt,
    updatedAt: createdAt,
  };

  await writeDiscoveryRunAudit(
    deps.db,
    snapshot,
    deps.actor,
    DISCOVERY_RUN_ACTIONS.STARTED,
  );

  try {
    let queries = buildDiscoveryQueries(input);
    if (mode === "LIVE" && llm) {
      queries = await refineQueriesWithLlm(llm, input, queries);
    }

    const country = countryFromGeographies(input.geographies);
    const prospectResults = await searchAll(search, queries, country);
    const competitorQuery = buildCompetitorQuery(input);
    const competitorResults = await search.search(competitorQuery, {
      count: 8,
      ...(country ? { country } : {}),
    });
    const allResults = [...prospectResults, ...competitorResults];

    const deterministic = extractCandidatesFromResults(
      prospectResults,
      input.excludeDomains,
    );
    let llmCandidates: DiscoveryCandidate[] = [];
    if (llm) {
      try {
        llmCandidates = await extractCandidatesWithLlm(llm, input, prospectResults);
      } catch {
        llmCandidates = [];
      }
    }

    const merged = mergeCandidates(llmCandidates, deterministic);
    const validated = validateCandidates(merged, allResults);

    const filtered = validated.kept.filter((candidate) => {
      if (isBlockedCompanyDomain(candidate.domain, input.excludeDomains)) {
        return false;
      }
      const eligible = citationEligibleClaims(candidate.claims, allResults);
      return eligible.length > 0;
    });

    const unique = dedupeByDomain(filtered);
    const scored: ScoredProspect[] = unique.map((candidate) => {
      const { fitScore, rationale } = scoreProspect(candidate, input);
      const eligibleClaims = citationEligibleClaims(candidate.claims, allResults);
      return {
        name: candidate.name,
        domain: candidate.domain,
        websiteUrl: `https://${candidate.domain}`,
        whyFit: candidate.whyFit,
        fitScore,
        rationale,
        signals: candidate.signals.filter((signal) =>
          isClaimUrlAllowed(signal.sourceUrl, new Set(allResults.map((r) => r.url))),
        ),
        claims: eligibleClaims,
      };
    });

    scored.sort((left, right) => right.fitScore - left.fitScore);
    const top = scored.slice(0, 12);

    const persistedProspects =
      search.provider === "mock"
        ? []
        : await persistProspects(
            deps.db,
            deps.orgId,
            deps.actor,
            top,
            allResults,
            input.industries[0] ?? null,
            input.geographies?.[0] ?? null,
          );

    let competitorCategories: CompetitorCategoryInsight[] = [];
    if (llm) {
      try {
        competitorCategories = await extractCompetitorCategoriesWithLlm(
          llm,
          input,
          competitorResults,
        );
      } catch {
        competitorCategories = extractCompetitorCategoriesFromResults(
          competitorResults,
        );
      }
    } else {
      competitorCategories = extractCompetitorCategoriesFromResults(
        competitorResults,
      );
    }

    competitorCategories = competitorCategories.filter(
      (category) =>
        isClaimUrlAllowed(
          category.sourceUrl,
          new Set(allResults.map((result) => result.url)),
        ) && !isRejectedSourceUrl(category.sourceUrl),
    );

    const persistedCategories =
      search.provider === "mock"
        ? []
        : await persistCompetitorCategories(
            deps.db,
            deps.orgId,
            deps.actor,
            competitorCategories,
            allResults,
          );

    const droppedForMissingCitation =
      validated.kept.length - filtered.length + validated.droppedCompanyCount;

    snapshot = {
      ...snapshot,
      status: "completed",
      queries: [...queries, competitorQuery],
      prospects: persistedProspects,
      competitorCategories: persistedCategories,
      rejectedClaimCount: validated.rejectedClaimCount,
      droppedCompanyCount: droppedForMissingCitation,
      updatedAt: (deps.now ?? (() => new Date()))().toISOString(),
    };

    return writeDiscoveryRunAudit(
      deps.db,
      snapshot,
      deps.actor,
      DISCOVERY_RUN_ACTIONS.COMPLETED,
    );
  } catch (error) {
    snapshot = {
      ...snapshot,
      status: "failed",
      error: error instanceof Error ? error.message : "Discovery run failed",
      updatedAt: (deps.now ?? (() => new Date()))().toISOString(),
    };
    await writeDiscoveryRunAudit(
      deps.db,
      snapshot,
      deps.actor,
      DISCOVERY_RUN_ACTIONS.FAILED,
    );
    return snapshot;
  }
}

export function isDiscoveryConfigured(
  env: NodeJS.ProcessEnv = process.env,
): { search: boolean; llm: boolean } {
  return {
    search: isSearchConfigured(env),
    llm: isLlmConfigured(env),
  };
}
