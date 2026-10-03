import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Home } from "@/features/home/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, installmentAction } from "./home-fixtures";

const { markPaid, dismiss, getHome } = vi.hoisted(() => ({
  markPaid: vi.fn(),
  dismiss: vi.fn(),
  getHome: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      home: { get: () => getHome() },
      installments: () => ({ "mark-paid": { post: () => markPaid() } }),
      me: { onboarding: { dismiss: { post: () => dismiss() } } },
    },
  },
}));

import {
  homeQueryOptions,
  useDismissOnboarding,
  useMarkPaidFromHome,
  useUnreadCount,
} from "../src/features/home/api";

/** Same staleTime as production: only the bell's "always" refetches on focus. */
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Number.POSITIVE_INFINITY,
        staleTime: 60_000,
      },
      mutations: { retry: false },
    },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const refused = {
  data: null,
  error: {
    status: 422,
    value: { error: { code: "VALIDATION", message: "Transição inválida" } },
  },
};

const homeIds = (client: QueryClient) =>
  client.getQueryData<Home>(queryKeys.home)?.actions.map((a) => a.id);

const dismissedAt = (client: QueryClient) =>
  client.getQueryData<Home>(queryKeys.home)?.onboarding.dismissedAt;

function refocus() {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

beforeEach(() => {
  markPaid.mockReset();
  dismiss.mockReset();
  getHome.mockReset();
});

afterEach(() => {
  focusManager.setFocused(undefined);
});

describe("leitura do home com uma escrita otimista em voo", () => {
  it("a aba volta ao foco com a ação em voo: o home revalida, mas o cartão que está saindo não volta", async () => {
    const action = installmentAction();
    const other = installmentAction({ installmentId: "i2" });
    const client = makeClient();
    client.setQueryData(
      queryKeys.home,
      homeFixture({ actions: [action, other] })
    );
    // The server has not seen the payment yet: its read still lists the card.
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [action, other], unreadCount: 4 }),
      error: null,
    });
    const answer = deferred();
    markPaid.mockReturnValue(answer.promise);
    const { result } = renderHook(
      () => ({ count: useUnreadCount(), pay: useMarkPaidFromHome() }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.pay.mutate(action));
    await waitFor(() => expect(homeIds(client)).toEqual([other.id]));
    refocus();
    await waitFor(() => expect(result.current.count).toBe(4));
    expect(getHome).toHaveBeenCalledTimes(1);
    expect(homeIds(client)).toEqual([other.id]);
  });

  it("foco durante o voo e depois a API recusa: o cartão volta uma vez só", async () => {
    const action = installmentAction();
    const client = makeClient();
    client.setQueryData(queryKeys.home, homeFixture({ actions: [action] }));
    getHome.mockResolvedValue({
      data: homeFixture({ actions: [action] }),
      error: null,
    });
    const answer = deferred();
    markPaid.mockReturnValue(answer.promise);
    const { result } = renderHook(
      () => ({ count: useUnreadCount(), pay: useMarkPaidFromHome() }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.pay.mutate(action));
    await waitFor(() => expect(homeIds(client)).toEqual([]));
    refocus();
    await waitFor(() => expect(getHome).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(client.getQueryState(queryKeys.home)?.fetchStatus).toBe("idle")
    );
    expect(homeIds(client)).toEqual([]);
    answer.resolve(refused);
    await waitFor(() => expect(result.current.pay.isError).toBe(true));
    // The last action to settle refetches the home: wait for that read too.
    await waitFor(() => expect(getHome).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(client.getQueryState(queryKeys.home)?.fetchStatus).toBe("idle")
    );
    expect(homeIds(client)).toEqual([action.id]);
  });
});

describe("dispensar o guia", () => {
  it("se a dispensa falha, só o guia volta: o cartão pago enquanto isso continua fora", async () => {
    const action = installmentAction();
    const client = makeClient();
    client.setQueryData(queryKeys.home, homeFixture({ actions: [action] }));
    const dismissAnswer = deferred();
    dismiss.mockReturnValue(dismissAnswer.promise);
    const payAnswer = deferred();
    markPaid.mockReturnValue(payAnswer.promise);
    const { result } = renderHook(
      () => ({ dismiss: useDismissOnboarding(), pay: useMarkPaidFromHome() }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.dismiss.mutate());
    await waitFor(() => expect(dismissedAt(client)).not.toBeNull());
    act(() => result.current.pay.mutate(action));
    await waitFor(() => expect(homeIds(client)).toEqual([]));
    dismissAnswer.resolve(refused);
    await waitFor(() => expect(result.current.dismiss.isError).toBe(true));
    expect(dismissedAt(client)).toBeNull();
    // A snapshot from before the tap would revive the card still in flight.
    expect(homeIds(client)).toEqual([]);
  });

  it("uma leitura com a dispensa em voo mantém o guia dispensado, e só enquanto ela está em voo", async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.home, homeFixture());
    // The server has not recorded the dismissal yet.
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    const answer = deferred();
    dismiss.mockReturnValue(answer.promise);
    const { result } = renderHook(() => useDismissOnboarding(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.mutate());
    await waitFor(() => expect(dismissedAt(client)).not.toBeNull());
    const optimistic = dismissedAt(client);
    await act(() => client.fetchQuery({ ...homeQueryOptions, staleTime: 0 }));
    expect(dismissedAt(client)).toBe(optimistic);
    answer.resolve(refused);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(dismissedAt(client)).toBeNull();
    await act(() => client.fetchQuery({ ...homeQueryOptions, staleTime: 0 }));
    expect(dismissedAt(client)).toBeNull();
  });

  it("sem dispensa em voo, a leitura do servidor manda no guia", async () => {
    const client = makeClient();
    const home = homeFixture();
    client.setQueryData(queryKeys.home, {
      ...home,
      onboarding: {
        ...home.onboarding,
        dismissedAt: "2026-10-01T10:00:00.000Z",
      },
    });
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    await client.fetchQuery({ ...homeQueryOptions, staleTime: 0 });
    expect(dismissedAt(client)).toBeNull();
  });
});
