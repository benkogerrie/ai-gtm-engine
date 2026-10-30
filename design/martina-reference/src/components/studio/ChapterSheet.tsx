import { useState } from "react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { CHAPTERS, type ChapterId, type ChapterState } from "@/lib/journey";
import { Overlay } from "./Overlay";

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="h-1 w-28 shrink-0 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-guess" style={{ width: `${v * 100}%` }} /></span>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{v.toFixed(2)}</span>
    </div>
  );
}
const H = ({ children }: { children: string }) => <p className="mt-6 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">{children}</p>;

export function ChapterSheet({ id, state, onClose }: { id: ChapterId; state: ChapterState; onClose: () => void }) {
  const ch = CHAPTERS.find((c) => c.id === id)!;
  const [added, setAdded] = useState<string[]>([]);
  return (
    <Overlay onClose={onClose}>
      <p className="text-xs text-muted-foreground">Chapter {CHAPTERS.indexOf(ch) + 1} of 8</p>
      <h2 className="mt-1 pr-10 text-2xl font-semibold">{ch.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{state.summary}</p>

      {id === "ideal" && (<>
        <H>Industries</H>
        <div className="space-y-2">
          {[["Couriers and express delivery", 0.92], ["Freight trucking", 0.86], ["Commercial property management", 0.79], ["Car leasing", 0.71]].map(([l, v]) => <Bar key={l} label={l as string} v={v as number} />)}
        </div>
        <H>Who signs off</H>
        <div className="space-y-2">
          {[["Head of Fleet", 0.91], ["Facility Manager", 0.84], ["Head of Sustainability", 0.72]].map(([l, v]) => <Bar key={l} label={l as string} v={v as number} />)}
        </div>
        <H>Signs they're ready to buy</H>
        <ul className="space-y-1 text-sm">
          {["Fleet electrification announced", "New depot or office", "Hiring fleet roles", "Emission targets"].map((s) => <li key={s} className="text-success">✓ {s}</li>)}
          <li className="text-destructive">✗ Charging partner already named</li>
        </ul>
        <H>Also worth trying</H>
        {["Hotels and retail car parks", "Housing associations"].map((s) => (
          <div key={s} className="flex items-center justify-between border-b py-2.5 text-sm">
            {s}
            <button onClick={() => setAdded((a) => [...a, s])} disabled={added.includes(s)} className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium disabled:text-success">
              {added.includes(s) ? <><Check className="size-3" /> Added</> : <><Plus className="size-3" /> Add</>}
            </button>
          </div>
        ))}
      </>)}

      {id === "companies" && (
        <div className="mt-5 divide-y">
          {[["Tamsin Courier Group", "Germany · 620 vans", "Plans to electrify its whole van fleet by 2028", 92],
            ["Harbourline Logistics", "Netherlands · 210 trucks", "Opening a new distribution centre in Rotterdam", 88],
            ["Northgate Business Parks", "UK", "Hired a new Head of Sustainability", 84],
            ["Calloway Parcel", "US · 900 vans", "Set a 2030 fleet emission target", 79],
            ["Orrin Fleet Leasing", "Australia", "Adding EVs to its leasing catalogue", 74]].map(([n, m, news, fit]) => (
            <div key={n as string} className="flex gap-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{n}</p>
                <p className="text-xs text-muted-foreground">{m} · 2 sources</p>
                <p className="mt-1.5 text-sm"><mark className="rounded bg-highlight px-1">{news}</mark></p>
              </div>
              <p className="text-2xl font-semibold text-success tabular-nums">{fit}</p>
            </div>
          ))}
        </div>
      )}

      {id === "people" && (<>
        <H>Your warm introduction</H>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-sm">Your reference customer</span><ArrowRight className="size-4 text-muted-foreground" />
          <span className="text-sm">Daniel Okafor</span><ArrowRight className="size-4 text-muted-foreground" />
          <span className="text-sm">Lena Hartmann, Head of Fleet at Tamsin</span>
        </div>
        <H>Emails verified</H>
        <p className="text-2xl font-semibold tabular-nums">8 <span className="text-base font-normal text-muted-foreground">of 11</span></p>
        <p className="mt-2 text-sm text-muted-foreground">I never guess an email address. If I can't verify one, I write a short LinkedIn note instead.</p>
      </>)}

      {!["ideal", "companies", "people"].includes(id) && (<>
        <H>What I found</H>
        <p className="text-sm">{state.summary}</p>
        {ch.confidence && state.status === "guess" && (<><H>How sure I am</H><Bar label="Confidence" v={ch.confidence} /></>)}
        <H>Source</H>
        <p className="text-sm text-muted-foreground">{state.status === "guess" ? "Similar companies' public pages" : "What you told me"}</p>
      </>)}

      <p className="mt-8 border-t pt-4 text-sm text-muted-foreground">Something off? Tell me in the chat and I'll fix this chapter and everything that depends on it.</p>
    </Overlay>
  );
}
