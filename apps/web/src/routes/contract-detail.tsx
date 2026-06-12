import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { ContractStatusBadge } from "@/components/contract-status-badge";
import { InstallmentDrawer } from "@/components/installment-drawer";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useContractQuery } from "@/hooks/use-contracts";
import { formatBRL, formatISODateBR } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  buyer: "comprador",
  seller: "vendedor",
  neutral: "neutro",
  owner: "dono",
  counterparty: "contraparte",
};

const PAID_STATUSES = new Set(["paid", "confirmed", "awaiting_confirmation"]);

const STAT_TONE_CLASS: Record<"green" | "red" | "default", string> = {
  green: "text-emerald-700",
  red: "text-red-700",
  default: "text-foreground",
};

function isOverdue(dueDate: string, status: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return !PAID_STATUSES.has(status) && dueDate < today;
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "default";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
      <p className="font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className={`mt-1 font-bold font-display text-lg tabular-nums ${STAT_TONE_CLASS[tone]}`}
      >
        {value}
      </p>
    </div>
  );
}

export function ContractDetailPage() {
  const { id } = useParams({ from: "/protected/contracts/$id" });
  const { data, isPending } = useContractQuery(id);
  const [openId, setOpenId] = useState<string | null>(null);

  if (isPending || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Skeleton className="mb-3 h-9 w-1/2" />
        <Skeleton className="mb-6 h-4 w-32" />
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
        <Skeleton className="mb-6 h-2 w-full rounded-full" />
        <Skeleton className="mb-6 h-28 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const { contract, progress, installments, participants } = data;
  const overdue = progress.overdueCount > 0;
  const selected = installments.find((it) => it.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-6">
        <h1 className="font-bold font-display text-2xl text-foreground tracking-tight">
          {contract.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            {ROLE_LABELS[contract.ownerRole] ?? contract.ownerRole}
          </Badge>
          <ContractStatusBadge status={contract.status} />
          {overdue ? (
            <Badge tone="danger">{progress.overdueCount} em atraso</Badge>
          ) : (
            <Badge tone="success">em dia</Badge>
          )}
        </div>
        {contract.description ? (
          <p className="mt-3 text-muted-foreground text-sm">
            {contract.description}
          </p>
        ) : null}
      </header>

      <section className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={formatBRL(progress.totalCents)} />
        <Stat label="Pago" tone="green" value={formatBRL(progress.paidCents)} />
        <Stat label="Restante" value={formatBRL(progress.remainingCents)} />
        <Stat
          label="Atrasadas"
          tone={overdue ? "red" : "default"}
          value={String(progress.overdueCount)}
        />
      </section>

      <div className="mb-6">
        <Progress value={progress.percent} />
        <p className="mt-1.5 text-muted-foreground text-xs tabular-nums">
          <span className="font-display font-semibold text-foreground">
            {progress.percent}%
          </span>{" "}
          quitado
        </p>
      </div>

      <section className="mb-6 rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Participantes
        </h2>
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li className="flex items-center gap-3 text-sm" key={p.id}>
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${p.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
              <span className="font-medium text-foreground">
                {p.displayName}
              </span>
              <Badge tone="neutral">{ROLE_LABELS[p.role] ?? p.role}</Badge>
              {p.linked ? null : (
                <span className="text-muted-foreground text-xs">
                  não vinculado
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Parcelas
        </h2>
        <ul className="flex flex-col gap-2">
          {installments.map((it) => {
            const late = isOverdue(it.dueDate, it.status);
            return (
              <li key={it.id}>
                <button
                  className="relative flex w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => setOpenId(it.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${late ? "bg-destructive/70" : "bg-primary/40"}`}
                  />
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-display font-semibold text-foreground text-xs tabular-nums">
                    {it.sequence}
                  </span>
                  <span className="flex-1 text-foreground text-sm tabular-nums">
                    {formatISODateBR(it.dueDate)}
                  </span>
                  <span className="font-display font-semibold text-foreground text-sm tabular-nums">
                    {formatBRL(it.amountCents)}
                  </span>
                  <StatusBadge overdue={late} status={it.status} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <InstallmentDrawer
        contractId={contract.id}
        contractRole={data.role}
        installment={selected}
        onClose={() => setOpenId(null)}
        open={openId !== null}
        requiresConfirmation={contract.requiresConfirmation}
      />
    </div>
  );
}
