export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "evp";

const EVP_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_REPEATED_DIGIT_RE = /^(\d)\1{10}$/;
const CNPJ_REPEATED_DIGIT_RE = /^(\d)\1{13}$/;
const PHONE_BR_RE = /^55\d{10,11}$/;

function isValidCPF(cpf: string): boolean {
  if (cpf.length !== 11 || CPF_REPEATED_DIGIT_RE.test(cpf)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(cpf[i]) * (10 - i);
  }
  let d1 = (sum * 10) % 11;
  if (d1 === 10) {
    d1 = 0;
  }
  if (d1 !== Number(cpf[9])) {
    return false;
  }
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(cpf[i]) * (11 - i);
  }
  let d2 = (sum * 10) % 11;
  if (d2 === 10) {
    d2 = 0;
  }
  return d2 === Number(cpf[10]);
}

function isValidCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || CNPJ_REPEATED_DIGIT_RE.test(cnpj)) {
    return false;
  }
  const digit = (len: number): number => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += Number(cnpj[i]) * (weights[i] ?? 0);
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

/** Detecta, valida e normaliza uma chave PIX. Lança Error (pt-BR) se inválida. */
export function parsePixKey(raw: string): { type: PixKeyType; value: string } {
  const t = raw.trim();
  if (t === "") {
    throw new Error("Informe uma chave PIX");
  }
  if (EVP_RE.test(t)) {
    return { type: "evp", value: t.toLowerCase() };
  }
  if (t.includes("@")) {
    const email = t.toLowerCase();
    if (email.length > 77 || !EMAIL_RE.test(email)) {
      throw new Error("E-mail inválido para chave PIX");
    }
    return { type: "email", value: email };
  }
  if (t.startsWith("+")) {
    const d = t.replace(/\D/g, "");
    if (!PHONE_BR_RE.test(d)) {
      throw new Error("Telefone inválido (use +55DDNÚMERO)");
    }
    return { type: "phone", value: `+${d}` };
  }
  const d = t.replace(/\D/g, "");
  if (d.length === 11) {
    if (!isValidCPF(d)) {
      throw new Error("CPF inválido");
    }
    return { type: "cpf", value: d };
  }
  if (d.length === 14) {
    if (!isValidCNPJ(d)) {
      throw new Error("CNPJ inválido");
    }
    return { type: "cnpj", value: d };
  }
  throw new Error("Chave PIX inválida");
}

export function isValidPixKey(raw: string): boolean {
  try {
    parsePixKey(raw);
    return true;
  } catch {
    return false;
  }
}
