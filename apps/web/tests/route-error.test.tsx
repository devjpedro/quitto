import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteError } from "@/components/route-error";

describe("RouteError", () => {
  it("mostra a frase e tenta de novo ao clicar", () => {
    const reset = vi.fn();
    render(
      <RouteError
        error={new Error("falha no loader")}
        info={{ componentStack: "" }}
        reset={reset}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Algo deu errado" })
    ).toBeVisible();
    expect(screen.getByText("Algo deu errado. Tente de novo.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
