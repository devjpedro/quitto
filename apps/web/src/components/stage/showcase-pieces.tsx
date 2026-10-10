import { ArrowRight, Clock, PixLogo, SealCheck } from "@phosphor-icons/react";
import { BoldParts, rise } from "@/components/stage/stage-panel";
import { buttonVariants } from "@/components/ui/button";
import { Emphasis } from "@/components/ui/emphasis";
import { InstallmentBar } from "@/components/ui/installment-bar";
import { Money } from "@/components/ui/money";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Tag } from "@/components/ui/tag";
import { formatDate, formatMoney } from "@/lib/locale-format";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

// The pieces are the app as it is, fixed and made up (the seed's names): they
// show the product, never anyone's data. The parent is aria-hidden.

/** The day the pieces' receipt was paid (the seed's Moto do Rafa, installment 2). */
const RECEIPT_PAID_ON = "2026-08-03";

/** The action card: today's installment of Carlos's loan, as the home shows it. */
export function ActionPiece({ className }: { className?: string }) {
  const locale = getLocale();
  return (
    <div
      className={cn(
        "piece-shadow piece-rise w-[340px] rounded-panel bg-surface px-5 pt-[18px] pb-5 text-ink",
        className
      )}
      style={rise(0)}
    >
      <div className="flex items-center justify-between">
        <Tag tone="ink">
          <Clock aria-hidden="true" size={12} weight="bold" />
          {m.auth_stage_due_today()}
        </Tag>
        <span className="text-[12.5px] text-ink-muted tabular-nums">
          {m.auth_stage_installment_of({ n: 7, total: 10 })}
        </span>
      </div>
      <p className="mt-3.5 font-medium text-sm">{m.auth_stage_loan()}</p>
      <Money cents={50_000} className="mt-0.5 block" size="card" />
      <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted">
        <PersonAvatar name="Carlos Lima" />
        <Emphasis
          strong="Carlos Lima"
          text={m.auth_stage_you_pay({ name: "Carlos Lima" })}
        />
      </p>
      <div className="mt-4">
        <InstallmentBar
          installmentsCount={10}
          overdueCount={0}
          paidCount={6}
          statuses={[
            "paid",
            "paid",
            "paid",
            "paid",
            "paid",
            "paid",
            "today",
            "open",
            "open",
            "open",
          ]}
        />
        <p className="mt-2 flex justify-between text-ink-muted text-xs tabular-nums">
          <span>{m.auth_stage_paid_of({ paid: 6, total: 10 })}</span>
          <b className="font-medium text-ink">
            {m.auth_stage_remaining({ amount: formatMoney(200_000, locale) })}
          </b>
        </p>
      </div>
      <div className="mt-4 flex gap-2">
        <span
          className={cn(
            buttonVariants({ size: "sm", variant: "primary" }),
            "md:h-[34px]"
          )}
        >
          <PixLogo aria-hidden="true" size={15} />
          {m.auth_stage_pay_pix()}
        </span>
        <span
          className={cn(
            buttonVariants({ size: "sm", variant: "inset" }),
            "bg-surface-card md:h-[34px]"
          )}
        >
          {m.auth_stage_i_paid()}
        </span>
      </div>
    </div>
  );
}

/** The lime milestone: the closest contract to being paid off, with the ring. */
export function MomentPiece({
  className,
  ringSize = 44,
}: {
  className?: string;
  ringSize?: number;
}) {
  return (
    <div
      className={cn(
        "piece-shadow piece-rise flex items-center gap-3.5 rounded-card bg-highlight px-4 py-3.5 text-on-highlight",
        className
      )}
      style={rise(0.08)}
    >
      <ProgressRing percent={90} size={ringSize} tone="onHighlight" />
      <div>
        <span className="block text-[12.5px]">
          {m.auth_stage_moment({ percent: 90 })}
        </span>
        <b className="block font-semibold text-[15px] leading-[1.3]">
          {m.auth_stage_phone()}
        </b>
      </div>
    </div>
  );
}

/** The paper of a receipt, with the perforated edge. `compact` is the phone's. */
export function ReceiptPiece({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = getLocale();
  const paidOn = formatDate(RECEIPT_PAID_ON, locale, "dayMonth");
  return (
    <div className={cn("piece-drop piece-rise", className)} style={rise(0.16)}>
      <div
        className={cn(
          "perforated rounded-t-card bg-surface text-ink",
          compact ? "px-3 pt-3 pb-5" : "px-[18px] pt-4 pb-[26px]"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium text-[12.5px] text-brand">
            <SealCheck aria-hidden="true" size={16} weight="fill" />
            {m.auth_stage_receipt()}
          </span>
          {compact ? null : (
            <span className="text-ink-muted text-xs tabular-nums">
              {m.auth_stage_installment_of({ n: 2, total: 10 })}
            </span>
          )}
        </div>
        <Money
          cents={48_000}
          className={cn("block", compact ? "mt-2" : "mt-2.5")}
          size="summary"
        />
        <p className="mt-0.5 text-ink-muted text-xs tabular-nums">
          {compact
            ? m.auth_stage_receipt_paid_on({ date: paidOn })
            : m.auth_stage_receipt_meta({ date: paidOn })}
        </p>
        {compact ? null : (
          <p className="mt-3 flex items-center gap-1.5 border-divider border-t border-dashed pt-3 text-[12.5px] text-ink-muted">
            <PersonAvatar name="Rafael Prado" size="xs" />
            <ArrowRight aria-hidden="true" size={13} />
            <PersonAvatar name="João Souza" size="xs" />
            <BoldParts
              parts={["Rafael", "João"]}
              text={m.auth_stage_receipt_who({
                payer: "Rafael",
                payee: "João",
              })}
            />
          </p>
        )}
      </div>
    </div>
  );
}

/** A notification: Ana paid installment 9. */
export function PaidPiece({ className }: { className?: string }) {
  const locale = getLocale();
  return (
    <div
      className={cn(
        "piece-shadow piece-rise flex w-[300px] items-center gap-3 rounded-card bg-surface py-2.5 pr-3.5 pl-2.5 text-ink",
        className
      )}
      style={rise(0.24)}
    >
      <PersonAvatar name="Ana Rocha" size="lg" />
      <div>
        <b className="block font-medium text-[13.5px]">
          {m.auth_stage_paid_notice({ name: "Ana Rocha", n: 9 })}
        </b>
        <small className="block text-ink-muted text-xs tabular-nums">
          {m.auth_stage_paid_notice_meta({
            amount: formatMoney(32_000, locale),
          })}
        </small>
      </div>
    </div>
  );
}
