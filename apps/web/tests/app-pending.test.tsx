import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppPending } from "@/components/app-pending";

describe("AppPending", () => {
  it("mostra um estado de carregamento com a marca (não tela branca)", () => {
    render(<AppPending />);
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
  });
});
