import { describe, expect, it } from "vitest";
import { Route } from "../src/routes/_focus/contracts.new";

// `Route.options.validateSearch` é a união de todos os formatos de validador
// aceitos pelo router; aqui ele é a função que a rota declara.
const validateSearch = Route.options.validateSearch as (
  s: Record<string, unknown>
) => { title?: string };

describe("validateSearch de /contracts/new", () => {
  it("apara o título recebido", () => {
    expect(validateSearch({ title: "  aluguel do apê  " })).toEqual({
      title: "aluguel do apê",
    });
  });

  it("corta o título no maxLength da API (200)", () => {
    const result = validateSearch({ title: "a".repeat(250) });
    expect(result.title).toHaveLength(200);
  });

  it("devolve {} sem title, com title vazio ou com tipo errado", () => {
    expect(validateSearch({})).toEqual({});
    expect(validateSearch({ title: "   " })).toEqual({});
    expect(validateSearch({ title: 42 })).toEqual({});
  });
});
