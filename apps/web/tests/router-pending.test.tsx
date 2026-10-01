import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { getRouter } from "../src/router";

// Sem defaultPendingComponent o <Suspense> do Outlet raiz cai em `null`: qualquer
// rota que suspenda (ex.: chunk lento) apaga a tela inteira, até a sidebar.
test("router tem um pending padrão visível (nunca tela vazia)", () => {
  const Pending = getRouter().options.defaultPendingComponent;
  expect(Pending).toBeDefined();
  if (!Pending) {
    return;
  }
  render(<Pending />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});
