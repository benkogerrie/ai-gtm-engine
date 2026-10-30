import type { StructuredIcp } from "@/domain";
import { discoveryInputSchema, type DiscoveryInput } from "./types";

function inferGeographies(productSummary: string): string[] {
  if (/united kingdom|\bUK\b|\bGB\b/i.test(productSummary)) {
    return ["United Kingdom"];
  }
  return ["United States"];
}

/**
 * Map an approved B003 ICP + product description onto DiscoveryInput.
 */
export function discoveryInputFromIcp(input: {
  icpId: string;
  productSummary: string;
  structured: StructuredIcp;
  excludeDomains?: string[];
  geographies?: string[];
}): DiscoveryInput {
  const industries = input.structured.targetIndustries.map((industry) => {
    const parts = [industry.name];
    if (industry.naics) {
      parts.push(industry.naics);
    }
    if (
      industry.naicsValidation.label &&
      industry.naicsValidation.label !== industry.name
    ) {
      parts.push(industry.naicsValidation.label);
    }
    return parts.join(" ");
  });

  return discoveryInputSchema.parse({
    productSummary: input.productSummary.trim(),
    industries:
      industries.length > 0 ? industries : [input.structured.name],
    companySizes: input.structured.companySize.headcountTiers
      .map((tier) => tier.label)
      .filter(Boolean),
    geographies: input.geographies?.length
      ? input.geographies
      : inferGeographies(input.productSummary),
    personas: input.structured.buyerPersonas.map((persona) => persona.title),
    triggers: input.structured.triggerEvents.map((event) => event.summary),
    excludeDomains: input.excludeDomains,
    icpId: input.icpId,
  });
}
