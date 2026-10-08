import { type Locale, todayISO } from "@quitto/shared";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { PreviewModel } from "@/components/preview/types";
import { useIdentity } from "@/hooks/use-identity";
import { getLocale } from "@/paraglide/runtime.js";
import { fieldId } from "../lib/field-id";
import { applyChange, filledField } from "../lib/wizard-change";
import { stepOfField, type WizardField } from "../lib/wizard-fields";
import { wizardPreview } from "../lib/wizard-preview";
import {
  type FieldIssue,
  type FieldWarning,
  scheduleWarnings,
  validateAdjusted,
  validateStep,
} from "../lib/wizard-validation";
import {
  emptyValues,
  rowsOf,
  type WizardStep,
  type WizardValues,
} from "../lib/wizard-values";

export interface ContractWizard {
  adjusting: boolean;
  back(): void;
  blur(field: WizardField): void;
  close(): void;
  closeAdjust(): void;
  discard: { confirm(): void; open: boolean; setOpen(open: boolean): void };
  goTo(step: WizardStep): void;
  issueFor(field: WizardField): FieldIssue | undefined;
  locale: Locale;
  next(): void;
  openAdjust(): void;
  preview: PreviewModel;
  replace(values: WizardValues): void;
  report(issue: FieldIssue): void;
  setValue<K extends keyof WizardValues>(key: K, value: WizardValues[K]): void;
  step: WizardStep;
  stepHeadingRef: RefObject<HTMLHeadingElement | null>;
  today: string;
  values: WizardValues;
  warningFor(field: WizardField): FieldWarning | undefined;
}

/** The radiogroup's chosen radio (or its first), else the field itself. */
function focusField(field: WizardField): void {
  const element = document.getElementById(fieldId(field));
  const target = element?.matches("[role=radiogroup]")
    ? (element.querySelector<HTMLElement>("[data-state=checked]") ??
      element.querySelector<HTMLElement>("[role=radio]"))
    : element;
  target?.focus();
}

const KEYS = Object.keys(emptyValues()) as (keyof WizardValues)[];

/**
 * The wizard's state (spec §5): the step, the values (react-hook-form, for
 * the "dirty" the ✕ asks about), and the messages with their parameters
 * (planner's decision 22). Validation uses the shared schema's pieces, so a
 * code here is the one the server raises.
 */
export function useContractWizard({
  onSubmit,
  titleFromSearch,
}: {
  onSubmit?: (values: WizardValues) => void;
  titleFromSearch?: string;
} = {}): ContractWizard {
  const form = useForm<WizardValues>({
    defaultValues: emptyValues(titleFromSearch ?? ""),
  });
  const values = useWatch({ control: form.control }) as WizardValues;
  const [step, setStep] = useState<WizardStep>(1);
  const [adjusting, setAdjusting] = useState(false);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const focusTarget = useRef<WizardField | "heading" | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const identity = useIdentity();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const today = todayISO();
  const locale = getLocale();
  const context = { sessionEmail: identity?.email ?? null };

  // Read while rendering: react-hook-form only tracks the formState fields a
  // render reads (a proxy), so reading them inside close() would see false.
  const { dirtyFields, isDirty } = form.formState;
  // Back/forward between two ?title= keep this page mounted (the palette is
  // not in focus mode): fill the name only while the person has not typed one.
  const titleDirty = Boolean(dirtyFields.title);
  useEffect(() => {
    if (titleFromSearch && !titleDirty) {
      form.setValue("title", titleFromSearch);
    }
  }, [titleFromSearch, titleDirty, form]);

  // After a render that asked for it: the first wrong field, or the step's title.
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) {
      return;
    }
    focusTarget.current = null;
    if (target === "heading") {
      stepHeadingRef.current?.focus();
    } else {
      focusField(target);
    }
  });

  const write = (next: WizardValues) => {
    const current = form.getValues();
    for (const key of KEYS) {
      if (next[key] !== current[key]) {
        form.setValue(key, next[key], { shouldDirty: true });
      }
    }
  };

  const show = (found: FieldIssue[]) => {
    setIssues(found);
    focusTarget.current = found[0]?.field ?? null;
  };

  const advance = (to: WizardStep) => {
    setStep(to);
    setAdjusting(false);
    setIssues([]);
    focusTarget.current = "heading";
  };

  const leave = () => {
    if (canGoBack) {
      router.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  const warnings = scheduleWarnings(values, today);
  const preview = useMemo(() => wizardPreview(values, today), [values, today]);

  return {
    adjusting,
    back: () => {
      if (adjusting) {
        setAdjusting(false);
        setIssues([]);
        focusTarget.current = "heading";
      } else if (step > 1) {
        advance((step - 1) as WizardStep);
      }
    },
    blur: (field) => {
      const current = form.getValues();
      const wrong = issues.some((issue) => issue.field === field);
      if (!(wrong || filledField(current, field))) {
        return;
      }
      const found = validateStep(stepOfField(field), current, context).filter(
        (issue) => issue.field === field
      );
      setIssues((all) => [
        ...all.filter((issue) => issue.field !== field),
        ...found,
      ]);
    },
    close: () => {
      if (isDirty) {
        setDiscardOpen(true);
      } else {
        leave();
      }
    },
    closeAdjust: () => {
      setAdjusting(false);
      setIssues([]);
      focusTarget.current = "heading";
    },
    discard: {
      confirm: () => {
        setDiscardOpen(false);
        leave();
      },
      open: discardOpen,
      setOpen: setDiscardOpen,
    },
    goTo: (to) => {
      if (to < step) {
        advance(to);
      }
    },
    issueFor: (field) => issues.find((issue) => issue.field === field),
    locale,
    next: () => {
      const current = form.getValues();
      const found = adjusting
        ? validateAdjusted(current)
        : validateStep(step, current, context);
      if (found.length > 0) {
        show(found);
        return;
      }
      if (adjusting) {
        // The sub-screen's "Continuar" goes on, like step 2's (mockup 15, D5).
        advance(3);
      } else if (step === 4) {
        onSubmit?.(current);
      } else {
        advance((step + 1) as WizardStep);
      }
    },
    openAdjust: () => {
      const current = form.getValues();
      if (!current.installments) {
        const rows = rowsOf(current).map((row) => ({
          amountCents: row.amountCents,
          dueDate: row.dueDate,
          edited: false,
        }));
        form.setValue("installments", rows, { shouldDirty: true });
      }
      setAdjusting(true);
      setIssues([]);
      focusTarget.current = "heading";
    },
    preview,
    replace: write,
    report: (issue) => {
      const to = stepOfField(issue.field);
      setStep(to);
      setAdjusting(
        to === 2 &&
          issue.field.startsWith("installments") &&
          form.getValues().installments !== null
      );
      show([issue]);
    },
    setValue: (key, value) => {
      write(applyChange(form.getValues(), key, value));
      setIssues((all) =>
        all.filter(
          (issue) =>
            issue.field !== key &&
            !(key === "installments" && issue.field.startsWith("installments"))
        )
      );
    },
    step,
    stepHeadingRef,
    today,
    values,
    warningFor: (field) => warnings.find((warning) => warning.field === field),
  };
}
