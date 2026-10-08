import { todayISO } from "@quitto/shared";
import {
  ActionPiece,
  MomentPiece,
  PaidPiece,
  ReceiptPiece,
} from "@/components/stage/showcase-pieces";
import { StagePanel } from "@/components/stage/stage-panel";
import { Emphasis } from "@/components/ui/emphasis";
import { PersonAvatar } from "@/components/ui/person-avatar";
import type { PublicInvitePreview } from "@/features/invites/api";
import { roleLabel } from "@/features/invites/lib/invite-format";
import { inviteTerms } from "@/lib/invite-terms-text";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { InviteChips, InvitePiece, InviteTrail } from "./stage-invite";
import { MailPiece } from "./stage-mail";

export type AuthStageKind = "check-email" | "invite" | "showcase";

/** The tagline: the headline and its line, at the foot of the panel from `lg`. */
function Tagline() {
  return (
    <div className="absolute inset-x-12 bottom-[46px] max-lg:hidden">
      <p className="whitespace-pre-line font-display font-semibold text-[64px] text-on-brand leading-[.98] tracking-[-0.045em]">
        {m.auth_stage_headline()}
      </p>
      <p className="mt-[18px] max-w-[460px] text-base text-on-brand-muted leading-[1.45]">
        {m.auth_stage_sub()}
      </p>
    </div>
  );
}

/** From `lg` the pieces float in a 640 × 440 box centered on the panel; a narrower laptop scales it down. */
function Column({
  children,
  className,
  decorative = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** False when the column carries what the form does not repeat (the invite's who, what and terms). */
  decorative?: boolean;
}) {
  return (
    <div
      aria-hidden={decorative ? "true" : undefined}
      className={cn(
        "absolute top-20 left-1/2 -ml-80 hidden h-[440px] w-[640px] origin-top lg:block lg:max-xl:scale-[.8]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** The phone: the header with two pieces (mockup 19, A2). */
function PhoneHeader() {
  return (
    <>
      <p className="absolute top-[66px] left-5 whitespace-pre-line font-display font-semibold text-[36px] text-on-brand leading-none tracking-[-0.04em] lg:hidden">
        {m.auth_stage_headline()}
      </p>
      <div aria-hidden="true" className="lg:hidden">
        <MomentPiece
          className="absolute top-[176px] left-5 w-[208px] gap-3 px-3.5 py-3"
          ringSize={38}
        />
        <ReceiptPiece
          className="absolute top-[150px] left-[240px] w-[132px]"
          compact
        />
      </div>
    </>
  );
}

function ShowcaseStage() {
  return (
    <>
      <Column>
        <ActionPiece className="absolute top-[62px] left-[150px]" />
        <MomentPiece className="absolute top-0 left-[404px] w-[252px]" />
        <ReceiptPiece className="absolute top-[318px] left-1.5 w-[232px] -rotate-3" />
        <PaidPiece className="absolute top-[362px] left-[330px]" />
      </Column>
      <Tagline />
      <PhoneHeader />
    </>
  );
}

function InviteStage({
  preview,
  raw,
}: {
  preview: PublicInvitePreview;
  raw: NonNullable<PublicInvitePreview["terms"]>;
}) {
  const terms = inviteTerms(raw, todayISO(), getLocale());
  const role = roleLabel(preview.role);
  return (
    <>
      <Column className="top-24 -ml-[200px] w-[400px]" decorative={false}>
        <InvitePiece preview={preview} terms={raw} />
      </Column>
      <div className="absolute inset-x-12 bottom-[46px] max-lg:hidden">
        <InviteTrail preview={preview} />
      </div>
      {/* The phone: the invite is the header's text, and the trail its chips (A4m). */}
      <div className="absolute inset-x-5 top-[62px] lg:hidden">
        <p className="flex items-center gap-2 text-on-brand-muted text-sm">
          <PersonAvatar name={preview.inviterName} size="md" />
          <Emphasis
            strong={preview.inviterName}
            strongClassName="text-on-brand"
            text={m.auth_stage_invited_you({ name: preview.inviterName })}
          />
        </p>
        <p className="mt-3 font-display font-semibold text-[30px] text-on-brand leading-[1.05] tracking-[-0.04em]">
          {preview.contractTitle}
        </p>
        <p className="mt-2 text-[13px] text-on-brand-muted tabular-nums">
          {terms.from
            ? `${terms.amount} ${m.home_dot_after({ text: terms.from })}`
            : terms.amount}
        </p>
        <p className="mt-0.5 text-[13px] text-on-brand-muted">
          <Emphasis
            strong={role}
            strongClassName="text-on-brand"
            text={m.invite_role({ role })}
          />
        </p>
      </div>
      <InviteChips preview={preview} />
    </>
  );
}

/**
 * The showcase's content (mockup 19, direction A): the product's own pieces,
 * the invite behind the sign-in, or the e-mail that was just sent.
 */
export function AuthStage({
  invite,
  kind,
  mail = "verify",
}: {
  invite: PublicInvitePreview | null;
  kind: AuthStageKind;
  /** Which e-mail the "check-email" stage shows. */
  mail?: "reset" | "verify";
}) {
  const raw = invite?.terms ?? null;
  const asInvite = kind === "invite" && invite !== null && raw !== null;
  return (
    <StagePanel
      className={cn(
        "rounded-b-frame max-lg:h-[262px] lg:min-h-[836px] lg:rounded-frame",
        asInvite && "max-lg:h-[300px]"
      )}
      data-testid={asInvite ? "login-invite" : undefined}
    >
      {asInvite ? <InviteStage preview={invite} raw={raw} /> : null}
      {kind === "check-email" ? (
        <>
          <Column className="top-[118px] -ml-[210px] w-[420px]">
            <MailPiece mail={mail} />
          </Column>
          <Tagline />
          <PhoneHeader />
        </>
      ) : null}
      {kind === "showcase" || (kind === "invite" && !asInvite) ? (
        <ShowcaseStage />
      ) : null}
    </StagePanel>
  );
}
