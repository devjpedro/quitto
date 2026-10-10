import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it } from "vitest";
import { AppToaster } from "../src/components/ui/app-toaster";

/** The toast's own element (sonner's `li`), found by its text. */
async function toastWith(text: string): Promise<HTMLElement> {
  const message = await screen.findByText(text);
  const item = message.closest<HTMLElement>("[data-sonner-toast]");
  if (!item) {
    throw new Error(`"${text}" is not inside a toast`);
  }
  return item;
}

describe("AppToaster", () => {
  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
  });

  it("um toast de sucesso nos tokens: superfície, borda fina, raio de cartão e a sombra do que flutua, sem o richColors", async () => {
    render(<AppToaster />);
    act(() => {
      toast.success("Parcela marcada como paga");
    });
    const item = await toastWith("Parcela marcada como paga");
    expect(item).not.toHaveAttribute("data-rich-colors", "true");
    expect(item).toHaveAttribute("data-styled", "false");
    expect(item).toHaveClass(
      "rounded-card",
      "border",
      "border-line",
      "bg-surface-raised",
      "text-ink",
      "shadow-float"
    );
    // Phosphor's check, in the brand color.
    const icon = item.querySelector("[data-icon] svg");
    expect(icon).toHaveAttribute("viewBox", "0 0 256 256");
    expect(icon).toHaveClass("text-brand");
  });

  it("o erro usa danger e danger-subtle, com ícone próprio além da cor", async () => {
    render(<AppToaster />);
    act(() => {
      toast.error("Não foi possível marcar a parcela");
    });
    const item = await toastWith("Não foi possível marcar a parcela");
    // Keyed on sonner's data-type: an attribute variant outranks the surface
    // classes every toast carries, whatever their order in the stylesheet.
    expect(item).toHaveAttribute("data-type", "error");
    expect(item).toHaveClass(
      "data-[type=error]:border-danger/30",
      "data-[type=error]:bg-danger-subtle"
    );
    const icon = item.querySelector("[data-icon] svg");
    expect(icon).toHaveAttribute("viewBox", "0 0 256 256");
    expect(icon).toHaveClass("text-danger");
  });

  it("embaixo à direita, acima da tab bar abaixo de md (com a área segura) e a 24 px da borda a partir de md", async () => {
    render(<AppToaster />);
    act(() => {
      toast.success("Convite aceito");
    });
    await toastWith("Convite aceito");
    const list = document.querySelector<HTMLElement>("[data-sonner-toaster]");
    expect(list).toHaveAttribute("data-y-position", "bottom");
    expect(list).toHaveAttribute("data-x-position", "right");
    expect(list?.style.getPropertyValue("--offset-bottom")).toBe(
      "var(--app-toast-bottom)"
    );
    expect(list?.style.getPropertyValue("--mobile-offset-bottom")).toBe(
      "var(--app-toast-bottom)"
    );
    expect(list).toHaveClass(
      "[--app-toast-bottom:calc(env(safe-area-inset-bottom)_+_5.25rem)]",
      "md:[--app-toast-bottom:1.5rem]"
    );
  });

  it("todo toast tem um ✕ do Phosphor, com nome 'Fechar', alvo de 44 px no celular e foco visível; clicar fecha", async () => {
    const user = userEvent.setup();
    render(<AppToaster />);
    act(() => {
      toast.success("Parcela marcada como paga");
    });
    const item = await toastWith("Parcela marcada como paga");
    const close = within(item).getByRole("button", { name: "Fechar" });
    expect(close).toHaveClass("size-11", "md:size-8", "focus-visible:ring-2");
    expect(close.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 256 256"
    );
    await user.click(close);
    await waitFor(() =>
      expect(screen.queryByText("Parcela marcada como paga")).toBeNull()
    );
  });
});
