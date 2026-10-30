import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GraphSnapshot } from "@/lib/graph";
import { GraphView } from "./graph-view";

const snapshot: GraphSnapshot = {
  icp: { id: "icp", name: "US hospitals", status: "APPROVED", approvedAt: null },
  icps: [],
  run: {
    id: "run",
    status: "completed",
    mode: "LIVE",
    createdAt: "2026-10-30T00:00:00.000Z",
    updatedAt: "2026-10-30T00:00:00.000Z",
    prospectCount: 2,
  },
  runs: [],
  sellerName: "ShiftPilot",
  mock: false,
  emptyReason: null,
  graph: {
    nodes: [
      { id: "seller:s", type: "seller", label: "ShiftPilot" },
      { id: "icp:i", type: "icp", label: "US hospitals ICP" },
      {
        id: "attr:industry:naics:622110",
        type: "attribute",
        label: "NAICS 622110",
        attributeKind: "industry",
      },
      {
        id: "prospect:mercy",
        type: "prospect",
        label: "Mercy",
        prospectId: "mercy",
      },
      {
        id: "prospect:mayo",
        type: "prospect",
        label: "Mayo Clinic",
        prospectId: "mayo",
      },
    ],
    edges: [
      {
        id: "e-defines",
        from: "seller:s",
        to: "icp:i",
        type: "DEFINES",
        label: "defines",
        evidence: "INFERRED",
      },
      {
        id: "e-targets",
        from: "icp:i",
        to: "attr:industry:naics:622110",
        type: "TARGETS",
        label: "targets",
        evidence: "INFERRED",
      },
      {
        id: "e-mercy",
        from: "prospect:mercy",
        to: "attr:industry:naics:622110",
        type: "IN_INDUSTRY",
        label: "in NAICS 622110",
        evidence: "VERIFIED",
      },
      {
        id: "e-mayo",
        from: "prospect:mayo",
        to: "attr:industry:naics:622110",
        type: "IN_INDUSTRY",
        label: "in NAICS 622110",
        evidence: "VERIFIED",
      },
    ],
  },
  matches: [
    {
      prospectId: "mercy",
      nodeIds: [
        "seller:s",
        "icp:i",
        "attr:industry:naics:622110",
        "prospect:mercy",
      ],
      edgeIds: ["e-defines", "e-targets", "e-mercy"],
      weight: 7,
      hops: 3,
      explanation: "ShiftPilot → US hospitals ICP → NAICS 622110 → Mercy",
    },
    {
      prospectId: "mayo",
      nodeIds: [
        "seller:s",
        "icp:i",
        "attr:industry:naics:622110",
        "prospect:mayo",
      ],
      edgeIds: ["e-defines", "e-targets", "e-mayo"],
      weight: 7,
      hops: 3,
      explanation: "ShiftPilot → US hospitals ICP → NAICS 622110 → Mayo Clinic",
    },
  ],
};

describe("GraphView highlight", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("re-renders the highlighted path when switching prospects", () => {
    const { container } = render(<GraphView snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: "Mercy" }));
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-path-prospect")).toBe("mercy");
    expect(
      container.querySelector('[data-node-id="prospect:mercy"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("true");
    expect(
      container.querySelector('[data-node-id="prospect:mayo"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("false");
    expect(
      container.querySelector('[data-edge-id="e-mercy"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("true");
    expect(
      container.querySelector('[data-edge-id="e-mayo"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Mayo Clinic" }));
    expect(svg?.getAttribute("data-path-prospect")).toBe("mayo");
    expect(
      container.querySelector('[data-node-id="prospect:mayo"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("true");
    expect(
      container.querySelector('[data-node-id="prospect:mercy"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("false");
    expect(
      container.querySelector('[data-edge-id="e-mayo"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("true");
    expect(
      container.querySelector('[data-edge-id="e-mercy"]')?.getAttribute(
        "data-on-path",
      ),
    ).toBe("false");
    expect(container.querySelector("[data-path-layer]")?.getAttribute("data-path-layer")).toBe(
      "mayo",
    );
  });

  it("shows a matching status then reveals the top-ranked path", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    vi.useFakeTimers();
    const { container } = render(<GraphView snapshot={snapshot} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Find best match" })[0]!);
    expect(screen.getAllByText("Matching 2 prospects…").length).toBeGreaterThan(
      0,
    );
    expect(container.querySelector("svg")?.getAttribute("data-path-prospect")).toBe(
      "",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(container.querySelector("svg")?.getAttribute("data-path-prospect")).toBe(
      "mercy",
    );
    expect(screen.getByText(/ShiftPilot → US hospitals ICP → NAICS 622110 → Mercy/)).toBeInTheDocument();
  });
});
