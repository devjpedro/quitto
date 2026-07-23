import { describe, expect, it } from "bun:test";
import { isValidPixKey, parsePixKey } from "../src/pix";

const CPF_ERROR_RE = /CPF/i;

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
