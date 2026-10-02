import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { m } from "@/paraglide/messages.js";

function load(locale: string): Record<string, string> {
  const raw = JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, `../src/messages/${locale}.json`),
      "utf8"
    )
  ) as Record<string, string>;
  const { $schema: _schema, ...messages } = raw;
  return messages;
}

const PARAM_RE = /\{(\w+)\}/g;
const params = (text: string) =>
  [...text.matchAll(PARAM_RE)].map((x) => x[1]).sort();

const ptBR = load("pt-BR");
const enUS = load("en-US");

describe("i18n messages", () => {
  it("both locales define exactly the same keys", () => {
    expect(Object.keys(enUS).sort()).toEqual(Object.keys(ptBR).sort());
  });

  it("no message is empty", () => {
    for (const [key, value] of [
      ...Object.entries(ptBR),
      ...Object.entries(enUS),
    ]) {
      expect(value.trim(), key).not.toBe("");
    }
  });

  it("placeholders match between locales", () => {
    for (const [key, value] of Object.entries(ptBR)) {
      expect(params(enUS[key] ?? ""), key).toEqual(params(value));
    }
  });

  it("compiled messages resolve per locale", () => {
    expect(m.skip_to_content({}, { locale: "pt-BR" })).toBe(
      "Pular para o conteúdo"
    );
    expect(m.skip_to_content({}, { locale: "en-US" })).toBe("Skip to content");
  });
});
