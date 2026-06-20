import { describe, expect, it } from "bun:test";
import { sendEmail } from "../src/lib/mailer";

describe("mailer", () => {
  it("faz no-op (não lança) quando RESEND_API_KEY está ausente", async () => {
    // Em teste não há RESEND_API_KEY → não deve lançar.
    await expect(
      sendEmail({ to: "a@b.com", subject: "Oi", html: "<p>oi</p>" })
    ).resolves.toBeUndefined();
  });
});
