import type { LlmClient } from "@/lib/llm";
import type { SearchResult } from "@/lib/search/types";
import {
  inferOrgDomain,
  isCredibleCompetitorCitation,
  isMediaOrResearchHost,
} from "./classify";
import { hostFromUrl, isBlockedCompanyDomain } from "./filters";
import { cleanText } from "./html";
import { extractOrganizationName } from "./names";
import {
  llmCompetitorCategoriesNormalizedSchema,
  llmProspectsNormalizedSchema,
  sanitizeCandidate,
} from "./normalize";
import { llmQueryRefineSchema, type CompetitorCategoryInsight, type DiscoveryCandidate, type DiscoveryInput } from "./types";

export const PROSPECT_JSON_EXAMPLE = `{
  "companies": [
    {
      "name": "Ochsner Health",
      "domain": "ochsner.org",
      "role": "buyer",
      "whyFit": "US health system rolling out workforce scheduling after staffing pressure.",
      "fitScore": 86,
      "rationale": "The cited press release describes a system-wide nurse scheduling platform launch, which matches a hospital buyer for AI shift scheduling.",
      "signals": [
        {
          "summary": "System-wide workforce management platform launch",
          "sourceUrl": "https://news.ochsner.org/news-releases/example"
        }
      ],
      "claims": [
        {
          "field": "name",
          "value": "Ochsner Health",
          "sourceUrl": "https://news.ochsner.org/news-releases/example",
          "quote": "Ochsner Health announces system-wide launch of a workforce management platform"
        }
      ]
    }
  ]
}`;

const PROSPECT_SYSTEM_PROMPT = `You extract named BUYER organizations from web search results for B2B prospecting.

Return a single JSON object that matches this exact shape. Do not wrap it in markdown. Do not rename fields.

Required JSON shape (filled example — copy these keys literally):
${PROSPECT_JSON_EXAMPLE}

Rules:
- "name" is the ORGANIZATION name (Ochsner Health, UCHealth, Mercy, HCA Healthcare). NEVER copy the article/page title.
- A news subdomain or press-wire URL is a citation for the organization in the article, not the company itself. Example: news.ochsner.org cites Ochsner Health; a PR Newswire article about Hospital X cites Hospital X.
- "domain" is the organization's own website host (ochsner.org, uchealth.org). Not prnewswire.com, pubmed, or the vendor in the headline.
- Classify every candidate as exactly one of: "buyer" | "vendor_competitor" | "media_research".
  buyer = hospital, health system, clinic, or other customer org that would BUY the product.
  vendor_competitor = software/staffing vendors (symplr, M7 Health, ShiftMed, HealthStream, UKG).
  media_research = publishers, newswires, journals, listicles, PubMed papers.
- Include vendors and media in the array with the correct role so they can be filtered. Still extract the buyer named in a vendor/press article when one is clearly named.
- Every claim.sourceUrl and signal.sourceUrl MUST be copied exactly from a supplied result URL. Do not invent companies, domains, URLs, or signals.
- fitScore is an integer 0-100 and MUST differ across companies when the cited evidence differs. Ground rationale in the cited quote.
- whyFit and rationale are plain text (no HTML tags or entities).
- JSON only.`;

function snippetQuote(result: SearchResult): string {
  const quote = cleanText(result.snippet) || cleanText(result.title);
  return quote.slice(0, 280) || result.url;
}

/**
 * Derive candidates only from returned search hits. Never invents URLs.
 * Names are organization names, not article titles.
 */
export function extractCandidatesFromResults(
  results: SearchResult[],
  excludeDomains: string[] = [],
): DiscoveryCandidate[] {
  const candidates: DiscoveryCandidate[] = [];

  for (const result of results) {
    const resultHost = hostFromUrl(result.url);
    if (!resultHost) {
      continue;
    }
    const domain = inferOrgDomain(undefined, result.url);
    if (domain && isBlockedCompanyDomain(domain, excludeDomains)) {
      continue;
    }
    const name = extractOrganizationName(result.title, domain || resultHost);
    if (!name) {
      continue;
    }
    const quote = snippetQuote(result);
    candidates.push(
      sanitizeCandidate({
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
            sourceTitle: cleanText(result.title),
            sourceDomain: resultHost,
          },
        ],
      }),
    );
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
          "Rewrite web search queries for finding real buyer organizations (hospitals, health systems, clinics), not vendor listicles. Return 3-6 queries. Do not invent domains. JSON only.",
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

  const extracted = await llm.json(llmProspectsNormalizedSchema, [
    {
      role: "system",
      content: PROSPECT_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: JSON.stringify({
        icp: input,
        results: results.map((result) => ({
          title: cleanText(result.title),
          url: result.url,
          snippet: cleanText(result.snippet),
        })),
      }),
    },
  ]);

  return extracted.data.companies.map((company) => sanitizeCandidate(company));
}

const COMPETITOR_JSON_EXAMPLE = `{
  "categories": [
    {
      "category": "Enterprise workforce platforms",
      "examples": ["UKG", "Workday"],
      "sourceUrl": "https://www.ukg.com/products/workforce-management",
      "quote": "UKG workforce management for hospital staffing and scheduling"
    }
  ]
}`;

export async function extractCompetitorCategoriesWithLlm(
  llm: LlmClient,
  input: DiscoveryInput,
  results: SearchResult[],
): Promise<CompetitorCategoryInsight[]> {
  if (results.length === 0) {
    return [];
  }

  const extracted = await llm.json(llmCompetitorCategoriesNormalizedSchema, [
    {
      role: "system",
      content: `Extract competitor categories and example vendors ONLY from the supplied search results.

Return a single JSON object matching this shape. Do not wrap in markdown.
${COMPETITOR_JSON_EXAMPLE}

Each category needs a sourceUrl copied exactly from a result URL and a short plain-text quote.
Only keep a category if the citation is a real, relevant industry or vendor page (not personal blogs, WordPress plugin sites, or unrelated marketing domains).
Do not invent URLs. JSON only.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        icp: input,
        results: results.map((result) => ({
          title: cleanText(result.title),
          url: result.url,
          snippet: cleanText(result.snippet),
        })),
      }),
    },
  ]);

  return extracted.data.categories
    .map((category) => ({
      ...category,
      category: cleanText(category.category),
      examples: category.examples.map((example) => cleanText(example)),
      quote: cleanText(category.quote, 280),
    }))
    .filter((category) =>
      isCredibleCompetitorCitation({
        sourceUrl: category.sourceUrl,
        quote: category.quote,
        category: category.category,
      }),
    );
}

export function extractCompetitorCategoriesFromResults(
  results: SearchResult[],
): CompetitorCategoryInsight[] {
  const categories: CompetitorCategoryInsight[] = [];
  for (const result of results) {
    const host = hostFromUrl(result.url);
    if (!host || isMediaOrResearchHost(host)) {
      continue;
    }
    const text = `${result.title} ${result.snippet}`;
    if (
      !isCredibleCompetitorCitation({
        sourceUrl: result.url,
        quote: text,
        category: result.title,
      })
    ) {
      continue;
    }
    categories.push({
      category: extractOrganizationName(result.title, host) || "Adjacent tools",
      examples: [],
      sourceUrl: result.url,
      quote: snippetQuote(result),
    });
  }
  return categories.slice(0, 4);
}
