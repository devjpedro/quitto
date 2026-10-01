import { describe, expect, it } from "bun:test";
import {
  escapeHtml,
  inviteEmail,
  reminderDigestEmail,
  resetPasswordEmail,
  verificationEmail,
} from "../src/lib/email-templates";
import { formatCentsBRL } from "../src/lib/money";

describe("email-templates", () => {
  it("resetPasswordEmail inclui o link e tem assunto em pt-BR", () => {
    const url = "https://app.test/reset-password?token=abc";
    const { subject, html } = resetPasswordEmail(url);
    expect(subject.toLowerCase()).toContain("senha");
    expect(html).toContain(url);
  });

  it("verificationEmail inclui o link e tem assunto em pt-BR", () => {
    const url = "https://app.test/api/auth/verify-email?token=xyz";
    const { subject, html } = verificationEmail(url);
    expect(subject.toLowerCase()).toContain("verif");
    expect(html).toContain(url);
  });
});

describe("inviteEmail", () => {
  it("inclui o link de aceite, quem convidou e o contrato", () => {
    const { subject, html } = inviteEmail({
      acceptUrl: "https://app.test/invites/tok123",
      inviterName: "João",
      contractTitle: "Aluguel 2026",
      roleLabel: "Comprador",
    });
    expect(subject.toLowerCase()).toContain("convite");
    expect(html).toContain("https://app.test/invites/tok123");
    expect(html).toContain("João");
    expect(html).toContain("Aluguel 2026");
    expect(html).toContain("Comprador");
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

  it("assunto singular com data e enquadramento", () => {
    expect(
      reminderDigestEmail({ name: "Ana", items: [item], ...urls }).subject
    ).toBe(
      "Lembrete: parcela 3 de Aluguel <script>alert(1)</script> & cia vence em 04/10/2026"
    );
    expect(
      reminderDigestEmail({
        name: "Ana",
        items: [{ ...item, overdue: true }],
        ...urls,
      }).subject
    ).toBe(
      "Lembrete: parcela 3 de Aluguel <script>alert(1)</script> & cia está vencida"
    );
  });

  it("assunto plural", () => {
    expect(
      reminderDigestEmail({
        name: "Ana",
        items: [item, { ...item, sequence: 4 }],
        ...urls,
      }).subject
    ).toBe("Você tem 2 lembretes de parcelas no Quitto");
  });

  it("escapa HTML e traz links de contrato e de desativar", () => {
    const { html } = reminderDigestEmail({
      name: "Ana <b>",
      items: [item, { ...item, direction: "receive", overdue: true }],
      ...urls,
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).toContain('href="https://app.test/contracts/c1"');
    expect(html).toContain('href="https://app.test/settings"');
    expect(html).toContain("a pagar");
    expect(html).toContain("a receber");
    expect(html).toContain(formatCentsBRL(125_000));
    expect(html).toContain("R$ 1.250,00");
    expect(html).not.toContain("Se você não solicitou");
  });

  it("escapa URLs em atributos href", () => {
    const bad = 'https://app.test/x"><script>';
    const { html } = reminderDigestEmail({
      name: "Ana",
      items: [{ ...item, contractUrl: bad }],
      homeUrl: bad,
      settingsUrl: bad,
    });
    expect(html).not.toContain('"><script>');
    expect(html).toContain("https://app.test/x&quot;&gt;&lt;script&gt;");
  });

  it("normaliza quebras de linha no assunto", () => {
    const { subject } = reminderDigestEmail({
      name: "Ana",
      items: [{ ...item, contractTitle: "Aluguel\r\nBcc: x@y.z" }],
      ...urls,
    });
    expect(subject).toBe(
      "Lembrete: parcela 3 de Aluguel Bcc: x@y.z vence em 04/10/2026"
    );
  });
});
