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
import { overwriteGetLocale } from "@/paraglide/runtime.js";
import { homeFixture, TODAY, upcomingItem } from "./home-fixtures";
import { renderWithProviders } from "./test-utils";

const { dismiss } = vi.hoisted(() => ({ dismiss: vi.fn() }));

// Top-level regex literals (lint/performance/useTopLevelRegex), without backslashes.
const ANA_ROW = /Celular da Ana/;
const PIX_STEP = /^Cadastrar sua chave PIX/;
const PIX_ROW = /Cadastrar sua chave PIX/;
const CONTRACT_ROW = /^Criar o primeiro contrato/;
const RECEIVE_TOTAL = /R\$\s320,00 a receber/;
const PAY_TOTAL = /R\$\s390,00 a pagar/;
const YOU_RECEIVE = /você recebe/;
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
  it("chips: só o atraso de 2+ cartões no mesmo sentido; sem isso, nenhuma linha de chips", () => {
    const { container } = renderWithProviders(
      <TotalsChips overdueToPayCents={null} overdueToReceiveCents={null} />
    );
    expect(container).toBeEmptyDOMElement();
    renderWithProviders(
      <TotalsChips overdueToPayCents={null} overdueToReceiveCents={118_000} />
    );
    const chips = within(screen.getByRole("list", { name: "Resumo" }));
    // Filled, not outlined, with an icon: the status is not color alone.
    expect(chips.getByRole("listitem")).toHaveClass("bg-danger-subtle");
    expect(chips.getByRole("listitem")).not.toHaveClass("border");
    expect(chips.getByText("R$ 1.180,00")).toBeVisible();
    expect(chips.getByText("a receber em atraso")).toBeVisible();
    expect(chips.queryByText("pendências")).toBeNull();
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
    // The title adds up the rows of the list only, by direction, with the direction's icon.
    expect(screen.getByText(RECEIVE_TOTAL)).toBeVisible();
    expect(screen.getByText(PAY_TOTAL)).toBeVisible();
    expect(screen.queryByText("5 parcelas")).toBeNull();
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
    // The side is the sign and the color: the meta keeps just the weekday (and the installment from md).
    expect(screen.queryByText(YOU_RECEIVE)).toBeNull();
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
            payableTotalCents: 5_000_000,
            receivableTotalCents: 0,
          },
        }}
        momentId={null}
        today={TODAY}
      />
    );
    expect(screen.getByText("Tudo em dia em setembro")).toBeVisible();
    // The tag must not wrap inside the half-width cell.
    expect(screen.getByText("Tudo em dia em setembro")).toHaveClass(
      "whitespace-nowrap"
    );
    expect(screen.getByText("12 de 12 parcelas quitadas")).toBeVisible();
    expect(screen.getByText("Celular da Ana · 9/10")).toBeVisible();
    // No % on the strip's cells: it belongs to the milestone of the moment.
    expect(screen.queryByText("90%")).toBeNull();
    expect(screen.getByText("Recebido em outubro")).toBeVisible();
    expect(screen.queryByText("Pago em outubro")).toBeNull();
    expect(screen.getByText("Você já pagou")).toBeVisible();
    expect(screen.getByText("R$ 41.900,00")).toBeVisible();
    expect(screen.getByText("de R$ 50.000,00")).toBeVisible();
    expect(screen.queryByText("84%")).toBeNull();
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
    renderWithProviders(
      <Milestones milestones={milestones} momentId={null} today={TODAY} />
    );
    expect(screen.getByText("1 de 1 parcela quitada")).toBeVisible();
    for (const cell of milestoneCells(milestones)) {
      // The four kinds the lime card can show; "Já quitado" is strip-only.
      if (
        cell.id === "all_clear" ||
        cell.id === "closest" ||
        cell.id === "paid" ||
        cell.id === "received"
      ) {
        const view = momentView(cell, "pt-BR", TODAY);
        expect(screen.getByText(view.label)).toBeVisible();
        if (cell.id === "all_clear" || cell.id === "closest") {
          expect(screen.getByText(view.title)).toBeVisible();
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
        today={TODAY}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Tudo em dia em setembro");
    expect(items[0]).toHaveClass("col-span-2", "md:hidden");
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
        today={TODAY}
      />
    );
    expect(screen.getByRole("region", { name: "Marcos" })).toHaveClass(
      "md:hidden"
    );
  });

  it("marcos na coluna lateral (a partir de lateral): título visível e empilhados, nunca de 2 em 2", () => {
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
        today={TODAY}
      />
    );
    const region = screen.getByRole("region", { name: "Marcos" });
    // A size container: the side column decides two by two, not the screen.
    expect(region).toHaveClass("@container");
    // A section title at every width (mockup 13): Bricolage in ink.
    expect(screen.getByRole("heading", { name: "Marcos" })).not.toHaveClass(
      "sr-only"
    );
    const strip = within(region).getByRole("list");
    // One row from lg; stacked from lateral (never two by two: mockup 16).
    expect(strip).toHaveClass(
      "lg:grid-flow-col",
      "lateral:grid-flow-row",
      "lateral:grid-cols-1"
    );
    expect(strip.className).not.toContain("@min-[400px]");
    // Received, paid and settled: the odd last one takes the whole row below lateral.
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveClass("col-span-2", "lg:col-span-1");
    expect(items[2]?.className).not.toContain("@min-[400px]");
    expect(items[0]).not.toHaveClass("col-span-2");
  });

  it("marcos: células preenchidas, separadas por 2 px da cor de trás, sem contorno", () => {
    renderWithProviders(
      <Milestones
        milestones={{
          ...homeFixture().milestones,
          settled: {
            paidCents: 1_020_000,
            receivedCents: 554_000,
            payableTotalCents: 2_660_000,
            receivableTotalCents: 1_370_000,
          },
        }}
        momentId={null}
        today={TODAY}
      />
    );
    const list = screen.getByRole("list");
    expect(list).toHaveClass("gap-0.5", "bg-surface-sunken", "md:bg-surface");
    expect(list).not.toHaveClass("border");
    for (const cell of screen.getAllByRole("listitem")) {
      expect(cell).toHaveClass("bg-surface-card");
    }
    expect(screen.getByText("de R$ 13.700,00")).toBeVisible();
    expect(screen.queryByText("40%")).toBeNull();
    // The bar stays: it is the progress.
    expect(
      document.querySelectorAll("li [aria-hidden='true'].bg-track")
    ).toHaveLength(2);
  });

  it("o marco do momento abre a faixa no celular em limão, com o anel", () => {
    const { container } = renderWithProviders(
      <Milestones
        milestones={{
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
        }}
        momentId="closest"
        today={TODAY}
      />
    );
    const [moment] = screen.getAllByRole("listitem");
    expect(moment).toHaveClass("bg-highlight", "md:hidden");
    // The phone's cell is short (variant "phone"): the label carries the %, the title is the name only.
    expect(moment).toHaveTextContent("Mais perto de quitar · 90%");
    expect(moment).toHaveTextContent("Celular da Ana");
    expect(moment).not.toHaveTextContent("9/10");
    expect(moment).not.toHaveTextContent("Falta 1 parcela");
    expect(container.querySelector("li svg")).toHaveAttribute("width", "44");
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
        view={onboardingView(onboarding, { activeContracts: 0, today: TODAY })}
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
    // Beside the green card the list keeps its own height, not the card's.
    expect(screen.getByRole("list")).toHaveClass("self-start");
    // The next row still reads as next (tint, ring), but the green card
    // already carries its action: no second "Criar" beside it, a caret instead.
    const nextRow = screen.getByRole("link", { name: CONTRACT_ROW });
    expect(nextRow).toHaveClass("bg-surface-card-hover");
    expect(nextRow).toHaveTextContent("próximo passo");
    expect(within(nextRow).queryByText("Criar")).toBeNull();
    expect(nextRow.querySelector("svg")).not.toBeNull();
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
        view={onboardingView(onboarding, { activeContracts: 0, today: TODAY })}
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
        view={onboardingView(fresh, { activeContracts: 0, today: TODAY })}
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
        view={onboardingView(onboarding, { activeContracts: 0, today: TODAY })}
      />
    );
    expect(
      screen.getByRole("region", { name: "Comece por aqui" })
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Comece por aqui" })
    ).toBeVisible();
    expect(screen.getByText("3 de 4")).toBeVisible();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("Cadastre sua chave PIX.")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("link", { name: PIX_STEP })).toHaveAttribute(
      "href",
      "/settings"
    );
    const dismissButton = screen.getByRole("button", {
      name: "dispensar guia",
    });
    expect(dismissButton).toBeVisible();
    // Meta size (mockup 13's .gfoot): 13 px, below the rows' 14.
    expect(dismissButton.parentElement).toHaveClass("text-[13px]");
  });

  it("guia: cada passo tem o estado como âncora, e o próximo vem tingido com a ação", () => {
    const onboarding = {
      ...homeFixture().onboarding,
      hasPixKey: false,
      remindersOn: false,
    };
    renderWithProviders(
      <OnboardingGuide
        onboarding={onboarding}
        variant="compact"
        view={onboardingView(onboarding, { activeContracts: 0, today: TODAY })}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Comece por aqui" })
    ).toHaveClass("font-display");
    const list = screen.getByRole("list");
    expect(list).toHaveClass("bg-surface-card", "divide-divider");
    expect(list).not.toHaveClass("border");
    // Alone (a flex column), self-start would shrink the list to its words.
    expect(list).not.toHaveClass("self-start");
    const next = screen.getByRole("link", { name: PIX_ROW });
    expect(next).toHaveClass("bg-surface-card-hover");
    expect(next).toHaveTextContent("próximo passo");
    expect(within(next).getByText("Cadastrar")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getByText("Criar sua conta")).toHaveClass("line-through");
    expect(screen.getByText("opcional")).not.toHaveClass("line-through");
  });

  it("guia: o texto do botão do próximo passo está no nome acessível da linha, nos dois idiomas", () => {
    // The button is aria-hidden (the row is the link), so its words reach
    // voice control only through the row's name (WCAG 2.5.3, label in name).
    const pendingSteps = [
      { hasContract: false },
      { hasPixKey: false },
      { remindersOn: false },
    ];
    for (const locale of ["pt-BR", "en-US"] as const) {
      overwriteGetLocale(() => locale);
      try {
        for (const pending of pendingSteps) {
          const onboarding = { ...homeFixture().onboarding, ...pending };
          const { unmount } = renderWithProviders(
            <OnboardingGuide
              onboarding={onboarding}
              variant="compact"
              view={onboardingView(onboarding, {
                activeContracts: 0,
                today: TODAY,
              })}
            />
          );
          const row = screen
            .getAllByRole("link")
            .find((link) => link.classList.contains("bg-surface-card-hover"));
          const button = row?.querySelector(".rounded-control");
          const label = button?.textContent ?? "";
          expect(label).not.toBe("");
          expect(button).toHaveAttribute("aria-hidden", "true");
          expect(
            screen.getByRole("link", { name: (name) => name.includes(label) })
          ).toBe(row);
          unmount();
        }
      } finally {
        overwriteGetLocale(() => "pt-BR");
      }
    }
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
    // The side is the sign and the color, so the meta is just the weekday; the installment joins from md.
    expect(row).toHaveTextContent("sáb.");
    expect(row).not.toHaveTextContent("você recebe");
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
    // A first/last tag already places the row: no "parcela N de M" beside it.
    expect(last).not.toHaveTextContent("parcela 10 de 10");
    expect(within(first as HTMLElement).getByText("primeira")).toBeVisible();
    expect(within(first as HTMLElement).getByText("− R$ 320,00")).toHaveClass(
      "sr-only"
    );
  });

  it("o título é o de seção: Bricolage em ink, com o total do sentido à direita", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([upcomingItem()])}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Próximos 30 dias" })
    ).toHaveClass("font-display", "text-ink");
    expect(screen.getByText(RECEIVE_TOTAL)).toBeVisible();
    // A direction with nothing in the list is left out.
    expect(screen.queryByText(PAY_TOTAL)).toBeNull();
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

  it("no celular, a tag nunca come o nome do contrato: a linha do título quebra e as tags descem", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([
          upcomingItem({ sequence: 10, status: "awaiting_confirmation" }),
        ])}
      />
    );
    // The tags never shrink (nowrap): on a narrow row they must wrap below
    // the title, or the title shrinks to "Câm…" or to nothing (review, I1).
    const line = screen.getByText("Celular da Ana")
      .parentElement as HTMLElement;
    expect(line).toHaveClass("flex-wrap", "gap-y-1");
    expect(within(line).getByText("última")).toBeVisible();
    expect(within(line).getAllByText("Comprovante enviado")).toHaveLength(1);
  });

  it("um contrato de uma parcela só (1 de 1) mostra 'última', não 'primeira': pagando esta, quita", () => {
    renderWithProviders(
      <UpcomingList
        hasInstallmentActions={false}
        upcoming={upcoming([
          upcomingItem({ sequence: 1, installmentsCount: 1 }),
        ])}
      />
    );
    const row = screen.getByRole("link");
    expect(within(row).getByText("última")).toBeVisible();
    expect(within(row).queryByText("primeira")).toBeNull();
  });
});
