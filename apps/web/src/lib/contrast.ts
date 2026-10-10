const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function linearChannel(hexPair: string): number {
  const value = Number.parseInt(hexPair, 16) / 255;
  return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a `#RRGGBB` color. */
export function relativeLuminance(hex: string): number {
  if (!HEX_RE.test(hex)) {
    throw new Error(`invalid hex: ${hex}`);
  }
  const r = linearChannel(hex.slice(1, 3));
  const g = linearChannel(hex.slice(3, 5));
  const b = linearChannel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `#RRGGBB` colors (1–21). */
export function contrastRatio(
  foregroundHex: string,
  backgroundHex: string
): number {
  const a = relativeLuminance(foregroundHex);
  const b = relativeLuminance(backgroundHex);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
