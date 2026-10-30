import type { MutationActor } from "@/domain";
import type { AppDatabase } from "@/db/client";
import { newId } from "@/db/ids";
import {
  createLlmClient,
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
  collectVendors,
  filterBuyers,
  isCredibleCompetitorCitation,
  vendorsToCompetitorCategory,
} from "./classify";
import {
  extractCandidatesFromResults,
  extractCandidatesWithLlm,
  extractCompetitorCategoriesFromResults,
  extractCompetitorCategoriesWithLlm,
  refineQueriesWithLlm,
} from "./extract";
import {
  isBlockedCompanyDomain,
  isRejectedSourceUrl,
  normalizeDomain,
} from "./filters";
import { hostFromUrl } from "./filters";
import { cleanText } from "./html";
import { isOutsideIcpGeography } from "./geography";
import { aggregateByOrganization } from "./names";
import { persistCompetitorCategories, persistProspects } from "./persist";
import { countryFromGeographies, buildCompetitorQuery, buildDiscoveryQueries } from "./queries";
import {
  ensureDiscoveryOrg,
  writeDiscoveryRunAudit,
} from "./runs";
import { scoreFromLlm, scoreProspect } from "./score";
import {
  citationEligibleClaims,
  isClaimUrlAllowed,
  resultByUrl,
  validateCandidates,
} from "./validate";
import {
  DISCOVERY_RUN_ACTIONS,
  type CompetitorCategoryInsight,
  type DiscoveryCandidate,
  type DiscoveryInput,
  type DiscoveryMode,
  type DiscoveryPath,
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
  if (!llm || llm.provider === "mock") {
    return "MOCK";
  }
  return "LIVE";
}

export function createDiscoveryClients(): {
  search: SearchClient;
  llm: LlmClient | undefined;
} {
  const search = createSearchClient({ allowMockIfUnconfigured: true });
  if (!isLlmConfigured()) {
    return { search, llm: undefined };
  }
  return { search, llm: createLlmClient() };
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

function decorateClaims(
  candidate: DiscoveryCandidate,
  results: SearchResult[],
): DiscoveryCandidate {
  return {
    ...candidate,
    claims: candidate.claims.map((claim) => {
      const result = resultByUrl(results, claim.sourceUrl);
      return {
        ...claim,
        quote: cleanText(claim.quote, 400),
        sourceTitle: claim.sourceTitle ?? (result ? cleanText(result.title) : undefined),
        sourceDomain: claim.sourceDomain ?? hostFromUrl(claim.sourceUrl) ?? undefined,
      };
    }),
  };
}

function websiteFor(domain: string): string | null {
  const host = normalizeDomain(domain);
  return host ? `https://${host}` : null;
}

function keepCredibleCategories(
  categories: CompetitorCategoryInsight[],
  results: SearchResult[],
): CompetitorCategoryInsight[] {
  const allowed = new Set(results.map((result) => result.url));
  return categories.filter(
    (category) =>
      isClaimUrlAllowed(category.sourceUrl, allowed) &&
      !isRejectedSourceUrl(category.sourceUrl) &&
      isCredibleCompetitorCitation({
        sourceUrl: category.sourceUrl,
        quote: category.quote,
        category: category.category,
      }),
  );
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
  let extractionPath: DiscoveryPath = mode === "LIVE" ? "deepseek" : "heuristic";
  let scoringPath: DiscoveryPath = mode === "LIVE" ? "deepseek" : "heuristic";

  await ensureDiscoveryOrg(deps.db, deps.orgId, deps.actor);

  let snapshot: DiscoveryRunSnapshot = {
    id: runId,
    orgId: deps.orgId,
    icpId: input.icpId,
    status: "running",
    mode,
    input,
    queries: [],
    prospects: [],
    competitorCategories: [],
    rejectedClaimCount: 0,
    droppedCompanyCount: 0,
    error: null,
    extractionPath,
    scoringPath,
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

    let extracted: DiscoveryCandidate[] = [];
    if (mode === "LIVE") {
      if (!llm || llm.provider === "mock") {
        throw new Error(
          "LIVE discovery requires DeepSeek extraction. DEEPSEEK_API_KEY is missing or a mock LLM was supplied.",
        );
      }
      try {
        extracted = await extractCandidatesWithLlm(llm, input, prospectResults);
        extractionPath = "deepseek";
        scoringPath = "deepseek";
      } catch (error) {
        const message = error instanceof Error ? error.message : "DeepSeek extraction failed";
        throw new Error(`DeepSeek extraction failed: ${message}`);
      }
    } else {
      extracted = extractCandidatesFromResults(prospectResults, input.excludeDomains);
      extractionPath = "heuristic";
      scoringPath = "heuristic";
    }

    const decorated = extracted.map((candidate) => decorateClaims(candidate, allResults));
    const validated = validateCandidates(decorated, allResults);

    const filtered = validated.kept.filter((candidate) => {
      const domain = normalizeDomain(candidate.domain);
      if (domain && isBlockedCompanyDomain(domain, input.excludeDomains)) {
        return false;
      }
      return citationEligibleClaims(candidate.claims, allResults).length > 0;
    });

    const buyers = filterBuyers(filtered);
    const vendors = collectVendors(filtered);
    const uniqueBuyers = aggregateByOrganization(buyers);

    const scored: ScoredProspect[] = uniqueBuyers.map((candidate) => {
      if (mode === "LIVE") {
        const llmScore = scoreFromLlm(candidate);
        if (!llmScore) {
          throw new Error(
            `DeepSeek scoring missing for ${candidate.name}. Live path does not fall back to a heuristic score.`,
          );
        }
        scoringPath = "deepseek";
        const eligibleClaims = citationEligibleClaims(candidate.claims, allResults);
        return {
          name: candidate.name,
          domain: candidate.domain,
          websiteUrl: websiteFor(candidate.domain),
          whyFit: cleanText(candidate.whyFit, 400),
          fitScore: llmScore.fitScore,
          rationale: llmScore.rationale,
          evidenceRelevance: llmScore.evidenceRelevance,
          signals: candidate.signals.filter((signal) =>
            isClaimUrlAllowed(
              signal.sourceUrl,
              new Set(allResults.map((result) => result.url)),
            ),
          ),
          claims: eligibleClaims,
        };
      }
      const { fitScore, rationale, evidenceRelevance } = scoreProspect(
        candidate,
        input,
      );
      const eligibleClaims = citationEligibleClaims(candidate.claims, allResults);
      return {
        name: candidate.name,
        domain: candidate.domain,
        websiteUrl: websiteFor(candidate.domain),
        whyFit: cleanText(candidate.whyFit, 400),
        fitScore,
        rationale,
        evidenceRelevance,
        signals: candidate.signals.filter((signal) =>
          isClaimUrlAllowed(
            signal.sourceUrl,
            new Set(allResults.map((result) => result.url)),
          ),
        ),
        claims: eligibleClaims,
      };
    });

    scored.sort((left, right) => right.fitScore - left.fitScore);
    const inGeography = scored.filter(
      (prospect) => !isOutsideIcpGeography(prospect, input.geographies),
    );
    const droppedForGeography = scored.length - inGeography.length;
    const top = inGeography.slice(0, 12);

    console.info("[discovery]", {
      runId,
      mode,
      extractionPath,
      scoringPath,
      buyers: top.length,
      vendors: vendors.length,
    });

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
    if (mode === "LIVE" && llm) {
      try {
        competitorCategories = await extractCompetitorCategoriesWithLlm(
          llm,
          input,
          competitorResults,
        );
      } catch (error) {
        console.info("[discovery] competitor LLM failed; dropping categories", {
          runId,
          error: error instanceof Error ? error.message : String(error),
        });
        competitorCategories = [];
      }
    } else {
      competitorCategories = extractCompetitorCategoriesFromResults(competitorResults);
    }

    const vendorCategory = vendorsToCompetitorCategory(vendors);
    if (vendorCategory) {
      competitorCategories = [vendorCategory, ...competitorCategories];
    }
    competitorCategories = keepCredibleCategories(competitorCategories, allResults);

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
      droppedCompanyCount: droppedForMissingCitation + droppedForGeography,
      extractionPath,
      scoringPath,
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
      extractionPath,
      scoringPath,
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
