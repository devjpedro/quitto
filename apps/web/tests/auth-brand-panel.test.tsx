import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthBrandPanel } from "../src/components/auth-brand-panel";

describe("AuthBrandPanel", () => {
  it("shows the Quitto wordmark", () => {
    render(<AuthBrandPanel mode="signin" />);
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });

  it("keeps the brand mark non-interactive (no link)", () => {
    render(<AuthBrandPanel mode="signin" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
