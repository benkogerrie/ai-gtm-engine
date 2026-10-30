import { z } from "zod";
import { inferOrgDomain } from "./classify";
import { cleanText } from "./html";
import { extractOrganizationName, isLikelyArticleTitle } from "./names";
import {
  candidateRoleSchema,
  llmCompetitorCategoriesSchema,
  llmProspectsSchema,
  type CandidateRole,
  type DiscoveryCandidate,
  type LlmCompetitorCategories,
  type LlmProspects,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = cleanText(value);
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

function firstNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }
  return undefined;
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return [value];
}

function normalizeRole(value: unknown): CandidateRole | undefined {
  const text = firstString(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!text) {
    return undefined;
  }
  if (text === "buyer" || text === "customer" || text === "hospital" || text === "health_system") {
    return "buyer";
  }
  if (
    text === "vendor_competitor" ||
    text === "vendor" ||
    text === "competitor" ||
    text === "vendor/competitor"
  ) {
    return "vendor_competitor";
  }
  if (
    text === "media_research" ||
    text === "media" ||
    text === "research" ||
    text === "publisher" ||
    text === "news"
  ) {
    return "media_research";
  }
  const parsed = candidateRoleSchema.safeParse(text);
  return parsed.success ? parsed.data : undefined;
}

function normalizeClaim(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const sourceUrl = firstString(
    pick(record, ["sourceUrl", "source_url", "url", "citationUrl"]),
  );
  const quote = firstString(pick(record, ["quote", "snippet", "evidence", "text"]));
  const field = firstString(pick(record, ["field", "fieldName", "name"])) ?? "name";
  const fieldValue = firstString(pick(record, ["value", "fieldValue"]));
  return {
    field,
    value: fieldValue ?? field,
    sourceUrl: sourceUrl ?? "",
    quote: quote ?? fieldValue ?? field,
    sourceTitle: firstString(pick(record, ["sourceTitle", "title"])),
    sourceDomain: firstString(pick(record, ["sourceDomain", "domain"])),
    relevance: normalizeRelevance(pick(record, ["relevance", "evidenceRelevance"])),
  };
}

function normalizeSignal(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    if (typeof value === "string") {
      return { summary: cleanText(value), sourceUrl: "" };
    }
    return value;
  }
  return {
    summary: firstString(pick(record, ["summary", "text", "signal"])) ?? "",
    sourceUrl: firstString(pick(record, ["sourceUrl", "source_url", "url"])) ?? "",
  };
}

function normalizeCompany(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }

  const rawName =
    firstString(pick(record, ["name", "organization", "companyName", "org", "title"])) ??
    "";
  const rawDomain = firstString(
    pick(record, ["domain", "website", "orgDomain", "companyDomain"]),
  );
  const claims = asList(pick(record, ["claims", "citations", "evidence"])).map(
    normalizeClaim,
  );
  const firstClaim = asRecord(claims[0]);
  const citationUrl =
    (firstClaim ? firstString(firstClaim.sourceUrl) : undefined) ??
    firstString(pick(record, ["sourceUrl", "url"]));
  const domain = inferOrgDomain(rawDomain, citationUrl);
  const name = isLikelyArticleTitle(rawName)
    ? extractOrganizationName(rawName, domain || citationUrl)
    : extractOrganizationName(rawName || domain, domain || citationUrl);

  const whyFit =
    firstString(pick(record, ["whyFit", "why_fit", "fit", "reason"])) ??
    firstString(firstClaim?.quote) ??
    name;

  return {
    name,
    domain,
    role: normalizeRole(pick(record, ["role", "classification", "type", "kind"])),
    whyFit: cleanText(whyFit, 400),
    fitScore: firstNumber(pick(record, ["fitScore", "fit_score", "score"])),
    rationale: firstString(pick(record, ["rationale", "reason", "scoringRationale"])),
    evidenceRelevance: normalizeRelevance(
      pick(record, ["evidenceRelevance", "evidence_relevance", "relevance"]),
    ),
    signals: asList(pick(record, ["signals", "buyingSignals"])).map(normalizeSignal),
    claims,
  };
}

function normalizeRelevance(value: unknown): "strong" | "peripheral" | undefined {
  const text = firstString(value)?.toLowerCase();
  if (text === "strong" || text === "direct" || text === "high") {
    return "strong";
  }
  if (text === "peripheral" || text === "weak" || text === "low" || text === "indirect") {
    return "peripheral";
  }
  return undefined;
}

function normalizeCategory(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  return {
    category: firstString(pick(record, ["category", "name", "label"])) ?? "",
    examples: asList(pick(record, ["examples", "vendors", "competitors"]))
      .map((item) => firstString(item))
      .filter((item): item is string => Boolean(item)),
    sourceUrl: firstString(pick(record, ["sourceUrl", "source_url", "url"])) ?? "",
    quote: firstString(pick(record, ["quote", "snippet", "evidence"])) ?? "",
  };
}

/**
 * Shape-only coercion for DeepSeek prospect JSON. Maps aliases and
 * article-title names. Does not invent companies or URLs.
 */
export function normalizeLlmProspects(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const companies = asList(
    pick(record, ["companies", "prospects", "organizations", "buyers"]),
  );
  return {
    ...record,
    companies: companies.map(normalizeCompany),
  };
}

export function normalizeLlmCompetitorCategories(value: unknown): unknown {
  const record = asRecord(value);
  if (!record) {
    return value;
  }
  const categories = asList(
    pick(record, ["categories", "competitorCategories", "competitors"]),
  );
  return {
    ...record,
    categories: categories.map(normalizeCategory),
  };
}

export const llmProspectsNormalizedSchema: z.ZodType<LlmProspects> = z.preprocess(
  (value) => normalizeLlmProspects(value),
  llmProspectsSchema,
);

export const llmCompetitorCategoriesNormalizedSchema: z.ZodType<LlmCompetitorCategories> =
  z.preprocess(
    (value) => normalizeLlmCompetitorCategories(value),
    llmCompetitorCategoriesSchema,
  );

export function sanitizeCandidate(candidate: DiscoveryCandidate): DiscoveryCandidate {
  const citationUrl = candidate.claims[0]?.sourceUrl;
  const domain = inferOrgDomain(candidate.domain, citationUrl);
  const name = extractOrganizationName(candidate.name, domain || citationUrl);
  return {
    ...candidate,
    name,
    domain,
    whyFit: cleanText(candidate.whyFit, 400),
    rationale: candidate.rationale ? cleanText(candidate.rationale, 400) : undefined,
    signals: candidate.signals.map((signal) => ({
      ...signal,
      summary: cleanText(signal.summary, 280),
    })),
    claims: candidate.claims.map((claim) => ({
      ...claim,
      value: cleanText(claim.value, 200),
      quote: cleanText(claim.quote, 400),
    })),
  };
}
