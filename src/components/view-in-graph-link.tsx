import Link from "next/link";
import { cn } from "@/lib/utils";

export function graphHref(input: {
  icpId?: string | null;
  runId?: string | null;
  prospectId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.icpId) {
    params.set("icp", input.icpId);
  }
  if (input.runId) {
    params.set("run", input.runId);
  }
  if (input.prospectId) {
    params.set("prospect", input.prospectId);
  }
  const query = params.toString();
  return query ? `/graph?${query}` : "/graph";
}

export function ViewInGraphLink({
  icpId,
  runId,
  prospectId,
  className,
}: {
  icpId?: string | null;
  runId?: string | null;
  prospectId?: string | null;
  className?: string;
}) {
  return (
    <Link
      href={graphHref({ icpId, runId, prospectId })}
      className={cn("text-xs underline underline-offset-2", className)}
    >
      View in graph
    </Link>
  );
}
