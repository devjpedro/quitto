import type { ReactNode } from "react";
import { LocaleSwitch } from "@/components/locale-switch";
import { Logo } from "@/components/logo";
import { StagePanel } from "@/components/stage/stage-panel";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * The public receipt's screen (mockup 19, decision 7): no form, so the
 * Floresta panel takes the whole screen, with the paper in the middle and
 * "Criar conta" for whoever got the link. On paper it is only the page.
 * `footer` is the line at the bottom (what Quitto is, and the way in).
 */
export function ReceiptFrame({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface font-sans text-ink md:p-3 print:min-h-0 print:bg-white print:p-0 print:text-black">
      <StagePanel className="flex min-h-dvh flex-col md:min-h-[calc(100dvh-24px)] md:rounded-frame print:min-h-0 print:rounded-none print:bg-white print:text-black">
        <div className="absolute top-3 right-3 z-[2] md:top-[26px] md:right-[26px] print:hidden">
          <LocaleSwitch
            onChange={(locale) => setLocale(locale)}
            tone="onBrand"
            value={getLocale()}
          />
        </div>
        <main
          className="flex flex-1 flex-col items-center justify-center px-3.5 pt-24 pb-8 md:py-24 print:p-0"
          id="conteudo"
        >
          {children}
        </main>
        {footer ? (
          <footer className="relative flex flex-col items-stretch gap-3 px-3.5 pb-6 text-[14px] text-on-brand-muted max-md:text-center md:flex-row md:items-center md:justify-between md:px-9 md:pb-[30px] print:hidden">
            {footer}
          </footer>
        ) : null}
        {/* On paper: the wordmark in its own color, and who issued it. */}
        <div className="hidden px-0 pt-6 text-[12px] text-black/60 print:block">
          <Logo size={20} />
        </div>
      </StagePanel>
    </div>
  );
}
