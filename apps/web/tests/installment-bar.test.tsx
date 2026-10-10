import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type BarStatus,
  InstallmentBar,
  ON_BRAND_TRACK_MIX,
} from "@/components/ui/installment-bar";

const TWELVE: BarStatus[] = [
  "paid",
  "paid",
  "overdue",
  "overdue",
  "open",
  "open",
  "open",
  "open",
  "open",
  "open",
  "open",
  "open",
];

const times = (status: BarStatus, count: number): BarStatus[] =>
  Array.from({ length: count }, () => status);

// The angle each stripes-* utility draws, read from tokens.css.
const STRIPES_RE =
  /@utility (stripes-[a-z-]+) \{\s*background-image: repeating-linear-gradient\(\s*(-?\d+deg),/g;
const STRIPE_ANGLE: Record<string, string> = Object.fromEntries(
  [
    ...readFileSync(
      resolve(import.meta.dirname, "../src/styles/tokens.css"),
      "utf8"
    ).matchAll(STRIPES_RE),
  ].map(([, utility, angle]) => [utility, angle])
);

function stripeAngle(segment: Element | undefined) {
  const stripes = [...(segment?.classList ?? [])].find((name) =>
    name.startsWith("stripes-")
  );
  return stripes ? STRIPE_ANGLE[stripes] : undefined;
}

function statusesOf(container: HTMLElement) {
  return [...container.querySelectorAll("[data-status]")].map((s) =>
    s.getAttribute("data-status")
  );
}

function zonesOf(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-status]")].map(
    (zone) => [zone.dataset.status, zone.style.flexGrow]
  );
}

describe("InstallmentBar", () => {
  it("draws one segment per installment, in order; the status is in the pattern, not only the color", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={12}
        overdueCount={2}
        paidCount={2}
        statuses={TWELVE}
      />
    );
    expect(statusesOf(container)).toEqual(TWELVE);
    const segments = container.querySelectorAll("[data-status]");
    expect(segments[0]).toHaveClass("bg-brand");
    expect(segments[2]).toHaveClass("stripes-danger");
    expect(segments[4]).toHaveClass("bg-track");
  });

  it("a proof waiting is a warning stripe and 'due today' an ink outline", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={3}
        overdueCount={0}
        paidCount={1}
        statuses={["paid", "review", "today"]}
      />
    );
    const segments = container.querySelectorAll("[data-status]");
    expect(segments[1]).toHaveClass("stripes-warning");
    expect(segments[2]).toHaveClass("shadow-[inset_0_0_0_1.5px_var(--ink)]");
  });

  it("overdue and a proof waiting differ in shape, not only in color: -45° against +45°, on the panel and on the green card", () => {
    expect(Object.keys(STRIPE_ANGLE).sort()).toEqual([
      "stripes-danger",
      "stripes-on-brand",
      "stripes-on-brand-alert",
      "stripes-warning",
    ]);
    for (const onBrand of [false, true]) {
      const { container } = render(
        <InstallmentBar
          installmentsCount={2}
          onBrand={onBrand}
          overdueCount={1}
          paidCount={0}
          statuses={["overdue", "review"]}
        />
      );
      const [overdue, review] = container.querySelectorAll("[data-status]");
      expect(stripeAngle(overdue)).toBe("-45deg");
      expect(stripeAngle(review)).toBe("45deg");
    }
  });

  it("above 24 installments: zones sized by the counts, no empty zone", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={60}
        overdueCount={24}
        paidCount={4}
        statuses={null}
      />
    );
    expect(zonesOf(container)).toEqual([
      ["paid", "4"],
      ["overdue", "24"],
      ["open", "32"],
    ]);
    const none = render(
      <InstallmentBar
        installmentsCount={30}
        overdueCount={0}
        paidCount={0}
        statuses={null}
      />
    );
    expect(statusesOf(none.container)).toEqual(["open"]);
  });

  it("zones: paid and overdue past the total leave no 'open' zone", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={10}
        overdueCount={6}
        paidCount={6}
        statuses={null}
      />
    );
    expect(zonesOf(container)).toEqual([
      ["paid", "6"],
      ["overdue", "6"],
    ]);
  });

  it("0 installments draws an empty bar, in segments or in zones", () => {
    for (const statuses of [[], null]) {
      const { container } = render(
        <InstallmentBar
          installmentsCount={0}
          overdueCount={0}
          paidCount={0}
          statuses={statuses}
        />
      );
      expect(statusesOf(container)).toEqual([]);
      expect(container.firstElementChild).toHaveAttribute(
        "aria-hidden",
        "true"
      );
    }
  });

  it("1 installment is a single segment", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={1}
        overdueCount={0}
        paidCount={0}
        statuses={["today"]}
      />
    );
    expect(statusesOf(container)).toEqual(["today"]);
  });

  it("24 installments is still one segment each; at 25 the API sends no statuses and the bar is zones", () => {
    const twentyFour = [
      ...times("paid", 10),
      "overdue",
      ...times("open", 13),
    ] as BarStatus[];
    const segmented = render(
      <InstallmentBar
        installmentsCount={24}
        overdueCount={1}
        paidCount={10}
        statuses={twentyFour}
      />
    );
    expect(statusesOf(segmented.container)).toHaveLength(24);
    expect(statusesOf(segmented.container)).toEqual(twentyFour);
    const zones = render(
      <InstallmentBar
        installmentsCount={25}
        overdueCount={1}
        paidCount={10}
        statuses={null}
      />
    );
    expect(zonesOf(zones.container)).toEqual([
      ["paid", "10"],
      ["overdue", "1"],
      ["open", "14"],
    ]);
  });

  it("on the green card: paid and a proof in on-brand, overdue in the salmon stripe, 'due today' an on-brand outline, the track at 16%", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={5}
        onBrand
        overdueCount={1}
        paidCount={1}
        statuses={["paid", "overdue", "review", "today", "open"]}
      />
    );
    const segments = container.querySelectorAll("[data-status]");
    expect(segments[0]).toHaveClass("bg-on-brand");
    expect(segments[1]).toHaveClass("stripes-on-brand-alert");
    expect(segments[2]).toHaveClass("stripes-on-brand");
    expect(segments[3]).toHaveClass(
      "shadow-[inset_0_0_0_1.5px_var(--on-brand)]"
    );
    expect(segments[4]).toHaveClass(`bg-on-brand/${ON_BRAND_TRACK_MIX}`);
    expect(ON_BRAND_TRACK_MIX).toBe(16);
  });

  it("is decorative: the legend beside it carries the numbers", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={12}
        overdueCount={2}
        paidCount={2}
        statuses={TWELVE}
      />
    );
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    const zones = render(
      <InstallmentBar
        installmentsCount={60}
        overdueCount={24}
        paidCount={4}
        statuses={null}
      />
    );
    expect(zones.container.firstElementChild).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });
});
