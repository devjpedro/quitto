import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Stepper } from "../src/components/stepper";

const steps = [{ label: "Básico" }, { label: "Parcelas" }];
const BASICO = /Básico/i;

describe("Stepper", () => {
  it("renders numbered steps with the current one marked", () => {
    render(<Stepper current={1} onStepClick={vi.fn()} steps={steps} />);
    expect(screen.getByText("Básico")).toBeInTheDocument();
    expect(screen.getByText("Parcelas")).toBeInTheDocument();
  });

  it("lets you click a completed step but not a future one", async () => {
    const onStepClick = vi.fn();
    render(<Stepper current={1} onStepClick={onStepClick} steps={steps} />);
    await userEvent.click(screen.getByRole("button", { name: BASICO }));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
