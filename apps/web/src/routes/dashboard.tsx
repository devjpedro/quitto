import { Link, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardQuery } from "@/hooks/use-dashboard";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatBRL, formatISODateBR } from "@/lib/format";
import { DIRECTION_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";

type Dashboard = NonNullable<ReturnType<typeof useDashboardQuery>["data"]>;
type Upcoming = Dashboard["upcoming"][number];

const STAT_TONE_CLASS: Record<"green" | "red" | "default", string> = {
  green: "text-emerald-700",
  red: "text-red-700",
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
  value: string;
  hint?: string;
  tone?: "green" | "red" | "default";
  testId?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3.5 shadow-xs"
      data-testid={testId}
    >
      <p className="font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 font-bold font-display text-lg tabular-nums ${STAT_TONE_CLASS[tone]}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground tabular-nums">
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
  return (
    <button
      className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      onClick={() => onOpen(item)}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${item.isOverdue ? "bg-destructive/70" : "bg-primary/40"}`}
      />
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display font-semibold text-foreground text-xs tabular-nums">
        {item.sequence}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display font-semibold text-foreground text-sm">
          {item.contractTitle}
        </span>
        <span className="mt-0.5 block text-muted-foreground text-xs tabular-nums">
          Parcela {item.sequence} · {DIRECTION_LABEL[item.direction]} ·{" "}
          {formatISODateBR(item.dueDate)}
        </span>
      </span>
      {item.isOverdue ? <Badge tone="danger">vencida</Badge> : null}
      <span className="font-display font-semibold text-foreground text-sm tabular-nums">
        {formatBRL(item.amountCents)}
      </span>
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
        <p className="font-display font-semibold text-foreground">
          Nada por aqui ainda.
        </p>
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
    <div className="mx-auto max-w-3xl p-6">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="h-20 w-full rounded-xl" />
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
    </div>
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
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
          Painel
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Sua visão geral de pagamentos e parcelas.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="A receber"
          tone={data.toReceiveCents > 0 ? "green" : "default"}
          value={formatBRL(data.toReceiveCents)}
        />
        <Stat
          label="A pagar"
          testId="stat-to-pay"
          value={formatBRL(data.toPayCents)}
        />
        <Stat
          hint={overdue ? formatBRL(data.overdueCents) : undefined}
          label="Atrasadas"
          tone={overdue ? "red" : "default"}
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
    </div>
  );
}
