import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

const originalWidth = window.innerWidth;
afterEach(() => {
  window.innerWidth = originalWidth;
});

function renderSheet(onOpenChange = vi.fn()) {
  render(
    <ResponsiveSheet
      description="Vence amanhã"
      onOpenChange={onOpenChange}
      open
      title="Parcela 7 de 12"
    >
      <button type="button">Enviar comprovante</button>
    </ResponsiveSheet>
  );
  return onOpenChange;
}

/** Opened by state, as the bell opens the notifications panel: no Dialog.Trigger. */
function SheetWithOpener() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        Abrir
      </button>
      <ResponsiveSheet onOpenChange={setOpen} open={open} title="Parcela">
        <button type="button">Enviar comprovante</button>
      </ResponsiveSheet>
    </>
  );
}

/**
 * Opened by a launcher that leaves the page, as the ⌘K palette opens the
 * notifications panel and closes. `leaves` says when: as the sheet opens
 * (nothing has the focus at open) or right after (it had it, then is gone).
 */
function SheetFromLauncher({ leaves }: { leaves: "at-open" | "after-open" }) {
  const bell = useRef<HTMLButtonElement>(null);
  const [launcher, setLauncher] = useState(true);
  const [open, setOpen] = useState(false);
  function launch() {
    setOpen(true);
    if (leaves === "at-open") {
      setLauncher(false);
    } else {
      setTimeout(() => setLauncher(false), 0);
    }
  }
  return (
    <>
      <button ref={bell} type="button">
        Sino
      </button>
      {launcher ? (
        <button onClick={launch} type="button">
          Paleta: Notificações
        </button>
      ) : null}
      <ResponsiveSheet
        fallbackFocus={() => bell.current}
        onOpenChange={setOpen}
        open={open}
        title="Notificações"
      >
        <button type="button">Abrir aviso</button>
      </ResponsiveSheet>
    </>
  );
}

describe("ResponsiveSheet", () => {
  it("is a named dialog that focuses the content first, not the close button", () => {
    renderSheet();
    expect(
      screen.getByRole("dialog", { name: "Parcela 7 de 12" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Enviar comprovante" })
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "Fechar" })).toBeVisible();
  });

  it("closes on Escape", async () => {
    const onOpenChange = renderSheet();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a side panel from md up and a bottom sheet below", () => {
    window.innerWidth = 1024;
    const { unmount } = render(
      <ResponsiveSheet onOpenChange={vi.fn()} open title="A">
        <p>x</p>
      </ResponsiveSheet>
    );
    const side = screen.getByRole("dialog");
    expect(side).toHaveAttribute("data-variant", "side");
    // viewport-fit=cover: a phone on its side (md+) has the notch at a side.
    expect(side).toHaveClass(
      "right-[max(0.75rem,env(safe-area-inset-right))]",
      "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
    );
    unmount();
    window.innerWidth = 390;
    render(
      <ResponsiveSheet onOpenChange={vi.fn()} open title="B">
        <p>x</p>
      </ResponsiveSheet>
    );
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "data-variant",
      "bottom"
    );
  });

  it("gives the focus back to the button that opened it, on Escape and on Close", async () => {
    render(<SheetWithOpener />);
    const opener = screen.getByRole("button", { name: "Abrir" });
    await userEvent.click(opener);
    expect(
      screen.getByRole("button", { name: "Enviar comprovante" })
    ).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(opener).toHaveFocus();

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(opener).toHaveFocus();
  });

  for (const leaves of ["at-open", "after-open"] as const) {
    it(`when what opened it left the page (${leaves}), the focus goes to the fallback, not to <body>`, async () => {
      render(<SheetFromLauncher leaves={leaves} />);
      await userEvent.click(
        screen.getByRole("button", { name: "Paleta: Notificações" })
      );
      expect(
        await screen.findByRole("button", { name: "Abrir aviso" })
      ).toHaveFocus();
      await waitFor(() =>
        expect(
          screen.queryByRole("button", {
            hidden: true,
            name: "Paleta: Notificações",
          })
        ).toBeNull()
      );
      await userEvent.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      );
      expect(screen.getByRole("button", { name: "Sino" })).toHaveFocus();
    });
  }

  it("closes from the Close button", async () => {
    const onOpenChange = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays mounted for the exit animation, then unmounts", async () => {
    const sheet = (open: boolean) => (
      <ResponsiveSheet onOpenChange={vi.fn()} open={open} title="Parcela">
        <p>x</p>
      </ResponsiveSheet>
    );
    const { rerender } = render(sheet(true));
    expect(screen.getByRole("dialog")).toBeVisible();
    rerender(sheet(false));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  describe("drag to dismiss", () => {
    // jsdom does not derive pageY from clientY, and motion reads pageY.
    async function dragDown(target: HTMLElement, distance = 200) {
      const at = (y: number) => ({
        clientX: 10,
        clientY: y,
        pageX: 10,
        pageY: y,
      });
      await userEvent.pointer([
        { keys: "[MouseLeft>]", target, coords: at(10) },
        { coords: at(10 + distance / 2) },
        { coords: at(10 + distance) },
        { keys: "[/MouseLeft]" },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    function renderBody(width: number) {
      window.innerWidth = width;
      const onOpenChange = vi.fn();
      render(
        <ResponsiveSheet onOpenChange={onOpenChange} open title="Parcela">
          <p>conteudo</p>
        </ResponsiveSheet>
      );
      return onOpenChange;
    }

    it("dismisses when the header of the bottom sheet is dragged down", async () => {
      const onOpenChange = renderBody(390);
      await dragDown(screen.getByText("Parcela"));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not dismiss when the content is dragged", async () => {
      const onOpenChange = renderBody(390);
      await dragDown(screen.getByText("conteudo"));
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("does not dismiss the side panel when its header is dragged", async () => {
      const onOpenChange = renderBody(1024);
      await dragDown(screen.getByText("Parcela"));
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  it("bottom sheet: o rodapé fica preso embaixo, fora da rolagem; o teto é 91%; as setas do cabeçalho não aparecem", async () => {
    window.innerWidth = 390;
    render(
      <ResponsiveSheet
        footer={<button type="button">Copiar código PIX</button>}
        headerActions={<button type="button">Próxima parcela</button>}
        onOpenChange={() => undefined}
        open
        title="Parcela 7 de 10"
      >
        <p>corpo</p>
      </ResponsiveSheet>
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Parcela 7 de 10",
    });
    expect(dialog).toHaveClass("max-h-[91dvh]");
    // The footer takes the safe area; the frame does not add it again.
    expect(dialog).not.toHaveClass("pb-[env(safe-area-inset-bottom)]");
    expect(
      screen
        .getByRole("button", { name: "Copiar código PIX" })
        .closest(".overflow-y-auto")
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Próxima parcela" })
    ).toBeNull();
  });

  it("bottom sheet sem rodapé: o próprio quadro folga a safe-area", async () => {
    window.innerWidth = 390;
    render(
      <ResponsiveSheet onOpenChange={() => undefined} open title="Parcela 7">
        <p>corpo</p>
      </ResponsiveSheet>
    );
    expect(
      await screen.findByRole("dialog", { name: "Parcela 7" })
    ).toHaveClass("pb-[env(safe-area-inset-bottom)]");
  });

  it("lateral: as setas no cabeçalho, sem o rodapé do celular", async () => {
    window.innerWidth = 1024;
    render(
      <ResponsiveSheet
        footer={<button type="button">Copiar código PIX</button>}
        headerActions={<button type="button">Próxima parcela</button>}
        onOpenChange={() => undefined}
        open
        title="Parcela 7 de 10"
      >
        <p>corpo</p>
      </ResponsiveSheet>
    );
    expect(
      await screen.findByRole("button", { name: "Próxima parcela" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Copiar código PIX" })
    ).toBeNull();
  });

  it("onKeyDown ouve as teclas de dentro do sheet (o painel anda com ↓ sem remontar)", async () => {
    window.innerWidth = 1024;
    const onKeyDown = vi.fn();
    render(
      <ResponsiveSheet
        onKeyDown={onKeyDown}
        onOpenChange={() => undefined}
        open
        title="Parcela 7 de 10"
      >
        <button type="button">corpo</button>
      </ResponsiveSheet>
    );
    (await screen.findByRole("button", { name: "corpo" })).focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(onKeyDown).toHaveBeenCalledWith(
      expect.objectContaining({ key: "ArrowDown" })
    );
  });
});
