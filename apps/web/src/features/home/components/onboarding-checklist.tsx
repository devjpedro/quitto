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

/**
 * Each step's words. The next step's `cta` is its button, aria-hidden because
 * the row is the link: it must be words of the `title`, so the row's name
 * holds the visible label (WCAG 2.5.3; a test checks both locales).
 */
const STEP_COPY: Record<
  OnboardingStepId,
  {
    cta: (() => string) | null;
    hint: (() => string) | null;
    title: () => string;
  }
> = {
  account: { title: m.onboarding_step_account, hint: null, cta: null },
  contract: {
    title: m.onboarding_step_contract,
    hint: m.onboarding_step_contract_hint,
    cta: m.onboarding_step_contract_cta,
  },
  pix: {
    title: m.onboarding_step_pix,
    hint: m.onboarding_step_pix_hint,
    cta: m.onboarding_step_pix_cta,
  },
  counterparty: {
    title: m.onboarding_step_counterparty,
    hint: m.onboarding_step_counterparty_hint,
    cta: null,
  },
  reminders: {
    title: m.onboarding_step_reminders,
    hint: m.onboarding_step_reminders_hint,
    cta: m.onboarding_step_reminders_cta,
  },
};

type StepState = "done" | "next" | "todo";

/** The step's state is the row's anchor (mockup 13): filled with a check, a ring with a dot, a dashed circle. */
function StepAnchor({ state }: { state: StepState }) {
  if (state === "done") {
    // ink-inverse, not on-brand: in dark the brand turns light green and a
    // light check on it would read at 1.73:1.
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-ink-inverse"
      >
        <Check size={13} weight="bold" />
      </span>
    );
  }
  if (state === "next") {
    return (
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-brand ring-inset"
      >
        <span className="size-2 rounded-full bg-brand" />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="size-6 shrink-0 rounded-full border-[1.5px] border-ink-muted border-dashed"
    />
  );
}

function StepRow({
  next,
  onboarding,
  showAction,
  step,
}: {
  next: boolean;
  onboarding: HomeOnboarding;
  showAction: boolean;
  step: OnboardingStep;
}) {
  const copy = STEP_COPY[step.id];
  const target = stepTarget(step.id, onboarding);
  let state: StepState = "todo";
  if (step.done) {
    state = "done";
  } else if (next) {
    state = "next";
  }
  const action = state === "next" && showAction ? copy.cta : null;
  const body = (
    <>
      <StepAnchor state={state} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span
            className={cn(
              "truncate",
              state === "done" && "text-ink-muted line-through",
              state === "next" && "font-semibold",
              state === "todo" && "font-medium"
            )}
          >
            {copy.title()}
          </span>
          {step.optional ? (
            <Tag className="self-center">{m.onboarding_optional()}</Tag>
          ) : null}
        </span>
        {state === "done" ? (
          <span className="sr-only">{m.onboarding_done()}</span>
        ) : null}
        {state === "next" ? (
          <span className="sr-only">{m.onboarding_next()}</span>
        ) : null}
        {copy.hint && !step.done ? (
          <span className="mt-0.5 block text-[12.5px] text-ink-muted">
            {copy.hint()}
          </span>
        ) : null}
      </span>
      {action ? (
        // The row is the link: the "button" is its look, not a second control.
        <span
          aria-hidden="true"
          className="inline-flex h-8 shrink-0 items-center rounded-control bg-surface-inset px-3 font-medium text-[13px]"
        >
          {action()}
        </span>
      ) : null}
      {!(step.done || action) && target ? (
        <CaretRight
          aria-hidden="true"
          className="shrink-0 text-ink-muted"
          size={16}
        />
      ) : null}
    </>
  );
  const row = cn(
    "flex min-h-[52px] items-center gap-3.5 py-2.5 pr-4 pl-3.5",
    state === "next" && "bg-surface-card-hover"
  );
  if (!target || step.done) {
    return <div className={row}>{body}</div>;
  }
  return (
    <StepLink
      className={cn(
        row,
        "transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
      )}
      target={target}
    >
      {body}
    </StepLink>
  );
}

/**
 * The guide's steps in one filled block with straight dividers; the next one
 * stands out, with its action when `showNextAction` (off beside the green
 * card, which already carries that action).
 */
export function OnboardingChecklist({
  className,
  next,
  onboarding,
  showNextAction,
  steps,
}: {
  className?: string;
  next: OnboardingStepId | null;
  onboarding: HomeOnboarding;
  showNextAction: boolean;
  steps: OnboardingStep[];
}) {
  return (
    <ol
      className={cn(
        "divide-y divide-divider overflow-hidden rounded-card bg-surface-card",
        className
      )}
    >
      {steps.map((step) => (
        <li key={step.id}>
          <StepRow
            next={step.id === next}
            onboarding={onboarding}
            showAction={showNextAction}
            step={step}
          />
        </li>
      ))}
    </ol>
  );
}
