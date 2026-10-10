import {
  DownloadSimple,
  Files,
  Printer,
  SealCheck,
  ShareNetwork,
} from "@phosphor-icons/react";
import type { PublicReceipt } from "@quitto/shared";
import { Link, useHydrated } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { rise } from "@/components/stage/stage-panel";
import { buttonVariants } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { detectPlatform } from "@/features/install/lib/platform";
import { useApiWarmup } from "@/hooks/use-api-warmup";
import { formatDate, formatInstant } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { useSignedIn } from "../hooks/use-signed-in";
import { ReceiptFrame } from "./receipt-frame";

/** "rTxnbV…3qc": enough of the link's token to tell two receipts apart. */
function receiptCode(token: string): string {
  return token.length > 12 ? `${token.slice(0, 6)}…${token.slice(-3)}` : token;
}

function Line({
  anchor,
  label,
  value,
}: {
  anchor: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 py-2.5 pr-4 pl-3">
      {anchor}
      <div className="min-w-0">
        <p className="text-ink-muted text-xs print:text-black/60">{label}</p>
        <p className="mt-0.5 truncate font-medium text-sm">{value}</p>
      </div>
    </div>
  );
}

const ACTION = "h-12 text-[15px]";
const ICON_ACTION = "size-12 shrink-0 px-0 md:h-12";

/**
 * "Compartilhar": the system's share sheet on a phone (Android or iOS, where
 * the browser has one), and the link copied on a computer.
 */
async function shareReceiptLink(): Promise<void> {
  const url = window.location.origin + window.location.pathname;
  const platform = detectPlatform({
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  });
  if (platform.kind !== "other" && typeof navigator.share === "function") {
    // Closing the share sheet rejects: nothing to say.
    await navigator.share({ url }).catch(() => undefined);
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success(m.public_receipt_link_copied());
  } catch {
    toast.error(m.common_copy_failed());
  }
}

function IconAction({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label} side="top">
      <button
        aria-label={label}
        className={cn(
          buttonVariants({ variant: "onBrandOutline" }),
          ICON_ACTION
        )}
        onClick={onClick}
        type="button"
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * /r/$token (mockup 19, A8 and A9): the receipt as a perforated paper on the
 * Floresta panel, with what was paid and by whom, "Baixar PDF" below it, and
 * "Compartilhar" and "Imprimir" as icons beside it. Signed in, the invite to
 * create an account is not shown; from the app (`fromApp`), there is a "Voltar". The page is in the visitor's language; the PDF, in the owner's.
 * An absent party (null) has no row.
 */
export function PublicReceiptPage({
  fromApp = false,
  receipt,
  token,
}: {
  fromApp?: boolean;
  receipt: PublicReceipt;
  token: string;
}) {
  useApiWarmup();
  const locale = getLocale();
  const hydrated = useHydrated();
  const signedIn = useSignedIn();
  const proof =
    receipt.proofBy && receipt.proofAt
      ? m.public_receipt_proof({
          name: receipt.proofBy,
          ...formatInstant(receipt.proofAt, locale),
        })
      : null;
  return (
    <ReceiptFrame
      back={fromApp}
      footer={
        signedIn ? (
          <span className="max-md:hidden">{m.public_receipt_tagline()}</span>
        ) : (
          <>
            <span className="max-md:hidden">{m.public_receipt_tagline()}</span>
            <span className="md:hidden">
              {m.public_receipt_made_with()} ·{" "}
              <Link
                className="font-medium text-on-brand underline underline-offset-[3px]"
                search={{ mode: "signup" }}
                to="/login"
              >
                {m.public_receipt_create_account()}
              </Link>
            </span>
            <Link
              className={cn(
                buttonVariants({ size: "sm", variant: "onBrandOutline" }),
                "max-md:hidden md:h-9"
              )}
              search={{ mode: "signup" }}
              to="/login"
            >
              {m.public_receipt_create_account()}
            </Link>
          </>
        )
      }
    >
      <div className="w-full max-w-[440px] print:max-w-none">
        <div
          className="piece-drop piece-rise print:filter-none"
          style={rise(0)}
        >
          <article
            className="perforated print:mask-none rounded-t-panel bg-surface px-[18px] pt-5 pb-[30px] text-ink [--bite:7px] md:px-[26px] md:pt-6 md:pb-[34px] print:rounded-none print:bg-white print:p-0 print:text-black"
            data-testid="public-receipt"
          >
            {/* On paper: the wordmark, inside the card. */}
            <div className="mb-5 hidden print:block">
              <Logo size={22} />
            </div>
            <IconTile className="size-10" icon={SealCheck} tone="brand" />
            <h1 className="mt-4 font-display font-semibold text-2xl leading-[1.2] tracking-[-0.03em]">
              {m.public_receipt_title()}
            </h1>
            <Money
              cents={receipt.amountCents}
              className="mt-3.5 block"
              size="hero"
            />
            <p className="mt-1 text-ink-muted text-sm tabular-nums print:text-black/60">
              {m.public_receipt_installment({
                sequence: receipt.sequence,
                count: receipt.installmentsCount,
              })}{" "}
              {m.home_dot_after({
                text: m.public_receipt_paid_on({
                  date: formatDate(receipt.paidAt, locale, "short"),
                }),
              })}
            </p>
            <div className="mt-5 divide-y divide-divider overflow-hidden rounded-card bg-surface-card print:bg-transparent">
              <Line
                anchor={
                  <IconTile
                    className="bg-surface-inset"
                    icon={Files}
                    tone="neutral"
                  />
                }
                label={m.public_receipt_contract()}
                value={receipt.contractTitle}
              />
              {receipt.payerName ? (
                <Line
                  anchor={<PersonAvatar name={receipt.payerName} size="lg" />}
                  label={m.public_receipt_payer()}
                  value={receipt.payerName}
                />
              ) : null}
              {receipt.receiverName ? (
                <Line
                  anchor={
                    <PersonAvatar name={receipt.receiverName} size="lg" />
                  }
                  label={m.public_receipt_receiver()}
                  value={receipt.receiverName}
                />
              ) : null}
            </div>
            <p className="mt-4 flex justify-between text-ink-muted text-xs print:text-black/60">
              {m.public_receipt_code()}
              <b className="font-medium font-mono text-ink print:text-black">
                {receiptCode(token)}
              </b>
            </p>
            {proof ? (
              <p
                className="mt-3 text-ink-muted text-xs leading-[1.5] print:text-black/60"
                data-testid="receipt-proof"
              >
                {proof}
              </p>
            ) : null}
            {/* On paper: who issued it, and where the receipt lives. */}
            <p className="mt-6 hidden break-all text-black/60 text-xs print:block">
              {m.public_receipt_issued()}
              {hydrated ? ` · ${window.location.href}` : ""}
            </p>
          </article>
        </div>
        <div className="mt-8 flex gap-2.5 print:hidden">
          <a
            className={cn(
              buttonVariants({ variant: "onBrand" }),
              ACTION,
              "flex-1"
            )}
            download
            href={`/api/public/receipts/${token}/receipt.pdf`}
          >
            <DownloadSimple aria-hidden="true" size={18} />
            {m.public_receipt_pdf()}
          </a>
          <IconAction
            label={m.public_receipt_share()}
            onClick={shareReceiptLink}
          >
            <ShareNetwork aria-hidden="true" size={20} />
          </IconAction>
          <IconAction
            label={m.public_receipt_print()}
            onClick={() => window.print()}
          >
            <Printer aria-hidden="true" size={20} />
          </IconAction>
        </div>
      </div>
    </ReceiptFrame>
  );
}
