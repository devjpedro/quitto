import { describe, expect, it } from "vitest";
import {
  personView,
  showsContractAmounts,
} from "@/features/people/lib/person-view";
import { person, personContract } from "./people-fixtures";

const view = (overrides: Parameters<typeof person>[0]) =>
  personView(person(overrides), "pt-BR");

describe("personView", () => {
  it("a tag: atrasada > conferir > em dia > quitado", () => {
    expect(view({ overdueCount: 2, reviewCount: 1 }).tag.label).toBe(
      "2 atrasadas"
    );
    expect(view({ reviewCount: 3 }).tag.label).toBe("3 para conferir");
    expect(view({}).tag.label).toBe("Em dia");
    expect(view({ youOweCents: 0 }).tag.label).toBe("Quitado");
  });

  it("as duas linhas de saldo quando a pessoa tem os dois lados, receber primeiro", () => {
    const v = view({ owesYouCents: 50_000, youOweCents: 20_000 });
    expect(v.balances.map((b) => [b.direction, b.cents])).toEqual([
      ["receive", 50_000],
      ["pay", 20_000],
    ]);
    expect(v.balances[0]?.label).toBe("Te deve");
    expect(v.balances[1]?.label).toBe("Você deve");
  });

  it("Convite pendente, Só o nome e nada para quem tem conta", () => {
    expect(view({ account: "invited" }).accountText).toBe("Convite pendente");
    expect(view({ account: "none" }).accountText).toBe("Só o nome");
    expect(view({ account: "linked" }).accountText).toBeNull();
  });

  it("0 atrasadas nunca chega na chave _one", () => {
    const v = view({ overdueCount: 0, reviewCount: 0 });
    expect(v.tag.label).not.toContain("atrasada");
    expect(view({ overdueCount: 1 }).tag.label).toBe("1 atrasada");
  });

  it("a linha de contratos: o título de um só, a contagem de vários", () => {
    expect(view({}).contractsLine).toBe("Empréstimo do Carlos");
    expect(
      view({
        contracts: [
          personContract({ contractId: "a" }),
          personContract({ contractId: "b", title: "Geladeira" }),
        ],
      }).contractsLine
    ).toBe("2 contratos");
  });
});

describe("showsContractAmounts", () => {
  it("só com dois ou mais abertos no mesmo sentido", () => {
    const open = (id: string, direction: "pay" | "receive") =>
      personContract({ contractId: id, direction });
    expect(showsContractAmounts(person({}))).toBe(false);
    expect(
      showsContractAmounts(
        person({ contracts: [open("a", "pay"), open("b", "pay")] })
      )
    ).toBe(true);
    expect(
      showsContractAmounts(
        person({ contracts: [open("a", "pay"), open("b", "receive")] })
      )
    ).toBe(false);
    expect(
      showsContractAmounts(
        person({
          contracts: [
            open("a", "pay"),
            personContract({ contractId: "b", settled: true }),
          ],
        })
      )
    ).toBe(false);
  });
});
