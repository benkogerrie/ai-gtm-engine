import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OutreachDetail, type OutreachDetailView } from "./outreach-detail";

const draftView: OutreachDetailView = {
  id: "11111111-1111-4111-8111-111111111111",
  orgId: "11111111-1111-4111-8111-111111111111",
  companyId: "11111111-1111-4111-8111-111111111112",
  companyName: "TEST — Example General Hospital",
  companyDomain: "example.com",
  channel: "EMAIL",
  subject: "TEST subject",
  body: "TEST body",
  linkedinMessage: "TEST linkedin",
  status: "DRAFT",
  dryRun: true,
  sentAt: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  tone: "professional",
  cta: "book a call",
  sourceUrls: ["https://example.com"],
  citedSignals: [
    {
      id: "sig",
      kind: "signal",
      type: "JOB_POSTING",
      summary: "TEST — Example General Hospital posted a nurse staffing role",
      sourceUrls: ["https://example.com"],
    },
  ],
  inferenceMode: "mock",
  version: 1,
  parentOutreachId: null,
  demo: true,
  labeledTest: true,
};

describe("OutreachDetail", () => {
  it("shows TEST/MOCK labels, cited source URL, and disables dry-run until approved", () => {
    render(
      <OutreachDetail
        view={draftView}
        onApprove={async () => ({})}
        onDryRun={async () => ({})}
      />,
    );

    expect(screen.getByTestId("mock-banner")).toHaveTextContent(/TEST \/ MOCK/i);
    expect(
      screen.getAllByRole("link", { name: "https://example.com" })[0],
    ).toHaveAttribute("href", "https://example.com");
    expect(screen.getByTestId("dry-run-button")).toBeDisabled();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeInTheDocument();
  });
});
