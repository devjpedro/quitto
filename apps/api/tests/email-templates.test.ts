import { describe, expect, it } from "bun:test";
import {
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
