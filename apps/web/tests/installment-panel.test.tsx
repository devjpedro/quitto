import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPage } from "@/features/contracts/components/contract-page";
import { CONTRACT_SLOTS } from "@/features/contracts/components/contract-slots";
import type { ContractDetail } from "@/features/contracts/types";
import type { InstallmentDetail } from "@/features/installments/types";
import { ACTION_LOCK_MS } from "@/hooks/use-action-lock";
import { queryKeys } from "@/lib/query-keys";
import { installmentDetail, motoDetail } from "./contract-fixtures";
import { makeTestQueryClient, renderWithProviders } from "./test-utils";

type Search = Record<string, unknown>;
interface Answer {
  data: unknown;
  error: unknown;
}

const { hydration, navigate, router, served, calls } = vi.hoisted(() => {
  let search: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  return {
    hydration: { done: true },
    navigate: vi.fn(),
    router: {
      get: () => search,
      set: (next: Record<string, unknown>) => {
        search = next;
        for (const listener of listeners) {
          listener();
        }
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    served: {
      contract: null as unknown,
      details: {} as Record<string, unknown>,
    },
    calls: {
      confirm: vi.fn(),
      dispute: vi.fn(),
      patch: vi.fn(),
      share: vi.fn(),
    },
  };
});

// The page loads the panel on demand; these tests open it at once.
vi.mock(
  "@/features/installments/components/lazy-installment-panel-host",
  async () => ({
    InstallmentPanelHost: (
      await import("@/features/installments/components/installment-panel-host")
    ).InstallmentPanelHost,
  })
);

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        get: () => Promise.resolve({ data: served.contract, error: null }),
        installments: ({ installmentId }: { installmentId: string }) => ({
          patch: (body: unknown) => calls.patch(installmentId, body),
        }),
      }),
      installments: ({ installmentId }: { installmentId: string }) => ({
        get: () =>
          Promise.resolve({
            data: served.details[installmentId] ?? null,
            error: null,
          }),
        confirm: { post: () => calls.confirm(installmentId) },
        dispute: {
          post: (body: { reason: string }) =>
            calls.dispute(installmentId, body),
        },
        "receipt-share": { post: () => calls.share(installmentId) },
      }),
    },
  },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const { useSyncExternalStore } = await import("react");
  const staticRouter = {
    state: { location: { state: {} } },
    history: { back: vi.fn() },
    subscribe: () => () => undefined,
  };
  return {
    ...(await importOriginal<typeof import("@tanstack/react-router")>()),
    Link: ({ children, className, to }: LinkProps) => (
      <a className={className} href={to}>
        {children}
      </a>
    ),
    useHydrated: () => hydration.done,
    useNavigate: () => navigate,
    useParams: () => ({ id: "c-moto" }),
    // The contract's entry, as the router keeps it (no panel pushed by the list).
    useRouter: () => staticRouter,
    useSearch: () => useSyncExternalStore(router.subscribe, router.get),
  };
});

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

const WEEKDAY_LONG = /quarta-feira|30 de setembro/i;
const ACTION_NAMES =
  /Confirmar|Contestar|Compartilhar|Enviar|Marcar|Cobrar|Editar/;
const WHATSAPP = /WhatsApp/;

/** Every installment the panel may open: the ones a test names, then plain open ones. */
function detailFor(contract: ContractDetail, id: string): InstallmentDetail {
  const it = contract.installments.find((i) => i.id === id);
  return installmentDetail({
    id,
    sequence: it?.sequence ?? 0,
    dueDate: it?.dueDate ?? "2026-10-30",
    status: it?.status ?? "pending",
    proofs: [],
    events: [],
  });
}

function renderPage({
  contract = motoDetail(),
  details = {},
  installment = "i4",
  width = 1600,
}: {
  contract?: ContractDetail;
  details?: Record<string, InstallmentDetail>;
  installment?: string | null;
  width?: number;
} = {}) {
  window.innerWidth = width;
  served.contract = contract;
  served.details = {
    ...Object.fromEntries(
      contract.installments.map((it) => [it.id, detailFor(contract, it.id)])
    ),
    i4: installmentDetail(),
    ...details,
  };
  router.set(installment ? { installment } : {});
  const client = makeTestQueryClient();
  // Held as on the page (the test client's gcTime 0 would drop them, and the
  // neighbours' prefetch would vanish before it is read).
  client.setQueryDefaults(["contract"], { gcTime: Number.POSITIVE_INFINITY });
  client.setQueryDefaults(["installment"], {
    gcTime: Number.POSITIVE_INFINITY,
  });
  client.setQueryData(queryKeys.contract("c-moto"), contract);
  for (const [id, detail] of Object.entries(served.details)) {
    if (id === installment) {
      client.setQueryData(queryKeys.installment(id), detail);
    }
  }
  const utils = renderWithProviders(<ContractPage slots={CONTRACT_SLOTS} />, {
    client,
  });
  return { ...utils, client };
}

const panel = () => screen.getByTestId("installment-panel");
const row = (id: string) =>
  document.querySelector(`[data-installment-row="${id}"]`) as HTMLElement;

function paidDetail(over: Partial<InstallmentDetail> = {}): InstallmentDetail {
  return installmentDetail({
    id: "i2",
    sequence: 2,
    dueDate: "2026-07-30",
    status: "confirmed",
    paidAt: "2026-07-31T12:12:00.000Z",
    confirmedAt: "2026-07-31T12:12:00.000Z",
    proofs: [],
    events: [],
    ...over,
  });
}

/** A promise the test settles by hand: the moment between the tap and the answer. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-05T15:00:00Z"), toFake: ["Date"] });
  hydration.done = true;
  navigate.mockReset();
  navigate.mockImplementation(
    (options: { search: Search | ((prev: Search) => Search) }) => {
      // The panel's own navigations edit the search; the receipt's goes to another page.
      if (typeof options.search === "function") {
        router.set(options.search(router.get()));
      }
      return Promise.resolve();
    }
  );
  for (const call of Object.values(calls)) {
    call.mockReset();
  }
  toastSuccess.mockReset();
});

afterEach(async () => {
  // A sheet gives the focus back in a timeout (Radix) when it unmounts: let
  // it run here, not on the next test's page.
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.useRealTimers();
  window.innerWidth = 1024;
});

const SENT_BY = /enviado por/;

describe("InstallmentPanel (mockup 14 enxuto, quadro G)", () => {
  it("a 1600 px: a coluna fixa (installment-panel-docked), sem diálogo; a 1024: o sheet lateral com o título do contrato na descrição; a 390: o bottom sheet", () => {
    const wide = renderPage({ width: 1600 });
    expect(
      within(screen.getByTestId("installment-panel-docked")).getByTestId(
        "installment-panel"
      )
    ).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Parcela 4 de 10" })
    ).toBeVisible();
    wide.unmount();

    const side = renderPage({ width: 1024 });
    const floating = screen.getByRole("dialog", { name: "Parcela 4 de 10" });
    expect(floating).toHaveAccessibleDescription("Moto do Rafa");
    expect(floating).toHaveAttribute("data-variant", "side");
    expect(screen.queryByTestId("installment-panel-docked")).toBeNull();
    side.unmount();

    renderPage({ width: 390 });
    expect(
      screen.getByRole("dialog", { name: "Parcela 4 de 10" })
    ).toHaveAttribute("data-variant", "bottom");
  });

  it("o topo é o valor e a trilha: nenhuma tag e nenhuma data por extenso ('Venceu quarta-feira…' não aparece)", () => {
    renderPage();
    const body = within(panel());
    expect(body.getByText("R$ 480,00")).toBeInTheDocument();
    const trail = screen.getByRole("list", { name: "Estado da parcela" });
    const steps = within(trail).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "A receber venceu 30/09",
      "Comprovante ontem, 10:00",
      "Confirmada falta você",
    ]);
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(body.queryByText(WEEKDAY_LONG)).toBeNull();
    // The list's tag for this line stays in the list.
    expect(body.queryByText("Conferir comprovante")).toBeNull();
  });

  it("↑ e ↓ trocam a parcela pela URL com replace; na primeira, ↑ fica desabilitado", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Próxima parcela" }));
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ replace: true, resetScroll: false })
    );
    expect(router.get()).toEqual({ installment: "i5" });
    await user.click(
      await screen.findByRole("button", { name: "Parcela anterior" })
    );
    expect(router.get()).toEqual({ installment: "i4" });

    act(() => router.set({ installment: "i1" }));
    expect(
      await screen.findByRole("heading", { name: "Parcela 1 de 10" })
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Parcela anterior" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Próxima parcela" })
    ).toBeEnabled();
  });

  it("a 1024, ↓ duas vezes anda duas parcelas e o dialog é o mesmo elemento (não fecha nem reanima)", async () => {
    const user = userEvent.setup();
    renderPage({ width: 1024 });
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    );
    await user.keyboard("{ArrowDown}");
    expect(router.get()).toEqual({ installment: "i5" });
    await user.keyboard("{ArrowDown}");
    expect(router.get()).toEqual({ installment: "i6" });
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(dialog).toHaveAccessibleName("Parcela 6 de 10");
  });

  it("a 1600, Enter na linha leva o foco ao título do painel; ↓ ↓ anda duas vezes; Esc fecha e devolve o foco à linha", async () => {
    const user = userEvent.setup();
    renderPage({ installment: null });
    row("i4").focus();
    await user.keyboard("{Enter}");
    const title = await screen.findByRole("heading", {
      name: "Parcela 4 de 10",
    });
    await waitFor(() => expect(title).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Parcela 5 de 10" })
      ).toHaveFocus()
    );
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Parcela 6 de 10" })
      ).toHaveFocus()
    );

    await user.keyboard("{Escape}");
    expect(router.get()).toEqual({ installment: undefined });
    expect(screen.queryByTestId("installment-panel")).toBeNull();
    await waitFor(() => expect(row("i6")).toHaveFocus());
  });

  it("a 390, 'Histórico' no pé do sheet fecha o sheet e mostra a aba Histórico (não a troca atrás do sheet), e o foco cai no 'Histórico' das abas", async () => {
    const user = userEvent.setup();
    renderPage({ installment: null, width: 390 });
    await user.click(row("i4"));
    const sheet = await screen.findByRole("dialog", {
      name: "Parcela 4 de 10",
    });
    await user.click(within(sheet).getByRole("button", { name: "Histórico" }));
    expect(router.get()).toEqual({ installment: undefined, tab: "history" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Histórico" })).toHaveFocus()
    );
  });

  it("a 1600, 'Histórico' no pé da coluna troca a aba e a coluna fica ao lado", async () => {
    const user = userEvent.setup();
    renderPage({ width: 1600 });
    await user.click(
      within(panel()).getByRole("button", { name: "Histórico" })
    );
    expect(router.get()).toEqual({ installment: "i4", tab: "history" });
    expect(screen.getByTestId("installment-panel-docked")).toBeVisible();
  });

  it("Esc numa parcela na URL devolve o foco à linha dela (a linha sai com o painel)", async () => {
    const user = userEvent.setup();
    renderPage({ installment: "i1" });
    const title = await screen.findByRole("heading", {
      name: "Parcela 1 de 10",
    });
    // A page that loads with the panel open leaves the focus where it starts.
    expect(title).not.toHaveFocus();
    act(() => title.focus());
    await user.keyboard("{Escape}");
    const line = document.querySelector('[data-installment-row="i1"]');
    expect(line).not.toBeNull();
    await waitFor(() => expect(line).toHaveFocus());
  });

  it("a 1600, Enter em 'Confirmar recebimento' troca os blocos e o foco fica na coluna (no título), não no body: ↓ leva à parcela 5", async () => {
    const user = userEvent.setup();
    calls.confirm.mockReturnValue(deferred<Answer>().promise);
    renderPage();
    const docked = screen.getByTestId("installment-panel-docked");
    act(() =>
      screen.getByRole("button", { name: "Confirmar recebimento" }).focus()
    );
    await user.keyboard("{Enter}");
    expect(await screen.findByTestId("receipt-block")).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Parcela 4 de 10" })
      ).toHaveFocus()
    );
    expect(docked).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard("{ArrowDown}");
    expect(router.get()).toEqual({ installment: "i5" });
  });

  it("a 1600, 'Cancelar' a contestação devolve o foco ao 'Contestar' e Esc ainda fecha; a contestação enviada deixa o foco na coluna e ↓ anda", async () => {
    const user = userEvent.setup();
    calls.dispute.mockResolvedValue({
      data: { id: "i4", status: "disputed", paidAt: null, confirmedAt: null },
      error: null,
    });
    renderPage();
    const docked = screen.getByTestId("installment-panel-docked");
    await user.click(screen.getByRole("button", { name: "Contestar" }));
    act(() => screen.getByRole("button", { name: "Cancelar" }).focus());
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Contestar" })).toHaveFocus()
    );

    await user.click(screen.getByRole("button", { name: "Contestar" }));
    await user.type(
      screen.getByRole("textbox", { name: "Por que você está contestando?" }),
      "O valor que chegou foi R$ 240,00."
    );
    act(() =>
      screen.getByRole("button", { name: "Enviar contestação" }).focus()
    );
    await user.keyboard("{Enter}");
    await waitFor(() => expect(calls.dispute).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    await waitFor(() =>
      expect(docked).toContainElement(document.activeElement as HTMLElement)
    );
    await user.keyboard("{ArrowDown}");
    expect(router.get()).toEqual({ installment: "i5" });

    await user.keyboard("{Escape}");
    expect(router.get()).toEqual({ installment: undefined });
  });

  it("ao abrir, as vizinhas são pré-buscadas (a parcela anterior e a próxima entram no cache do QueryClient)", async () => {
    const { client } = renderPage();
    await waitFor(() => {
      expect(client.getQueryData(queryKeys.installment("i3"))).toMatchObject({
        id: "i3",
      });
      expect(client.getQueryData(queryKeys.installment("i5"))).toMatchObject({
        id: "i5",
      });
    });
  });

  it("Abrir mostra o comprovante num visualizador dentro do app: nome, tamanho, quem enviou, Baixar; Esc fecha e o foco volta ao Abrir", async () => {
    const user = userEvent.setup();
    renderPage();
    const open = within(screen.getByTestId("proof-preview")).getByRole(
      "button",
      { name: "Abrir" }
    );
    expect(
      screen
        .getByTestId("proof-preview")
        .querySelector(
          'a[href="https://files.quitto.test/pix-moto-outubro.pdf"]'
        )
    ).toHaveAttribute("target", "_blank");
    await user.click(open);
    const viewer = await screen.findByRole("dialog", {
      name: "pix-moto-outubro.pdf",
    });
    expect(viewer).toHaveAccessibleDescription(SENT_BY);
    // The header's "Baixar" (jsdom also draws the object's fallback, which a browser with a PDF viewer hides).
    expect(
      within(viewer).getAllByRole("link", { name: "Baixar" })[0]
    ).toHaveAttribute("href", "https://files.quitto.test/pix-moto-outubro.pdf");
    // The file lives on another origin: "Baixar" opens a tab, it never takes the app's own away.
    expect(
      within(viewer).getAllByRole("link", { name: "Baixar" })[0]
    ).toHaveAttribute("target", "_blank");
    expect(
      viewer.querySelector('object[type="application/pdf"]')
    ).not.toBeNull();
    // Esc closes the viewer only: the installment's panel stays.
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "pix-moto-outubro.pdf" })
      ).toBeNull()
    );
    expect(screen.getByTestId("proof-preview")).toBeVisible();
    await waitFor(() => expect(open).toHaveFocus());
  });

  it("o X do visualizador também fecha, e sem leitor de PDF no navegador aparece o aviso com Baixar", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", { ...navigator, pdfViewerEnabled: false });
    renderPage();
    await user.click(
      within(screen.getByTestId("proof-preview")).getByRole("button", {
        name: "Abrir",
      })
    );
    const viewer = await screen.findByRole("dialog", {
      name: "pix-moto-outubro.pdf",
    });
    expect(
      within(viewer).getByText("Não deu para mostrar o PDF aqui")
    ).toBeVisible();
    expect(viewer.querySelector("object")).toBeNull();
    await user.click(within(viewer).getByRole("button", { name: "Fechar" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "pix-moto-outubro.pdf" })
      ).toBeNull()
    );
    vi.unstubAllGlobals();
  });

  it("antes da hidratação (o HTML do servidor), a prévia do comprovante é só a linha do arquivo, sem iframe nem img", () => {
    hydration.done = false;
    renderPage();
    const preview = screen.getByTestId("proof-preview");
    expect(within(preview).getByText("pix-moto-outubro.pdf")).toBeVisible();
    expect(preview.querySelector("iframe, img")).toBeNull();
  });

  it("P4: a prévia do PDF num iframe no desktop e o cartão com Abrir no bottom sheet; 'Confirmar recebimento' marca na hora e volta se a API recusar", async () => {
    const user = userEvent.setup();
    const wide = renderPage();
    const preview = screen.getByTestId("proof-preview");
    expect(preview.querySelector("iframe")).toHaveAttribute(
      "title",
      "pix-moto-outubro.pdf"
    );
    expect(
      within(preview).getByText("184 KB · enviado por Rafael")
    ).toBeVisible();

    const answer = deferred<Answer>();
    calls.confirm.mockReturnValue(answer.promise);
    await user.click(
      screen.getByRole("button", { name: "Confirmar recebimento" })
    );
    expect(calls.confirm).toHaveBeenCalledWith("i4");
    // At once: the receipt instead of the review.
    expect(await screen.findByTestId("receipt-block")).toBeVisible();
    expect(screen.queryByTestId("proof-preview")).toBeNull();
    await act(async () => {
      answer.resolve({
        data: null,
        error: {
          status: 422,
          value: { error: { code: "INVALID_STATE", message: "Não deu." } },
        },
      });
      await answer.promise;
    });
    expect(await screen.findByTestId("proof-preview")).toBeVisible();
    expect(screen.queryByTestId("receipt-block")).toBeNull();
    wide.unmount();

    renderPage({ width: 390 });
    const card = screen.getByTestId("proof-preview");
    expect(card.querySelector("iframe")).toBeNull();
    // "Abrir" opens the viewer inside the app (no link, no new tab).
    expect(within(card).queryByRole("link", { name: "Abrir" })).toBeNull();
    expect(within(card).getByRole("button", { name: "Abrir" })).toBeVisible();
    // The bottom sheet pins the confirm in its footer; the block keeps "Contestar".
    expect(
      screen.getAllByRole("button", { name: "Confirmar recebimento" })
    ).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Contestar" })).toBeVisible();
  });

  it("a 390, o sheet fechado zera o painel: contestar, Esc e reabrir a mesma parcela não traz o formulário de volta", async () => {
    const user = userEvent.setup();
    renderPage({ installment: null, width: 390 });
    await user.click(row("i4"));
    await user.click(await screen.findByRole("button", { name: "Contestar" }));
    expect(
      screen.getByRole("textbox", { name: "Por que você está contestando?" })
    ).toBeVisible();
    await user.keyboard("{Escape}");
    expect(router.get()).toEqual({ installment: undefined });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(row("i4"));
    expect(
      await screen.findByRole("dialog", { name: "Parcela 4 de 10" })
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Contestar" })).toBeVisible();
  });

  it("a 390, o duplo toque no rodapé: o 2º toque cai no 'Abrir recibo' que tomou o lugar do 'Confirmar recebimento' e não cria o link; passada a trava, o mesmo botão cria e abre", async () => {
    const user = userEvent.setup();
    calls.confirm.mockReturnValue(deferred<Answer>().promise);
    calls.share.mockResolvedValue({
      data: { token: "7fQ2kX9mVb", createdAt: "2026-10-05T15:00:00.000Z" },
      error: null,
    });
    renderPage({ width: 390 });
    await user.click(
      screen.getByRole("button", { name: "Confirmar recebimento" })
    );
    // The optimistic confirm swaps the footer's button in place.
    const open = await screen.findByRole("button", { name: "Abrir recibo" });
    await user.click(open);
    expect(calls.confirm).toHaveBeenCalledTimes(1);
    expect(calls.share).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + ACTION_LOCK_MS);
    await user.click(open);
    await waitFor(() => expect(calls.share).toHaveBeenCalledTimes(1));
  });

  it("contestar: o campo com o contador 0/500, a dica 'Rafael vê o motivo.', motivo vazio não envia, com motivo chama a contestação", async () => {
    const user = userEvent.setup();
    calls.dispute.mockResolvedValue({
      data: { id: "i4", status: "disputed", paidAt: null, confirmedAt: null },
      error: null,
    });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Contestar" }));
    const field = screen.getByRole("textbox", {
      name: "Por que você está contestando?",
    });
    expect(field).toHaveFocus();
    expect(screen.getByText("0/500")).toBeVisible();
    expect(screen.getByText("Rafael vê o motivo.")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Enviar contestação" })
    );
    expect(screen.getByText("Diga o motivo.")).toBeVisible();
    expect(calls.dispute).not.toHaveBeenCalled();

    await user.type(field, "O valor que chegou foi R$ 240,00.");
    expect(screen.getByText("33/500")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Enviar contestação" })
    );
    expect(calls.dispute).toHaveBeenCalledWith("i4", {
      reason: "O valor que chegou foi R$ 240,00.",
    });
  });

  it("P5 (dono): 'Abrir recibo' cria o link e abre a página em outra aba; com o link feito é um <a target=_blank>; dois botões, sem Copiar, compartilhar nem WhatsApp", async () => {
    const user = userEvent.setup();
    calls.share.mockResolvedValue({
      data: { token: "7fQ2kX9mVb", createdAt: "2026-10-05T15:00:00.000Z" },
      error: null,
    });
    const tab = { close: vi.fn(), location: { href: "" }, opener: {} };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as never);
    const first = renderPage({
      installment: "i2",
      details: { i2: paidDetail() },
    });
    const block = within(screen.getByTestId("receipt-block"));
    expect(block.getByText("Recibo da parcela 2")).toBeVisible();
    for (const name of [
      "Compartilhar recibo",
      "Copiar link do recibo",
      "Copiar o link do recibo",
    ]) {
      expect(block.queryByRole("button", { name })).toBeNull();
    }
    expect(block.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      "/api/installments/i2/receipt.pdf"
    );
    expect(block.queryByRole("button", { name: WHATSAPP })).toBeNull();
    await user.click(block.getByRole("button", { name: "Abrir recibo" }));
    // The window opens in the tap, blank, and goes to the link once it exists.
    expect(open).toHaveBeenCalledWith("", "_blank");
    await waitFor(() =>
      expect(tab.location.href).toBe("http://localhost:3000/r/7fQ2kX9mVb")
    );
    expect(tab.opener).toBeNull();
    expect(tab.close).not.toHaveBeenCalled();
    expect(calls.share).toHaveBeenCalledTimes(1);
    first.unmount();

    // With the link made, "Abrir recibo" is a plain link, and creates nothing.
    calls.share.mockClear();
    open.mockClear();
    vi.setSystemTime(Date.now() + ACTION_LOCK_MS);
    renderPage({
      installment: "i2",
      details: {
        i2: paidDetail({
          receiptShare: { url: "http://localhost:3001/r/7fQ2kX9mVb" },
        }),
      },
    });
    const linked = within(screen.getByTestId("receipt-block"));
    const anchor = linked.getByRole("link", { name: "Abrir recibo" });
    expect(anchor).toHaveAttribute(
      "href",
      "http://localhost:3001/r/7fQ2kX9mVb"
    );
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    expect(calls.share).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it("parcela paga: o dono não vê 'Editar valor ou data'", () => {
    renderPage({ installment: "i2", details: { i2: paidDetail() } });
    expect(
      screen.queryByRole("button", { name: "Editar valor ou data" })
    ).toBeNull();
  });

  it("P5 (quem não é dono): sem 'Abrir recibo' (não cria link); só Baixar PDF, sem a linha do link", () => {
    renderPage({
      contract: motoDetail({
        role: "buyer",
        isOwner: false,
        isPayer: true,
        isApprover: false,
      }),
      installment: "i2",
      details: {
        i2: paidDetail({
          receiptShare: { url: "http://localhost:3001/r/7fQ2kX9mVb" },
        }),
      },
    });
    const block = within(screen.getByTestId("receipt-block"));
    expect(block.queryByRole("button", { name: "Abrir recibo" })).toBeNull();
    expect(block.getByRole("link", { name: "Baixar PDF" })).toBeVisible();
    expect(block.queryByText("localhost:3001/r/7fQ2kX9mVb")).toBeNull();
    // Nor does whoever is not the owner edit the installment.
    expect(
      screen.queryByRole("button", { name: "Editar valor ou data" })
    ).toBeNull();
  });

  it("P5 do dono que recebe de quem não tem conta: o mesmo 'Abrir recibo' (sem WhatsApp, sem PDF), com o link, dos dois lados; no celular o rodapé o fixa e o bloco não o repete", () => {
    const base = motoDetail();
    const noAccount = motoDetail({
      participants: base.participants.map((p) =>
        p.role === "buyer"
          ? { ...p, displayName: "Pedro Alves", linked: false }
          : p
      ),
    });
    const shared = {
      i2: paidDetail({
        receiptShare: { url: "http://localhost:3001/r/7fQ2kX9mVb" },
      }),
    };
    const receiving = renderPage({
      contract: noAccount,
      installment: "i2",
      details: shared,
    });
    let block = within(screen.getByTestId("receipt-block"));
    expect(block.getByRole("link", { name: "Abrir recibo" })).toBeVisible();
    expect(block.queryByRole("link", { name: WHATSAPP })).toBeNull();
    expect(block.queryByRole("button", { name: WHATSAPP })).toBeNull();
    expect(block.queryByRole("link", { name: "PDF" })).toBeNull();
    receiving.unmount();

    const paying = renderPage({
      contract: motoDetail({
        role: "buyer",
        isOwner: true,
        isPayer: true,
        isApprover: false,
      }),
      installment: "i2",
      details: shared,
    });
    block = within(screen.getByTestId("receipt-block"));
    expect(block.getByRole("link", { name: "Abrir recibo" })).toBeVisible();
    expect(block.queryByRole("link", { name: "Recibo em PDF" })).toBeNull();
    paying.unmount();

    renderPage({ installment: "i2", details: shared, width: 390 });
    block = within(screen.getByTestId("receipt-block"));
    expect(block.queryByRole("link", { name: "Abrir recibo" })).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir recibo" })).toBeVisible();
  });

  it("P6 (quem paga): o bloco danger com o rosto de quem contestou, o motivo entre aspas e o envio riscado", () => {
    const reason = "Esse comprovante é o da parcela 1. Pode mandar o de julho?";
    renderPage({
      contract: motoDetail({
        role: "buyer",
        isOwner: false,
        isPayer: true,
        isApprover: false,
      }),
      installment: "i2",
      details: {
        i2: paidDetail({
          status: "disputed",
          paidAt: null,
          confirmedAt: null,
          dispute: {
            reason,
            byName: "João Souza",
            byMe: false,
            at: "2026-10-06T00:05:00.000Z",
          },
          proofs: [
            {
              ...installmentDetail().proofs[0],
              id: "pf-2",
              fileName: "comprovante-junho.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 1_003_520,
              uploadedByName: "Rafael Prado",
              uploadedByMe: true,
              state: "disputed",
              disputeReason: reason,
            } as InstallmentDetail["proofs"][number],
          ],
        }),
      },
    });
    const dispute = within(screen.getByTestId("dispute-block"));
    expect(dispute.getByText("JS")).toBeInTheDocument();
    expect(dispute.getByText("João Souza contestou")).toBeVisible();
    expect(dispute.getByText("hoje às 21:05")).toBeVisible();
    expect(dispute.getByText(`“${reason}”`)).toBeVisible();
    const body = within(panel());
    expect(body.getByRole("heading", { name: "Seu envio" })).toBeVisible();
    const sent = body.getByRole("link", { name: "comprovante-junho.jpg" });
    expect(sent.parentElement).toHaveClass("line-through");
    // The reason is said once: in the dispute, not again under the file.
    expect(body.getAllByText(`“${reason}”`)).toHaveLength(1);
  });

  it("Editar valor ou data (o dono): o valor e o vencimento de agora, e só o que mudou vai para a API", async () => {
    const user = userEvent.setup();
    calls.patch.mockResolvedValue({ data: { id: "i4" }, error: null });
    renderPage();
    await user.click(
      screen.getByRole("button", { name: "Editar valor ou data" })
    );
    const dialog = within(
      screen.getByRole("dialog", { name: "Editar valor ou data" })
    );
    const amount = dialog.getByRole("textbox", { name: "Valor" });
    expect(amount).toHaveValue("R$ 480,00");
    expect(dialog.getByRole("textbox", { name: "Vencimento" })).toHaveValue(
      "30/09/2026"
    );
    await user.clear(amount);
    await user.type(amount, "500,00");
    await user.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(calls.patch).toHaveBeenCalledWith("i4", { amountCents: 50_000 })
    );
  });

  it("espectador: nenhum botão de ação no painel", () => {
    renderPage({
      contract: motoDetail({
        role: "viewer",
        isOwner: false,
        isPayer: false,
        isApprover: false,
      }),
    });
    const body = within(panel());
    expect(screen.getByTestId("proof-preview")).toBeVisible();
    const names = body
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names.filter((name) => ACTION_NAMES.test(name ?? ""))).toEqual([]);
  });

  it("parcela que não existe (sem cache nem resposta): 'Parcela não encontrada', e o ✕ da coluna fecha", async () => {
    const user = userEvent.setup();
    renderPage({ details: { i4: null as unknown as InstallmentDetail } });
    expect(await screen.findByText("Parcela não encontrada")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(router.get()).toEqual({ installment: undefined });
  });

  it("a 1024, ↓ ↓ e Esc devolvem o foco à linha em que o painel parou (a i6), não à que o abriu (a i4)", async () => {
    const user = userEvent.setup();
    renderPage({ installment: null, width: 1024 });
    await user.click(row("i4"));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    );
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{ArrowDown}");
    expect(router.get()).toEqual({ installment: "i6" });
    await user.keyboard("{Escape}");
    expect(router.get()).toEqual({ installment: undefined });
    await waitFor(() => expect(row("i6")).toHaveFocus());
  });

  it("a contestação enviada fecha o formulário (o toast é do cache de mutações: testado no installments-api)", async () => {
    const user = userEvent.setup();
    calls.dispute.mockResolvedValue({
      data: { id: "i4", status: "disputed", paidAt: null, confirmedAt: null },
      error: null,
    });
    renderPage();
    await user.click(screen.getByRole("button", { name: "Contestar" }));
    await user.type(
      screen.getByRole("textbox", { name: "Por que você está contestando?" }),
      "Veio R$ 240,00."
    );
    await user.click(
      screen.getByRole("button", { name: "Enviar contestação" })
    );
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(calls.dispute).toHaveBeenCalledWith("i4", {
      reason: "Veio R$ 240,00.",
    });
  });

  it("↑ ↓ não andam de parcela enquanto se digita o motivo", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Contestar" }));
    await user.type(
      screen.getByRole("textbox", { name: "Por que você está contestando?" }),
      "abc{ArrowDown}{ArrowUp}"
    );
    expect(router.get()).toEqual({ installment: "i4" });
  });

  it("a 1600, Esc dentro do diálogo 'Editar valor ou data' fecha só o diálogo, não a coluna", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      screen.getByRole("button", { name: "Editar valor ou data" })
    );
    await screen.findByRole("dialog", { name: "Editar valor ou data" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(router.get()).toEqual({ installment: "i4" });
    expect(screen.getByTestId("installment-panel-docked")).toBeVisible();
  });
});
