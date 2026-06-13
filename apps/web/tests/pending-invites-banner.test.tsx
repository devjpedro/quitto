import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "./test-utils";

const ONE_INVITE_PATTERN = /1 convite/i;

const useMyInvitesQuery = vi.fn();
vi.mock("../src/hooks/use-my-invites", () => ({
  useMyInvitesQuery: () => useMyInvitesQuery(),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/invites">{children}</a>
  ),
}));

import { PendingInvitesBanner } from "../src/components/pending-invites-banner";

describe("PendingInvitesBanner", () => {
  beforeEach(() => useMyInvitesQuery.mockReset());

  it("mostra a contagem quando há convites", () => {
    useMyInvitesQuery.mockReturnValue({
      data: [
        {
          token: "t1",
          contractTitle: "Apê",
          role: "seller",
          expiresAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    renderWithProviders(<PendingInvitesBanner />);
    expect(screen.getByText(ONE_INVITE_PATTERN)).toBeInTheDocument();
    expect(screen.getByText("Apê")).toBeInTheDocument();
  });

  it("não renderiza nada sem convites", () => {
    useMyInvitesQuery.mockReturnValue({ data: [] });
    const { container } = renderWithProviders(<PendingInvitesBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
