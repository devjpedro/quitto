const BRAND = "Quitto";
const ACCENT = "#0f766e";

function layout(
  heading: string,
  bodyHtml: string,
  ctaLabel: string,
  ctaUrl: string
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
            <p style="font-size:12px;color:#8a8378;margin:24px 0 0">Se você não solicitou, ignore este e-mail.</p>
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
