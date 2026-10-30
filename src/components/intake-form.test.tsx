import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_INTAKE_FORM } from "@/lib/site-intake/schema";
import { IntakeForm } from "./intake-form";

vi.mock("@/app/actions/intake", () => ({
  submitIntakeAction: async () => ({}),
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

function websiteInput() {
  return screen.getByRole("textbox", { name: "Website URL" });
}

describe("IntakeForm site read", () => {
  it("prefills supported fields and highlights empty ones until the user types", async () => {
    let resolveRead: ((value: Response) => void) | undefined;
    globalThis.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRead = resolve;
        }),
    );

    render(<IntakeForm mockMode />);

    fireEvent.change(websiteInput(), {
      target: { value: "shiftpilot.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Read my site" }));

    expect(
      await screen.findByRole("button", { name: /reading your site/i }),
    ).toBeDisabled();
    resolveRead?.(
      Response.json({
        mode: "mock",
        websiteUrl: "https://shiftpilot.example/",
        pages: ["https://shiftpilot.example/", "https://shiftpilot.example/about"],
        suggested: {
          ...EMPTY_INTAKE_FORM,
          name: "ShiftPilot",
          description: "AI shift scheduling for hospitals",
          freeText: "Website: https://shiftpilot.example/",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /product name/i })).toHaveValue(
        "ShiftPilot",
      );
    });

    expect(screen.getByRole("textbox", { name: /short description/i })).toHaveValue(
      "AI shift scheduling for hospitals",
    );
    expect(
      screen.getAllByText(/INFERRED · suggested from shiftpilot.example/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "https://shiftpilot.example/" })).toHaveAttribute(
      "href",
      "https://shiftpilot.example/",
    );

    const needsHints = screen.getAllByText(/Nog invullen · Needs input/);
    expect(needsHints.length).toBeGreaterThan(0);

    const features = screen.getByRole("textbox", { name: /^features/i });
    expect(features).toHaveClass("bg-needs-input-soft");
    fireEvent.change(features, { target: { value: "shift scheduling" } });
    expect(features).not.toHaveClass("bg-needs-input-soft");
    expect(features).toHaveValue("shift scheduling");
  });

  it("shows a clear error and leaves the form usable when the reader fails", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ error: "That host is not a public website." }, { status: 400 }),
    );

    render(<IntakeForm mockMode={false} />);
    fireEvent.change(websiteInput(), {
      target: { value: "localhost" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Read my site" }));

    expect(
      await screen.findByText("That host is not a public website."),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /product name/i })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Submit product and infer ICP" }),
    ).toBeEnabled();
  });
});
