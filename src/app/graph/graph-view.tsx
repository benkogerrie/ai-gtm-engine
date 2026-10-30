"use client";

import { useMemo, useState } from "react";
import { EvidenceLabelBadge } from "@/components/evidence-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { layoutKnowledgeGraph } from "@/lib/graph/layout";
import type { GraphSnapshot } from "@/lib/graph";
import type { EvidenceLabel } from "@/lib/discovery/types";
import type { GraphNodeType } from "@/lib/graph/types";

const NODE_FILL: Record<GraphNodeType, string> = {
  seller: "var(--color-primary)",
  icp: "var(--color-accent-foreground)",
  attribute: "var(--color-muted-foreground)",
  prospect: "var(--color-foreground)",
  claim: "var(--color-secondary-foreground)",
  source: "var(--color-border)",
};

const NODE_LEGEND: Array<{ type: GraphNodeType; label: string }> = [
  { type: "seller", label: "Seller" },
  { type: "icp", label: "ICP" },
  { type: "attribute", label: "ICP attribute" },
  { type: "prospect", label: "Prospect" },
  { type: "claim", label: "Claim" },
  { type: "source", label: "Source" },
];

function dashFor(evidence: EvidenceLabel): string {
  if (evidence === "VERIFIED") {
    return "none";
  }
  if (evidence === "INFERRED") {
    return "7 5";
  }
  return "2 4";
}

function truncate(value: string, max = 28): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function GraphView({
  snapshot,
  initialProspectId,
}: {
  snapshot: GraphSnapshot;
  initialProspectId?: string;
}) {
  const [selectedId, setSelectedId] = useState(
    initialProspectId &&
      snapshot.matches.some((match) => match.prospectId === initialProspectId)
      ? initialProspectId
      : undefined,
  );

  const layout = useMemo(
    () => layoutKnowledgeGraph(snapshot.graph),
    [snapshot.graph],
  );
  const edgeById = useMemo(
    () => new Map(snapshot.graph.edges.map((edge) => [edge.id, edge])),
    [snapshot.graph.edges],
  );
  const nodeById = useMemo(
    () => new Map(snapshot.graph.nodes.map((node) => [node.id, node])),
    [snapshot.graph.nodes],
  );
  const match = snapshot.matches.find((row) => row.prospectId === selectedId);
  const pathNodeIds = new Set(match?.nodeIds ?? []);
  const pathEdgeIds = new Set(match?.edgeIds ?? []);

  const prospects = snapshot.graph.nodes.filter((node) => node.type === "prospect");

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {snapshot.graph.nodes.length} nodes · {snapshot.graph.edges.length}{" "}
            edges · {snapshot.matches.length} matched paths
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const best = snapshot.matches[0];
              if (best) {
                setSelectedId(best.prospectId);
              }
            }}
            disabled={snapshot.matches.length === 0}
          >
            Find best match
          </Button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {NODE_LEGEND.map((item) => (
            <span key={item.type} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: NODE_FILL[item.type] }}
              />
              {item.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 border-t border-foreground" />
            VERIFIED
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 border-t border-dashed border-foreground" />
            INFERRED
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-6 border-t border-dotted border-foreground" />
            source-candidate
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Knowledge graph of seller, ICP, attributes, prospects, claims, and sources"
            className="h-auto min-h-[28rem] w-full"
          >
            {layout.edges.map((edge) => {
              const meta = edgeById.get(edge.id);
              if (!meta) {
                return null;
              }
              const onPath = pathEdgeIds.has(edge.id);
              const midX = (edge.x1 + edge.x2) / 2;
              const midY = (edge.y1 + edge.y2) / 2 - 18;
              return (
                <path
                  key={edge.id}
                  d={`M ${edge.x1} ${edge.y1} Q ${midX} ${midY} ${edge.x2} ${edge.y2}`}
                  fill="none"
                  stroke={onPath ? "var(--color-primary)" : "var(--color-border)"}
                  strokeWidth={onPath ? 2.4 : 1.2}
                  strokeDasharray={
                    onPath ? "10 8" : dashFor(meta.evidence)
                  }
                  className={onPath ? "graph-path-edge" : undefined}
                  opacity={match && !onPath ? 0.28 : 0.9}
                />
              );
            })}
            {layout.nodes.map((node) => {
              const selected =
                node.type === "prospect" && node.prospectId === selectedId;
              const onPath = pathNodeIds.has(node.id);
              const clickable = node.type === "prospect" && node.prospectId;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className={clickable ? "cursor-pointer" : undefined}
                  onClick={() => {
                    if (node.prospectId) {
                      setSelectedId(node.prospectId);
                    }
                  }}
                >
                  <circle
                    r={node.type === "claim" || node.type === "source" ? 8 : 11}
                    fill={NODE_FILL[node.type]}
                    stroke={
                      selected || onPath
                        ? "var(--color-primary)"
                        : "var(--color-background)"
                    }
                    strokeWidth={selected || onPath ? 3 : 1}
                    opacity={match && !onPath ? 0.35 : 1}
                  />
                  <text
                    y={22}
                    textAnchor="middle"
                    className="fill-foreground text-[11px]"
                  >
                    {truncate(node.label, node.type === "attribute" ? 26 : 22)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h2 className="font-serif text-xl tracking-tight">Prospects</h2>
            {prospects.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No prospect nodes in this run.
              </p>
            ) : (
              <ul className="mt-3 grid gap-1">
                {prospects.map((prospect) => {
                  const ranked = snapshot.matches.find(
                    (row) => row.prospectId === prospect.prospectId,
                  );
                  const active = prospect.prospectId === selectedId;
                  return (
                    <li key={prospect.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (prospect.prospectId) {
                            setSelectedId(prospect.prospectId);
                          }
                        }}
                        className={cn(
                          "flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                          active ? "bg-accent" : "hover:bg-secondary",
                        )}
                      >
                        <span>{prospect.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {ranked ? `w ${ranked.weight}` : "unreachable"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="font-serif text-xl tracking-tight">Match path</h2>
            {!match ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Select a prospect or click Find best match. Unreachable
                prospects have no derived seller → ICP → attribute path.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm">{match.explanation}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Weight {match.weight} · {match.hops} hops · VERIFIED=1,
                  INFERRED=3, source-candidate=5
                </p>
                <ol className="mt-3 grid gap-2 text-sm">
                  {match.edgeIds.map((edgeId, index) => {
                    const edge = edgeById.get(edgeId);
                    if (!edge) {
                      return null;
                    }
                    const from = nodeById.get(edge.from);
                    const to = nodeById.get(edge.to);
                    return (
                      <li key={edgeId} className="rounded-md border px-3 py-2">
                        <p className="font-medium">
                          {index + 1}. {from?.label} → {to?.label}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {edge.type} · {edge.label}
                        </p>
                        <div className="mt-1">
                          <EvidenceLabelBadge label={edge.evidence} />
                        </div>
                        {edge.sourceUrl ? (
                          <a
                            href={edge.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs underline underline-offset-2"
                          >
                            {edge.sourceUrl}
                          </a>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
