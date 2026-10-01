/** Mínimo aceito pelo better-auth (emailAndPassword.minPasswordLength, default 8). */
export const MIN_PASSWORD_LENGTH = 8;

export type AuthMode = "signin" | "signup";

const GENERIC: Record<AuthMode, string> = {
  signin: "Não foi possível entrar. Verifique os dados e tente novamente.",
  signup:
    "Não foi possível criar a conta. Verifique os dados e tente novamente.",
};

/**
 * Credencial inválida e conta inexistente compartilham a mesma mensagem de
 * propósito: distinguir as duas entregaria enumeração de usuários.
 */
const INVALID_CREDENTIALS = "E-mail ou senha incorretos.";

const BY_CODE: Record<string, string> = {
  USER_ALREADY_EXISTS:
    "Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Este e-mail já está cadastrado. Entre na sua conta ou use outro e-mail.",
  PASSWORD_TOO_SHORT: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  PASSWORD_TOO_LONG: "A senha é longa demais. Escolha uma senha mais curta.",
  PASSWORD_COMPROMISED:
    "Essa senha apareceu em vazamentos de dados. Escolha outra.",
  INVALID_EMAIL: "E-mail inválido. Confira o endereço digitado.",
  INVALID_EMAIL_OR_PASSWORD: INVALID_CREDENTIALS,
  USER_NOT_FOUND: INVALID_CREDENTIALS,
  TOO_MANY_REQUESTS:
    "Muitas tentativas seguidas. Aguarde um instante e tente novamente.",
};

/** Traduz o erro do better-auth para pt-BR; código desconhecido -> genérico do modo. */
export function authErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  mode: AuthMode
): string {
  const code = error?.code?.toUpperCase();
  return (code && BY_CODE[code]) || GENERIC[mode];
}
