import { useState } from "react";
import { cn } from "@/lib/utils";
import { Overlay } from "./Overlay";

export const DRAFTS = [
  { name: "Lena Hartmann", role: "Head of Fleet", company: "Tamsin Courier Group", fit: 92, verified: true, subject: "620 electric vans by 2028, and where they charge overnight", hook: "Tamsin Courier Group plans to electrify its whole van fleet by 2028", body: ["The vans are usually the easy part. Charging at the depot and at drivers' homes is where costs get messy.", "We install and run EV chargers for businesses, with no upfront cost and one monthly fee per charge point, in Europe and North America. A logistics customer with 40 vans went live with us in 11 weeks.", "Daniel Okafor, who worked at Tamsin until 2022, runs operations there and is happy to compare notes.", "Would 20 minutes next week be useful?"] },
  { name: "Pieter de Wit", role: "Fleet Manager", company: "Harbourline Logistics", fit: 88, verified: true, subject: "Your new distribution centre", hook: "Harbourline is opening a new distribution centre in Rotterdam", body: ["New sites are the cheapest moment to plan charging, before the concrete sets.", "We install and run chargers with no upfront cost and one monthly fee per point.", "Worth a quick look before the electricians arrive?"] },
  { name: "Grace Whitfield", role: "Head of Sustainability", company: "Northgate Business Parks", fit: 84, verified: false, subject: "LinkedIn note", hook: "you just started as Head of Sustainability at Northgate", body: ["Congrats on the new role! Tenants tend to ask about chargers early on — happy to share what other parks did. No pitch, promise."] },
  { name: "Marcus Bell", role: "VP Operations", company: "Calloway Parcel", fit: 79, verified: true, subject: "Your 2030 fleet target", hook: "Calloway set a 2030 fleet emission target", body: ["Targets like that usually mean a lot of vans need charging every morning.", "We handle the chargers end to end, with no upfront cost.", "Shall I send a two-page example?"] },
];
export type Draft = (typeof DRAFTS)[number];

export function ReviewDrawer({ onClose, onApprove, onDone }: { onClose: () => void; onApprove: (d: Draft) => void; onDone: (approved: number) => void }) {
  const [i, setI] = useState(0);
  const [approved, setApproved] = useState(0);
  const [editing, setEditing] = useState(false);
  const [bodies, setBodies] = useState(DRAFTS.map((d) => d.body.join("\n\n")));
  const d = DRAFTS[i]!;
  const next = (ok: boolean) => {
    if (ok) onApprove(d);
    const a = approved + (ok ? 1 : 0);
    setEditing(false);
    if (i === DRAFTS.length - 1) return onDone(a);
    setApproved(a);
    setI(i + 1);
  };
  return (
    <Overlay onClose={onClose} footer={
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">{DRAFTS.map((_, k) => <span key={k} className={cn("size-2 rounded-full", k === i ? "bg-primary" : k < i ? "bg-primary/40" : "bg-border")} />)}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => next(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Skip this one</button>
          <button onClick={() => setEditing(!editing)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">{editing ? "Done editing" : "Let me edit"}</button>
          <button onClick={() => next(true)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">Looks good</button>
        </div>
      </div>
    }>
      <p className="text-xs text-muted-foreground">Message {i + 1} of 4 · nothing goes out until you say yes</p>
      <h2 className="mt-1 text-2xl font-semibold">{d.name}</h2>
      <p className="text-sm text-muted-foreground">{d.role} · {d.company}</p>
      <p className="mt-1.5 flex flex-wrap gap-x-2 text-xs">
        {d.verified ? <span className="text-foreground">Email verified</span> : <span className="text-muted-foreground">LinkedIn note · no verified email</span>}
        <span className="text-muted-foreground">· Fit {d.fit}</span>
      </p>
      <div key={i} className="mt-5 border-y py-5 text-sm leading-relaxed animate-in fade-in slide-in-from-right-4">
        <p className="mb-3 font-medium">{d.subject}</p>
        <p className="mb-3">Hi {d.name.split(" ")[0]},</p>
        <p className="mb-3">I saw that <mark className="rounded bg-highlight px-1">{d.hook}</mark> <span className="text-xs text-guess">[1]</span>.</p>
        {editing ? (
          <textarea aria-label="Message body" value={bodies[i]} onChange={(e) => setBodies(bodies.map((b, j) => (j === i ? e.target.value : b)))} rows={10} className="w-full rounded-md border bg-card p-3 outline-none focus:ring-2 focus:ring-ring" />
        ) : (
          (bodies[i] ?? "").split("\n\n").map((p, k) => <p key={k} className="mb-3">{p}</p>)
        )}
        <p className="text-xs text-muted-foreground">[1] Public source for {d.company}</p>
      </div>
    </Overlay>
  );
}
