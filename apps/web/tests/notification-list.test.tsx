import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationList } from "../src/components/notification-list";

const EMPTY_TEXT = /nenhuma notificação/i;
const BUTTON_NAME = /parcela vencida/i;

const items = [
  {
    id: "n1",
    type: "installment_overdue",
    contractId: "c1",
    installmentId: "i1",
    metadata: null,
    readAt: null,
    createdAt: "2026-06-13T12:00:00.000Z",
  },
];

describe("NotificationList", () => {
  it("renders the pt-BR message for the type", () => {
    render(<NotificationList items={items} onOpen={vi.fn()} />);
    expect(screen.getByText("Parcela vencida")).toBeInTheDocument();
  });

  it("shows an empty state when there are no items", () => {
    render(<NotificationList items={[]} onOpen={vi.fn()} />);
    expect(screen.getByText(EMPTY_TEXT)).toBeInTheDocument();
  });

  it("calls onOpen with the item when clicked", async () => {
    const onOpen = vi.fn();
    render(<NotificationList items={items} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: BUTTON_NAME }));
    expect(onOpen).toHaveBeenCalledWith(items[0]);
  });
});
