import type { ReactNode } from "react";
import { LocaleSwitch } from "@/components/locale-switch";
import { m } from "@/paraglide/messages.js";
import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * The frame of the screens without an account (mockup 19, direction A): the
 * showcase panel and, beside it, the form in a 388 px column. The panel takes
 * 52% of the screen up to 960 px, and the form centers in the rest. Under
 * 1024 px the panel is the header. The language switch is in the form's top
 * corner from `lg` and at the foot of the column below it.
 * Without an account, it only sets the cookie and reloads.
 */
export function AuthFrame({
  children,
  stage,
}: {
  children: ReactNode;
  stage: ReactNode;
}) {
  const switcher = (
    <LocaleSwitch
      onChange={(locale) => setLocale(locale)}
      value={getLocale()}
    />
  );
  return (
    <div className="min-h-dvh bg-surface font-sans text-ink lg:grid lg:grid-cols-[min(52%,960px)_minmax(0,1fr)] lg:p-3">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-ink-inverse"
        href="#conteudo"
      >
        {m.skip_to_content()}
      </a>
      {stage}
      <main
        className="relative flex justify-center px-5 pt-7 pb-10 focus:outline-none lg:items-center lg:px-10 lg:py-12"
        id="conteudo"
        tabIndex={-1}
      >
        <div className="absolute top-3.5 right-3.5 max-lg:hidden">
          {switcher}
        </div>
        <div className="w-full max-w-[388px]" data-testid="wizard-form">
          {children}
          <div className="mt-7 flex justify-center lg:hidden">{switcher}</div>
        </div>
      </main>
    </div>
  );
}
