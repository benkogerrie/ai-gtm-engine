import { describe, expect, it } from "vitest";
import {
  CHAPTERS, CREDITS, accuracy, buildDraft, companyFromInput, expectedReplies, factsFromInput,
  initialChapters, meterTone, timelineOrder, type Chapters,
} from "./journey";

const doneUpTo = (n: number): Chapters => {
  const ch = initialChapters();
  CHAPTERS.slice(0, n).forEach((c) => (ch[c.id] = { status: "done" }));
  return ch;
};

describe("journey rules", () => {
  it("accuracy follows 22 → 40 → 50 → 58 → 64 → 76 → 86 → 94 → 100", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => accuracy(doneUpTo(n)))).toEqual([22, 40, 50, 58, 64, 76, 86, 94, 100]);
  });
  it("expected replies follow 1 → 2 → 3 → 4 → 5 → 8 → 14 → 21", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => expectedReplies(doneUpTo(n)))).toEqual([1, 2, 3, 4, 5, 8, 14, 21]);
  });
  it("meter is red under 50, orange under 75, green above", () => {
    expect(meterTone(49)).toBe("bad");
    expect(meterTone(64)).toBe("mid");
    expect(meterTone(76)).toBe("good");
  });
  it("timeline shows the newest finished chapter on top", () => {
    const ch = doneUpTo(3);
    ch.where = { status: "running" };
    const { top, upcoming } = timelineOrder(ch);
    expect(top.map((c) => c.id)).toEqual(["where", "charge", "buyers", "sell"]);
    expect(upcoming[0]?.id).toBe("ideal");
  });
  it("draft starts generic and uses the user's own words", () => {
    expect(buildDraft(0, factsFromInput("x", "text")).subject).toBe("Quick question");
    const d = buildDraft(1, factsFromInput("we sell solar panels to farms", "text"));
    expect(d.body.map((b) => b.text).join(" ")).toContain("sell solar panels to farms");
    expect(d.body.join(" ")).not.toContain("EV");
  });
  it("level 6 greets Lena", () => {
    expect(buildDraft(6, factsFromInput("chargeflow.example", "site")).greeting).toBe("Hi Lena,");
  });
  it("credits start at 1,240; people cost 20; approvals 2", () => {
    expect(CREDITS).toEqual({ start: 1240, people: 20, approval: 2 });
  });
  it("reads company name from a website", () => {
    expect(companyFromInput("chargeflow.example")).toBe("Chargeflow");
    expect(companyFromInput("we install chargers")).toBeNull();
  });
});
