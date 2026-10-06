import { buildPixBrCode } from "@quitto/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContractPage } from "@/features/contracts/components/contract-page";
import { CONTRACT_SLOTS } from "@/features/contracts/components/contract-slots";
import type { ContractRoute } from "@/features/contracts/hooks/use-contract-route";
import type { ContractDetail } from "@/features/contracts/types";
import { makeQueryClient } from "@/lib/query";
import { queryKeys } from "@/lib/query-keys";
import { motoDetail } from "./contract-fixtures";

const { markPaid, markReceived, navigate, toast } = vi.hoisted(() => ({
  markPaid: vi.fn(),
  markReceived: vi.fn(),
  navigate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/api", () => ({
  api: {
    api: {
      contracts: () => ({
        get: () => new Promise(() => undefined),
      }),
      installments: () => ({
        "mark-paid": { post: () => markPaid() },
        "mark-received": { post: () => markReceived() },
      }),
    },
  },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, to }: LinkProps) => (
    <a className={className} href={to}>
      {children}
    </a>
  ),
  useNavigate: () => navigate,
  useParams: () => ({ id: "c-moto" }),
  useSearch: () => ({}),
}));

const TODAY = "2026-10-05";
const WA_PREFIX = "https://wa.me/?text=";
const CHARGE_NAME = "Cobrar no WhatsApp (abre o WhatsApp)";
const OF_TEN = /de 10/;
const DATE_LIKE = /30\/08|agosto/;
const GROUP_1_3 = /^Parcelas 1 a 3/;

const openInstallment = vi.fn();
const fakeRoute = {
  id: "c-moto",
  installmentId: null,
  tab: "installments",
  today: TODAY,
  setTab: vi.fn(),
  openInstallment,
  closeInstallment: vi.fn(),
} as unknown as ContractRoute;

function makeClient() {
  const client = makeQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
    mutations: { retry: false },
  });
  return client;
}

function renderCard(detail: ContractDetail) {
  const client = makeClient();
  client.setQueryData(queryKeys.contract("c-moto"), detail);
  const card = CONTRACT_SLOTS.nextAction(detail, fakeRoute);
  render(<QueryClientProvider client={client}>{card}</QueryClientProvider>);
  return { client, card: screen.getByTestId("next-action-card") };
}

function renderPage(detail: ContractDetail) {
  const client = makeClient();
  client.setQueryData(queryKeys.contract("c-moto"), detail);
  render(
    <QueryClientProvider client={client}>
      <ContractPage slots={CONTRACT_SLOTS} />
    </QueryClientProvider>
  );
  return client;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const statusOf = (client: ReturnType<typeof makeClient>, id: string) =>
  client
    .getQueryData<ContractDetail>(queryKeys.contract("c-moto"))
    ?.installments.find((it) => it.id === id)?.status;

const tileOf = (id: string) =>
  document.querySelector(`[data-installment-row="${id}"] .font-mono`);

const thirdSegment = () =>
  screen.getByTestId("contract-hero").querySelectorAll("[data-status]")[2];

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-05T15:00:00Z"), toFake: ["Date"] });
  markPaid.mockReset();
  markReceived.mockReset();
  navigate.mockReset();
  openInstallment.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("NextActionCard (o cartão verde do contrato)", () => {
  it("quem recebe a Moto: 'Faça primeiro · atrasada', Parcela 3, R$ 480,00, 'Rafael Prado te deve', sem 'de 10' e sem data", () => {
    const { card } = renderCard(motoDetail());
    expect(card).toHaveClass("bg-brand-surface", "text-on-brand");
    expect(within(card).getByText("Faça primeiro · atrasada")).toHaveClass(
      "bg-highlight"
    );
    expect(within(card).getByText("Parcela 3")).toBeVisible();
    expect(within(card).getByText("R$ 480,00")).toBeInTheDocument();
    expect(
      within(card).getByText("Rafael Prado").parentElement
    ).toHaveTextContent("Rafael Prado te deve");
    expect(within(card).getByText("RP")).toBeInTheDocument();
    expect(card.textContent).not.toMatch(OF_TEN);
    expect(card.textContent).not.toMatch(DATE_LIKE);
    // The bar is said once, on the contract's top: the card has none.
    expect(card.querySelector("[data-status]")).toBeNull();
    expect(
      within(card).getByRole("link", { name: CHARGE_NAME })
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Marcar como recebida" })
    ).toBeVisible();
  });

  it("o link do WhatsApp leva a mensagem da parcela 3 com o PIX copia e cola do João (wa.me sem número)", () => {
    const { card } = renderCard(motoDetail());
    const link = within(card).getByRole("link", { name: CHARGE_NAME });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith(WA_PREFIX)).toBe(true);
    const code = buildPixBrCode({
      key: "joao.souza@exemplo.com",
      amountCents: 48_000,
      merchantName: "JOAO SOUZA",
      merchantCity: "BRASIL",
    });
    const paragraphs = decodeURIComponent(href.slice(WA_PREFIX.length)).split(
      "\n\n"
    );
    expect(paragraphs[0]).toContain("A parcela 3 de 10 de “Moto do Rafa”");
    expect(paragraphs[0]).toContain("venceu em 30/08/2026");
    expect(paragraphs.slice(1)).toEqual(["Pix copia e cola:", code]);
    // On a phone the visible label is "Cobrar"; the name stays the whole one.
    expect(within(link).getByText("Cobrar")).toBeInTheDocument();
  });

  it("Marcar como recebida: a linha 3 e a barra mudam na hora e voltam se a API recusar", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    markReceived.mockReturnValue(answer.promise);
    const client = renderPage(motoDetail());
    const card = screen.getByTestId("next-action-card");
    expect(statusOf(client, "i3")).toBe("pending");
    expect(tileOf("i3")).toHaveClass("bg-danger-subtle");
    expect(thirdSegment()).toHaveAttribute("data-status", "overdue");

    await user.click(
      within(card).getByRole("button", { name: "Marcar como recebida" })
    );
    // At once: with confirmation the mark is "confirmed"; the line, the bar
    // and the hero follow, and the card moves on to the proof to review.
    await waitFor(() => expect(statusOf(client, "i3")).toBe("confirmed"));
    // The line joins the paid ones at the start: "Parcelas 1 a 3".
    expect(tileOf("i3")).toBeNull();
    expect(
      within(screen.getByTestId("installment-list")).getByRole("button", {
        name: GROUP_1_3,
      })
    ).toBeVisible();
    expect(thirdSegment()).toHaveAttribute("data-status", "paid");
    expect(
      within(screen.getByTestId("contract-hero")).getByText("R$ 3.360,00")
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("next-action-card")).getByText(
        "Faça primeiro · conferir"
      )
    ).toBeVisible();

    answer.resolve({
      data: null,
      error: {
        status: 422,
        value: {
          error: {
            code: "INVALID_TRANSITION",
            message: "A parcela já foi marcada",
          },
        },
      },
    });
    await waitFor(() => expect(statusOf(client, "i3")).toBe("pending"));
    expect(tileOf("i3")).toHaveClass("bg-danger-subtle");
    expect(
      within(screen.getByTestId("installment-list")).queryByRole("button", {
        name: GROUP_1_3,
      })
    ).toBeNull();
    expect(thirdSegment()).toHaveAttribute("data-status", "overdue");
    expect(
      within(screen.getByTestId("contract-hero")).getByText("R$ 3.840,00")
    ).toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("grupo: Cobrar no WhatsApp + Abrir a mais antiga, e 'te deve desde 30/08'", async () => {
    const user = userEvent.setup();
    const detail = motoDetail();
    const two = {
      ...detail,
      installments: detail.installments.map((it) =>
        it.sequence === 4 ? { ...it, status: "pending" } : it
      ),
    };
    const { card } = renderCard(two);
    expect(within(card).getByText("Faça primeiro · atrasadas")).toBeVisible();
    expect(within(card).getByText("Parcelas 3 e 4")).toBeVisible();
    expect(within(card).getByText("R$ 960,00")).toBeInTheDocument();
    expect(
      within(card).getByText("Rafael Prado").parentElement
    ).toHaveTextContent("Rafael Prado te deve desde 30/08");
    const charge = within(card).getByRole("link", { name: CHARGE_NAME });
    const message = decodeURIComponent(
      (charge.getAttribute("href") ?? "").slice(WA_PREFIX.length)
    );
    expect(message).toContain("As parcelas 3 e 4 de “Moto do Rafa”");
    expect(message).not.toContain("Pix copia e cola");
    await user.click(
      within(card).getByRole("button", { name: "Abrir a mais antiga" })
    );
    expect(openInstallment).toHaveBeenCalledWith("i3");
    expect(within(card).getAllByRole("button")).toHaveLength(1);
  });

  it("quem paga sem confirmação: Pagar com PIX abre o painel; Já paguei marca na hora", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    markPaid.mockReturnValue(answer.promise);
    const base = motoDetail();
    const detail = motoDetail({
      role: "buyer",
      isOwner: false,
      isPayer: true,
      isApprover: false,
      contract: { ...base.contract, requiresConfirmation: false },
    });
    const { card, client } = renderCard(detail);
    expect(
      within(card).getByText("João Souza").parentElement
    ).toHaveTextContent("para João Souza");
    await user.click(
      within(card).getByRole("button", { name: "Pagar com PIX" })
    );
    expect(openInstallment).toHaveBeenCalledWith("i3");

    await user.click(within(card).getByRole("button", { name: "Já paguei" }));
    await waitFor(() => expect(statusOf(client, "i3")).toBe("paid"));
    expect(markPaid).toHaveBeenCalledTimes(1);
    answer.resolve({
      data: {
        id: "i3",
        contractId: "c-moto",
        sequence: 3,
        amountCents: 48_000,
        dueDate: "2026-08-30",
        status: "paid",
        paidAt: "2026-10-05T15:00:00.000Z",
        confirmedAt: null,
      },
      error: null,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Parcela marcada como paga")
    );
    expect(statusOf(client, "i3")).toBe("paid");
  });

  it("quitado: o marco limão com o anel a 100%, 'Contrato quitado', Extrato em PDF (download) e Recibos (abre a parcela 1)", async () => {
    const user = userEvent.setup();
    const detail = motoDetail();
    const settled = {
      ...detail,
      installments: detail.installments.map((it) => ({
        ...it,
        status: "confirmed",
        paidAt: `${it.dueDate}T15:00:00.000Z`,
      })),
    };
    const { card } = renderCard(settled);
    expect(card).toHaveClass("bg-highlight", "text-on-highlight");
    expect(within(card).getByText("Marco")).toBeVisible();
    expect(within(card).getByText("Contrato quitado")).toBeVisible();
    const ring = card.querySelector("svg");
    expect(ring).toHaveAttribute("width", "44");
    const arc = ring?.querySelectorAll("circle")[1];
    const [filled, whole] = (arc?.getAttribute("stroke-dasharray") ?? "")
      .split(" ")
      .map(Number);
    expect(filled).toBeCloseTo(whole as number, 1);
    const pdf = within(card).getByRole("link", { name: "Extrato em PDF" });
    expect(pdf).toHaveAttribute("href", "/api/contracts/c-moto/statement.pdf");
    expect(pdf).toHaveAttribute("download");
    await user.click(within(card).getByRole("button", { name: "Recibos" }));
    expect(openInstallment).toHaveBeenCalledWith("i1");
  });

  it("espectador: o slot devolve null (nenhum cartão)", () => {
    const viewer = motoDetail({
      role: "viewer",
      isOwner: false,
      isApprover: false,
    });
    expect(CONTRACT_SLOTS.nextAction(viewer, fakeRoute)).toBeNull();
  });
});
