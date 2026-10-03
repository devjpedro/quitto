import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { m } from "@/paraglide/messages.js";
import {
  type HeroStepId,
  type OnboardingView,
  stepTarget,
} from "../lib/onboarding";
import type { HomeOnboarding } from "../types";
import { StepLink } from "./step-link";

const HERO_COPY: Record<
  HeroStepId,
  { cta: () => string; description: () => string; title: () => string }
> = {
  contract: {
    title: m.onboarding_hero_contract_title,
    description: m.onboarding_hero_contract_description,
    cta: m.onboarding_hero_contract_cta,
  },
  pix: {
    title: m.onboarding_hero_pix_title,
    description: m.onboarding_hero_pix_description,
    cta: m.onboarding_hero_pix_cta,
  },
  reminders: {
    title: m.onboarding_hero_reminders_title,
    description: m.onboarding_hero_reminders_description,
    cta: m.onboarding_hero_reminders_cta,
  },
};

const PROGRESS =
  "h-1.5 flex-1 appearance-none overflow-hidden rounded-full bg-on-brand/20 [&::-moz-progress-bar]:bg-highlight [&::-webkit-progress-bar]:bg-on-brand/20 [&::-webkit-progress-value]:bg-highlight";

/**
 * The guide's next step on the green card (mockup 09): what to do, why, the
 * progress and one action. From lg the card stretches to the checklist next
 * to it, and the action sits at its foot.
 */
export function GuideHero({
  headingId,
  next,
  onboarding,
  view,
}: {
  headingId: string;
  next: HeroStepId;
  onboarding: HomeOnboarding;
  view: OnboardingView;
}) {
  const copy = HERO_COPY[next];
  const target = stepTarget(next, onboarding);
  return (
    <div className="flex flex-col gap-2 rounded-card bg-brand-surface p-5 text-on-brand">
      <Tag tone="highlight">{m.onboarding_tag()}</Tag>
      <h2
        className="font-display font-semibold text-[22px] leading-tight tracking-[-0.02em]"
        id={headingId}
      >
        {copy.title()}
      </h2>
      <p className="text-on-brand-muted text-sm">{copy.description()}</p>
      {/* lg:mb-2 keeps the 16 px above the action when this card is the taller column. */}
      <div className="mt-2 flex items-center gap-2 text-on-brand-muted text-sm lg:mb-2">
        <progress
          aria-label={m.onboarding_progress_label()}
          className={PROGRESS}
          max={view.total}
          value={view.doneCount}
        />
        <span className="tabular-nums">
          {m.onboarding_progress({ done: view.doneCount, total: view.total })}
        </span>
      </div>
      {target ? (
        <Button
          asChild
          className="mt-2 self-start lg:mt-auto"
          variant="onBrand"
        >
          <StepLink target={target}>
            {/* The bold ＋ belongs to "new contract" only: a Pix key or reminders are not "add". */}
            {next === "contract" ? (
              <Plus aria-hidden="true" size={16} weight="bold" />
            ) : null}
            {copy.cta()}
          </StepLink>
        </Button>
      ) : null}
    </div>
  );
}
