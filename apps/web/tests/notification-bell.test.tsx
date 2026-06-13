import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const markRead = vi.fn().mockResolvedValue(undefined);
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/hooks/use-notifications", () => ({
  useUnreadCountQuery: () => ({ data: { count: 2 } }),
  useNotificationsQuery: () => ({
    data: [
      {
        id: "n1",
        type: "installment_overdue",
        contractId: "c1",
        installmentId: "i1",
        metadata: null,
        readAt: null,
        createdAt: "2026-06-13T12:00:00.000Z",
      },
    ],
  }),
  useMarkReadMutation: () => ({ mutateAsync: markRead }),
  useMarkAllReadMutation: () => ({ mutate: vi.fn() }),
}));

import { NotificationBell } from "../src/components/notification-bell";

const BELL_BUTTON = /notificações/i;
const ITEM_BUTTON = /parcela vencida/i;

describe("NotificationBell", () => {
  beforeEach(() => {
    markRead.mockClear();
    navigate.mockClear();
  });

  it("shows the unread count and opens the popover", async () => {
    render(<NotificationBell />);
    expect(screen.getByText("2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: BELL_BUTTON }));
    expect(screen.getByText("Parcela vencida")).toBeInTheDocument();
  });

  it("marks read and deep-links to the installment on click", async () => {
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: BELL_BUTTON }));
    await userEvent.click(screen.getByRole("button", { name: ITEM_BUTTON }));
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(navigate).toHaveBeenCalledWith({
      to: "/contracts/$id",
      params: { id: "c1" },
      search: { installment: "i1" },
    });
  });
});
