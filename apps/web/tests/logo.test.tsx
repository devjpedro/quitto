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

  it("brand is Floresta from the tokens (dark-aware), track at 22%, never the teal --primary", () => {
    const { container } = render(<Logo variant="brand" />);
    const [track, arc] = container.querySelectorAll("circle");
    expect(arc).toHaveAttribute("stroke", "var(--brand)");
    expect(track).toHaveAttribute(
      "stroke",
      "color-mix(in oklab, var(--brand) 22%, transparent)"
    );
    expect(screen.getByRole("img", { name: "Quitto" })).toHaveClass(
      "text-brand"
    );
    expect(container.innerHTML).not.toContain("--primary");
  });

  it("keeps the logo's ring: viewBox 24, radius 9, stroke 4, ~70% of the arc turned 125°, round cap", () => {
    const { container } = render(<LogoMark />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 24 24"
    );
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute("r", "9");
    expect(arc).toHaveAttribute("stroke-width", "4");
    expect(arc).toHaveAttribute("stroke-dasharray", "40 57");
    expect(arc).toHaveAttribute("transform", "rotate(125 12 12)");
    expect(arc).toHaveAttribute("stroke-linecap", "round");
  });

  it("the ring is 0.72 of the font size (the word's 'o')", () => {
    // At 100 px the ring reads the ratio directly: 0.71 or 0.73 would miss 72.
    const { container } = render(<Logo size={100} />);
    expect(screen.getByRole("img", { name: "Quitto" })).toHaveStyle({
      fontSize: "100px",
    });
    const ring = container.querySelector("svg");
    expect(ring).toHaveAttribute("width", "72");
    expect(ring).toHaveAttribute("height", "72");
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
