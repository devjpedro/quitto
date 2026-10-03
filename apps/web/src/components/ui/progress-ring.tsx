import { RING, RING_CIRCUMFERENCE } from "@/components/ring-geometry";
import { cn } from "@/lib/utils";

const TONE = {
  brand: { track: "stroke-brand/22", arc: "stroke-brand" },
  // On the lime card (mockup 13): dark ink, the track at 16%.
  onHighlight: { track: "stroke-on-highlight/16", arc: "stroke-on-highlight" },
} as const;

/**
 * Progress where space is short (DIRECAO › Progresso): the logo's ring, the
 * arc filling from the top. 16 px in the sidebar, 22 px on the lime card,
 * 18 px in the guide's title. Decorative: the text beside it carries the
 * number (the fraction, the %).
 */
export function ProgressRing({
  className,
  percent,
  size,
  tone = "brand",
}: {
  className?: string;
  percent: number;
  size: number;
  tone?: keyof typeof TONE;
}) {
  const share = Math.min(100, Math.max(0, percent)) / 100;
  const colors = TONE[tone];
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0", className)}
      focusable="false"
      height={size}
      viewBox={`0 0 ${RING.box} ${RING.box}`}
      width={size}
    >
      <circle
        className={colors.track}
        cx={RING.center}
        cy={RING.center}
        fill="none"
        r={RING.radius}
        strokeWidth={RING.strokeWidth}
      />
      {share > 0 ? (
        <circle
          className={colors.arc}
          cx={RING.center}
          cy={RING.center}
          fill="none"
          r={RING.radius}
          strokeDasharray={`${(share * RING_CIRCUMFERENCE).toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`}
          strokeLinecap="round"
          strokeWidth={RING.strokeWidth}
          transform={`rotate(-90 ${RING.center} ${RING.center})`}
        />
      ) : null}
    </svg>
  );
}
