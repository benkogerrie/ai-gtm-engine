import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "./builder";
import { industryNodeId, prospectNodeId, sellerNodeId } from "./ids";
import type { GraphBuildInput, GraphProspectInput } from "./types";

const SELLER = { id: "prod-shiftpilot", name: "ShiftPilot" };
const ICP = {
  id: "icp-hospitals",
  name: "US hospitals ICP",
  industries: [
    {
      name: "General Medical and Surgical Hospitals",
      naics: "622110",
      label: "General Medical and Surgical Hospitals",
    },
  ],
  personas: [{ title: "Chief Nursing Officer" }],
  triggers: [{ summary: "nurse scheduling platform rollout", type: "TECH_STACK_CHANGE" }],
};

function montefiore(overrides: Partial<GraphProspectInput> = {}): GraphProspectInput {
  return {
    id: "co-montefiore",
    name: "Montefiore",
    domain: "montefiore.org",
    industry: null,
    fitScore: 78,
    rationale: "Hospital with nurse scheduling coverage.",
    whyFit: "Named health system.",
    verifiedUrls: ["https://montefiore.org/news/scheduling"],
    claims: [
      {
        field: "name",
        value: "Montefiore",
        sourceUrl: "https://montefiore.org/news/scheduling",
        quote: "Montefiore Health System expands nurse scheduling platform",
        sourceTitle: "Montefiore news",
        sourceDomain: "montefiore.org",
      },
      {
        field: "industry",
        value: "General Medical and Surgical Hospitals",
        sourceUrl: "https://montefiore.org/news/scheduling",
        quote: "The hospital system cited NAICS 622110 operations",
      },
    ],
    signals: [
      {
        summary: "nurse scheduling platform rollout",
        sourceUrl: "https://montefiore.org/news/scheduling",
      },
    ],
    ...overrides,
  };
}

describe("buildKnowledgeGraph", () => {
  it("builds seller, ICP, attributes, prospects, claims, and sources from stored data", () => {
    const graph = buildKnowledgeGraph({
      seller: SELLER,
      icp: ICP,
      prospects: [montefiore()],
    });

    const types = new Set(graph.nodes.map((node) => node.type));
    expect([...types].sort()).toEqual([
      "attribute",
      "claim",
      "icp",
      "prospect",
      "seller",
      "source",
    ]);
    expect(graph.nodes.find((node) => node.type === "seller")?.label).toBe(
      "ShiftPilot",
    );
    expect(
      graph.nodes.some((node) => node.label === "NAICS 622110"),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.type === "DEFINES" && edge.evidence === "INFERRED",
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.type === "TARGETS" && edge.evidence === "INFERRED",
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) =>
          edge.type === "IN_INDUSTRY" &&
          edge.evidence === "VERIFIED" &&
          edge.sourceUrl === "https://montefiore.org/news/scheduling",
      ),
    ).toBe(true);
    expect(
      graph.edges.some(
        (edge) => edge.type === "HAS_SIGNAL" && edge.evidence === "VERIFIED",
      ),
    ).toBe(true);
    expect(graph.edges.some((edge) => edge.type === "ABOUT")).toBe(true);
    expect(graph.edges.some((edge) => edge.type === "CITES")).toBe(true);
  });

  it("does not invent nodes or edges when a link cannot be derived", () => {
    const graph = buildKnowledgeGraph({
      seller: SELLER,
      icp: ICP,
      prospects: [
        {
          id: "co-unrelated",
          name: "Acme Freight",
          domain: "acmefreight.example",
          claims: [
            {
              field: "name",
              value: "Acme Freight",
              sourceUrl: "https://acmefreight.example/about",
              quote: "Acme Freight moves pallets between warehouses",
            },
          ],
          signals: [],
        },
      ],
    });

    const prospectId = prospectNodeId("co-unrelated");
    expect(
      graph.edges.some(
        (edge) =>
          (edge.from === prospectId || edge.to === prospectId) &&
          (edge.type === "IN_INDUSTRY" || edge.type === "HAS_SIGNAL"),
      ),
    ).toBe(false);
    expect(graph.nodes.some((node) => node.label === "Invented Buyer")).toBe(
      false,
    );
  });

  it("labels fit-only industry mentions INFERRED and unlabeled claim URLs source-candidate", () => {
    const graph = buildKnowledgeGraph({
      seller: SELLER,
      icp: ICP,
      prospects: [
        montefiore({
          industry: "General Medical and Surgical Hospitals",
          verifiedUrls: [],
          claims: [
            {
              field: "name",
              value: "Montefiore",
              sourceUrl: "https://example.net/listicle",
              quote: "Random mention",
            },
          ],
          signals: [],
          rationale: "Looks like a hospital buyer",
          whyFit: "Hospital system",
        }),
      ],
    });

    const industryEdges = graph.edges.filter((edge) => edge.type === "IN_INDUSTRY");
    expect(industryEdges.length).toBeGreaterThan(0);
    expect(industryEdges.every((edge) => edge.evidence === "INFERRED")).toBe(
      true,
    );

    const about = graph.edges.filter((edge) => edge.type === "ABOUT");
    expect(about.some((edge) => edge.evidence === "source-candidate")).toBe(true);
  });

  it("returns an empty graph when nothing stored is supplied", () => {
    const graph = buildKnowledgeGraph({});
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it("does not add a seller node without a stored name", () => {
    const input: GraphBuildInput = {
      seller: { id: "x", name: "   " },
      icp: { ...ICP, industries: [], personas: [], triggers: [] },
    };
    const graph = buildKnowledgeGraph(input);
    expect(graph.nodes.some((node) => node.id === sellerNodeId("x"))).toBe(
      false,
    );
    expect(graph.nodes.some((node) => node.type === "icp")).toBe(true);
    expect(
      graph.nodes.some((node) => node.id === industryNodeId({ name: "missing" })),
    ).toBe(false);
  });
});
