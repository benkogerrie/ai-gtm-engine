export function graphSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}

export function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host.replace(/^www\./, "")}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

export function sellerNodeId(id: string): string {
  return `seller:${id}`;
}

export function icpNodeId(id: string): string {
  return `icp:${id}`;
}

export function industryNodeId(input: {
  name: string;
  naics?: string | null;
}): string {
  if (input.naics?.trim()) {
    return `attr:industry:naics:${graphSlug(input.naics.trim())}`;
  }
  return `attr:industry:${graphSlug(input.name)}`;
}

export function personaNodeId(title: string): string {
  return `attr:persona:${graphSlug(title)}`;
}

export function signalNodeId(summary: string): string {
  return `attr:signal:${graphSlug(summary)}`;
}

export function prospectNodeId(id: string): string {
  return `prospect:${id}`;
}

export function claimNodeId(input: {
  prospectId: string;
  field: string;
  sourceUrl: string;
  value: string;
}): string {
  return `claim:${input.prospectId}:${graphSlug(input.field)}:${graphSlug(normalizeSourceUrl(input.sourceUrl))}:${graphSlug(input.value).slice(0, 32)}`;
}

export function sourceNodeId(url: string): string {
  return `source:${graphSlug(normalizeSourceUrl(url))}`;
}

export function edgeId(type: string, from: string, to: string): string {
  return `${type}:${from}->${to}`;
}
