import {
  structuredIcpSchema,
  type LlmIcpOutput,
  type ProductIntake,
  type StructuredIcp,
} from "@/domain";
import { newId } from "@/db/ids";
import { isLlmError, LlmInvalidJsonError, type LlmClient } from "@/lib/llm";
import { createLlmClient, isLlmConfigured } from "@/lib/llm";
import { createMockLlmClient } from "@/lib/llm";
import { llmIcpOutputNormalizedSchema } from "./normalize";
import { validateNaics } from "./naics";
import { buildMockIcpOutput } from "./mock-output";
import { buildIcpUserPrompt, ICP_PROMPT_VERSION, ICP_SYSTEM_PROMPT } from "./prompts/v1";

export { ICP_PROMPT_VERSION };

export type InferIcpResult = {
  structured: StructuredIcp;
  inferenceMode: "live" | "mock";
  model: string;
};

export function createIcpLlmClient(): { client: LlmClient; mode: "live" | "mock" } {
  if (isLlmConfigured()) {
    return { client: createLlmClient(), mode: "live" };
  }
  return {
    client: createMockLlmClient({
      jsonHandler: (schema, messages) => {
        const intake = intakeFromPrompt(messages.map((m) => m.content).join("\n"));
        const raw = buildMockIcpOutput(intake);
        return schema.parse(raw);
      },
    }),
    mode: "mock",
  };
}

function intakeFromPrompt(prompt: string): ProductIntake {
  const name = /Product name:\s*(.+)/.exec(prompt)?.[1]?.trim() || "Product";
  const description =
    /Description:\s*(.+)/.exec(prompt)?.[1]?.trim() || "No description";
  return { name, description };
}

export function hydrateStructuredIcp(output: LlmIcpOutput): StructuredIcp {
  const structured: StructuredIcp = {
    name: output.name,
    targetIndustries: output.targetIndustries.map((industry) => ({
      ...industry,
      naicsValidation: validateNaics(industry.naics),
    })),
    companySize: output.companySize,
    buyerPersonas: output.buyerPersonas,
    triggerEvents: output.triggerEvents,
    expansionSuggestions: output.expansionSuggestions.map((suggestion) => ({
      ...suggestion,
      id: newId(),
      decision: "PENDING" as const,
      decisionNote: null,
      decidedBy: null,
      decidedAt: null,
    })),
  };
  return structuredIcpSchema.parse(structured);
}

export function flattenStructuredIcp(structured: StructuredIcp) {
  const mins = structured.companySize.headcountTiers
    .map((tier) => tier.min)
    .filter((value): value is number => value !== null);
  const maxs = structured.companySize.headcountTiers
    .map((tier) => tier.max)
    .filter((value): value is number => value !== null);
  const revMins = structured.companySize.revenueBands
    .map((band) => band.min)
    .filter((value): value is number => value !== null);
  const revMaxs = structured.companySize.revenueBands
    .map((band) => band.max)
    .filter((value): value is number => value !== null);

  const avg = (values: number[]) =>
    values.length
      ? Number(
          (
            values.reduce((sum, value) => sum + value, 0) / values.length
          ).toFixed(2),
        )
      : 0;

  return {
    name: structured.name,
    targetIndustries: structured.targetIndustries.map((industry) =>
      industry.naics ? `${industry.naics} ${industry.name}` : industry.name,
    ),
    companySizeMin: mins.length ? Math.min(...mins) : null,
    companySizeMax: maxs.length ? Math.max(...maxs) : null,
    revenueBandMin: revMins.length ? Math.min(...revMins) : null,
    revenueBandMax: revMaxs.length ? Math.max(...revMaxs) : null,
    buyerPersonas: structured.buyerPersonas,
    triggerEvents: structured.triggerEvents.map((event) => event.summary),
    confidenceScores: {
      targetIndustries: avg(
        structured.targetIndustries.map((industry) => industry.confidence),
      ),
      companySize: structured.companySize.confidence,
      buyerPersonas: avg(
        structured.buyerPersonas.map((persona) => persona.confidence),
      ),
      triggerEvents: avg(
        structured.triggerEvents.map((event) => event.confidence),
      ),
      expansionSuggestions: avg(
        structured.expansionSuggestions.map((item) => item.confidence),
      ),
    },
    expansionSuggestions: structured.expansionSuggestions.map(
      (item) => item.title,
    ),
  };
}

export async function inferStructuredIcp(
  client: LlmClient,
  intake: ProductIntake,
): Promise<InferIcpResult> {
  const existingCustomers = [
    ...(intake.existingCustomers ?? []),
    ...(intake.referenceWins ?? []),
  ];
  const messages = [
    { role: "system" as const, content: ICP_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: buildIcpUserPrompt({
        name: intake.name,
        description: intake.freeText
          ? `${intake.description}\n\n${intake.freeText}`
          : intake.description,
        features: intake.features ?? [],
        capabilities: intake.capabilities ?? [],
        technicalConstraints: intake.technicalConstraints ?? [],
        existingCustomers,
        pricingModel: intake.pricingModel ?? null,
        contractValueMin: intake.contractValueMin ?? null,
        contractValueMax: intake.contractValueMax ?? null,
        monetizationModel: intake.monetizationModel ?? null,
        freeText: intake.freeText,
      }),
    },
  ];

  try {
    const result = await client.json(llmIcpOutputNormalizedSchema, messages);
    return {
      structured: hydrateStructuredIcp(result.data),
      inferenceMode: client.provider === "mock" ? "mock" : "live",
      model: result.model,
    };
  } catch (error) {
    if (error instanceof LlmInvalidJsonError || isLlmError(error)) {
      throw error;
    }
    throw error;
  }
}
