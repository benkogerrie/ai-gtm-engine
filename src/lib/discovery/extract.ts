import type { LlmClient } from "@/lib/llm";
import type { SearchResult } from "@/lib/search/types";
import { hostFromUrl, isBlockedCompanyDomain, normalizeDomain } from "./filters";
import {
  llmCompetitorCategoriesSchema,
  llmProspectsSchema,
  llmQueryRefineSchema,
  type CompetitorCategoryInsight,
  type DiscoveryCandidate,
  type DiscoveryInput,
} from "./types";

function cleanTitle(title: string): string {
  return title
    .replace(/\s+[|\-–—].*$/, "")
    .replace(/\s+\((?:official|home|website)\)/i, "")
    .trim();
}

function snippetQuote(result: SearchResult): string {
  const quote = result.snippet.trim() || result.title.trim();
  return quote.slice(0, 280) || result.url;
}

/**
 * Derive candidates only from returned search hits. Never invents URLs.
 */
export function extractCandidatesFromResults(
  results: SearchResult[],
  excludeDomains: string[] = [],
): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = [];

  for (const result of results) {
    const domain = hostFromUrl(result.url);
    if (!domain || isBlockedCompanyDomain(domain, excludeDomains)) {
      continue;
    }
    const name = cleanTitle(result.title) || domain;
    const quote = snippetQuote(result);
    candidates.push({
      name,
      domain,
      whyFit: quote,
      signals: [],
      claims: [
        {
          field: "name",
          value: name,
          sourceUrl: result.url,
          quote,
        },
        {
          field: "domain",
          value: domain,
          sourceUrl: result.url,
          quote,
        },
      ],
    });
  }

  return candidates;
}

export async function refineQueriesWithLlm(
  llm: LlmClient,
  input: DiscoveryInput,
  templates: string[],
): Promise<string[]> {
  try {
    const refined = await llm.json(llmQueryRefineSchema, [
      {
        role: "system",
        content:
          "Rewrite web search queries for finding real customer companies. Return 3-6 queries. Do not invent domains. JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify({ input, templates }),
      },
    ]);
    return refined.data.queries;
  } catch {
    return templates;
  }
}

export async function extractCandidatesWithLlm(
  llm: LlmClient,
  input: DiscoveryInput,
  results: SearchResult[],
): Promise<DiscoveryCandidate[]> {
  if (results.length === 0) {
    return [];
  }

  const extracted = await llm.json(llmProspectsSchema, [
    {
      role: "system",
      content:
        "Extract real prospect companies ONLY from the supplied search results. Every claim.sourceUrl MUST be copied exactly from a result URL. Do not invent companies, domains, URLs, or signals. JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        icp: input,
        results: results.map((result) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
        })),
      }),
    },
  ]);

  return extracted.data.companies
    .map((company) => ({
      ...company,
      domain: normalizeDomain(company.domain) ?? company.domain,
    }))
    .filter((company) => Boolean(normalizeDomain(company.domain)));
}

export async function extractCompetitorCategoriesWithLlm(
  llm: LlmClient,
  input: DiscoveryInput,
  results: SearchResult[],
): Promise<CompetitorCategoryInsight[]> {
  if (results.length === 0) {
    return [];
  }

  const extracted = await llm.json(llmCompetitorCategoriesSchema, [
    {
      role: "system",
      content:
        "Extract competitor categories and example vendors ONLY from the supplied search results. Each category needs a sourceUrl copied exactly from a result URL and a short quote. Do not invent URLs. JSON only.",
    },
    {
      role: "user",
      content: JSON.stringify({
        icp: input,
        results: results.map((result) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
        })),
      }),
    },
  ]);

  return extracted.data.categories;
}

export function extractCompetitorCategoriesFromResults(
  results: SearchResult[],
): CompetitorCategoryInsight[] {
  const categories: CompetitorCategoryInsight[] = [];
  for (const result of results) {
    const text = `${result.title} ${result.snippet}`.toLowerCase();
    if (!/competitor|alternative|versus|vs\.|category/.test(text)) {
      continue;
    }
    if (isRejectedCompetitorResult(result.url)) {
      continue;
    }
    categories.push({
      category: cleanTitle(result.title) || "Adjacent tools",
      examples: [],
      sourceUrl: result.url,
      quote: snippetQuote(result),
    });
  }
  return categories.slice(0, 4);
}

function isRejectedCompetitorResult(url: string): boolean {
  const host = hostFromUrl(url);
  return host === "wikipedia.org" || host === "en.wikipedia.org";
}
