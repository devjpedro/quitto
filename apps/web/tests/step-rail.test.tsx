import { ShieldCheck } from "@phosphor-icons/react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepRail } from "@/components/layout/step-rail";
import { renderWithProviders as render } from "./test-utils";

const LATER_STEP = /Com quem/;
const onSelect = vi.fn();

function rail() {
  return render(
    <StepRail
      footer="Nada é criado antes da revisão."
      footerIcon={ShieldCheck}
      group="Novo contrato"
      order="meta-first"
      steps={[
        {
          label: "Sobre o acordo",
          meta: "Passo 1 de 4",
          state: "done",
          onSelect,
        },
        { label: "Valores e datas", meta: "Passo 2 de 4", state: "next" },
        { label: "Com quem", meta: "Passo 3 de 4 · opcional", state: "todo" },
        { label: "Revisar e criar", meta: "Passo 4 de 4", state: "todo" },
      ]}
    />
  );
}

describe("StepRail", () => {
  it("o atual é aria-current=step; o feito é um botão; o a fazer não", async () => {
    const user = userEvent.setup();
    rail();
    expect(screen.getByText("Valores e datas").closest("li")).toHaveAttribute(
      "aria-current",
      "step"
    );
    await user.click(
      screen.getByRole("button", { name: "Passo 1 de 4 Sobre o acordo" })
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: LATER_STEP })).toBeNull();
  });

  it("o grupo, o rodapé e a logo de verdade", () => {
    rail();
    // The column is hidden below md by CSS (SHELL_COLUMN); the width is checked on the screenshots.
    expect(screen.getByText("Novo contrato")).toBeInTheDocument();
    expect(
      screen.getByText("Nada é criado antes da revisão.")
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });

  it("o passo atual é a linha branca, nunca a preta (decisão 4 do dono)", () => {
    rail();
    const current = screen.getByText("Valores e datas").closest("[data-state]");
    expect(current).toHaveClass("bg-surface");
    expect(current).not.toHaveClass("bg-ink");
  });
});
