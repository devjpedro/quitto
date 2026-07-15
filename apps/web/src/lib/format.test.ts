import { describe, expect, it } from "vitest";
import { formatBRLParts } from "@/lib/format";

describe("formatBRLParts", () => {
  it("separa símbolo, inteiro e centavos", () => {
    expect(formatBRLParts(200_000)).toEqual({
      currency: "R$",
      integer: "2.000",
      decimal: ",00",
    });
  });
  it("valores pequenos", () => {
    expect(formatBRLParts(85_000)).toEqual({
      currency: "R$",
      integer: "850",
      decimal: ",00",
    });
  });
  it("centavos quebrados", () => {
    expect(formatBRLParts(127_550)).toEqual({
      currency: "R$",
      integer: "1.275",
      decimal: ",50",
    });
  });
  it("zero", () => {
    expect(formatBRLParts(0)).toEqual({
      currency: "R$",
      integer: "0",
      decimal: ",00",
    });
  });
});
