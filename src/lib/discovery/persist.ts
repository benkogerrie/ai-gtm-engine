import type { MutationActor } from "@/domain";
import type { AppDatabase } from "@/db/client";
import {
  createCitation,
  createCompany,
  createCompetitor,
  createFieldAssertion,
  listCompanies,
  updateCompany,
} from "@/db/repository";
import { isRealSearchEvidence, toCitationCandidate } from "@/lib/search/evidence";
import type { SearchResult } from "@/lib/search/types";
import { companiesMatchOrganization } from "./names";
import { fitTierFromScore } from "./score";
import { resultByUrl } from "./validate";
import type {
  CompetitorCategoryInsight,
  DiscoveryClaim,
  ScoredProspect,
} from "./types";

function sourceTypeForUrl(url: string): "WEBSITE" | "PRESS" | "JOB_POSTING" {
  const lower = url.toLowerCase();
  if (/\/jobs?\/|\/careers?\//.test(lower)) {
    return "JOB_POSTING";
  }
  if (/press|news|blog/.test(lower)) {
    return "PRESS";
  }
  return "WEBSITE";
}

function mapCompetitorCategory(
  label: string,
): "DIRECT" | "INDIRECT" | "ALTERNATIVE" {
  const lower = label.toLowerCase();
  if (lower.includes("direct")) {
    return "DIRECT";
  }
  if (lower.includes("indirect") || lower.includes("adjacent")) {
    return "INDIRECT";
  }
  return "ALTERNATIVE";
}

async function persistClaimCitation(
  db: AppDatabase,
  orgId: string,
  actor: MutationActor,
  claim: DiscoveryClaim,
  results: SearchResult[],
): Promise<string | null> {
  const result = resultByUrl(results, claim.sourceUrl);
  if (!result || !isRealSearchEvidence(result)) {
    return null;
  }
  const candidate = toCitationCandidate(result);
  const citation = await createCitation(
    db,
    {
      orgId,
      sourceUrl: candidate.url,
      retrievedAt: new Date(candidate.retrievedAt),
      sourceType: sourceTypeForUrl(candidate.url),
      quote: claim.quote.slice(0, 500),
      extractor: "agent",
    },
    actor,
  );
  return citation.id;
}

export async function persistProspects(
  db: AppDatabase,
  orgId: string,
  actor: MutationActor,
  prospects: ScoredProspect[],
  results: SearchResult[],
  industry: string | null,
  region: string | null,
): Promise<ScoredProspect[]> {
  const persisted: ScoredProspect[] = [];
  const known = await listCompanies(db, orgId);

  for (const prospect of prospects) {
    const websiteUrl = prospect.websiteUrl;
    const existing = known.find((company) =>
      companiesMatchOrganization(
        { name: company.name, domain: company.domain },
        { name: prospect.name, domain: prospect.domain },
      ),
    );
    const company = existing
      ? ((await updateCompany(
          db,
          existing.id,
          orgId,
          {
            fitScore: prospect.fitScore,
            fitTier: fitTierFromScore(prospect.fitScore),
          },
          actor,
        )) ?? existing)
      : await createCompany(
          db,
          {
            orgId,
            name: prospect.name,
            domain: prospect.domain || null,
            websiteUrl,
            industry,
            region,
            fitScore: prospect.fitScore,
            fitTier: fitTierFromScore(prospect.fitScore),
            negativeSignals: [],
          },
          actor,
        );
    if (!existing) {
      known.push(company);
    } else {
      const index = known.findIndex((row) => row.id === company.id);
      if (index >= 0) {
        known[index] = company;
      }
    }

    const fieldClaims: DiscoveryClaim[] = [...prospect.claims];
    if (prospect.claims[0]?.sourceUrl) {
      fieldClaims.push({
        field: "fitScore",
        value: String(prospect.fitScore),
        sourceUrl: prospect.claims[0].sourceUrl,
        quote: prospect.rationale,
      });
    }

    for (const claim of fieldClaims) {
      const citationId = await persistClaimCitation(
        db,
        orgId,
        actor,
        claim,
        results,
      );
      if (!citationId) {
        continue;
      }
      const fact = claim.field !== "fitScore" && claim.field !== "rationale";
      await createFieldAssertion(
        db,
        {
          orgId,
          entityType: "company",
          entityId: company.id,
          fieldName: claim.field,
          fieldValue:
            claim.field === "fitScore" ? prospect.fitScore : claim.value,
          verificationStatus: fact ? "VERIFIED" : "INFERRED",
          assertedBy: "agent",
          citationIds: [citationId],
        },
        actor,
      );
    }

    persisted.push({ ...prospect, companyId: company.id, websiteUrl });
  }

  return persisted;
}

export async function persistCompetitorCategories(
  db: AppDatabase,
  orgId: string,
  actor: MutationActor,
  categories: CompetitorCategoryInsight[],
  results: SearchResult[],
): Promise<CompetitorCategoryInsight[]> {
  const persisted: CompetitorCategoryInsight[] = [];

  for (const category of categories) {
    const result = resultByUrl(results, category.sourceUrl);
    if (!result || !isRealSearchEvidence(result)) {
      continue;
    }
    const candidate = toCitationCandidate(result);
    const competitor = await createCompetitor(
      db,
      {
        orgId,
        name: category.category,
        category: mapCompetitorCategory(category.category),
        positioning: category.examples.join(", ") || category.quote,
        differentiators: category.examples,
      },
      actor,
    );
    const citation = await createCitation(
      db,
      {
        orgId,
        sourceUrl: candidate.url,
        retrievedAt: new Date(candidate.retrievedAt),
        sourceType: "OTHER",
        quote: category.quote.slice(0, 500),
        extractor: "agent",
      },
      actor,
    );
    await createFieldAssertion(
      db,
      {
        orgId,
        entityType: "competitor",
        entityId: competitor.id,
        fieldName: "positioning",
        fieldValue: category.quote,
        verificationStatus: "INFERRED",
        assertedBy: "agent",
        citationIds: [citation.id],
      },
      actor,
    );
    persisted.push({ ...category, competitorId: competitor.id });
  }

  return persisted;
}
