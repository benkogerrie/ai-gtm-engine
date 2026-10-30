import { labelDiscoveryClaim } from "@/lib/discovery/labels";
import type { EvidenceLabel } from "@/lib/discovery/types";
import { edgeId, industryNodeId, personaNodeId, prospectNodeId, claimNodeId, icpNodeId, sellerNodeId, signalNodeId, sourceNodeId } from "./ids";
import { textMentionsAny } from "./match-text";
import type {
  GraphAttributeKind,
  GraphBuildInput,
  GraphClaimInput,
  GraphEdge,
  GraphIcpInput,
  GraphIndustryInput,
  GraphNode,
  GraphProspectInput,
  KnowledgeGraph,
} from "./types";
import { GRAPH_EVIDENCE_WEIGHTS } from "./types";

const LABEL_RANK: Record<EvidenceLabel, number> = {
  VERIFIED: 0,
  INFERRED: 1,
  "source-candidate": 2,
};

type MutableGraph = {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
};

function addNode(graph: MutableGraph, node: GraphNode): void {
  if (!graph.nodes.has(node.id)) {
    graph.nodes.set(node.id, node);
  }
}

function preferEvidence(current: EvidenceLabel, next: EvidenceLabel): EvidenceLabel {
  return LABEL_RANK[next] < LABEL_RANK[current] ? next : current;
}

function addEdge(
  graph: MutableGraph,
  edge: Omit<GraphEdge, "id"> & { id?: string },
): void {
  if (!graph.nodes.has(edge.from) || !graph.nodes.has(edge.to)) {
    return;
  }
  const id = edge.id ?? edgeId(edge.type, edge.from, edge.to);
  const existing = graph.edges.get(id);
  if (!existing) {
    graph.edges.set(id, { ...edge, id });
    return;
  }
  const evidence = preferEvidence(existing.evidence, edge.evidence);
  graph.edges.set(id, {
    ...existing,
    evidence,
    sourceUrl: evidence === edge.evidence ? edge.sourceUrl ?? existing.sourceUrl : existing.sourceUrl,
    label: evidence === edge.evidence ? edge.label : existing.label,
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function industryNeedles(industry: GraphIndustryInput): string[] {
  return [industry.name, industry.naics ?? "", industry.label ?? ""].filter(
    (value) => value.trim().length > 0,
  );
}

function industryLabel(industry: GraphIndustryInput): { label: string; subtitle?: string } {
  if (industry.naics?.trim()) {
    return {
      label: `NAICS ${industry.naics.trim()}`,
      subtitle: industry.label?.trim() || industry.name,
    };
  }
  return { label: industry.name, subtitle: industry.label?.trim() || undefined };
}

function claimEvidence(
  claim: GraphClaimInput,
  verifiedUrls?: Set<string>,
): EvidenceLabel {
  return labelDiscoveryClaim({
    field: claim.field,
    sourceUrl: claim.sourceUrl,
    verifiedUrls,
  });
}

function signalEvidence(
  sourceUrl: string,
  verifiedUrls?: Set<string>,
): EvidenceLabel {
  if (verifiedUrls?.has(sourceUrl)) {
    return "VERIFIED";
  }
  return verifiedUrls ? "source-candidate" : "source-candidate";
}

type MentionHit = {
  evidence: EvidenceLabel;
  sourceUrl?: string;
};

function cheapestHit(hits: MentionHit[]): MentionHit | null {
  if (hits.length === 0) {
    return null;
  }
  return [...hits].sort((left, right) => {
    const byLabel = LABEL_RANK[left.evidence] - LABEL_RANK[right.evidence];
    if (byLabel !== 0) {
      return byLabel;
    }
    return (left.sourceUrl ?? "").localeCompare(right.sourceUrl ?? "");
  })[0]!;
}

function mentionHits(
  prospect: GraphProspectInput,
  needles: string[],
): MentionHit[] {
  const verified = prospect.verifiedUrls
    ? new Set(prospect.verifiedUrls)
    : undefined;
  const hits: MentionHit[] = [];

  if (prospect.industry && textMentionsAny(prospect.industry, needles)) {
    hits.push({ evidence: "INFERRED" });
  }
  if (prospect.whyFit && textMentionsAny(prospect.whyFit, needles)) {
    hits.push({ evidence: "INFERRED" });
  }
  if (prospect.rationale && textMentionsAny(prospect.rationale, needles)) {
    hits.push({ evidence: "INFERRED" });
  }

  for (const claim of prospect.claims) {
    const blob = `${claim.field} ${claim.value} ${claim.quote}`;
    if (!textMentionsAny(blob, needles)) {
      continue;
    }
    hits.push({
      evidence: claimEvidence(claim, verified),
      sourceUrl: claim.sourceUrl,
    });
  }

  for (const signal of prospect.signals) {
    if (!textMentionsAny(signal.summary, needles)) {
      continue;
    }
    hits.push({
      evidence: signalEvidence(signal.sourceUrl, verified),
      sourceUrl: signal.sourceUrl,
    });
  }

  return hits;
}

function addIcpAttributes(graph: MutableGraph, icp: GraphIcpInput): void {
  const icpId = icpNodeId(icp.id);

  const addAttribute = (
    id: string,
    kind: GraphAttributeKind,
    label: string,
    subtitle: string | undefined,
    targetLabel: string,
  ) => {
    addNode(graph, {
      id,
      type: "attribute",
      label,
      subtitle,
      attributeKind: kind,
    });
    addEdge(graph, {
      from: icpId,
      to: id,
      type: "TARGETS",
      label: targetLabel,
      evidence: "INFERRED",
    });
  };

  for (const industry of icp.industries) {
    if (!industry.name.trim() && !industry.naics?.trim()) {
      continue;
    }
    const { label, subtitle } = industryLabel(industry);
    addAttribute(
      industryNodeId(industry),
      "industry",
      label,
      subtitle,
      `targets ${label}`,
    );
  }

  for (const persona of icp.personas) {
    if (!persona.title.trim()) {
      continue;
    }
    addAttribute(
      personaNodeId(persona.title),
      "persona",
      persona.title,
      "buyer persona",
      `targets ${persona.title}`,
    );
  }

  for (const trigger of icp.triggers) {
    if (!trigger.summary.trim()) {
      continue;
    }
    addAttribute(
      signalNodeId(trigger.summary),
      "signal",
      trigger.summary,
      trigger.type,
      `targets ${trigger.summary}`,
    );
  }
}

function addProspectClaims(
  graph: MutableGraph,
  prospect: GraphProspectInput,
  nodeId: string,
): void {
  const verified = prospect.verifiedUrls
    ? new Set(prospect.verifiedUrls)
    : undefined;

  for (const claim of prospect.claims) {
    const claimId = claimNodeId({
      prospectId: prospect.id,
      field: claim.field,
      sourceUrl: claim.sourceUrl,
      value: claim.value,
    });
    const sourceId = sourceNodeId(claim.sourceUrl);
    const evidence = claimEvidence(claim, verified);
    addNode(graph, {
      id: claimId,
      type: "claim",
      label: `${claim.field}: ${claim.value}`,
      subtitle: claim.quote.slice(0, 120),
      prospectId: prospect.id,
      sourceUrl: claim.sourceUrl,
    });
    addNode(graph, {
      id: sourceId,
      type: "source",
      label: claim.sourceTitle?.trim() || hostOf(claim.sourceUrl),
      subtitle: claim.sourceDomain ?? hostOf(claim.sourceUrl),
      sourceUrl: claim.sourceUrl,
    });
    addEdge(graph, {
      from: claimId,
      to: nodeId,
      type: "ABOUT",
      label: `about ${prospect.name}`,
      evidence,
      sourceUrl: claim.sourceUrl,
    });
    addEdge(graph, {
      from: claimId,
      to: sourceId,
      type: "CITES",
      label: `cites ${hostOf(claim.sourceUrl)}`,
      evidence,
      sourceUrl: claim.sourceUrl,
    });
  }
}

function linkProspectToAttributes(
  graph: MutableGraph,
  icp: GraphIcpInput,
  prospect: GraphProspectInput,
  prospectId: string,
): void {
  for (const industry of icp.industries) {
    const needles = industryNeedles(industry);
    const hit = cheapestHit(mentionHits(prospect, needles));
    if (!hit) {
      continue;
    }
    const { label } = industryLabel(industry);
    addEdge(graph, {
      from: prospectId,
      to: industryNodeId(industry),
      type: "IN_INDUSTRY",
      label: `in ${label}`,
      evidence: hit.evidence,
      sourceUrl: hit.sourceUrl,
    });
  }

  for (const trigger of icp.triggers) {
    const hit = cheapestHit(mentionHits(prospect, [trigger.summary]));
    if (!hit) {
      continue;
    }
    addEdge(graph, {
      from: prospectId,
      to: signalNodeId(trigger.summary),
      type: "HAS_SIGNAL",
      label: `has ${trigger.summary}`,
      evidence: hit.evidence,
      sourceUrl: hit.sourceUrl,
    });
  }

  for (const persona of icp.personas) {
    const hit = cheapestHit(mentionHits(prospect, [persona.title]));
    if (!hit) {
      continue;
    }
    addEdge(graph, {
      from: prospectId,
      to: personaNodeId(persona.title),
      type: "HAS_SIGNAL",
      label: `has persona ${persona.title}`,
      evidence: hit.evidence,
      sourceUrl: hit.sourceUrl,
    });
  }
}

export function buildKnowledgeGraph(input: GraphBuildInput): KnowledgeGraph {
  const graph: MutableGraph = { nodes: new Map(), edges: new Map() };

  if (input.seller?.name.trim()) {
    addNode(graph, {
      id: sellerNodeId(input.seller.id),
      type: "seller",
      label: input.seller.name.trim(),
      subtitle: "seller",
    });
  }

  if (input.icp?.id) {
    addNode(graph, {
      id: icpNodeId(input.icp.id),
      type: "icp",
      label: input.icp.name.trim() || "ICP",
      subtitle: "ICP",
    });
    if (input.seller?.name.trim()) {
      addEdge(graph, {
        from: sellerNodeId(input.seller.id),
        to: icpNodeId(input.icp.id),
        type: "DEFINES",
        label: "defines",
        evidence: "INFERRED",
      });
    }
    addIcpAttributes(graph, input.icp);
  }

  for (const prospect of input.prospects ?? []) {
    if (!prospect.id || !prospect.name.trim()) {
      continue;
    }
    const nodeId = prospectNodeId(prospect.id);
    addNode(graph, {
      id: nodeId,
      type: "prospect",
      label: prospect.name.trim(),
      subtitle: prospect.domain ?? undefined,
      prospectId: prospect.id,
    });
    addProspectClaims(graph, prospect, nodeId);
    if (input.icp) {
      linkProspectToAttributes(graph, input.icp, prospect, nodeId);
    }
  }

  const nodes = [...graph.nodes.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const edges = [...graph.edges.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  return { nodes, edges };
}

export function evidenceWeight(label: EvidenceLabel): number {
  return GRAPH_EVIDENCE_WEIGHTS[label];
}
