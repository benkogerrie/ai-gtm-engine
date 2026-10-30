"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EvidenceLabelBadge } from "@/components/evidence-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { layoutKnowledgeGraph, viewBoxForSelection } from "@/lib/graph/layout";
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
  { type: "attribute", label: "Attribute" },
  { type: "prospect", label: "Prospect" },
  { type: "claim", label: "Claim" },
  { type: "source", label: "Source" },
];

const EDGE_STROKE = "var(--color-foreground)";
const PATH_STROKE = "var(--color-primary)";
const DIMMED = 0.42;
const LABEL_HALO = "var(--color-background)";

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
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i]!;
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
      lines.push(truncate([word, ...words.slice(i + 1)].join(" "), maxChars));
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
    return 18;
  }
  if (onPath) {
    return compact ? 13 : 16;
  }
  return compact ? 8 : 11;
}

function evidenceBadge(label: EvidenceLabel): string {
  if (label === "source-candidate") {
    return "SRC";
  }
  return label;
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
  const [fitAll, setFitAll] = useState(false);
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
  const viewBox = viewBoxForSelection(
    layout,
    !fitAll && match ? match.nodeIds : null,
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
    setFitAll(false);
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
    setFitAll(false);
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
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <p aria-live="polite">
          {searching
            ? `Matching ${snapshot.matches.length} prospects…`
            : `${snapshot.graph.nodes.length} nodes · ${snapshot.graph.edges.length} edges · ${snapshot.matches.length} paths`}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={findBestMatch}
          disabled={snapshot.matches.length === 0 || searching}
        >
          Find best match
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setFitAll(true)}
        >
          Fit all
        </Button>
        {NODE_LEGEND.map((item) => (
          <span key={item.type} className="inline-flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: NODE_FILL[item.type] }}
            />
            {item.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-5 border-t-2 border-foreground" />
          VERIFIED
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-5 border-t-2 border-dashed border-foreground" />
          INFERRED
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-5 border-t-2 border-dotted border-foreground" />
          candidate
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_17rem]">
        <div
          className="relative h-[70vh] min-h-[420px] overflow-hidden rounded-lg border bg-card"
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
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Knowledge graph of seller, ICP, attributes, prospects, claims, and sources"
            data-path-prospect={selectedId ?? ""}
            data-searching={searching ? "true" : "false"}
            data-viewbox={`${viewBox.x} ${viewBox.y} ${Math.round(viewBox.width)} ${Math.round(viewBox.height)}`}
            className="h-full w-full"
          >
            {otherEdges.map((edge) => {
              const meta = edgeById.get(edge.id);
              if (!meta) {
                return null;
              }
              const midX = (edge.x1 + edge.x2) / 2;
              const midY = (edge.y1 + edge.y2) / 2 - 28;
              return (
                <path
                  key={edge.id}
                  d={`M ${edge.x1} ${edge.y1} Q ${midX} ${midY} ${edge.x2} ${edge.y2}`}
                  fill="none"
                  stroke={EDGE_STROKE}
                  strokeWidth={1.55}
                  strokeDasharray={dashFor(meta.evidence)}
                  strokeLinecap={meta.evidence === "VERIFIED" ? "butt" : "round"}
                  opacity={match ? DIMMED : 0.72}
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
                const controlY = (edge.y1 + edge.y2) / 2 - 28;
                const hop = hopIndex.get(edge.id) ?? 0;
                const badgeX = (edge.x1 + 2 * midX + edge.x2) / 4;
                const badgeY = (edge.y1 + 2 * controlY + edge.y2) / 4;
                const badge = evidenceBadge(meta.evidence);
                return (
                  <g
                    key={edge.id}
                    className="graph-path-edge"
                    style={{ animationDelay: `${hop * 140}ms` }}
                  >
                    <path
                      d={`M ${edge.x1} ${edge.y1} Q ${midX} ${controlY} ${edge.x2} ${edge.y2}`}
                      fill="none"
                      stroke={PATH_STROKE}
                      strokeWidth={3.75}
                      strokeLinecap="round"
                      data-edge-id={edge.id}
                      data-on-path="true"
                      data-hop={hop}
                    />
                    <rect
                      x={badgeX - 28}
                      y={badgeY - 9}
                      width={56}
                      height={16}
                      rx={3}
                      fill="var(--color-background)"
                      stroke={PATH_STROKE}
                      strokeWidth={1}
                    />
                    <text
                      x={badgeX}
                      y={badgeY + 4}
                      textAnchor="middle"
                      fill={PATH_STROKE}
                      fontSize={9}
                      fontWeight={700}
                    >
                      {badge}
                    </text>
                  </g>
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
              const lines = wrapLabel(node.label, showFull ? 26 : 22, 2);
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className={clickable ? "cursor-pointer" : undefined}
                  opacity={match && !onPath ? DIMMED : 1}
                  onClick={() => {
                    if (node.prospectId) {
                      selectProspect(node.prospectId);
                    }
                  }}
                  data-node-id={node.id}
                  data-on-path={onPath ? "true" : "false"}
                  data-selected={selected ? "true" : "false"}
                  data-x={String(node.x)}
                  data-y={String(node.y)}
                >
                  <title>{node.label}</title>
                  {onPath || selected ? (
                    <circle
                      r={radius + 6}
                      fill="none"
                      stroke={PATH_STROKE}
                      strokeWidth={2.5}
                      opacity={0.4}
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
                      y={radius + 20 + index * 15}
                      textAnchor="middle"
                      fill="var(--color-foreground)"
                      stroke={LABEL_HALO}
                      strokeWidth={5}
                      paintOrder="stroke"
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

        <aside className="flex max-h-[70vh] min-h-[420px] flex-col gap-3">
          <Card className="min-h-0 flex-1 overflow-hidden">
            <CardContent className="flex h-full flex-col p-3">
              <h2 className="font-serif text-lg tracking-tight">Prospects</h2>
              {prospects.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No prospect nodes in this run.
                </p>
              ) : (
                <ul className="mt-2 min-h-0 flex-1 space-y-0.5 overflow-auto">
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
                            "flex w-full items-start justify-between gap-2 rounded-md px-2 py-1 text-left text-sm",
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

          <Card className="max-h-[46%] overflow-auto">
            <CardContent className="p-3">
              <h2 className="font-serif text-lg tracking-tight">Match path</h2>
              {searching ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Matching {snapshot.matches.length} prospects…
                </p>
              ) : !match ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a prospect or Find best match.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm">{match.explanation}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Weight {match.weight} · {match.hops} hops
                  </p>
                  <ol className="mt-2 grid gap-1.5 text-sm">
                    {match.edgeIds.map((edgeId, index) => {
                      const edge = edgeById.get(edgeId);
                      if (!edge) {
                        return null;
                      }
                      const from = nodeById.get(edge.from);
                      const to = nodeById.get(edge.to);
                      return (
                        <li key={edgeId} className="rounded-md border px-2 py-1.5">
                          <p className="font-medium">
                            {index + 1}. {from?.label} → {to?.label}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <EvidenceLabelBadge label={edge.evidence} />
                            {edge.sourceUrl ? (
                              <a
                                href={edge.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline underline-offset-2"
                              >
                                source
                              </a>
                            ) : null}
                          </div>
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
    </div>
  );
}
