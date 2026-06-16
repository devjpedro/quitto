import { isOverdue } from "@quitto/shared";
import { useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatBRL, formatISODateBR, todayISO } from "@/lib/format";
import {
  countByFilter,
  filterInstallments,
  type InstallmentFilter,
} from "@/lib/installments-filter";
import {
  INSTALLMENT_FILTER_EMPTY,
  INSTALLMENT_FILTER_LABEL,
} from "@/lib/labels";

const PAGE_SIZE = 15;
const FILTER_ORDER: InstallmentFilter[] = ["all", "due", "overdue", "paid"];

interface Installment {
  amountCents: number;
  dueDate: string;
  id: string;
  sequence: number;
  status: string;
}

export function InstallmentsSection({
  installments,
  onSelect,
}: {
  installments: Installment[];
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<InstallmentFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const today = todayISO();

  const counts = countByFilter(installments, today);
  const filtered = filterInstallments(installments, filter, today).sort(
    (a, b) => a.sequence - b.sequence
  );
  const shown = filtered.slice(0, visibleCount);
  const remaining = filtered.length - shown.length;

  function selectFilter(next: InstallmentFilter) {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <section>
      <h2 className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Parcelas
      </h2>

      <fieldset
        aria-label="Filtrar"
        className="mb-3 flex flex-wrap gap-2 border-0 p-0"
      >
        {FILTER_ORDER.map((key) => {
          const active = key === filter;
          return (
            <button
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-primary/20 bg-primary/10 font-semibold text-primary-strong"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              key={key}
              onClick={() => selectFilter(key)}
              type="button"
            >
              {INSTALLMENT_FILTER_LABEL[key]} ({counts[key]})
            </button>
          );
        })}
      </fieldset>

      <p aria-live="polite" className="sr-only">
        Mostrando {filtered.length}{" "}
        {INSTALLMENT_FILTER_LABEL[filter].toLowerCase()}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed bg-card p-6 text-center text-muted-foreground text-sm">
          {INSTALLMENT_FILTER_EMPTY[filter]}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((it) => {
            const late = isOverdue(it.dueDate, it.status, today);
            return (
              <li key={it.id}>
                <button
                  className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  data-testid={`installment-row-${it.id}`}
                  onClick={() => onSelect(it.id)}
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
      )}

      {remaining > 0 ? (
        <button
          className="mt-3 w-full rounded-lg border border-border py-2 text-muted-foreground text-sm transition-colors hover:bg-muted"
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          type="button"
        >
          Carregar mais ({remaining}{" "}
          {remaining === 1 ? "restante" : "restantes"})
        </button>
      ) : null}
    </section>
  );
}
