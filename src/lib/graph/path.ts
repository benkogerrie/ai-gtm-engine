import { prospectNodeId, sellerNodeId, icpNodeId } from "./ids";
import { evidenceWeight } from "./builder";
import type { GraphEdge, KnowledgeGraph, MatchPath } from "./types";

type SearchRecord = {
  weight: number;
  hops: number;
  viaNode: string | null;
  viaEdge: string | null;
  signature: string;
};

function undirectedAdj(graph: KnowledgeGraph): Map<string, GraphEdge[]> {
  const adj = new Map<string, GraphEdge[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adj.get(edge.from)?.push(edge);
    adj.get(edge.to)?.push(edge);
  }
  return adj;
}

function otherEnd(edge: GraphEdge, nodeId: string): string {
  return edge.from === nodeId ? edge.to : edge.from;
}

function compareStrings(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

function compareRecords(left: SearchRecord, right: SearchRecord): number {
  if (left.weight !== right.weight) {
    return left.weight - right.weight;
  }
  if (left.hops !== right.hops) {
    return left.hops - right.hops;
  }
  return compareStrings(left.signature, right.signature);
}

function reconstruct(
  graph: KnowledgeGraph,
  records: Map<string, SearchRecord>,
  startId: string,
  endId: string,
): { nodeIds: string[]; edgeIds: string[] } | null {
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let current: string | null = endId;
  const seen = new Set<string>();
  while (current) {
    if (seen.has(current)) {
      return null;
    }
    seen.add(current);
    nodeIds.push(current);
    const record = records.get(current);
    if (!record || current === startId) {
      break;
    }
    if (record.viaEdge) {
      edgeIds.push(record.viaEdge);
    }
    current = record.viaNode;
  }
  nodeIds.reverse();
  edgeIds.reverse();
  if (nodeIds[0] !== startId || nodeIds[nodeIds.length - 1] !== endId) {
    return null;
  }
  return { nodeIds, edgeIds };
}

function explainPath(graph: KnowledgeGraph, nodeIds: string[], edgeIds: string[]): string {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const labels = nodeIds
    .map((id) => byId.get(id)?.label)
    .filter((label): label is string => Boolean(label));
  const evidence = edgeIds
    .map((id) => edgeById.get(id)?.sourceUrl)
    .find((url) => Boolean(url));
  const trail = labels.join(" → ");
  return evidence ? `${trail}, evidence: ${evidence}` : trail;
}

export function graphStartNodeId(
  graph: KnowledgeGraph,
  sellerId?: string,
  icpId?: string,
): string | null {
  if (sellerId) {
    const seller = sellerNodeId(sellerId);
    if (graph.nodes.some((node) => node.id === seller)) {
      return seller;
    }
  }
  const seller = graph.nodes.find((node) => node.type === "seller");
  if (seller) {
    return seller.id;
  }
  if (icpId) {
    const icp = icpNodeId(icpId);
    if (graph.nodes.some((node) => node.id === icp)) {
      return icp;
    }
  }
  return graph.nodes.find((node) => node.type === "icp")?.id ?? null;
}

export function findPathToProspect(
  graph: KnowledgeGraph,
  prospectId: string,
  options: { sellerId?: string; icpId?: string } = {},
): MatchPath | null {
  const startId = graphStartNodeId(graph, options.sellerId, options.icpId);
  const endId = prospectNodeId(prospectId);
  if (!startId || !graph.nodes.some((node) => node.id === endId)) {
    return null;
  }
  if (startId === endId) {
    return {
      prospectId,
      nodeIds: [startId],
      edgeIds: [],
      weight: 0,
      hops: 0,
      explanation: graph.nodes.find((node) => node.id === startId)?.label ?? startId,
    };
  }

  const adj = undirectedAdj(graph);
  const best = new Map<string, SearchRecord>();
  const queue: string[] = [];

  best.set(startId, {
    weight: 0,
    hops: 0,
    viaNode: null,
    viaEdge: null,
    signature: startId,
  });
  queue.push(startId);

  while (queue.length > 0) {
    queue.sort((left, right) =>
      compareRecords(best.get(left)!, best.get(right)!),
    );
    const current = queue.shift()!;
    const record = best.get(current)!;
    for (const edge of adj.get(current) ?? []) {
      const next = otherEnd(edge, current);
      const nextRecord: SearchRecord = {
        weight: record.weight + evidenceWeight(edge.evidence),
        hops: record.hops + 1,
        viaNode: current,
        viaEdge: edge.id,
        signature: `${record.signature}\0${next}`,
      };
      const existing = best.get(next);
      if (existing && compareRecords(existing, nextRecord) <= 0) {
        continue;
      }
      best.set(next, nextRecord);
      if (!queue.includes(next)) {
        queue.push(next);
      }
    }
  }

  const finish = best.get(endId);
  if (!finish) {
    return null;
  }
  const path = reconstruct(graph, best, startId, endId);
  if (!path) {
    return null;
  }
  return {
    prospectId,
    nodeIds: path.nodeIds,
    edgeIds: path.edgeIds,
    weight: finish.weight,
    hops: finish.hops,
    explanation: explainPath(graph, path.nodeIds, path.edgeIds),
  };
}

export function rankProspectMatches(
  graph: KnowledgeGraph,
  options: { sellerId?: string; icpId?: string } = {},
): MatchPath[] {
  const prospects = graph.nodes
    .filter((node) => node.type === "prospect" && node.prospectId)
    .sort((left, right) => {
      const byLabel = left.label.localeCompare(right.label);
      if (byLabel !== 0) {
        return byLabel;
      }
      return left.id.localeCompare(right.id);
    });

  const matches: MatchPath[] = [];
  for (const prospect of prospects) {
    const path = findPathToProspect(graph, prospect.prospectId!, options);
    if (path) {
      matches.push(path);
    }
  }

  return matches.sort((left, right) => {
    if (left.weight !== right.weight) {
      return left.weight - right.weight;
    }
    if (left.hops !== right.hops) {
      return left.hops - right.hops;
    }
    const leftLabel =
      graph.nodes.find((node) => node.prospectId === left.prospectId)?.label ??
      left.prospectId;
    const rightLabel =
      graph.nodes.find((node) => node.prospectId === right.prospectId)?.label ??
      right.prospectId;
    const byLabel = compareStrings(leftLabel, rightLabel);
    if (byLabel !== 0) {
      return byLabel;
    }
    return compareStrings(left.prospectId, right.prospectId);
  });
}

export function findBestMatch(
  graph: KnowledgeGraph,
  options: { sellerId?: string; icpId?: string } = {},
): MatchPath | null {
  return rankProspectMatches(graph, options)[0] ?? null;
}
