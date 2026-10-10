import { FilePdf, Receipt } from "@phosphor-icons/react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { CardRoute } from "@/features/installments/types";
import { m } from "@/paraglide/messages.js";
import { guardLink } from "../lib/guard-link";
import type { ContractDetail } from "../types";

/** Settled (DIRECAO › Contrato): the lime milestone, the ring at 100%, the statement and the receipts. */
export function SettledCard({
  detail,
  route,
  tryLock,
}: {
  detail: ContractDetail;
  route: CardRoute;
  tryLock: () => boolean;
}) {
  const titleId = useId();
  const first = [...detail.installments].sort(
    (a, b) => a.sequence - b.sequence
  )[0];
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col rounded-card bg-highlight px-[18px] pt-4 pb-[18px] text-on-highlight"
      data-testid="next-action-card"
    >
      <div className="flex items-center gap-3.5">
        <ProgressRing percent={100} size={44} tone="onHighlight" />
        <div className="min-w-0">
          <p className="text-[12.5px]">{m.contract_milestone()}</p>
          <p
            className="font-display font-semibold text-2xl leading-tight tracking-[-0.025em]"
            id={titleId}
          >
            {m.contract_settled_title()}
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button
          asChild
          className="bg-on-highlight text-highlight hover:bg-on-highlight/90 focus-visible:ring-offset-highlight"
          size="sm"
        >
          <a
            download
            href={`/api/contracts/${detail.contract.id}/statement.pdf`}
            onClick={guardLink(tryLock)}
          >
            <FilePdf aria-hidden="true" size={16} />
            {m.contract_export_pdf()}
          </a>
        </Button>
        {first ? (
          <Button
            className="text-on-highlight ring-1 ring-on-highlight/35 ring-inset hover:bg-on-highlight/10 focus-visible:ring-offset-highlight"
            onClick={() => {
              if (tryLock()) {
                route.openInstallment(first.id);
              }
            }}
            size="sm"
            variant="ghost"
          >
            <Receipt aria-hidden="true" size={16} />
            {m.contract_receipts()}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
