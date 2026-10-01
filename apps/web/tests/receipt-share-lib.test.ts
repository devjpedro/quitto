import { describe, expect, it } from "vitest";
import {
  mailtoShareUrl,
  receiptPublicUrl,
  receiptShareMessage,
  whatsappShareUrl,
} from "../src/lib/receipt-share";

const url = receiptPublicUrl("https://usequitto.vercel.app", "abc_DEF-123");
const message = receiptShareMessage({
  sequence: 3,
  installmentsCount: 12,
  title: "Aluguel & condomínio #2 🏠",
  url,
});

describe("receipt-share lib", () => {
  it("monta a URL pública e a mensagem", () => {
    expect(url).toBe("https://usequitto.vercel.app/r/abc_DEF-123");
    expect(message).toBe(
      "Recibo da parcela 3/12 de Aluguel & condomínio #2 🏠: https://usequitto.vercel.app/r/abc_DEF-123"
    );
  });

  it("wa.me codifica a mensagem inteira (sem cortar no & ou #)", () => {
    const wa = new URL(whatsappShareUrl(message));
    expect(wa.origin + wa.pathname).toBe("https://wa.me/");
    expect(wa.searchParams.get("text")).toBe(message);
  });

  it("mailto leva assunto e corpo codificados", () => {
    const href = mailtoShareUrl({
      title: "Aluguel & condomínio #2 🏠",
      sequence: 3,
      installmentsCount: 12,
      message,
    });
    expect(href.startsWith("mailto:?")).toBe(true);
    const qs = new URLSearchParams(href.slice("mailto:?".length));
    expect(qs.get("subject")).toBe(
      "Recibo da parcela 3/12 — Aluguel & condomínio #2 🏠"
    );
    expect(qs.get("body")).toBe(message);
    expect(href).not.toContain("+"); // mailto exige %20, não +
  });
});
