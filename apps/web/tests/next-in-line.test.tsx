import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NextInLine } from "@/features/home/components/next-in-line";
import { overwriteGetLocale } from "@/paraglide/runtime.js";
import { installmentAction, inviteAction, TODAY } from "./home-fixtures";
import { renderWithProviders } from "./test-utils";

const MORE_IN_INSTALLMENTS = /\+ 2 em Parcelas/;
const SEE_MORE = /Ver mais 2/;
const SEE_LESS = /Mostrar menos/;

interface LinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, to }: LinkProps) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
}));

const installments = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    installmentAction({ installmentId: `i${i}`, id: `installment:i${i}` })
  );

function rows() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("Na sequência", () => {
  overwriteGetLocale(() => "pt-BR");

  it("só parcelas a mais: três linhas e o link '+ N em Parcelas'", () => {
    renderWithProviders(<NextInLine actions={installments(5)} today={TODAY} />);
    expect(rows()).toHaveLength(3);
    expect(
      screen.getByRole("link", { name: MORE_IN_INSTALLMENTS })
    ).toHaveProperty("href", expect.stringContaining("/installments"));
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("convite sobrando: nunca passa de três linhas e o botão expande e recolhe ali mesmo", async () => {
    const user = userEvent.setup();
    const actions = [
      ...installments(3),
      inviteAction({ token: "a" }),
      inviteAction({ token: "b" }),
    ];
    renderWithProviders(<NextInLine actions={actions} today={TODAY} />);
    expect(rows()).toHaveLength(3);
    expect(
      screen.queryByRole("link", { name: MORE_IN_INSTALLMENTS })
    ).toBeNull();

    const expand = screen.getByRole("button", { name: SEE_MORE });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    await user.click(expand);
    expect(rows()).toHaveLength(5);

    const collapse = screen.getByRole("button", { name: SEE_LESS });
    expect(collapse.getAttribute("aria-expanded")).toBe("true");
    await user.click(collapse);
    expect(rows()).toHaveLength(3);
    expect(screen.getByRole("button", { name: SEE_MORE })).toBeTruthy();
  });

  it("até três ações: sem rodapé", () => {
    renderWithProviders(<NextInLine actions={installments(3)} today={TODAY} />);
    expect(rows()).toHaveLength(3);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(MORE_IN_INSTALLMENTS)).toBeNull();
  });
});
