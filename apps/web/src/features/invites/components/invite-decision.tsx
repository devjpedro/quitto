import { CheckSquare, Eye, Files, Lightning } from "@phosphor-icons/react";
import { todayISO } from "@quitto/shared";
import { useState } from "react";
import { ContractPreviewCard } from "@/components/preview/contract-preview-card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Emphasis } from "@/components/ui/emphasis";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { inviteTerms } from "@/lib/invite-terms-text";
import { formatRelativeTime } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";
import { type InviteView, useAcceptInvite, useDeclineInvite } from "../api";
import { dayOf, firstName, roleLabel, weekdayDate } from "../lib/invite-format";
import { invitePreviewModel } from "../lib/invite-preview-model";
import { InviteBar } from "./invite-bar";
import { type InfoRow, InviteInfoList } from "./invite-info-list";

/** "Ao aceitar" (mockup 15, G): what changes for this side, in two lines. */
function afterRows(view: InviteView): InfoRow[] {
  const inviter = firstName(view.inviterName);
  if (view.role === "viewer") {
    return [
      {
        icon: Files,
        line: m.invite_after_list(),
        hint: m.invite_after_list_hint(),
      },
      {
        icon: Eye,
        line: m.invite_after_follow(),
        hint: m.invite_after_follow_hint(),
      },
    ];
  }
  const agenda: InfoRow = {
    icon: Lightning,
    line: m.invite_after_agenda({ count: view.terms?.installmentsCount ?? 0 }),
    hint: m.invite_after_agenda_hint(),
  };
  if (view.role === "buyer") {
    return [
      agenda,
      {
        icon: CheckSquare,
        line: m.invite_after_pay(),
        hint: view.requiresConfirmation
          ? m.invite_after_confirm({ name: inviter })
          : m.invite_after_live({ name: inviter }),
      },
    ];
  }
  return [
    agenda,
    {
      icon: CheckSquare,
      line: m.invite_after_receive({ name: inviter }),
      hint: view.requiresConfirmation
        ? m.invite_after_confirm_you()
        : m.invite_after_live_you(),
    },
  ];
}

/**
 * The invite to answer (mockup 15, G1/G2): who invited (28 px face), the
 * contract, the side, the terms in the home card's phrase, what accepting
 * does, Aceitar / Recusar (Recusar asks first), and the validity after the
 * buttons. Below 1140 the flat card takes the terms' place (once per
 * screen, ajuste-15 §5.2).
 */
export function InviteDecision({
  token,
  view,
}: {
  token: string;
  view: InviteView;
}) {
  const locale = getLocale();
  const accept = useAcceptInvite(token);
  const decline = useDeclineInvite(token);
  const [confirming, setConfirming] = useState(false);
  const role = roleLabel(view.role);
  // A pending invite always has its terms; null is only another account's ended one.
  const terms = view.terms ? inviteTerms(view.terms, todayISO(), locale) : null;
  const sent = formatRelativeTime(view.sentAt, Date.now(), locale);
  const model = invitePreviewModel(view);
  const email = view.email ?? view.emailMasked;
  return (
    <>
      <p className="flex items-center gap-2.5 text-ink-muted text-sm leading-[1.35]">
        <PersonAvatar name={view.inviterName} size="md" />
        <Emphasis
          strong={view.inviterName}
          text={`${m.invite_from({ name: view.inviterName })} ${m.home_dot_after({ text: sent })}`}
        />
      </p>
      <h1 className="mt-3.5 font-display font-semibold text-2xl leading-[1.2] tracking-[-0.03em] md:text-[26px]">
        {view.contract.title}
      </h1>
      <p className="mt-2 text-ink-muted text-sm">
        <Emphasis strong={role} text={m.invite_role({ role })} />
      </p>
      {terms ? (
        <p className="mt-1 stage:block hidden text-ink-muted text-sm tabular-nums">
          <Emphasis
            strong={terms.amount}
            text={
              terms.from
                ? `${terms.amount} ${m.home_dot_after({ text: terms.from })}`
                : terms.amount
            }
          />
        </p>
      ) : null}
      <div className="stage:hidden">
        <ContractPreviewCard
          className="mt-[18px]"
          flat
          locale={locale}
          model={{ ...model, rows: model.rows.slice(0, 2) }}
          // The invite does not know the payments: no "0 de 4 pagas" (planner's decision 46).
          showProgress={false}
          showTitle={false}
        />
      </div>
      <InviteInfoList rows={afterRows(view)} title={m.invite_after_title()} />
      {/* Phone: Recusar on the left (G2). From md, Aceitar first (G1). */}
      <InviteBar className="max-md:flex-row-reverse">
        <Button
          aria-busy={accept.isPending || undefined}
          block
          onClick={() => accept.mutate()}
          size="lg"
        >
          {accept.isPending ? m.invite_accepting() : m.invite_accept()}
        </Button>
        <Button
          onClick={() => setConfirming(true)}
          size="lg"
          variant="secondary"
        >
          {m.invite_decline()}
        </Button>
      </InviteBar>
      <p className="mt-3.5 text-[12.5px] text-ink-muted tabular-nums leading-[1.45]">
        <Emphasis
          strong={email}
          text={m.invite_meta({
            email,
            date: weekdayDate(dayOf(view.expiresAt), locale),
          })}
        />
      </p>
      <ConfirmDialog
        cancelLabel={m.invite_decline_cancel()}
        confirmLabel={m.invite_decline_confirm()}
        description={m.invite_decline_description({
          name: firstName(view.inviterName),
        })}
        onConfirm={() =>
          decline.mutate(undefined, { onSettled: () => setConfirming(false) })
        }
        onOpenChange={setConfirming}
        open={confirming}
        pending={decline.isPending}
        title={m.invite_decline_title()}
        tone="danger"
      />
    </>
  );
}
