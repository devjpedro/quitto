import { beforeEach, describe, expect, it, mock } from "bun:test";

const captured: string[] = [];
mock.module("@sentry/bun", () => ({
  captureException: () => undefined,
  captureMessage: (m: string) => captured.push(m),
}));

const { EMAIL_DAILY_CAP, resetEmailCap, takeEmailSlot } = await import(
  "../src/lib/email-limits"
);
const { sendEmail } = await import("../src/lib/mailer");

describe("mailer", () => {
  beforeEach(() => {
    resetEmailCap();
    captured.length = 0;
  });

  it("faz no-op (não lança) quando RESEND_API_KEY está ausente", async () => {
    // Em teste não há RESEND_API_KEY → não deve lançar.
    await expect(
      sendEmail({ to: "a@b.com", subject: "Oi", html: "<p>oi</p>" })
    ).resolves.toBeUndefined();
  });

  it("o teto diário recusa o 501º e avisa o Sentry uma vez por janela", () => {
    const now = 1_000_000;
    for (let i = 0; i < EMAIL_DAILY_CAP; i++) {
      expect(takeEmailSlot(now)).toBe(true);
    }
    expect(takeEmailSlot(now)).toBe(false);
    expect(takeEmailSlot(now + 1000)).toBe(false);
    expect(captured).toHaveLength(1);
    // Passadas 24h, a janela recomeça.
    expect(takeEmailSlot(now + 24 * 60 * 60 * 1000 + 1)).toBe(true);
  });
});
