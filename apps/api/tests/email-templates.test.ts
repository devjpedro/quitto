import { describe, expect, it } from "bun:test";
import {
  inviteEmail,
  resetPasswordEmail,
  verificationEmail,
} from "../src/lib/email-templates";

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
