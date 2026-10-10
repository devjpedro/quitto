import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DateField } from "@/components/ui/date-field";
import { overwriteGetLocale } from "@/paraglide/runtime.js";

function Harness({ initial = "", min }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField
        id="first"
        label="1º vencimento"
        min={min}
        onValueChange={setValue}
        value={value}
      />
      <output data-testid="iso">{value}</output>
    </>
  );
}

/** The day button of "terça-feira, 10 de novembro de 2026": matched by the label's day, never "14" or "24" by the substring. */
function dayOf(text: string, root: ParentNode = document.body) {
  const found = [...root.querySelectorAll("button[aria-label]")].find(
    (button) => button.getAttribute("aria-label")?.includes(`, ${text}`)
  );
  if (!found) {
    throw new Error(`no day button for ${text}`);
  }
  return found;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const OPEN = { name: "Abrir o calendário" };
const originalWidth = window.innerWidth;

afterEach(() => {
  window.innerWidth = originalWidth;
  overwriteGetLocale(() => "pt-BR");
});

describe("DateField, o calendário", () => {
  it("o ícone abre o popover no mês da data, e escolher um dia fecha e preenche o campo", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-10" />);
    await user.click(screen.getByRole("button", OPEN));
    const grid = await screen.findByRole("grid");
    expect(grid).toHaveAccessibleName("novembro 2026");
    expect(
      within(grid).getByRole("gridcell", { selected: true })
    ).toHaveTextContent("10");
    await user.click(dayOf("20 de novembro", grid));
    expect(screen.getByLabelText("1º vencimento")).toHaveValue("20/11/2026");
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-20");
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("teclado: o foco cai no dia, setas andam, Enter escolhe, Esc fecha", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-10" />);
    await user.click(screen.getByRole("button", OPEN));
    await screen.findByRole("grid");
    expect(dayOf("10 de novembro")).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowDown}{Enter}");
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-18");
    await user.click(screen.getByRole("button", OPEN));
    await screen.findByRole("grid");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("grid")).toBeNull();
    expect(screen.getByRole("button", OPEN)).toHaveFocus();
  });

  it("Page Down anda um mês, e o setinha também", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-10" />);
    await user.click(screen.getByRole("button", OPEN));
    await screen.findByRole("grid");
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("grid")).toHaveAccessibleName("dezembro 2026");
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(screen.getByRole("grid")).toHaveAccessibleName("outubro 2026");
  });

  it("o mês é um Select: escolher outro mês da lista leva o calendário até ele", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-10" />);
    await user.click(screen.getByRole("button", OPEN));
    await screen.findByRole("grid");
    await user.click(screen.getByRole("combobox", { name: "Mês e ano" }));
    await user.click(
      within(await screen.findByRole("group", { name: "2027" })).getByRole(
        "option",
        { name: "Março" }
      )
    );
    expect(screen.getByRole("grid")).toHaveAccessibleName("março 2027");
  });

  it("'Hoje' escolhe o dia de hoje", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", OPEN));
    await user.click(await screen.findByRole("button", { name: "Hoje" }));
    expect(screen.getByTestId("iso").textContent).toMatch(ISO);
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("min: os dias antes dele não se escolhem", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2026-11-10" min="2026-11-05" />);
    await user.click(screen.getByRole("button", OPEN));
    const grid = await screen.findByRole("grid");
    expect(dayOf("4 de novembro", grid)).toBeDisabled();
    expect(dayOf("5 de novembro", grid)).toBeEnabled();
  });

  it("no celular: o calendário abre num sheet de baixo, e tocar no dia fecha", async () => {
    window.innerWidth = 390;
    const user = userEvent.setup();
    render(<Harness initial="2026-11-10" />);
    await user.click(screen.getByRole("button", OPEN));
    const sheet = await screen.findByRole("dialog", { name: "1º vencimento" });
    expect(sheet).toHaveAttribute("data-variant", "bottom");
    await user.click(dayOf("12 de novembro", sheet));
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-12");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("en-US: mm/dd/yyyy, e o calendário em inglês", async () => {
    overwriteGetLocale(() => "en-US");
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("1º vencimento");
    expect(input).toHaveAttribute("placeholder", "mm/dd/yyyy");
    await user.type(input, "11102026");
    expect(screen.getByTestId("iso")).toHaveTextContent("2026-11-10");
    await user.click(screen.getByRole("button", { name: "Open the calendar" }));
    expect(await screen.findByRole("grid")).toHaveAccessibleName(
      "November 2026"
    );
  });
});
