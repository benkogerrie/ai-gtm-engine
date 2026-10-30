import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";
import { PRODUCT_MODULES } from "@/lib/modules";

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
      PRODUCT_MODULES.length - 2,
    );
    expect(screen.getByRole("link", { name: "Discovery" })).toHaveAttribute(
      "href",
      "/prospects",
    );
    expect(screen.getByRole("link", { name: "Intake & ICP" })).toHaveAttribute(
      "href",
      "/intake",
    );
  });
});
