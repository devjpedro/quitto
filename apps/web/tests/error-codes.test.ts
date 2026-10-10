import {
  CONTRACT_ERROR_CODES,
  CONTRACT_WARNING_CODES,
  type Locale,
} from "@quitto/shared";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { codeParams, errorCodeText, warningCodeText } from "@/lib/error-codes";
import { errorMessage } from "@/lib/error-message";

const LOCALES: Locale[] = ["pt-BR", "en-US"];

describe("errorCodeText", () => {
  it("todo código tem texto nos dois idiomas, e nunca o próprio código", () => {
    for (const locale of LOCALES) {
      for (const code of CONTRACT_ERROR_CODES) {
        const text = errorCodeText(code, { count: 12, diff: 110_000 }, locale);
        expect(text.trim(), `${locale} ${code}`).not.toBe("");
        expect(text, `${locale} ${code}`).not.toContain(code);
      }
      for (const code of CONTRACT_WARNING_CODES) {
        expect(warningCodeText(code, locale).trim()).not.toBe("");
      }
    }
  });

  it("os parâmetros entram formatados: a diferença em reais, a contagem", () => {
    expect(
      errorCodeText("installments.sum.over", { diff: 110_000 }, "pt-BR")
    ).toBe("A soma passa R$ 1.100,00 do total combinado.");
    expect(
      errorCodeText("schedule.total.tooSmall", { count: 12 }, "en-US")
    ).toBe("This total can't be split into 12 installments.");
  });
});

describe("codeParams", () => {
  it("lê diff e count numéricos dos details e ignora o resto", () => {
    expect(codeParams({ path: "installments", diff: 110_000 })).toEqual({
      diff: 110_000,
    });
    expect(codeParams({ count: "12" })).toEqual({});
    expect(codeParams(undefined)).toEqual({});
  });
});

describe("errorMessage", () => {
  it("um erro da API com código do contrato vira a frase traduzida", () => {
    const error = new ApiError({
      code: "counterparty.email.self",
      httpStatus: 422,
      message: "counterparty.email.self",
      details: { path: "counterparty.email" },
    });
    expect(errorMessage(error)).toBe(
      "Esse é o seu e-mail. Use o da outra parte."
    );
  });

  it("um código que não é do contrato continua com a mensagem da API", () => {
    const error = new ApiError({
      code: "FORBIDDEN",
      httpStatus: 403,
      message: "Sem permissão",
    });
    expect(errorMessage(error)).toBe("Sem permissão");
  });
});
