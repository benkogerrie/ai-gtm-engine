import type { EvidenceLabel } from "@/lib/discovery/types";

const STYLES: Record<EvidenceLabel, string> = {
  VERIFIED:
    "border-emerald-300 bg-emerald-50 text-emerald-800",
  INFERRED: "border-amber-300 bg-amber-50 text-amber-900",
  "source-candidate": "border-[var(--rule)] bg-[var(--card)] text-[var(--muted)]",
};

export function EvidenceLabelBadge({
  label,
}: {
  label: EvidenceLabel;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase ${STYLES[label]}`}
    >
      {label}
    </span>
  );
}

export function EvidenceLegend() {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
      <EvidenceLabelBadge label="VERIFIED" />
      cited source URL
      <EvidenceLabelBadge label="INFERRED" />
      AI judgement
      <EvidenceLabelBadge label="source-candidate" />
      search hit not yet a verified fact
    </p>
  );
}
