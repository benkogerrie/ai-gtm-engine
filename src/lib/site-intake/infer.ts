import {
  createLlmClient,
  createMockLlmClient,
  isLlmConfigured,
  isLlmError,
  type LlmClient,
} from "@/lib/llm";
import { MAX_PAGE_TEXT_CHARS, MAX_TOTAL_TEXT_CHARS } from "./constants";
import { SiteIntakeError } from "./errors";
import type { ExtractedPage } from "./html-to-text";
import { siteIntakeLlmSchema, type SiteIntakeLlmFields } from "./schema";

export const SITE_INTAKE_PROMPT_VERSION = "v1";

const SITE_INTAKE_SYSTEM_PROMPT = `You extract a product intake from public marketing pages.

Rules:
- Only state facts the supplied page text supports.
- If a field is not clearly supported, return null for that field.
- Do not invent customers, prices, contract values, metrics, or claims.
- Do not guess numbers. Numeric fields must be null unless the pages state them.
- Keep strings short and concrete.
- Respond with a JSON object only.`;

const SITE_INTAKE_JSON_EXAMPLE = `{
  "name": "ShiftPilot",
  "description": "AI shift scheduling for hospitals and clinics",
  "targetCustomer": "Hospital operations and nurse staffing leads",
  "problem": "Night-shift and float-pool coverage is planned by hand",
  "offering": "Automated rostering for clinical teams",
  "features": ["shift scheduling", "overtime reduction"],
  "capabilities": ["AI rostering"],
  "technicalConstraints": null,
  "existingCustomers": null,
  "referenceWins": null,
  "pricingModel": null,
  "contractValueMin": null,
  "contractValueMax": null,
  "monetizationModel": null,
  "freeText": null
}`;

function capPageText(text: string): string {
  if (text.length <= MAX_PAGE_TEXT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_PAGE_TEXT_CHARS).trim()}…`;
}

export function buildSiteIntakeUserPrompt(
  pages: ExtractedPage[],
  websiteUrl: string,
): string {
  let remaining = MAX_TOTAL_TEXT_CHARS;
  const blocks: string[] = [
    `Website: ${websiteUrl}`,
    "Return JSON matching this shape. Use null when unknown:",
    SITE_INTAKE_JSON_EXAMPLE,
    "Source pages:",
  ];

  for (const page of pages) {
    const body = capPageText(page.text);
    const chunk = [
      `--- ${page.url}`,
      page.title ? `Title: ${page.title}` : null,
      body,
    ]
      .filter(Boolean)
      .join("\n");
    if (chunk.length > remaining) {
      blocks.push(chunk.slice(0, Math.max(0, remaining)).trim());
      break;
    }
    blocks.push(chunk);
    remaining -= chunk.length;
  }

  return blocks.join("\n\n");
}

function firstMeaningfulLine(text: string): string | null {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length >= 40 && !part.startsWith("Website:"));
  return line ? line.slice(0, 240) : null;
}

export function buildMockSiteIntake(
  pages: ExtractedPage[],
  websiteUrl: string,
): SiteIntakeLlmFields {
  const combined = pages.map((page) => page.text).join("\n");
  const title = pages.find((page) => page.title)?.title ?? null;
  const name =
    title && title.length <= 80 ? title.replace(/\s+[|–—-]\s+.*$/, "").trim() : null;
  return {
    name: name || null,
    description: firstMeaningfulLine(combined),
    targetCustomer: null,
    problem: null,
    offering: null,
    features: null,
    capabilities: null,
    technicalConstraints: null,
    existingCustomers: null,
    referenceWins: null,
    pricingModel: null,
    contractValueMin: null,
    contractValueMax: null,
    monetizationModel: null,
    freeText: `Website: ${websiteUrl}`,
  };
}

export function createSiteIntakeLlmClient(): {
  client: LlmClient;
  mode: "live" | "mock";
} {
  if (isLlmConfigured()) {
    return { client: createLlmClient(), mode: "live" };
  }
  return {
    client: createMockLlmClient({
      jsonHandler: (schema, messages) => {
        const prompt = messages.map((message) => message.content).join("\n");
        const websiteUrl =
          /Website:\s*(\S+)/.exec(prompt)?.[1]?.trim() ?? "https://example.com";
        const title = /Title:\s*(.+)/.exec(prompt)?.[1]?.trim() ?? null;
        const raw = buildMockSiteIntake(
          [{ url: websiteUrl, title, text: prompt }],
          websiteUrl,
        );
        return schema.parse(raw);
      },
    }),
    mode: "mock",
  };
}

export async function inferSiteIntakeFields(
  pages: ExtractedPage[],
  websiteUrl: string,
  llm?: LlmClient,
): Promise<{ fields: SiteIntakeLlmFields; mode: "live" | "mock"; model: string }> {
  const resolved = llm
    ? { client: llm, mode: isLlmConfigured() ? ("live" as const) : ("mock" as const) }
    : createSiteIntakeLlmClient();

  try {
    const result = await resolved.client.json(
      siteIntakeLlmSchema,
      [
        { role: "system", content: SITE_INTAKE_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildSiteIntakeUserPrompt(pages, websiteUrl),
        },
      ],
      { temperature: 0 },
    );
    return {
      fields: result.data,
      mode: resolved.client.provider === "mock" ? "mock" : resolved.mode,
      model: result.model,
    };
  } catch (error) {
    if (isLlmError(error)) {
      throw new SiteIntakeError(
        "INFERENCE_FAILED",
        error.message,
        { cause: error },
      );
    }
    throw error;
  }
}
