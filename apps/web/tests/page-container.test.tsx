import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageContainer } from "@/components/page-container";

describe("PageContainer", () => {
  it("renderiza os filhos", () => {
    render(
      <PageContainer>
        <p>conteúdo</p>
      </PageContainer>
    );
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("usa a largura padrão (default) quando width não é informado", () => {
    const { container } = render(<PageContainer>x</PageContainer>);
    expect(container.firstChild).toHaveClass("max-w-5xl");
  });

  it("aplica a largura de formulário quando width='form'", () => {
    const { container } = render(<PageContainer width="form">x</PageContainer>);
    expect(container.firstChild).toHaveClass("max-w-2xl");
  });

  it("mescla className extra", () => {
    const { container } = render(
      <PageContainer className="pt-0">x</PageContainer>
    );
    expect(container.firstChild).toHaveClass("pt-0");
  });
});
