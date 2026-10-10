import {
  CalendarDots,
  CheckSquare,
  EnvelopeSimple,
  Handshake,
  User,
} from "@phosphor-icons/react";
import { IconTile } from "@/components/ui/icon-tile";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { m } from "@/paraglide/messages.js";
import type { ContractWizard } from "../hooks/use-contract-wizard";
import { reviewView } from "../lib/review-view";
import { ReviewRow, TileAnchor } from "./review-rows";
import { StepHeading } from "./step-heading";

/**
 * Step 4 (mockup 15, D4, with ajuste-15 §5.2): beside the preview (≥ 1140)
 * only what the card does not show (the invite's e-mail and who confirms);
 * below 1140, with the preview folded away, the whole review with "Editar".
 */
export function StepReview({ wizard }: { wizard: ContractWizard }) {
  const view = reviewView(wizard.values, wizard.preview, wizard.locale);
  return (
    <>
      <StepHeading
        headingRef={wizard.stepHeadingRef}
        lead={m.wizard_review_lead()}
        title={m.wizard_review_question()}
      />
      <ul
        className="mt-[22px] stage:hidden divide-y divide-divider overflow-hidden rounded-card bg-surface-card"
        data-testid="review-full"
      >
        <ReviewRow
          anchor={<TileAnchor icon={Handshake} />}
          detail={view.aboutDetail}
          label={m.wizard_step_about()}
          line={view.aboutLine}
          onEdit={() => wizard.goTo(1)}
        />
        <ReviewRow
          anchor={<TileAnchor icon={CalendarDots} />}
          detail={view.scheduleDetail}
          label={m.wizard_step_schedule()}
          line={view.scheduleLine}
          onEdit={() => wizard.goTo(2)}
        />
        <ReviewRow
          anchor={
            view.partyName ? (
              <PersonAvatar name={view.partyName} size="lg" />
            ) : (
              <IconTile icon={User} tone="neutral" />
            )
          }
          detail={view.partyDetail}
          label={m.wizard_step_party()}
          line={view.partyLine}
          onEdit={() => wizard.goTo(3)}
        />
      </ul>
      {view.inviteLine || view.confirmLine ? (
        <ul
          className="mt-[22px] stage:block hidden divide-y divide-divider overflow-hidden rounded-card bg-surface-card"
          data-testid="review-extras"
        >
          {view.inviteLine ? (
            <ReviewRow
              anchor={<TileAnchor icon={EnvelopeSimple} />}
              line={view.inviteLine}
            />
          ) : null}
          {view.confirmLine ? (
            <ReviewRow
              anchor={<TileAnchor icon={CheckSquare} />}
              line={view.confirmLine}
            />
          ) : null}
        </ul>
      ) : null}
    </>
  );
}
