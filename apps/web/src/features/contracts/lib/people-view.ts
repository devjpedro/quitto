import { APP_TIME_ZONE, isoDateInTimeZone, type Locale } from "@quitto/shared";
import type { TagTone } from "@/components/ui/tag";
import { formatDate } from "@/lib/locale-format";
import { m } from "@/paraglide/messages.js";
import type { ContractDetail, ContractParticipant } from "../types";

export interface PersonRowView {
  actions: ("resend" | "copy_link")[];
  meta: string | null;
  removable: boolean;
  role: { icon: "receive" | "pay" | "watch"; text: string } | null;
  tag: { icon: "envelope" | null; text: string; tone: TagTone } | null;
}

/** "29/06": an instant's day in São Paulo (an evening in Brazil is already tomorrow in UTC). */
const day = (iso: string, locale: Locale) =>
  formatDate(
    isoDateInTimeZone(new Date(iso), APP_TIME_ZONE),
    locale,
    "dayMonth"
  );

function roleOf(role: string, locale: Locale): PersonRowView["role"] {
  const options = { locale };
  if (role === "seller") {
    return { icon: "receive", text: m.people_role_seller({}, options) };
  }
  if (role === "buyer") {
    return { icon: "pay", text: m.people_role_buyer({}, options) };
  }
  return role === "viewer"
    ? { icon: "watch", text: m.people_role_viewer({}, options) }
    : null;
}

function joinParts(parts: (string | null)[], locale: Locale): string | null {
  let out: string | null = null;
  for (const part of parts) {
    if (part !== null) {
      out =
        out === null
          ? part
          : m.contract_join({ left: out, right: part }, { locale });
    }
  }
  return out;
}

function sinceOf(p: ContractParticipant, locale: Locale): string | null {
  if (!p.joinedAt) {
    return null;
  }
  const date = day(p.joinedAt, locale);
  return p.isOwner
    ? m.people_created({ date }, { locale })
    : m.people_since({ date }, { locale });
}

const INVITE_TAG: Record<
  "pending" | "expired" | "declined",
  (locale: Locale) => NonNullable<PersonRowView["tag"]>
> = {
  pending: (locale) => ({
    text: m.people_invite_pending({}, { locale }),
    tone: "warning",
    icon: "envelope",
  }),
  expired: (locale) => ({
    text: m.people_invite_expired({}, { locale }),
    tone: "warning",
    icon: "envelope",
  }),
  declined: (locale) => ({
    text: m.people_invite_declined({}, { locale }),
    tone: "neutral",
    icon: null,
  }),
};

/** One person in People (ajuste 14 §2.2): the tag says what they are; the meta, only what the tag does not. */
export function personRowView(
  p: ContractParticipant,
  ctx: { locale: Locale; viewerIsOwner: boolean }
): PersonRowView {
  const { locale } = ctx;
  const base = {
    role: roleOf(p.role, locale),
    removable: ctx.viewerIsOwner && !p.isOwner,
  };
  const you: PersonRowView["tag"] = p.isMe
    ? { text: m.people_you({}, { locale }), tone: "neutral", icon: null }
    : null;
  if (p.linked) {
    return {
      ...base,
      tag: you,
      meta: joinParts([p.email, sinceOf(p, locale)], locale),
      actions: [],
    };
  }
  if (p.invite) {
    const open = ctx.viewerIsOwner && p.invite.status !== "declined";
    let actions: PersonRowView["actions"] = [];
    if (open) {
      actions = p.invite.url ? ["resend", "copy_link"] : ["resend"];
    }
    return {
      ...base,
      tag: INVITE_TAG[p.invite.status](locale),
      meta: joinParts(
        [
          p.email,
          m.people_sent({ date: day(p.invite.sentAt, locale) }, { locale }),
        ],
        locale
      ),
      actions,
    };
  }
  return {
    ...base,
    tag: {
      text: m.people_name_only({}, { locale }),
      tone: "neutral",
      icon: null,
    },
    meta: null,
    actions: [],
  };
}

/** The other party known only by name (F3 of mockup 14): the dashed invite under the list, for the owner. */
export function inviteCardOf(
  detail: Pick<ContractDetail, "isOwner" | "participants">
): { participant: ContractParticipant; pays: boolean } | null {
  if (!detail.isOwner) {
    return null;
  }
  const other = detail.participants.find(
    (p) =>
      !(p.isOwner || p.linked || p.invite) &&
      (p.role === "buyer" || p.role === "seller")
  );
  return other ? { participant: other, pays: other.role === "buyer" } : null;
}
