import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { LOGO_ARC, RING, TRACK_MIX } from "./ring-geometry";

type LogoVariant = "brand" | "inverted";

// brand: Floresta from the tokens, so it follows the dark theme (#7CC495),
// with the track at 22% of it (DIRECAO › Logo). inverted: the white ring on
// the brand panel (sign-in), which is always dark.
const RING_COLORS: Record<LogoVariant, { arc: string; track: string }> = {
  brand: {
    track: `color-mix(in oklab, var(--brand) ${TRACK_MIX}%, transparent)`,
    arc: "var(--brand)",
  },
  inverted: { track: "rgba(255,255,255,0.35)", arc: "#ffffff" },
};

// The word's color; inverted inherits currentColor (the panel's white).
const TEXT_COLOR: Record<LogoVariant, string> = {
  brand: "text-brand",
  inverted: "",
};

const WORDMARK = {
  defaultSize: 20,
  // The ring's diameter as a share of the font size (it matches the "o").
  ringToFontRatio: 0.72,
  // Vertical nudge (× font size) that seats the ring on the baseline.
  baselineShiftRatio: -0.13,
} as const;

export function LogoMark({
  size = WORDMARK.defaultSize,
  variant = "brand",
  style,
}: {
  size?: number;
  style?: CSSProperties;
  variant?: LogoVariant;
}) {
  const { track, arc } = RING_COLORS[variant];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      // inline-block undoes Tailwind's reset (svg { display: block }), so the
      // ring flows as the word's last "o" and vertical-align applies.
      style={{ display: "inline-block", ...style }}
      viewBox={`0 0 ${RING.box} ${RING.box}`}
      width={size}
    >
      <circle
        cx={RING.center}
        cy={RING.center}
        fill="none"
        r={RING.radius}
        stroke={track}
        strokeWidth={RING.strokeWidth}
      />
      <circle
        cx={RING.center}
        cy={RING.center}
        fill="none"
        r={RING.radius}
        stroke={arc}
        strokeDasharray={LOGO_ARC.dashArray}
        strokeLinecap="round"
        strokeWidth={RING.strokeWidth}
        transform={`rotate(${LOGO_ARC.rotation} ${RING.center} ${RING.center})`}
      />
    </svg>
  );
}

/** The Quitto wordmark: "quitt" and the ring for the "o". 24 px in the sidebar, 22 px on the phone's top bar. */
export function Logo({
  className,
  size = WORDMARK.defaultSize,
  variant = "brand",
}: {
  className?: string;
  size?: number;
  variant?: LogoVariant;
}) {
  return (
    <span
      aria-label="Quitto"
      className={cn(
        "select-none whitespace-nowrap font-bold font-display leading-none tracking-[-0.03em]",
        TEXT_COLOR[variant],
        className
      )}
      role="img"
      style={{ fontSize: size }}
    >
      <span aria-hidden="true">quitt</span>
      <LogoMark
        size={Math.round(size * WORDMARK.ringToFontRatio)}
        style={{
          marginLeft: 1,
          verticalAlign: size * WORDMARK.baselineShiftRatio,
        }}
        variant={variant}
      />
    </span>
  );
}
