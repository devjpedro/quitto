import { CaretRight, Check } from "@phosphor-icons/react";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import {
  type OnboardingStep,
  type OnboardingStepId,
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

/** The guide's steps in a card with straight dividers: done ones struck through, each pending one leads to its place. */
export function OnboardingChecklist({
  onboarding,
  steps,
}: {
  onboarding: HomeOnboarding;
  steps: OnboardingStep[];
}) {
  return (
    <ol className="divide-y divide-line self-start overflow-hidden rounded-card border border-line bg-surface-raised">
      {steps.map((step) => (
        <li key={step.id}>
          <StepRow onboarding={onboarding} step={step} />
        </li>
      ))}
    </ol>
  );
}
