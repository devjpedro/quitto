import type { PublicReceipt } from "@quitto/shared";
import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: (await import("./router-link-stub")).LinkStub,
  useHydrated: () => true,
}));

import { PublicReceiptPage } from "../src/features/receipts/components/public-receipt-page";
import { ReceiptUnavailable } from "../src/features/receipts/components/receipt-unavailable";
import { queryKeys } from "../src/lib/query-keys";
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
  proofAt: null,
  proofBy: null,
  receiverName: "João Pedro",
};

const PARCELA_RE = /Parcela 3 de 12 · paga em 05\/09\/2026/;
const PARCELA_EN_RE = /Installment 3 of 12 · paid on 09\/05\/2026/;
const PROOF_PT =
  "Comprovante enviado por Maria em 12/07/2026 às 22:30 e registrado no Quitto";
const PROOF_EN =
  "Proof sent by Maria on 07/12/2026 at 22:30 and recorded on Quitto";
const PROOF = { proofAt: "2026-07-13T01:30:00.000Z", proofBy: "Maria" };
const REVOKED_RE = /revogad/i;
const SIGNUP_RE = /criar conta|cadastr/i;

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

afterEach(() => {
  toastSuccess.mockReset();
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

  it("Imprimir no computador baixa o PDF da API e o põe num iframe escondido (não imprime a página)", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const fetchPdf = vi
      .spyOn(globalThis, "fetch")
      // A string body: undici's Response can't read jsdom's Blob in every Node.
      .mockResolvedValue(
        new Response("%PDF", { headers: { "content-type": "application/pdf" } })
      );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: () => "blob:receipt",
    });
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    await waitFor(() =>
      expect(document.querySelector('iframe[aria-hidden="true"]')).toBeTruthy()
    );
    expect(fetchPdf).toHaveBeenCalledWith(
      "/api/public/receipts/tok/receipt.pdf"
    );
    expect(print).not.toHaveBeenCalled();
    document.querySelector("iframe")?.remove();
    Reflect.deleteProperty(URL, "createObjectURL");
  });

  it("Imprimir no celular abre o PDF numa aba (o visualizador do sistema imprime)", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchPdf = vi.spyOn(globalThis, "fetch");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    );
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    await userEvent.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(open).toHaveBeenCalledWith(
      "/api/public/receipts/tok/receipt.pdf?inline=1",
      "_blank",
      "noopener"
    );
    expect(fetchPdf).not.toHaveBeenCalledWith(
      "/api/public/receipts/tok/receipt.pdf"
    );
  });

  it("o horário do comprovante, no fuso de São Paulo; sem comprovante, a linha não existe", () => {
    const { unmount } = render(
      <PublicReceiptPage receipt={{ ...receipt, ...PROOF }} token="tok" />
    );
    expect(screen.getByTestId("receipt-proof")).toHaveTextContent(PROOF_PT);
    unmount();
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    expect(screen.queryByTestId("receipt-proof")).toBeNull();
  });

  it("o horário do comprovante em en-US", () => {
    overwriteGetLocale(() => "en-US");
    render(
      <PublicReceiptPage receipt={{ ...receipt, ...PROOF }} token="tok" />
    );
    expect(screen.getByTestId("receipt-proof")).toHaveTextContent(PROOF_EN);
  });

  it("Compartilhar e Imprimir são só ícone: nome e dica pelo aria-label", () => {
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    for (const name of ["Compartilhar", "Imprimir"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeVisible();
      expect(button).toHaveTextContent("");
    }
  });

  it("Compartilhar no computador copia o link e avisa", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    await user.click(screen.getByRole("button", { name: "Compartilhar" }));
    // Always the canonical link, whatever the address bar says.
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/r/tok`);
    expect(toastSuccess).toHaveBeenCalledWith("Link copiado");
  });

  it("Compartilhar no celular (Android, com navigator.share) abre o compartilhamento do sistema", async () => {
    const user = userEvent.setup();
    const share = vi.fn(() => Promise.resolve());
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36"
    );
    render(<PublicReceiptPage receipt={receipt} token="tok" />);
    await user.click(screen.getByRole("button", { name: "Compartilhar" }));
    expect(share).toHaveBeenCalledWith({
      url: `${window.location.origin}/r/tok`,
    });
    expect(writeText).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "share");
  });

  it("deslogado vê o convite 'Criar conta'; logado, não", () => {
    const { unmount } = render(
      <PublicReceiptPage receipt={receipt} token="tok" />
    );
    expect(screen.getAllByRole("link", { name: "Criar conta" }).length).toBe(2);
    unmount();
    const client = new QueryClient();
    client.setQueryData(queryKeys.session, {
      id: "u1",
      name: "João Souza",
      email: "joao@x.dev",
      image: null,
    });
    render(<PublicReceiptPage receipt={receipt} token="tok" />, { client });
    expect(screen.queryByRole("link", { name: "Criar conta" })).toBeNull();
    expect(screen.getByTestId("public-receipt")).toBeVisible();
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
