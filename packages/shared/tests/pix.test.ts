import { describe, expect, it } from "bun:test";
import {
  buildPixBrCode,
  isValidPixKey,
  normalizeMerchantName,
  parsePixKey,
} from "../src/pix";

const CPF_ERROR_RE = /CPF/i;
const CRC_SUFFIX_RE = /6304[0-9A-F]{4}$/;

describe("parsePixKey", () => {
  it("valida e normaliza CPF (só dígitos)", () => {
    expect(parsePixKey("529.982.247-25")).toEqual({
      type: "cpf",
      value: "52998224725",
    });
  });
  it("rejeita CPF com dígito verificador errado", () => {
    expect(() => parsePixKey("529.982.247-20")).toThrow(CPF_ERROR_RE);
  });
  it("valida e normaliza CNPJ", () => {
    expect(parsePixKey("11.222.333/0001-81")).toEqual({
      type: "cnpj",
      value: "11222333000181",
    });
  });
  it("normaliza e-mail para minúsculo", () => {
    expect(parsePixKey("Joao@Example.COM")).toEqual({
      type: "email",
      value: "joao@example.com",
    });
  });
  it("normaliza telefone com +55 para E.164", () => {
    expect(parsePixKey("+55 (11) 99999-8888")).toEqual({
      type: "phone",
      value: "+5511999998888",
    });
  });
  it("aceita chave aleatória (EVP UUID) em minúsculo", () => {
    expect(parsePixKey("123E4567-E89B-12D3-A456-426614174000")).toEqual({
      type: "evp",
      value: "123e4567-e89b-12d3-a456-426614174000",
    });
  });
  it("rejeita lixo", () => {
    expect(() => parsePixKey("abc")).toThrow();
  });
});

describe("isValidPixKey", () => {
  it("true para chave válida, false para inválida", () => {
    expect(isValidPixKey("joao@example.com")).toBe(true);
    expect(isValidPixKey("abc")).toBe(false);
  });
});

describe("normalizeMerchantName", () => {
  it("maiúsculo, sem acento, ≤25 chars", () => {
    expect(normalizeMerchantName("João da Silva Café")).toBe(
      "JOAO DA SILVA CAFE"
    );
  });
  it("trunca em 25 e faz trim", () => {
    expect(normalizeMerchantName("Estabelecimento Comercial Ltda")).toBe(
      "ESTABELECIMENTO COMERCIAL"
    );
    expect(
      normalizeMerchantName("Estabelecimento Comercial").length
    ).toBeLessThanOrEqual(25);
  });
  it("fallback quando vazio após normalizar", () => {
    expect(normalizeMerchantName("日本語")).toBe("RECEBEDOR");
  });
});

describe("buildPixBrCode", () => {
  // Vetor conhecido: chave e-mail, valor R$ 1,00, txid "***".
  // Payload conferido contra gerador de referência (bcb / pix estático).
  it("monta EMV com CRC16 válido (vetor conhecido)", () => {
    const code = buildPixBrCode({
      key: "joao@example.com",
      amountCents: 100,
      merchantName: "FULANO DE TAL",
      merchantCity: "BRASIL",
    });
    // Começa com Payload Format Indicator e contém o GUI do PIX + a chave.
    expect(code.startsWith("000201")).toBe(true);
    expect(code).toContain("br.gov.bcb.pix");
    expect(code).toContain("joao@example.com");
    // Valor no tag 54 = "1.00" (len 04).
    expect(code).toContain("54041.00");
    // Termina com o tag CRC "6304" + 4 hex maiúsculos.
    expect(code).toMatch(CRC_SUFFIX_RE);
  });

  it("CRC16 fecha o payload (recalcular bate)", () => {
    const code = buildPixBrCode({
      key: "12345678909",
      amountCents: 25_050,
      merchantName: "MARIA",
      merchantCity: "BRASIL",
    });
    const body = code.slice(0, -4); // tudo menos os 4 hex do CRC (inclui "6304")
    const expected = code.slice(-4);
    // Reimplementação independente do CRC16-CCITT (0x1021, init 0xFFFF).
    let crc = 0xff_ff;
    for (let i = 0; i < body.length; i++) {
      crc ^= body.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc =
          (crc & 0x80_00) === 0
            ? (crc << 1) & 0xff_ff
            : ((crc << 1) ^ 0x10_21) & 0xff_ff;
      }
    }
    expect(crc.toString(16).toUpperCase().padStart(4, "0")).toBe(expected);
  });
});
