import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const ACCEPT_BUTTON = /aceitar/i;
const OTHER_EMAIL = /outro e-mail/i;

const useInviteQuery = vi.fn();
const acceptMutate = vi.fn().mockResolvedValue({ contractId: "c1" });
const navigate = vi.fn();
vi.mock("../src/hooks/use-invite", () => ({
  useInviteQuery: () => useInviteQuery(),
  useAcceptInviteMutation: () => ({
    mutateAsync: acceptMutate,
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
    navigate.mockClear();
  });

  it("aceita quando o e-mail bate e navega ao contrato", async () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Apê",
        role: "seller",
        email: "a@b.com",
        emailMatches: true,
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
      })
    );
  });

  it("desabilita aceitar quando o e-mail não bate", () => {
    useInviteQuery.mockReturnValue({
      data: {
        contractTitle: "Apê",
        role: "seller",
        email: "outro@b.com",
        emailMatches: false,
      },
      isPending: false,
      error: null,
    });
    renderWithProviders(<AcceptInvitePage />);
    expect(screen.getByText(OTHER_EMAIL)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACCEPT_BUTTON })).toBeNull();
  });
});
