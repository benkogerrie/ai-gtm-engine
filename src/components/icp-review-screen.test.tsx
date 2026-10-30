import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { hydrateStructuredIcp } from "@/lib/icp/infer";
import { buildMockIcpOutput } from "@/lib/icp/mock-output";
import { IcpReviewScreen } from "./icp-review-screen";

const structured = hydrateStructuredIcp(
  buildMockIcpOutput({
    name: "Harborline Ops Cloud",
    description: "Freight ops",
  }),
);

describe("IcpReviewScreen", () => {
  it("shows confidence badges, expansions, and an Approve button", () => {
    render(
      <IcpReviewScreen
        icp={{
          id: "11111111-1111-4111-8111-111111111111",
          name: structured.name,
          status: "DRAFT",
          version: 1,
          inferenceMode: "mock",
          structured,
        }}
        productName="Harborline Ops Cloud"
        onApprove={async () => ({})}
      />,
    );

    expect(screen.getByTestId("mock-banner")).toHaveTextContent(/MOCK output/i);
    expect(screen.getByRole("button", { name: /approve icp/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /find prospects/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Find prospects when the ICP is approved", () => {
    render(
      <IcpReviewScreen
        icp={{
          id: "11111111-1111-4111-8111-111111111111",
          name: structured.name,
          status: "APPROVED",
          version: 1,
          inferenceMode: "live",
          structured,
        }}
        productName="ShiftPilot"
        onFindProspects={async () => ({})}
      />,
    );

    expect(
      screen.getByRole("button", { name: /find prospects/i }),
    ).toBeInTheDocument();
  });
});
