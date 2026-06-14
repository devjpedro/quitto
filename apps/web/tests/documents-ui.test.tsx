import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ExportMenu } from "../src/components/export-menu";
import { ReceiptLink } from "../src/components/receipt-link";
import { renderWithProviders } from "./test-utils";

const RE_RECIBO = /recibo/i;
const RE_EXPORTAR = /exportar/i;
const RE_PDF = /pdf/i;
const RE_CSV = /csv/i;

describe("ReceiptLink", () => {
  it("exibe link de download quando a parcela está paga", () => {
    renderWithProviders(<ReceiptLink installmentId="i1" status="paid" />);
    const link = screen.getByRole("link", { name: RE_RECIBO });
    expect(link).toHaveAttribute("href", "/api/installments/i1/receipt.pdf");
    expect(link).toHaveAttribute("download");
  });

  it("não renderiza nada quando a parcela não está paga", () => {
    const { container } = renderWithProviders(
      <ReceiptLink installmentId="i1" status="pending" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ExportMenu", () => {
  it("abre o menu e expõe os downloads de PDF e CSV", async () => {
    renderWithProviders(<ExportMenu contractId="c1" />);
    await userEvent.click(screen.getByRole("button", { name: RE_EXPORTAR }));

    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: RE_PDF })).toBeInTheDocument()
    );

    const pdf = screen.getByRole("menuitem", { name: RE_PDF });
    expect(pdf).toHaveAttribute("href", "/api/contracts/c1/statement.pdf");
    expect(pdf).toHaveAttribute("download");

    const csv = screen.getByRole("menuitem", { name: RE_CSV });
    expect(csv).toHaveAttribute("href", "/api/contracts/c1/statement.csv");
    expect(csv).toHaveAttribute("download");
  });
});
