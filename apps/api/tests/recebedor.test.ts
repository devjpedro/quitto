import { describe, expect, it } from "bun:test";
import { pickRecebedor, receiverContactId } from "../src/lib/contract-access";

const OWNER = "u-owner";
const SELLER = "u-seller";
const users = new Map([
  [OWNER, { name: "Dono", pixKey: "dono@example.com" }],
  [SELLER, { name: "Maria Conta", pixKey: "maria.conta@example.com" }],
]);

function seller(linkedUserId: string | null, pixKey: string | null) {
  return {
    id: "p-seller",
    displayName: "Maria",
    linkedUserId,
    pixKey,
    role: "seller",
  };
}

describe("pickRecebedor (decisão 3 do dono)", () => {
  it("dono que recebe: vale a chave da conta dele", () => {
    expect(
      pickRecebedor({ ownerId: OWNER, ownerRole: "seller" }, [], users)
    ).toEqual({
      displayName: "Dono",
      hasAccount: true,
      key: "dono@example.com",
      keySource: "account",
    });
  });

  it("recebedor com conta: vale a chave da conta, não a do contato", () => {
    expect(
      pickRecebedor(
        { ownerId: OWNER, ownerRole: "buyer" },
        [seller(SELLER, "guardada@example.com")],
        users
      )
    ).toEqual({
      displayName: "Maria",
      hasAccount: true,
      key: "maria.conta@example.com",
      keySource: "account",
    });
  });

  it("recebedor com conta e sem chave na conta: sem chave (a do contato não volta)", () => {
    const noKey = new Map([[SELLER, { name: "Maria Conta", pixKey: null }]]);
    expect(
      pickRecebedor(
        { ownerId: OWNER, ownerRole: "buyer" },
        [seller(SELLER, "guardada@example.com")],
        noKey
      )
    ).toEqual({
      displayName: "Maria",
      hasAccount: true,
      key: null,
      keySource: null,
    });
  });

  it("sem conta: vale a do contato, com source contact", () => {
    expect(
      pickRecebedor(
        { ownerId: OWNER, ownerRole: "buyer" },
        [seller(null, "guardada@example.com")],
        users
      )
    ).toEqual({
      displayName: "Maria",
      hasAccount: false,
      key: "guardada@example.com",
      keySource: "contact",
    });
  });

  it("sem conta e sem chave no contato: sem chave", () => {
    expect(
      pickRecebedor(
        { ownerId: OWNER, ownerRole: "buyer" },
        [seller(null, null)],
        users
      )
    ).toEqual({
      displayName: "Maria",
      hasAccount: false,
      key: null,
      keySource: null,
    });
  });

  it("nenhum ou mais de um vendedor: ninguém recebe", () => {
    const none = {
      displayName: null,
      hasAccount: false,
      key: null,
      keySource: null,
    };
    expect(
      pickRecebedor({ ownerId: OWNER, ownerRole: "buyer" }, [], users)
    ).toEqual(none);
    expect(
      pickRecebedor(
        { ownerId: OWNER, ownerRole: "buyer" },
        [seller(null, null), { ...seller(null, null), id: "p2" }],
        users
      )
    ).toEqual(none);
  });
});

describe("receiverContactId", () => {
  it("é o participante vendedor sem conta de um contrato em que o dono paga", () => {
    expect(
      receiverContactId({ ownerRole: "buyer" }, [seller(null, null)])
    ).toBe("p-seller");
    expect(
      receiverContactId({ ownerRole: "buyer" }, [seller(SELLER, null)])
    ).toBeNull();
    expect(
      receiverContactId({ ownerRole: "seller" }, [seller(null, null)])
    ).toBeNull();
  });
});
