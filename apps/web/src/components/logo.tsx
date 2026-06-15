import type { CSSProperties } from "react";

type LogoVariant = "brand" | "inverted";

const RING = {
  box: 24,
  center: 12,
  radius: 9,
  strokeWidth: 4,
  // ~70% do anel fechado (circunferência ≈ 56.5)
  dashArray: "40 57",
  // gira a abertura pro canto inferior-direito (relógio quase cheio)
  rotation: 125,
} as const;

const RING_COLORS: Record<LogoVariant, { track: string; arc: string }> = {
  brand: { track: "#cfe8e2", arc: "#0f766e" },
  inverted: { track: "rgba(255,255,255,0.35)", arc: "#ffffff" },
};

// cor do texto do wordmark por variante; inverted herda currentColor (branco do painel)
const TEXT_COLOR: Record<LogoVariant, string> = {
  brand: "text-primary",
  inverted: "",
};

const WORDMARK = {
  defaultSize: 20,
  // diâmetro do anel como fração do font-size (casa com o tamanho do "o")
  ringToFontRatio: 0.72,
  // empurrão vertical (× font-size) pro anel assentar na linha de base
  baselineShiftRatio: -0.13,
} as const;

export function LogoMark({
  size = WORDMARK.defaultSize,
  variant = "brand",
  style,
}: {
  size?: number;
  variant?: LogoVariant;
  style?: CSSProperties;
}) {
  const { track, arc } = RING_COLORS[variant];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      height={size}
      // inline-block contraria o reset do Tailwind (svg { display: block }),
      // pro anel fluir como o "o" final e o vertical-align valer
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
        strokeDasharray={RING.dashArray}
        strokeLinecap="round"
        strokeWidth={RING.strokeWidth}
        transform={`rotate(${RING.rotation} ${RING.center} ${RING.center})`}
      />
    </svg>
  );
}

export function Logo({
  size = WORDMARK.defaultSize,
  variant = "brand",
}: {
  size?: number;
  variant?: LogoVariant;
}) {
  const className = [
    "select-none font-bold font-display tracking-tight",
    TEXT_COLOR[variant],
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-label="Quitto"
      className={className}
      role="img"
      style={{ fontSize: size, whiteSpace: "nowrap" }}
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
