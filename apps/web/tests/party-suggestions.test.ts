import { describe, expect, it } from "vitest";
import { partySuggestions } from "@/features/contract-wizard/lib/party-suggestions";
import { person } from "./people-fixtures";

const NAMES = [
  ["Carlos Lima", "2026-05-01"],
  ["Ana Rocha", "2026-04-01"],
  ["Álvaro Souza", "2026-03-01"],
  ["Marina Pires", "2026-02-01"],
  ["Rafael Prado", "2026-01-01"],
] as const;
const PEOPLE = NAMES.map(([name, at], index) =>
  person({
    key: String(index).repeat(16),
    name,
    lastContractAt: `${at}T12:00:00.000Z`,
  })
);

describe("partySuggestions", () => {
  it("sem texto, as 4 mais recentes", () => {
    expect(partySuggestions(PEOPLE, "").map((p) => p.name)).toEqual([
      "Carlos Lima",
      "Ana Rocha",
      "Álvaro Souza",
      "Marina Pires",
    ]);
  });

  it("o texto filtra pelo começo de qualquer palavra, sem acento e sem caixa", () => {
    expect(partySuggestions(PEOPLE, "pi").map((p) => p.name)).toEqual([
      "Marina Pires",
    ]);
    expect(partySuggestions(PEOPLE, "ALV").map((p) => p.name)).toEqual([
      "Álvaro Souza",
    ]);
    expect(partySuggestions(PEOPLE, "so").map((p) => p.name)).toEqual([
      "Álvaro Souza",
    ]);
    expect(partySuggestions(PEOPLE, "zzz")).toEqual([]);
  });

  it("o nome igual a uma sugestão esconde a linha", () => {
    expect(partySuggestions(PEOPLE, "carlos lima")).toEqual([]);
    expect(partySuggestions(PEOPLE, "  CARLOS  Lima ")).toEqual([]);
  });
});
