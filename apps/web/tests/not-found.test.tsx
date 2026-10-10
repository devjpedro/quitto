import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotFound } from "@/components/not-found";
import { overwriteGetLocale } from "@/paraglide/runtime.js";
import { renderWithProviders as render } from "./test-utils";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

afterEach(() => overwriteGetLocale(() => "pt-BR"));

describe("NotFound", () => {
  it("o 404 com o wordmark (não o anel sozinho), o título e Ir para o início", () => {
    render(<NotFound />);
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Página não encontrada" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Ir para o início" })
    ).toHaveAttribute("href", "/");
  });

  it("em en-US, em inglês", () => {
    overwriteGetLocale(() => "en-US");
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "Page not found" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Go to the start" })).toBeVisible();
  });
});
