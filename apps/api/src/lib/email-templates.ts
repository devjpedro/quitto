import { formatISODateBR } from "./dates";
import { formatCentsBRL } from "./money";

const DEFAULT_FOOTER = "Se você não solicitou, ignore este e-mail.";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BRAND = "Quitto";
const ACCENT = "#0f766e";

function layout(
  heading: string,
  bodyHtml: string,
  ctaLabel: string,
  ctaUrl: string,
  footerHtml = DEFAULT_FOOTER
): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#3a352e">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:12px;padding:32px">
          <tr><td>
            <p style="font-size:18px;font-weight:700;color:${ACCENT};margin:0 0 24px">${BRAND}</p>
            <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
            ${bodyHtml}
            <p style="margin:24px 0">
              <a href="${ctaUrl}" style="background:${ACCENT};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block">${ctaLabel}</a>
            </p>
            <p style="font-size:12px;color:#8a8378;margin:24px 0 0">${footerHtml}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function resetPasswordEmail(resetUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Redefinir sua senha no Quitto",
    html: layout(
      "Redefinir senha",
      '<p style="margin:0">Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>',
      "Redefinir senha",
      resetUrl
    ),
  };
}

export function verificationEmail(verifyUrl: string): {
  subject: string;
  html: string;
} {
  return {
    subject: "Verifique seu e-mail no Quitto",
    html: layout(
      "Confirme seu e-mail",
      '<p style="margin:0">Falta pouco! Confirme seu e-mail para começar a usar o Quitto.</p>',
      "Verificar e-mail",
      verifyUrl
    ),
  };
}

export function inviteEmail(args: {
  acceptUrl: string;
  inviterName: string;
  contractTitle: string;
  roleLabel: string;
}): { subject: string; html: string } {
  const body = `<p style="margin:0"><strong>${args.inviterName}</strong> convidou você para o contrato <strong>${args.contractTitle}</strong> como <strong>${args.roleLabel}</strong> no Quitto.</p><p style="margin:12px 0 0;color:#8a8378;font-size:14px">Acesse para aceitar. Se ainda não tem conta, é rápido criar uma com este e-mail.</p>`;
  return {
    subject: "Convite para um contrato no Quitto",
    html: layout("Você foi convidado", body, "Ver convite", args.acceptUrl),
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

function itemWhen(i: ReminderEmailItem): string {
  return i.overdue
    ? `venceu em ${formatISODateBR(i.dueDate)}`
    : `vence em ${formatISODateBR(i.dueDate)}`;
}

export function reminderDigestEmail(args: {
  homeUrl: string;
  items: ReminderEmailItem[];
  name: string;
  settingsUrl: string;
}): { subject: string; html: string } {
  const [first] = args.items;
  const subject =
    args.items.length === 1 && first
      ? `Lembrete: parcela ${first.sequence} de ${first.contractTitle} ${
          first.overdue
            ? "está vencida"
            : `vence em ${formatISODateBR(first.dueDate)}`
        }`
      : `Você tem ${args.items.length} lembretes de parcelas no Quitto`;
  const rows = args.items
    .map(
      (i) =>
        `<li style="margin:0 0 8px"><a href="${i.contractUrl}" style="color:${ACCENT}">${escapeHtml(i.contractTitle)}</a> · parcela ${i.sequence} · ${formatCentsBRL(i.amountCents)} · ${itemWhen(i)} <span style="color:#8a8378">(${i.direction === "pay" ? "a pagar" : "a receber"})</span></li>`
    )
    .join("");
  const body = `<p style="margin:0 0 12px">Olá, ${escapeHtml(args.name)}. Estas parcelas pedem sua atenção:</p><ul style="margin:0;padding-left:18px">${rows}</ul>`;
  const footer = `Você recebe estes e-mails porque ativou lembretes por e-mail. <a href="${args.settingsUrl}" style="color:#8a8378">Desativar</a>`;
  return {
    subject,
    html: layout(
      "Lembretes de parcelas",
      body,
      "Abrir o Quitto",
      args.homeUrl,
      footer
    ),
  };
}
