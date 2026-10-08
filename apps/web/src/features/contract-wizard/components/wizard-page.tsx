import { CircleNotch } from "@phosphor-icons/react";
import { useSearch } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { StepFrame, StepHeader } from "@/components/layout/step-frame";
import { StepProgress } from "@/components/layout/step-progress";
import { ContractPreviewCard } from "@/components/preview/contract-preview-card";
import { PreviewStage } from "@/components/preview/preview-stage";
import { PreviewSummary } from "@/components/preview/preview-summary";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import {
  KEYBOARD_MIN_PX,
  useVisualViewportInset,
} from "@/hooks/use-visual-viewport-inset";
import { PAGE_TITLE } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { useContractWizard } from "../hooks/use-contract-wizard";
import { useWizardSubmit } from "../hooks/use-wizard-submit";
import { AdjustInstallments } from "./adjust-installments";
import { AdjustLegend, AdjustSum } from "./adjust-sum";
import { DiscardDialog } from "./discard-dialog";
import { StepAbout } from "./step-about";
import { StepParty } from "./step-party";
import { StepReview } from "./step-review";
import { StepSchedule } from "./step-schedule";
import { STEP_LABEL, WizardRail } from "./wizard-rail";

/**
 * /contracts/new (spec §5, mockup 15 in full screen). Nothing here reads
 * the width: one HTML for every screen, the CSS picks (planner's decision
 * 19). The phone's sheet over Agora is the ＋'s View Transition (decision 31).
 */
export function ContractWizardPage() {
  useDocumentTitle(PAGE_TITLE.contractNew);
  const { title } = useSearch({ from: "/_focus/contracts/new" });
  const submitter = useWizardSubmit();
  const wizard = useContractWizard({
    titleFromSearch: title,
    onSubmit: (values) =>
      submitter.submit(values, (issue) => wizard.report(issue)),
  });
  const keyboard = useVisualViewportInset() >= KEYBOARD_MIN_PX;
  const reduced = useReducedMotion();
  const { step } = wizard;
  const buttonLabel = step === 4 ? m.wizard_create() : m.wizard_continue();
  return (
    <>
      <StepFrame
        footer={
          // In the one-by-one list the sum goes with "Continuar": pinned with
          // it on a phone (E7), right under the list from md (D5/D7).
          <div
            className={cn(
              "flex w-full flex-col gap-2.5",
              wizard.adjusting && "md:-mt-4 md:gap-0"
            )}
          >
            {wizard.adjusting ? <AdjustSum wizard={wizard} /> : null}
            {wizard.adjusting ? <AdjustLegend wizard={wizard} /> : null}
            <Button
              aria-busy={submitter.creating || undefined}
              block
              className={wizard.adjusting ? "md:mt-7" : undefined}
              onClick={wizard.next}
              size="lg"
            >
              {submitter.creating ? (
                <>
                  <CircleNotch
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                    size={16}
                  />
                  {m.wizard_creating()}
                </>
              ) : (
                buttonLabel
              )}
            </Button>
          </div>
        }
        header={
          <StepHeader
            onBack={step > 1 || wizard.adjusting ? wizard.back : undefined}
            onClose={wizard.close}
            title={m.nav_new_contract()}
          />
        }
        onClose={wizard.close}
        progress={
          <StepProgress current={step} label={STEP_LABEL[step]()} total={4} />
        }
        rail={<WizardRail wizard={wizard} />}
        stage={
          <PreviewStage>
            <ContractPreviewCard
              locale={wizard.locale}
              model={wizard.preview}
            />
          </PreviewStage>
        }
        summary={
          <PreviewSummary
            compact={keyboard}
            locale={wizard.locale}
            model={wizard.preview}
          />
        }
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            // Only the one-by-one list shrinks (it scrolls inside, from md); every other step
            // keeps its content height, or a short screen puts the footer over the fields.
            className={cn(
              "flex flex-1 flex-col",
              wizard.adjusting && "min-h-0"
            )}
            data-testid="wizard-step"
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
            key={`${step}-${wizard.adjusting}`}
            transition={{ duration: 0.16 }}
          >
            {step === 1 ? <StepAbout wizard={wizard} /> : null}
            {step === 2 && !wizard.adjusting ? (
              <StepSchedule wizard={wizard} />
            ) : null}
            {step === 2 && wizard.adjusting ? (
              <AdjustInstallments wizard={wizard} />
            ) : null}
            {step === 3 ? <StepParty wizard={wizard} /> : null}
            {step === 4 ? <StepReview wizard={wizard} /> : null}
          </motion.div>
        </AnimatePresence>
      </StepFrame>
      <DiscardDialog wizard={wizard} />
    </>
  );
}
