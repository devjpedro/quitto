import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const markRead = vi.fn();
const markAll = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/hooks/use-notifications", () => ({
  useNotificationsQuery: () => ({
    data: [
      {
        id: "n1",
        type: "payment_confirmed",
        contractId: "c1",
        installmentId: "i1",
        metadata: null,
        readAt: null,
        createdAt: "2026-06-13T12:00:00.000Z",
      },
    ],
    isPending: false,
  }),
  useMarkReadMutation: () => ({ mutate: markRead }),
  useMarkAllReadMutation: () => ({ mutate: markAll }),
}));

import { NotificationsPage } from "../src/routes/notifications";

const MARK_ALL = /marcar todas como lidas/i;

describe("NotificationsPage", () => {
  it("lists notifications and marks all as read", async () => {
    render(<NotificationsPage />);
    expect(screen.getByText("Pagamento confirmado")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: MARK_ALL }));
    expect(markAll).toHaveBeenCalled();
  });
});
