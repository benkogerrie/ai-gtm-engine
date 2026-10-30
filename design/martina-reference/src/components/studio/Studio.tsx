import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, Check, ChevronLeft, ChevronRight, FileUp, Loader2,
  Pencil, X,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  CHAPTERS, CREDITS, accuracy, buildDraft, expectedReplies, factsFromInput, isFilled, level,
  timelineOrder, initialChapters,
  type ChapterId, type ChapterState, type Chapters, type Facts,
} from "@/lib/journey";
import { cn } from "@/lib/utils";
import { Pipeline, START_DEALS, type Deal } from "./Pipeline";
import { ReviewDrawer, type Draft } from "./ReviewDrawer";
import { ChapterSheet } from "./ChapterSheet";

type Card = "start" | "ideal" | "ready" | null;
interface Msg { id: number; from: "bot" | "user"; text: string; card?: Card; bold?: boolean }

const now = () => new Date().toTimeString().slice(0, 5);
let mid = 0;

const QUIPS = [
  "Noted. Your future customers thank you in advance.",
  "Love it. That beats “synergy” by a mile.",
  "Got it. One more reason this won't read like a template.",
];

export function Studio() {
  const [tab, setTab] = useState<"journey" | "pipeline">("journey");
  const [chapters, setChapters] = useState<Chapters>(initialChapters);
  const [facts, setFacts] = useState<Facts>({ company: "your company", custom: false });
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: mid++, from: "bot", text: greeting() + " I'm Get-the-Market.ai. Point me at what you sell — I'll find your first customers and write the emails." },
    { id: mid++, from: "bot", text: "First question: what do you sell?", card: "start", bold: true },
  ]);
  const [typing, setTyping] = useState(false);
  const [review, setReview] = useState(false);
  const [sheet, setSheet] = useState<ChapterId | null>(null);
  const [credits, setCredits] = useState(CREDITS.start);
  const [deals, setDeals] = useState<Deal[]>(START_DEALS);
  const [open, setOpen] = useState({ chat: true, chapters: true, preview: true });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
  const say = (text: string, card: Card = null) => setMsgs((m) => [...m, { id: mid++, from: "bot", text, card }]);
  const clearCard = (c: Card) => setMsgs((m) => m.map((x) => (x.card === c ? { ...x, card: null } : x)));
  const setCh = (id: ChapterId, s: ChapterState) => setChapters((c) => ({ ...c, [id]: { time: now(), ...s } }));
  const addStep = (id: ChapterId, step: string) => setChapters((c) => ({ ...c, [id]: { ...c[id], steps: [...(c[id].steps ?? []), step] } }));
  const started = chapters.sell.status !== "todo";

  function start(input: string, kind: "site" | "file" | "text") {
    clearCard("start");
    setMsgs((m) => [...m, { id: mid++, from: "user", text: kind === "file" ? `Sent: ${input}` : input }]);
    const f = factsFromInput(input, kind);
    const product = f.product!;
    setCh("sell", { status: "running" });
    setTyping(true);
    const T = 700;
    later(T, () => {
      setFacts(f);
      setCh("sell", { status: "done", summary: product });
      setCh("buyers", { status: "running" });
      say(kind === "text"
        ? `Thanks, that helps a lot. You ${product}. I'll take it from here and only come back to you when I'm unsure.`
        : `I've read your ${kind === "site" ? "website" : "deck"}. You ${product}, and they pay you monthly. I'll take it from here and only come back to you when I'm unsure.`);
    });
    later(T * 2, () => {
      setCh("buyers", { status: "guess", summary: f.custom ? "A handful of growing mid-size companies" : "A 40-van logistics company and a regional bus operator" });
      setCh("charge", { status: "running" });
    });
    later(T * 3, () => {
      setCh("charge", { status: "guess", summary: f.custom ? "A monthly subscription · best guess from similar companies" : "A monthly fee per charge point · about €40–120k over 3 years" });
      setCh("where", { status: "running" });
      say("Your site doesn't show pricing, so I made my best guess from similar companies [0.64]. Just tell me if I'm off — something like “€300 per month” works.");
    });
    later(T * 4, () => {
      setCh("where", { status: "guess", summary: "Worldwide · most interest in Europe and North America" });
      setCh("ideal", { status: "waiting", summary: f.custom ? "Growing companies that look like your best customers" : "Fleet operators with 20+ vehicles and commercial property managers" });
      setTyping(false);
      say("I think these are the people who'd buy from you", "ideal");
    });
  }

  function confirmIdeal() {
    clearCard("ideal");
    setMsgs((m) => [...m, { id: mid++, from: "user", text: "Yes, that's them" }]);
    setCh("ideal", { status: "confirmed", summary: chapters.ideal.summary ?? "" });
    setCh("companies", { status: "running", steps: [] });
    setTyping(true);
    const S = 1800;
    later(500, () => addStep("companies", "Reading news about fleet electrification"));
    later(1100, () => addStep("companies", "Going through 14 job postings"));
    later(S, () => {
      setCh("companies", { status: "done", summary: "8 companies and 4 competitors, each backed by a source" });
      setCh("people", { status: "running", steps: [] });
      say("I found 8 companies that look like a great fit, and I can show you where I read about each one. I left out one that already works with another charging provider.");
    });
    later(S + 700, () => addStep("people", "Checking who signs off on this"));
    later(S + 1300, () => addStep("people", "Making sure every source link works"));
    later(S * 2, () => {
      setCh("people", { status: "done", summary: "11 people, 8 with verified emails · 1 warm introduction" });
      setCh("messages", { status: "waiting", summary: "4 messages written for you to check" });
      setCredits((c) => c - CREDITS.people);
      setTyping(false);
      say("I found 11 people to talk to and confirmed the email address for 8 of them. Good news: someone at one of your customers used to work at Tamsin, so you have a warm introduction there.");
      say("I've written your first 4 messages", "ready");
    });
  }

  function onType(text: string) {
    if (!started) return start(text, /^\S+\.[a-z]{2,}\S*$/i.test(text) ? "site" : "text");
    setMsgs((m) => [...m, { id: mid++, from: "user", text }]);
    const price = /[€$£]\s?[\d.,]+k?|\d+\s?(€|eur|usd|dollars?|euros?)/i.test(text);
    const region = /europe|america|asia|africa|uk\b|germany|france|spain|italy|worldwide|\bus\b|usa|nordics/i.test(text);
    later(600, () => {
      if (price) {
        setFacts((f) => ({ ...f, pricing: `from ${text.trim().replace(/[.!]+$/, "")}` }));
        setCh("charge", { status: "done", summary: text.trim() });
        say("Thanks! I swapped my guess for your real price. Look right — the email already knows.");
      } else if (region) {
        setFacts((f) => ({ ...f, region: text.trim().replace(/[.!]+$/, "") }));
        setCh("where", { status: "done", summary: text.trim() });
        say("Updated where you sell. No more pitching to countries you don't ship to.");
      } else {
        say(QUIPS[Math.floor(Math.random() * QUIPS.length)]!);
      }
    });
  }

  function editChapter(id: ChapterId, value: string) {
    setCh(id, { status: "done", summary: value });
    if (id === "sell") setFacts((f) => ({ ...f, product: value.replace(/^we\s+/i, ""), custom: true }));
    if (id === "charge") setFacts((f) => ({ ...f, pricing: value }));
    if (id === "where") setFacts((f) => ({ ...f, region: value }));
  }

  function approve(d: Draft) {
    setCredits((c) => c - CREDITS.approval);
    setDeals((all) => [{ co: d.company, who: d.name, stage: 1, byMe: false, note: "Approved by you", fresh: true }, ...all.filter((x) => x.co !== d.company)]);
    toast.success(`${d.company} moved to Contacted`, { description: `Practice mode, nothing sent · −${CREDITS.approval} credits` });
  }

  function finishReview(approved: number) {
    setReview(false);
    setCh("messages", { status: "checked", summary: `${approved} of 4 messages lined up` });
    say(`Nice work. ${approved} message${approved === 1 ? " is" : "s are"} lined up (practice mode, so nothing has actually been sent). You can follow every reply in Your pipeline.`);
  }

  const acc = accuracy(chapters);
  const lvl = level(chapters);
  const finished = chapters.messages.status === "checked";
  const waiting = CHAPTERS.find((c) => chapters[c.id].status === "waiting");
  const running = CHAPTERS.find((c) => chapters[c.id].status === "running");
  const closeSheet = useCallback(() => setSheet(null), []);
  const closeReview = useCallback(() => setReview(false), []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Toaster position="bottom-center" />
      <TopBar tab={tab} setTab={setTab} credits={credits} />
      {tab === "pipeline" ? (
        <Pipeline deals={deals} setDeals={setDeals} />
      ) : (
        <div className="scroll-thin flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <JourneyHeader acc={acc} lvl={lvl} finished={finished} waiting={waiting?.id} runningHeadline={running?.runningHeadline} />
          <main className="flex flex-1 flex-col gap-4 px-4 pb-5 sm:px-5 lg:min-h-0 lg:flex-row">
            <Panel primary title="Chat with me" open={open.chat} onToggle={() => setOpen((o) => ({ ...o, chat: !o.chat }))} className="lg:max-w-[520px] lg:basis-[42%]">
              <ChatPanel msgs={msgs} typing={typing} facts={facts} onStart={start} onType={onType} onConfirm={confirmIdeal}
                onWhy={() => setSheet("ideal")} onRead={() => setReview(true)} />
            </Panel>
            <Panel title="Progress" open={open.chapters} onToggle={() => setOpen((o) => ({ ...o, chapters: !o.chapters }))} className="lg:max-w-[300px] lg:basis-[22%]">
              <Milestones chapters={chapters} onEdit={editChapter} onOpen={setSheet} />
            </Panel>
            <Panel title="Your email, so far" open={open.preview} onToggle={() => setOpen((o) => ({ ...o, preview: !o.preview }))} className="lg:basis-[36%]">
              <Preview facts={facts} chapters={chapters} />
            </Panel>
          </main>
        </div>
      )}
      {review && <ReviewDrawer onClose={closeReview} onApprove={approve} onDone={finishReview} />}
      {sheet && <ChapterSheet id={sheet} state={chapters[sheet]} onClose={closeSheet} />}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning!" : h < 18 ? "Good afternoon!" : "Good evening!";
}

const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TopBar({ tab, setTab, credits }: { tab: string; setTab: (t: "journey" | "pipeline") => void; credits: number }) {
  return (
    <header className="shrink-0 px-4 pt-4 pb-3 sm:px-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-lg font-medium">Get-the-Market<span className="text-primary">.ai</span></span>
        </div>
        <div className="flex items-center gap-3 sm:order-last">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex" title="Credits left">
            <svg viewBox="0 0 20 20" className="size-5 -rotate-90"><circle cx="10" cy="10" r="8" className="fill-none stroke-muted" strokeWidth="3" /><circle cx="10" cy="10" r="8" className="fill-none stroke-primary transition-all" strokeWidth="3" strokeDasharray={`${(credits / CREDITS.start) * 50.3} 50.3`} /></svg>
            <b key={credits} className="tabular-nums text-foreground animate-in fade-in">{credits.toLocaleString("en")}</b> credits left
          </span>
        </div>
        <nav className="col-span-2 flex justify-self-start gap-5 text-sm sm:col-span-1">
          {(["journey", "pipeline"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("border-b py-1 transition", focus, tab === t ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              Your {t}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function JourneyHeader({ acc, lvl, finished, waiting, runningHeadline }: { acc: number; lvl: number; finished: boolean; waiting?: ChapterId | undefined; runningHeadline?: string | undefined }) {
  const headline = finished ? "Your messages are lined up"
    : waiting === "ideal" ? "Is this who you sell to?"
    : waiting === "messages" ? "Your first messages are ready"
    : runningHeadline ?? "Let's find your first customers";
  const eyebrow = finished ? "You're on your way" : lvl === 0 && !runningHeadline ? "Ready when you are" : `Chapter ${Math.min(lvl + 1, 8)} of 8`;
  const sub = finished ? "Follow every reply in Your pipeline" : waiting === "ideal" ? "Say yes and I start looking for companies" : waiting === "messages" ? "4 to read · nothing goes out until you say so" : lvl === 0 && !runningHeadline ? "8 chapters · I'll write most of them myself" : "Sit back — I'll only interrupt when I need a yes";
  const progress = finished ? 100 : (lvl / 8) * 100;
  return (
    <div className="mx-4 mb-4 shrink-0 px-1 sm:mx-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{eyebrow} · {sub}</p>
          <h1 key={headline} className="truncate font-display text-xl font-medium tracking-tight animate-in fade-in sm:text-2xl">{headline}</h1>
        </div>
        <p className="hidden text-right text-sm text-muted-foreground sm:block">
          I'm <b className="tabular-nums text-foreground">{acc}% sure</b> who to target
        </p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all duration-700 motion-reduce:transition-none" style={{ width: `${Math.max(progress, 1)}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, open, onToggle, className, children, primary }: { title: string; open: boolean; onToggle: () => void; className?: string; children: ReactNode; primary?: boolean }) {
  if (!open) {
    return (
      <button onClick={onToggle} className={cn("flex shrink-0 items-center gap-3 border-l px-4 py-3 text-muted-foreground transition hover:text-foreground lg:w-10 lg:flex-col lg:px-0 lg:py-4", focus)} aria-label={`Open ${title}`}>
        <span className="text-xs font-medium lg:[writing-mode:vertical-rl]">{title}</span>
        <ChevronRight className="ml-auto size-4 lg:mt-1 lg:ml-0" />
      </button>
    );
  }
  return (
    <section className={cn("flex h-[75vh] min-w-0 flex-col overflow-hidden lg:h-auto lg:flex-1",
      primary ? "rounded-lg border bg-card" : "", className)}>
      <div className={cn("flex shrink-0 items-center justify-between py-3", primary ? "border-b px-5" : "px-2")}>
        <span className={cn("text-sm", primary ? "font-semibold" : "text-muted-foreground")}>{title}</span>
        <button onClick={onToggle} className={cn("rounded-lg p-1 text-muted-foreground hover:bg-muted", focus)} aria-label={`Collapse ${title}`}><ChevronLeft className="size-4" /></button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function ChatPanel(p: { msgs: Msg[]; typing: boolean; facts: Facts; onStart: (v: string, k: "site" | "file" | "text") => void; onType: (t: string) => void; onConfirm: () => void; onWhy: () => void; onRead: () => void }) {
  const [text, setText] = useState("");
  const [site, setSite] = useState("chargeflow.example");
  const [over, setOver] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [p.msgs, p.typing]);
  const idealText = p.facts.custom
    ? `Companies that look like the ones already buying from you — growing teams who'd get the most out of what you do (${p.facts.product}). You'd usually talk to the person who owns that budget.`
    : "Companies running 20+ vehicles, like couriers, freight and field service firms, plus commercial property managers. You'd usually talk to their Head of Fleet or Facility Manager.";
  return (
    <div className="flex h-full flex-col">
      <div ref={box} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5" aria-live="polite">
        {p.msgs.map((m) => (
          <div key={m.id} className={cn("animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none", m.from === "user" && "flex justify-end")}>
            {m.card === "ideal" || m.card === "ready" ? (
              <div className="rounded-lg border bg-turn-soft/40 p-4">
                <p className="font-semibold">{m.text}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {m.card === "ideal" ? idealText : "Each one starts with something that just happened at that company. Nothing goes out until you've read it and said yes."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.card === "ideal" ? (<>
                    <button onClick={p.onConfirm} className={cn("rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90", focus)}>Yes, that's them</button>
                    <button onClick={p.onWhy} className={cn("rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground", focus)}>Show me why</button>
                  </>) : (
                    <button onClick={p.onRead} className={cn("inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90", focus)}>Read them <ArrowRight className="size-4" /></button>
                  )}
                </div>
              </div>
            ) : (
              <div className={cn("max-w-[88%] rounded-lg px-4 py-2.5 text-sm leading-relaxed", m.bold && "font-semibold", m.from === "bot" ? "rounded-tl-sm bg-muted" : "rounded-tr-sm bg-foreground text-background")}>{m.text}</div>
            )}
            {m.card === "start" && (
              <div className="mt-3 space-y-2">
                <form onSubmit={(e) => { e.preventDefault(); if (site.trim()) p.onStart(site.trim(), "site"); }} className="flex gap-2">
                  <input aria-label="Your website" value={site} onChange={(e) => setSite(e.target.value)} className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="yourcompany.com" />
                  <button className={cn("shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90", focus)}>Read my site</button>
                </form>
                <p className="text-center text-xs text-muted-foreground">or</p>
                <button
                  onClick={() => file.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) p.onStart(f.name, "file"); }}
                  className={cn("flex w-full items-center justify-center gap-2 rounded-md border border-dashed py-4 text-sm text-muted-foreground transition hover:border-foreground/40 hover:text-foreground", over && "border-foreground/40 bg-accent text-foreground", focus)}>
                  <FileUp className="size-4" /> {over ? "Let go, I've got it" : "Drop a PDF or PowerPoint"}
                </button>
                <input ref={file} type="file" accept=".pdf,.ppt,.pptx" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onStart(f.name, "file"); }} />
                <p className="text-center text-xs text-muted-foreground">or just type your answer below</p>
              </div>
            )}
          </div>
        ))}
        {p.typing && (
          <div className="inline-flex gap-1 rounded-lg bg-muted px-4 py-3" aria-label="Thinking">
            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none" style={{ animationDelay: `${i * 120}ms` }} />)}
          </div>
        )}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { p.onType(text.trim()); setText(""); } }} className="flex shrink-0 gap-2 border-t p-3">
        <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: we install EV chargers for fleets" className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button className={cn("shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90", focus)}>Send</button>
      </form>
    </div>
  );
}

const sureWords = (c?: number) => (!c ? "" : c >= 0.85 ? "pretty sure" : c >= 0.75 ? "fairly sure" : "a hunch");

/** Only "Your turn" gets a pill; everything else is a quiet word. */
function Status({ s, upcoming, id }: { s: ChapterState; upcoming: string; id: ChapterId }) {
  if (s.status === "waiting") return <span className="shrink-0 rounded-full bg-turn-soft px-2 py-0.5 text-[11px] font-semibold text-turn">Your turn</span>;
  const conf = CHAPTERS.find((c) => c.id === id)?.confidence;
  const text: Record<string, ReactNode> = {
    todo: upcoming,
    running: <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="size-3 animate-spin" />On it</span>,
    guess: <span className="text-guess">My guess, {sureWords(conf)}</span>,
    done: "",
    confirmed: "",
    checked: "",
  };
  const t = text[s.status];
  return t ? <span className="shrink-0 text-[11px] text-muted-foreground">{t}</span> : null;
}

function Milestones({ chapters, onEdit, onOpen }: { chapters: Chapters; onEdit: (id: ChapterId, v: string) => void; onOpen: (id: ChapterId) => void }) {
  const [editing, setEditing] = useState<ChapterId | null>(null);
  const [val, setVal] = useState("");
  const editable: ChapterId[] = ["sell", "charge", "where"];
  const { top, upcoming } = timelineOrder(chapters);

  const row = (c: (typeof CHAPTERS)[number], last: boolean) => {
    const s = chapters[c.id];
    const filled = isFilled(s);
    return (
      <li key={c.id} className="group relative flex gap-3 py-2.5 animate-in fade-in motion-reduce:animate-none">
        {!last && <span className={cn("absolute top-6 left-[0.4rem] h-full w-px", filled ? "bg-primary/40" : "bg-border")} />}
        <span className={cn("relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 transition",
          filled ? "border-primary bg-primary"
            : s.status === "running" ? "animate-pulse border-primary bg-background motion-reduce:animate-none"
            : s.status === "waiting" ? "border-turn bg-turn" : "border-border bg-background")} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {filled ? (
              <button onClick={() => onOpen(c.id)} className={cn("text-left text-sm font-medium hover:underline", focus)}>{c.title}</button>
            ) : (
              <p className={cn("text-sm", s.status === "todo" ? "text-muted-foreground" : "font-medium")}>{c.title}</p>
            )}
            <Status s={s} upcoming={c.upcoming} id={c.id} />
          </div>
          {editing === c.id ? (
            <form onSubmit={(e) => { e.preventDefault(); if (val.trim()) onEdit(c.id, val.trim()); setEditing(null); }} className="mt-1.5 flex gap-1">
              <input aria-label={`Fix ${c.title}`} autoFocus value={val} onChange={(e) => setVal(e.target.value)} className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring" />
              <button className="rounded-md bg-primary px-2 text-primary-foreground" aria-label="Save"><Check className="size-3.5" /></button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md bg-muted px-2" aria-label="Cancel"><X className="size-3.5" /></button>
            </form>
          ) : s.summary && s.status !== "todo" ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {s.summary}
              {filled && editable.includes(c.id) && (
                <button onClick={() => { setEditing(c.id); setVal(s.summary ?? ""); }} className={cn("ml-1.5 inline-flex items-center gap-0.5 text-primary transition lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100", focus)}>
                  <Pencil className="size-3" /> fix
                </button>
              )}
            </p>
          ) : null}
          {s.status === "running" && s.steps && s.steps.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {s.steps.map((st) => <li key={st} className="text-[11px] text-muted-foreground animate-in fade-in">✓ {st}</li>)}
            </ul>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto px-2 py-2">
      <ol>{top.map((c, i) => row(c, i === top.length - 1 && upcoming.length === 0))}</ol>
      {upcoming.length > 0 && (<>
        {top.length > 0 && <p className="mt-3 mb-1 text-[11px] text-muted-foreground">Coming up</p>}
        <ol>{upcoming.map((c, i) => row(c, i === upcoming.length - 1))}</ol>
      </>)}
    </div>
  );
}

function replySentence(rate: number) {
  const inN = Math.max(1, Math.round(100 / rate));
  return inN <= 1 ? "Almost everyone would reply" : `About 1 in ${inN} people would reply`;
}

function Preview({ facts, chapters }: { facts: Facts; chapters: Chapters }) {
  const lvl = level(chapters);
  const d = buildDraft(lvl, facts);
  const rate = expectedReplies(chapters);
  const next = CHAPTERS.find((c) => !isFilled(chapters[c.id]));
  const mood = rate < 3 ? "Right now this is the email everyone deletes before their coffee."
    : rate < 6 ? "Less “dear sir/madam”, more substance. Getting there."
    : rate < 15 ? "This no longer smells like a mail merge."
    : "Lena gets 140 cold emails a week. Yours is the one she'll open.";
  const L = Math.min(lvl, 7);
  return (
    <div className="scroll-thin flex h-full flex-col gap-4 overflow-y-auto px-2 pb-4">
      <p key={rate} className="text-sm animate-in fade-in">
        <b className="text-foreground">{replySentence(rate)}</b>
        <span className="text-muted-foreground"> to this today.</span>
      </p>
      <article className="border-y py-6">
        <p className="mb-4 text-xs text-muted-foreground">
          From <span className="text-foreground">{facts.company}</span> → {L >= 6 ? "Lena Hartmann" : L >= 5 ? "a Head of Fleet" : "someone, somewhere"}
        </p>
        <p key={d.subject} className="flash mb-4 font-semibold">{d.subject}</p>
        <div className="space-y-3 text-[15px] leading-relaxed">
          <p key={d.greeting} className="flash">{d.greeting}</p>
          {d.body.map((b) => <p key={b.text} className={cn("flash", b.generic && "italic text-muted-foreground")}>{b.text}</p>)}
          <p key={d.closing} className="flash">{d.closing}</p>
        </div>
      </article>
      <p className="text-sm text-muted-foreground">
        {mood}
        {next && next.id !== "messages" && <> Next up: <span className="text-foreground">{next.title.toLowerCase()}</span>.</>}
      </p>
    </div>
  );
}
