import type { ReactNode } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { m } from "@/paraglide/messages.js";

/**
 * The stage (≥ 1140): surface-sunken in both themes (owner's decision 2),
 * 8 px of the white panel around it, card radius, the dot texture. The
 * card is 380 px up to 1919 and grows from 1920 (440) to 2560 (480):
 * planner's decision 20. No subtitle (ajuste-15 §5.2).
 */
export function PreviewStage({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="preview-title"
      className="preview-stage relative stage:flex hidden min-h-0 items-center justify-center overflow-hidden rounded-card bg-surface-sunken px-6 py-8"
      data-testid="wizard-stage"
    >
      <div className="relative huge:w-[clamp(440px,calc(440px_+_(100vw_-_1920px)_*_0.0625),480px)] w-[380px] max-w-full">
        <SectionTitle id="preview-title">{m.preview_title()}</SectionTitle>
        {children}
      </div>
    </section>
  );
}
