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

const DIACRITICS_RE = /[̀-ͯ]/g;
const NON_ALLOWED_CHARS_RE = /[^A-Z0-9 ]/g;
const EXTRA_SPACES_RE = /\s+/g;

/** TLV: ID(2) + LEN(2, zero-pad) + VALUE. Assume valores ASCII (chave/nome/cidade normalizados). */
function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), 4 hex maiúsculos. */
function crc16(payload: string): string {
  let crc = 0xff_ff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc =
        (crc & 0x80_00) === 0
          ? (crc << 1) & 0xff_ff
          : ((crc << 1) ^ 0x10_21) & 0xff_ff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** amountCents → string decimal com ponto e 2 casas: 100 → "1.00", 25050 → "250.50". */
function formatPixAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Maiúsculo, sem acento, só [A-Z0-9 ], colapsa espaços, ≤25; fallback "RECEBEDOR". */
export function normalizeMerchantName(name: string): string {
  const ascii = name
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")
    .toUpperCase()
    .replace(NON_ALLOWED_CHARS_RE, " ")
    .replace(EXTRA_SPACES_RE, " ")
    .trim()
    .slice(0, 25)
    .trim();
  return ascii.length > 0 ? ascii : "RECEBEDOR";
}

/** Monta a copia-e-cola (BR Code EMV estático) com valor embutido. */
export function buildPixBrCode(input: {
  key: string;
  amountCents: number;
  merchantName: string;
  merchantCity: string;
  txid?: string;
}): string {
  const { key, amountCents, merchantName, merchantCity, txid = "***" } = input;
  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const additionalData = tlv("05", txid);
  const body =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", formatPixAmount(amountCents)) +
    tlv("58", "BR") +
    tlv("59", merchantName.slice(0, 25)) +
    tlv("60", merchantCity.slice(0, 15)) +
    tlv("62", additionalData) +
    "6304";
  return body + crc16(body);
}
