import type { GraphNode, GraphNodeType, KnowledgeGraph } from "./types";

export type LaidOutNode = GraphNode & { x: number; y: number };
export type LaidOutEdge = {
  id: string;
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

const COLUMN_X: Record<GraphNodeType, number> = {
  seller: 180,
  icp: 460,
  attribute: 820,
  prospect: 1220,
  claim: 1620,
  source: 2000,
};

const COLUMN_ORDER: GraphNodeType[] = [
  "seller",
  "icp",
  "attribute",
  "prospect",
  "claim",
  "source",
];

export const GRAPH_VIEWBOX = { width: 2200, height: 720 };

export function layoutKnowledgeGraph(graph: KnowledgeGraph): {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
} {
  const byType = new Map<GraphNodeType, GraphNode[]>();
  for (const type of COLUMN_ORDER) {
    byType.set(type, []);
  }
  for (const node of graph.nodes) {
    byType.get(node.type)?.push(node);
  }
  for (const list of byType.values()) {
    list.sort((left, right) => left.label.localeCompare(right.label));
  }

  const maxCount = Math.max(1, ...[...byType.values()].map((list) => list.length));
  const height = Math.max(GRAPH_VIEWBOX.height, 140 + maxCount * 92);
  const laid: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();

  for (const type of COLUMN_ORDER) {
    const list = byType.get(type) ?? [];
    const gap = list.length > 0 ? height / (list.length + 1) : height / 2;
    list.forEach((node, index) => {
      const laidNode = {
        ...node,
        x: COLUMN_X[type],
        y: gap * (index + 1),
      };
      laid.push(laidNode);
      byId.set(node.id, laidNode);
    });
  }

  const edges: LaidOutEdge[] = graph.edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) {
      return [];
    }
    return [
      {
        id: edge.id,
        from: edge.from,
        to: edge.to,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      },
    ];
  });

  return { nodes: laid, edges, width: GRAPH_VIEWBOX.width, height };
}
