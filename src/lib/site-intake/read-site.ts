import type { LlmClient } from "@/lib/llm";
import type { ExtractedPage } from "./html-to-text";
import { fetchSitePages, type FetchPagesOptions } from "./fetch-pages";
import { inferSiteIntakeFields } from "./infer";
import { llmFieldsToFormValues } from "./map-fields";
import type { IntakeFormValues, SiteIntakeLlmFields } from "./schema";
import { assertSafePublicUrl, type LookupFn } from "./url-safety";

export type ReadSiteResult = {
  mode: "live" | "mock";
  model: string;
  websiteUrl: string;
  pages: string[];
  fields: SiteIntakeLlmFields;
  suggested: IntakeFormValues;
};

export type ReadSiteOptions = FetchPagesOptions & {
  llm?: LlmClient;
  lookupFn?: LookupFn;
};

export async function readSite(
  rawUrl: string,
  options: ReadSiteOptions = {},
): Promise<ReadSiteResult> {
  const start = await assertSafePublicUrl(rawUrl, options.lookupFn);
  const pages: ExtractedPage[] = await fetchSitePages(rawUrl, options);
  const websiteUrl = pages[0]?.url ?? start.toString();
  const inferred = await inferSiteIntakeFields(pages, websiteUrl, options.llm);
  return {
    mode: inferred.mode,
    model: inferred.model,
    websiteUrl,
    pages: pages.map((page) => page.url),
    fields: inferred.fields,
    suggested: llmFieldsToFormValues(inferred.fields, websiteUrl),
  };
}
