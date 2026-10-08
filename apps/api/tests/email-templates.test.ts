import { describe, expect, it } from "bun:test";
import type { Locale } from "@quitto/shared";
import { env } from "../src/env";
import {
  escapeHtml,
  inviteEmail,
  reminderDigestEmail,
  resetPasswordEmail,
  verificationEmail,
} from "../src/lib/email-templates";
import { formatCents } from "../src/lib/money";

const LOCALES: Locale[] = ["pt-BR", "en-US"];
const TEAL = /0f766e/i;

function allEmails(locale: Locale) {
  return [
    resetPasswordEmail("https://app.test/reset?token=abc", locale),
    verificationEmail("https://app.test/verify?token=xyz", locale),
    inviteEmail({
      acceptUrl: "https://app.test/invites/tok",
      contractTitle: "Moto do Rafa",
      inviterName: "João Souza",
      locale,
      role: "buyer",
    }),
    reminderDigestEmail({
      homeUrl: "https://app.test/",
      items: [item],
      locale,
      name: "Ana",
      settingsUrl: "https://app.test/settings",
    }),
  ];
}

const item = {
  contractTitle: "Aluguel <script>alert(1)</script> & cia",
  contractUrl: "https://app.test/contracts/c1",
  sequence: 3,
  amountCents: 125_000,
  dueDate: "2026-10-04",
  overdue: false,
  direction: "pay" as const,
};
const urls = {
  homeUrl: "https://app.test/",
  settingsUrl: "https://app.test/settings",
};

describe("email-templates", () => {
  it("cada e-mail nos dois idiomas: o assunto, o lang do html e o botão", () => {
    const subjects: Record<Locale, string[]> = {
      "pt-BR": [
        "Crie uma nova senha no Quitto",
        "Confirme seu e-mail no Quitto",
        "João Souza te convidou para um contrato no Quitto",
        "Lembrete: a parcela 3 de Aluguel <script>alert(1)</script> & cia vence em 04/10/2026",
      ],
      "en-US": [
        "Create a new Quitto password",
        "Confirm your email on Quitto",
        "João Souza invited you to a contract on Quitto",
        "Reminder: installment 3 of Aluguel <script>alert(1)</script> & cia is due on 10/04/2026",
      ],
    };
    const buttons: Record<Locale, string[]> = {
      "pt-BR": [
        "Criar nova senha",
        "Confirmar e-mail",
        "Ver o convite",
        "Abrir o Quitto",
      ],
      "en-US": [
        "Create new password",
        "Confirm email",
        "See the invite",
        "Open Quitto",
      ],
    };
    for (const locale of LOCALES) {
      const emails = allEmails(locale);
      emails.forEach((e, i) => {
        expect(e.subject).toBe(subjects[locale][i] as string);
        expect(e.html).toContain(`<html lang="${locale}">`);
        expect(e.html).toContain(buttons[locale][i] as string);
      });
    }
  });

  it("nada de teal: o html não tem #0f766e e o botão é #111111", () => {
    for (const locale of LOCALES) {
      for (const e of allEmails(locale)) {
        expect(e.html).not.toMatch(TEAL);
        expect(e.html).toContain("background:#111111");
      }
    }
  });

  it("o topo é o ícone do app vindo do WEB_ORIGIN", () => {
    for (const e of allEmails("pt-BR")) {
      expect(e.html).toContain(`src="${env.WEB_ORIGIN}/icon-192.png"`);
      expect(e.html).toContain('alt="Quitto"');
    }
  });

  it("o link vem no corpo, escapado no atributo", () => {
    const url = "https://app.test/reset-password?token=abc&x=1";
    expect(resetPasswordEmail(url, "pt-BR").html).toContain(
      "https://app.test/reset-password?token=abc&amp;x=1"
    );
  });
});

describe("inviteEmail", () => {
  it("o papel na palavra da casa (quem paga / the payer), e o nome e o título escapados", () => {
    const base = {
      acceptUrl: "https://app.test/invites/tok123",
      contractTitle: "Aluguel <b>2026</b>",
      inviterName: "João <i>",
    };
    const pt = inviteEmail({ ...base, locale: "pt-BR", role: "buyer" });
    expect(pt.html).toContain("quem paga");
    expect(pt.html).toContain("https://app.test/invites/tok123");
    expect(pt.html).toContain("Aluguel &lt;b&gt;2026&lt;/b&gt;");
    expect(pt.html).toContain("João &lt;i&gt;");
    expect(pt.html).not.toContain("<b>2026");
    const en = inviteEmail({ ...base, locale: "en-US", role: "buyer" });
    expect(en.html).toContain("the payer");
    expect(
      inviteEmail({ ...base, locale: "en-US", role: "seller" }).html
    ).toContain("the payee");
  });

  it("traz o avatar de quem convidou e as condições", () => {
    const { html } = inviteEmail({
      acceptUrl: "https://app.test/invites/t",
      contractTitle: "Moto do Rafa",
      inviterName: "João Souza",
      locale: "pt-BR",
      role: "buyer",
      terms: {
        amountCents: 120_000,
        firstDueDate: "2026-11-10",
        installmentsCount: 10,
        totalCents: 1_200_000,
      },
    });
    expect(html).toContain(">JS<");
    expect(html).toContain(
      "10 parcelas de R$ 1.200,00 · 1º vencimento em 10/11/2026"
    );
    const uneven = inviteEmail({
      acceptUrl: "https://app.test/invites/t",
      contractTitle: "Moto",
      inviterName: "João",
      locale: "en-US",
      role: "seller",
      terms: {
        amountCents: null,
        firstDueDate: "2026-11-10",
        installmentsCount: 3,
        totalCents: 100_000,
      },
    });
    expect(uneven.html).toContain(
      "3 installments, R$1,000.00 in total · first due on 11/10/2026"
    );
  });
});

describe("escapeHtml", () => {
  it("escapa os caracteres especiais", () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;"
    );
  });
});

describe("reminderDigestEmail", () => {
  it("lembrete: assunto singular com a data no formato do idioma, plural com a contagem, a pagar/a receber e o link de desligar", () => {
    const pt = reminderDigestEmail({
      name: "Ana",
      items: [item],
      locale: "pt-BR",
      ...urls,
    });
    expect(pt.subject).toBe(
      "Lembrete: a parcela 3 de Aluguel <script>alert(1)</script> & cia vence em 04/10/2026"
    );
    expect(
      reminderDigestEmail({
        name: "Ana",
        items: [{ ...item, overdue: true }],
        locale: "pt-BR",
        ...urls,
      }).subject
    ).toBe(
      "Lembrete: a parcela 3 de Aluguel <script>alert(1)</script> & cia está atrasada"
    );
    expect(
      reminderDigestEmail({
        name: "Ana",
        items: [item, { ...item, sequence: 4 }],
        locale: "en-US",
        ...urls,
      }).subject
    ).toBe("You have 2 installment reminders on Quitto");
    const { html } = reminderDigestEmail({
      name: "Ana",
      items: [item, { ...item, direction: "receive", overdue: true }],
      locale: "pt-BR",
      ...urls,
    });
    expect(html).toContain("a pagar");
    expect(html).toContain("a receber");
    expect(html).toContain(formatCents(125_000, "pt-BR"));
    expect(html).toContain('href="https://app.test/settings"');
    expect(html).toContain("Desligar");
  });

  it("o tile da data e o estado em texto: vence hoje e atrasada", () => {
    const { html } = reminderDigestEmail({
      name: "Ana",
      items: [
        { ...item, dueDate: "2026-10-08" },
        { ...item, dueDate: "2026-10-01", overdue: true },
      ],
      locale: "pt-BR",
      today: "2026-10-08",
      ...urls,
    });
    expect(html).toContain(">8<");
    expect(html).toContain("OUT");
    expect(html).toContain("vence hoje");
    expect(html).toContain("atrasada");
    expect(html).toContain("venceu em 01/10/2026");
  });

  it("escapa HTML e URLs em atributos href", () => {
    const bad = 'https://app.test/x"><script>';
    const { html } = reminderDigestEmail({
      name: "Ana <b>",
      items: [{ ...item, contractUrl: bad }],
      locale: "pt-BR",
      homeUrl: bad,
      settingsUrl: bad,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).not.toContain('"><script>');
    expect(html).toContain("https://app.test/x&quot;&gt;&lt;script&gt;");
  });

  it("normaliza quebras de linha no assunto", () => {
    const { subject } = reminderDigestEmail({
      name: "Ana",
      items: [{ ...item, contractTitle: "Aluguel\r\nBcc: x@y.z" }],
      locale: "pt-BR",
      ...urls,
    });
    expect(subject).toBe(
      "Lembrete: a parcela 3 de Aluguel Bcc: x@y.z vence em 04/10/2026"
    );
  });
});
