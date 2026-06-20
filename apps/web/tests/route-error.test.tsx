import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteError } from "@/components/route-error";

const RETRY_BUTTON = /tentar de novo/i;

describe("RouteError", () => {
  it("mostra mensagem amigável e re-tenta ao clicar", () => {
    const reset = vi.fn();
    render(
      <RouteError
        error={new Error("falha no loader")}
        info={{ componentStack: "" }}
        reset={reset}
      />
    );
    expect(screen.getByText("Ops, algo deu errado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: RETRY_BUTTON }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
