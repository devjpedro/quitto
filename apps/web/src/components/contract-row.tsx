import { Link } from "@tanstack/react-router";
import { ContractStatusBadge } from "@/components/contract-status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBRL } from "@/lib/format";

interface ContractListItem {
  id: string;
  installmentsCount: number;
  overdueCount: number;
  ownerRole: string;
  paidCents: number;
  percent: number;
  status: string;
  title: string;
  totalCents: number;
}

const ROLE_LABELS: Record<string, string> = {
  buyer: "comprador",
  seller: "vendedor",
  neutral: "neutro",
};

/** Wide-row card for the contracts list. Links to the contract detail. */
export function ContractRow({ contract }: { contract: ContractListItem }) {
  const overdue = contract.overdueCount > 0;

  return (
    <Link
      className="group relative flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:flex-row sm:items-center sm:gap-6"
      data-testid={`contract-row-${contract.id}`}
      params={{ id: contract.id }}
      search={{ installment: undefined }}
      to="/contracts/$id"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 transition-colors ${overdue ? "bg-destructive/70" : "bg-primary/60"}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-bold font-display text-base text-foreground transition-colors group-hover:text-primary">
            {contract.title}
          </span>
          <Badge tone="brand">
            {ROLE_LABELS[contract.ownerRole] ?? contract.ownerRole}
          </Badge>
          <ContractStatusBadge status={contract.status} />
        </div>
        <p className="mt-1.5 text-muted-foreground text-xs tabular-nums">
          <span className="font-medium text-foreground/80">
            {formatBRL(contract.paidCents)}
          </span>{" "}
          / {formatBRL(contract.totalCents)} · {contract.installmentsCount}{" "}
          parcelas
        </p>
      </div>

      <div className="w-full sm:w-44">
        <Progress value={contract.percent} />
        <p className="mt-1.5 text-muted-foreground text-xs tabular-nums">
          <span className="font-display font-semibold text-foreground">
            {contract.percent}%
          </span>{" "}
          quitado
        </p>
      </div>

      <div>
        {overdue ? (
          <Badge tone="danger">{contract.overdueCount} atrasadas</Badge>
        ) : (
          <Badge tone="success">em dia</Badge>
        )}
      </div>
    </Link>
  );
}
