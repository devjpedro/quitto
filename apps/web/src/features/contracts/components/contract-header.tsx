import { CaretLeft, Eye } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import {
  type CounterpartLine,
  counterpartLine,
  perspectiveOf,
  termsLine,
} from "../lib/contract-view";
import type { ContractDetail } from "../types";
import { ExportMenu } from "./contract-export-menu";
import { ContractActionsMenu } from "./contract-menus";

const NAME = "font-medium text-ink";

/** The viewer's line (mockup 14, F5): the chip, both faces, "Rafael Prado paga João Souza". */
function ViewerLine({
  payer,
  receiver,
}: {
  payer: string | null;
  receiver: string | null;
}) {
  return (
    <>
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-card px-2.5 font-medium text-[13px]">
        <Eye aria-hidden="true" size={15} />
        {m.contract_viewer_chip()}
      </span>
      {payer && receiver ? (
        <>
          <span className="inline-flex">
            <PersonAvatar name={payer} />
            <span className="-ml-1.5 inline-flex rounded-full ring-2 ring-surface max-md:ring-surface-sunken">
              <PersonAvatar name={receiver} />
            </span>
          </span>
          <span>
            <b className={NAME}>{payer}</b> {m.contract_viewer_pays()}{" "}
            <b className={NAME}>{receiver}</b>
          </span>
        </>
      ) : null}
    </>
  );
}

/** "Rafael Prado te paga", "você paga Carlos Lima", or the viewer's chip with both faces. */
function Counterpart({ line }: { line: CounterpartLine }) {
  if (line.kind === "receive") {
    return (
      <>
        <PersonAvatar name={line.name} />
        <span>
          <b className={NAME}>{line.name}</b> {m.contract_pays_you()}
        </span>
      </>
    );
  }
  if (line.kind === "pay") {
    return (
      <>
        <PersonAvatar name={line.name} />
        <span>
          {m.contract_you_pay()} <b className={NAME}>{line.name}</b>
        </span>
      </>
    );
  }
  if (line.kind === "view") {
    return <ViewerLine payer={line.payer} receiver={line.receiver} />;
  }
  return null;
}

/**
 * The contract's top (mockup 14 §1.1, enxuto): "‹ Contratos", the title with
 * no status chips, Exportar and "⋯" (desktop; the phone has them in the top
 * bar), and the other party with the terms, the only place they are said.
 */
export function ContractHeader({ detail }: { detail: ContractDetail }) {
  const locale = getLocale();
  const perspective = perspectiveOf(detail.role);
  const line = counterpartLine(detail.participants, perspective);
  // The viewer reads the terms without "com confirmação" (mockup 14, F5):
  // whether a payment is confirmed is the key's "confirmadas".
  const terms = termsLine(
    detail.installments,
    detail.contract.requiresConfirmation && perspective !== "view",
    locale
  );
  return (
    <header>
      <Link
        className="-ml-0.5 flex h-[22px] w-fit items-center gap-1 rounded-control font-medium text-[13px] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand max-md:hidden"
        to="/contracts"
      >
        <CaretLeft aria-hidden="true" size={14} />
        {m.contract_back()}
      </Link>
      <div className="flex items-start justify-between gap-4 md:mt-1.5">
        <h1 className="min-w-0 break-words font-bold font-display text-[28px] leading-[1.1] tracking-[-0.035em] md:text-[32px]">
          {detail.contract.title}
        </h1>
        <div className="flex shrink-0 gap-2 max-md:hidden">
          <ExportMenu contractId={detail.contract.id} />
          <ContractActionsMenu detail={detail} variant="desktop" />
        </div>
      </div>
      {/*
        One node for the terms, so they are said once. On a phone they take
        their own line (basis-full). From md they follow the other party after
        a "·" drawn in the 20 px column gap; a gap never opens a line, so when
        the terms wrap, the dot falls left of the line and is clipped.
      */}
      <p className="mt-2 flex flex-wrap items-center gap-y-1 overflow-x-clip text-[13.5px] text-ink-muted md:mt-2.5 md:gap-x-5 md:text-sm">
        {line.kind === "alone" ? null : (
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <Counterpart line={line} />
          </span>
        )}
        {terms ? (
          <span
            className="relative max-md:basis-full md:before:absolute md:before:top-0 md:before:right-full md:before:w-5 md:before:text-center md:before:text-line-strong md:before:content-[var(--terms-sep)_/_'']"
            // The "·" is a message (the same in both languages today), drawn by CSS.
            style={
              {
                "--terms-sep": JSON.stringify(m.contract_sep()),
              } as CSSProperties
            }
          >
            {terms}
          </span>
        ) : null}
      </p>
    </header>
  );
}
