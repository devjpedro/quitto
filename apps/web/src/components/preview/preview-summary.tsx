import { CaretDown, Eye } from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { useReducedMotion } from "motion/react";
import { div as MotionDiv } from "motion/react-m";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Money } from "@/components/ui/money";
import { MotionScope } from "@/components/ui/motion-scope";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { summaryText } from "@/lib/schedule-summary";
import { m } from "@/paraglide/messages.js";
import { ContractPreviewCard } from "./contract-preview-card";
import { SideTag } from "./preview-parts";
import type { PreviewModel } from "./types";

const BOX =
  "flex min-h-11 w-full items-center gap-1.5 rounded-card bg-surface py-3 pr-1 pl-3.5 text-left shadow-[0_8px_22px_-12px_rgb(17_17_17/0.22),0_2px_6px_-3px_rgb(17_17_17/0.08)] dark:shadow-[0_8px_22px_-12px_rgb(0_0_0/0.6)] md:bg-surface-card md:shadow-none";

/**
 * Below 1140 the preview becomes this summary at the top (mockup 15, E and
 * C0): the side, the name, the total and "12x de R$ 500,00 · dia 10", the
 * face when there is one. Tapping it brings the whole card down from the
 * top; with the keyboard open it shrinks to one line (`compact`).
 */
export function PreviewSummary({
  compact,
  locale,
  model,
}: {
  compact: boolean;
  locale: Locale;
  model: PreviewModel;
}) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  if (!(model.title || model.side)) {
    return (
      <div
        className="mx-4 mt-3.5 flex stage:hidden min-h-11 items-center gap-2.5 rounded-card border-[1.5px] border-line-strong border-dashed px-3.5 py-2.5 text-[13px] text-ink-muted md:mx-0"
        data-testid="wizard-summary"
      >
        <Eye aria-hidden="true" size={18} />
        {m.summary_empty()}
      </div>
    );
  }
  const summary = model.summary
    ? summaryText(model.summary, locale, "short")
    : null;
  return (
    <MotionScope>
      <Dialog.Root onOpenChange={setOpen} open={open}>
        <div
          className="mx-4 mt-3.5 stage:hidden md:mx-0"
          data-testid="wizard-summary"
        >
          <Dialog.Trigger asChild>
            <button className={BOX} type="button">
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  {model.side && !compact ? (
                    <SideTag side={model.side} />
                  ) : null}
                  <b className="truncate font-semibold text-sm">
                    {model.title}
                  </b>
                  {compact && model.totalCents !== null ? (
                    <Money
                      cents={model.totalCents}
                      className="ml-auto"
                      size="list"
                    />
                  ) : null}
                </span>
                {compact ? null : (
                  <span className="mt-1 flex min-w-0 items-baseline gap-2">
                    {model.totalCents !== null && summary ? (
                      <>
                        <Money cents={model.totalCents} size="summary" />
                        <span className="truncate text-[12.5px] text-ink-muted tabular-nums">
                          {summary.text}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-ink-muted">
                        {m.summary_value_later()}
                      </span>
                    )}
                  </span>
                )}
              </span>
              {model.person?.kind === "other" && !compact ? (
                <PersonAvatar name={model.person.name} />
              ) : null}
              <span className="sr-only">{m.summary_open()}</span>
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center"
              >
                <CaretDown size={18} />
              </span>
            </button>
          </Dialog.Trigger>
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/36 dark:bg-black/50" />
          <Dialog.Content aria-describedby={undefined} asChild>
            <MotionDiv
              animate={{ y: 0, opacity: 1 }}
              className="fixed inset-x-0 top-0 z-50 max-h-[92dvh] overflow-y-auto rounded-b-panel bg-surface-sunken pt-[env(safe-area-inset-top)] pb-2.5 shadow-float focus:outline-none"
              initial={reduced ? { opacity: 0 } : { y: "-100%" }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <Dialog.Title className="sr-only">
                {m.preview_title()}
              </Dialog.Title>
              <ContractPreviewCard
                className="mx-4 mt-3.5"
                flat
                locale={locale}
                model={model}
              />
              <Dialog.Close asChild>
                <button
                  className="mx-auto mt-1 flex min-h-11 flex-col items-center justify-center gap-1.5 px-6 text-[12.5px] text-ink-muted"
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="h-1 w-9 rounded-full bg-line-strong"
                  />
                  {m.summary_close()}
                </button>
              </Dialog.Close>
            </MotionDiv>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </MotionScope>
  );
}
