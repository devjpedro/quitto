import { SectionBoundary } from "@/components/ui/section-boundary";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { m } from "@/paraglide/messages.js";
import { useGreeting } from "../hooks/use-greeting";
import { HomeContent } from "./home-content";
import { HomeSkeleton } from "./home-skeleton";

/**
 * "Agora". The greeting renders at once (it only needs what the
 * shell knows; "Novo contrato" lives in the sidebar); the rest streams in one section,
 * since it is one request. The panel's breathing room is 24 px, 32 px from
 * lateral, and the content stops at 1840 px, centred in the panel, header
 * included (mockup 12). The padding lives here, not on the shell's main.
 */
export function HomePage() {
  useDocumentTitle(m.page_title_now());
  const greeting = useGreeting();
  return (
    <div className="lateral:p-8 p-4 md:p-6">
      <div className="group/home mx-auto flex w-full max-w-[1840px] flex-col gap-4 md:gap-5">
        <div className="flex items-center justify-between gap-3">
          {/* The SSR and the browser may sit on either side of an hour boundary. */}
          <h1
            className="font-bold font-display text-[28px] leading-[1.1] tracking-[-0.035em] md:text-[32px]"
            suppressHydrationWarning
          >
            {greeting}
          </h1>
        </div>
        <SectionBoundary fallback={<HomeSkeleton />}>
          <HomeContent />
        </SectionBoundary>
      </div>
    </div>
  );
}
