import { useId } from "react";
import { ProgressRing } from "@/components/ui/progress-ring";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDismissOnboarding } from "../api";
import type { OnboardingView } from "../lib/onboarding";
import type { HomeOnboarding } from "../types";
import { GuideHero } from "./guide-hero";
import { OnboardingChecklist } from "./onboarding-checklist";
import { SectionTitle } from "./section-title";

/**
 * "Comece por aqui", a checklist and never a balloon tour. `hero` puts the
 * next step on the green card, beside the list from lg (first access);
 * `compact` is the list alone, used when the home already has actions.
 */
export function OnboardingGuide({
  onboarding,
  variant,
  view,
}: {
  onboarding: HomeOnboarding;
  variant: "hero" | "compact";
  view: OnboardingView;
}) {
  const headingId = useId();
  const dismiss = useDismissOnboarding();
  const showHero = variant === "hero" && view.next !== null;
  return (
    <section
      aria-labelledby={headingId}
      // Side by side from lg, the action grid's cut: with the sidebar, md leaves
      // the checklist too narrow for its words (176 px at 768).
      className={cn(
        showHero ? "grid gap-3 lg:grid-cols-[1fr_1.3fr]" : "flex flex-col"
      )}
    >
      {showHero && view.next ? (
        <GuideHero
          headingId={headingId}
          next={view.next}
          onboarding={onboarding}
          view={view}
        />
      ) : (
        <SectionTitle
          aux={
            <>
              <ProgressRing
                percent={(view.doneCount / view.total) * 100}
                size={18}
              />
              {m.onboarding_progress({
                done: view.doneCount,
                total: view.total,
              })}
            </>
          }
          id={headingId}
        >
          {m.onboarding_tag()}
        </SectionTitle>
      )}
      <OnboardingChecklist
        // Beside the green card (lg) the list keeps its own height; alone it
        // takes the full width.
        className={showHero ? "self-start" : undefined}
        next={view.next}
        onboarding={onboarding}
        showNextAction={!showHero}
        steps={view.steps}
      />
      <p
        className={cn(
          "text-[13px] text-ink-muted",
          showHero ? "lg:col-span-2 lg:text-right" : "mt-2.5"
        )}
      >
        {m.onboarding_dismiss_prompt()} ·{" "}
        <button
          className="inline-flex min-h-11 items-center rounded-control underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:min-h-0"
          onClick={() => dismiss.mutate()}
          type="button"
        >
          {m.onboarding_dismiss()}
        </button>
      </p>
    </section>
  );
}
