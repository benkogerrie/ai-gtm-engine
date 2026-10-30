import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const STAGES = ["Matched", "Contacted", "Replied", "Meeting booked", "Closed"] as const;
export type Deal = { co: string; who: string; stage: number; byMe: boolean; note: string; fresh?: boolean };

export const START_DEALS: Deal[] = [
  { co: "Meridia Field Services", who: "Fleet lead not found yet", stage: 0, byMe: true, note: "Matched" },
  { co: "Orrin Fleet Leasing", who: "Sam Patel", stage: 0, byMe: true, note: "Matched" },
  { co: "Linden Grocers", who: "Joe Mendes", stage: 2, byMe: true, note: "Positive reply" },
  { co: "Aster Hospital Group", who: "Ines Duarte", stage: 3, byMe: false, note: "Booked by Robbie" },
  { co: "Pell & Sons Haulage", who: "Won · €84k", stage: 4, byMe: false, note: "Closed by Martina · Won €84k" },
];

export function Pipeline({ deals, setDeals }: { deals: Deal[]; setDeals: (fn: (d: Deal[]) => Deal[]) => void }) {
  const move = (i: number) =>
    setDeals((d) => d.map((x, j) => (j === i && x.stage < 4 ? { ...x, stage: x.stage + 1, byMe: false, fresh: false, note: `Moved by you` } : x)));
  const meetings = 3 + deals.filter((d) => d.stage >= 3).length;
  return (
    <main className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-5">
      <p className="max-w-3xl text-xl leading-snug sm:text-2xl">
        I looked at 214 companies and kept <b>38</b>. When we opened with their news, <b className="text-success">1 in 5</b> wrote back, and you now have <b key={meetings} className="text-primary">{meetings} meetings</b> on your calendar.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">Each meeting cost about 96 credits in research and contacts.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {STAGES.map((st, si) => {
          const items = deals.map((d, i) => ({ d, i })).filter(({ d }) => d.stage === si);
          return (
            <div key={st} className="border-t pt-3">
              <div className="mb-3 flex justify-between text-sm font-medium"><span>{st}</span><span className="text-muted-foreground">{items.length}</span></div>
              <div className="space-y-3">
                {items.map(({ d, i }) => (
                  <div key={d.co} className={cn("group border-l-2 pb-3 pl-3 animate-in fade-in slide-in-from-left-2", d.fresh ? "border-l-foreground" : "border-l-transparent")}>
                    <p className="text-sm font-medium">{d.co}</p>
                    <p className="text-xs text-muted-foreground">{d.who}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={cn("size-1.5 shrink-0 rounded-full", d.byMe ? "bg-foreground" : "border border-foreground bg-background")} /><span className="truncate">{d.note}</span>
                      </span>
                      {si < 4 && (
                        <button onClick={() => move(i)} className="shrink-0 rounded-md p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100" aria-label={`Move ${d.co} to ${STAGES[si + 1]}`}><ChevronRight className="size-4" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        Sample data
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-foreground" />Moved by me</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full border border-foreground" />Moved by you or your team</span>
      </p>
    </main>
  );
}
