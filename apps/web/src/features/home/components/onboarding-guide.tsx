import { CaretRight, Check, Plus } from "@phosphor-icons/react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useDismissOnboarding } from "../api";
import {
  type HeroStepId,
  type OnboardingStep,
  type OnboardingStepId,
  type OnboardingView,
  stepTarget,
} from "../lib/onboarding";
import type { HomeOnboarding } from "../types";
import { StepLink } from "./step-link";

const STEP_COPY: Record<
  OnboardingStepId,
  { hint: (() => string) | null; title: () => string }
> = {
  account: { title: m.onboarding_step_account, hint: null },
  contract: {
    title: m.onboarding_step_contract,
    hint: m.onboarding_step_contract_hint,
  },
  pix: { title: m.onboarding_step_pix, hint: m.onboarding_step_pix_hint },
  counterparty: {
    title: m.onboarding_step_counterparty,
    hint: m.onboarding_step_counterparty_hint,
  },
  reminders: {
    title: m.onboarding_step_reminders,
    hint: m.onboarding_step_reminders_hint,
  },
};

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

function StepRow({
  onboarding,
  step,
}: {
  onboarding: HomeOnboarding;
  step: OnboardingStep;
}) {
  const copy = STEP_COPY[step.id];
  const target = stepTarget(step.id, onboarding);
  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
          // ink-inverse, not on-brand: in dark the brand turns light green and
          // a light check on it would read at 1.73:1.
          step.done
            ? "border-brand bg-brand text-ink-inverse"
            : "border-line-strong"
        )}
      >
        {step.done ? <Check size={13} weight="bold" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm",
            step.done ? "text-ink-muted line-through" : "font-medium"
          )}
        >
          {copy.title()}
        </span>
        {step.done ? (
          <span className="sr-only">{m.onboarding_done()}</span>
        ) : null}
        {copy.hint && !step.done ? (
          <span className="block text-ink-muted text-xs">{copy.hint()}</span>
        ) : null}
      </span>
      {step.optional ? (
        <Tag className="self-center">{m.onboarding_optional()}</Tag>
      ) : null}
      {target && !step.done ? (
        <CaretRight
          aria-hidden="true"
          className="shrink-0 text-ink-muted"
          size={16}
        />
      ) : null}
    </>
  );
  const row = "flex items-center gap-3 px-3.5 py-3";
  if (!target || step.done) {
    return <div className={row}>{body}</div>;
  }
  return (
    <StepLink
      className={cn(
        row,
        "transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      )}
      target={target}
    >
      {body}
    </StepLink>
  );
}

function GuideHero({
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
      <div className="mt-2 flex items-center gap-2 text-on-brand-muted text-sm">
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
        <Button asChild className="mt-2 self-start" variant="onBrand">
          <StepLink target={target}>
            <Plus aria-hidden="true" size={16} weight="bold" />
            {copy.cta()}
          </StepLink>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * "Comece por aqui", a checklist and never a balloon tour. `hero` puts the
 * next step on the green card next to the list (first access); `compact`
 * is the list alone, used when the home already has actions.
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
      className={cn("grid gap-3", showHero && "md:grid-cols-[1fr_1.3fr]")}
    >
      {showHero && view.next ? (
        <GuideHero
          headingId={headingId}
          next={view.next}
          onboarding={onboarding}
          view={view}
        />
      ) : (
        <h2 className="font-medium text-sm" id={headingId}>
          {m.onboarding_tag()} ·{" "}
          {m.onboarding_progress({ done: view.doneCount, total: view.total })}
        </h2>
      )}
      <ol className="divide-y divide-line self-start overflow-hidden rounded-card border border-line bg-surface-raised">
        {view.steps.map((step) => (
          <li key={step.id}>
            <StepRow onboarding={onboarding} step={step} />
          </li>
        ))}
      </ol>
      <p
        className={cn(
          "text-ink-muted text-sm",
          showHero && "md:col-span-2 md:text-right"
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
