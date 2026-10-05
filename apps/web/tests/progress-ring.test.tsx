import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RING_CIRCUMFERENCE, TRACK_MIX } from "@/components/ring-geometry";
import { ProgressRing } from "@/components/ui/progress-ring";

const C = RING_CIRCUMFERENCE.toFixed(2);

describe("ProgressRing", () => {
  it("fills the arc as the share of the circumference, from the top", () => {
    const { container } = render(<ProgressRing percent={90} size={22} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "22");
    const arc = container.querySelectorAll("circle")[1];
    expect(arc).toHaveAttribute(
      "stroke-dasharray",
      `${(0.9 * RING_CIRCUMFERENCE).toFixed(2)} ${C}`
    );
    expect(arc).toHaveAttribute("transform", "rotate(-90 12 12)");
    expect(arc).toHaveAttribute("stroke-linecap", "round");
  });

  it("uses the logo's geometry: radius 9, stroke 4, the track at the logo's TRACK_MIX of the brand", () => {
    const { container } = render(<ProgressRing percent={50} size={16} />);
    const [track, arc] = container.querySelectorAll("circle");
    expect(track).toHaveAttribute("r", "9");
    expect(track).toHaveAttribute("stroke-width", "4");
    // The class is a literal (Tailwind only builds what it finds), so the
    // test ties it to the logo's constant: if TRACK_MIX moves, this fails.
    expect(track).toHaveClass(`stroke-brand/${TRACK_MIX}`);
    expect(arc).toHaveClass("stroke-brand");
  });

  it("0% (or below) is the track alone; above 100% stays full", () => {
    const empty = render(<ProgressRing percent={0} size={16} />);
    expect(empty.container.querySelectorAll("circle")).toHaveLength(1);
    const negative = render(<ProgressRing percent={-5} size={16} />);
    expect(negative.container.querySelectorAll("circle")).toHaveLength(1);
    const full = render(<ProgressRing percent={140} size={16} />);
    expect(full.container.querySelectorAll("circle")[1]).toHaveAttribute(
      "stroke-dasharray",
      `${C} ${C}`
    );
  });

  it("on the lime card the ring is dark ink", () => {
    const { container } = render(
      <ProgressRing percent={90} size={22} tone="onHighlight" />
    );
    const [track, arc] = container.querySelectorAll("circle");
    expect(track).toHaveClass("stroke-on-highlight/16");
    expect(arc).toHaveClass("stroke-on-highlight");
  });
});
