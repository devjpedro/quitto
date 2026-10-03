import {
  FileMagnifyingGlass,
  QrCode,
  WhatsappLogo,
} from "@phosphor-icons/react";
import type { Locale } from "@quitto/shared";
import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  chargeMessage,
  whatsappUrl,
} from "@/features/installments/lib/whatsapp-message";
import { m } from "@/paraglide/messages.js";
import { type ActionButtonKind, LINK_BUTTONS } from "../lib/action-view";
import type { HomeAction } from "../types";

export type CardButtonVariant = "onBrand" | "onBrandOutline" | "secondary";

const LABEL: Record<ActionButtonKind, () => string> = {
  pix: m.home_action_pix,
  mark_paid: m.home_action_mark_paid,
  send_proof: m.home_action_send_proof,
  whatsapp: m.home_action_whatsapp,
  mark_received: m.home_action_mark_received,
  review: m.home_action_review,
  confirm: m.home_action_confirm,
  resend_proof: m.home_action_resend_proof,
  accept: m.home_action_accept,
  decline: m.home_action_decline,
};

function ButtonIcon({ kind }: { kind: ActionButtonKind }) {
  if (kind === "pix") {
    return <QrCode aria-hidden="true" size={16} weight="bold" />;
  }
  if (kind === "whatsapp") {
    return <WhatsappLogo aria-hidden="true" size={16} />;
  }
  if (kind === "review") {
    return <FileMagnifyingGlass aria-hidden="true" size={16} />;
  }
  return null;
}

export function ActionButton({
  action,
  busy,
  kind,
  locale,
  onRun,
  today,
  tryLock,
  variant,
}: {
  action: HomeAction;
  busy: boolean;
  kind: ActionButtonKind;
  locale: Locale;
  onRun: (kind: ActionButtonKind) => void;
  today: string;
  tryLock: () => boolean;
  variant: CardButtonVariant;
}) {
  const label = LABEL[kind]();
  // A link runs no mutation, but it still answers to the list's lock: the
  // second hit of a double tap must not open the card that slid into place.
  const guard = (event: MouseEvent) => {
    if (!tryLock()) {
      event.preventDefault();
    }
  };
  if (action.kind !== "invite" && kind === "whatsapp") {
    const href = whatsappUrl(
      chargeMessage({ ...action, todayISO: today }, locale)
    );
    return (
      <Button asChild size="sm" variant={variant}>
        <a
          href={href}
          onClick={guard}
          rel="noopener noreferrer"
          target="_blank"
        >
          <ButtonIcon kind={kind} />
          {label}
          {/* The space lives outside the span: the name computation trims an
              element's own text, so inside it the two words would glue. */}{" "}
          <span className="sr-only">{m.home_action_whatsapp_hint()}</span>
        </a>
      </Button>
    );
  }
  if (action.kind !== "invite" && LINK_BUTTONS.has(kind)) {
    return (
      <Button asChild size="sm" variant={variant}>
        <Link
          onClick={guard}
          params={{ id: action.contractId }}
          search={{ installment: action.installmentId }}
          to="/contracts/$id"
        >
          <ButtonIcon kind={kind} />
          {label}
        </Link>
      </Button>
    );
  }
  return (
    <Button
      disabled={busy}
      onClick={() => onRun(kind)}
      size="sm"
      variant={variant}
    >
      <ButtonIcon kind={kind} />
      {label}
    </Button>
  );
}
