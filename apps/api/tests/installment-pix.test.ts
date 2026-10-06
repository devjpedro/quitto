import { describe, expect, it } from "bun:test";
import { installmentPix } from "../src/lib/installment-pix";

const account = {
  displayName: "Maria José",
  hasAccount: true,
  key: "maria@example.com",
  keySource: "account" as const,
};

describe("installmentPix", () => {
  it("monta o BR Code com valor, nome e cidade, e diz a chave e a origem", () => {
    const pix = installmentPix(account, 12_345);
    expect(pix).toMatchObject({
      key: "maria@example.com",
      keyType: "email",
      source: "account",
    });
    expect(pix?.code).toStartWith("000201");
    expect(pix?.code).toContain("0117maria@example.com");
    expect(pix?.code).toContain("5406123.45");
    expect(pix?.code).toContain("5910MARIA JOSE");
    expect(pix?.code).toContain("6006BRASIL");
  });

  it("a chave do contato sai com source contact", () => {
    const pix = installmentPix(
      {
        displayName: "Helena Duarte",
        hasAccount: false,
        key: "helena.duarte@exemplo.com",
        keySource: "contact",
      },
      180_000
    );
    expect(pix?.source).toBe("contact");
    expect(pix?.code).toContain("helena.duarte@exemplo.com");
  });

  it("sem chave nenhuma não há código", () => {
    expect(
      installmentPix(
        { displayName: "Maria", hasAccount: false, key: null, keySource: null },
        100
      )
    ).toBeNull();
  });

  it("chave guardada que não é mais válida dá null, sem lançar", () => {
    expect(installmentPix({ ...account, key: "não-é-chave" }, 100)).toBeNull();
  });

  it("recebedor sem nome usa o nome padrão do BR Code", () => {
    expect(
      installmentPix({ ...account, displayName: null }, 100)?.code
    ).toContain("5909RECEBEDOR");
  });
});
