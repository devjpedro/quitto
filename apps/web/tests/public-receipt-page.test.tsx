import type { PublicReceipt } from "@quitto/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));

import { PublicReceiptPage } from "../src/features/receipts/components/public-receipt-page";
import { ReceiptUnavailable } from "../src/features/receipts/components/receipt-unavailable";
import { overwriteGetLocale } from "../src/paraglide/runtime.js";
import { Route } from "../src/routes/r.$token";
import { renderWithProviders as render } from "./test-utils";

const receipt: PublicReceipt = {
  contractTitle: "Aluguel do apê",
  sequence: 3,
  installmentsCount: 12,
  amountCents: 125_000,
  paidAt: "2026-09-05",
  payerName: "Maria Souza",
  receiverName: "João Pedro",
};

const PARCELA_RE = /Parcela 3 de 12 · paga em 05\/09\/2026/;
const PARCELA_EN_RE = /Installment 3 of 12 · paid on 09\/05\/2026/;
const REVOKED_RE = /revogad/i;
const SIGNUP_RE = /criar conta|cadastr/i;

afterEach(() => {
  overwriteGetLocale(() => "pt-BR");
  vi.restoreAllMocks();
});

describe("PublicReceiptPage", () => {
  it("o valor, a parcela, a data, o contrato e as duas partes com rosto", () => {
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    const card = screen.getByTestId("public-receipt");
    expect(
      screen.getByRole("heading", { level: 1, name: "Recibo de pagamento" })
    ).toBeVisible();
    expect(card).toHaveTextContent("R$ 1.250,00");
    expect(card).toHaveTextContent(PARCELA_RE);
    expect(card).toHaveTextContent("Aluguel do apê");
    expect(card).toHaveTextContent("Quem pagou");
    expect(card).toHaveTextContent("Maria Souza");
    expect(card).toHaveTextContent("Quem recebeu");
    expect(card).toHaveTextContent("João Pedro");
    // a face for each: initials of the two names
    expect(card).toHaveTextContent("MS");
    expect(card).toHaveTextContent("JP");
  });

  it("a parte ausente não aparece", () => {
    render(
      <PublicReceiptPage
        receipt={{ ...receipt, payerName: null }}
        token="tok"
      />
    );
    expect(screen.queryByText("Quem pagou")).toBeNull();
    expect(screen.queryByText("null")).toBeNull();
    expect(screen.getByText("Quem recebeu")).toBeVisible();
  });

  it("o PDF aponta para /api/public/receipts/<token>/receipt.pdf", () => {
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    expect(screen.getByRole("link", { name: "Baixar PDF" })).toHaveAttribute(
      "href",
      "/api/public/receipts/tok/receipt.pdf"
    );
  });

  it("Imprimir chama window.print", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("em en-US: Payment receipt e a data no formato en-US", () => {
    overwriteGetLocale(() => "en-US");
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Payment receipt" })
    ).toBeVisible();
    expect(screen.getByTestId("public-receipt")).toHaveTextContent(
      PARCELA_EN_RE
    );
  });

  it("o código do recibo mostra só a ponta do token", () => {
    render(
      <PublicReceiptPage
        receipt={receipt}
        token="rTxnbVabcdefghijklmnopqrstuvwxyz0123456789ABC3qc"
      />
    );
    expect(screen.getByText("rTxnbV…3qc")).toBeVisible();
  });
});

describe("recibo indisponível", () => {
  it("a frase, sem cadastro e sem 'revogado'", () => {
    const { container } = render(<ReceiptUnavailable />);
    expect(
      screen.getByRole("heading", { name: "Este recibo não está disponível" })
    ).toBeVisible();
    expect(container).not.toHaveTextContent(REVOKED_RE);
    expect(screen.queryByRole("link", { name: SIGNUP_RE })).toBeNull();
  });
});

describe("o head da rota", () => {
  it("os metadados og: genéricos, sem valor nem nome", () => {
    const head = Route.options.head?.({} as never) as {
      meta?: Record<string, string>[];
    };
    const meta = head.meta ?? [];
    const og = meta.filter((entry) => entry.property?.startsWith("og:"));
    const text = JSON.stringify(meta);
    expect(text).toContain("Recibo de pagamento · Quitto");
    expect(text).toContain("noindex");
    expect(og.length).toBeGreaterThanOrEqual(3);
    for (const name of ["1.250", "Maria", "João"]) {
      expect(text).not.toContain(name);
    }
  });
});
