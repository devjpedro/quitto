import type { PublicReceipt } from "@quitto/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  PublicReceiptPage,
  PublicReceiptUnavailable,
} from "../src/features/receipts/public-receipt-page";

const receipt: PublicReceipt = {
  contractTitle: "Aluguel do apê",
  sequence: 3,
  installmentsCount: 12,
  amountCents: 125_000,
  paidAt: "2026-09-05",
  payerName: "Maria Souza",
  receiverName: "João Pedro",
};

const HEADING_RE = /recibo de pagamento/i;
const PARCELA_RE = /parcela 3 de 12/i;
const DATE_RE = /05\/09\/2026/;
const PDF_RE = /baixar pdf/i;
const PAGADOR_RE = /pagador/i;
const UNAVAILABLE_RE = /este recibo não está disponível/i;
const SIGNUP_RE = /criar conta|cadastr/i;

describe("PublicReceiptPage", () => {
  it("mostra valor, parcela, data, contrato e partes + link do PDF", () => {
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    expect(screen.getByRole("heading", { name: HEADING_RE })).toBeVisible();
    expect(screen.getByText(PARCELA_RE)).toBeVisible();
    expect(screen.getByText(DATE_RE)).toBeVisible();
    expect(screen.getByText("Aluguel do apê")).toBeVisible();
    expect(screen.getByText("Maria Souza")).toBeVisible();
    expect(screen.getByText("João Pedro")).toBeVisible();
    expect(screen.getByRole("link", { name: PDF_RE })).toHaveAttribute(
      "href",
      "/api/public/receipts/tok/receipt.pdf"
    );
  });

  it("omite a linha da parte ausente", () => {
    render(
      <PublicReceiptPage
        receipt={{ ...receipt, payerName: null }}
        token="tok"
      />
    );
    expect(screen.queryByText(PAGADOR_RE)).toBeNull();
    expect(screen.queryByText("null")).toBeNull();
  });

  it("estado indisponível não oferece cadastro", () => {
    render(<PublicReceiptUnavailable />);
    expect(screen.getByText(UNAVAILABLE_RE)).toBeVisible();
    expect(screen.queryByRole("link", { name: SIGNUP_RE })).toBeNull();
  });
});
