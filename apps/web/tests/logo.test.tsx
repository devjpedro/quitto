import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo, LogoMark } from "../src/components/logo";

describe("Logo", () => {
  it("exposes a single labelled image named Quitto", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });

  it("hides the inner wordmark text from assistive tech", () => {
    render(<Logo />);
    expect(screen.getByText("quitt")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the teal arc for the brand variant", () => {
    const { container } = render(<Logo variant="brand" />);
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("stroke", "#0f766e");
  });

  it("uses the white arc for the inverted variant", () => {
    const { container } = render(<Logo variant="inverted" />);
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("stroke", "#ffffff");
  });
});

describe("LogoMark", () => {
  it("renders the ring hidden from assistive tech (decorative)", () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("circle")).toHaveLength(2);
  });
});
