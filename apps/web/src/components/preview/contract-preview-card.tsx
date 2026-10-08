import {
  CalendarDots,
  CurrencyCircleDollar,
  WarningCircle,
} from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { Emphasis } from "@/components/ui/emphasis";
import { Money } from "@/components/ui/money";
import { PlaceholderBlock } from "@/components/ui/placeholder-block";
import { Tag } from "@/components/ui/tag";
import { summaryText } from "@/lib/schedule-summary";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import {
  PersonLine,
  PreviewProgress,
  PreviewRows,
  SideTag,
} from "./preview-parts";
import type { PreviewModel } from "./types";

/**
 * The contract as it will look (mockup 15 §1.1, DIRECAO › Telas › Wizard),
 * built from the app's own pieces; what is not filled in yet is a dashed
 * outline labeled with the step that fills it. The only thing in the
 * wizard with a shadow. `flat` drops it (inside the phone's open summary).
 * The invite turns off what it cannot say: the title right above the card
 * on a phone (`showTitle`), and the progress of a contract it does not know
 * the payments of (`showProgress`).
 */
export function ContractPreviewCard({
  className,
  flat = false,
  locale,
  model,
  showProgress = true,
  showTitle = true,
}: {
  className?: string;
  flat?: boolean;
  locale: Locale;
  model: PreviewModel;
  showProgress?: boolean;
  showTitle?: boolean;
}) {
  const summary = model.summary
    ? summaryText(model.summary, locale, "every")
    : null;
  return (
    <article
      aria-label={m.preview_title()}
      className={cn(
        "preview-surfaces rounded-panel bg-surface px-5 pt-5 pb-[18px] text-ink dark:bg-surface-raised",
        !flat && "shadow-float",
        className
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-2">
        {model.side ? (
          <SideTag side={model.side} />
        ) : (
          <PlaceholderBlock shape="pill">
            {m.preview_placeholder_side()}
          </PlaceholderBlock>
        )}
        {model.mismatch ? (
          <Tag tone="danger">
            <WarningCircle aria-hidden="true" size={12} weight="bold" />
            {m.preview_mismatch()}
          </Tag>
        ) : null}
      </div>
      {showTitle ? (
        <>
          {model.title ? (
            <h3 className="mt-3 truncate font-display font-semibold text-[22px] leading-[1.25] tracking-[-0.025em]">
              {model.title}
            </h3>
          ) : (
            <PlaceholderBlock shape="title">
              {m.preview_placeholder_title()}
            </PlaceholderBlock>
          )}
          {model.title && model.description ? (
            <p className="mt-0.5 truncate text-[13px] text-ink-muted">
              {model.description}
            </p>
          ) : null}
        </>
      ) : null}
      {model.totalCents !== null && summary ? (
        <>
          <Money
            cents={model.totalCents}
            className="mt-2.5 block"
            size="card"
          />
          <p className="mt-0.5 text-[13px] text-ink-muted tabular-nums">
            <Emphasis strong={summary.strong} text={summary.text} />
          </p>
        </>
      ) : (
        <PlaceholderBlock icon={CurrencyCircleDollar} shape="money">
          {m.preview_placeholder_total()}
        </PlaceholderBlock>
      )}
      <PersonLine model={model} />
      {model.rows.length > 0 ? (
        <>
          {showProgress ? (
            <PreviewProgress locale={locale} model={model} />
          ) : null}
          <PreviewRows locale={locale} model={model} />
        </>
      ) : (
        <PlaceholderBlock
          hint={m.preview_placeholder_rows_hint()}
          icon={CalendarDots}
          shape="rows"
        >
          {m.preview_placeholder_rows()}
        </PlaceholderBlock>
      )}
    </article>
  );
}
