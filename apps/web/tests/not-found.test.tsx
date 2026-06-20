import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotFound } from "@/components/not-found";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const LINK_NAME = /voltar ao início/i;

describe("NotFound", () => {
  it("mostra 404 de marca com link para o início", () => {
    render(<NotFound />);
    expect(screen.getByText("Página não encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: LINK_NAME })).toHaveAttribute(
      "href",
      "/"
    );
  });
});
