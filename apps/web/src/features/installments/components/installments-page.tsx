import { SectionBoundary } from "@/components/ui/section-boundary";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { m } from "@/paraglide/messages.js";
import { InstallmentsContent } from "./installments-content";
import { InstallmentsSkeleton } from "./installments-skeleton";

/**
 * "Parcelas" (mockup 17, C): the month's installments by urgency. The same
 * breathing room and 1840 px stop as the home; the real title and switch draw
 * in the skeleton, so the page has its head at once.
 */
export function InstallmentsPage() {
  useDocumentTitle(m.page_title_installments());
  return (
    <div className="lateral:p-8 p-4 md:p-6" data-testid="installments-page">
      <div className="mx-auto w-full max-w-[1840px]">
        <SectionBoundary fallback={<InstallmentsSkeleton />}>
          <InstallmentsContent />
        </SectionBoundary>
      </div>
    </div>
  );
}
