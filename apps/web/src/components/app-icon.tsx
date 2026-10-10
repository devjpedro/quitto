import { LOGO_ARC, RING } from "./ring-geometry";

/** Floresta, the light brand surface: an icon file cannot read CSS variables. */
export const APP_ICON_SURFACE = "#1F5A32";

/**
 * The app icon and the favicon (DIRECAO › Logo): the logo's ring in white on
 * a Floresta square, the ring at 60% of the side and the corners at 30%.
 * `maskable` fills the square edge to edge (the platform rounds it).
 * public/favicon.svg and the PNG icons are rendered from this component
 * (apps/web/scripts/app-icons.tsx for the favicon, e2e/scripts/app-icons.ts
 * for the PNGs); a test keeps the favicon in sync. After changing it, run
 * `cd e2e && bun scripts/app-icons.ts`: it regenerates the favicon and the PNGs.
 */
export function AppIcon({
  maskable = false,
  size = 32,
}: {
  maskable?: boolean;
  size?: number;
}) {
  return (
    <svg
      aria-label="Quitto"
      height={size}
      role="img"
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Quitto</title>
      <rect
        fill={APP_ICON_SURFACE}
        height="32"
        rx={maskable ? 0 : 9.6}
        width="32"
      />
      <g transform="translate(6.4 6.4) scale(0.8)">
        <circle
          cx={RING.center}
          cy={RING.center}
          fill="none"
          r={RING.radius}
          stroke="rgb(255 255 255 / 0.3)"
          strokeWidth={RING.strokeWidth}
        />
        <circle
          cx={RING.center}
          cy={RING.center}
          fill="none"
          r={RING.radius}
          stroke="#FFFFFF"
          strokeDasharray={LOGO_ARC.dashArray}
          strokeLinecap="round"
          strokeWidth={RING.strokeWidth}
          transform={`rotate(${LOGO_ARC.rotation} ${RING.center} ${RING.center})`}
        />
      </g>
    </svg>
  );
}
