import { CaretLeft, X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import {
  KEYBOARD_MIN_PX,
  useVisualViewportInset,
} from "@/hooks/use-visual-viewport-inset";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { ShellFrame } from "./shell-frame";

const CLOSE =
  "items-center justify-center rounded-control text-ink transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

/**
 * The action bar (the wizard's footer, the invite's buttons). On a phone it
 * is sticky at the bottom: it takes its own room at the end of the column,
 * so it never covers the last rows (the one-by-one list with its fixes can
 * be 300 px tall), and it rises above the keyboard. From md, the end of the
 * form.
 */
export const ACTION_BAR =
  "sticky bottom-0 z-30 -mx-4 flex gap-2.5 bg-surface-sunken px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0_-1px_0_var(--line)] max-md:mt-auto md:static md:mx-0 md:mt-7 md:bg-transparent md:p-0 md:shadow-none";

/**
 * "‹ Voltar" and, on a phone, the ✕: the 56 px header with the title in the
 * middle. From md the back button sits in the form's top row, and the ✕ is
 * the StepFrame's, in the panel's corner.
 */
export function StepHeader({
  onBack,
  onClose,
  title,
}: {
  onBack?: () => void;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="flex h-14 items-center justify-between px-1 md:-mx-2.5 md:h-10 md:px-0">
      {onBack ? (
        <button
          className="inline-flex size-11 items-center justify-center gap-1.5 rounded-control font-medium text-ink text-sm transition-colors hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-9 md:w-auto md:px-2.5"
          onClick={onBack}
          type="button"
        >
          <CaretLeft aria-hidden="true" size={16} />
          <span className="max-md:sr-only">{m.wizard_back()}</span>
        </button>
      ) : (
        <span aria-hidden="true" className="size-11 md:hidden" />
      )}
      <b className="font-semibold text-[15px] md:hidden">{title}</b>
      <button
        aria-label={m.sheet_close()}
        className={cn(CLOSE, "flex size-11 md:hidden")}
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

/**
 * The wizard's and the invite's screen (DIRECAO › Telas › Wizard), one tree
 * for every width (planner's decision 19):
 * - < 768: the header, the progress and the summary held at the top, the
 *   body, and the action bar held at the bottom above the keyboard;
 * - 768–1139: the steps on the canvas; one column in the panel with the
 *   summary at its top;
 * - ≥ 1140 (`stage:`): the stage (the preview) and the 452 px form column;
 * - with the panel wider than 1840 (a viewport of about 2084 or more), the
 *   panel's content stops at 1840, centered (owner's decision 3).
 * In a tall screen the form starts in the middle band of 860 px. The ✕ from
 * md is absolute in the panel's corner, outside the column that scrolls.
 */
export function StepFrame({
  align = "top",
  children,
  footer,
  header,
  onClose,
  progress,
  rail,
  stage,
  summary,
}: {
  align?: "top" | "center";
  children: ReactNode;
  footer?: ReactNode;
  header: ReactNode;
  /** The ✕ from md, in the panel's corner (a phone's is in the header). */
  onClose: () => void;
  progress?: ReactNode;
  rail: ReactNode;
  stage?: ReactNode;
  summary?: ReactNode;
}) {
  const keyboard = useVisualViewportInset();
  const lifted = keyboard >= KEYBOARD_MIN_PX ? keyboard : 0;
  return (
    <ShellFrame column={rail} fit="screen" mainClassName="relative">
      <button
        aria-label={m.sheet_close()}
        className={cn(
          CLOSE,
          "absolute top-4 right-[18px] z-10 hidden size-9 md:flex"
        )}
        onClick={onClose}
        type="button"
      >
        <X aria-hidden="true" size={18} />
      </button>
      <div className="mx-auto flex stage:grid h-full w-full max-w-[1840px] stage:grid-cols-[minmax(0,1fr)_452px] flex-col md:p-2">
        {stage}
        <section
          className={cn(
            "relative flex min-h-dvh flex-col md:min-h-0 md:overflow-y-auto",
            "md:mx-auto md:w-full md:max-w-[476px] md:px-2 md:pt-3.5 md:pb-5",
            // stage: is in rem (Task 4), so it comes after md: in the CSS and wins from 1140.
            "stage:mx-0 stage:max-w-none stage:pt-[max(0.875rem,calc((100dvh_-_860px)/2))] stage:pr-7 stage:pl-9"
          )}
          data-testid="wizard-form"
        >
          <div className="max-md:sticky max-md:top-0 max-md:z-20 max-md:bg-surface-sunken max-md:pt-[env(safe-area-inset-top)] max-md:pb-3">
            {header}
            {progress}
            {summary}
          </div>
          <div
            className={cn(
              // md:min-h-0 lets a child (the one-by-one list) scroll inside the column.
              "flex flex-1 flex-col px-4 pt-5 md:min-h-0 md:px-0 md:pt-9",
              align === "center" && "md:justify-center md:pt-0"
            )}
          >
            {children}
            {footer ? (
              <div
                className={ACTION_BAR}
                data-testid="wizard-footer"
                style={
                  lifted ? { bottom: lifted, paddingBottom: 10 } : undefined
                }
              >
                {footer}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </ShellFrame>
  );
}
