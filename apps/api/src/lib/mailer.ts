import { Resend } from "resend";
import { env } from "../env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export interface SendEmailInput {
  html: string;
  subject: string;
  to: string;
}

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailInput): Promise<void> {
  if (!resend) {
    if (env.NODE_ENV !== "test") {
      console.warn(
        `[mailer] RESEND_API_KEY ausente — e-mail não enviado: "${subject}" -> ${to}`
      );
    }
    return;
  }
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`Falha ao enviar e-mail: ${error.message}`);
  }
}
