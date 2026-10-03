import { describe, expect, it } from "bun:test";
import { installmentPix } from "../src/lib/installment-pix";

const recebedor = {
  displayName: "Maria José",
  profileKey: "maria@example.com",
};

describe("installmentPix", () => {
  it("a chave do contrato vence a do perfil, com valor, nome e cidade no código", () => {
    const pix = installmentPix("loja@example.com", recebedor, 12_345);
    expect(pix?.keyType).toBe("email");
    expect(pix?.code).toStartWith("000201");
    expect(pix?.code).toContain("0116loja@example.com");
    expect(pix?.code).not.toContain("maria@example.com");
    expect(pix?.code).toContain("5406123.45");
    expect(pix?.code).toContain("5910MARIA JOSE");
    expect(pix?.code).toContain("6006BRASIL");
  });

  it("sem chave no contrato, usa a do perfil do recebedor", () => {
    const pix = installmentPix(null, recebedor, 10_000);
    expect(pix?.keyType).toBe("email");
    expect(pix?.code).toContain("0117maria@example.com");
  });

  it("sem chave nenhuma não há código", () => {
    expect(
      installmentPix(null, { displayName: "Maria", profileKey: null }, 100)
    ).toBeNull();
  });

  it("chave guardada que não é mais válida dá null, sem lançar", () => {
    expect(installmentPix("não-é-chave", recebedor, 100)).toBeNull();
  });

  it("recebedor sem nome usa o nome padrão do BR Code", () => {
    const pix = installmentPix(
      "loja@example.com",
      { displayName: null, profileKey: null },
      100
    );
    expect(pix?.code).toContain("5909RECEBEDOR");
  });
});
