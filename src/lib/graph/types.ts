import type { EvidenceLabel } from "@/lib/discovery/types";

export const GRAPH_NODE_TYPES = [
  "seller",
  "icp",
  "attribute",
  "prospect",
  "claim",
  "source",
] as const;
export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

export const GRAPH_ATTRIBUTE_KINDS = ["industry", "persona", "signal"] as const;
export type GraphAttributeKind = (typeof GRAPH_ATTRIBUTE_KINDS)[number];

export const GRAPH_EDGE_TYPES = [
  "DEFINES",
  "TARGETS",
  "IN_INDUSTRY",
  "HAS_SIGNAL",
  "ABOUT",
  "CITES",
] as const;
export type GraphEdgeType = (typeof GRAPH_EDGE_TYPES)[number];

export const GRAPH_EVIDENCE_WEIGHTS = {
  VERIFIED: 1,
  INFERRED: 3,
  "source-candidate": 5,
} as const satisfies Record<EvidenceLabel, number>;

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  subtitle?: string;
  attributeKind?: GraphAttributeKind;
  prospectId?: string;
  sourceUrl?: string;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: GraphEdgeType;
  label: string;
  evidence: EvidenceLabel;
  sourceUrl?: string;
};

export type KnowledgeGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphSellerInput = {
  id: string;
  name: string;
};

export type GraphIndustryInput = {
  name: string;
  naics?: string | null;
  label?: string | null;
};

export type GraphPersonaInput = {
  title: string;
};

export type GraphTriggerInput = {
  summary: string;
  type?: string;
};

export type GraphIcpInput = {
  id: string;
  name: string;
  industries: GraphIndustryInput[];
  personas: GraphPersonaInput[];
  triggers: GraphTriggerInput[];
};

export type GraphClaimInput = {
  field: string;
  value: string;
  sourceUrl: string;
  quote: string;
  sourceTitle?: string;
  sourceDomain?: string;
};

export type GraphSignalInput = {
  summary: string;
  sourceUrl: string;
};

export type GraphProspectInput = {
  id: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  fitScore?: number | null;
  rationale?: string;
  whyFit?: string;
  claims: GraphClaimInput[];
  signals: GraphSignalInput[];
  verifiedUrls?: string[];
};

export type GraphBuildInput = {
  seller?: GraphSellerInput | null;
  icp?: GraphIcpInput | null;
  prospects?: GraphProspectInput[];
};

export type MatchPath = {
  prospectId: string;
  nodeIds: string[];
  edgeIds: string[];
  weight: number;
  hops: number;
  explanation: string;
};
