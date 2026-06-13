import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient } from "./test-utils";

const getList = vi.fn();
const getUnread = vi.fn();
const postRead = vi.fn();
const postReadAll = vi.fn();

vi.mock("@/lib/api", () => {
  const notifications = Object.assign(
    (_params: { id: string }) => ({
      read: { post: () => postRead() },
    }),
    {
      get: () => getList(),
      "unread-count": { get: () => getUnread() },
      "read-all": { post: () => postReadAll() },
    }
  );
  return { api: { api: { notifications } } };
});

import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationsQuery,
  useUnreadCountQuery,
} from "../src/hooks/use-notifications";

function wrapper(client = makeTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("use-notifications", () => {
  beforeEach(() => {
    getList.mockReset();
    getUnread.mockReset();
    postRead.mockReset();
    postReadAll.mockReset();
  });

  it("unwraps the list", async () => {
    getList.mockResolvedValue({
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
      error: null,
    });
    const { result } = renderHook(() => useNotificationsQuery(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.id).toBe("n1");
  });

  it("unwraps the unread count", async () => {
    getUnread.mockResolvedValue({ data: { count: 3 }, error: null });
    const { result } = renderHook(() => useUnreadCountQuery(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(3);
  });

  it("markRead invalidates list + unread", async () => {
    postRead.mockResolvedValue({ data: { ok: true }, error: null });
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkReadMutation(), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync("n1");
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["notifications", "unread-count"],
    });
  });

  it("markAllRead invalidates list + unread", async () => {
    postReadAll.mockResolvedValue({ data: { ok: true }, error: null });
    const client = makeTestQueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkAllReadMutation(), {
      wrapper: wrapper(client),
    });
    await result.current.mutateAsync();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    expect(spy).toHaveBeenCalledWith({
      queryKey: ["notifications", "unread-count"],
    });
  });
});
