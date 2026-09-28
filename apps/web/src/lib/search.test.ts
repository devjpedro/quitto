import { describe, expect, it } from "vitest";
import {
  commandFilter,
  normalize,
  scoreMatch,
  sortByUrgency,
} from "@/lib/search";

describe("normalize", () => {
  it("remove diacrítico", () => expect(normalize("João")).toBe("joao"));
  it("baixa a caixa", () => expect(normalize("ALUGUEL")).toBe("aluguel"));
  it("trata ç", () => expect(normalize("Coração")).toBe("coracao"));
  it("colapsa espaço e apara as pontas", () =>
    expect(normalize("  Empréstimo   do   João ")).toBe("emprestimo do joao"));
  it("é idempotente", () =>
    expect(normalize(normalize("Ônibus"))).toBe("onibus"));
});

describe("scoreMatch", () => {
  it("pontua no máximo quando é prefixo", () =>
    expect(scoreMatch("Aluguel 2026", "alu")).toBe(1));
  it("acha sem acento o que tem acento", () =>
    expect(scoreMatch("Empréstimo do João", "emprestimo")).toBeGreaterThan(0));
  it("acha nome de participante sem acento", () =>
    expect(scoreMatch("João Silva", "joao")).toBe(1));
  it("pontua início de palavra acima de meio de palavra", () =>
    expect(scoreMatch("Conta de luz", "luz")).toBeGreaterThan(
      scoreMatch("Deslumbrante", "lum")
    ));
  it("aceita subsequência", () =>
    expect(scoreMatch("Aluguel", "alg")).toBeGreaterThan(0));
  it("devolve 0 quando não casa", () =>
    expect(scoreMatch("Aluguel", "xyz")).toBe(0));
  it("busca vazia casa tudo", () =>
    expect(scoreMatch("qualquer coisa", "")).toBe(1));
});

describe("commandFilter", () => {
  it("pontua pela melhor keyword", () =>
    expect(
      // a keyword vazia representa contrato sem descrição
      commandFilter("uuid-1", "joao", ["Aluguel", "", "João Silva"])
    ).toBe(1));

  it("ignora o value (uuid não pode pontuar)", () =>
    expect(commandFilter("abc-123-def", "abc", ["Aluguel"])).toBe(0));

  it("devolve 0 para item sem keywords", () =>
    expect(commandFilter("uuid-1", "alu", [])).toBe(0));
});

describe("sortByUrgency", () => {
  const a = { overdueCount: 0, nextDueDate: "2026-12-01", id: "a" };
  const b = { overdueCount: 2, nextDueDate: "2027-01-01", id: "b" };
  const c = { overdueCount: 0, nextDueDate: "2026-09-01", id: "c" };
  const d = { overdueCount: 0, nextDueDate: null, id: "d" };

  it("vencidos vêm primeiro, mesmo com vencimento mais distante", () =>
    expect(sortByUrgency([a, b, c, d])[0]).toBe(b));

  it("dentro do bloco em dia, ordena por vencimento mais próximo", () => {
    const ordered = sortByUrgency([a, c]);
    expect(ordered.map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("quitado (nextDueDate null) vai por último", () =>
    expect(sortByUrgency([d, a, c]).at(-1)).toBe(d));

  it("não muta a lista recebida", () => {
    const input = [a, b];
    sortByUrgency(input);
    expect(input).toEqual([a, b]);
  });
});
