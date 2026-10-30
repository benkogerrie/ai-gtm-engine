import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "./builder";
import { findBestMatch, findPathToProspect, rankProspectMatches } from "./path";
import { GRAPH_EVIDENCE_WEIGHTS } from "./types";
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
    {
      name: "Hospitals",
      naics: "622",
      label: "Hospitals",
    },
  ],
  personas: [],
  triggers: [{ summary: "nurse scheduling platform rollout" }],
};

function prospect(input: {
  id: string;
  name: string;
  quote: string;
  url: string;
  verified?: boolean;
  industryField?: boolean;
}): GraphProspectInput {
  const claims = [
    {
      field: input.industryField ? "industry" : "name",
      value: input.name,
      sourceUrl: input.url,
      quote: input.quote,
    },
  ];
  return {
    id: input.id,
    name: input.name,
    domain: `${input.id}.example`,
    claims,
    signals: [],
    verifiedUrls: input.verified === false ? [] : [input.url],
  };
}

function graph(prospects: GraphProspectInput[]) {
  const input: GraphBuildInput = {
    seller: SELLER,
    icp: ICP,
    prospects,
  };
  return buildKnowledgeGraph(input);
}

describe("path finding", () => {
  it("finds ShiftPilot → ICP → NAICS → prospect with VERIFIED cheaper than INFERRED", () => {
    const built = buildKnowledgeGraph({
      seller: SELLER,
      icp: {
        ...ICP,
        industries: [ICP.industries[0]!],
      },
      prospects: [
        prospect({
          id: "co-montefiore",
          name: "Montefiore",
          quote: "Montefiore hospital cited NAICS 622110 nurse scheduling",
          url: "https://montefiore.org/news",
          industryField: true,
        }),
      ],
    });

    const path = findPathToProspect(built, "co-montefiore", {
      sellerId: SELLER.id,
      icpId: ICP.id,
    });
    expect(path).not.toBeNull();
    expect(path?.explanation).toMatch(/ShiftPilot → .+ → NAICS 622110 → Montefiore/);
    expect(path?.explanation).toMatch(/evidence: https:\/\/montefiore.org\/news/);
    expect(path?.weight).toBe(
      GRAPH_EVIDENCE_WEIGHTS.INFERRED +
        GRAPH_EVIDENCE_WEIGHTS.INFERRED +
        GRAPH_EVIDENCE_WEIGHTS.VERIFIED,
    );
    expect(path?.hops).toBe(3);
  });

  it("uses label weights so VERIFIED paths beat source-candidate paths", () => {
    const built = graph([
      prospect({
        id: "co-verified",
        name: "Verified Health",
        quote: "hospital NAICS 622110",
        url: "https://verified.example/a",
        industryField: true,
      }),
      prospect({
        id: "co-candidate",
        name: "Candidate Health",
        quote: "hospital NAICS 622110",
        url: "https://candidate.example/a",
        industryField: true,
        verified: false,
      }),
    ]);

    const ranked = rankProspectMatches(built, {
      sellerId: SELLER.id,
      icpId: ICP.id,
    });
    expect(ranked.map((row) => row.prospectId)).toEqual([
      "co-verified",
      "co-candidate",
    ]);
    expect(ranked[0]!.weight).toBeLessThan(ranked[1]!.weight);
    expect(ranked[1]!.weight).toBe(
      GRAPH_EVIDENCE_WEIGHTS.INFERRED +
        GRAPH_EVIDENCE_WEIGHTS.INFERRED +
        GRAPH_EVIDENCE_WEIGHTS["source-candidate"],
    );
  });

  it("breaks ties by hop count, then by prospect label", () => {
    const built = graph([
      prospect({
        id: "co-mercy",
        name: "Mercy",
        quote: "Mercy hospital NAICS 622110",
        url: "https://mercy.example/a",
        industryField: true,
      }),
      prospect({
        id: "co-advent",
        name: "AdventHealth",
        quote: "AdventHealth hospital NAICS 622110",
        url: "https://advent.example/a",
        industryField: true,
      }),
    ]);
    const ranked = rankProspectMatches(built, {
      sellerId: SELLER.id,
      icpId: ICP.id,
    });
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.weight).toBe(ranked[1]!.weight);
    expect(ranked[0]!.hops).toBe(ranked[1]!.hops);
    expect(ranked.map((row) => row.prospectId)).toEqual([
      "co-advent",
      "co-mercy",
    ]);
    expect(findBestMatch(built, { sellerId: SELLER.id })?.prospectId).toBe(
      "co-advent",
    );
  });

  it("returns null for an unreachable prospect and omits it from ranking", () => {
    const built = graph([
      {
        id: "co-freight",
        name: "Acme Freight",
        claims: [
          {
            field: "name",
            value: "Acme Freight",
            sourceUrl: "https://acmefreight.example",
            quote: "pallet brokerage between warehouses",
          },
        ],
        signals: [],
      },
      prospect({
        id: "co-montefiore",
        name: "Montefiore",
        quote: "hospital NAICS 622110",
        url: "https://montefiore.org/news",
        industryField: true,
      }),
    ]);

    expect(findPathToProspect(built, "co-freight", { sellerId: SELLER.id })).toBe(
      null,
    );
    expect(
      rankProspectMatches(built, { sellerId: SELLER.id }).map(
        (row) => row.prospectId,
      ),
    ).toEqual(["co-montefiore"]);
  });

  it("prefers the lex-smaller node sequence when two equal-weight industry hops exist", () => {
    const built = graph([
      prospect({
        id: "co-both",
        name: "Both Match Health",
        quote: "hospital NAICS 622110 and NAICS 622 operations",
        url: "https://both.example/a",
        industryField: true,
      }),
    ]);
    const path = findPathToProspect(built, "co-both", { sellerId: SELLER.id });
    expect(path).not.toBeNull();
    const industryHop = path?.nodeIds[2];
    expect(industryHop).toBeDefined();
    expect(industryHop).toBe("attr:industry:naics:622");
  });
});
