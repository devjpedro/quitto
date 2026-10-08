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
import { m } from "@/paraglide/messages.js";
import { useContractWizard } from "../hooks/use-contract-wizard";
import { DiscardDialog } from "./discard-dialog";
import { StepAbout } from "./step-about";
import { STEP_LABEL, WizardRail } from "./wizard-rail";

/**
 * /contracts/new (spec §5, mockup 15 in full screen). Nothing here reads
 * the width: one HTML for every screen, the CSS picks (planner's decision
 * 19). The phone's sheet over Agora is the ＋'s View Transition (decision 31).
 */
export function ContractWizardPage() {
  useDocumentTitle(PAGE_TITLE.contractNew);
  const { title } = useSearch({ from: "/_focus/contracts/new" });
  const wizard = useContractWizard({ titleFromSearch: title });
  const keyboard = useVisualViewportInset() >= KEYBOARD_MIN_PX;
  const reduced = useReducedMotion();
  const { step } = wizard;
  return (
    <>
      <StepFrame
        footer={
          <Button block onClick={wizard.next} size="lg">
            {step === 4 ? m.wizard_create() : m.wizard_continue()}
          </Button>
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
            // A flex column that can shrink: the one-by-one list (Task 7) scrolls inside it from md.
            className="flex min-h-0 flex-1 flex-col"
            data-testid="wizard-step"
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -12 }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 12 }}
            key={`${step}-${wizard.adjusting}`}
            transition={{ duration: 0.16 }}
          >
            {step === 1 ? <StepAbout wizard={wizard} /> : null}
          </motion.div>
        </AnimatePresence>
      </StepFrame>
      <DiscardDialog wizard={wizard} />
    </>
  );
}
