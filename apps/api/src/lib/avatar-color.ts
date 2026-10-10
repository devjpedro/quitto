// biome-ignore-all lint/suspicious/noBitwiseOperators: FNV-1a and murmur3's finalizer are defined on 32-bit bit operations (same as the web's avatar-color)
import { normalizeName } from "@quitto/shared";

const WHITESPACE = /\s+/;

/** The warm tones of other people's avatars: the same hex values and hash order as apps/web/src/lib/avatar-color.ts (tokens.css --avatar-*). */
const AVATAR_HEX = [
  "#a4502e",
  "#8a5b00",
  "#7d3c68",
  "#5b6620",
  "#6b4a3a",
  "#9c4257",
  "#7a2e3a",
  "#55544e",
] as const;

function fnv1a32(text: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

function fmix32(input: number): number {
  let hash = input;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85_eb_ca_6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2_b2_ae_35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** A person's avatar color, fixed by the name (same rule as the web). */
export function avatarHex(name: string): string {
  return AVATAR_HEX[
    fmix32(fnv1a32(normalizeName(name))) % AVATAR_HEX.length
  ] as string;
}

/** "João Pedro Souza" → "JS"; empty → "?". */
export function initialsOf(name: string): string {
  const parts = name.normalize("NFC").trim().split(WHITESPACE).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
