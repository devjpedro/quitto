import type { Locale } from "@quitto/shared";

export interface EmailText {
  footerDefault: string;
  invite: {
    aContract: string;
    body: (a: { inviter: string; role: string; title: string }) => string;
    cta: string;
    footer: (a: { inviter: string }) => string;
    heading: string;
    hint: string;
    someone: string;
    subject: (a: { inviter: string }) => string;
    termsEven: (a: { amount: string; count: number; date: string }) => string;
    termsUneven: (a: { count: number; date: string; total: string }) => string;
  };
  reminder: {
    cta: string;
    dueToday: string;
    heading: string;
    installment: (a: { n: number }) => string;
    intro: (a: { name: string }) => string;
    optOut: string;
    footer: string;
    overdueTag: string;
    pay: string;
    receive: string;
    subjectDue: (a: { date: string; n: number; title: string }) => string;
    subjectMany: (a: { count: number }) => string;
    subjectOverdue: (a: { n: number; title: string }) => string;
  };
  reset: { body: string; cta: string; heading: string; subject: string };
  roles: { buyer: string; seller: string; viewer: string };
  verify: { body: string; cta: string; heading: string; subject: string };
}

export const EMAIL_TEXT: Record<Locale, EmailText> = {
  "pt-BR": {
    footerDefault: "Se você não pediu isso, pode ignorar este e-mail.",
    reset: {
      subject: "Crie uma nova senha no Quitto",
      heading: "Nova senha",
      body: "Recebemos um pedido para trocar a senha da sua conta. O link vale por 1 hora.",
      cta: "Criar nova senha",
    },
    verify: {
      subject: "Confirme seu e-mail no Quitto",
      heading: "Confirme seu e-mail",
      body: "Falta pouco: confirme o e-mail para entrar no Quitto.",
      cta: "Confirmar e-mail",
    },
    invite: {
      subject: ({ inviter }) =>
        `${inviter} te convidou para um contrato no Quitto`,
      heading: "Um convite para você",
      body: ({ inviter, title, role }) =>
        `<strong>${inviter}</strong> te convidou para o contrato <strong>${title}</strong>, como <strong>${role}</strong>.`,
      hint: "Ainda não tem conta? Crie com este e-mail e o convite fica esperando por você.",
      cta: "Ver o convite",
      footer: ({ inviter }) =>
        `Não conhece ${inviter}? Pode ignorar este e-mail: nada muda até você aceitar.`,
      someone: "Alguém",
      aContract: "um contrato",
      termsEven: ({ count, amount, date }) =>
        `${count} parcelas de ${amount} · 1º vencimento em ${date}`,
      termsUneven: ({ count, total, date }) =>
        `${count} parcelas, ${total} no total · 1º vencimento em ${date}`,
    },
    roles: {
      buyer: "quem paga",
      seller: "quem recebe",
      viewer: "quem acompanha",
    },
    reminder: {
      subjectDue: ({ n, title, date }) =>
        `Lembrete: a parcela ${n} de ${title} vence em ${date}`,
      subjectOverdue: ({ n, title }) =>
        `Lembrete: a parcela ${n} de ${title} está atrasada`,
      subjectMany: ({ count }) =>
        `Você tem ${count} lembretes de parcelas no Quitto`,
      heading: "Lembretes de parcelas",
      intro: ({ name }) => `Oi, ${name}. Estas parcelas pedem sua atenção:`,
      installment: ({ n }) => `parcela ${n}`,
      dueToday: "vence hoje",
      overdueTag: "atrasada",
      pay: "a pagar",
      receive: "a receber",
      cta: "Abrir o Quitto",
      footer: "Você recebe estes e-mails porque ligou os lembretes por e-mail.",
      optOut: "Desligar",
    },
  },
  "en-US": {
    footerDefault: "If you didn't ask for this, you can ignore this email.",
    reset: {
      subject: "Create a new Quitto password",
      heading: "New password",
      body: "We got a request to change your account password. The link works for 1 hour.",
      cta: "Create new password",
    },
    verify: {
      subject: "Confirm your email on Quitto",
      heading: "Confirm your email",
      body: "Almost there: confirm your email to sign in to Quitto.",
      cta: "Confirm email",
    },
    invite: {
      subject: ({ inviter }) =>
        `${inviter} invited you to a contract on Quitto`,
      heading: "An invitation for you",
      body: ({ inviter, title, role }) =>
        `<strong>${inviter}</strong> invited you to the contract <strong>${title}</strong> as <strong>${role}</strong>.`,
      hint: "No account yet? Create one with this email and the invite will be waiting for you.",
      cta: "See the invite",
      footer: ({ inviter }) =>
        `Don't know ${inviter}? You can ignore this email: nothing changes until you accept.`,
      someone: "Someone",
      aContract: "a contract",
      termsEven: ({ count, amount, date }) =>
        `${count} installments of ${amount} · first due on ${date}`,
      termsUneven: ({ count, total, date }) =>
        `${count} installments, ${total} in total · first due on ${date}`,
    },
    roles: { buyer: "the payer", seller: "the payee", viewer: "an observer" },
    reminder: {
      subjectDue: ({ n, title, date }) =>
        `Reminder: installment ${n} of ${title} is due on ${date}`,
      subjectOverdue: ({ n, title }) =>
        `Reminder: installment ${n} of ${title} is overdue`,
      subjectMany: ({ count }) =>
        `You have ${count} installment reminders on Quitto`,
      heading: "Installment reminders",
      intro: ({ name }) =>
        `Hi ${name}. These installments need your attention:`,
      installment: ({ n }) => `installment ${n}`,
      dueToday: "due today",
      overdueTag: "overdue",
      pay: "to pay",
      receive: "to receive",
      cta: "Open Quitto",
      footer: "You get these emails because you turned on email reminders.",
      optOut: "Turn off",
    },
  },
};
