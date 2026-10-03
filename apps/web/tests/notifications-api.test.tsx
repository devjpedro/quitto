import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Home, HomeAction } from "@/features/home/types";
import type { NotificationItem } from "@/features/notifications/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, installmentAction } from "./home-fixtures";
import { notificationItem } from "./notification-fixtures";

const { getHome, postRead, postReadAll } = vi.hoisted(() => ({
  getHome: vi.fn(),
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
  return { api: { api: { notifications, home: { get: () => getHome() } } } };
});

import { homeQueryOptions } from "../src/features/home/api";
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
} from "../src/features/notifications/api";

const SERVER_ERROR = {
  data: null,
  error: { status: 500, value: { error: { code: "INTERNAL", message: "x" } } },
};

/** A request that answers only when the test says so. */
function deferred() {
  let answer: (value: unknown) => void = () => undefined;
  const promise = new Promise((resolve) => {
    answer = resolve;
  });
  return { answer, promise };
}

function note(id: string, readAt: string | null = null): NotificationItem {
  return notificationItem({
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
  });
}

function setup(
  items: NotificationItem[],
  unreadCount: number,
  actions: HomeAction[] = []
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  client.setQueryData(queryKeys.notifications, items);
  client.setQueryData(queryKeys.home, homeFixture({ unreadCount, actions }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

const unread = (client: QueryClient) =>
  client.getQueryData<Home>(queryKeys.home)?.unreadCount;
const actionIds = (client: QueryClient) =>
  client.getQueryData<Home>(queryKeys.home)?.actions.map((a) => a.id);
/** Another tap (e.g. "Já paguei") took every action out of the home meanwhile. */
const clearActions = (client: QueryClient) =>
  client.setQueryData<Home>(
    queryKeys.home,
    (home) => home && { ...home, actions: [] }
  );
const readIds = (client: QueryClient) =>
  client
    .getQueryData<NotificationItem[]>(queryKeys.notifications)
    ?.filter((n) => n.readAt !== null)
    .map((n) => n.id);

beforeEach(() => {
  getHome.mockReset();
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

  it("a falha devolve só o contador e a linha, nunca uma ação que saiu enquanto isso", async () => {
    const request = deferred();
    postRead.mockReturnValue(request.promise);
    const { client, wrapper } = setup([note("n1")], 1, [installmentAction()]);
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    act(() => result.current.mutate("n1"));
    await waitFor(() => expect(unread(client)).toBe(0));
    clearActions(client);
    await act(async () => {
      request.answer(SERVER_ERROR);
      await request.promise;
    });
    await waitFor(() => expect(readIds(client)).toEqual([]));
    expect(unread(client)).toBe(1);
    expect(actionIds(client)).toEqual([]);
  });

  it("uma leitura que falha não desfaz outra que deu certo", async () => {
    const first = deferred();
    postRead
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ data: { ok: true }, error: null });
    const { client, wrapper } = setup([note("n1"), note("n2")], 2);
    const { result } = renderHook(
      () => ({ one: useMarkReadMutation(), two: useMarkReadMutation() }),
      { wrapper }
    );
    act(() => result.current.one.mutate("n1"));
    await waitFor(() => expect(readIds(client)).toEqual(["n1"]));
    await act(async () => {
      await result.current.two.mutateAsync("n2");
    });
    await act(async () => {
      first.answer(SERVER_ERROR);
      await first.promise;
    });
    await waitFor(() => expect(readIds(client)).toEqual(["n2"]));
    expect(unread(client)).toBe(1);
  });

  it("se a API falhar, a lista é revalidada", async () => {
    postRead.mockResolvedValue(SERVER_ERROR);
    const { client, wrapper } = setup([note("n1")], 1);
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("n1").catch(() => undefined);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
  });

  it("um refetch do home com a leitura em voo não desfaz o contador otimista", async () => {
    postRead.mockReturnValue(new Promise(() => undefined));
    // The server has not applied the read yet.
    getHome.mockResolvedValue({
      data: homeFixture({ unreadCount: 2 }),
      error: null,
    });
    const { client, wrapper } = setup([note("n1"), note("n2")], 2);
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper });
    act(() => result.current.mutate("n1"));
    await waitFor(() => expect(unread(client)).toBe(1));
    await act(async () => {
      await client.fetchQuery({ ...homeQueryOptions, staleTime: 0 });
    });
    expect(unread(client)).toBe(1);
  });

  it("sem leitura em voo, o contador é o do servidor", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({ unreadCount: 5 }),
      error: null,
    });
    const { client } = setup([note("n1")], 1);
    await act(async () => {
      await client.fetchQuery({ ...homeQueryOptions, staleTime: 0 });
    });
    expect(unread(client)).toBe(5);
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

  it("se a API falhar, volta as linhas e o contador, sem ressuscitar uma ação que saiu enquanto isso", async () => {
    const request = deferred();
    postReadAll.mockReturnValue(request.promise);
    const { client, wrapper } = setup(
      [note("n1"), note("n2"), note("n3", "2026-10-02T09:00:00.000Z")],
      2,
      [installmentAction()]
    );
    const { result } = renderHook(() => useMarkAllReadMutation(), { wrapper });
    act(() => result.current.mutate());
    await waitFor(() => expect(unread(client)).toBe(0));
    expect(readIds(client)).toEqual(["n1", "n2", "n3"]);
    clearActions(client);
    await act(async () => {
      request.answer(SERVER_ERROR);
      await request.promise;
    });
    await waitFor(() => expect(readIds(client)).toEqual(["n3"]));
    expect(unread(client)).toBe(2);
    expect(actionIds(client)).toEqual([]);
  });

  it("um refetch do home com o marcar todas em voo mantém o sino zerado", async () => {
    postReadAll.mockReturnValue(new Promise(() => undefined));
    getHome.mockResolvedValue({
      data: homeFixture({ unreadCount: 2 }),
      error: null,
    });
    const { client, wrapper } = setup([note("n1"), note("n2")], 2);
    const { result } = renderHook(() => useMarkAllReadMutation(), { wrapper });
    act(() => result.current.mutate());
    await waitFor(() => expect(unread(client)).toBe(0));
    await act(async () => {
      await client.fetchQuery({ ...homeQueryOptions, staleTime: 0 });
    });
    expect(unread(client)).toBe(0);
  });
});
