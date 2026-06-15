import { isOverdue } from "@quitto/shared";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ContractActionsMenu } from "@/components/contract-actions-menu";
import { ContractStatusBadge } from "@/components/contract-status-badge";
import { ExportMenu } from "@/components/export-menu";
import { InstallmentDrawer } from "@/components/installment-drawer";
import { ParticipantsDrawer } from "@/components/participants-drawer";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useContractQuery } from "@/hooks/use-contracts";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { formatBRL, formatISODateBR, todayISO } from "@/lib/format";
import { OWNER_BADGE_LABEL, ROLE_LABEL } from "@/lib/labels";
import { PAGE_TITLE } from "@/lib/page-title";

const STAT_TONE_CLASS: Record<"green" | "red" | "default", string> = {
  green: "text-emerald-700",
  red: "text-red-700",
  default: "text-foreground",
};

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
  useDocumentTitle(PAGE_TITLE.contractDetail);
  const { id } = useParams({ from: "/protected/contracts/$id" });
  const { installment } = useSearch({ from: "/protected/contracts/$id" });
  const navigate = useNavigate();
  const { data, isPending } = useContractQuery(id);
  const [openId, setOpenId] = useState<string | null>(installment ?? null);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    if (installment) {
      setOpenId(installment);
    }
  }, [installment]);

  function closeInstallment() {
    setOpenId(null);
    if (installment) {
      navigate({
        to: "/contracts/$id",
        params: { id },
        search: { installment: undefined },
        replace: true,
      });
    }
  }

  if (isPending || !data) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
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
  const isOwner = data.isOwner;
  const overdue = progress.overdueCount > 0;
  const selected = installments.find((it) => it.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-bold font-display text-2xl text-foreground tracking-tight">
            {contract.title}
          </h1>
          <div className="flex shrink-0 items-center gap-1">
            <ExportMenu contractId={id} />
            <ContractActionsMenu contractId={id} isOwner={isOwner} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{ROLE_LABEL[data.role] ?? data.role}</Badge>
          {isOwner ? <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge> : null}
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Participantes
          </h2>
          {isOwner ? (
            <Button
              onClick={() => setManaging(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Gerenciar
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {participants.map((p) => (
            <li
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
              key={p.id}
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${p.linked ? "bg-primary" : "bg-muted-foreground/40"}`}
              />
              <span className="min-w-0 font-medium text-foreground">
                {p.displayName}
              </span>
              <Badge tone="neutral">{ROLE_LABEL[p.role] ?? p.role}</Badge>
              {p.isOwner ? (
                <Badge tone="brand">{OWNER_BADGE_LABEL}</Badge>
              ) : null}
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
            const late = isOverdue(it.dueDate, it.status, todayISO());
            return (
              <li key={it.id}>
                <button
                  className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  data-testid={`installment-row-${it.id}`}
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
                  <span className="min-w-0 flex-1 truncate text-foreground text-sm tabular-nums">
                    {formatISODateBR(it.dueDate)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-display font-semibold text-foreground text-sm tabular-nums">
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
        capabilities={{ isPayer: data.isPayer, isApprover: data.isApprover }}
        contractId={contract.id}
        installment={selected}
        isOwner={data.isOwner}
        onClose={closeInstallment}
        open={openId !== null}
        requiresConfirmation={contract.requiresConfirmation}
      />

      {isOwner ? (
        <ParticipantsDrawer
          contractId={contract.id}
          onClose={() => setManaging(false)}
          open={managing}
          participants={participants}
        />
      ) : null}
    </div>
  );
}
