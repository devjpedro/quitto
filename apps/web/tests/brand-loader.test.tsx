import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { BrandLoader } from "@/components/brand-loader";

test("expõe status acessível com o label", () => {
  render(<BrandLoader label="Carregando sua conta" />);
  expect(screen.getByRole("status")).toHaveTextContent("Carregando sua conta");
});

test("label padrão quando omitido", () => {
  render(<BrandLoader />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});
