import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth-error-message";

const JA_CADASTRADO_RE = /já está cadastrado/i;
const LONGA_RE = /longa/i;
const VAZAMENTO_RE = /vazamento/i;
const EMAIL_INVALIDO_RE = /e-mail inválido/i;
const EMAIL_OU_SENHA_RE = /e-mail ou senha/i;
const REVELA_EXISTENCIA_RE = /não cadastrad|não existe|conta não/i;
const AGUARDE_RE = /aguarde|tentativas/i;
const GENERICO_SIGNUP_RE = /criar a conta/i;
const GENERICO_SIGNIN_RE = /entrar/i;

describe("authErrorMessage", () => {
  it("e-mail já cadastrado (código do sign-up real, 422)", () => {
    const msg = authErrorMessage(
      { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
      "signup"
    );
    expect(msg).toMatch(JA_CADASTRADO_RE);
  });

  it("aceita a variante curta USER_ALREADY_EXISTS", () => {
    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS" }, "signup")).toBe(
      authErrorMessage(
        { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
        "signup"
      )
    );
  });

  it("senha curta diz o mínimo exigido", () => {
    const msg = authErrorMessage({ code: "PASSWORD_TOO_SHORT" }, "signup");
    expect(msg).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("senha longa demais", () => {
    expect(authErrorMessage({ code: "PASSWORD_TOO_LONG" }, "signup")).toMatch(
      LONGA_RE
    );
  });

  it("senha vazada", () => {
    expect(
      authErrorMessage({ code: "PASSWORD_COMPROMISED" }, "signup")
    ).toMatch(VAZAMENTO_RE);
  });

  it("e-mail inválido", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL" }, "signup")).toMatch(
      EMAIL_INVALIDO_RE
    );
  });

  it("credencial errada não revela se a conta existe", () => {
    const msg = authErrorMessage(
      { code: "INVALID_EMAIL_OR_PASSWORD" },
      "signin"
    );
    expect(msg).toMatch(EMAIL_OU_SENHA_RE);
    expect(msg).not.toMatch(REVELA_EXISTENCIA_RE);
  });

  it("USER_NOT_FOUND no login também não revela a ausência da conta", () => {
    expect(authErrorMessage({ code: "USER_NOT_FOUND" }, "signin")).toBe(
      authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }, "signin")
    );
  });

  it("rate limit orienta a aguardar", () => {
    expect(authErrorMessage({ code: "TOO_MANY_REQUESTS" }, "signin")).toMatch(
      AGUARDE_RE
    );
  });

  it("normaliza código em minúsculas", () => {
    expect(authErrorMessage({ code: "password_too_short" }, "signup")).toBe(
      authErrorMessage({ code: "PASSWORD_TOO_SHORT" }, "signup")
    );
  });

  it("código desconhecido cai no genérico do modo", () => {
    expect(authErrorMessage({ code: "ALGO_NOVO" }, "signup")).toMatch(
      GENERICO_SIGNUP_RE
    );
    expect(authErrorMessage({ code: "ALGO_NOVO" }, "signin")).toMatch(
      GENERICO_SIGNIN_RE
    );
  });

  it("sem código (rede/500) cai no genérico do modo", () => {
    expect(authErrorMessage(undefined, "signin")).toMatch(GENERICO_SIGNIN_RE);
    expect(authErrorMessage({}, "signup")).toMatch(GENERICO_SIGNUP_RE);
  });
});
