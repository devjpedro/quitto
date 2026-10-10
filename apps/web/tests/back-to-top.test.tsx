import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BackToTop } from "@/components/layout/back-to-top";
import { ShellFrame } from "@/components/layout/shell-frame";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

function scrollPanelTo(top: number, clientHeight = 800) {
  const panel = document.getElementById("conteudo") as HTMLElement;
  Object.defineProperty(panel, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  panel.scrollTop = top;
  act(() => {
    panel.dispatchEvent(new Event("scroll"));
  });
  return panel;
}

describe("rolagem no bloco (B3)", () => {
  it("a partir de md o painel é o que rola: altura da tela, overflow-y e nada de min-height", () => {
    render(
      <ShellFrame column={<aside />}>
        <p>conteúdo</p>
      </ShellFrame>
    );
    const panel = document.getElementById("conteudo");
    expect(panel).toHaveClass("md:overflow-y-auto", "md:overscroll-contain");
    expect(panel?.className).toContain("md:h-[calc(100dvh");
    expect(panel?.className).not.toContain("md:min-h-");
    // The page itself does not scroll from md.
    expect(document.getElementById("app-shell")).toHaveClass(
      "md:h-dvh",
      "md:overflow-hidden"
    );
  });

  it("'Voltar ao topo' só aparece depois de uma tela de rolagem e leva o painel ao topo", async () => {
    render(
      <ShellFrame column={<aside />}>
        <p>conteúdo</p>
      </ShellFrame>
    );
    expect(screen.queryByRole("button", { name: "Voltar ao topo" })).toBeNull();
    const panel = scrollPanelTo(400);
    expect(screen.queryByRole("button", { name: "Voltar ao topo" })).toBeNull();
    scrollPanelTo(1200);
    const scrollTo = vi.fn();
    panel.scrollTo = scrollTo;
    await userEvent.click(
      screen.getByRole("button", { name: "Voltar ao topo" })
    );
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(screen.queryByRole("button", { name: "Voltar ao topo" })).toBeNull();
  });

  it("sem o painel na tela (o foco, o convite) o botão nem entra", () => {
    render(<BackToTop target="nao-existe" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("o modo 'screen' (wizard) não ganha o botão", () => {
    render(
      <ShellFrame column={<aside />} fit="screen">
        <p>conteúdo</p>
      </ShellFrame>
    );
    scrollPanelTo(1200);
    expect(screen.queryByRole("button", { name: "Voltar ao topo" })).toBeNull();
  });
});
