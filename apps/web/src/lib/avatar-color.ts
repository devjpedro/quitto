import { WHITESPACE_RE } from "./initials";

/**
 * The 8 warm tones of other people's avatars (tokens.css --avatar-*), in
 * hash order. No teal, blue or brand green: the light green is the user's
 * own avatar.
 */
export const AVATAR_TONES = [
  "bg-avatar-clay",
  "bg-avatar-ochre",
  "bg-avatar-plum",
  "bg-avatar-olive",
  "bg-avatar-cocoa",
  "bg-avatar-rose",
  "bg-avatar-wine",
  "bg-avatar-graphite",
] as const;

export type AvatarTone = (typeof AVATAR_TONES)[number];

// Combining diacritical marks (U+0300 to U+036F), left over by NFD.
const FIRST_MARK = 768;
const LAST_MARK = 879;

/** "  Marína   Pires " → "marina pires": no accents, lower case, single spaces. */
export function normalizeName(name: string): string {
  return [...name.normalize("NFD")]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < FIRST_MARK || code > LAST_MARK;
    })
    .join("")
    .toLowerCase()
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .join(" ");
}

function fnv1a32(text: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash;
}

/** murmur3's finalizer: plain FNV piled common Brazilian names on 2 tones. */
function fmix32(input: number): number {
  let hash = input;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85_eb_ca_6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2_b2_ae_35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/**
 * A person's avatar tone, fixed by the name (DIRECAO › "Pessoas têm
 * rosto"): the same name gets the same color in any contract and any
 * account, accents and spacing aside.
 */
export function avatarColor(name: string): AvatarTone {
  const index = fmix32(fnv1a32(normalizeName(name))) % AVATAR_TONES.length;
  return AVATAR_TONES[index] as AvatarTone;
}
