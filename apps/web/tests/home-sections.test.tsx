import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AllClear } from "@/features/home/components/all-clear";
import { HomeEmpty } from "@/features/home/components/home-empty";
import { Milestones } from "@/features/home/components/milestones";
import { OnboardingGuide } from "@/features/home/components/onboarding-guide";
import { TotalsChips } from "@/features/home/components/totals-chips";
import { UpcomingList } from "@/features/home/components/upcoming-list";
import { onboardingView } from "@/features/home/lib/onboarding";
import type { Home } from "@/features/home/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, TODAY, upcomingItem } from "./home-fixtures";
import { renderWithProviders } from "./test-utils";

const { dismiss } = vi.hoisted(() => ({ dismiss: vi.fn() }));

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const ANA_ROW = /Celular da Ana/;

vi.mock("@/lib/api", () => ({
  api: { api: { me: { onboarding: { dismiss: { post: () => dismiss() } } } } },
}));

interface LinkProps {
  children: ReactNode;
  className?: string;
  params?: { id: string };
  search?: { installment?: string };
  to: string;
}

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children, className, params, search, to }: LinkProps) => (
    <a
      className={className}
      href={`${to.replace("$id", params?.id ?? "")}${search?.installment ? `?installment=${search.installment}` : ""}`}
    >
      {children}
    </a>
  ),
}));

describe("seções do home", () => {
  it("chips: pendências em limão e totais dos próximos 30 dias", () => {
    renderWithProviders(
      <TotalsChips
        pendingCount={4}
        toPayCents={215_000}
        toReceiveCents={510_000}
      />
    );
    const chips = within(screen.getByRole("list", { name: "Resumo" }));
    expect(chips.getByText("pendências")).toBeVisible();
    expect(chips.getByText("R$ 2.150,00")).toBeVisible();
    expect(chips.getByText("R$ 5.100,00")).toBeVisible();
  });

  it("próximos 30 dias: linhas com + recebe / − paga, comprovante enviado e o que sobrou", () => {
    renderWithProviders(
      <UpcomingList
        upcoming={{
          items: [
            upcomingItem(),
            upcomingItem({
              installmentId: "u2",
              contractTitle: "Curso de inglês",
              direction: "pay",
              amountCents: 39_000,
              dueDate: "2026-10-06",
              status: "awaiting_confirmation",
            }),
          ],
          moreCount: 3,
          toPayCents: 39_000,
          toReceiveCents: 32_000,
        }}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Próximos 30 dias" })
    ).toBeVisible();
    expect(screen.getByText("5 parcelas")).toBeVisible();
    expect(screen.getByRole("link", { name: ANA_ROW })).toHaveAttribute(
      "href",
      "/contracts/c2?installment=u1"
    );
    expect(screen.getByText("+ R$ 320,00")).toBeVisible();
    expect(screen.getByText("− R$ 390,00")).toBeVisible();
    // One tag only: below the date on a phone, mid-row from md (the row's grid places it).
    expect(screen.getAllByText("Comprovante enviado")).toHaveLength(1);
    expect(screen.getByText("Comprovante enviado")).toHaveClass(
      "row-start-3",
      "md:col-start-2"
    );
    expect(screen.getByText("+ 3 parcelas nos próximos 30 dias")).toBeVisible();
  });

  it("próximos 30 dias vazio: versão compacta", () => {
    renderWithProviders(<UpcomingList upcoming={homeFixture().upcoming} />);
    expect(
      screen.getByRole("heading", { name: "Nada vence nos próximos 30 dias" })
    ).toBeVisible();
  });

  it("próximos 30 dias vazio porque tudo já virou cartão: não diz que nada vence", () => {
    renderWithProviders(
      <UpcomingList
        upcoming={{
          items: [],
          moreCount: 0,
          toPayCents: 125_000,
          toReceiveCents: 0,
        }}
      />
    );
    expect(
      screen.getByRole("heading", {
        name: "Nada mais vence nos próximos 30 dias",
      })
    ).toBeVisible();
    expect(
      screen.getByText("O que vence antes já está nos cartões acima.")
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Nada vence nos próximos 30 dias" })
    ).toBeNull();
  });

  it("marcos: tudo em dia em setembro, mais perto de quitar com a barra, recebido e o quitado por direção", () => {
    renderWithProviders(
      <Milestones
        milestones={{
          previousMonthAllClear: { month: "2026-09", paidCount: 12 },
          closestToPayoff: {
            contractId: "c3",
            title: "Celular da Ana",
            paidCount: 9,
            totalCount: 10,
            percent: 90,
          },
          monthToDate: {
            month: "2026-10",
            paidCents: 0,
            receivedCents: 338_000,
          },
          settled: { paidCents: 4_190_000, receivedCents: 0 },
        }}
        momentId={null}
      />
    );
    expect(screen.getByText("Tudo em dia em setembro")).toBeVisible();
    expect(screen.getByText("12 de 12 parcelas quitadas")).toBeVisible();
    expect(screen.getByText("Celular da Ana · 9/10")).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "90% quitado" })
    ).toHaveAttribute("value", "90");
    expect(screen.getByText("Recebido em outubro")).toBeVisible();
    expect(screen.queryByText("Pago em outubro")).toBeNull();
    expect(screen.getByText("Você já pagou")).toBeVisible();
    expect(screen.getByText("R$ 41.900,00")).toBeVisible();
    expect(screen.queryByText("Já recebeu")).toBeNull();
  });

  it("marcos: o do momento abre a faixa no celular e some dela a partir de md (a sidebar mostra)", () => {
    renderWithProviders(
      <Milestones
        milestones={{
          previousMonthAllClear: { month: "2026-09", paidCount: 12 },
          closestToPayoff: null,
          monthToDate: {
            month: "2026-10",
            paidCents: 0,
            receivedCents: 338_000,
          },
          settled: { paidCents: 0, receivedCents: 4_190_000 },
        }}
        momentId="all_clear"
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Tudo em dia em setembro");
    expect(items[0]).toHaveClass("col-span-2", "md:hidden");
    // The tag must not wrap inside the half-width cell.
    expect(screen.getByText("Tudo em dia em setembro")).toHaveClass(
      "whitespace-nowrap"
    );
    expect(items[1]).not.toHaveClass("md:hidden");
  });

  it("marcos: só o do momento, a faixa inteira some a partir de md", () => {
    renderWithProviders(
      <Milestones
        milestones={{
          ...homeFixture().milestones,
          previousMonthAllClear: { month: "2026-09", paidCount: 12 },
        }}
        momentId="all_clear"
      />
    );
    expect(screen.getByRole("region", { name: "Marcos" })).toHaveClass(
      "md:hidden"
    );
  });

  it("marcos na coluna lateral (a partir de lateral): título visível, empilhados e de 2 em 2 com 400 px", () => {
    renderWithProviders(
      <Milestones
        milestones={{
          previousMonthAllClear: null,
          closestToPayoff: null,
          monthToDate: {
            month: "2026-10",
            paidCents: 125_000,
            receivedCents: 338_000,
          },
          settled: { paidCents: 4_190_000, receivedCents: 0 },
        }}
        momentId={null}
      />
    );
    const region = screen.getByRole("region", { name: "Marcos" });
    // A size container: the side column decides two by two, not the screen.
    expect(region).toHaveClass("@container");
    // The title only shows in the side column; below lateral the strip speaks for itself (mockup 11).
    expect(screen.getByRole("heading", { name: "Marcos" })).toHaveClass(
      "sr-only",
      "lateral:not-sr-only"
    );
    const strip = within(region).getByRole("list");
    // One row from lg; stacked from lateral, two by two once the column has 400 px.
    expect(strip).toHaveClass(
      "lg:grid-flow-col",
      "lateral:grid-flow-row",
      "lateral:grid-cols-1",
      "lateral:@min-[400px]:grid-cols-2"
    );
    // Received, paid and settled: the odd last one takes the whole row, two by two.
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveClass(
      "col-span-2",
      "lateral:@min-[400px]:col-span-2"
    );
    expect(items[0]).not.toHaveClass("col-span-2");
  });

  it("nada pendente cita a próxima parcela e leva aos próximos 30 dias, sem mexer na URL", async () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderWithProviders(
      <>
        <AllClear
          hasUpcoming
          nextDue={upcomingItem({
            contractTitle: "Aluguel do apê",
            dueDate: "2026-10-14",
            amountCents: 125_000,
          })}
          today={TODAY}
        />
        <section id="upcoming" />
      </>
    );
    expect(screen.getByText("Nada pendente agora")).toBeVisible();
    expect(
      screen.getByText(
        "A próxima parcela é Aluguel do apê, em 12 dias (R$ 1.250,00)."
      )
    ).toBeVisible();
    const cta = screen.getByRole("button", { name: "Ver próximos 30 dias" });
    expect(cta).toHaveClass("w-full", "md:w-auto");
    await userEvent.click(cta);
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
    scroll.mockRestore();
  });

  it("vazio: contorno do cartão de ação, uma frase e Novo contrato", () => {
    const { container } = renderWithProviders(<HomeEmpty />);
    expect(
      screen.getByRole("heading", { name: "Suas pendências aparecem aqui" })
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Novo contrato" })).toHaveAttribute(
      "href",
      "/contracts/new"
    );
    // The first outline ends with the two button outlines of an action card.
    expect(
      container.querySelectorAll(".rounded-control.border-dashed")
    ).toHaveLength(2);
  });

  it("guia: próximo passo no cartão verde, checklist com o feito riscado e dispensar", async () => {
    const onboarding = {
      ...homeFixture().onboarding,
      hasContract: false,
      hasPixKey: false,
      hasCounterparty: false,
      remindersOn: false,
      counterpartyContractId: null,
    };
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      },
    });
    client.setQueryData(queryKeys.home, homeFixture({ onboarding }));
    dismiss.mockResolvedValue({
      data: { dismissedAt: "2026-10-02T10:00:00.000Z" },
      error: null,
    });
    renderWithProviders(
      <OnboardingGuide
        onboarding={onboarding}
        variant="hero"
        view={onboardingView(onboarding)}
      />,
      { client }
    );
    expect(
      screen.getByRole("heading", {
        name: "Cadastre o primeiro acordo que você quer acompanhar.",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("progressbar", { name: "Progresso do guia" })
    ).toHaveAttribute("value", "1");
    expect(screen.getByText("1 de 4")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Criar meu primeiro contrato" })
    ).toHaveAttribute("href", "/contracts/new");
    expect(screen.getByText("Criar sua conta")).toHaveClass("line-through");
    expect(screen.getByText("opcional")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "dispensar guia" })
    );
    await waitFor(() =>
      expect(
        client.getQueryData<Home>(queryKeys.home)?.onboarding.dismissedAt
      ).toBe("2026-10-02T10:00:00.000Z")
    );
  });
});
