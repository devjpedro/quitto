import { Plus } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SectionBoundary } from "@/components/ui/section-boundary";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { m } from "@/paraglide/messages.js";
import { useGreeting } from "../hooks/use-greeting";
import { HomeContent } from "./home-content";
import { HomeSkeleton } from "./home-skeleton";

/**
 * "Agora". The greeting and the desktop "+ Novo contrato" render at once
 * (they only need what the shell knows); the rest streams in one section,
 * since it is one request. The panel's breathing room is 24 px, 32 px from
 * lateral, and the content stops at 1840 px, centred in the panel, header
 * included (mockup 12). Legacy pages keep their own padding (PageContainer),
 * so neither lives on the shell's main.
 */
export function HomePage() {
  useDocumentTitle(m.page_title_now());
  const greeting = useGreeting();
  return (
    <div className="lateral:p-8 p-4 md:p-6">
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-4 md:gap-5">
        <div className="flex items-center justify-between gap-3">
          {/* The SSR and the browser may sit on either side of an hour boundary. */}
          <h1
            className="font-bold font-display text-[26px] tracking-[-0.03em] md:text-[28px]"
            suppressHydrationWarning
          >
            {greeting}
          </h1>
          {/* Desktop has no tab bar ＋ and no sidebar shortcut (mockups 02 and 08). */}
          <Button asChild className="hidden md:inline-flex">
            <Link to="/contracts/new">
              <Plus aria-hidden="true" size={16} weight="bold" />
              {m.nav_new_contract()}
            </Link>
          </Button>
        </div>
        <SectionBoundary fallback={<HomeSkeleton />}>
          <HomeContent />
        </SectionBoundary>
      </div>
    </div>
  );
}
