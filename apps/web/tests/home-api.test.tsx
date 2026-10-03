import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Home } from "@/features/home/types";
import { queryKeys } from "@/lib/query-keys";
import { makeQueryClient } from "../src/lib/query";
import { homeFixture, installmentAction, inviteAction } from "./home-fixtures";

const { markPaid, accept, dismiss, getHome, toastError, hydration } =
  vi.hoisted(() => ({
    markPaid: vi.fn(),
    accept: vi.fn(),
    dismiss: vi.fn(),
    getHome: vi.fn(),
    toastError: vi.fn(),
    // A client render outside hydration is hydrated, like the real hook says.
    hydration: { done: true },
  }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useHydrated: () => hydration.done,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: toastError } }));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      home: { get: () => getHome() },
      installments: () => ({
        "mark-paid": { post: () => markPaid() },
        confirm: { post: () => markPaid() },
      }),
      invites: () => ({
        accept: { post: () => accept() },
        decline: { post: () => accept() },
      }),
      me: { onboarding: { dismiss: { post: () => dismiss() } } },
    },
  },
}));

import {
  homeQueryOptions,
  useAcceptInviteFromHome,
  useDismissOnboarding,
  useMarkPaidFromHome,
} from "../src/features/home/api";
import {
  useMomentMilestone,
  useNavCounts,
  useUnreadCount,
} from "../src/features/home/shell-selectors";

/**
 * These tests seed the cache with no observer on it: the shared test client's
 * gcTime 0 would drop the seeded home before the assertions run.
 */
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

function wrapper(client = makeClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const paidInstallment = {
  id: "i1",
  contractId: "c1",
  sequence: 7,
  amountCents: 125_000,
  dueDate: "2026-10-03",
  status: "paid",
  paidAt: "2026-10-02T12:00:00.000Z",
  confirmedAt: null,
};

const homeIds = (client: QueryClient) =>
  client.getQueryData<Home>(queryKeys.home)?.actions.map((a) => a.id);

beforeEach(() => {
  markPaid.mockReset();
  accept.mockReset();
  dismiss.mockReset();
  getHome.mockReset();
  toastError.mockReset();
});

describe("ações otimistas do home", () => {
  it("Já paguei: a ação sai na hora e a parcela devolvida vai para o contrato e o detalhe em cache", async () => {
    const action = installmentAction();
    const client = makeClient();
    client.setQueryData(
      queryKeys.home,
      homeFixture({ actions: [action, inviteAction()] })
    );
    client.setQueryData(queryKeys.contract("c1"), {
      installments: [
        { id: "i1", status: "pending" },
        { id: "i2", status: "pending" },
      ],
    });
    client.setQueryData(queryKeys.installment("i1"), {
      id: "i1",
      status: "pending",
      proofs: [],
    });
    let answer: (value: unknown) => void = () => undefined;
    markPaid.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      })
    );
    const { result } = renderHook(() => useMarkPaidFromHome(), {
      wrapper: wrapper(client),
    });
    act(() => result.current.mutate(action));
    await waitFor(() => expect(homeIds(client)).toEqual(["invite:tok1"]));
    answer({ data: paidInstallment, error: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      client.getQueryData<{ installments: { id: string; status: string }[] }>(
        queryKeys.contract("c1")
      )?.installments
    ).toEqual([
      { id: "i1", status: "paid" },
      { id: "i2", status: "pending" },
    ]);
    expect(client.getQueryData(queryKeys.installment("i1"))).toEqual({
      id: "i1",
      status: "paid",
      proofs: [],
    });
    expect(client.getMutationCache().getAll()[0]?.meta?.successMessage).toBe(
      "Parcela marcada como paga"
    );
  });

  it("rollback devolve a ação quando a API recusa", async () => {
    const action = installmentAction();
    const client = makeClient();
    client.setQueryData(queryKeys.home, homeFixture({ actions: [action] }));
    markPaid.mockResolvedValue({
      data: null,
      error: {
        status: 422,
        value: { error: { code: "VALIDATION", message: "Transição inválida" } },
      },
    });
    const { result } = renderHook(() => useMarkPaidFromHome(), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync(action).catch(() => undefined);
    });
    expect(homeIds(client)).toEqual([action.id]);
    // The observer re-renders on the notifyManager's next tick, not inside act.
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("duas ações seguidas: só a última a assentar revalida o home", async () => {
    const first = installmentAction();
    const second = installmentAction({ installmentId: "i2" });
    const client = makeClient();
    client.setQueryData(
      queryKeys.home,
      homeFixture({ actions: [first, second] })
    );
    const spy = vi.spyOn(client, "invalidateQueries");
    const answers: ((value: unknown) => void)[] = [];
    markPaid.mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        })
    );
    const { result } = renderHook(
      () => ({ a: useMarkPaidFromHome(), b: useMarkPaidFromHome() }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.a.mutate(first));
    act(() => result.current.b.mutate(second));
    await waitFor(() => expect(answers).toHaveLength(2));
    expect(homeIds(client)).toEqual([]);
    answers[0]?.({ data: paidInstallment, error: null });
    await waitFor(() => expect(result.current.a.isSuccess).toBe(true));
    // A refetch now would bring the second card back while it is still leaving.
    expect(spy).not.toHaveBeenCalledWith({ queryKey: ["home"] });
    answers[1]?.({ data: { ...paidInstallment, id: "i2" }, error: null });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] })
    );
  });

  it("se uma ação falha depois de outra dar certo, só ela volta para a lista", async () => {
    const first = installmentAction();
    const second = installmentAction({ installmentId: "i2" });
    const client = makeClient();
    client.setQueryData(
      queryKeys.home,
      homeFixture({ actions: [first, second] })
    );
    const answers: ((value: unknown) => void)[] = [];
    markPaid.mockImplementation(
      () =>
        new Promise((resolve) => {
          answers.push(resolve);
        })
    );
    const { result } = renderHook(
      () => ({ a: useMarkPaidFromHome(), b: useMarkPaidFromHome() }),
      { wrapper: wrapper(client) }
    );
    act(() => result.current.a.mutate(first));
    act(() => result.current.b.mutate(second));
    await waitFor(() => expect(answers).toHaveLength(2));
    answers[1]?.({ data: { ...paidInstallment, id: "i2" }, error: null });
    await waitFor(() => expect(result.current.b.isSuccess).toBe(true));
    answers[0]?.({
      data: null,
      error: {
        status: 422,
        value: { error: { code: "VALIDATION", message: "Transição inválida" } },
      },
    });
    await waitFor(() => expect(result.current.a.isError).toBe(true));
    // A snapshot from before the second tap would revive the card already paid.
    expect(homeIds(client)).toEqual([first.id]);
  });

  it("Aceitar convite revalida o home e os contratos em segundo plano", async () => {
    const action = inviteAction();
    const client = makeClient();
    client.setQueryData(queryKeys.home, homeFixture({ actions: [action] }));
    const spy = vi.spyOn(client, "invalidateQueries");
    accept.mockResolvedValue({ data: { contractId: "c9" }, error: null });
    const { result } = renderHook(() => useAcceptInviteFromHome(), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync(action);
    });
    expect(homeIds(client)).toEqual([]);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["home"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["contracts"] });
    expect(client.getMutationCache().getAll()[0]?.meta?.successMessage).toBe(
      "Convite aceito"
    );
  });

  it("dispensar o guia some na hora e guarda a hora do servidor", async () => {
    const client = makeClient();
    client.setQueryData(queryKeys.home, homeFixture());
    dismiss.mockResolvedValue({
      data: { dismissedAt: "2026-10-02T10:00:00.000Z" },
      error: null,
    });
    const { result } = renderHook(() => useDismissOnboarding(), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(
      client.getQueryData<Home>(queryKeys.home)?.onboarding.dismissedAt
    ).toBe("2026-10-02T10:00:00.000Z");
  });
});

describe("useUnreadCount", () => {
  it("lê o contador do home", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({ unreadCount: 3 }),
      error: null,
    });
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current).toBe(3));
  });

  it("revalida quando a aba volta ao foco, mesmo com o home ainda fresco", async () => {
    // Same staleTime as production: inside it, `refetchOnWindowFocus: true` would not refetch.
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Number.POSITIVE_INFINITY,
          staleTime: 60_000,
        },
      },
    });
    client.setQueryData(queryKeys.home, homeFixture({ unreadCount: 1 }));
    getHome.mockResolvedValue({
      data: homeFixture({ unreadCount: 2 }),
      error: null,
    });
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: wrapper(client),
    });
    expect(result.current).toBe(1);
    try {
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await waitFor(() => expect(result.current).toBe(2));
      expect(getHome).toHaveBeenCalledTimes(1);
    } finally {
      focusManager.setFocused(undefined);
    }
  });

  it("não derruba o shell quando o home falha", async () => {
    getHome.mockResolvedValue({
      data: null,
      error: {
        status: 503,
        value: { error: { code: "INTERNAL", message: "cold" } },
      },
    });
    // The production client sends every non-401 to the error boundary.
    const client = makeQueryClient();
    client.setDefaultOptions({
      queries: { ...client.getDefaultOptions().queries, retry: false },
    });
    const onBoundaryError = vi.fn();
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
          <ErrorBoundary fallback={null} onError={onBoundaryError}>
            {children}
          </ErrorBoundary>
        </QueryClientProvider>
      ),
    });
    await waitFor(() =>
      expect(client.getQueryState(queryKeys.home)?.status).toBe("error")
    );
    // The observer re-renders with the error on the notifyManager's next tick:
    // that render is the one that would throw to the boundary.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(onBoundaryError).not.toHaveBeenCalled();
    expect(result.current).toBe(0);
  });
});

describe("refetch de fundo do home", () => {
  it("falha sem toast: ele roda a cada foco, em qualquer tela", async () => {
    getHome.mockResolvedValue({
      data: null,
      error: {
        status: 503,
        value: { error: { code: "INTERNAL", message: "cold" } },
      },
    });
    // The production client toasts a failed background refetch with data on screen.
    const client = makeQueryClient();
    client.setQueryData(queryKeys.home, homeFixture());
    await client
      .fetchQuery({ ...homeQueryOptions, staleTime: 0, retry: false })
      .catch(() => undefined);
    expect(client.getQueryState(queryKeys.home)?.status).toBe("error");
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe("useMomentMilestone", () => {
  it("o marco do momento sai do home, como texto para o cartão da sidebar", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        milestones: {
          ...homeFixture().milestones,
          closestToPayoff: {
            contractId: "c3",
            title: "Celular da Ana",
            paidCount: 9,
            totalCount: 10,
            percent: 90,
            remainingCount: 1,
            nextDueDate: "2026-10-13",
          },
        },
      }),
      error: null,
    });
    const { result } = renderHook(() => useMomentMilestone(), {
      wrapper: wrapper(),
    });
    await waitFor(() =>
      expect(result.current).toEqual({
        title: "Mais perto de quitar",
        detail: "Celular da Ana · 9/10",
      })
    );
  });

  it("sem marco não há cartão", async () => {
    const client = makeClient();
    getHome.mockResolvedValue({ data: homeFixture(), error: null });
    const { result } = renderHook(() => useMomentMilestone(), {
      wrapper: wrapper(client),
    });
    await waitFor(() =>
      expect(client.getQueryData(queryKeys.home)).toBeDefined()
    );
    expect(result.current).toBeNull();
  });
});

describe("useNavCounts", () => {
  it("as contagens da sidebar saem do home: ações pendentes e contratos ativos", async () => {
    getHome.mockResolvedValue({
      data: homeFixture({
        actions: [installmentAction(), inviteAction()],
        activeContractsCount: 5,
      }),
      error: null,
    });
    const { result } = renderHook(() => useNavCounts(), { wrapper: wrapper() });
    expect(result.current).toEqual({ contracts: 0, now: 0 });
    await waitFor(() =>
      expect(result.current).toEqual({ contracts: 5, now: 2 })
    );
  });
});

describe("passada de hidratação", () => {
  it("antes de hidratar, o shell não mostra nada do home, nem com ele já em cache (o HTML do servidor não tem)", () => {
    const client = makeClient();
    client.setQueryData(
      queryKeys.home,
      homeFixture({
        unreadCount: 3,
        actions: [installmentAction()],
        activeContractsCount: 2,
        milestones: {
          ...homeFixture().milestones,
          previousMonthAllClear: { month: "2026-09", paidCount: 12 },
        },
      })
    );
    hydration.done = false;
    try {
      const { result, rerender } = renderHook(
        () => ({
          counts: useNavCounts(),
          moment: useMomentMilestone(),
          unread: useUnreadCount(),
        }),
        { wrapper: wrapper(client) }
      );
      expect(result.current).toEqual({
        counts: { contracts: 0, now: 0 },
        moment: null,
        unread: 0,
      });
      // Hydrated, the same cache shows: the gate is what hid it.
      hydration.done = true;
      rerender();
      expect(result.current).toEqual({
        counts: { contracts: 2, now: 1 },
        moment: {
          title: "Tudo em dia em setembro",
          detail: "12 de 12 parcelas quitadas",
        },
        unread: 3,
      });
    } finally {
      hydration.done = true;
    }
  });
});
