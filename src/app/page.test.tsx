import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";
import { PRODUCT_MODULES } from "@/lib/modules";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Home page", () => {
  it("renders the product title, description, and coming-soon modules", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "AI GTM Engine" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/unify intake, discovery, graph reasoning/i),
    ).toBeInTheDocument();

    for (const productModule of PRODUCT_MODULES) {
      expect(
        screen.getByRole("heading", { name: productModule.name }),
      ).toBeInTheDocument();
    }

    expect(screen.getAllByText("Coming soon")).toHaveLength(
      PRODUCT_MODULES.length - 4,
    );
    expect(screen.getByRole("link", { name: "Discovery" })).toHaveAttribute(
      "href",
      "/prospects",
    );
    expect(screen.getByRole("link", { name: "Intake & ICP" })).toHaveAttribute(
      "href",
      "/intake",
    );
    expect(
      screen.getByRole("link", { name: "Pipeline Dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(
      screen.getByRole("link", { name: "Enrichment & Outreach" }),
    ).toHaveAttribute("href", "/outreach");
  });
});
