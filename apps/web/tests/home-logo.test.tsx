import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HomeLogo } from "@/components/home-logo";
import { queryKeys } from "@/lib/query-keys";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

const identity = { id: "u1", name: "Maria", email: "m@x.com", image: null };

async function renderLogo(
  signedIn: boolean,
  onNavigate?: (event: { preventDefault(): void }) => void
) {
  const root = createRootRoute({
    component: () => <HomeLogo onNavigate={onNavigate} size={24} />,
  });
  root.addChildren([
    createRoute({
      getParentRoute: () => root,
      path: "/",
      component: () => null,
    }),
  ]);
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const client = makeTestQueryClient();
  if (signedIn) {
    client.setQueryData(queryKeys.session, identity);
  }
  renderWithProviders(<RouterProvider router={router} />, { client });
  await screen.findByRole("img", { name: "Quitto" });
}

describe("HomeLogo", () => {
  it("com sessão é um link para a home, com o nome 'Quitto, início'", async () => {
    await renderLogo(true);
    const link = screen.getByRole("link", { name: "Quitto, início" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("sem sessão é só a imagem: não há link", async () => {
    await renderLogo(false);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Quitto" })).toBeInTheDocument();
  });

  it("o clique chama onNavigate, que pode impedir a ida", async () => {
    const onNavigate = vi.fn((event: { preventDefault(): void }) =>
      event.preventDefault()
    );
    await renderLogo(true, onNavigate);
    await userEvent.click(screen.getByRole("link", { name: "Quitto, início" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
