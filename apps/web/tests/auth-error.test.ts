import { afterEach, describe, expect, it } from "vitest";
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
} from "@/features/auth/lib/auth-error";
import { overwriteGetLocale } from "@/paraglide/runtime.js";

const CODES = [
  "USER_ALREADY_EXISTS",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_COMPROMISED",
  "INVALID_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "TOO_MANY_REQUESTS",
];

afterEach(() => overwriteGetLocale(() => "pt-BR"));

describe("authErrorMessage", () => {
  it("credencial inválida e conta inexistente: a mesma frase", () => {
    expect(authErrorMessage({ code: "USER_NOT_FOUND" }, "signin")).toBe(
      authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, "signin")
    );
  });

  it("cada código na sua frase, nos dois idiomas", () => {
    const pt = CODES.map((code) => authErrorMessage({ code }, "signup"));
    overwriteGetLocale(() => "en-US");
    const en = CODES.map((code) => authErrorMessage({ code }, "signup"));
    expect(new Set(pt.slice(0, 4).concat(pt.slice(5))).size).toBe(6);
    for (let i = 0; i < CODES.length; i++) {
      expect(en[i]).not.toBe(pt[i]);
    }
    expect(pt[1]).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("código desconhecido: o genérico do modo", () => {
    expect(authErrorMessage({ code: "ALGO_NOVO" }, "signin")).toBe(
      "Não deu para entrar. Confira os dados e tente de novo."
    );
    expect(authErrorMessage(undefined, "signup")).toBe(
      "Não deu para criar a conta. Confira os dados e tente de novo."
    );
  });

  it("normaliza o código em minúsculas", () => {
    expect(authErrorMessage({ code: "password_too_short" }, "signup")).toBe(
      authErrorMessage({ code: "PASSWORD_TOO_SHORT" }, "signup")
    );
  });
});
