import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { StepFrame, StepHeader } from "@/components/layout/step-frame";
import { ContractPreviewCard } from "@/components/preview/contract-preview-card";
import { PreviewStage } from "@/components/preview/preview-stage";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { invitePreviewModel } from "../lib/invite-preview-model";
import type { ViewScreen } from "../lib/invite-screen";
import { InviteDecision } from "./invite-decision";
import { InviteRail } from "./invite-rail";
import { InviteStatus } from "./invite-status";
import { OwnerInvite } from "./owner-invite";

/** The invite in the wizard's full-screen frame (DIRECAO › Telas › Convite): the trail, the stage, the answer centered. */
export function InviteFrame({
  screen,
  token,
}: {
  screen: ViewScreen;
  token: string;
}) {
  const locale = getLocale();
  const canGoBack = useCanGoBack();
  const router = useRouter();
  const navigate = useNavigate();
  const close = () =>
    canGoBack ? router.history.back() : navigate({ to: "/" });
  return (
    <StepFrame
      align="center"
      header={
        <StepHeader brand onClose={close} title={m.invite_rail_group()} />
      }
      onClose={close}
      rail={
        <InviteRail
          accepted={screen.view.status === "accepted"}
          createdAt={screen.view.contract.createdAt}
          invitee={
            screen.kind === "owner"
              ? (screen.view.inviteeName ?? screen.view.emailMasked)
              : undefined
          }
          inviterName={screen.view.inviterName}
        />
      }
      stage={
        // The owner sees the invite they sent (H6), and an ended invite seen from another
        // account has no terms: neither gets the wizard's placeholders.
        screen.kind === "owner" || screen.view.terms === null ? undefined : (
          <PreviewStage>
            <ContractPreviewCard
              locale={locale}
              model={invitePreviewModel(screen.view)}
              showProgress={false}
            />
          </PreviewStage>
        )
      }
    >
      {screen.kind === "decide" ? (
        <InviteDecision token={token} view={screen.view} />
      ) : null}
      {screen.kind === "owner" ? (
        <OwnerInvite token={token} view={screen.view} />
      ) : null}
      {screen.kind !== "decide" && screen.kind !== "owner" ? (
        <InviteStatus kind={screen.kind} token={token} view={screen.view} />
      ) : null}
    </StepFrame>
  );
}
