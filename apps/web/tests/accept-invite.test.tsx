import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const ACCEPT_BUTTON = /aceitar/i;
const DECLINE_BUTTON = /recusar/i;
const OTHER_EMAIL = /outro e-mail/i;
const ALREADY_PARTICIPANT = /já participa deste contrato/i;
const INVITED_BY = /convidou você/i;
const BRL_1200 = /R\$\s*1\.200,00/;

const useInviteQuery = vi.fn();
const acceptMutate = vi.fn().mockResolvedValue({ contractId: "c1" });
const declineMutate = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();
vi.mock("../src/hooks/use-invite", () => ({
  useInviteQuery: () => useInviteQuery(),
  useAcceptInviteMutation: () => ({
    mutateAsync: acceptMutate,
    isPending: false,
  }),
  useDeclineInviteMutation: () => ({
    mutateAsync: declineMutate,
    isPending: false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ token: "tok1" }),
  useNavigate: () => navigate,
}));

import { AcceptInvitePage } from "../src/routes/accept-invite";

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    useInviteQuery.mockReset();
    acceptMutate.mockClear();
    declineMutate.mockClear();
    navigate.mockClear();
  });

  it("aceita quando o e-mail bate e navega ao contrato", async () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Apê",
        role: "seller",
        email: "a@b.com",
        emailMatches: true,
        inviterName: "Maria Silva",
        totalAmountCents: 120_000,
        installmentsCount: 12,
        parties: [],
      },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);

    fireEvent.click(screen.getByRole("button", { name: ACCEPT_BUTTON }));
    await waitFor(() => expect(acceptMutate).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/contracts/$id",
        params: { id: "c1" },
        search: { installment: undefined },
      })
    );
  });

  it("mostra mensagem e oculta aceitar quando já participa do contrato", () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Apê",
        role: "seller",
        email: "a@b.com",
        emailMatches: true,
        alreadyParticipant: true,
        inviterName: "Maria Silva",
        totalAmountCents: 120_000,
        installmentsCount: 12,
        parties: [],
      },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);
    expect(screen.getByText(ALREADY_PARTICIPANT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACCEPT_BUTTON })).toBeNull();
  });

  it("desabilita aceitar quando o e-mail não bate", () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Apê",
        role: "seller",
        email: "outro@b.com",
        emailMatches: false,
        inviterName: "Maria Silva",
        totalAmountCents: 120_000,
        installmentsCount: 12,
        parties: [],
      },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);
    expect(screen.getByText(OTHER_EMAIL)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACCEPT_BUTTON })).toBeNull();
  });

  it("exibe prévia do contrato e botão Recusar quando e-mail bate", () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Aluguel do Apê",
        role: "buyer",
        email: "a@b.com",
        emailMatches: true,
        inviterName: "Maria Silva",
        totalAmountCents: 120_000,
        installmentsCount: 12,
        parties: [{ displayName: "João Vendedor", role: "seller" }],
      },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);

    expect(screen.getByText(INVITED_BY)).toBeInTheDocument();
    expect(
      screen.getByText("Maria Silva", { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText(BRL_1200)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(
      screen.getByText("João Vendedor", { exact: false })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: DECLINE_BUTTON })
    ).toBeInTheDocument();
  });

  it("chama a mutation de recusar e navega para /contracts", async () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Aluguel do Apê",
        role: "buyer",
        email: "a@b.com",
        emailMatches: true,
        inviterName: "Maria Silva",
        totalAmountCents: 120_000,
        installmentsCount: 12,
        parties: [],
      },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);

    fireEvent.click(screen.getByRole("button", { name: DECLINE_BUTTON }));
    await waitFor(() => expect(declineMutate).toHaveBeenCalled());
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({ to: "/contracts" })
    );
  });
});
