import { describe, expect, it } from "vitest";
import { layoutKnowledgeGraph, viewBoxForSelection } from "./layout";
import type { KnowledgeGraph } from "./types";

const graph: KnowledgeGraph = {
  nodes: [
    { id: "seller:s", type: "seller", label: "ShiftPilot" },
    { id: "icp:i", type: "icp", label: "ICP" },
    { id: "attr:a", type: "attribute", label: "NAICS 622110" },
    { id: "prospect:mercy", type: "prospect", label: "Mercy", prospectId: "mercy" },
    { id: "prospect:mayo", type: "prospect", label: "Mayo Clinic", prospectId: "mayo" },
    { id: "claim:c", type: "claim", label: "industry: hospital" },
    { id: "source:s", type: "source", label: "montefiore.org" },
  ],
  edges: [],
};

describe("layoutKnowledgeGraph", () => {
  it("places every node in its own column and row, never at the origin", () => {
    const laid = layoutKnowledgeGraph(graph);
    const xs = new Set(laid.nodes.map((node) => node.x));
    expect(xs.size).toBe(6);
    expect(laid.nodes.every((node) => node.x > 0 && node.y > 0)).toBe(true);

    const keys = laid.nodes.map((node) => `${node.x},${node.y}`);
    expect(new Set(keys).size).toBe(laid.nodes.length);

    const seller = laid.nodes.find((node) => node.type === "seller");
    const icp = laid.nodes.find((node) => node.type === "icp");
    const prospectXs = laid.nodes
      .filter((node) => node.type === "prospect")
      .map((node) => node.x);
    expect(seller?.x).toBeLessThan(icp?.x ?? 0);
    expect(new Set(prospectXs).size).toBe(1);
  });
});

describe("viewBoxForSelection", () => {
  it("zooms to selected path nodes and falls back to the full graph", () => {
    const laid = layoutKnowledgeGraph(graph);
    const full = viewBoxForSelection(laid, []);
    expect(full).toEqual({
      x: 0,
      y: 0,
      width: laid.width,
      height: laid.height,
    });

    const seller = laid.nodes.find((node) => node.type === "seller")!;
    const prospect = laid.nodes.find((node) => node.prospectId === "mayo")!;
    const zoomed = viewBoxForSelection(laid, [seller.id, prospect.id]);
    expect(zoomed.width).toBeLessThan(full.width);
    expect(zoomed.x).toBeLessThanOrEqual(seller.x);
    expect(zoomed.x + zoomed.width).toBeGreaterThanOrEqual(prospect.x);
  });
});
