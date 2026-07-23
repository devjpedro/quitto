import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixBlock } from "../src/components/pix-block";

const COPIAR_NAME = /copiar/i;
const QR_CODE_PIX_NAME = /qr code pix/i;

const pix = { copiaECola: "000201...6304ABCD", keyType: "email" };

describe("PixBlock", () => {
  it("renderiza QR (svg), a copia-e-cola e o botão copiar", () => {
    const { container } = render(<PixBlock pix={pix} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText(pix.copiaECola)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: COPIAR_NAME })
    ).toBeInTheDocument();
  });

  it("tem um rótulo acessível no QR", () => {
    render(<PixBlock pix={pix} />);
    expect(
      screen.getByRole("img", { name: QR_CODE_PIX_NAME })
    ).toBeInTheDocument();
  });
});
