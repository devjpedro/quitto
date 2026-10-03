import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Home } from "@/features/home/types";
import type { NotificationItem } from "@/features/notifications/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture } from "./home-fixtures";

const { postRead, postReadAll } = vi.hoisted(() => ({
  postRead: vi.fn(),
  postReadAll: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  const notifications = Object.assign(
    (_params: { id: string }) => ({ read: { post: () => postRead() } }),
    {
      get: () => new Promise(() => undefined),
      "read-all": { post: () => postReadAll() },
    }
  );
  return { api: { api: { notifications } } };
});

import {
  useMarkAllReadMutation,
  useMarkReadMutation,
} from "../src/features/notifications/api";

function note(id: string, readAt: string | null = null): NotificationItem {
  return {
    id,
    type: "payment_confirmed",
    contractId: "c1",
    installmentId: "i1",
    metadata: null,
    readAt,
    createdAt: "2026-10-02T10:00:00.000Z",
    contractTitle: "Aluguel do apê",
    installmentSequence: 7,
    installmentsCount: 12,
  };
}

function setup(items: NotificationItem[], unreadCount: number) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  client.setQueryData(queryKeys.notifications, items);
  client.setQueryData(queryKeys.home, homeFixture({ unreadCount }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const unread = (client: QueryClient) =>
  client.getQueryData<Home>(queryKeys.home)?.unreadCount;
const readIds = (client: QueryClient) =>
  client
    .getQueryData<NotificationItem[]>(queryKeys.notifications)
    ?.filter((n) => n.readAt !== null)
    .map((n) => n.id);

beforeEach(() => {
  postRead.mockReset();
  postReadAll.mockReset();
});

describe("useMarkReadMutation", () => {
  it("marca na lista e desconta do sino na hora", async () => {
    postRead.mockReturnValue(new Promise(() => undefined));
    const { client, wrapper } = setup([note("n1"), note("n2")], 2);
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    act(() => result.current.mutate("n1"));
    await waitFor(() => expect(readIds(client)).toEqual(["n1"]));
    expect(unread(client)).toBe(1);
  });

  it("se a API falhar, volta tudo", async () => {
    postRead.mockResolvedValue({
      data: null,
      error: {
        status: 500,
        value: { error: { code: "INTERNAL", message: "x" } },
      },
    });
    const { client, wrapper } = setup([note("n1")], 1);
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("n1").catch(() => undefined);
    });
    expect(readIds(client)).toEqual([]);
    expect(unread(client)).toBe(1);
  });

  it("com o home sem dado (falhou na carga), um erro não apaga a query que o sino observa", async () => {
    postRead.mockResolvedValue({
      data: null,
      error: {
        status: 500,
        value: { error: { code: "INTERNAL", message: "x" } },
      },
    });
    const { client, wrapper } = setup([note("n1")], 1);
    client.removeQueries({ queryKey: queryKeys.home });
    // A home query with no data, as after a failed first load (cold API).
    client.getQueryCache().build(client, { queryKey: queryKeys.home });
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("n1").catch(() => undefined);
    });
    expect(
      client.getQueryCache().find({ queryKey: queryKeys.home })
    ).toBeDefined();
    expect(readIds(client)).toEqual([]);
  });

  it("não desconta de novo um aviso que já estava lido", async () => {
    postRead.mockReturnValue(new Promise(() => undefined));
    const { client, wrapper } = setup(
      [note("n1", "2026-10-02T11:00:00.000Z")],
      1
    );
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    act(() => result.current.mutate("n1"));
    await waitFor(() => expect(postRead).toHaveBeenCalled());
    expect(unread(client)).toBe(1);
  });
});

describe("useMarkAllReadMutation", () => {
  it("marca todas, zera o sino e revalida o home", async () => {
    postReadAll.mockResolvedValue({ data: { ok: true }, error: null });
    const { client, wrapper } = setup([note("n1"), note("n2")], 2);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkAllReadMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(readIds(client)).toEqual(["n1", "n2"]);
    expect(unread(client)).toBe(0);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] });
  });
});
