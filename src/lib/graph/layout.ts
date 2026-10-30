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

export type GraphViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const COLUMN_X: Record<GraphNodeType, number> = {
  seller: 200,
  icp: 520,
  attribute: 900,
  prospect: 1320,
  claim: 1740,
  source: 2140,
};

const COLUMN_ORDER: GraphNodeType[] = [
  "seller",
  "icp",
  "attribute",
  "prospect",
  "claim",
  "source",
];

export const GRAPH_VIEWBOX = { width: 2360, height: 720 };

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
    const bucket = byType.get(node.type) ?? [];
    bucket.push(node);
    byType.set(node.type, bucket);
  }
  for (const list of byType.values()) {
    list.sort((left, right) => {
      const byLabel = left.label.localeCompare(right.label);
      if (byLabel !== 0) {
        return byLabel;
      }
      return left.id.localeCompare(right.id);
    });
  }

  const maxCount = Math.max(1, ...[...byType.values()].map((list) => list.length));
  const height = Math.max(GRAPH_VIEWBOX.height, 160 + maxCount * 108);
  const laid: LaidOutNode[] = [];
  const byId = new Map<string, LaidOutNode>();

  for (const type of COLUMN_ORDER) {
    const list = byType.get(type) ?? [];
    const gap = list.length > 0 ? height / (list.length + 1) : height / 2;
    const x = COLUMN_X[type];
    list.forEach((node, index) => {
      const laidNode = {
        ...node,
        x,
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

export function viewBoxForSelection(
  layout: { nodes: LaidOutNode[]; width: number; height: number },
  nodeIds: string[] | null | undefined,
): GraphViewBox {
  const full: GraphViewBox = {
    x: 0,
    y: 0,
    width: layout.width,
    height: layout.height,
  };
  if (!nodeIds || nodeIds.length === 0) {
    return full;
  }
  const selected = layout.nodes.filter((node) => nodeIds.includes(node.id));
  if (selected.length === 0) {
    return full;
  }
  const padX = 240;
  const padY = 160;
  const minX = Math.min(...selected.map((node) => node.x)) - padX;
  const maxX = Math.max(...selected.map((node) => node.x)) + padX;
  const minY = Math.min(...selected.map((node) => node.y)) - padY;
  const maxY = Math.max(...selected.map((node) => node.y)) + padY;
  const x = Math.max(0, minX);
  const y = Math.max(0, minY);
  return {
    x,
    y,
    width: Math.min(layout.width - x, Math.max(520, maxX - x)),
    height: Math.min(layout.height - y, Math.max(320, maxY - y)),
  };
}
