export type ChapterId =
  | "sell" | "buyers" | "charge" | "where" | "ideal" | "companies" | "people" | "messages";

export type ChapterStatus = "todo" | "running" | "waiting" | "done" | "guess" | "confirmed" | "checked";

export interface Chapter {
  id: ChapterId;
  title: string;
  boost: number; // accuracy points this chapter adds
  upcoming: string; // pill when not started
  runningHeadline?: string;
  confidence?: number; // for inferred chapters
}

export const START_ACCURACY = 22;

export const CHAPTERS: Chapter[] = [
  { id: "sell", title: "What you sell", boost: 18, upcoming: "From you", runningHeadline: "Getting to know your product" },
  { id: "buyers", title: "Who already buys from you", boost: 10, upcoming: "I'll do this", runningHeadline: "Looking at who already buys from you", confidence: 0.82 },
  { id: "charge", title: "What you charge", boost: 8, upcoming: "I'll do this", runningHeadline: "Working out what you charge", confidence: 0.64 },
  { id: "where", title: "Where you sell", boost: 6, upcoming: "I'll do this", runningHeadline: "Mapping where you sell", confidence: 0.9 },
  { id: "ideal", title: "Your ideal customer", boost: 12, upcoming: "Just a click" },
  { id: "companies", title: "Companies worth calling", boost: 10, upcoming: "I'll do this", runningHeadline: "Looking for companies worth calling" },
  { id: "people", title: "The people to talk to", boost: 8, upcoming: "I'll do this", runningHeadline: "Finding the people to talk to" },
  { id: "messages", title: "Your first messages", boost: 6, upcoming: "You decide" },
];

/** Expected reply rate by number of chapters done (0–7). */
export const REPLIES_BY_LEVEL = [1, 2, 3, 4, 5, 8, 14, 21];

export interface ChapterState {
  status: ChapterStatus;
  summary?: string;
  time?: string;
  steps?: string[];
}
export type Chapters = Record<ChapterId, ChapterState>;

export const initialChapters = (): Chapters =>
  Object.fromEntries(CHAPTERS.map((c) => [c.id, { status: "todo" }])) as Chapters;

export const isFilled = (s: ChapterState) =>
  s.status === "done" || s.status === "guess" || s.status === "confirmed" || s.status === "checked";

/** Chapters done, 0–8. */
export function level(ch: Chapters): number {
  return CHAPTERS.filter((c) => isFilled(ch[c.id])).length;
}

/** "How well I can target": 22% at start, +boost per finished chapter, 100% when all done. */
export function accuracy(ch: Chapters): number {
  return CHAPTERS.reduce((a, c) => a + (isFilled(ch[c.id]) ? c.boost : 0), START_ACCURACY);
}

export function expectedReplies(ch: Chapters): number {
  return REPLIES_BY_LEVEL[Math.min(level(ch), 7)]!;
}

export function meterTone(acc: number): "bad" | "mid" | "good" {
  return acc < 50 ? "bad" : acc < 75 ? "mid" : "good";
}

/** Timeline order: active chapter first, then finished newest → oldest, then upcoming in order. */
export function timelineOrder(ch: Chapters) {
  const active = CHAPTERS.filter((c) => ch[c.id].status === "running" || ch[c.id].status === "waiting");
  const done = CHAPTERS.filter((c) => isFilled(ch[c.id])).reverse();
  const upcoming = CHAPTERS.filter((c) => ch[c.id].status === "todo");
  return { top: [...active, ...done], upcoming };
}

export interface Facts {
  company: string;
  custom: boolean; // true when the user described their product in their own words
  product?: string; // e.g. "install and run EV chargers for businesses"
  pricing?: string;
  region?: string;
}

const EV_PRODUCT = "install and run EV chargers for businesses";

export function factsFromInput(input: string, kind: "site" | "file" | "text"): Facts {
  if (kind === "text") {
    const product = input.trim().replace(/^we\s+/i, "").replace(/[.!]+$/, "");
    return { company: "your company", custom: true, product };
  }
  const company = kind === "site" ? companyFromInput(input) ?? "your company" : input.replace(/\.\w+$/, "");
  return { company, custom: false, product: EV_PRODUCT };
}

export interface DraftPart { text: string; generic?: boolean }

/** The live email draft. Every level adds one specific detail. */
export function buildDraft(lvl: number, f: Facts) {
  const L = Math.min(lvl, 7);
  const custom = f.custom;
  const product = f.product ?? EV_PRODUCT;
  let subject = "Quick question";
  if (L >= 1) subject = custom ? `${capitalize(shorten(product))} for your business` : "EV charging for your business";
  if (L >= 5) subject = custom ? "A thought for your team" : "Charging for your fleet";
  if (L >= 6) subject = custom ? "Saw your news, and a quick idea" : "620 electric vans by 2028, and where they charge overnight";

  const greeting = L >= 6 ? "Hi Lena," : L >= 5 ? "Hi [Head of Fleet]," : "Hi there,";
  const body: DraftPart[] = [];
  if (L >= 6) body.push({ text: custom ? "I saw that Tamsin Courier Group just announced a big expansion for 2028." : "I saw that Tamsin Courier Group plans to electrify its whole van fleet by 2028." });
  if (L >= 5) body.push({ text: custom ? "Growth is usually the easy part. Keeping it running smoothly is where costs get messy." : "The vans are usually the easy part. Charging at the depot and at drivers' homes is where costs get messy." });
  if (L === 0) body.push({ text: "I'm reaching out because we help companies like yours grow.", generic: true });
  if (L >= 1) {
    let s = `We ${product}`;
    if (L >= 3) s += f.pricing ? `, ${f.pricing}` : custom ? ", with simple monthly pricing" : ", with no upfront cost and one monthly fee per charge point";
    if (L >= 4) s += `, in ${f.region ?? "Europe and North America"}`;
    body.push({ text: s + "." });
  }
  if (L >= 2) body.push({ text: custom ? "A customer much like you went live with us in 11 weeks." : "A logistics customer with 40 vans went live with us in 11 weeks." });
  if (L >= 7) body.push({ text: "Daniel Okafor, who worked at Tamsin until 2022, runs operations there and is happy to compare notes." });
  const closing = L >= 5 ? "Would 20 minutes next week be useful?" : "Would you be open to a quick call?";
  return { subject, greeting, body, closing };
}

function shorten(s: string) {
  const w = s.split(" ");
  return w.length > 5 ? w.slice(0, 5).join(" ") + "…" : s;
}
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function companyFromInput(input: string): string | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+)\.[a-z.]{2,}/i);
  if (!m) return null;
  return capitalize(m[1]!.replace(/-/g, " "));
}

/** Credits: 1,240 to start, 20 for finding people, 2 per approved message. */
export const CREDITS = { start: 1240, people: 20, approval: 2 };
