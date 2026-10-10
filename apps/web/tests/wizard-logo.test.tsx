import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, onClick, ...rest }: Record<string, unknown>) => (
    <a
      href={to as string}
      onClick={(event) => {
        (onClick as ((e: unknown) => void) | undefined)?.(event);
        if (!event.defaultPrevented) {
          navigate({ to });
        }
        event.preventDefault();
      }}
      {...rest}
    >
      {children as ReactNode}
    </a>
  ),
  useCanGoBack: () => true,
  useNavigate: () => navigate,
  useRouter: () => ({ history: { back: vi.fn() } }),
  useSearch: () => ({}),
}));
vi.mock("@/hooks/use-signed-in", () => ({ useSignedIn: () => true }));
vi.mock("@/hooks/use-identity", () => ({
  useIdentity: () => ({
    id: "u1",
    name: "João",
    email: "j@x.com",
    image: null,
  }),
}));

import { ContractWizardPage } from "@/features/contract-wizard/components/wizard-page";
import { renderWithProviders } from "./test-utils";

const DISCARD = /descartar/i;

describe("a logo do wizard", () => {
  it("com o formulário vazio vai direto para a home", async () => {
    navigate.mockClear();
    renderWithProviders(<ContractWizardPage />);
    await userEvent.click(screen.getByRole("link", { name: "Quitto, início" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("com algo preenchido pergunta antes (o mesmo 'descartar?' do ✕) e só vai ao confirmar", async () => {
    navigate.mockClear();
    renderWithProviders(<ContractWizardPage />);
    await userEvent.type(screen.getByLabelText("Nome do contrato"), "Moto");
    await userEvent.click(screen.getByRole("link", { name: "Quitto, início" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", {
        name: "Descartar este contrato?",
      })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: DISCARD }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});
