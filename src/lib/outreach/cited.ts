import { DomainError } from "@/domain";
import type { AppDatabase } from "@/db/client";
import {
  getCompanyWithEvidence,
  listFieldAssertionsWithCitations,
  listSignalsForCompany,
} from "@/db/repository";
import type { CitedSignal } from "./schema";

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "(unknown)";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function collectCitedSignals(
  db: AppDatabase,
  companyId: string,
  orgId: string,
): Promise<{ companyName: string; companyDomain: string | null; cited: CitedSignal[] }> {
  const view = await getCompanyWithEvidence(db, companyId, orgId);
  if (!view) {
    throw new DomainError(
      "ENTITY_NOT_FOUND",
      "Company was not found for this org",
    );
  }

  const cited: CitedSignal[] = [];

  for (const [fieldName, evidence] of Object.entries(view.fields)) {
    const urls = evidence.citations
      .map((citation) => citation.sourceUrl)
      .filter((url): url is string => Boolean(url));
    if (urls.length === 0) {
      continue;
    }
    cited.push({
      id: `claim:${fieldName}`,
      kind: "claim",
      type: fieldName,
      summary: `${fieldName}: ${stringifyValue(evidence.value)}`,
      sourceUrls: [...new Set(urls)],
      quotes: evidence.citations.map((citation) => citation.quote),
    });
  }

  const signals = await listSignalsForCompany(db, orgId, companyId);
  const signalAssertions = await listFieldAssertionsWithCitations(
    db,
    orgId,
    "signal",
    signals.map((signal) => signal.id),
  );
  const citationsBySignal = new Map<
    string,
    { sourceUrl: string; quote: string }[]
  >();
  for (const assertion of signalAssertions) {
    const list = citationsBySignal.get(assertion.entityId) ?? [];
    for (const citation of assertion.citations) {
      if (citation.sourceUrl) {
        list.push({ sourceUrl: citation.sourceUrl, quote: citation.quote });
      }
    }
    citationsBySignal.set(assertion.entityId, list);
  }

  for (const signal of signals) {
    const cites = citationsBySignal.get(signal.id) ?? [];
    if (cites.length === 0) {
      continue;
    }
    cited.push({
      id: signal.id,
      kind: "signal",
      type: signal.type,
      summary: signal.summary,
      sourceUrls: [...new Set(cites.map((item) => item.sourceUrl))],
      quotes: cites.map((item) => item.quote),
    });
  }

  return {
    companyName: view.company.name,
    companyDomain: view.company.domain,
    cited,
  };
}

export function assertHasCitedSignals(cited: CitedSignal[]): void {
  if (cited.length === 0) {
    throw new DomainError(
      "NO_CITED_SIGNALS",
      "This company has no cited signal. Attach a citation (source URL) before drafting outreach.",
    );
  }
}
