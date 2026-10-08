import { type Locale, todayISO } from "@quitto/shared";
import { env } from "../env";
import { avatarHex, initialsOf } from "./avatar-color";
import { formatISODate } from "./dates";
import { EMAIL_TEXT } from "./email-text";
import { formatCents } from "./money";

export interface RenderedEmail {
  html: string;
  subject: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = '-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
const INK = "#111111";
const MUTED = "#6F6F6A";
const LINE = "#E9E7E1";
const BRAND = "#1F5A32";
const DANGER = "#B42318";
const TILE = "#F3F2EE";

function layout(args: {
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerHtml: string;
  heading: string;
  locale: Locale;
}): string {
  return `<!doctype html>
<html lang="${args.locale}">
  <body style="margin:0;background:#E6E4DD;font-family:${FONT};color:${INK}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:20px">
          <tr><td style="padding:32px">
            <img src="${escapeHtml(env.WEB_ORIGIN)}/icon-192.png" width="40" height="40" alt="Quitto" style="display:block;border-radius:10px;margin:0 0 24px">
            <h1 style="font-size:22px;line-height:1.25;font-weight:700;color:${INK};margin:0 0 12px">${args.heading}</h1>
            ${args.bodyHtml}
            <p style="margin:24px 0 0">
              <a href="${escapeHtml(args.ctaUrl)}" style="background:${INK};color:#FFFFFF;font-weight:600;text-decoration:none;padding:14px 22px;border-radius:10px;display:inline-block">${args.ctaLabel}</a>
            </p>
          </td></tr>
          <tr><td style="padding:16px 32px 24px;border-top:1px solid ${LINE};font-size:12px;line-height:1.5;color:${MUTED}">${args.footerHtml}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

const P = `font-size:15px;line-height:1.5;color:${INK};margin:0`;
const PS = `font-size:14px;line-height:1.5;color:${MUTED};margin:12px 0 0`;

export function resetPasswordEmail(
  resetUrl: string,
  locale: Locale
): RenderedEmail {
  const t = EMAIL_TEXT[locale];
  return {
    subject: t.reset.subject,
    html: layout({
      locale,
      heading: t.reset.heading,
      bodyHtml: `<p style="${P}">${t.reset.body}</p>`,
      ctaLabel: t.reset.cta,
      ctaUrl: resetUrl,
      footerHtml: t.footerDefault,
    }),
  };
}

export function verificationEmail(
  verifyUrl: string,
  locale: Locale
): RenderedEmail {
  const t = EMAIL_TEXT[locale];
  return {
    subject: t.verify.subject,
    html: layout({
      locale,
      heading: t.verify.heading,
      bodyHtml: `<p style="${P}">${t.verify.body}</p>`,
      ctaLabel: t.verify.cta,
      ctaUrl: verifyUrl,
      footerHtml: t.footerDefault,
    }),
  };
}

/** The conditions the invite carries (from loadInviteTerms): the count, the one amount (null when they differ), the total and the first due date. */
export interface InviteEmailTerms {
  amountCents: number | null;
  firstDueDate: string | null;
  installmentsCount: number;
  totalCents: number;
}

function inviterAvatar(name: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;border-radius:18px;background:${avatarHex(name)};color:#FFFFFF;font-size:13px;font-weight:600;line-height:36px">${escapeHtml(initialsOf(name))}</td></tr></table>`;
}

function termsLine(
  terms: InviteEmailTerms | undefined,
  locale: Locale
): string {
  if (!terms?.firstDueDate || terms.installmentsCount < 1) {
    return "";
  }
  const t = EMAIL_TEXT[locale].invite;
  const date = formatISODate(terms.firstDueDate, locale);
  const text =
    terms.amountCents === null
      ? t.termsUneven({
          count: terms.installmentsCount,
          total: formatCents(terms.totalCents, locale),
          date,
        })
      : t.termsEven({
          count: terms.installmentsCount,
          amount: formatCents(terms.amountCents, locale),
          date,
        });
  return `<p style="font-size:14px;font-weight:600;color:${INK};line-height:1.5;margin:16px 0 0;padding:12px 14px;background:${TILE};border-radius:10px">${escapeHtml(text)}</p>`;
}

export function inviteEmail(args: {
  acceptUrl: string;
  contractTitle: string;
  inviterName: string;
  locale: Locale;
  role: string; // "buyer" | "seller" | "viewer"
  terms?: InviteEmailTerms;
}): RenderedEmail {
  const t = EMAIL_TEXT[args.locale];
  const roleWord =
    (t.roles as Record<string, string>)[args.role] ?? t.roles.viewer;
  const body = `${inviterAvatar(args.inviterName)}<p style="${P}">${t.invite.body(
    {
      inviter: escapeHtml(args.inviterName),
      title: escapeHtml(args.contractTitle),
      role: roleWord,
    }
  )}</p>${termsLine(args.terms, args.locale)}<p style="${PS}">${t.invite.hint}</p>`;
  return {
    subject: t.invite.subject({
      inviter: args.inviterName.replace(/\s+/g, " ").trim(),
    }),
    html: layout({
      locale: args.locale,
      heading: t.invite.heading,
      bodyHtml: body,
      ctaLabel: t.invite.cta,
      ctaUrl: args.acceptUrl,
      footerHtml: t.footerDefault,
    }),
  };
}

export interface ReminderEmailItem {
  amountCents: number;
  contractTitle: string;
  contractUrl: string;
  direction: "pay" | "receive";
  dueDate: string; // YYYY-MM-DD
  overdue: boolean;
  sequence: number;
}

function monthShort(iso: string, locale: Locale): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "")
    .toUpperCase();
}

function reminderRow(
  i: ReminderEmailItem,
  locale: Locale,
  today: string,
  last: boolean
): string {
  const t = EMAIL_TEXT[locale].reminder;
  const day = Number(i.dueDate.slice(8, 10));
  const when = i.overdue
    ? t.overdueSince({ date: formatISODate(i.dueDate, locale) })
    : t.dueOn({ date: formatISODate(i.dueDate, locale) });
  let tag = "";
  if (i.overdue) {
    tag = `<span style="color:${DANGER};font-weight:600">${t.overdueTag}</span> · `;
  } else if (i.dueDate === today) {
    tag = `<span style="color:${BRAND};font-weight:600">${t.dueToday}</span> · `;
  }
  const direction = i.direction === "pay" ? t.pay : t.receive;
  const border = last ? "" : `border-bottom:1px solid ${LINE};`;
  return `<tr>
    <td width="44" valign="top" style="padding:12px 12px 12px 0;${border}"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;border-radius:10px;background:${TILE};text-align:center"><span style="display:block;font-size:17px;font-weight:700;line-height:20px;color:${INK}">${day}</span><span style="display:block;font-size:10px;font-weight:600;line-height:12px;color:${MUTED}">${escapeHtml(monthShort(i.dueDate, locale))}</span></td></tr></table></td>
    <td valign="top" style="padding:12px 0;${border}"><a href="${escapeHtml(i.contractUrl)}" style="color:${BRAND};font-size:15px;font-weight:600;text-decoration:none">${escapeHtml(i.contractTitle)}</a><br><span style="font-size:13px;line-height:1.6;color:${MUTED}">${tag}${t.installment({ n: i.sequence })} · ${formatCents(i.amountCents, locale)} · ${when} · ${direction}</span></td>
  </tr>`;
}

export function reminderDigestEmail(args: {
  homeUrl: string;
  items: ReminderEmailItem[];
  locale: Locale;
  name: string;
  settingsUrl: string;
  today?: string;
}): RenderedEmail {
  const t = EMAIL_TEXT[args.locale].reminder;
  const today = args.today ?? todayISO();
  const [first] = args.items;
  const subjectTitle = first?.contractTitle.replace(/\s+/g, " ").trim() ?? "";
  let subject = t.subjectMany({ count: args.items.length });
  if (args.items.length === 1 && first) {
    subject = first.overdue
      ? t.subjectOverdue({ n: first.sequence, title: subjectTitle })
      : t.subjectDue({
          n: first.sequence,
          title: subjectTitle,
          date: formatISODate(first.dueDate, args.locale),
        });
  }
  const rows = args.items
    .map((i, idx) =>
      reminderRow(i, args.locale, today, idx === args.items.length - 1)
    )
    .join("");
  const body = `<p style="${P};margin-bottom:8px">${t.intro({ name: escapeHtml(args.name) })}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
  const footer = `${t.footer} <a href="${escapeHtml(args.settingsUrl)}" style="color:${MUTED}">${t.optOut}</a>`;
  return {
    subject,
    html: layout({
      locale: args.locale,
      heading: t.heading,
      bodyHtml: body,
      ctaLabel: t.cta,
      ctaUrl: args.homeUrl,
      footerHtml: footer,
    }),
  };
}
