"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  source: "var(--color-foreground)",
};

const NODE_LEGEND: Array<{ type: GraphNodeType; label: string }> = [
  { type: "seller", label: "Seller" },
  { type: "icp", label: "ICP" },
  { type: "attribute", label: "ICP attribute" },
  { type: "prospect", label: "Prospect" },
  { type: "claim", label: "Claim" },
  { type: "source", label: "Source" },
];

const EDGE_STROKE = "var(--color-foreground)";
const PATH_STROKE = "var(--color-primary)";

function dashFor(evidence: EvidenceLabel): string | undefined {
  if (evidence === "VERIFIED") {
    return undefined;
  }
  if (evidence === "INFERRED") {
    return "10 7";
  }
  return "1.75 5";
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function wrapLabel(value: string, maxChars: number, maxLines: number): string[] {
  if (value.length <= maxChars) {
    return [value];
  }
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length === maxLines - 1) {
      const rest = [word, ...words.slice(words.indexOf(word) + 1)].join(" ");
      lines.push(truncate(rest, maxChars));
      return lines;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function nodeRadius(
  type: GraphNodeType,
  onPath: boolean,
  selected: boolean,
): number {
  const compact = type === "claim" || type === "source";
  if (selected) {
    return 20;
  }
  if (onPath) {
    return compact ? 14 : 18;
  }
  return compact ? 8 : 12;
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
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimer.current !== null) {
        clearTimeout(searchTimer.current);
      }
    };
  }, []);

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
  const hopIndex = new Map(
    (match?.edgeIds ?? []).map((edgeId, index) => [edgeId, index]),
  );

  const prospects = snapshot.graph.nodes.filter((node) => node.type === "prospect");
  const pathEdges = layout.edges.filter((edge) => pathEdgeIds.has(edge.id));
  const otherEdges = layout.edges.filter((edge) => !pathEdgeIds.has(edge.id));

  function selectProspect(prospectId: string) {
    if (searchTimer.current !== null) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    setSearching(false);
    setSelectedId(prospectId);
  }

  function findBestMatch() {
    const best = snapshot.matches[0];
    if (!best) {
      return;
    }
    if (searchTimer.current !== null) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    if (prefersReducedMotion()) {
      setSearching(false);
      setSelectedId(best.prospectId);
      return;
    }
    setSearching(true);
    setSelectedId(undefined);
    searchTimer.current = setTimeout(() => {
      setSelectedId(best.prospectId);
      setSearching(false);
      searchTimer.current = null;
    }, 720);
  }

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {searching
              ? `Matching ${snapshot.matches.length} prospects…`
              : `${snapshot.graph.nodes.length} nodes · ${snapshot.graph.edges.length} edges · ${snapshot.matches.length} matched paths`}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={findBestMatch}
            disabled={snapshot.matches.length === 0 || searching}
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
            <span className="inline-block w-7 border-t-2 border-foreground" />
            VERIFIED
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-7 border-t-2 border-dashed border-foreground" />
            INFERRED
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-7 border-t-2 border-dotted border-foreground" />
            source-candidate
          </span>
        </div>

        <div
          className="relative min-h-[600px] overflow-auto rounded-lg border bg-card"
          style={{ height: "min(72vh, 920px)" }}
        >
          {searching ? (
            <div
              className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm font-medium"
              role="status"
            >
              Matching {snapshot.matches.length} prospects…
            </div>
          ) : null}
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width}
            height={Math.max(layout.height, 600)}
            role="img"
            aria-label="Knowledge graph of seller, ICP, attributes, prospects, claims, and sources"
            data-path-prospect={selectedId ?? ""}
            data-searching={searching ? "true" : "false"}
            className="block"
          >
            {otherEdges.map((edge) => {
              const meta = edgeById.get(edge.id);
              if (!meta) {
                return null;
              }
              const midX = (edge.x1 + edge.x2) / 2;
              const midY = (edge.y1 + edge.y2) / 2 - 24;
              return (
                <path
                  key={edge.id}
                  d={`M ${edge.x1} ${edge.y1} Q ${midX} ${midY} ${edge.x2} ${edge.y2}`}
                  fill="none"
                  stroke={EDGE_STROKE}
                  strokeWidth={1.55}
                  strokeDasharray={dashFor(meta.evidence)}
                  strokeLinecap={meta.evidence === "VERIFIED" ? "butt" : "round"}
                  vectorEffect="non-scaling-stroke"
                  opacity={match ? 0.2 : 0.72}
                  data-edge-id={edge.id}
                  data-on-path="false"
                />
              );
            })}
            <g key={selectedId ?? "none"} data-path-layer={selectedId ?? "none"}>
              {pathEdges.map((edge) => {
                const meta = edgeById.get(edge.id);
                if (!meta) {
                  return null;
                }
                const midX = (edge.x1 + edge.x2) / 2;
                const midY = (edge.y1 + edge.y2) / 2 - 24;
                const hop = hopIndex.get(edge.id) ?? 0;
                return (
                  <path
                    key={edge.id}
                    d={`M ${edge.x1} ${edge.y1} Q ${midX} ${midY} ${edge.x2} ${edge.y2}`}
                    fill="none"
                    stroke={PATH_STROKE}
                    strokeWidth={3.5}
                    strokeDasharray="14 10"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className="graph-path-edge"
                    style={{ animationDelay: `${hop * 140}ms` }}
                    opacity={1}
                    data-edge-id={edge.id}
                    data-on-path="true"
                    data-hop={hop}
                  />
                );
              })}
            </g>
            {layout.nodes.map((node) => {
              const selected =
                node.type === "prospect" && node.prospectId === selectedId;
              const onPath = pathNodeIds.has(node.id);
              const clickable = node.type === "prospect" && node.prospectId;
              const radius = nodeRadius(node.type, onPath, selected);
              const showFull = onPath || selected;
              const lines = showFull
                ? wrapLabel(node.label, 34, 3)
                : [truncate(node.label, 32)];
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className={cn(clickable && "cursor-pointer", onPath && "graph-path-node")}
                  opacity={match && !onPath ? 0.2 : 1}
                  onClick={() => {
                    if (node.prospectId) {
                      selectProspect(node.prospectId);
                    }
                  }}
                  data-node-id={node.id}
                  data-on-path={onPath ? "true" : "false"}
                  data-selected={selected ? "true" : "false"}
                >
                  <title>{node.label}</title>
                  {onPath || selected ? (
                    <circle
                      r={radius + 6}
                      fill="none"
                      stroke={PATH_STROKE}
                      strokeWidth={2}
                      opacity={0.35}
                    />
                  ) : null}
                  <circle
                    r={radius}
                    fill={NODE_FILL[node.type]}
                    stroke={
                      selected || onPath ? PATH_STROKE : "var(--color-background)"
                    }
                    strokeWidth={selected || onPath ? 3.5 : 1}
                  />
                  {lines.map((line, index) => (
                    <text
                      key={`${node.id}-${index}`}
                      y={radius + 16 + index * 15}
                      textAnchor="middle"
                      fill="var(--color-foreground)"
                      fontSize={12.5}
                      fontWeight={onPath || selected ? 600 : 400}
                    >
                      {line}
                    </text>
                  ))}
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
                        aria-label={prospect.label}
                        aria-pressed={active}
                        onClick={() => {
                          if (prospect.prospectId) {
                            selectProspect(prospect.prospectId);
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
            {searching ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Matching {snapshot.matches.length} prospects…
              </p>
            ) : !match ? (
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
