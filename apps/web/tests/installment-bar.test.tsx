import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type BarStatus,
  InstallmentBar,
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

function statusesOf(container: HTMLElement) {
  return [...container.querySelectorAll("[data-status]")].map((s) =>
    s.getAttribute("data-status")
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

  it("above 24 installments: zones sized by the counts, no empty zone", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={60}
        overdueCount={24}
        paidCount={4}
        statuses={null}
      />
    );
    const zones = [...container.querySelectorAll<HTMLElement>("[data-status]")];
    expect(zones.map((z) => [z.dataset.status, z.style.flexGrow])).toEqual([
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

  it("on the green card: paid in on-brand and overdue in the salmon stripe", () => {
    const { container } = render(
      <InstallmentBar
        installmentsCount={3}
        onBrand
        overdueCount={1}
        paidCount={1}
        statuses={["paid", "overdue", "open"]}
      />
    );
    const segments = container.querySelectorAll("[data-status]");
    expect(segments[0]).toHaveClass("bg-on-brand");
    expect(segments[1]).toHaveClass("stripes-on-brand-alert");
    expect(segments[2]).toHaveClass("bg-on-brand/20");
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
  });
});
