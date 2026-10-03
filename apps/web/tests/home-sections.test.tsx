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
import {
  UPCOMING_SECTION_ID,
  UpcomingList,
} from "@/features/home/components/upcoming-list";
import { milestoneCells } from "@/features/home/lib/milestones";
import { momentView } from "@/features/home/lib/moment";
import { onboardingView } from "@/features/home/lib/onboarding";
import type { Home } from "@/features/home/types";
import { queryKeys } from "@/lib/query-keys";
import { homeFixture, TODAY, upcomingItem } from "./home-fixtures";
import { renderWithProviders } from "./test-utils";

const { dismiss } = vi.hoisted(() => ({ dismiss: vi.fn() }));

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const ANA_ROW = /Celular da Ana/;
const PIX_STEP = /^Cadastrar sua chave PIX/;
const NINE_OF_TEN = /parcela 9 de 10/;

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
        overdueToPayCents={0}
        overdueToReceiveCents={0}
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

  it("chips: uma pendência no singular, em limão preenchido; tudo zerado não mostra nada", () => {
    const { container } = renderWithProviders(
      <TotalsChips
        overdueToPayCents={0}
        overdueToReceiveCents={0}
        pendingCount={0}
        toPayCents={0}
        toReceiveCents={0}
      />
    );
    expect(container).toBeEmptyDOMElement();
    renderWithProviders(
      <TotalsChips
        overdueToPayCents={0}
        overdueToReceiveCents={0}
        pendingCount={1}
        toPayCents={0}
        toReceiveCents={0}
      />
    );
    const chips = within(screen.getByRole("list", { name: "Resumo" }));
    // Filled, not outlined (mockup 13): the pending chip is lime with no border.
    expect(chips.getByRole("listitem")).toHaveClass("bg-highlight");
    expect(chips.getByRole("listitem")).not.toHaveClass("border");
    expect(chips.getByText("pendência")).toBeVisible();
  });

  it("próximos 30 dias: linhas com + recebe / − paga, comprovante enviado e o que sobrou", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
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
    // One tag only, beside the title in the row's first line (not in the meta).
    expect(screen.getAllByText("Comprovante enviado")).toHaveLength(1);
    const titleLine = screen.getByText("Comprovante enviado").parentElement;
    expect(titleLine).toHaveTextContent("Curso de inglês");
    expect(titleLine).not.toHaveTextContent("você paga");
    expect(screen.getByText("+ 3 parcelas nos próximos 30 dias")).toBeVisible();
  });

  it("próximos 30 dias vazio: versão compacta", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={homeFixture().upcoming}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Nada vence nos próximos 30 dias" })
    ).toBeVisible();
  });

  it("próximos 30 dias vazio porque tudo já virou cartão: não diz que nada vence", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions
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

  it("com cartões acima e nada na janela (ex.: só atrasadas): o resto já está nos cartões, mesmo com total zero", () => {
    renderWithProviders(
      <UpcomingList hasInstallmentActions upcoming={homeFixture().upcoming} />
    );
    expect(
      screen.getByRole("heading", {
        name: "Nada mais vence nos próximos 30 dias",
      })
    ).toBeVisible();
    expect(
      screen.getByText("O que vence antes já está nos cartões acima.")
    ).toBeVisible();
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
            remainingCount: 1,
            nextDueDate: "2026-10-13",
          },
          monthToDate: {
            month: "2026-10",
            paidCents: 0,
            receivedCents: 338_000,
          },
          settled: {
            paidCents: 4_190_000,
            receivedCents: 0,
            payableTotalCents: 4_190_000,
            receivableTotalCents: 0,
          },
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

  it("marcos: a faixa diz o mesmo que o cartão limão do marco do momento", () => {
    const milestones = {
      previousMonthAllClear: { month: "2026-09", paidCount: 1 },
      closestToPayoff: {
        contractId: "c3",
        title: "Celular da Ana",
        paidCount: 9,
        totalCount: 10,
        percent: 90,
        remainingCount: 1,
        nextDueDate: "2026-10-13",
      },
      monthToDate: {
        month: "2026-10",
        paidCents: 125_000,
        receivedCents: 338_000,
      },
      settled: {
        paidCents: 0,
        receivedCents: 0,
        payableTotalCents: 0,
        receivableTotalCents: 0,
      },
    };
    renderWithProviders(<Milestones milestones={milestones} momentId={null} />);
    expect(screen.getByText("1 de 1 parcela quitada")).toBeVisible();
    for (const cell of milestoneCells(milestones)) {
      // The four kinds the lime card can show; "Já quitado" is strip-only.
      if (
        cell.id === "all_clear" ||
        cell.id === "closest" ||
        cell.id === "paid" ||
        cell.id === "received"
      ) {
        const view = momentView(cell, "pt-BR");
        expect(screen.getByText(view.title)).toBeVisible();
        if (cell.id === "all_clear" || cell.id === "closest") {
          expect(screen.getByText(view.detail)).toBeVisible();
        }
      }
    }
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
          settled: {
            paidCents: 0,
            receivedCents: 4_190_000,
            payableTotalCents: 0,
            receivableTotalCents: 4_190_000,
          },
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
          settled: {
            paidCents: 4_190_000,
            receivedCents: 0,
            payableTotalCents: 4_190_000,
            receivableTotalCents: 0,
          },
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
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    // The real list, not a stand-in: the jump depends on its section id.
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
        <UpcomingList
          hasInstallmentActions={false}
          upcoming={{
            items: [upcomingItem()],
            moreCount: 0,
            toPayCents: 0,
            toReceiveCents: 32_000,
          }}
        />
      </>
    );
    const region = screen.getByRole("region", { name: "Próximos 30 dias" });
    expect(region).toHaveAttribute("id", UPCOMING_SECTION_ID);
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
    // The focus follows the jump (keyboard and screen reader land on the list), without a second scroll.
    expect(region).toHaveFocus();
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    scroll.mockRestore();
    focus.mockRestore();
  });

  it("nada pendente sem parcela em aberto: diz isso e não oferece o salto", () => {
    renderWithProviders(
      <AllClear hasUpcoming={false} nextDue={null} today={TODAY} />
    );
    expect(screen.getByText("Nenhuma parcela em aberto.")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
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
    const heroCta = screen.getByRole("link", {
      name: "Criar meu primeiro contrato",
    });
    expect(heroCta).toHaveAttribute("href", "/contracts/new");
    // From lg the green card stretches to the checklist: the action sits at its foot (mockup 09).
    expect(heroCta).toHaveClass("lg:mt-auto");
    // Side by side only from lg: with the sidebar, md leaves the checklist too narrow.
    const guide = screen.getByRole("region", {
      name: "Cadastre o primeiro acordo que você quer acompanhar.",
    });
    expect(guide).toHaveClass("lg:grid-cols-[1fr_1.3fr]");
    expect(guide).not.toHaveClass("md:grid-cols-[1fr_1.3fr]");
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

  it("guia: o ＋ em negrito só no passo do contrato (PIX e lembretes não 'adicionam')", () => {
    const onboarding = {
      ...homeFixture().onboarding,
      hasPixKey: false,
      remindersOn: false,
    };
    const { unmount } = renderWithProviders(
      <OnboardingGuide
        onboarding={onboarding}
        variant="hero"
        view={onboardingView(onboarding)}
      />
    );
    const pix = screen.getByRole("link", { name: "Cadastrar chave PIX" });
    expect(pix).toHaveAttribute("href", "/settings");
    expect(pix.querySelector("svg")).toBeNull();
    unmount();
    const fresh = { ...onboarding, hasContract: false };
    renderWithProviders(
      <OnboardingGuide
        onboarding={fresh}
        variant="hero"
        view={onboardingView(fresh)}
      />
    );
    expect(
      screen
        .getByRole("link", { name: "Criar meu primeiro contrato" })
        .querySelector("svg")
    ).not.toBeNull();
  });

  it("guia compacto (já há ações): título com o progresso e a lista, sem o cartão verde", () => {
    const onboarding = {
      ...homeFixture().onboarding,
      hasPixKey: false,
      hasCounterparty: false,
    };
    renderWithProviders(
      <OnboardingGuide
        onboarding={onboarding}
        variant="compact"
        view={onboardingView(onboarding)}
      />
    );
    expect(
      screen.getByRole("region", { name: "Comece por aqui · 3 de 4" })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Comece por aqui · 3 de 4" })
    ).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Cadastre sua chave PIX.")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("link", { name: PIX_STEP })).toHaveAttribute(
      "href",
      "/settings"
    );
    expect(
      screen.getByRole("button", { name: "dispensar guia" })
    ).toBeVisible();
  });
});

describe("UpcomingList (mockup 13)", () => {
  const upcoming = (items: ReturnType<typeof upcomingItem>[]) => ({
    items,
    moreCount: 0,
    toPayCents: 0,
    toReceiveCents: 0,
  });

  it("um bloco preenchido com divisórias retas, sem uma caixa por linha", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([
          upcomingItem(),
          upcomingItem({ installmentId: "u2", sequence: 3 }),
        ])}
      />
    );
    const list = screen.getByRole("list");
    expect(list).toHaveClass(
      "bg-surface-card",
      "divide-y",
      "divide-divider",
      "rounded-card"
    );
    for (const link of within(list).getAllByRole("link")) {
      expect(link).not.toHaveClass("border");
      expect(link).toHaveClass(
        "hover:bg-surface-card-hover",
        "focus-visible:ring-inset"
      );
    }
  });

  it("cada linha: o tile de data, o dia da semana, a parcela a partir de md e o valor com sinal", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([upcomingItem()])}
      />
    );
    const row = screen.getByRole("link");
    // 2026-10-10 is a Saturday; installment 9 of 10, to receive R$ 320,00.
    expect(within(row).getByText("sábado, 10 de outubro")).toHaveClass(
      "sr-only"
    );
    expect(row).toHaveTextContent("sáb. · você recebe");
    expect(within(row).getByText(NINE_OF_TEN)).toHaveClass("max-md:hidden");
    expect(within(row).getByText("+ R$ 320,00")).toHaveClass("sr-only");
  });

  it("a última parcela ganha 'última'; a primeira, 'primeira'", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([
          upcomingItem({
            installmentId: "a",
            sequence: 10,
            installmentsCount: 10,
          }),
          upcomingItem({
            installmentId: "b",
            sequence: 1,
            installmentsCount: 12,
            direction: "pay",
          }),
        ])}
      />
    );
    const [last, first] = screen.getAllByRole("link");
    expect(within(last as HTMLElement).getByText("última")).toBeVisible();
    expect(within(first as HTMLElement).getByText("primeira")).toBeVisible();
    expect(within(first as HTMLElement).getByText("− R$ 320,00")).toHaveClass(
      "sr-only"
    );
  });

  it("o título é o de seção: Bricolage em ink, com a contagem à direita", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([upcomingItem()])}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Próximos 30 dias" })
    ).toHaveClass("font-display", "text-ink");
    expect(screen.getByText("1 parcela")).toBeVisible();
  });

  it("o anel e o hover da primeira e da última linha seguem o canto do bloco", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([
          upcomingItem(),
          upcomingItem({ installmentId: "u2", sequence: 3 }),
        ])}
      />
    );
    // The block clips its corners (overflow-hidden): a square row there
    // would cut the inset focus ring along the curve.
    for (const item of screen.getAllByRole("listitem")) {
      expect(item).toHaveClass("first:rounded-t-card", "last:rounded-b-card");
      expect(within(item).getByRole("link")).toHaveClass("rounded-[inherit]");
    }
  });
});
