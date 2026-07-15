import { DIRECTION } from "@quitto/shared";
import { Link, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Money } from "@/components/money";
import { PageContainer } from "@/components/page-container";
import { StatLabel } from "@/components/stat-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardQuery } from "@/hooks/use-dashboard";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatBRL, formatISODateBR } from "@/lib/format";
import { DIRECTION_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";
import { cn } from "@/lib/utils";

type Dashboard = NonNullable<ReturnType<typeof useDashboardQuery>["data"]>;
type Upcoming = Dashboard["upcoming"][number];

const STAT_TONE_CLASS: Record<"danger" | "default", string> = {
  danger: "text-destructive",
  default: "text-foreground",
};

function Stat({
  label,
  value,
  hint,
  tone = "default",
  testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "danger" | "default";
  testId?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-sm)]"
      data-testid={testId}
    >
      <StatLabel>{label}</StatLabel>
      <p
        className={cn(
          "mt-1 font-bold text-lg tabular-nums",
          STAT_TONE_CLASS[tone]
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function UpcomingRow({
  item,
  onOpen,
}: {
  item: Upcoming;
  onOpen: (item: Upcoming) => void;
}) {
  const { isOverdue } = item;
  return (
    <button
      aria-label={`${item.contractTitle}, ${DIRECTION_LABEL[item.direction]} ${formatBRL(item.amountCents)}${isOverdue ? ", vencida" : ""}`}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border p-3 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isOverdue
          ? "border-destructive/25 bg-destructive/5"
          : "border-border bg-card"
      )}
      onClick={() => onOpen(item)}
      type="button"
    >
      {isOverdue ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1 bg-destructive"
        />
      ) : null}
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-xs tabular-nums",
          isOverdue
            ? "bg-destructive/12 text-destructive"
            : "bg-muted text-foreground"
        )}
      >
        {item.sequence}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground text-sm">
          {item.contractTitle}
        </span>
        <span className="mt-0.5 block text-muted-foreground text-xs tabular-nums">
          Parcela {item.sequence} · {formatISODateBR(item.dueDate)}
        </span>
      </span>
      {isOverdue ? (
        <Badge tone="danger">vencida</Badge>
      ) : (
        <Badge tone={item.direction === DIRECTION.receive ? "gold" : "neutral"}>
          {DIRECTION_LABEL[item.direction]}
        </Badge>
      )}
      <Money cents={item.amountCents} size="sm" />
    </button>
  );
}

function DashboardEmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-border border-dashed bg-card/50 p-12 text-center"
      data-testid="dashboard-empty-state"
    >
      <div
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <FileText aria-hidden="true" className="size-6" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Nada por aqui ainda.</p>
        <p className="mt-1 text-muted-foreground text-sm">
          Crie um contrato para começar a acompanhar seus pagamentos.
        </p>
      </div>
      <Button asChild>
        <Link to="/contracts/new">Criar contrato</Link>
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <PageContainer>
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <Skeleton className="mb-6 h-40 w-full rounded-xl" />
      <div className="mb-8 grid grid-cols-3 gap-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="mb-3 h-4 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    </PageContainer>
  );
}

export function DashboardPage() {
  useDocumentTitle(PAGE_TITLE.dashboard);
  const navigate = useNavigate();
  const { data, isPending } = useDashboardQuery();

  if (isPending || !data) {
    return <DashboardSkeleton />;
  }

  const hasContracts =
    data.activeContractsCount + data.completedContractsCount > 0;
  const overdue = data.overdueCount > 0;

  function openInstallment(item: Upcoming) {
    navigate({
      to: "/contracts/$id",
      params: { id: item.contractId },
      search: { installment: item.id },
    });
  }

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="font-bold text-2xl text-foreground tracking-tight">
          Painel
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Sua visão geral de pagamentos e parcelas.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-hero)]">
        <StatLabel className="mb-2 flex items-center gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-gold" />
          <span>A receber</span>
        </StatLabel>
        <Money cents={data.toReceiveCents} size="hero" />
        <p className="mt-2 text-muted-foreground text-sm">
          {data.activeContractsCount}{" "}
          {data.activeContractsCount === 1
            ? "contrato ativo"
            : "contratos ativos"}
          {overdue ? (
            <span className="text-destructive">
              {" "}
              · {data.overdueCount}{" "}
              {data.overdueCount === 1 ? "vencida" : "vencidas"}
            </span>
          ) : null}
        </p>
      </section>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <Stat
          label="A pagar"
          testId="stat-to-pay"
          value={<Money cents={data.toPayCents} size="md" />}
        />
        <Stat
          hint={
            overdue ? <Money cents={data.overdueCents} size="sm" /> : undefined
          }
          label="Atrasadas"
          tone={overdue ? "danger" : "default"}
          value={String(data.overdueCount)}
        />
        <Stat
          label="Contratos ativos"
          testId="stat-active"
          value={String(data.activeContractsCount)}
        />
      </section>

      {hasContracts ? (
        <section>
          <h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Próximas parcelas
          </h2>
          {data.upcoming.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {data.upcoming.map((item) => (
                <li key={item.id}>
                  <UpcomingRow item={item} onOpen={openInstallment} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-border border-dashed bg-card/50 p-8 text-center text-muted-foreground text-sm">
              Nenhuma parcela em aberto.
            </p>
          )}
        </section>
      ) : (
        <DashboardEmptyState />
      )}
    </PageContainer>
  );
}
