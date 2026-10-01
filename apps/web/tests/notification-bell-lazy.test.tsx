import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getList = vi.fn();

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/api", () => {
  const notifications = Object.assign(() => ({ read: { post: vi.fn() } }), {
    get: () => getList(),
    "unread-count": {
      get: () => Promise.resolve({ data: { count: 0 }, error: null }),
    },
    "read-all": { post: vi.fn() },
  });
  return { api: { api: { notifications } } };
});

import { NotificationBell } from "../src/components/notification-bell";

const BELL_BUTTON = /notificações/i;

it("só busca a lista de notificações quando o sino abre", async () => {
  getList.mockResolvedValue({ data: [], error: null });
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <NotificationBell />
    </QueryClientProvider>
  );

  await new Promise((r) => setTimeout(r, 20));
  expect(getList).not.toHaveBeenCalled();

  await userEvent.click(screen.getByRole("button", { name: BELL_BUTTON }));
  await waitFor(() => expect(getList).toHaveBeenCalled());
});

it("pré-carrega a lista ao passar o mouse no sino (abre já preenchido)", async () => {
  getList.mockReset();
  getList.mockResolvedValue({ data: [], error: null });
  render(
    <QueryClientProvider client={makeTestQueryClient()}>
      <NotificationBell />
    </QueryClientProvider>
  );

  await userEvent.hover(screen.getByRole("button", { name: BELL_BUTTON }));
  await waitFor(() => expect(getList).toHaveBeenCalledTimes(1));
});
